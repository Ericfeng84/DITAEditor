import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/index.js';
import type { MessageKey } from '../../i18n/messages/index.js';
import {
  checkChildRemoval,
  evaluateElementConditions,
  getAttributeGroupMeta,
  getAttributesForElement,
  getElementSpec,
  getAttributeLabel,
  getAttributePlaceholder,
  getElementDescription,
  getElementLabel,
  getPmChildTags,
  getRawAttr,
  makeConrefOverlayKey,
  serializePmBlockToXml,
  type DitaAttributeGroup,
  type DitaAttributeSpec,
  type DitaProfilingAttrName,
  type DocumentSemanticOverlay,
  type KeyDefinition,
  type KeyspaceResult,
  type ParsedDitaval,
  type XmlDeclaration,
  type XmlPrologItem,
} from '@dita/core';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpLeft,
  Archive,
  CopyPlus,
  ExternalLink,
  KeyRound,
  Pencil,
  Plus,
  ShieldCheck,
  Tag,
  Trash2,
} from 'lucide-react';
import { ProfilingAttrEditor } from '../../components/ProfilingAttrEditor';
import { AttributeField } from '../../components/attributes/AttributeField';
import { AttributeFilterBar } from '../../components/attributes/AttributeFilterBar';
import { AttributeGroupSection } from '../../components/attributes/AttributeGroupSection';
import { RawAttributesSection } from '../../components/attributes/RawAttributesSection';
import { filterGroupedAttributes } from '../../components/attributes/filter-attrs';
import { KeyrefAttrField } from './KeyrefAttrField';
import type { EditorSelectionSnapshot } from './selection-info';
import { blockIndexInParent, isBlockMoveOrderSafe } from './block-transforms';
import { getTaskContentModel } from '../structure-options';

export interface AttributesPanelProps {
  snapshot: EditorSelectionSnapshot | null;
  docMetadata: {
    xmlDeclaration: XmlDeclaration | null;
    prolog: XmlPrologItem[];
    epilog: XmlPrologItem[];
  } | null;
  semanticOverlay?: DocumentSemanticOverlay | null;
  activeDitaval?: ParsedDitaval | null;
  profilingCatalog?: Partial<Record<DitaProfilingAttrName, string[]>>;
  onJumpToSource?: (filePath: string, line?: number, elementId?: string) => void;
  onOpenConrefDialog?: () => void;
  /** "Make Reusable (Assign ID)" for the selected block (opens the snippet dialog). */
  onMakeReusable?: (payload: { pos: number; tagName: string; previewText: string }) => void;
  /** "Extract to Reuse Warehouse…" for the selected block. */
  onExtractToReuse?: (payload: {
    pos: number;
    tagName: string;
    previewText: string;
    fragmentXml: string;
  }) => void;
  onUpdateAttr: (nodePos: number, attrName: string, value: string | null) => void;
  onSelectBreadcrumb: (pos: number) => void;
  onMoveNode: (nodePos: number, direction: 'up' | 'down') => void;
  onDeleteNode: (nodePos: number) => void;
  keyspace?: KeyspaceResult | null;
  canEditKeys?: boolean;
  /** Opens `NewKeyDialog`; `onCreated` hands the new qualified key back for one-click binding. */
  onOpenNewKey?: (options?: {
    initialKeyName?: string;
    initialKind?: 'text' | 'file' | 'external';
    onCreated?: (qualifiedKey: string) => void;
  }) => void;
  onUpdateKeyValue?: (def: KeyDefinition, nextValue: string) => Promise<boolean>;
  onInspectKeyDef?: (def: KeyDefinition) => void;
}

const GROUP_ORDER: readonly DitaAttributeGroup[] = [
  'element',
  'core',
  'profiling',
  'reuse',
  'presentation',
  'localization',
];

const GROUP_TITLE_KEYS: Record<DitaAttributeGroup, MessageKey> = {
  element: 'attributes.group.element',
  core: 'attributes.group.core',
  profiling: 'attributes.group.profiling',
  reuse: 'attributes.group.reuse',
  presentation: 'attributes.group.presentation',
  localization: 'attributes.group.localization',
};

const DEFAULT_EXPANDED_GROUPS: Record<string, boolean> = {
  element: true,
  core: true,
  profiling: false,
  reuse: false,
  presentation: false,
  localization: false,
  raw: false,
};

export function AttributesPanel({
  snapshot,
  docMetadata,
  semanticOverlay = null,
  activeDitaval = null,
  profilingCatalog = {},
  onJumpToSource,
  onOpenConrefDialog,
  onMakeReusable,
  onExtractToReuse,
  onUpdateAttr,
  onSelectBreadcrumb,
  onMoveNode,
  onDeleteNode,
  keyspace = null,
  canEditKeys = false,
  onOpenNewKey,
  onUpdateKeyValue,
  onInspectKeyDef,
}: AttributesPanelProps) {
  const { t, locale } = useI18n();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    ...DEFAULT_EXPANDED_GROUPS,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [onlySet, setOnlySet] = useState(false);
  const [openHelp, setOpenHelp] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [keyValueEditing, setKeyValueEditing] = useState(false);
  const [keyValueDraft, setKeyValueDraft] = useState('');
  const [keyValueError, setKeyValueError] = useState<string | null>(null);

  const activeItem = snapshot?.activeItem ?? null;
  const activePos = activeItem?.pos ?? null;

  // Per-attribute help disclosures must not leak across elements.
  useEffect(() => {
    setOpenHelp(new Set<string>());
  }, [activePos]);

  if (!activeItem || !snapshot) {
    return (
      <aside
        aria-label={t('attributes.panelAria')}
        className="flex h-full flex-col border-l border-slate-200 bg-slate-50/70"
      >
        <div className="border-b border-slate-200 px-3 py-2.5">
          <h2 className="text-xs font-semibold text-slate-800">{t('attributes.title')}</h2>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-xs text-slate-400">
          <Tag className="mb-2 h-6 w-6 text-slate-300" aria-hidden="true" />
          <p>{t('attributes.emptyBody')}</p>
        </div>
      </aside>
    );
  }

  const tagName = activeItem.tagName;
  const spec = getElementSpec(tagName);
  const rawAttrs = snapshot.rawAttrs;
  const allAttrSpecs = getAttributesForElement(tagName);
  const knownNames = new Set(allAttrSpecs.map((a) => a.name));

  const keyrefVal = getRawAttr(rawAttrs, 'keyref')?.trim();
  const resolvedKeyref = keyrefVal ? semanticOverlay?.keyrefs[keyrefVal] : undefined;
  const keyrefDefinition = resolvedKeyref?.definition;
  /** Only a definition backed by plain text or `@href` can be rewritten losslessly. */
  const keyValueSource =
    keyrefDefinition && keyrefDefinition.inlineTextSource && keyrefDefinition.inlineTextSource !== 'none'
      ? keyrefDefinition.inlineTextSource
      : keyrefDefinition?.href !== undefined
        ? 'href'
        : null;
  const canQuickEditKeyValue = Boolean(
    canEditKeys && onUpdateKeyValue && keyrefDefinition && keyValueSource,
  );
  const keyFileBoundCount = keyspace
    ? Object.values(keyspace.keys).filter((def) => def.href !== undefined || def.resolvedHref !== undefined)
        .length
    : 0;
  const startKeyValueEdit = (def: KeyDefinition) => {
    setKeyValueDraft((def.inlineTextSource && def.inlineTextSource !== 'none' ? def.inlineText : def.href) ?? '');
    setKeyValueError(null);
    setKeyValueEditing(true);
  };
  const commitKeyValueEdit = async (def: KeyDefinition) => {
    const next = keyValueDraft.trim();
    if (!next || !onUpdateKeyValue) {
      setKeyValueError(t('keyspace.valueInvalid'));
      return;
    }
    const ok = await onUpdateKeyValue(def, next);
    if (!ok) {
      setKeyValueError(t('attributes.keyrefValueFailed'));
      return;
    }
    setKeyValueEditing(false);
  };

  const conkeyrefVal = getRawAttr(rawAttrs, 'conkeyref')?.trim();
  const conrefVal = getRawAttr(rawAttrs, 'conref')?.trim();
  const idVal = getRawAttr(rawAttrs, 'id')?.trim() ?? '';
  const blockPreviewText = activeItem.node.textContent.replace(/\s+/g, ' ').trim().slice(0, 120);
  const conrefendVal = getRawAttr(rawAttrs, 'conrefend')?.trim() || undefined;
  const activeConrefAttr = conkeyrefVal ? 'conkeyref' : conrefVal ? 'conref' : null;
  const activeConrefVal = conkeyrefVal ?? conrefVal ?? '';
  const resolvedConref =
    activeConrefAttr && activeConrefVal
      ? semanticOverlay?.conrefs[
          makeConrefOverlayKey(tagName, activeConrefAttr, activeConrefVal, conrefendVal)
        ]
      : undefined;

  const conditionEval = activeDitaval
    ? evaluateElementConditions(rawAttrs, activeDitaval)
    : null;

  // Group schema attributes cleanly
  const grouped = new Map<DitaAttributeGroup, DitaAttributeSpec[]>();
  for (const attrSpec of allAttrSpecs) {
    const list = grouped.get(attrSpec.group) ?? [];
    list.push(attrSpec);
    grouped.set(attrSpec.group, list);
  }

  const isFiltering = searchQuery.trim() !== '' || onlySet;
  const filtered = filterGroupedAttributes(grouped, rawAttrs, {
    query: searchQuery,
    onlySet,
    locale,
  });
  const setCount = allAttrSpecs.filter((a) => getRawAttr(rawAttrs, a.name) !== undefined).length;

  const parentCrumb =
    snapshot.breadcrumbs.length >= 2
      ? snapshot.breadcrumbs[
          Math.max(
            0,
            snapshot.breadcrumbs.findIndex((b) => b.pos === activeItem.pos) - 1,
          )
        ]
      : null;
  const canSelectParent = Boolean(parentCrumb && parentCrumb.pos !== activeItem.pos);
  const isRootElement = activeItem.depth === 1;

  // Structure actions follow the DITA content model instead of failing silently:
  // required children (`<taskbody>`, `<cmd>`), the last item of a `oneOrMore` slot and the root
  // element cannot be deleted, and reordering never breaks the ordered content model.
  const parentTag = parentCrumb?.tagName ?? '';
  const deleteObstacle = activeItem.node.isInline
    ? null
    : isRootElement || !parentCrumb
      ? ({ code: 'root-element', parentTag, childTag: tagName } as const)
      : checkChildRemoval(parentTag, tagName, getPmChildTags(parentCrumb.node), getTaskContentModel());
  const deleteBlockedReason = deleteObstacle
    ? deleteObstacle.code === 'root-element'
      ? t('block.deleteBlockedRoot')
      : deleteObstacle.code === 'required-policy'
        ? t('block.deleteBlockedPolicy', { tag: tagName, parent: parentTag })
        : deleteObstacle.code === 'last-of-one-or-more'
          ? t('block.deleteBlockedLast', { tag: tagName, parent: parentTag })
          : t('block.deleteBlockedRequired', { tag: tagName, parent: parentTag })
    : null;
  const parentChildTags = parentCrumb ? getPmChildTags(parentCrumb.node) : [];
  const siblingIndex =
    parentCrumb && !activeItem.node.isInline
      ? blockIndexInParent(parentCrumb.pos, parentCrumb.node, activeItem.pos)
      : -1;
  const canMoveUp =
    !isRootElement &&
    !activeItem.node.isInline &&
    isBlockMoveOrderSafe(parentTag, parentChildTags, siblingIndex, siblingIndex - 1);
  const canMoveDown =
    !isRootElement &&
    !activeItem.node.isInline &&
    isBlockMoveOrderSafe(parentTag, parentChildTags, siblingIndex, siblingIndex + 2);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleHelp = (attrName: string) => {
    setOpenHelp((prev) => {
      const next = new Set(prev);
      if (next.has(attrName)) next.delete(attrName);
      else next.add(attrName);
      return next;
    });
  };

  const resetFilters = () => {
    setSearchQuery('');
    setOnlySet(false);
  };

  const doctypeItem = docMetadata?.prolog.find((p) => p.type === 'doctype');

  const conditionBadge =
    conditionEval !== null ? (
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
          conditionEval.status === 'exclude'
            ? 'bg-rose-100 text-rose-800'
            : conditionEval.status === 'flag'
              ? 'bg-blue-100 text-blue-800'
              : 'bg-emerald-100 text-emerald-800'
        }`}
      >
        {conditionEval.status === 'exclude'
          ? t('attributes.condition.excluded')
          : conditionEval.status === 'flag'
            ? t('attributes.condition.flagged')
            : t('attributes.condition.included')}
      </span>
    ) : null;

  const keyrefBanner =
    keyrefVal && resolvedKeyref ? (
      <div
        className={`rounded-md border p-2 text-[11px] ${
          resolvedKeyref.status === 'resolved'
            ? 'border-blue-200 bg-blue-50/70 text-blue-950'
            : 'border-rose-200 bg-rose-50 text-rose-800'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 flex-1 break-words font-semibold">
            {resolvedKeyref.status === 'resolved'
              ? t('attributes.keyResolved', {
                  target:
                    resolvedKeyref.resolvedText ??
                    resolvedKeyref.targetFilePath ??
                    t('attributes.valid'),
                })
              : resolvedKeyref.errorMessage}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {resolvedKeyref.status === 'resolved' && canQuickEditKeyValue && keyrefDefinition ? (
              <button
                type="button"
                aria-pressed={keyValueEditing}
                title={t('attributes.keyrefEditValue')}
                onClick={() =>
                  keyValueEditing ? setKeyValueEditing(false) : startKeyValueEdit(keyrefDefinition)
                }
                className="inline-flex items-center gap-0.5 rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100"
              >
                <Pencil className="h-2.5 w-2.5" aria-hidden="true" />
                {t('attributes.keyrefEditValue')}
              </button>
            ) : null}
            {resolvedKeyref.status === 'resolved' && keyrefDefinition && onInspectKeyDef ? (
              <button
                type="button"
                title={t('attributes.keyrefInspect')}
                onClick={() => onInspectKeyDef(keyrefDefinition)}
                className="inline-flex items-center gap-0.5 rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
              >
                <KeyRound className="h-2.5 w-2.5" aria-hidden="true" />
                {t('attributes.keyrefInspect')}
              </button>
            ) : null}
            {resolvedKeyref.definition && onJumpToSource ? (
              <button
                type="button"
                onClick={() =>
                  onJumpToSource(
                    resolvedKeyref.definition!.sourceMapPath,
                    resolvedKeyref.definition!.line,
                  )
                }
                className="inline-flex items-center gap-0.5 rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-blue-200 hover:bg-blue-100"
              >
                <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                {t('attributes.define')}
              </button>
            ) : null}
          </span>
        </div>

        {resolvedKeyref.status === 'resolved' && keyValueEditing && keyrefDefinition ? (
          <div className="mt-1.5 space-y-1">
            <div className="flex items-center gap-1">
              <input
                id="dita-keyref-quick-value"
                type="text"
                value={keyValueDraft}
                aria-label={t('attributes.keyrefEditValue')}
                onChange={(e) => setKeyValueDraft(e.target.value)}
                className="min-w-0 flex-1 rounded border border-blue-200 bg-white px-1.5 py-0.5 font-mono text-[10.5px] focus:border-blue-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => void commitKeyValueEdit(keyrefDefinition)}
                className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-blue-700"
              >
                {t('common.save')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setKeyValueEditing(false);
                  setKeyValueError(null);
                }}
                className="rounded px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-white"
              >
                {t('common.cancel')}
              </button>
            </div>
            {keyValueError ? (
              <p className="text-[10px] font-medium text-rose-600">{keyValueError}</p>
            ) : null}
          </div>
        ) : null}

        {resolvedKeyref.status === 'unresolved' && canEditKeys && onOpenNewKey ? (
          <button
            type="button"
            onClick={() =>
              onOpenNewKey({
                initialKeyName: resolvedKeyref.keyName || keyrefVal,
                // The banner exists to fix *this* unresolved reference, so adopt the
                // new key's qualified name as soon as it exists.
                onCreated: (qualifiedKey) => onUpdateAttr(activeItem.pos, 'keyref', qualifiedKey),
              })
            }
            className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-rose-600 px-2 py-0.5 text-[10.5px] font-semibold text-white hover:bg-rose-700"
          >
            <Plus className="h-3 w-3" aria-hidden="true" />
            {t('attributes.keyrefCreateNamed', {
              key: resolvedKeyref.keyName || keyrefVal,
            })}
          </button>
        ) : null}
      </div>
    ) : null;

  const reuseBanner = (
    <div className="space-y-2">
      {onOpenConrefDialog ? (
        <button
          type="button"
          onClick={onOpenConrefDialog}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-[11px] font-medium text-teal-800 hover:bg-teal-100"
        >
          <CopyPlus className="h-3.5 w-3.5" aria-hidden="true" />
          {t('attributes.pickReuse')}
        </button>
      ) : null}
      {canEditKeys && onOpenNewKey && keyFileBoundCount === 0 ? (
        <button
          type="button"
          onClick={() => onOpenNewKey({ initialKind: 'file' })}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-teal-300 px-2.5 py-1.5 text-[11px] font-medium text-teal-700 hover:bg-teal-50"
        >
          <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
          {t('attributes.newFileKey')}
        </button>
      ) : null}
      {!activeConrefAttr && !isRootElement && (onMakeReusable || onExtractToReuse) ? (
        <div className="flex flex-wrap gap-1.5">
          {onMakeReusable && !idVal ? (
            <button
              type="button"
              onClick={() =>
                onMakeReusable({
                  pos: activeItem.pos,
                  tagName,
                  previewText: blockPreviewText,
                })
              }
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
            >
              <Tag className="h-3 w-3" aria-hidden="true" />
              {t('block.makeReusable')}
            </button>
          ) : null}
          {onExtractToReuse ? (
            <button
              type="button"
              onClick={() =>
                onExtractToReuse({
                  pos: activeItem.pos,
                  tagName,
                  previewText: blockPreviewText,
                  fragmentXml: serializePmBlockToXml(activeItem.node),
                })
              }
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
            >
              <Archive className="h-3 w-3" aria-hidden="true" />
              {t('block.extractToReuse')}
            </button>
          ) : null}
        </div>
      ) : null}
      {resolvedConref ? (
        <div
          className={`rounded-md border p-2 text-[11px] ${
            resolvedConref.status === 'resolved'
              ? 'border-teal-200 bg-teal-50/60 text-teal-900'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">
              {resolvedConref.status === 'resolved'
                ? t('attributes.resolved', { path: resolvedConref.targetFilePath ?? '' })
                : resolvedConref.errorMessage}
            </span>
            {resolvedConref.targetFilePath && onJumpToSource ? (
              <button
                type="button"
                onClick={() =>
                  onJumpToSource(
                    resolvedConref.targetFilePath!,
                    resolvedConref.targetLine,
                    resolvedConref.targetElementId,
                  )
                }
                className="inline-flex shrink-0 items-center gap-0.5 rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-teal-700 ring-1 ring-teal-200 hover:bg-teal-100"
              >
                <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                {t('attributes.sourceDef')}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );

  return (
    <aside
      aria-label={t('attributes.inspectorAria')}
      className="flex h-full flex-col border-l border-slate-200 bg-white text-slate-800"
    >
      {/* Selected Element Header */}
      <div className="border-b border-slate-200 bg-slate-50/90 px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <code className="rounded bg-blue-600 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white">
                &lt;{tagName}&gt;
              </code>
              {activeItem.isUnknown ? (
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                  {t('attributes.unknown')}
                </span>
              ) : null}
            </div>
            <p className="mt-1 truncate text-xs font-medium text-slate-700">
              {spec ? `${getElementLabel(spec, locale)} · <${spec.tag}>` : t('attributes.customSpec')}
            </p>
            {spec?.description ? (
              <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                {getElementDescription(spec, locale)}
              </p>
            ) : null}
          </div>
        </div>

        {/* Element Structure Actions */}
        <div className="mt-2.5 flex flex-wrap items-center gap-1">
          <button
            type="button"
            disabled={!canSelectParent}
            onClick={() => parentCrumb && onSelectBreadcrumb(parentCrumb.pos)}
            className="dita-mini-btn disabled:opacity-40"
            title={t('attributes.selectParent')}
          >
            <ArrowUpLeft className="h-3 w-3" aria-hidden="true" />
            {t('attributes.selectParentShort')}
          </button>
          <button
            type="button"
            disabled={!canMoveUp}
            onClick={() => onMoveNode(activeItem.pos, 'up')}
            className="dita-mini-btn disabled:opacity-40"
            title={t('attributes.moveUp')}
          >
            <ArrowUp className="h-3 w-3" aria-hidden="true" />
            {t('attributes.moveUpShort')}
          </button>
          <button
            type="button"
            disabled={!canMoveDown}
            onClick={() => onMoveNode(activeItem.pos, 'down')}
            className="dita-mini-btn disabled:opacity-40"
            title={t('attributes.moveDown')}
          >
            <ArrowDown className="h-3 w-3" aria-hidden="true" />
            {t('attributes.moveDownShort')}
          </button>
          <button
            type="button"
            disabled={deleteObstacle !== null}
            onClick={() => onDeleteNode(activeItem.pos)}
            className="dita-mini-btn ml-auto text-rose-700 hover:bg-rose-50 disabled:opacity-40"
            title={deleteBlockedReason ?? t('attributes.deleteTitle')}
          >
            <Trash2 className="h-3 w-3" aria-hidden="true" />
            {t('common.delete')}
          </button>
        </div>
      </div>

      <AttributeFilterBar
        query={searchQuery}
        onQueryChange={setSearchQuery}
        onlySet={onlySet}
        onToggleOnlySet={() => setOnlySet((prev) => !prev)}
        setCount={setCount}
      />

      {/* Scrollable Inspector Sections */}
      <div className="dita-scroller min-h-0 flex-1 overflow-y-auto divide-y divide-slate-100">
        {isFiltering && filtered.total === 0 ? (
          <div className="flex flex-col items-center gap-2 p-6 text-center text-xs text-slate-500">
            <p>{t('attributes.noMatches')}</p>
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-50"
            >
              {t('attributes.resetFilter')}
            </button>
          </div>
        ) : (
          GROUP_ORDER.map((groupKey) => {
            const attrs = isFiltering ? filtered.groups.get(groupKey) : grouped.get(groupKey);
            if (!attrs || attrs.length === 0) return null;
            const isOpen = isFiltering ? true : Boolean(expandedGroups[groupKey]);
            const filledCount = attrs.filter((a) => getRawAttr(rawAttrs, a.name) !== undefined).length;
            const meta = getAttributeGroupMeta(groupKey, locale);

            return (
              <AttributeGroupSection
                key={groupKey}
                group={groupKey}
                title={t(GROUP_TITLE_KEYS[groupKey])}
                description={meta.description}
                subtitle={meta.subtitle}
                isOpen={isOpen}
                onToggle={() => toggleGroup(groupKey)}
                filledCount={filledCount}
                rightBadge={groupKey === 'profiling' ? conditionBadge : undefined}
                banner={
                  groupKey === 'element' && keyrefBanner
                    ? keyrefBanner
                    : groupKey === 'reuse'
                      ? reuseBanner
                      : undefined
                }
              >
                {attrs.map((attr) => {
                  const currentVal = getRawAttr(rawAttrs, attr.name) ?? '';
                  const hasValue = getRawAttr(rawAttrs, attr.name) !== undefined;
                  const inputId = `dita-attr-${activeItem.pos}-${attr.name}`;
                  const placeholder =
                    getAttributePlaceholder(attr, locale) ?? getAttributeLabel(attr, locale);

                  return (
                    <AttributeField
                      key={attr.name}
                      attr={attr}
                      locale={locale}
                      inputId={inputId}
                      value={currentVal}
                      hasValue={hasValue}
                      helpOpen={openHelp.has(attr.name)}
                      onToggleHelp={() => toggleHelp(attr.name)}
                      onClear={() => onUpdateAttr(activeItem.pos, attr.name, null)}
                      onChange={(nextVal) => onUpdateAttr(activeItem.pos, attr.name, nextVal)}
                      renderControl={
                        attr.name === 'keyref'
                          ? (ctx) => (
                              <KeyrefAttrField
                                inputId={ctx.inputId}
                                value={currentVal}
                                keyspace={keyspace}
                                canEditKeys={canEditKeys}
                                placeholder={placeholder}
                                onChange={(nextVal) => onUpdateAttr(activeItem.pos, attr.name, nextVal)}
                                onOpenNewKey={
                                  onOpenNewKey
                                    ? () =>
                                        onOpenNewKey({
                                          initialKeyName: currentVal || undefined,
                                          // Bind straight away so a freshly created key lands in
                                          // the field the user was already editing.
                                          onCreated: (qualifiedKey) =>
                                            onUpdateAttr(activeItem.pos, attr.name, qualifiedKey),
                                        })
                                    : undefined
                                }
                                onInspectKeyDef={onInspectKeyDef}
                              />
                            )
                          : groupKey === 'profiling'
                            ? (ctx) => (
                                <ProfilingAttrEditor
                                  attrName={attr.name as DitaProfilingAttrName}
                                  inputId={ctx.inputId}
                                  value={currentVal}
                                  suggestions={
                                    profilingCatalog[attr.name as DitaProfilingAttrName] ?? []
                                  }
                                  placeholder={placeholder}
                                  onChange={(nextVal) =>
                                    onUpdateAttr(activeItem.pos, attr.name, nextVal)
                                  }
                                />
                              )
                            : undefined
                      }
                    />
                  );
                })}
              </AttributeGroupSection>
            );
          })
        )}

        <RawAttributesSection
          rawAttrs={rawAttrs}
          knownNames={knownNames}
          isOpen={Boolean(expandedGroups.raw)}
          onToggle={() => toggleGroup('raw')}
          onUpdateAttr={(name, value) => onUpdateAttr(activeItem.pos, name, value)}
          emptyText={t('attributes.none')}
        />

        {/* Lossless XML Document Prolog Info (shown when inspecting topic root) */}
        {isRootElement && docMetadata ? (
          <section className="bg-emerald-50/40 p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              {t('attributes.metaLocked')}
            </div>
            <dl className="mt-2 space-y-1 font-mono text-[10px] text-slate-600">
              <div>
                <dt className="text-slate-400">{t('attributes.xmlDecl')}</dt>
                <dd className="truncate text-slate-800">
                  {docMetadata.xmlDeclaration?.raw ?? t('attributes.noneValue')}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">DOCTYPE</dt>
                <dd className="break-all text-slate-800">
                  {doctypeItem && doctypeItem.type === 'doctype'
                    ? doctypeItem.info.raw ?? `<!DOCTYPE ${doctypeItem.info.name}>`
                    : t('attributes.noneValue')}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400">{t('attributes.docPi')}</dt>
                <dd className="text-slate-800">
                  {t('attributes.piCounts', {
                    prolog: docMetadata.prolog.filter((p) => p.type !== 'doctype').length,
                    epilog: docMetadata.epilog.length,
                  })}
                </dd>
              </div>
            </dl>
          </section>
        ) : null}
      </div>
    </aside>
  );
}
