import { useEffect, useMemo, useState } from 'react';
import {
  computeRelativeDitaHref,
  DITA_KEY_NAME_PATTERN,
  DITA_MAP_CONTAINER_NODE_TAGS,
  evaluateElementConditions,
  getAttributesForElement,
  getAttributeDescription,
  getAttributeLabel,
  getAttributePlaceholder,
  getElementLabel,
  getElementSpec,
  getRawAttr,
  parseDitaMap,
  resolveDitaHref,
  type DitaAttributeGroup,
  type DitaAttributeSpec,
  type DitaMapTreeNode,
  type DitaProfilingAttrName,
  type KeyDefinition,
  type KeyspaceResult,
  type ParsedDitaval,
} from '@dita/core';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Code2,
  KeyRound,
  Plus,
  ShieldCheck,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { ProfilingAttrEditor } from '../components/ProfilingAttrEditor';
import { useI18n } from '../i18n/index.js';
import type { MessageKey } from '../i18n/messages/index.js';
import type { MapBufferState } from './map-tree-utils';

export interface MapNodeInspectorProps {
  selected: { mapPath: string; elementPath: number[] | null } | null;
  mapBuffers: Record<string, MapBufferState>;
  availableFiles: string[];
  activeDitaval?: ParsedDitaval | null;
  profilingCatalog?: Partial<Record<DitaProfilingAttrName, string[]>>;
  onUpdateAttr: (
    mapPath: string,
    elementPath: number[] | null,
    attrName: string,
    value: string | null,
  ) => void;
  onUpdateNavtitle: (mapPath: string, elementPath: number[], navtitle: string) => void;
  onUpdateRootTitle: (mapPath: string, title: string) => void;
  onOpenTargetFile: (filePath: string) => void;
  onJumpToSource: (mapPath: string, line?: number) => void;
  onDeleteNode: (mapPath: string, elementPath: number[]) => void;
  keyspace?: KeyspaceResult | null;
  canEditKeys?: boolean;
  /** Rewrites the `<keyword>`/`<linktext>` text of the selected definition; false = failed. */
  onUpsertKeyText?: (
    mapPath: string,
    elementPath: number[],
    source: 'keyword' | 'linktext',
    value: string | null,
  ) => Promise<boolean>;
  onOpenNewKey?: (parent: {
    mapPath: string;
    parentPath: number[] | null;
    parentLabel: string;
  }) => void;
  onOpenKeysView?: () => void;
}

const GROUP_SUBTITLES: Record<DitaAttributeGroup, string> = {
  element: 'Element',
  core: 'Universal',
  profiling: 'Profiling',
  reuse: 'Reuse',
  presentation: 'Display',
};

const GROUP_TITLE_KEYS: Record<DitaAttributeGroup, MessageKey> = {
  element: 'mapNodeInspector.group.element',
  core: 'attributes.group.core',
  profiling: 'attributes.group.profiling',
  reuse: 'attributes.group.reuse',
  presentation: 'attributes.group.presentation',
};

function findTreeNodeByPath(
  nodes: readonly DitaMapTreeNode[],
  targetPath: readonly number[],
): DitaMapTreeNode | null {
  for (const n of nodes) {
    if (
      n.elementPath.length === targetPath.length &&
      n.elementPath.every((v, i) => v === targetPath[i])
    ) {
      return n;
    }
    if (n.children) {
      const hit = findTreeNodeByPath(n.children, targetPath);
      if (hit) return hit;
    }
  }
  return null;
}

export function MapNodeInspector({
  selected,
  mapBuffers,
  availableFiles,
  activeDitaval = null,
  profilingCatalog = {},
  onUpdateAttr,
  onUpdateNavtitle,
  onUpdateRootTitle,
  onOpenTargetFile,
  onJumpToSource,
  onDeleteNode,
  keyspace = null,
  canEditKeys = false,
  onUpsertKeyText,
  onOpenNewKey,
  onOpenKeysView,
}: MapNodeInspectorProps) {
  const { t, locale } = useI18n();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    element: true,
    core: true,
    profiling: false,
    reuse: false,
    presentation: false,
    raw: true,
  });
  const [customAttrName, setCustomAttrName] = useState('');
  const [customAttrValue, setCustomAttrValue] = useState('');

  // `node` is resolved first so the drafts below can start from the real XML value on the very
  // first render (the sync effect then keeps them aligned when the selection or file changes).
  const parsedMap = useMemo(() => {
    if (!selected) return null;
    const buf = mapBuffers[selected.mapPath];
    if (!buf) return null;
    try {
      return parseDitaMap(buf.xml);
    } catch {
      return null;
    }
  }, [selected, mapBuffers]);

  const selectionKey = selected
    ? `${selected.mapPath}#${selected.elementPath?.join('.') ?? 'root'}`
    : '';

  const node = useMemo(() => {
    if (!selected?.elementPath || !parsedMap) return null;
    return findTreeNodeByPath(parsedMap.nodes, selected.elementPath);
  }, [selected, parsedMap]);

  const [keysDraft, setKeysDraft] = useState(() => node?.keys ?? '');
  const [keysError, setKeysError] = useState<string | null>(null);
  const [inlineDraft, setInlineDraft] = useState(() => node?.inlineText ?? '');
  const [inlineSource, setInlineSource] = useState<'keyword' | 'linktext'>(() =>
    node?.inlineTextSource === 'linktext' ? 'linktext' : 'keyword',
  );
  const [inlineSaving, setInlineSaving] = useState(false);
  const [inlineMessage, setInlineMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  // Drafts follow the underlying XML value, so an external edit (or a check-in) re-syncs them.
  useEffect(() => {
    setKeysDraft(node?.keys ?? '');
    setInlineDraft(node?.inlineText ?? '');
    setInlineSource(node?.inlineTextSource === 'linktext' ? 'linktext' : 'keyword');
    setKeysError(null);
    setInlineMessage(null);
    setInlineSaving(false);
  }, [selectionKey, node?.keys, node?.inlineText, node?.inlineTextSource]);

  if (!selected || !parsedMap) {
    return (
      <aside
        aria-label={t('mapNodeInspector.aria')}
        className="flex h-full flex-col border-l border-slate-200 bg-slate-50/70"
      >
        <div className="border-b border-slate-200 px-3 py-2.5">
          <h2 className="text-xs font-semibold text-slate-800">{t('mapNodeInspector.title')}</h2>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-xs text-slate-400">
          <Tag className="mb-2 h-6 w-6 text-slate-300" aria-hidden="true" />
          <p>{t('mapNodeInspector.emptyBody')}</p>
        </div>
      </aside>
    );
  }

  const isRoot = selected.elementPath === null;
  if (!isRoot && !node) {
    return (
      <aside className="flex h-full flex-col border-l border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-400">
        {t('mapNodeInspector.staleSelection')}
      </aside>
    );
  }

  const tagName = isRoot ? parsedMap.rootTag : node!.tagName;
  const rawAttrs = isRoot ? parsedMap.rootAttrs : node!.rawAttrs;
  const spec = getElementSpec(tagName);
  const allAttrSpecs = getAttributesForElement(tagName);
  const knownNames = new Set(allAttrSpecs.map((a) => a.name));
  const conditionEval = activeDitaval
    ? evaluateElementConditions(rawAttrs, activeDitaval)
    : null;

  const keysAttr = getRawAttr(rawAttrs, 'keys') ?? '';
  const isKeyDefining = !isRoot && (tagName === 'keydef' || keysAttr.trim().length > 0);
  const isContainer = isRoot || DITA_MAP_CONTAINER_NODE_TAGS.has(tagName);
  const keyTokens = keysAttr.split(/\s+/).filter(Boolean);
  const resolvedDefs: KeyDefinition[] = keyTokens
    .map((token) => keyspace?.keys[token])
    .filter((def): def is KeyDefinition => Boolean(def));

  const grouped = new Map<DitaAttributeGroup, DitaAttributeSpec[]>();
  for (const attrSpec of allAttrSpecs) {
    const list = grouped.get(attrSpec.group) ?? [];
    list.push(attrSpec);
    grouped.set(attrSpec.group, list);
  }

  const currentHref = getRawAttr(rawAttrs, 'href') ?? '';
  const resolvedTarget = currentHref ? resolveDitaHref(selected.mapPath, currentHref) : null;
  const canOpenTarget = Boolean(
    resolvedTarget && !resolvedTarget.isExternal && !resolvedTarget.escapesRoot && resolvedTarget.targetPath,
  );

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleAddCustomAttr = (e: React.FormEvent) => {
    e.preventDefault();
    const name = customAttrName.trim();
    if (!name || !/^[A-Za-z_][\w:.-]*$/.test(name)) return;
    onUpdateAttr(selected.mapPath, selected.elementPath, name, customAttrValue);
    setCustomAttrName('');
    setCustomAttrValue('');
  };

  const commitKeysAttr = () => {
    if (!canEditKeys || !node) return;
    const next = keysDraft.trim().replace(/\s+/g, ' ');
    const tokens = next ? next.split(' ') : [];
    const invalid = tokens.find((token) => !DITA_KEY_NAME_PATTERN.test(token));
    if (next && invalid) {
      setKeysError(t('mapNodeInspector.keysInvalid'));
      return;
    }
    setKeysError(null);
    if (next === (node.keys ?? '')) return;
    onUpdateAttr(selected.mapPath, selected.elementPath, 'keys', next || null);
  };

  const saveInlineText = async (value: string | null) => {
    if (!onUpsertKeyText || isRoot) return;
    setInlineSaving(true);
    const ok = await onUpsertKeyText(
      selected.mapPath,
      selected.elementPath!,
      inlineSource,
      value,
    );
    setInlineSaving(false);
    setInlineMessage({
      tone: ok ? 'ok' : 'error',
      text: ok ? t('mapNodeInspector.inlineTextSaved') : t('mapNodeInspector.inlineTextFailed'),
    });
  };

  return (
    <aside
      aria-label={t('mapNodeInspector.aria')}
      className="flex h-full flex-col border-l border-slate-200 bg-white text-slate-800"
    >
      {/* Header */}
      <div className="border-b border-slate-200 bg-slate-50/90 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <code className="rounded bg-sky-600 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-white">
              &lt;{tagName}&gt;
            </code>
            <span className="truncate font-mono text-[10px] text-slate-400">
              {selected.mapPath}
            </span>
          </div>
        </div>
        <p className="mt-1 truncate text-xs font-medium text-slate-700">
          {spec ? `${getElementLabel(spec, locale)} · <${spec.tag}>` : t('mapNodeInspector.structuralNode')}
        </p>

        <div className="mt-2.5 flex flex-wrap items-center gap-1">
          {canOpenTarget ? (
            <button
              type="button"
              onClick={() => onOpenTargetFile(resolvedTarget!.targetPath)}
              className="dita-mini-btn text-blue-700"
            >
              <BookOpen className="h-3 w-3" aria-hidden="true" />
              {t('mapNodeInspector.openTarget')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onJumpToSource(selected.mapPath, node?.line)}
            className="dita-mini-btn text-sky-700"
          >
            <Code2 className="h-3 w-3" aria-hidden="true" />
            {t('mapNodeInspector.locateSource')}
          </button>
          {isContainer && canEditKeys && onOpenNewKey ? (
            <button
              type="button"
              onClick={() =>
                onOpenNewKey({
                  mapPath: selected.mapPath,
                  parentPath: isRoot ? null : selected.elementPath,
                  parentLabel: isRoot
                    ? parsedMap.title
                    : (node?.navtitle ?? node?.label ?? tagName),
                })
              }
              title={t('mapNodeInspector.newKey')}
              className="dita-mini-btn text-blue-700"
            >
              <KeyRound className="h-3 w-3" aria-hidden="true" />
              {t('mapNodeInspector.newKey')}
            </button>
          ) : null}
          {isRoot && onOpenKeysView ? (
            <button
              type="button"
              onClick={onOpenKeysView}
              title={t('mapNodeInspector.openKeysView')}
              className="dita-mini-btn text-slate-700"
            >
              <KeyRound className="h-3 w-3" aria-hidden="true" />
              {t('mapNodeInspector.keysCount', {
                count: keyspace ? Object.keys(keyspace.keys).length : 0,
              })}
            </button>
          ) : null}
          {!isRoot ? (
            <button
              type="button"
              onClick={() => onDeleteNode(selected.mapPath, selected.elementPath!)}
              className="dita-mini-btn ml-auto text-rose-700 hover:bg-rose-50"
            >
              <Trash2 className="h-3 w-3" aria-hidden="true" />
              {t('mapMenu.remove')}
            </button>
          ) : null}
        </div>
      </div>

      <div className="dita-scroller min-h-0 flex-1 overflow-y-auto divide-y divide-slate-100">
        {/* Title / Navtitle quick editor */}
        <section className="p-3">
          {isRoot ? (
            <div>
              <label
                htmlFor="map-root-title-input"
                className="mb-1 block text-[11px] font-semibold text-slate-700"
              >
                {t('mapNodeInspector.mapTitle')}
              </label>
              <input
                id="map-root-title-input"
                type="text"
                value={parsedMap.title}
                onChange={(e) => onUpdateRootTitle(selected.mapPath, e.target.value)}
                className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>
          ) : isKeyDefining ? (
            <div className="space-y-2 rounded-lg border border-blue-200 bg-blue-50/40 p-2.5">
              <div className="flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                <span className="text-[11px] font-semibold text-slate-800">
                  {t('mapNodeInspector.keysTitle')}
                </span>
              </div>

              <div>
                <label
                  htmlFor="map-key-keys-input"
                  className="mb-1 block text-[10.5px] font-medium text-slate-600"
                >
                  {t('mapNodeInspector.keysLabel')}
                </label>
                <input
                  id="map-key-keys-input"
                  type="text"
                  value={keysDraft}
                  disabled={!canEditKeys}
                  onChange={(e) => {
                    setKeysDraft(e.target.value);
                    setKeysError(null);
                  }}
                  onBlur={commitKeysAttr}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitKeysAttr();
                    }
                  }}
                  aria-invalid={keysError ? true : undefined}
                  spellCheck={false}
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] text-slate-900 focus:border-blue-500 focus:outline-none disabled:bg-slate-100"
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  {t('mapNodeInspector.keysHint')}
                </p>
                {keysError ? (
                  <p className="mt-1 text-[10.5px] font-medium text-rose-600">{keysError}</p>
                ) : null}
                {resolvedDefs.length > 0 ? (
                  <div className="mt-1 space-y-0.5">
                    {resolvedDefs.map((def) => (
                      <p key={def.qualifiedKey} className="flex items-center gap-1 text-[10px] text-slate-500">
                        <code className="rounded bg-blue-100 px-1 font-mono text-blue-900">
                          {def.qualifiedKey || def.key}
                        </code>
                        <span>
                          {def.keyscope
                            ? t('mapNodeInspector.resolvedScope', { scope: def.keyscope })
                            : t('keyspace.scope.global')}
                        </span>
                        {def.shadowedCount > 0 ? (
                          <span className="rounded bg-amber-100 px-1 font-mono text-amber-800">
                            {t('mapNodeInspector.shadowedCount', { count: def.shadowedCount })}
                          </span>
                        ) : null}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>

              {canEditKeys && onUpsertKeyText ? (
                <div>
                  <div className="mb-1 flex items-center justify-between gap-1">
                    <label
                      htmlFor="map-key-inline-text-input"
                      className="text-[10.5px] font-medium text-slate-600"
                    >
                      {t('mapNodeInspector.inlineTextTitle')}
                    </label>
                    <select
                      aria-label={t('mapNodeInspector.inlineTextSource')}
                      value={inlineSource}
                      onChange={(e) => setInlineSource(e.target.value as 'keyword' | 'linktext')}
                      className="rounded border border-slate-200 bg-white px-1 py-0.5 font-mono text-[10px] text-slate-700 focus:border-blue-500 focus:outline-none"
                    >
                      <option value="keyword">{t('mapNodeInspector.sourceKeyword')}</option>
                      <option value="linktext">{t('mapNodeInspector.sourceLinktext')}</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      id="map-key-inline-text-input"
                      type="text"
                      value={inlineDraft}
                      placeholder={t('mapNodeInspector.inlineTextPlaceholder')}
                      onChange={(e) => {
                        setInlineDraft(e.target.value);
                        setInlineMessage(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void saveInlineText(inlineDraft.trim() || null);
                        }
                      }}
                      className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={inlineSaving}
                      onClick={() => void saveInlineText(inlineDraft.trim() || null)}
                      className="shrink-0 rounded-md bg-blue-600 px-2 py-1 text-[10.5px] font-semibold text-white hover:bg-blue-700 disabled:opacity-45"
                    >
                      {t('mapNodeInspector.inlineTextSave')}
                    </button>
                    <button
                      type="button"
                      disabled={inlineSaving}
                      onClick={() => {
                        setInlineDraft('');
                        void saveInlineText(null);
                      }}
                      className="shrink-0 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10.5px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-45"
                    >
                      {t('mapNodeInspector.inlineTextClear')}
                    </button>
                  </div>
                  {inlineMessage ? (
                    <p
                      className={`mt-1 text-[10.5px] font-medium ${
                        inlineMessage.tone === 'ok' ? 'text-emerald-700' : 'text-rose-600'
                      }`}
                    >
                      {inlineMessage.text}
                    </p>
                  ) : null}
                </div>
              ) : node?.inlineText ? (
                <p className="rounded border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700">
                  {node.inlineText}
                </p>
              ) : null}

              <p className="text-[10px] text-slate-400">{t('mapNodeInspector.hrefHint')}</p>
            </div>
          ) : (
            <div>
              <label
                htmlFor="map-node-navtitle-input"
                className="mb-1 block text-[11px] font-semibold text-slate-700"
              >
                {t('mapNodeInspector.navtitle')}
              </label>
              <input
                id="map-node-navtitle-input"
                type="text"
                value={node?.navtitle ?? ''}
                placeholder={t('mapNodeInspector.navtitlePlaceholder')}
                onChange={(e) =>
                  onUpdateNavtitle(selected.mapPath, selected.elementPath!, e.target.value)
                }
                className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>
          )}
        </section>

        {/* Raw Attributes in exact XML order */}
        <section className="p-3">
          <button
            type="button"
            onClick={() => toggleGroup('raw')}
            className="flex w-full items-center justify-between text-left text-[11px] font-semibold uppercase tracking-wide text-slate-600"
          >
            <span className="flex items-center gap-1">
              {expandedGroups.raw ? (
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
              )}
              {t('attributes.rawTitle')}
            </span>
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
              {rawAttrs.length}
            </span>
          </button>

          {expandedGroups.raw ? (
            <div className="mt-2 space-y-1.5">
              {rawAttrs.length === 0 ? (
                <p className="text-[11px] text-slate-400">{t('mapNodeInspector.noAttrs')}</p>
              ) : (
                rawAttrs.map((entry) => (
                  <div
                    key={entry.name}
                    className="flex items-center gap-1.5 rounded border border-slate-200/80 bg-slate-50 px-2 py-1"
                  >
                    <span
                      className={`shrink-0 font-mono text-[11px] font-medium ${
                        knownNames.has(entry.name) ? 'text-blue-700' : 'text-amber-700'
                      }`}
                    >
                      {entry.name}
                    </span>
                    <span className="text-slate-400">=</span>
                    <input
                      type="text"
                      aria-label={t('attributes.attrAria', { name: entry.name })}
                      value={entry.value}
                      onChange={(e) =>
                        onUpdateAttr(selected.mapPath, selected.elementPath, entry.name, e.target.value)
                      }
                      className="min-w-0 flex-1 rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-slate-800 ring-1 ring-slate-200 focus:ring-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateAttr(selected.mapPath, selected.elementPath, entry.name, null)
                      }
                      aria-label={t('attributes.removeAria', { name: entry.name })}
                      className="rounded p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                ))
              )}

              <form onSubmit={handleAddCustomAttr} className="mt-2 flex items-center gap-1">
                <input
                  type="text"
                  value={customAttrName}
                  onChange={(e) => setCustomAttrName(e.target.value)}
                  placeholder={t('attributes.namePlaceholder')}
                  aria-label={t('attributes.nameAria')}
                  className="w-24 rounded border border-slate-200 px-1.5 py-1 font-mono text-[11px] focus:border-blue-500 focus:outline-none"
                />
                <input
                  type="text"
                  value={customAttrValue}
                  onChange={(e) => setCustomAttrValue(e.target.value)}
                  placeholder={t('attributes.valuePlaceholder')}
                  aria-label={t('attributes.valueAria')}
                  className="min-w-0 flex-1 rounded border border-slate-200 px-1.5 py-1 font-mono text-[11px] focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  aria-label={t('mapNodeInspector.addAttr')}
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-800 text-white hover:bg-slate-700"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </form>
            </div>
          ) : null}
        </section>

        {/* Schema-guided groups */}
        {(['element', 'core', 'profiling', 'reuse'] as DitaAttributeGroup[]).map((groupKey) => {
          const attrs = grouped.get(groupKey);
          if (!attrs || attrs.length === 0) return null;
          const isOpen = Boolean(expandedGroups[groupKey]);
          const filledCount = attrs.filter((a) => getRawAttr(rawAttrs, a.name) !== undefined).length;

          return (
            <section key={groupKey} className="p-3">
              <button
                type="button"
                onClick={() => toggleGroup(groupKey)}
                className="flex w-full items-center justify-between text-left text-[11px] font-semibold text-slate-700"
              >
                <span className="flex items-center gap-1">
                  {isOpen ? (
                    <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  )}
                  {t(GROUP_TITLE_KEYS[groupKey])}
                </span>
                {groupKey === 'profiling' && conditionEval ? (
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
                ) : filledCount > 0 ? (
                  <span className="rounded-full bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-700">
                    {filledCount}
                  </span>
                ) : (
                  <span className="text-[10px] font-normal text-slate-400">{GROUP_SUBTITLES[groupKey]}</span>
                )}
              </button>

              {isOpen ? (
                <div className="mt-2.5 space-y-2.5">
                  {attrs.map((attr) => {
                    const currentVal = getRawAttr(rawAttrs, attr.name) ?? '';
                    const hasValue = getRawAttr(rawAttrs, attr.name) !== undefined;
                    const inputId = `map-attr-${tagName}-${attr.name}`;

                    return (
                      <div key={attr.name}>
                        <div className="mb-1 flex items-center justify-between">
                          <label
                            htmlFor={inputId}
                            className="flex items-center gap-1 text-[11px] font-medium text-slate-700"
                            title={getAttributeDescription(attr, locale)}
                          >
                            <code className="font-mono text-slate-900">{attr.name}</code>
                          </label>
                          {hasValue ? (
                            <button
                              type="button"
                              onClick={() =>
                                onUpdateAttr(selected.mapPath, selected.elementPath, attr.name, null)
                              }
                              className="text-[10px] text-slate-400 hover:text-rose-600"
                            >
                              {t('attributes.clear')}
                            </button>
                          ) : null}
                        </div>

                        {groupKey === 'profiling' ? (
                          <ProfilingAttrEditor
                            attrName={attr.name as DitaProfilingAttrName}
                            inputId={inputId}
                            value={currentVal}
                            suggestions={profilingCatalog[attr.name as DitaProfilingAttrName] ?? []}
                            placeholder={getAttributePlaceholder(attr, locale) ?? getAttributeLabel(attr, locale)}
                            onChange={(nextVal) =>
                              onUpdateAttr(selected.mapPath, selected.elementPath, attr.name, nextVal)
                            }
                          />
                        ) : attr.values && attr.values.length > 0 ? (
                          <select
                            id={inputId}
                            value={currentVal}
                            onChange={(e) =>
                              onUpdateAttr(
                                selected.mapPath,
                                selected.elementPath,
                                attr.name,
                                e.target.value === '' ? null : e.target.value,
                              )
                            }
                            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] focus:border-blue-500 focus:outline-none"
                          >
                            <option value="">{t('attributes.unset')}</option>
                            {currentVal && !attr.values.includes(currentVal) ? (
                              <option value={currentVal}>{currentVal}</option>
                            ) : null}
                            {attr.values.map((v) => (
                              <option key={v} value={v}>
                                {v}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="space-y-1">
                            <input
                              id={inputId}
                              type="text"
                              value={currentVal}
                              placeholder={getAttributePlaceholder(attr, locale) ?? getAttributeLabel(attr, locale)}
                              onChange={(e) =>
                                onUpdateAttr(
                                  selected.mapPath,
                                  selected.elementPath,
                                  attr.name,
                                  e.target.value === '' ? null : e.target.value,
                                )
                              }
                              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] focus:border-blue-500 focus:outline-none"
                            />
                            {attr.name === 'href' && availableFiles.length > 0 ? (
                              <select
                                aria-label={t('mapNodeInspector.quickPickAria')}
                                value=""
                                onChange={(e) => {
                                  if (!e.target.value) return;
                                  const rel = computeRelativeDitaHref(
                                    selected.mapPath,
                                    e.target.value,
                                  );
                                  onUpdateAttr(
                                    selected.mapPath,
                                    selected.elementPath,
                                    'href',
                                    rel,
                                  );
                                }}
                                className="w-full rounded border border-dashed border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10.5px] text-slate-600 focus:border-blue-500 focus:outline-none"
                              >
                                <option value="">{t('mapNodeInspector.quickPick')}</option>
                                {availableFiles
                                  .filter((f) => f !== selected.mapPath)
                                  .map((f) => (
                                    <option key={f} value={f}>
                                      {f}
                                    </option>
                                  ))}
                              </select>
                            ) : null}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </section>
          );
        })}

        {/* Lossless Metadata Card */}
        <section className="bg-emerald-50/40 p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
            {t('mapNodeInspector.lossless')}
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600">
            {t('mapNodeInspector.metaLine', {
              doctype: parsedMap.preservedMetaSummary.hasDoctype ? t('mapNodeInspector.preserved') : t('attributes.noneValue'),
              comments: parsedMap.preservedMetaSummary.commentCount,
              pis: parsedMap.preservedMetaSummary.piCount,
            })}
            
            {parsedMap.preservedMetaSummary.hasReltable ? t('mapNodeInspector.hasReltable') : ''}
          </p>
        </section>
      </div>
    </aside>
  );
}
