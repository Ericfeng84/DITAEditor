/**
 * Single-segment WYSIWYG editor.
 *
 * Reviewing a translation is a *sentence* task, so only the active block gets a real editor; every
 * other block stays clean read-only typography. The editor wraps the block's inner XML in a `<p>`,
 * mounts one `@dita/core` ProseMirror document (so `<b>`, `<codeph>`, `<xref href>` and
 * `<keyword keyref>` keep their attributes), and serializes back to inner XML on every change —
 * the reviewer never sees or retypes a `<p>` wrapper.
 *
 * Enter is swallowed: a review segment is exactly one block, so splitting it would create a second
 * `<p>` that no longer belongs to the segment. Attribute segments (`@navtitle`), protected blocks
 * and temporarily malformed XML fall back to a raw `<textarea>` for the same reason.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { baseKeymap } from 'prosemirror-commands';
import { history } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { Fragment, Slice, type Node as PMNode } from 'prosemirror-model';
import { EditorState } from 'prosemirror-state';
import { EditorView, type NodeView } from 'prosemirror-view';
import { ditaSchema, getPmNodeRawAttrs, getRawAttr, pmDocToXml, xmlToPmDoc } from '@dita/core';
import type { MessageKey, MessageParams } from '../../i18n/index.js';
import type { TranslationSegmentReviewView } from '../../services/translation-api.js';
import {
  appendInlineSnippet,
  extractInnerXml,
  isWellFormedFragment,
  splitOuterElement,
  type MissingInlineTag,
} from './segment-xml-utils.js';

export interface SegmentInsertRequest {
  segmentId: string;
  text: string;
  /** Monotonic token so two identical insertions both fire. */
  nonce: number;
}

/** One-click repair requested from outside the editor (the inline QA strip). */
export interface SegmentTagInsertRequest {
  segmentId: string;
  snippet: string;
  label: string;
  /** Monotonic token so two identical insertions both fire. */
  nonce: number;
}

export interface RichInlineSegmentEditorProps {
  segment: TranslationSegmentReviewView;
  /** Current draft inner XML (or bare attribute text). */
  value: string;
  onChange: (nextInnerXml: string) => void;
  showTags: boolean;
  missingTags: MissingInlineTag[];
  t: (key: MessageKey, params?: MessageParams) => string;
  insertRequest?: SegmentInsertRequest | null;
  /** A QA-strip repair: splice this snippet at the caret (visual) or append it (raw). */
  insertTagRequest?: SegmentTagInsertRequest | null;
  /** Called after a missing-tag chip was inserted (used for the inline status line). */
  onInsertedTag?: (label: string) => void;
  onFocusChange?: (focused: boolean) => void;
  /** Start in raw XML mode (used by the `</>` row action). */
  initialRaw?: boolean;
  /** Bumping this token switches a mounted editor to raw XML (the QA "switch to XML" repair). */
  forceXmlRequest?: number;
  /**
   * Render the missing-tag chips inside the editor. Off when an outer QA strip already offers
   * the same one-click repairs, so the reviewer never sees the same list twice.
   */
  showMissingTags?: boolean;
}

type EditorMode = 'visual' | 'xml';

/* ------------------------------------------------------------------ */
/* Inline chips inside ProseMirror                                     */
/* ------------------------------------------------------------------ */

class InlineRefChipView implements NodeView {
  dom: HTMLElement;

  contentDOM?: HTMLElement;

  private readonly nodeName: string;

  constructor(node: PMNode) {
    this.nodeName = node.type.name;
    const isKeyword = this.nodeName === 'dita_keyword';
    const dom = document.createElement('span');
    dom.className = isKeyword ? 'dita-nv-keyword' : 'dita-nv-xref';
    dom.dataset.ditaTag = isKeyword ? 'keyword' : 'xref';
    // `@dita/core` stores DITA attributes in `rawAttrs`, not in `node.attrs.keyref`/`href`:
    // reading `node.attrs` directly left `<keyword keyref="prod_name"/>` an invisible empty span.
    const rawAttrs = getPmNodeRawAttrs(node);
    const keyref = getRawAttr(rawAttrs, 'keyref')?.trim() ?? '';
    const href = getRawAttr(rawAttrs, 'href')?.trim() ?? '';
    const ref = keyref || href;
    dom.title = isKeyword ? `<keyword keyref="${ref}"/>` : `<xref href="${ref}">…</xref>`;
    if (ref) {
      const badge = document.createElement('span');
      badge.className = 'dita-nv-ref-badge';
      badge.textContent = isKeyword ? `key:${ref}` : ref;
      // The chip is a label, never editable text: ProseMirror must keep it intact.
      badge.setAttribute('contenteditable', 'false');
      dom.appendChild(badge);
    }
    if (node.content.size > 0) {
      const content = document.createElement('span');
      content.className = 'review-chip-content';
      dom.appendChild(content);
      this.contentDOM = content;
    }
    this.dom = dom;
  }

  update(node: PMNode): boolean {
    return node.type.name === this.nodeName;
  }
}

/* ------------------------------------------------------------------ */

function inlineSliceFromXml(snippet: string): Slice | null {
  try {
    const { pmDoc } = xmlToPmDoc(`<p>${snippet}</p>`, { position: false });
    const first = pmDoc.firstChild;
    if (!first) return null;
    return new Slice(Fragment.from(first.content), 0, 0);
  } catch {
    return null;
  }
}

/**
 * Inner XML of the review document (never the `<p>` wrapper).
 *
 * `Enter` is swallowed, so a one-paragraph document is the normal case; pasting structured content
 * can still produce several blocks, and joining their inner XML keeps the segment single-block.
 */
function innerXmlFromDoc(doc: PMNode): string {
  const parts: string[] = [];
  doc.forEach((child) => {
    const single = doc.type.create(null, child);
    const xml = pmDocToXml(single, { includeXmlDeclaration: false, trailingNewline: false });
    parts.push(splitOuterElement(xml)?.innerXml ?? xml);
  });
  return parts.join(' ');
}

export function RichInlineSegmentEditor({
  segment,
  value,
  onChange,
  showTags,
  missingTags,
  t,
  insertRequest,
  insertTagRequest,
  onInsertedTag,
  onFocusChange,
  initialRaw = false,
  forceXmlRequest = 0,
  showMissingTags = true,
}: RichInlineSegmentEditorProps) {
  const attributeMode = Boolean(segment.attributeName);
  const readOnly = segment.protected;
  const wellFormed = isWellFormedFragment(value);
  const forceXml = attributeMode || readOnly || !wellFormed;
  const [rawChoice, setRawChoice] = useState(initialRaw);
  const mode: EditorMode = forceXml || rawChoice ? 'xml' : 'visual';

  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const composingRef = useRef(false);
  valueRef.current = value;
  onChangeRef.current = onChange;

  /* ---------------- visual mode: one-block ProseMirror editor ---------------- */
  useEffect(() => {
    if (mode !== 'visual') return;
    const host = hostRef.current;
    if (!host) return;
    let initialDoc: PMNode;
    try {
      initialDoc = xmlToPmDoc(`<p>${valueRef.current}</p>`, { position: false }).pmDoc;
    } catch {
      setRawChoice(true);
      return;
    }
    const state = EditorState.create({
      doc: initialDoc,
      plugins: [
        history(),
        keymap({
          // A review segment is one block: never split it into a second `<p>`.
          Enter: () => true,
          'Shift-Enter': () => true,
        }),
        keymap(baseKeymap),
      ],
    });
    const view = new EditorView(host, {
      state,
      nodeViews: {
        dita_keyword: (node) => new InlineRefChipView(node),
        dita_xref: (node) => new InlineRefChipView(node),
      },
      dispatchTransaction(transaction) {
        const nextState = view.state.apply(transaction);
        view.updateState(nextState);
        if (!transaction.docChanged || composingRef.current) return;
        onChangeRef.current(innerXmlFromDoc(nextState.doc));
      },
      handleDOMEvents: {
        compositionstart: () => {
          composingRef.current = true;
          return false;
        },
        compositionend: () => {
          composingRef.current = false;
          onChangeRef.current(innerXmlFromDoc(view.state.doc));
          return false;
        },
        focus: () => {
          onFocusChange?.(true);
          return false;
        },
        blur: () => {
          onFocusChange?.(false);
          return false;
        },
      },
      attributes: {
        class: 'review-segment-pm',
        'aria-label': t('translation.review.editVisual'),
        spellcheck: 'false',
      },
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Remounting happens per segment and per mode; keystrokes flow through `valueRef` instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, segment.segmentId]);

  /* ---------------- external value sync (refine apply, tag insert) ---------------- */
  useEffect(() => {
    const view = viewRef.current;
    if (!view || mode !== 'visual') return;
    if (view.hasFocus()) return;
    const current = innerXmlFromDoc(view.state.doc);
    if (current === value) return;
    try {
      const nextDoc = xmlToPmDoc(`<p>${value}</p>`, { position: false }).pmDoc;
      view.updateState(EditorState.create({ doc: nextDoc, plugins: view.state.plugins }));
    } catch {
      /* keep the last good document */
    }
  }, [value, mode]);

  /* ---------------- glossary "Insert" lands at the caret ---------------- */
  useEffect(() => {
    if (!insertRequest || insertRequest.segmentId !== segment.segmentId) return;
    const view = viewRef.current;
    if (mode === 'visual' && view) {
      const { from, to } = view.state.selection;
      view.dispatch(view.state.tr.insertText(insertRequest.text, from, to));
      view.focus();
      return;
    }
    onChangeRef.current(appendInlineSnippet(valueRef.current, insertRequest.text));
    // Only the nonce should trigger an insertion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insertRequest?.nonce, insertRequest?.segmentId, mode]);

  const setModeWithContent = (next: EditorMode) => {
    const view = viewRef.current;
    if (next === 'xml' && mode === 'visual' && view) {
      // Freeze what the reviewer sees so the raw editor starts from the same bytes.
      onChangeRef.current(innerXmlFromDoc(view.state.doc));
    }
    setRawChoice(next === 'xml');
  };

  const insertMissingTag = useCallback(
    (tag: MissingInlineTag) => {
      const view = viewRef.current;
      if (mode === 'visual' && view) {
        const slice = inlineSliceFromXml(tag.snippet);
        if (slice) {
          view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView());
          view.focus();
        } else {
          onChangeRef.current(appendInlineSnippet(valueRef.current, tag.snippet));
        }
      } else if (mode === 'xml') {
        onChangeRef.current(appendInlineSnippet(valueRef.current, tag.snippet));
      }
      onInsertedTag?.(tag.label);
    },
    [mode, onInsertedTag],
  );

  /* ---------------- QA strip: "switch to XML" repair ---------------- */
  useEffect(() => {
    if (!forceXmlRequest) return;
    setRawChoice(true);
  }, [forceXmlRequest]);

  /* ---------------- QA strip: one-click "insert missing tag" repair ---------------- */
  useEffect(() => {
    if (!insertTagRequest || insertTagRequest.segmentId !== segment.segmentId) return;
    insertMissingTag({
      tagName: '',
      keyref: null,
      href: null,
      snippet: insertTagRequest.snippet,
      label: insertTagRequest.label,
    });
    // Only the nonce should fire an insertion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [insertTagRequest?.nonce, insertTagRequest?.segmentId]);

  const showHint = mode === 'xml' && (attributeMode || readOnly || !wellFormed);
  const hintKey: MessageKey = attributeMode
    ? 'translation.review.attributeHint'
    : readOnly
      ? 'translation.review.protectedReadOnly'
      : 'translation.review.malformedHint';

  return (
    <div
      className="review-segment-editor"
      data-testid={`review-segment-editor-${segment.segmentId}`}
      data-mode={mode}
    >
      <div className="review-segment-editor__toolbar">
        {attributeMode || readOnly ? (
          <span className="review-segment-editor__mode-label">
            {mode === 'visual' ? t('translation.review.editVisual') : t('translation.review.editXml')}
          </span>
        ) : (
          <span className="review-segment-editor__mode" role="group" aria-label={t('translation.review.editMode')}>
            <button
              type="button"
              className="review-segment-editor__mode-option"
              aria-pressed={mode === 'visual'}
              onClick={() => setModeWithContent('visual')}
            >
              {t('translation.review.modeVisual')}
            </button>
            <button
              type="button"
              className="review-segment-editor__mode-option"
              data-testid={`review-xml-toggle-${segment.segmentId}`}
              aria-pressed={mode === 'xml'}
              title={t('translation.review.editXml')}
              onClick={() => setModeWithContent('xml')}
            >
              {t('translation.review.modeXml')}
            </button>
          </span>
        )}
        {readOnly ? (
          <span className="review-segment-editor__badge review-segment-editor__badge--muted">
            {t('translation.review.protectedReadOnly')}
          </span>
        ) : missingTags.length > 0 ? (
          <span className="review-segment-editor__badge">
            {t('translation.review.missingTagBadge', { count: missingTags.length })}
          </span>
        ) : null}
      </div>

      {showHint ? <p className="review-segment-editor__hint">{t(hintKey)}</p> : null}

      {mode === 'visual' ? (
        <div ref={hostRef} className="review-segment-editor__host" data-show-tags={showTags} />
      ) : (
        <textarea
          className="review-segment-editor__raw"
          data-testid={`review-segment-xml-${segment.segmentId}`}
          aria-label={t('translation.review.editXml')}
          value={value}
          readOnly={readOnly}
          spellCheck={false}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
      )}

      {missingTags.length > 0 && !readOnly && showMissingTags ? (
        <div className="review-missing-tags" data-testid={`review-missing-tags-${segment.segmentId}`}>
          <p className="review-missing-tags__label">
            {t('translation.review.missingTags', {
              tags: missingTags.map((tag) => tag.label).join(' '),
            })}
          </p>
          <div className="review-missing-tags__chips">
            {missingTags.map((tag, index) => (
              <button
                type="button"
                key={`${tag.snippet}-${index}`}
                className="review-chip review-chip--insert"
                data-testid={`review-insert-tag-${segment.segmentId}-${index}`}
                title={tag.snippet}
                onClick={() => insertMissingTag(tag)}
              >
                <span aria-hidden="true">+</span>
                {tag.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Re-exported for tests that need to build the same raw payload the editor produces. */
export const __reviewEditorInternals = { inlineSliceFromXml, innerXmlFromDoc, extractInnerXml };
