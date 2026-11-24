import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n/index.js';
import {
  areConrefTagsCompatible,
  type IndexedTopicElement,
  type KeyspaceResult,
  type ResolvedConrefResult,
  type TopicIdIndexEntry,
} from '@dita/core';
import { buildReuseAttrValue, filterReusableElements, listKeyBoundTopics } from './conref-reuse-model';
import { useConrefRowDrag } from './use-conref-row-drag.js';
import type { ConrefDragPayload } from '../editor/visual/conref-drag.js';
import {
  AlertTriangle,
  CheckCircle2,
  CopyPlus,
  GripVertical,
  RotateCcw,
  Search,
  ShieldAlert,
} from 'lucide-react';

export interface ConrefReusePanelProps {
  activeDocPath: string | null;
  selectedElementTag: string | null;
  selectedTopicId?: string;
  selectedElementId?: string;
  keyspace: KeyspaceResult | null;
  topicIndices: TopicIdIndexEntry[];
  onResolvePreview: (params: {
    sourceFilePath: string;
    sourceTagName: string;
    attrName: 'conref' | 'conkeyref';
    rawValue: string;
    sourceTopicId?: string;
    sourceElementId?: string;
  }) => Promise<ResolvedConrefResult>;
  onConfirm: (options: {
    action: 'insert-new' | 'bind-selected';
    tagName: string;
    attrName: 'conref' | 'conkeyref';
    value: string;
  }) => void;
  /** Called after a successful confirmation so the shell can return to the attributes tab. */
  onConfirmed?: () => void;
  /**
   * Insert a dragged candidate at viewport coordinates (visual editor drop). Returns whether the
   * element was inserted so the panel can show inline feedback instead of failing silently.
   */
  onDropAtPoint?: (clientX: number, clientY: number, payload: ConrefDragPayload) => boolean;
}

const MODES = [
  { value: 'conkeyref', labelKey: 'conref.mode.key', hintKey: 'conref.mode.keyHint' },
  { value: 'conref', labelKey: 'conref.mode.path', hintKey: 'conref.mode.pathHint' },
] as const;

/**
 * Right-inspector "复用" tab: pick a reusable element from the project (by Key or by relative
 * path), preview the resolved content plus the conref cycle check, then insert it or bind it to
 * the currently selected element. Replaces the former modal `InsertConrefDialog`.
 */
export function ConrefReusePanel({
  activeDocPath,
  selectedElementTag,
  selectedTopicId,
  selectedElementId,
  keyspace,
  topicIndices,
  onResolvePreview,
  onConfirm,
  onConfirmed,
  onDropAtPoint,
}: ConrefReusePanelProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<'conkeyref' | 'conref'>('conkeyref');
  const [selectedKey, setSelectedKey] = useState('');
  const [selectedFile, setSelectedFile] = useState('');
  const [idSearch, setIdSearch] = useState('');
  const [selectedTarget, setSelectedTarget] = useState<IndexedTopicElement | null>(null);
  const [insertAction, setInsertAction] = useState<'insert-new' | 'bind-selected'>('insert-new');
  const [preview, setPreview] = useState<ResolvedConrefResult | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [dropNotice, setDropNotice] = useState<{ ok: boolean; tag: string } | null>(null);

  /** conref/conkeyref payload for one candidate row, or null when the row cannot be dragged. */
  const buildPayload = useCallback(
    (target: IndexedTopicElement): ConrefDragPayload | null => {
      const value = buildReuseAttrValue({
        attrName: mode,
        selectedKey,
        target,
        activeDocPath,
      });
      if (!value) return null;
      return { tagName: target.tagName, attrName: mode, value };
    },
    [mode, selectedKey, activeDocPath],
  );

  const drag = useConrefRowDrag({
    onDropAtPoint: (clientX, clientY, payload) => {
      const inserted = onDropAtPoint?.(clientX, clientY, payload) ?? false;
      setDropNotice({ ok: inserted, tag: payload.tagName });
      return inserted;
    },
  });

  // Transient inline feedback: the status bar announcement alone is easy to miss during a drag.
  useEffect(() => {
    if (!dropNotice) return;
    const timer = window.setTimeout(() => setDropNotice(null), 2800);
    return () => window.clearTimeout(timer);
  }, [dropNotice]);

  const keyBoundTopics = useMemo(() => listKeyBoundTopics(keyspace), [keyspace]);

  // Reset the picker only when the edited document changes (the panel also unmounts when the
  // inspector switches tabs), so a background keyspace re-index never clears the user's choice.
  const initializedForDocRef = useRef<string | null>(null);
  useEffect(() => {
    if (initializedForDocRef.current === activeDocPath) return;
    initializedForDocRef.current = activeDocPath;
    const hasKeys = keyBoundTopics.length > 0;
    setMode(hasKeys ? 'conkeyref' : 'conref');
    setSelectedKey(keyBoundTopics[0]?.qualifiedKey ?? '');
    setSelectedFile(
      topicIndices.find((t) => t.filePath !== activeDocPath)?.filePath ??
        topicIndices[0]?.filePath ??
        '',
    );
    setIdSearch('');
    setSelectedTarget(null);
    setInsertAction('insert-new');
    setPreview(null);
  }, [activeDocPath, keyBoundTopics, topicIndices]);

  const effectiveTopicFile = useMemo(() => {
    if (mode === 'conkeyref') {
      return keyBoundTopics.find((k) => k.qualifiedKey === selectedKey)?.resolvedHref ?? '';
    }
    return selectedFile;
  }, [mode, keyBoundTopics, selectedKey, selectedFile]);

  const candidateElements = useMemo(
    () => filterReusableElements(topicIndices.find((t) => t.filePath === effectiveTopicFile), idSearch),
    [topicIndices, effectiveTopicFile, idSearch],
  );

  const computedAttrValue = useMemo(
    () =>
      buildReuseAttrValue({
        attrName: mode,
        selectedKey,
        target: selectedTarget,
        activeDocPath,
      }),
    [mode, selectedKey, selectedTarget, activeDocPath],
  );

  const canBindToSelected = Boolean(
    selectedElementTag &&
      selectedTarget &&
      areConrefTagsCompatible(selectedElementTag, selectedTarget.tagName),
  );

  useEffect(() => {
    if (!selectedTarget || !activeDocPath || !computedAttrValue) {
      setPreview(null);
      return;
    }

    const effectiveSourceTag =
      insertAction === 'bind-selected' && selectedElementTag
        ? selectedElementTag
        : selectedTarget.tagName;

    let cancelled = false;
    setLoadingPreview(true);
    void onResolvePreview({
      sourceFilePath: activeDocPath,
      sourceTagName: effectiveSourceTag,
      attrName: mode,
      rawValue: computedAttrValue,
      sourceTopicId: selectedTopicId,
      sourceElementId: insertAction === 'bind-selected' ? selectedElementId : undefined,
    })
      .then((res) => {
        if (!cancelled) {
          setPreview(res);
          setLoadingPreview(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingPreview(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    selectedTarget,
    activeDocPath,
    computedAttrValue,
    insertAction,
    selectedElementTag,
    selectedTopicId,
    selectedElementId,
    mode,
    onResolvePreview,
  ]);

  const resetSelection = () => {
    setSelectedTarget(null);
    setIdSearch('');
    setInsertAction('insert-new');
    setPreview(null);
  };

  const handleSubmit = () => {
    if (!selectedTarget || !computedAttrValue) return;
    if (preview?.status === 'cycle') return;

    const finalAction =
      insertAction === 'bind-selected' && canBindToSelected ? 'bind-selected' : 'insert-new';
    onConfirm({
      action: finalAction,
      tagName:
        finalAction === 'bind-selected' && selectedElementTag
          ? selectedElementTag
          : selectedTarget.tagName,
      attrName: mode,
      value: computedAttrValue,
    });
    resetSelection();
    onConfirmed?.();
  };

  const submitDisabled = !selectedTarget || !computedAttrValue || preview?.status === 'cycle';
  const noKeyBoundTopics = mode === 'conkeyref' && keyBoundTopics.length === 0;

  return (
    <aside
      aria-label={t('conref.panelAria')}
      className="flex h-full min-h-0 flex-col border-l border-slate-200 bg-white text-slate-800"
    >
      {/* Pointer-drag ghost: only the fallback path needs it (native drags show the OS ghost). */}
      {drag.ghost ? (
        <div
          aria-hidden="true"
          className={`pointer-events-none fixed z-[70] -translate-y-1/2 translate-x-4 rounded-full border px-2 py-1 font-mono text-[10.5px] whitespace-nowrap shadow-lg ${
            drag.ghost.overTarget
              ? 'border-teal-500 bg-teal-600 text-white'
              : 'border-slate-300 bg-white text-slate-600'
          }`}
          style={{ left: drag.ghost.x, top: drag.ghost.y }}
        >
          {drag.ghost.label}
        </div>
      ) : null}
      {/* Header: current context + reference mode */}
      <div className="shrink-0 border-b border-slate-200 bg-slate-50/90 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-800">
            <CopyPlus className="h-3.5 w-3.5 text-teal-600" aria-hidden="true" />
            {t('conref.title')}
          </h2>
          <span
            className="truncate font-mono text-[10px] text-slate-500"
            title={
              selectedElementTag
                ? t('conref.selectedHint', { tag: selectedElementTag })
                : t('conref.unselectedHint')
            }
          >
            {selectedElementTag ? t('conref.currentSelection', { tag: selectedElementTag }) : t('conref.noSelection')}
          </span>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-1.5" role="group" aria-label={t('conref.modeAria')}>
          {MODES.map((option) => {
            const isActive = mode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isActive}
                title={`${option.value} — ${t(option.hintKey)}`}
                onClick={() => {
                  setMode(option.value);
                  setSelectedTarget(null);
                }}
                className={`rounded-md border px-2 py-1 text-left transition-colors ${
                  isActive
                    ? 'border-teal-500 bg-white text-teal-900 shadow-xs'
                    : 'border-slate-200 text-slate-600 hover:bg-white'
                }`}
              >
                <span className="block truncate font-mono text-[11px] font-semibold">
                  {option.value}
                </span>
                <span className="block truncate text-[9.5px] text-slate-500">{t(option.hintKey)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col divide-y divide-slate-100 overflow-y-auto">
        {/* 1. Target topic */}
        <section className="shrink-0 px-3 py-1.5">
          <label
            htmlFor={mode === 'conkeyref' ? 'conref-panel-key' : 'conref-panel-file'}
            className="mb-1 block text-[11px] font-semibold text-slate-700"
          >
            {mode === 'conkeyref' ? t('conref.step1Key') : t('conref.step1File')}
          </label>
          {mode === 'conkeyref' ? (
            <select
              id="conref-panel-key"
              value={selectedKey}
              onChange={(e) => {
                setSelectedKey(e.target.value);
                setSelectedTarget(null);
              }}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] focus:border-teal-500 focus:outline-none"
            >
              {keyBoundTopics.length === 0 ? (
                <option value="">{t('conref.noBoundKeys')}</option>
              ) : (
                keyBoundTopics.map((k) => (
                  <option key={k.qualifiedKey} value={k.qualifiedKey}>
                    {k.qualifiedKey} → {k.resolvedHref}
                  </option>
                ))
              )}
            </select>
          ) : (
            <select
              id="conref-panel-file"
              value={selectedFile}
              onChange={(e) => {
                setSelectedFile(e.target.value);
                setSelectedTarget(null);
              }}
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 font-mono text-[11px] focus:border-teal-500 focus:outline-none"
            >
              {topicIndices.length === 0 ? (
                <option value="">{t('conref.noTopicFiles')}</option>
              ) : (
                topicIndices.map((t) => (
                  <option key={t.filePath} value={t.filePath}>
                    {t.filePath} {t.title ? `— ${t.title}` : ''}
                  </option>
                ))
              )}
            </select>
          )}
          {noKeyBoundTopics ? (
            <p className="mt-1 flex items-start gap-1 text-[10px] leading-snug text-amber-700">
              <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              {t('conref.bindHint')}
            </p>
          ) : null}
        </section>

        {/* 2. Reusable element picker */}
        <section className="flex min-h-24 flex-1 flex-col px-3 py-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <label
              htmlFor="conref-panel-search"
              className="text-[11px] font-semibold text-slate-700"
            >
              {t('conref.step2')}
            </label>
            <span className="shrink-0 font-mono text-[10px] text-slate-400">
              {t('conref.itemCount', { count: candidateElements.length })}
            </span>
          </div>
          <div className="relative mb-1.5">
            <Search
              className="pointer-events-none absolute left-2 top-1.5 h-3 w-3 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="conref-panel-search"
              type="search"
              value={idSearch}
              onChange={(e) => setIdSearch(e.target.value)}
              placeholder={t('conref.searchPlaceholder')}
              className="w-full rounded-md border border-slate-200 py-1 pr-2 pl-7 text-[11px] focus:border-teal-500 focus:outline-none"
            />
          </div>

          <div className="dita-scroller min-h-0 flex-1 overflow-y-auto rounded-md border border-slate-200 divide-y divide-slate-100">
            {candidateElements.length === 0 ? (
              <p className="px-3 py-4 text-center text-[11px] text-slate-400">
                {t('conref.noCandidates')}
              </p>
            ) : (
              candidateElements.map((el) => {
                const isPicked =
                  selectedTarget?.fragment === el.fragment &&
                  selectedTarget.filePath === el.filePath;
                const incompatible = selectedElementTag
                  ? !areConrefTagsCompatible(selectedElementTag, el.tagName)
                  : false;

                const payload = buildPayload(el);

                return (
                  <div
                    key={`${el.filePath}#${el.fragment}`}
                    role="button"
                    tabIndex={0}
                    draggable={payload !== null}
                    aria-pressed={isPicked}
                    title={el.previewText || `${el.tagName} #${el.elementId}`}
                    onClick={() => setSelectedTarget(el)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      setSelectedTarget(el);
                    }}
                    onPointerDown={(event) => {
                      if (!payload) return;
                      drag.startPointerDrag(
                        event,
                        payload,
                        `<${el.tagName}> #${el.elementId}`,
                      );
                    }}
                    onDragStart={(event) => {
                      if (!payload) {
                        event.preventDefault();
                        return;
                      }
                      drag.startNativeDrag(event, payload);
                    }}
                    onDragEnd={drag.endNativeDrag}
                    className={`group flex w-full cursor-grab items-start justify-between gap-2 px-2 py-1.5 text-left transition-colors select-none active:cursor-grabbing ${
                      isPicked ? 'bg-teal-50 text-teal-950' : 'hover:bg-slate-50'
                    } ${drag.nativeDragging && isPicked ? 'opacity-60' : ''}`}
                  >
                    <GripVertical
                      className="mt-0.5 h-3 w-3 shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <code className="shrink-0 rounded bg-slate-200/80 px-1 font-mono text-[10px] font-semibold text-slate-800">
                          &lt;{el.tagName}&gt;
                        </code>
                        <code className="truncate font-mono text-[10.5px] font-semibold text-teal-800">
                          #{el.elementId}
                        </code>
                        {incompatible ? (
                          <span className="shrink-0 rounded bg-amber-100 px-1 text-[9px] text-amber-800">
                            {t('conref.incompatible')}
                          </span>
                        ) : null}
                      </div>
                      {el.previewText ? (
                        <p className="mt-0.5 truncate text-[10px] text-slate-600">
                          {el.previewText}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 font-mono text-[9.5px] text-slate-400">L{el.line}</span>
                  </div>
                );
              })
            )}
          </div>
          <p className="mt-1 shrink-0 text-[10px] leading-snug text-slate-400">
            {t('conref.dragHint')}
          </p>
          {dropNotice ? (
            <p
              role="status"
              className={`mt-1 shrink-0 rounded px-1.5 py-1 text-[10.5px] leading-snug ${
                dropNotice.ok
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'bg-amber-50 text-amber-800'
              }`}
            >
              {t(
                dropNotice.ok ? 'visual.announce.conrefDropped' : 'visual.announce.conrefDropBlocked',
                { tag: dropNotice.tag },
              )}
            </p>
          ) : null}
        </section>

        {/* 3. Computed value, insertion action, live preview */}
        {selectedTarget ? (
          <section className="shrink-0 space-y-1.5 px-3 py-1.5">
            <div className="grid grid-cols-2 gap-1" role="group" aria-label={t('conref.insertModeAria')}>
              {[
                {
                  value: 'insert-new' as const,
                  label: t('conref.insertNew', { tag: selectedTarget.tagName }),
                  disabled: false,
                  hint: t('conref.insertNewHint'),
                },
                {
                  value: 'bind-selected' as const,
                  label: t('conref.bindCurrent', { tag: selectedElementTag ?? t('conref.element') }),
                  disabled: !canBindToSelected,
                  hint: canBindToSelected ? t('conref.bindHintOk') : t('conref.bindHintBad'),
                },
              ].map((option) => {
                const isActive =
                  insertAction === option.value &&
                  (option.value === 'insert-new' || canBindToSelected);
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={isActive}
                    disabled={option.disabled}
                    title={option.hint}
                    onClick={() => setInsertAction(option.value)}
                    className={`truncate rounded-md border px-2 py-1 font-mono text-[10.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                      isActive
                        ? 'border-teal-500 bg-teal-50 text-teal-900'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            {loadingPreview ? (
              <p className="text-[10.5px] text-slate-400">{t('conref.previewLoading')}</p>
            ) : preview ? (
              preview.status === 'resolved' ? (
                <div className="rounded-md border border-emerald-200 bg-emerald-50/50 px-2 py-1">
                  <div className="flex items-center gap-1 text-[10.5px] font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="shrink-0">{t('conref.previewSafe')}</span>
                    <code
                      className="min-w-0 flex-1 truncate font-mono text-[10px] font-normal text-emerald-900"
                      title={`${mode}="${computedAttrValue}"`}
                    >
                      {mode}=&quot;{computedAttrValue}&quot;
                    </code>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[10.5px] leading-snug text-slate-700">
                    {preview.resolvedText || t('conref.emptyContent')}
                  </p>
                </div>
              ) : (
                <div className="rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-[10.5px] text-rose-800">
                  <div className="flex items-center gap-1 font-semibold">
                    <AlertTriangle className="h-3 w-3 shrink-0 text-rose-600" aria-hidden="true" />
                    <span className="line-clamp-2">{preview.errorMessage}</span>
                  </div>
                  {preview.cycleChain ? (
                    <p className="mt-0.5 line-clamp-2 break-all font-mono text-[9.5px] text-rose-700">
                      {preview.cycleChain.join(' → ')}
                    </p>
                  ) : null}
                </div>
              )
            ) : null}
          </section>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t border-slate-200 px-3 py-2">
        <button
          type="button"
          onClick={resetSelection}
          disabled={!selectedTarget}
          className="dita-mini-btn disabled:opacity-40"
          title={t('conref.clearSelection')}
        >
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
          {t('conref.reset')}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitDisabled}
          className="ml-auto inline-flex items-center gap-1 rounded-md bg-teal-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-teal-500 disabled:opacity-45"
        >
          <CopyPlus className="h-3.5 w-3.5" aria-hidden="true" />
          {t('conref.confirm')}
        </button>
      </div>
    </aside>
  );
}
