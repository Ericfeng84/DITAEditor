import { useEffect, useRef } from 'react';
import { baseKeymap } from 'prosemirror-commands';
import { dropCursor } from 'prosemirror-dropcursor';
import { gapCursor } from 'prosemirror-gapcursor';
import { history, redo, undo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { Schema } from 'prosemirror-model';
import {
  EditorState,
  Plugin,
  PluginKey,
  TextSelection,
  type Transaction,
} from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
import {
  ditaSchema,
  evaluateElementConditions,
  getPmNodeRawAttrs,
  pmDocToXml,
  xmlToPmDoc,
  type ParsedDitaval,
} from '@dita/core';

export type InsertKind = 'p' | 'note' | 'ul' | 'codeblock' | 'step';

interface Props {
  value: string;
  /** Resolved `key` → text values, so `<keyword keyref>` never renders as a blank gap. */
  keyValues: Record<string, string>;
  ditaval: ParsedDitaval | null;
  display: 'show-all' | 'dim-excluded' | 'hide-excluded';
  readOnly?: boolean;
  insertRequest: { kind: InsertKind; nonce: number } | null;
  insertText: Record<InsertKind, string>;
  onChange: (xml: string) => void;
  onConversionError: (message: string | null) => void;
}

const conditionsKey = new PluginKey<ParsedDitaval | null>('sandboxConditions');
const keyrefsKey = new PluginKey('sandboxKeyrefs');

/** Used only when the incoming XML cannot be mapped, so the view always exists. */
const FALLBACK_XML = `<?xml version="1.0" encoding="UTF-8"?>
<task id="sandbox"><title>Sandbox</title><taskbody><steps><step><cmd>Edit me</cmd></step></steps></taskbody></task>`;

function buildConditionPlugin(): Plugin<ParsedDitaval | null> {
  return new Plugin<ParsedDitaval | null>({
    key: conditionsKey,
    state: {
      init: () => null,
      apply(tr: Transaction, previous: ParsedDitaval | null) {
        const next = tr.getMeta(conditionsKey) as ParsedDitaval | null | undefined;
        return next === undefined ? previous : next;
      },
    },
    props: {
      decorations(state) {
        const ditaval = conditionsKey.getState(state);
        if (!ditaval) return null;
        const decorations: Decoration[] = [];
        state.doc.descendants((node, pos) => {
          if (node.type.name === 'doc') return;
          const rawAttrs = getPmNodeRawAttrs(node);
          if (rawAttrs.length === 0) return;
          const evaluation = evaluateElementConditions(rawAttrs, ditaval);
          if (evaluation.status === 'exclude') {
            decorations.push(
              Decoration.node(pos, pos + node.nodeSize, {
                class: 'is-conditioned-out',
                'data-condition': 'excluded',
              }),
            );
          } else if (evaluation.status === 'flag') {
            const style = evaluation.effectiveStyle;
            const css = [
              style?.color ? `color:${style.color}` : '',
              style?.backcolor ? `background-color:${style.backcolor}` : '',
            ]
              .filter(Boolean)
              .join(';');
            decorations.push(
              Decoration.node(pos, pos + node.nodeSize, {
                class: 'is-flagged',
                'data-condition': 'flagged',
                style: css || 'background-color:#FEF3C7',
              }),
            );
          }
        });
        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
}

/**
 * Empty `keyref` elements (`<keyword keyref="edition"/>`) carry no text, so the visual pane would show a
 * gap. This decorates each one with a read-only chip showing the value the keyspace resolves to.
 */
function buildKeyrefPlugin(keyValues: { current: Record<string, string> }): Plugin {
  return new Plugin({
    key: keyrefsKey,
    props: {
      decorations(state) {
        const decorations: Decoration[] = [];
        state.doc.descendants((node, pos) => {
          if (!node.isInline || node.content.size > 0) return;
          const keyref = getPmNodeRawAttrs(node).find((entry) => entry.name === 'keyref');
          if (!keyref?.value) return;
          const resolved = keyValues.current[keyref.value];
          decorations.push(
            Decoration.widget(
              pos + node.nodeSize,
              () => {
                const chip = document.createElement('span');
                chip.className = resolved ? 'pg-keyref' : 'pg-keyref is-unresolved';
                chip.dataset.key = keyref.value;
                chip.textContent = resolved ?? `?${keyref.value}`;
                chip.title = resolved
                  ? `keyref="${keyref.value}" → ${resolved}`
                  : `keyref="${keyref.value}" unresolved`;
                chip.contentEditable = 'false';
                return chip;
              },
              { side: 1, key: `keyref-${pos}-${keyref.value}` },
            ),
          );
        });
        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
}

function textNode(schema: Schema, text: string) {
  return schema.text(text);
}

/** Build the smallest legal node for an "insert" action, then let ProseMirror place it. */
function buildInsertNode(schema: Schema, kind: InsertKind, label: string) {
  const paragraph = () => schema.nodes['dita_p']!.create(null, textNode(schema, label));
  switch (kind) {
    case 'note':
      return schema.nodes['dita_note']!.create(null, paragraph());
    case 'ul':
      return schema.nodes['dita_ul']!.create(
        null,
        schema.nodes['dita_li']!.create(null, paragraph()),
      );
    case 'codeblock':
      return schema.nodes['dita_codeblock']!.create(null, textNode(schema, label));
    case 'step':
      return schema.nodes['dita_step']!.create(
        null,
        schema.nodes['dita_cmd']!.create(null, textNode(schema, label)),
      );
    case 'p':
    default:
      return paragraph();
  }
}

export default function SandboxVisualEditor({
  value,
  keyValues,
  ditaval,
  display,
  readOnly = false,
  insertRequest,
  insertText,
  onChange,
  onConversionError,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lastEmittedRef = useRef<string | null>(null);
  const suppressRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const onErrorRef = useRef(onConversionError);
  const keyValuesRef = useRef(keyValues);
  keyValuesRef.current = keyValues;
  onChangeRef.current = onChange;
  onErrorRef.current = onConversionError;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let initialDoc;
    try {
      initialDoc = xmlToPmDoc(value).pmDoc;
      lastEmittedRef.current = value;
      onErrorRef.current(null);
    } catch (error) {
      initialDoc = xmlToPmDoc(FALLBACK_XML).pmDoc;
      onErrorRef.current(error instanceof Error ? error.message : 'XML could not be mapped');
    }

    const view = new EditorView(host, {
      state: EditorState.create({
        doc: initialDoc,
        plugins: [
          buildConditionPlugin(),
          buildKeyrefPlugin(keyValuesRef),
          history(),
          keymap({ 'Mod-z': undo, 'Mod-y': redo, 'Shift-Mod-z': redo }),
          keymap(baseKeymap),
          dropCursor(),
          gapCursor(),
        ],
      }),
      editable: () => !readOnly,
      attributes: {
        class: 'sandbox-visual',
        spellcheck: 'false',
        'aria-label': 'DITA visual sandbox',
      },
      dispatchTransaction(transaction) {
        const nextState = view.state.apply(transaction);
        view.updateState(nextState);
        if (!transaction.docChanged || suppressRef.current) return;
        try {
          const xml = pmDocToXml(nextState.doc);
          lastEmittedRef.current = xml;
          onErrorRef.current(null);
          onChangeRef.current(xml);
        } catch (error) {
          onErrorRef.current(error instanceof Error ? error.message : 'Serialization failed');
        }
      },
    });

    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // The editor is created once; subsequent `value` changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  // Re-hydrate the document when the XML changed from the source editor or a preset switch.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (value === lastEmittedRef.current) return;
    try {
      const { pmDoc } = xmlToPmDoc(value);
      const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, pmDoc.content);
      suppressRef.current = true;
      view.dispatch(tr.setMeta('addToHistory', false));
      suppressRef.current = false;
      lastEmittedRef.current = value;
      onErrorRef.current(null);
    } catch (error) {
      onErrorRef.current(error instanceof Error ? error.message : 'XML could not be mapped');
    }
  }, [value]);

  // Push the active DITAVAL profile into the decoration plugin.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const tr = view.state.tr.setMeta(conditionsKey, ditaval);
    view.dispatch(tr);
  }, [ditaval]);

  // Recompute keyref chips when the preset (and therefore the keyspace) changes.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch(view.state.tr.setMeta('addToHistory', false));
  }, [keyValues]);

  // Insert-menu requests coming from the rail.
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !insertRequest) return;
    const { state } = view;
    const type = buildInsertNode(ditaSchema, insertRequest.kind, insertText[insertRequest.kind]);
    const { $from } = state.selection;

    let target = -1;
    for (let depth = $from.depth; depth >= 1; depth -= 1) {
      const parent = $from.node(depth);
      const index = $from.index(depth);
      if (parent.canReplaceWith(index, index, type.type)) {
        target = $from.before(depth) + 1;
        for (let offset = 0; offset < index; offset += 1) {
          const child = parent.child(offset);
          target += child.nodeSize;
        }
        break;
      }
    }
    const insertAt = target >= 0 ? target : state.doc.content.size - 1;
    const tr = state.tr.insert(insertAt, type);
    tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(insertAt + 1, tr.doc.content.size))));
    view.dispatch(tr);
    view.focus();
  }, [insertRequest, insertText]);

  return (
    <div
      className="pg-visual-host"
      data-display={display}
      ref={hostRef}
    />
  );
}
