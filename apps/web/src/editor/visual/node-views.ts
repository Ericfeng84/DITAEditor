import type { Node as PMNode } from 'prosemirror-model';
import type { EditorView, NodeView, NodeViewConstructor } from 'prosemirror-view';
import {
  getPmNodeRawAttrs,
  getRawAttr,
  pmHasMultipleTgroups,
  type DocumentSemanticOverlay,
} from '@dita/core';
import { updateNodeRawAttr } from './commands';
import { isPrologCollapsed, setPrologCollapsed } from './prolog-collapse.js';
import { getCurrentLocale, translate } from '../../i18n/index.js';

export class SemanticViewRegistry {
  private readonly listeners = new Set<() => void>();

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  notifyAll(): void {
    for (const fn of this.listeners) {
      fn();
    }
  }
}

const NOTE_TYPE_LABELS: Record<string, string> = {
  note: 'NOTE',
  tip: 'TIP',
  important: 'IMPORTANT',
  remember: 'REMEMBER',
  attention: 'ATTENTION',
  caution: 'CAUTION',
  notice: 'NOTICE',
  warning: 'WARNING',
  danger: 'DANGER',
  restriction: 'RESTRICTION',
  fastpath: 'FASTPATH',
  trouble: 'TROUBLE',
  other: 'OTHER',
};

const NOTE_TYPES = [
  'note',
  'tip',
  'important',
  'remember',
  'attention',
  'caution',
  'notice',
  'warning',
  'danger',
  'restriction',
  'other',
] as const;

/**
 * Custom NodeView for `<note>`: renders semantic admonition badge + quick type selector.
 */
class DitaNoteNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private selectEl: HTMLSelectElement;
  private node: PMNode;
  private readonly isReadOnly?: () => boolean;
  private readonly unsubscribe?: () => void;

  constructor(
    node: PMNode,
    view: EditorView,
    getPos: () => number | undefined,
    options: { isReadOnly?: () => boolean; semanticRegistry?: SemanticViewRegistry } = {},
  ) {
    this.node = node;
    this.isReadOnly = options.isReadOnly;
    const rawAttrs = getPmNodeRawAttrs(node);
    const noteType = getRawAttr(rawAttrs, 'type') ?? 'note';

    this.dom = document.createElement('aside');
    this.dom.className = 'dita-nv-note';
    this.dom.dataset.ditaTag = 'note';
    this.dom.dataset.noteType = noteType;

    const header = document.createElement('div');
    header.className = 'dita-nv-note-header';
    header.contentEditable = 'false';

    const dot = document.createElement('span');
    dot.className = 'dita-nv-note-dot';
    header.appendChild(dot);

    this.selectEl = document.createElement('select');
    this.selectEl.className = 'dita-nv-note-select';
    this.selectEl.setAttribute('aria-label', 'Note type');
    for (const t of NOTE_TYPES) {
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = NOTE_TYPE_LABELS[t] ?? t.toUpperCase();
      this.selectEl.appendChild(opt);
    }
    this.selectEl.value = NOTE_TYPES.includes(noteType as (typeof NOTE_TYPES)[number])
      ? noteType
      : 'note';

    this.selectEl.addEventListener('change', (ev) => {
      ev.stopPropagation();
      // Never mutate the XML of a read-only / not-checked-out document.
      if (this.isReadOnly?.()) {
        this.syncDisabled();
        return;
      }
      const pos = getPos();
      if (pos === undefined) return;
      updateNodeRawAttr(pos, 'type', this.selectEl.value)(view.state, view.dispatch);
      view.focus();
    });
    header.appendChild(this.selectEl);

    const tagHint = document.createElement('span');
    tagHint.className = 'dita-nv-tag-chip';
    tagHint.textContent = `<note type="${noteType}">`;
    header.appendChild(tagHint);

    this.contentDOM = document.createElement('div');
    this.contentDOM.className = 'dita-nv-note-body';

    this.dom.appendChild(header);
    this.dom.appendChild(this.contentDOM);

    this.syncDisabled();
    // Check-out state changes outside ProseMirror (lock refresh), so the host pings the registry
    // instead of recreating the view.
    this.unsubscribe = options.semanticRegistry?.subscribe(() => {
      this.syncDisabled();
    });
  }

  /** The note-type selector is an editing affordance: disable it for read-only documents. */
  private syncDisabled(): void {
    this.selectEl.disabled = Boolean(this.isReadOnly?.());
  }

  destroy(): void {
    this.unsubscribe?.();
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    const noteType = getRawAttr(getPmNodeRawAttrs(node), 'type') ?? 'note';
    this.dom.dataset.noteType = noteType;
    this.selectEl.value = NOTE_TYPES.includes(noteType as (typeof NOTE_TYPES)[number])
      ? noteType
      : 'note';
    this.syncDisabled();
    const chip = this.dom.querySelector('.dita-nv-tag-chip');
    if (chip) chip.textContent = `<note type="${noteType}">`;
    return true;
  }

  stopEvent(event: Event): boolean {
    return event.target === this.selectEl;
  }
}

/**
 * Custom NodeView for `<codeblock>` and `<pre>`: renders language header bar while keeping `<pre>` verbatim.
 */
class DitaCodeblockNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private langBadge: HTMLElement;
  private node: PMNode;
  private tagName: string;

  constructor(node: PMNode, tagName: 'codeblock' | 'pre') {
    this.node = node;
    this.tagName = tagName;

    this.dom = document.createElement('div');
    this.dom.className = 'dita-nv-code-card';
    this.dom.dataset.ditaTag = tagName;

    const bar = document.createElement('div');
    bar.className = 'dita-nv-code-bar';
    bar.contentEditable = 'false';

    const tagLabel = document.createElement('span');
    tagLabel.className = 'dita-nv-code-tag';
    tagLabel.textContent = `<${tagName}>`;
    bar.appendChild(tagLabel);

    this.langBadge = document.createElement('span');
    this.langBadge.className = 'dita-nv-code-lang';
    this.syncLangBadge(node);
    bar.appendChild(this.langBadge);

    const wsBadge = document.createElement('span');
    wsBadge.className = 'dita-nv-code-ws';
    wsBadge.textContent = 'xml:space="preserve"';
    bar.appendChild(wsBadge);

    this.contentDOM = document.createElement('pre');
    this.contentDOM.className = 'dita-nv-code-pre';

    this.dom.appendChild(bar);
    this.dom.appendChild(this.contentDOM);
  }

  private syncLangBadge(node: PMNode) {
    const outclass = getRawAttr(getPmNodeRawAttrs(node), 'outputclass');
    this.langBadge.textContent = outclass ? outclass.replace(/^language-/, '') : 'plain';
    this.dom.dataset.ditaTag = this.tagName;
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.syncLangBadge(node);
    return true;
  }
}

/**
 * Custom NodeView for `<prolog>`: collapsible metadata drawer so metadata stays accessible and
 * editable without dominating the editorial reading flow. Collapsed by default; the expanded
 * state is kept in plugin state (see `prolog-collapse.ts`) so decoration-driven redraws cannot
 * silently re-collapse the drawer.
 */
class DitaPrologNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private header: HTMLElement;
  private caretEl: HTMLElement;
  private labelEl: HTMLElement;
  private hintEl: HTMLElement;
  private collapsed = true;
  private node: PMNode;
  private view: EditorView;
  private getPos: () => number | undefined;

  constructor(node: PMNode, view: EditorView, getPos: () => number | undefined) {
    this.node = node;
    this.view = view;
    this.getPos = getPos;
    this.dom = document.createElement('aside');
    this.dom.className = 'dita-nv-prolog';
    this.dom.dataset.ditaTag = 'prolog';

    this.header = document.createElement('div');
    this.header.className = 'dita-nv-prolog-header';
    this.header.contentEditable = 'false';
    this.header.setAttribute('role', 'button');
    this.header.tabIndex = 0;

    this.caretEl = document.createElement('span');
    this.caretEl.className = 'dita-nv-prolog-caret';
    this.caretEl.setAttribute('aria-hidden', 'true');

    this.labelEl = document.createElement('span');
    this.labelEl.className = 'dita-nv-prolog-label';

    this.hintEl = document.createElement('span');
    this.hintEl.className = 'dita-nv-prolog-hint';
    this.hintEl.textContent = translate(getCurrentLocale(), 'nodeView.prologHint');

    this.header.append(this.caretEl, this.labelEl, this.hintEl);
    this.header.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      this.toggle();
    });
    this.header.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ' && ev.key !== 'Spacebar') return;
      ev.preventDefault();
      ev.stopPropagation();
      this.toggle();
    });

    this.contentDOM = document.createElement('div');
    this.contentDOM.className = 'dita-nv-prolog-body';

    this.dom.appendChild(this.header);
    this.dom.appendChild(this.contentDOM);
    this.syncState(this.readCollapsed());
  }

  private currentPos(): number | undefined {
    try {
      return this.getPos();
    } catch {
      return undefined;
    }
  }

  private readCollapsed(): boolean {
    const pos = this.currentPos();
    if (typeof pos !== 'number') return this.collapsed;
    return isPrologCollapsed(this.view.state, pos);
  }

  private toggle(): void {
    const next = !this.collapsed;
    this.syncState(next);
    const pos = this.currentPos();
    if (typeof pos === 'number') setPrologCollapsed(this.view, pos, next);
  }

  private syncState(collapsed: boolean): void {
    this.collapsed = collapsed;
    this.dom.dataset.collapsed = String(collapsed);
    this.header.setAttribute('aria-expanded', String(!collapsed));
    this.caretEl.textContent = collapsed ? '▸' : '▾';
    const count = this.node.childCount;
    this.labelEl.textContent = translate(getCurrentLocale(), 'nodeView.prologToggle', { count });
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.syncState(this.readCollapsed());
    return true;
  }

  stopEvent(event: Event): boolean {
    return event.target instanceof Node && this.header.contains(event.target);
  }
}

/**
 * Custom NodeView for `<image>` (both block and inline): displays resolved preview or crisp placeholder card
 * showing `href` / `keyref` / `alt`.
 */
class DitaImageNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private previewEl: HTMLElement;
  private node: PMNode;
  private isBlock: boolean;
  private resolveImageSrc?: (href: string) => string | null;
  private getSemanticOverlay?: () => DocumentSemanticOverlay | null;
  private unsubscribe?: () => void;

  constructor(
    node: PMNode,
    isBlock: boolean,
    resolveImageSrc?: (href: string) => string | null,
    getSemanticOverlay?: () => DocumentSemanticOverlay | null,
    registry?: SemanticViewRegistry,
  ) {
    this.node = node;
    this.isBlock = isBlock;
    this.resolveImageSrc = resolveImageSrc;
    this.getSemanticOverlay = getSemanticOverlay;

    this.dom = document.createElement(isBlock ? 'figure' : 'span');
    this.dom.className = isBlock ? 'dita-nv-image-block' : 'dita-nv-image-inline';
    this.dom.dataset.ditaTag = 'image';

    this.previewEl = document.createElement('span');
    this.previewEl.className = 'dita-nv-image-preview';
    this.previewEl.contentEditable = 'false';

    this.contentDOM = document.createElement('span');
    this.contentDOM.className = 'dita-nv-image-alt-slot';

    this.dom.appendChild(this.previewEl);
    this.dom.appendChild(this.contentDOM);
    this.renderPreview(node);
    this.unsubscribe = registry?.subscribe(() => this.renderPreview(this.node));
  }

  private renderPreview(node: PMNode) {
    const attrs = getPmNodeRawAttrs(node);
    const href = getRawAttr(attrs, 'href') ?? '';
    const keyref = getRawAttr(attrs, 'keyref') ?? '';
    const alt = getRawAttr(attrs, 'alt') ?? '';

    const keyResolvedPath =
      !href && keyref ? this.getSemanticOverlay?.()?.keyrefs[keyref]?.targetFilePath : undefined;
    const effectiveHref = href || keyResolvedPath || '';
    const target =
      href ||
      (keyref
        ? `keyref:${keyref}${keyResolvedPath ? ` → ${keyResolvedPath}` : ''}`
        : translate(getCurrentLocale(), 'nodeView.noHref'));

    this.previewEl.textContent = '';

    const isDirectUrl =
      effectiveHref.startsWith('http://') ||
      effectiveHref.startsWith('https://') ||
      effectiveHref.startsWith('data:image/') ||
      effectiveHref.startsWith('/');

    const resolvedSrc = effectiveHref
      ? (this.resolveImageSrc?.(effectiveHref) ?? (isDirectUrl ? effectiveHref : null))
      : null;

    const chip = document.createElement('span');
    chip.className = 'dita-nv-image-meta';
    chip.textContent = `IMG · ${target}${alt ? ` — "${alt}"` : ''}`;

    if (resolvedSrc) {
      const img = document.createElement('img');
      img.src = resolvedSrc;
      img.alt = alt || target;
      img.className = this.isBlock ? 'dita-nv-image-img' : 'dita-nv-image-inline-img';
      img.onerror = () => {
        img.remove();
        chip.textContent = `${translate(getCurrentLocale(), 'nodeView.imageMissing')} · ${target}${alt ? ` — "${alt}"` : ''}`;
      };
      this.previewEl.appendChild(img);
    }

    this.previewEl.appendChild(chip);
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.renderPreview(node);
    return true;
  }

  destroy(): void {
    this.unsubscribe?.();
  }
}

/**
 * Custom NodeView for `<keyword>`, `<xref>`, `<ph>`, and `<term>`:
 * - Resolves live `keyref` values from Root Map Keyspace with dashed underline & jump-to-definition
 * - Flags unresolved `keyref`s cleanly in red
 * - Leaves ordinary `<ph>` / `<term>` without `keyref` completely unobtrusive
 */
class DitaRefInlineNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private badge: HTMLElement;
  private jumpBtn: HTMLButtonElement;
  private node: PMNode;
  private tagName: 'keyword' | 'xref' | 'ph' | 'term';
  private getSemanticOverlay?: () => DocumentSemanticOverlay | null;
  private onJumpToSource?: (filePath: string, line?: number, elementId?: string) => void;
  private unsubscribe?: () => void;
  private jumpTarget: { filePath: string; line?: number; elementId?: string } | null = null;

  constructor(
    node: PMNode,
    tagName: 'keyword' | 'xref' | 'ph' | 'term',
    options: CreateDitaNodeViewsOptions,
  ) {
    this.node = node;
    this.tagName = tagName;
    this.getSemanticOverlay = options.getSemanticOverlay;
    this.onJumpToSource = options.onJumpToSource;

    this.dom = document.createElement('span');
    this.dom.className =
      tagName === 'xref'
        ? 'dita-nv-xref'
        : tagName === 'keyword'
          ? 'dita-nv-keyword'
          : `dita-nv-inline-ref dita-nv-${tagName}`;
    this.dom.dataset.ditaTag = tagName;

    this.badge = document.createElement('span');
    this.badge.className = 'dita-nv-ref-badge';
    this.badge.contentEditable = 'false';

    this.contentDOM = document.createElement('span');
    this.contentDOM.className = 'dita-nv-ref-content';

    this.jumpBtn = document.createElement('button');
    this.jumpBtn.type = 'button';
    this.jumpBtn.className = 'dita-nv-ref-jump';
    this.jumpBtn.contentEditable = 'false';
    this.jumpBtn.textContent = '↗';
    this.jumpBtn.hidden = true;
    this.jumpBtn.addEventListener('mousedown', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
    });
    this.jumpBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (this.jumpTarget) {
        this.onJumpToSource?.(
          this.jumpTarget.filePath,
          this.jumpTarget.line,
          this.jumpTarget.elementId,
        );
      }
    });

    this.dom.appendChild(this.badge);
    this.dom.appendChild(this.contentDOM);
    this.dom.appendChild(this.jumpBtn);
    this.syncBadge(node);
    this.unsubscribe = options.semanticRegistry?.subscribe(() => this.syncBadge(this.node));
  }

  private syncBadge(node: PMNode) {
    const attrs = getPmNodeRawAttrs(node);
    const keyref = getRawAttr(attrs, 'keyref')?.trim() ?? '';
    const href = getRawAttr(attrs, 'href')?.trim() ?? '';
    const isEmpty = node.content.size === 0;

    this.dom.dataset.empty = String(isEmpty);
    this.dom.removeAttribute('data-keyref-status');
    this.jumpTarget = null;
    this.jumpBtn.hidden = true;

    const overlay = this.getSemanticOverlay?.() ?? null;
    const resolvedKey = keyref ? overlay?.keyrefs[keyref] : undefined;

    if (keyref) {
      if (resolvedKey?.status === 'resolved' && resolvedKey.definition) {
        this.dom.dataset.keyrefStatus = 'resolved';
        const displayVal =
          resolvedKey.resolvedText ??
          resolvedKey.targetFilePath ??
          resolvedKey.definition.href ??
          keyref;
        const sourceHint = `${resolvedKey.definition.sourceMapPath}:${resolvedKey.definition.line}`;

        this.badge.textContent = isEmpty ? displayVal : `key:${keyref}`;
        this.badge.title = translate(getCurrentLocale(), 'nodeView.keyBadgeTitle', {
          key: keyref,
          value: displayVal,
          source: sourceHint,
        });
        this.badge.hidden = false;

        if (this.tagName === 'xref' && resolvedKey.targetFilePath) {
          const fragParts = resolvedKey.targetFragment?.split('/');
          this.jumpTarget = {
            filePath: resolvedKey.targetFilePath,
            elementId: fragParts && fragParts.length > 1 ? fragParts[1] : fragParts?.[0],
          };
          this.jumpBtn.title = translate(getCurrentLocale(), 'nodeView.openTargetFile', {
            path: resolvedKey.targetFilePath,
          });
        } else {
          this.jumpTarget = {
            filePath: resolvedKey.definition.sourceMapPath,
            line: resolvedKey.definition.line,
          };
          this.jumpBtn.title = translate(getCurrentLocale(), 'nodeView.jumpToKeyDef', { source: sourceHint });
        }
        this.jumpBtn.hidden = !this.onJumpToSource;
      } else if (overlay && resolvedKey?.status === 'unresolved') {
        this.dom.dataset.keyrefStatus = 'unresolved';
        this.badge.textContent = `⚠ key:${keyref}`;
        this.badge.title = resolvedKey.errorMessage ?? translate(getCurrentLocale(), 'nodeView.undefinedKeyref', { key: keyref });
        this.badge.hidden = false;
      } else {
        this.badge.textContent = `key:${keyref}`;
        this.badge.title = `keyref="${keyref}"`;
        this.badge.hidden = false;
      }
      return;
    }

    if (this.tagName === 'keyword') {
      if (isEmpty) {
        this.badge.textContent = '<keyword/>';
        this.badge.hidden = false;
      } else {
        this.badge.hidden = true;
      }
      return;
    }

    if (this.tagName === 'xref') {
      this.badge.textContent = href ? `↗ ${isEmpty ? href : ''}`.trim() : '↗';
      this.badge.title = href || 'Cross-reference (set href in Inspector)';
      this.badge.hidden = false;
      return;
    }

    // Plain <ph> / <term> without keyref
    this.badge.hidden = true;
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.syncBadge(node);
    return true;
  }

  stopEvent(event: Event): boolean {
    return event.target === this.jumpBtn;
  }

  destroy(): void {
    this.unsubscribe?.();
  }
}

/**
 * Custom NodeView for CALS `<table>`: displays a safety notice when multiple `<tgroup>` exist
 * so authors know why structural edits are guarded.
 */
class CalsTableNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private warningBanner: HTMLElement;
  private node: PMNode;

  constructor(node: PMNode) {
    this.node = node;
    this.dom = document.createElement('div');
    this.dom.className = 'dita-nv-cals-table';
    this.dom.dataset.ditaTag = 'table';

    this.warningBanner = document.createElement('div');
    this.warningBanner.className = 'dita-nv-cals-multigroup-warn';
    this.warningBanner.contentEditable = 'false';
    this.warningBanner.textContent =
      translate(getCurrentLocale(), 'nodeView.multiTgroupWarning');

    this.contentDOM = document.createElement('div');
    this.contentDOM.className = 'dita-nv-cals-content';

    this.dom.appendChild(this.warningBanner);
    this.dom.appendChild(this.contentDOM);
    this.sync(node);
  }

  private sync(node: PMNode) {
    const multi = pmHasMultipleTgroups(node);
    this.warningBanner.hidden = !multi;
    this.dom.dataset.multiTgroup = String(multi);
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.sync(node);
    return true;
  }
}

/**
 * Custom NodeView for `<colspec>` inside CALS `<tgroup>`: renders clean invisible `<col>`
 * so `<colspec>` survives lossless round-trip without cluttering the rendered HTML table.
 */
class CalsColspecNodeView implements NodeView {
  dom: HTMLElement;
  private node: PMNode;

  constructor(node: PMNode) {
    this.node = node;
    this.dom = document.createElement('col');
    this.dom.dataset.ditaTag = 'colspec';
    this.sync(node);
  }

  private sync(node: PMNode) {
    const raw = getPmNodeRawAttrs(node);
    const colname = getRawAttr(raw, 'colname') ?? String(node.attrs.colname ?? '');
    const colwidth = getRawAttr(raw, 'colwidth') ?? (node.attrs.colwidth as string | null) ?? '';
    this.dom.dataset.colname = colname;
    if (colwidth && /^\d+(\.\d+)?(px|%|pt|em|rem)$/.test(colwidth.trim())) {
      this.dom.style.width = colwidth.trim();
    } else {
      this.dom.style.width = '';
    }
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.sync(node);
    return true;
  }
}

/**
 * Custom NodeView for Passthrough Unknown / Specialized DITA Elements
 * (`unknown_block`, `unknown_pre_block`, `unknown_inline`, `unknown_inline_block`).
 */
class UnknownPassthroughNodeView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private badgeEl: HTMLElement;
  private node: PMNode;
  private variant: 'block' | 'pre' | 'inline' | 'inline-block';

  constructor(node: PMNode, variant: 'block' | 'pre' | 'inline' | 'inline-block') {
    this.node = node;
    this.variant = variant;

    const isInline = variant === 'inline' || variant === 'inline-block';
    this.dom = document.createElement(isInline ? 'span' : 'div');
    this.dom.className = `dita-nv-unknown dita-nv-unknown-${variant}`;
    this.dom.dataset.ditaUnknown = variant;

    this.badgeEl = document.createElement('span');
    this.badgeEl.className = 'dita-nv-unknown-badge';
    this.badgeEl.contentEditable = 'false';

    this.contentDOM = document.createElement(
      variant === 'pre' ? 'pre' : isInline ? 'span' : 'div',
    );
    this.contentDOM.className = 'dita-nv-unknown-content';

    this.dom.appendChild(this.badgeEl);
    this.dom.appendChild(this.contentDOM);
    this.sync(node);
  }

  private sync(node: PMNode) {
    const tagName = String(node.attrs.tagName ?? 'unknown');
    const attrs = getPmNodeRawAttrs(node);
    const previewAttr = attrs
      .slice(0, 2)
      .map((a) => `${a.name}="${a.value}"`)
      .join(' ');
    this.dom.dataset.ditaTag = tagName;
    this.dom.dataset.empty = String(node.content.size === 0);
    this.badgeEl.textContent =
      this.variant === 'inline' || this.variant === 'inline-block'
        ? `<${tagName}${node.content.size === 0 ? '/' : ''}>`
        : previewAttr
          ? `<${tagName} ${previewAttr}>`
          : `<${tagName}>`;
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.sync(node);
    return true;
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function createCommentChevronTag(direction: 'open' | 'close'): HTMLElement {
  const wrap = document.createElement('span');
  wrap.className = `dita-ox-tag dita-ox-${direction} dita-ox-inline dita-ox-comment-tag`;
  wrap.contentEditable = 'false';

  const body = document.createElement('span');
  body.className = 'dita-ox-body';
  const name = document.createElement('span');
  name.className = 'dita-ox-name';
  name.textContent = '#comment';
  body.appendChild(name);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', `dita-ox-cap dita-ox-cap-${direction}`);
  svg.setAttribute('viewBox', '0 0 7 18');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');

  const poly = document.createElementNS(SVG_NS, 'polygon');
  poly.setAttribute('class', 'dita-ox-cap-fill');
  poly.setAttribute('points', direction === 'open' ? '0,0 6.5,9 0,18' : '7,0 0.5,9 7,18');
  svg.appendChild(poly);

  const line = document.createElementNS(SVG_NS, 'polyline');
  line.setAttribute('class', 'dita-ox-cap-stroke');
  line.setAttribute(
    'points',
    direction === 'open' ? '0,0.6 6.3,9 0,17.4' : '7,0.6 0.7,9 7,17.4',
  );
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke-width', '1.1');
  line.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.appendChild(line);

  if (direction === 'open') {
    wrap.appendChild(body);
    wrap.appendChild(svg);
  } else {
    wrap.appendChild(svg);
    wrap.appendChild(body);
  }
  return wrap;
}

/**
 * Custom NodeView for XML comments (`<!-- ... -->`) rendering Oxygen-style
 * `[#comment▸] text [◂#comment]` when tag pills are visible and subtle comment bar otherwise.
 */
class XmlCommentNodeView implements NodeView {
  dom: HTMLElement;
  private textEl: HTMLElement;
  private node: PMNode;

  constructor(node: PMNode, isInline: boolean) {
    this.node = node;
    this.dom = document.createElement(isInline ? 'span' : 'div');
    this.dom.className = isInline ? 'dita-nv-comment-inline' : 'dita-nv-comment-block';
    this.dom.dataset.xmlComment = 'true';
    this.dom.contentEditable = 'false';

    const openTag = createCommentChevronTag('open');
    this.textEl = document.createElement('span');
    this.textEl.className = 'dita-nv-comment-text';
    this.textEl.textContent = String(node.attrs.data ?? '').trim();
    const closeTag = createCommentChevronTag('close');

    this.dom.appendChild(openTag);
    this.dom.appendChild(this.textEl);
    this.dom.appendChild(closeTag);
  }

  update(node: PMNode): boolean {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.textEl.textContent = String(node.attrs.data ?? '').trim();
    return true;
  }
}

export interface CreateDitaNodeViewsOptions {
  resolveImageSrc?: (href: string) => string | null;
  getSemanticOverlay?: () => DocumentSemanticOverlay | null;
  semanticRegistry?: SemanticViewRegistry;
  /** True while the document is not editable (not checked out / viewer / foreign lock). */
  isReadOnly?: () => boolean;
  onJumpToSource?: (filePath: string, line?: number, elementId?: string) => void;
}

export function createDitaNodeViews(
  options: CreateDitaNodeViewsOptions = {},
): Record<string, NodeViewConstructor> {
  return {
    dita_note: (node, view, getPos) =>
      new DitaNoteNodeView(node, view, getPos, {
        isReadOnly: options.isReadOnly,
        semanticRegistry: options.semanticRegistry,
      }),
    dita_codeblock: (node) => new DitaCodeblockNodeView(node, 'codeblock'),
    dita_pre: (node) => new DitaCodeblockNodeView(node, 'pre'),
    dita_prolog: (node, view, getPos) => new DitaPrologNodeView(node, view, getPos),
    dita_image_block: (node) =>
      new DitaImageNodeView(
        node,
        true,
        options.resolveImageSrc,
        options.getSemanticOverlay,
        options.semanticRegistry,
      ),
    dita_image_inline: (node) =>
      new DitaImageNodeView(
        node,
        false,
        options.resolveImageSrc,
        options.getSemanticOverlay,
        options.semanticRegistry,
      ),
    dita_keyword: (node) => new DitaRefInlineNodeView(node, 'keyword', options),
    dita_xref: (node) => new DitaRefInlineNodeView(node, 'xref', options),
    dita_ph: (node) => new DitaRefInlineNodeView(node, 'ph', options),
    dita_term: (node) => new DitaRefInlineNodeView(node, 'term', options),
    cals_table: (node) => new CalsTableNodeView(node),
    cals_colspec: (node) => new CalsColspecNodeView(node),
    unknown_block: (node) => new UnknownPassthroughNodeView(node, 'block'),
    unknown_pre_block: (node) => new UnknownPassthroughNodeView(node, 'pre'),
    unknown_inline: (node) => new UnknownPassthroughNodeView(node, 'inline'),
    unknown_inline_block: (node) => new UnknownPassthroughNodeView(node, 'inline-block'),
    xml_comment_block: (node) => new XmlCommentNodeView(node, false),
    xml_comment_inline: (node) => new XmlCommentNodeView(node, true),
  };
}
