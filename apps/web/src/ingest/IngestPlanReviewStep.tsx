/**
 * Step 3 — review the plan before the AI agent writes anything.
 *
 * Left: an editable DITA outline (titles, types, paths, keys map, per-topic keep/remove).
 * Right: the parsed Markdown (editable, then re-planned) and the extracted images, so the user
 * can fix a bad conversion instead of fighting the generated topics later.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  EyeOff,
  FileImage,
  FileText,
  Loader2,
  PlayCircle,
  RefreshCw,
  Save,
  Trash2,
  Wand2,
} from 'lucide-react';
import type {
  IngestJobView,
  IngestMarkdownView,
  IngestOutlinePlan,
  IngestReplanOptions,
  IngestTopicTypeChoice,
  PlannedTopicNode,
} from '../services/ingest-api.js';
import { ingestAssetUrl } from '../services/ingest-api.js';
import { useI18n } from '../i18n/index.js';
import { baseName, formatBytes } from './types.js';

export interface IngestPlanReviewStepProps {
  job: IngestJobView;
  markdown: IngestMarkdownView | null;
  markdownLoading: boolean;
  markdownError: string | null;
  busy: boolean;
  error: string | null;
  notice: string | null;
  onReplan: (markdown: string, options: IngestReplanOptions) => void;
  onApprove: (plan: IngestOutlinePlan) => void;
  onBack: () => void;
  onCancelJob: () => void;
}

const TOPIC_TYPES: readonly IngestTopicTypeChoice[] = ['auto', 'concept', 'task', 'reference', 'topic'];
const EDITABLE_TYPES = ['concept', 'task', 'reference', 'topic'] as const;

interface FlatNode {
  node: PlannedTopicNode;
  depth: number;
  key: string;
}

function flatten(nodes: readonly PlannedTopicNode[], depth = 0): FlatNode[] {
  const out: FlatNode[] = [];
  for (const node of nodes) {
    out.push({ node, depth, key: `${node.filePath}#${node.topicId}` });
    if (node.children && node.children.length > 0) out.push(...flatten(node.children, depth + 1));
  }
  return out;
}

function countTopics(nodes: readonly PlannedTopicNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countTopics(node.children ?? []), 0);
}

/** Prunes nodes the reviewer unchecked, then drops empty parents' `children` arrays. */
function pruneTopics(nodes: readonly PlannedTopicNode[], excluded: ReadonlySet<string>): PlannedTopicNode[] {
  const out: PlannedTopicNode[] = [];
  for (const node of nodes) {
    if (excluded.has(`${node.filePath}#${node.topicId}`)) continue;
    const children = node.children ? pruneTopics(node.children, excluded) : undefined;
    out.push(children && children.length > 0 ? { ...node, children } : { ...node, children: undefined });
  }
  return out;
}

/** Immutable patch by topic key (used by the title/type/path inputs). */
function patchTopic(
  nodes: readonly PlannedTopicNode[],
  key: string,
  patch: Partial<PlannedTopicNode>,
): PlannedTopicNode[] {
  return nodes.map((node) => {
    const nodeKey = `${node.filePath}#${node.topicId}`;
    if (nodeKey === key) return { ...node, ...patch };
    if (node.children && node.children.length > 0) {
      return { ...node, children: patchTopic(node.children, key, patch) };
    }
    return node;
  });
}

export function IngestPlanReviewStep({
  job,
  markdown,
  markdownLoading,
  markdownError,
  busy,
  error,
  notice,
  onReplan,
  onApprove,
  onBack,
  onCancelJob,
}: IngestPlanReviewStepProps) {
  const { t } = useI18n();
  const [plan, setPlan] = useState<IngestOutlinePlan | null>(job.plan);
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [instruction, setInstruction] = useState('');
  const [markdownText, setMarkdownText] = useState('');
  const [markdownDirty, setMarkdownDirty] = useState(false);
  const [tab, setTab] = useState<'markdown' | 'assets'>('markdown');
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setPlan(job.plan);
    setExcluded(new Set<string>());
  }, [job.plan]);

  useEffect(() => {
    if (!markdown) return;
    setMarkdownText(markdown.markdown);
    setMarkdownDirty(false);
  }, [markdown]);

  const rows = useMemo(() => (plan ? flatten(plan.topics) : []), [plan]);
  const keptCount = useMemo(() => {
    if (!plan) return 0;
    const pruned = pruneTopics(plan.topics, excluded);
    return countTopics(pruned);
  }, [excluded, plan]);

  if (!plan) {
    return (
      <div className="space-y-3">
        <p className="rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-800">
          {t('ingest.review.noPlan')}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancelJob}
            className="rounded-md border border-rose-200 bg-white px-3 py-1 text-[11px] text-rose-700 hover:bg-rose-50"
          >
            {t('ingest.review.cancelJob')}
          </button>
        </div>
      </div>
    );
  }

  const handleReplan = () => {
    setLocalError(null);
    if (!markdownText.trim()) {
      setLocalError(t('ingest.review.markdownEmpty'));
      return;
    }
    onReplan(markdownText, {
      mapKind: plan.mapKind,
      topicType: plan.topicType,
      ...(plan.language ? { language: plan.language } : {}),
      ...(plan.targetDir ? { targetDir: plan.targetDir } : {}),
      ...(instruction.trim() ? { instruction: instruction.trim() } : {}),
    });
  };

  const handleApprove = () => {
    const topics = pruneTopics(plan.topics, excluded);
    if (countTopics(topics) === 0) {
      setLocalError(t('ingest.result.noTopics'));
      return;
    }
    setLocalError(null);
    onApprove({
      ...plan,
      topics,
      ...(instruction.trim() ? { summary: instruction.trim() } : {}),
    });
  };

  const engineLabel = job.engineUsed
    ? job.engineUsed === 'direct'
      ? t('ingest.review.engineDirect')
      : t('ingest.review.engineUsed', { engine: job.engineUsed })
    : t('common.unknown');

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[11px] font-semibold text-slate-800">{t('ingest.review.title')}</h3>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-medium text-slate-600">
          {engineLabel}
        </span>
        <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[9.5px] font-medium text-blue-700">
          {t('ingest.review.planSummary', { topics: keptCount })}
        </span>
        <span className="ml-auto flex items-center gap-2 text-[9.5px] text-slate-400">
          <FileText className="h-3 w-3" aria-hidden="true" />
          {baseName(job.sourceFilename)}
        </span>
      </div>

      <div className="grid gap-2.5 lg:grid-cols-2">
        <section className="flex min-h-0 flex-col rounded-lg border border-slate-200">
          <div className="shrink-0 border-b border-slate-200 bg-slate-50/70 px-2.5 py-1.5">
            <span className="text-[10.5px] font-semibold text-slate-700">{t('ingest.review.planPane')}</span>
          </div>
          <div className="dita-scroller min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">
            <div className="grid gap-1.5 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="text-[10px] font-medium text-slate-600">{t('ingest.review.manualTitle')}</span>
                <input
                  value={plan.title}
                  onChange={(event) => setPlan({ ...plan, title: event.target.value })}
                  className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                />
              </label>
              <label className="flex items-center gap-1.5 text-[10px] text-slate-600">
                <input
                  type="checkbox"
                  checked={plan.createKeysMap}
                  onChange={(event) => setPlan({ ...plan, createKeysMap: event.target.checked })}
                  className="h-3 w-3"
                />
                {t('ingest.review.createKeysMap')}
              </label>
              <span className="text-[9.5px] text-slate-400">
                {t('ingest.review.suggestedKeys', { count: plan.suggestedKeys.length })}
              </span>
            </div>

            <div className="space-y-1">
              {rows.map((row) => {
                const key = row.key;
                const kept = !excluded.has(key);
                return (
                  <div
                    key={key}
                    style={{ marginLeft: `${row.depth * 12}px` }}
                    className={`rounded border px-1.5 py-1 ${
                      kept ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <label
                        className="flex shrink-0 items-center gap-1"
                        title={kept ? t('ingest.review.topicRemove') : t('ingest.review.topicKeep')}
                      >
                        <input
                          type="checkbox"
                          checked={kept}
                          onChange={(event) => {
                            const next = new Set(excluded);
                            if (event.target.checked) next.delete(key);
                            else next.add(key);
                            setExcluded(next);
                          }}
                          className="h-3 w-3"
                        />
                      </label>
                      <input
                        value={row.node.title}
                        disabled={!kept}
                        onChange={(event) =>
                          setPlan({ ...plan, topics: patchTopic(plan.topics, key, { title: event.target.value }) })
                        }
                        aria-label={t('ingest.review.topicTitle')}
                        className="min-w-0 flex-1 rounded border border-slate-200 px-1.5 py-0.5 text-[10.5px] text-slate-800 outline-none focus:border-blue-400 disabled:bg-slate-50"
                      />
                      <select
                        value={row.node.type}
                        disabled={!kept}
                        onChange={(event) =>
                          setPlan({
                            ...plan,
                            topics: patchTopic(plan.topics, key, {
                              type: event.target.value as (typeof EDITABLE_TYPES)[number],
                            }),
                          })
                        }
                        aria-label={t('ingest.review.topicType')}
                        className="shrink-0 rounded border border-slate-200 bg-white px-1 py-0.5 text-[10px] text-slate-700 outline-none"
                      >
                        {EDITABLE_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {t(`ingest.target.topicType.${type}`)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      value={row.node.filePath}
                      disabled={!kept}
                      onChange={(event) =>
                        setPlan({ ...plan, topics: patchTopic(plan.topics, key, { filePath: event.target.value }) })
                      }
                      aria-label={t('ingest.review.topicPath')}
                      spellCheck={false}
                      className="mt-1 w-full rounded border border-slate-200 px-1.5 py-0.5 font-mono text-[9.5px] text-slate-500 outline-none focus:border-blue-400 disabled:bg-slate-50"
                    />
                  </div>
                );
              })}
            </div>

            <label className="block">
              <span className="text-[10px] font-medium text-slate-600">{t('ingest.review.instruction')}</span>
              <textarea
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                rows={2}
                className="mt-0.5 w-full resize-y rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
              />
            </label>
          </div>
        </section>

        <section className="flex min-h-0 flex-col rounded-lg border border-slate-200">
          <div className="flex shrink-0 items-center gap-1 border-b border-slate-200 bg-slate-50/70 px-2 py-1">
            <button
              type="button"
              onClick={() => setTab('markdown')}
              aria-pressed={tab === 'markdown'}
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                tab === 'markdown' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-white/60'
              }`}
            >
              <FileText className="h-3 w-3" aria-hidden="true" />
              {t('ingest.review.markdownTab')}
            </button>
            <button
              type="button"
              onClick={() => setTab('assets')}
              aria-pressed={tab === 'assets'}
              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                tab === 'assets' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-600 hover:bg-white/60'
              }`}
            >
              <FileImage className="h-3 w-3" aria-hidden="true" />
              {t('ingest.review.assetsTab')}
              <span className="rounded bg-slate-200 px-1 text-[9px] text-slate-600">{job.assets.length}</span>
            </button>
          </div>

          <div className="dita-scroller min-h-0 flex-1 overflow-y-auto p-2.5">
            {tab === 'markdown' ? (
              <div className="flex h-full flex-col gap-1.5">
                {markdownLoading ? (
                  <p className="flex items-center gap-1.5 text-[10.5px] text-slate-500">
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    {t('common.loading')}
                  </p>
                ) : null}
                <textarea
                  value={markdownText}
                  onChange={(event) => {
                    setMarkdownText(event.target.value);
                    setMarkdownDirty(true);
                  }}
                  spellCheck={false}
                  rows={16}
                  aria-label={t('ingest.review.markdownTab')}
                  className="min-h-[220px] w-full flex-1 resize-y rounded-md border border-slate-300 px-2 py-1 font-mono text-[10.5px] leading-relaxed text-slate-700 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busy || !markdownDirty}
                    onClick={handleReplan}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[10.5px] text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {busy ? (
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                    ) : (
                      <RefreshCw className="h-3 w-3" aria-hidden="true" />
                    )}
                    {busy ? t('ingest.review.replanning') : t('ingest.review.saveAndReplan')}
                  </button>
                  <span className="text-[9.5px] text-slate-400">
                    {markdown?.sections.length ?? 0} sections
                  </span>
                </div>
                {markdownError ? (
                  <p className="flex items-start gap-1.5 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] text-rose-800">
                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                    {markdownError}
                  </p>
                ) : null}
              </div>
            ) : job.assets.length === 0 ? (
              <p className="text-[10.5px] text-slate-500">{t('ingest.review.noAssets')}</p>
            ) : (
              <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {job.assets.map((asset) => (
                  <li key={asset.assetId} className="rounded border border-slate-200 bg-white p-1">
                    <img
                      src={ingestAssetUrl(job.id, asset.assetId)}
                      alt={asset.fileName}
                      loading="lazy"
                      className="h-20 w-full rounded bg-slate-50 object-contain"
                    />
                    <p className="mt-1 truncate font-mono text-[9px] text-slate-500" title={asset.fileName}>
                      {asset.fileName}
                    </p>
                    <p className="text-[9px] text-slate-400">
                      {t('ingest.review.assetMeta', {
                        name: asset.extension.toUpperCase(),
                        size: formatBytes(asset.byteLength),
                      })}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {notice ? (
        <p className="flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10.5px] text-emerald-800">
          <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
          {notice}
        </p>
      ) : null}
      {localError ?? error ? (
        <p className="flex items-start gap-1.5 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[10.5px] text-rose-800">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          {localError ?? error}
        </p>
      ) : null}

      <div className="sticky bottom-0 -mx-4 flex items-center gap-2 border-t border-slate-200 bg-white px-4 py-2">
        <button
          type="button"
          onClick={onCancelJob}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2.5 py-1 text-[11px] text-rose-700 hover:bg-rose-50 disabled:opacity-40"
        >
          <Trash2 className="h-3 w-3" aria-hidden="true" />
          {t('ingest.review.cancelJob')}
        </button>
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          <EyeOff className="h-3 w-3" aria-hidden="true" />
          {t('ingest.review.back')}
        </button>
        <button
          type="button"
          onClick={handleApprove}
          disabled={busy}
          className="ml-auto inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <Wand2 className="h-3 w-3" aria-hidden="true" />
          )}
          {busy ? t('ingest.review.approving') : t('ingest.review.approve')}
        </button>
      </div>
    </div>
  );
}
