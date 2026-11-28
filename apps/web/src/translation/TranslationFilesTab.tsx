import {
  AlertCircle,
  Check,
  FileCode2,
  HelpCircle,
  Image as ImageGlyph,
  Loader2,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useI18n, type MessageKey } from '../i18n/index.js';
import type {
  TranslationFileStateView,
  TranslationLinkView,
} from '../services/translation-api.js';
import { useGitStore } from '../store/git-store';
import { useTranslationStore } from '../store/translation-store';
import { TranslationPipelineBar } from './TranslationPipelineBar.js';
import { TranslationScenarioBanner } from './TranslationScenarioBanner.js';
import {
  classifyWorkspaceScope,
  computeScopeCounts,
  computeStageCounts,
  deriveRecommendedScenario,
  firstActiveItemId,
  getBatchCapabilities,
  getRowCapabilities,
  isForeignDraft,
  isSvgAssetPath,
  stageOfFile,
  type PipelineStage,
  type RowActionId,
  type WorkspaceScope,
} from './translation-workflow.js';

const OFFLINE = import.meta.env.VITE_STATIC_DEMO === 'true';

const SCOPE_ORDER: readonly WorkspaceScope[] = ['docs', 'assets', 'structure'];

const SCOPE_LABEL: Record<WorkspaceScope, MessageKey> = {
  docs: 'translation.scope.docs',
  assets: 'translation.scope.assets',
  structure: 'translation.scope.structure',
};

const KIND_LABEL: Record<TranslationFileStateView['fileKind'], MessageKey> = {
  topic: 'translation.fileKind.topic',
  map: 'translation.fileKind.map',
  keydef_map: 'translation.fileKind.keydef_map',
  ditaval: 'translation.fileKind.ditaval',
  asset: 'translation.fileKind.asset',
};

const STATUS_LABEL: Record<TranslationFileStateView['status'], MessageKey> = {
  untranslated: 'translation.fileStatus.untranslated',
  outdated: 'translation.fileStatus.outdated',
  outdated_metadata_only: 'translation.fileStatus.outdated_metadata_only',
  synced: 'translation.fileStatus.synced',
  in_queue: 'translation.fileStatus.in_queue',
  in_review: 'translation.fileStatus.in_review',
  draft_ready: 'translation.fileStatus.draft_ready',
  source_deleted: 'translation.fileStatus.source_deleted',
  source_renamed: 'translation.fileStatus.source_renamed',
};

const STATUS_TONE: Record<TranslationFileStateView['status'], string> = {
  synced: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  outdated: 'border-amber-200 bg-amber-50 text-amber-700',
  untranslated: 'border-slate-200 bg-slate-50 text-slate-600',
  outdated_metadata_only: 'border-amber-200 bg-amber-50 text-amber-700',
  in_queue: 'border-blue-200 bg-blue-50 text-blue-700',
  in_review: 'border-violet-200 bg-violet-50 text-violet-700',
  draft_ready: 'border-teal-200 bg-teal-50 text-teal-700',
  source_deleted: 'border-rose-200 bg-rose-50 text-rose-700',
  source_renamed: 'border-indigo-200 bg-indigo-50 text-indigo-700',
};

/** Plain-language meaning of every status, used as the badge tooltip and the legend body. */
const STATUS_DESC: Record<TranslationFileStateView['status'], MessageKey> = {
  untranslated: 'translation.statusDesc.untranslated',
  outdated: 'translation.statusDesc.outdated',
  outdated_metadata_only: 'translation.statusDesc.outdated_metadata_only',
  synced: 'translation.statusDesc.synced',
  in_queue: 'translation.statusDesc.in_queue',
  in_review: 'translation.statusDesc.in_review',
  draft_ready: 'translation.statusDesc.draft_ready',
  source_deleted: 'translation.statusDesc.source_deleted',
  source_renamed: 'translation.statusDesc.source_renamed',
};

/** The five pipeline stages, so the legend reads like the lifecycle instead of a status dump. */
const STATUS_LEGEND_GROUPS: readonly {
  label: MessageKey;
  statuses: readonly TranslationFileStateView['status'][];
}[] = [
  {
    label: 'translation.statusLegend.group.todo',
    statuses: [
      'untranslated',
      'outdated',
      'outdated_metadata_only',
      'source_renamed',
      'source_deleted',
    ],
  },
  { label: 'translation.statusLegend.group.translating', statuses: ['in_queue'] },
  { label: 'translation.statusLegend.group.review', statuses: ['in_review'] },
  { label: 'translation.statusLegend.group.checkin', statuses: ['draft_ready'] },
  { label: 'translation.statusLegend.group.synced', statuses: ['synced'] },
];

const HINT_LABEL: Record<string, MessageKey> = {
  keydef_map: 'translation.row.hint.keydef_map',
  map: 'translation.row.hint.map',
  svg: 'translation.row.hint.svg',
  asset_override: 'translation.row.hint.asset_override',
  metadata_only: 'translation.row.hint.metadata_only',
  renamed: 'translation.row.hint.renamed',
  deleted: 'translation.row.hint.deleted',
};

const ROW_ACTION: Record<RowActionId, { label: MessageKey; tone: 'primary' | 'quiet' | 'danger' }> = {
  ai_translate: { label: 'translation.row.aiTranslate', tone: 'primary' },
  retranslate: { label: 'translation.row.retranslate', tone: 'quiet' },
  open_queue: { label: 'translation.row.openQueue', tone: 'primary' },
  open_review: { label: 'translation.files.openReview', tone: 'primary' },
  apply_draft: { label: 'translation.row.applyDraft', tone: 'quiet' },
  checkin: { label: 'translation.row.checkin', tone: 'primary' },
  mark_synced: { label: 'translation.row.markSynced', tone: 'quiet' },
  sync_asset: { label: 'translation.row.syncAsset', tone: 'primary' },
  keep_local_version: { label: 'translation.row.keepLocal', tone: 'primary' },
  override_with_source: { label: 'translation.row.overrideSource', tone: 'quiet' },
  sync_passthrough: { label: 'translation.row.syncPassthrough', tone: 'primary' },
  stage_delete: { label: 'translation.row.stageDelete', tone: 'danger' },
  keep_target: { label: 'translation.row.keepTarget', tone: 'primary' },
  open_target_editor: { label: 'translation.row.openTarget', tone: 'quiet' },
};

const ROW_BUTTON_TONE = {
  primary:
    'border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100 focus-visible:outline-blue-600',
  quiet:
    'border-transparent bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-blue-600',
  danger:
    'border-rose-200 bg-white text-rose-700 hover:border-rose-300 hover:bg-rose-50 focus-visible:outline-rose-600',
} as const;

const BATCH_BUTTON =
  'inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50';
const BATCH_PRIMARY =
  'inline-flex items-center gap-1 rounded-md border border-blue-600 bg-blue-600 px-2 py-1 text-[11px] font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50';
const BATCH_DANGER =
  'inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-1 text-[11px] font-medium text-rose-700 transition-colors hover:border-rose-300 hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600';

type CheckinMode = 'checkin' | 'apply' | 'sync';

interface CheckinRequest {
  mode: CheckinMode;
  paths: string[];
}

interface Feedback {
  tone: 'ok' | 'error';
  text: string;
}

export interface TranslationFilesTabProps {
  link: TranslationLinkView;
  onOpenReview: (itemId: string) => void;
  onOpenQueue: () => void;
  onOpenTargetEditor: () => void;
}

/**
 * Phase 16 — scenario-driven Files tab.
 *
 * The old tab was a filterable state dump. It now answers three questions in order: what is the
 * single next step (banner), which slice of the work am I looking at (scope tabs + pipeline), and
 * what may I legally do with the rows I selected (capability-driven batch bar). All legality lives
 * in `translation-workflow.ts`; this file only renders it and wires the REST calls.
 */
export function TranslationFilesTab({
  link,
  onOpenReview,
  onOpenQueue,
  onOpenTargetEditor,
}: TranslationFilesTabProps) {
  const { t } = useI18n();
  const files = useTranslationStore((state) => state.files);
  const filesLoading = useTranslationStore((state) => state.filesLoading);
  const filesError = useTranslationStore((state) => state.filesError);
  const scanning = useTranslationStore((state) => state.scanning);
  const syncBusy = useTranslationStore((state) => state.syncBusy);
  const actionError = useTranslationStore((state) => state.actionError);
  const jobs = useTranslationStore((state) => state.jobs);
  const store = useTranslationStore.getState;
  const currentUser = useGitStore((state) => state.currentUser);

  const [scope, setScope] = useState<WorkspaceScope>('docs');
  const [stage, setStage] = useState<PipelineStage>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [checkinRequest, setCheckinRequest] = useState<CheckinRequest | null>(null);
  const [checkinMessage, setCheckinMessage] = useState('');
  const [checkinMissing, setCheckinMissing] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loadedLinkId, setLoadedLinkId] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const legendRef = useRef<HTMLDivElement | null>(null);
  const autoScanned = useRef<Set<string>>(new Set());
  const subscribedJob = useRef<string | null>(null);

  const canEdit = !currentUser || currentUser.role !== 'viewer';

  // Transient legend: an outside pointer or Escape closes it, so it never covers the row actions.
  useEffect(() => {
    if (!legendOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!legendRef.current?.contains(event.target as Node)) setLegendOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLegendOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [legendOpen]);

  /* ------------------------------------------------------------ loading */

  // The whole matrix is loaded once per pair and filtered client-side: instant tab switches and
  // badge counts that already agree with the table.
  useEffect(() => {
    let cancelled = false;
    setLoadedLinkId(null);
    void store()
      .loadFiles(link.id)
      .finally(() => {
        if (!cancelled) setLoadedLinkId(link.id);
      });
    return () => {
      cancelled = true;
    };
  }, [link.id, store]);

  useEffect(() => {
    void store().loadJobs({ linkId: link.id });
  }, [link.id, store]);

  const liveJob = useMemo(
    () =>
      jobs.find(
        (job) =>
          job.linkId === link.id && (job.status === 'queued' || job.status === 'running'),
      ) ?? null,
    [jobs, link.id],
  );

  // Watch the running job from *this* tab so the inline progress bar updates without navigating.
  // One subscription per job id: the store stream is shared, so re-subscribing on every render
  // would reconnect after a completed stream and spin.
  useEffect(() => {
    if (!liveJob) return;
    if (subscribedJob.current === liveJob.id) return;
    subscribedJob.current = liveJob.id;
    store().subscribeJob(liveJob.id);
  }, [liveJob, store]);

  const runScan = useCallback(async () => {
    setFeedback(null);
    const result = await store().scanLink(link.id);
    if (!result) return;
    const { created, updated, removed, renames } = result.summary;
    setFeedback({
      tone: 'ok',
      text: t('translation.scenario.scanSummary', { created, updated, removed, renames }),
    });
  }, [link.id, store, t]);

  // First visit on an unscanned pair self-heals instead of showing an empty table with a button.
  useEffect(() => {
    if (OFFLINE || !canEdit) return;
    if (loadedLinkId !== link.id) return;
    if (filesLoading || scanning || files.length > 0) return;
    if (autoScanned.current.has(link.id)) return;
    autoScanned.current.add(link.id);
    void runScan();
  }, [canEdit, files.length, filesLoading, link.id, loadedLinkId, runScan, scanning]);

  /* ----------------------------------------------------------- handlers */

  const finish = (text: string) => setFeedback({ tone: 'ok', text });

  const enqueueJob = async (paths: string[], mode: 'incremental' | 'full') => {
    setFeedback(null);
    const snapshot = await store().enqueue({ linkId: link.id, paths, mode });
    if (snapshot) finish(t('translation.files.enqueued', { count: paths.length }));
  };

  const applyDrafts = async (paths: string[]) => {
    setFeedback(null);
    const result = await store().batchApplyDrafts(link.id, { paths });
    if (!result) return;
    if (result.applied.length > 0) {
      finish(
        t('translation.files.batchApplyDone', {
          applied: result.applied.length,
          locked: result.skippedLocked.length,
          skipped: result.skippedInvalid.length + result.skippedNoProposal.length,
        }),
      );
    } else {
      finish(
        t('translation.files.batchApplyEmpty', {
          locked: result.skippedLocked.length,
          skipped: result.skippedInvalid.length + result.skippedNoProposal.length,
        }),
      );
    }
  };

  const runSyncAssets = async (paths: string[], force: boolean) => {
    setFeedback(null);
    const result = await store().syncAssets(link.id, paths, force ? { force: true } : {});
    if (!result) return;
    finish(
      t('translation.files.syncDone', {
        synced: result.synced.length,
        locked: result.skippedLocked.length,
        override: result.skippedOverride.length,
      }),
    );
  };

  const runSyncPassthrough = async (paths: string[]) => {
    setFeedback(null);
    const result = await store().syncPassthrough(link.id, paths);
    if (!result) return;
    finish(
      t('translation.batch.passthroughDone', {
        synced: result.synced.length,
        locked: result.skippedLocked.length,
      }),
    );
  };

  const runMarkSynced = async (paths: string[]) => {
    setFeedback(null);
    const result = await store().markSynced(link.id, paths);
    if (!result) return;
    finish(t('translation.files.markedDone', { count: result.marked.length }));
  };

  const runResolveDeleted = async (paths: string[], action: 'stage_delete' | 'keep_target') => {
    setFeedback(null);
    const result = await store().resolveDeleted(link.id, { paths, action });
    if (!result) return;
    finish(
      t('translation.batch.deleteDone', {
        staged: result.staged.length,
        dismissed: result.dismissed.length,
      }),
    );
  };

  const requestCheckin = (paths: string[], mode: CheckinMode) => {
    if (paths.length === 0) return;
    setCheckinMissing(false);
    setCheckinMessage(
      t('translation.batch.defaultMessage', {
        count: paths.length,
        date: new Date().toISOString().slice(0, 10),
      }),
    );
    setCheckinRequest({ mode, paths });
  };

  const confirmCheckin = async () => {
    if (!checkinRequest) return;
    const message = checkinMessage.trim();
    if (!message) {
      setCheckinMissing(true);
      return;
    }
    const { mode, paths } = checkinRequest;
    setCheckinRequest(null);
    setCheckinMissing(false);
    setFeedback(null);

    // Check-in only commits files that exist in the caller's draft overlay, and `paths` holds
    // *source* paths. Apply/sync therefore have to hand over the target paths they actually wrote
    // (a locked or skipped file has no draft, so passing the selection would fail the whole run).
    let checkinPaths = paths;
    let appliedCount = 0;
    let syncedCount = 0;

    if (mode === 'apply') {
      const applied = await store().batchApplyDrafts(link.id, { paths });
      if (!applied) return;
      if (applied.applied.length === 0) {
        finish(
          t('translation.files.batchApplyEmpty', {
            locked: applied.skippedLocked.length,
            skipped: applied.skippedInvalid.length + applied.skippedNoProposal.length,
          }),
        );
        return;
      }
      appliedCount = applied.applied.length;
      checkinPaths = applied.applied.map((entry) => entry.targetPath);
    } else if (mode === 'sync') {
      const synced = await store().syncAssets(link.id, paths);
      if (!synced) return;
      if (synced.synced.length === 0) {
        finish(
          t('translation.files.syncDone', {
            synced: 0,
            locked: synced.skippedLocked.length,
            override: synced.skippedOverride.length,
          }),
        );
        return;
      }
      syncedCount = synced.synced.length;
      checkinPaths = synced.synced;
    }

    const result = await store().batchCheckin(link.id, { paths: checkinPaths, message });
    if (!result) return;
    // Every selected draft already matched the target baseline, so no commit was created. The
    // server closed those drafts as `synced`; saying "checked in" without a hash would be a lie.
    if (!result.commit) {
      finish(
        t('translation.files.alreadySynced', {
          count: (result.alreadySyncedPaths ?? result.syncedFiles).length,
        }),
      );
      return;
    }
    if (mode === 'apply') {
      finish(
        t('translation.batch.applyCheckinDone', {
          applied: appliedCount,
          hash: result.commit.shortHash,
        }),
      );
      return;
    }
    if (mode === 'sync') {
      finish(
        t('translation.batch.syncCheckinDone', {
          synced: syncedCount,
          hash: result.commit.shortHash,
        }),
      );
      return;
    }
    finish(
      t('translation.files.checkinDone', {
        count: result.checkedInPaths.length,
        hash: result.commit.shortHash,
      }),
    );
  };

  const runRowAction = (file: TranslationFileStateView, action: RowActionId) => {
    switch (action) {
      case 'ai_translate':
        void enqueueJob([file.sourcePath], 'incremental');
        return;
      case 'retranslate':
        void enqueueJob([file.sourcePath], 'full');
        return;
      case 'open_queue':
        onOpenQueue();
        return;
      case 'open_review':
        if (file.activeItem) onOpenReview(file.activeItem.id);
        return;
      case 'apply_draft':
        void applyDrafts([file.sourcePath]);
        return;
      case 'checkin':
        requestCheckin([file.sourcePath], 'checkin');
        return;
      case 'mark_synced':
        void runMarkSynced([file.sourcePath]);
        return;
      case 'sync_asset':
        void runSyncAssets([file.sourcePath], false);
        return;
      case 'override_with_source':
        void runSyncAssets([file.sourcePath], true);
        return;
      case 'keep_local_version':
        void runMarkSynced([file.sourcePath]);
        return;
      case 'sync_passthrough':
        void runSyncPassthrough([file.sourcePath]);
        return;
      case 'stage_delete':
        if (window.confirm(t('translation.batch.deleteConfirm', { count: 1 }))) {
          void runResolveDeleted([file.sourcePath], 'stage_delete');
        }
        return;
      case 'keep_target':
        void runResolveDeleted([file.sourcePath], 'keep_target');
        return;
      case 'open_target_editor':
        onOpenTargetEditor();
        return;
    }
  };

  /* ------------------------------------------------------------- derived */

  const scopeCounts = useMemo(() => computeScopeCounts(files), [files]);
  const stageCounts = useMemo(() => computeStageCounts(files, scope), [files, scope]);
  const scenario = useMemo(() => deriveRecommendedScenario(files, liveJob), [files, liveJob]);
  const selectedFiles = useMemo(
    () => files.filter((file) => selected.has(file.sourcePath)),
    [files, selected],
  );
  const batch = useMemo(() => getBatchCapabilities(selectedFiles), [selectedFiles]);

  const visibleFiles = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return files.filter((file) => {
      if (classifyWorkspaceScope(file) !== scope) return false;
      if (stage !== 'all' && stageOfFile(file) !== stage) return false;
      if (!needle) return true;
      return (
        file.sourcePath.toLowerCase().includes(needle) ||
        file.targetPath.toLowerCase().includes(needle)
      );
    });
  }, [files, scope, search, stage]);

  const selectablePaths = visibleFiles
    .map((file) => file.sourcePath)
    .filter((path) => !selected.has(path));
  const allSelected = visibleFiles.length > 0 && selectablePaths.length === 0;

  const togglePath = (path: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  /* The scenario CTA maps onto the same handlers the batch bar uses, so there is exactly one
     implementation per wire call. */
  const runScenarioPrimary = () => {
    switch (scenario.id) {
      case 'running_job':
        onOpenQueue();
        return;
      case 'draft_ready': {
        // A draft owned by someone else can never be checked in by this user: previewing the
        // target editor is the only honest primary action left.
        const paths = files
          .filter((file) => file.status === 'draft_ready' && !isForeignDraft(file))
          .map((file) => file.sourcePath);
        if (scenario.foreignOnly || paths.length === 0) {
          onOpenTargetEditor();
          return;
        }
        requestCheckin(paths, 'checkin');
        return;
      }
      case 'in_review':
        if (scenario.itemId) onOpenReview(scenario.itemId);
        else onOpenQueue();
        return;
      case 'first_translation':
      case 'source_updated': {
        const paths = files
          .filter((file) => classifyWorkspaceScope(file) === 'docs' && stageOfFile(file) === 'todo')
          .map((file) => file.sourcePath);
        void enqueueJob(paths, 'incremental');
        return;
      }
      case 'assets_or_structure':
        setScope(scenario.scope ?? 'assets');
        setStage('todo');
        return;
      case 'all_synced':
        onOpenTargetEditor();
        return;
      case 'empty':
        void runScan();
        return;
    }
  };

  const runScenarioSecondary = () => {
    if (scenario.id === 'draft_ready') {
      onOpenTargetEditor();
      return;
    }
    if (scenario.id === 'in_review') {
      setScope('docs');
      setStage('review');
    }
  };

  const guidance =
    scope === 'assets'
      ? t('translation.scope.guidance.assets')
      : scope === 'structure'
        ? t('translation.scope.guidance.structure')
        : null;

  const progressPercent = link.counts.progressPercent;
  const busy = syncBusy || filesLoading;

  /* -------------------------------------------------------------- render */

  return (
    <section data-testid="translation-files-tab" className="space-y-2.5">
      <TranslationScenarioBanner
        scenario={scenario}
        files={files}
        progressPercent={progressPercent}
        scanning={scanning}
        busy={busy}
        canEdit={canEdit}
        onPrimary={runScenarioPrimary}
        onSecondary={runScenarioSecondary}
        onScan={() => void runScan()}
      />

      {feedback ? (
        <p
          className={`flex items-start gap-1 rounded-md border px-2.5 py-1.5 text-[11px] ${
            feedback.tone === 'ok'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {feedback.tone === 'ok' ? (
            <Check className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          ) : (
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          )}
          <span className="min-w-0">{feedback.text}</span>
        </p>
      ) : null}

      {actionError ? (
        <p className="flex items-start gap-1 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          {t('translation.error', { message: actionError })}
        </p>
      ) : null}

      {filesError ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] text-rose-700">
          {t('translation.error.loadFailed', { message: filesError })}
        </p>
      ) : null}

      <div
        role="tablist"
        aria-label={t('translation.scope.aria')}
        className="flex flex-wrap items-center gap-1 border-b border-slate-200"
      >
        {SCOPE_ORDER.map((entry) => {
          const active = scope === entry;
          return (
            <button
              key={entry}
              type="button"
              role="tab"
              aria-selected={active}
              aria-pressed={active}
              data-testid={`translation-files-scope-${entry}`}
              onClick={() => setScope(entry)}
              className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-2.5 py-1.5 text-[11.5px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                active
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t(SCOPE_LABEL[entry])}
              <span
                className={`rounded px-1 text-[10px] font-semibold tabular-nums ${
                  active ? 'bg-blue-50 text-blue-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {scopeCounts[entry]}
              </span>
            </button>
          );
        })}
        <div className="relative ml-auto pb-1">
          <Search
            className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('translation.scope.searchPlaceholder')}
            aria-label={t('translation.scope.searchAria')}
            className="h-6 w-52 rounded-md border border-slate-200 bg-white pl-6 pr-2 text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
          />
        </div>
      </div>

      {guidance ? (
        <p
          data-testid="translation-scope-guidance"
          className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-slate-600"
        >
          {guidance}
        </p>
      ) : null}

      <TranslationPipelineBar counts={stageCounts} stage={stage} onChange={setStage} />

      {selectedFiles.length > 0 ? (
        <div
          data-testid="translation-files-batch-bar"
          className="flex flex-wrap items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50/60 px-2.5 py-1.5"
        >
          <span className="text-[11px] font-semibold text-blue-900">
            {t('translation.files.selected', { count: selectedFiles.length })}
          </span>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="inline-flex items-center gap-0.5 text-[10.5px] font-medium text-slate-500 hover:text-blue-700"
          >
            <X className="h-3 w-3" aria-hidden="true" />
            {t('translation.files.clearSelection')}
          </button>
          <span className="mx-0.5 h-3.5 w-px bg-blue-200" aria-hidden="true" />

          {batch.translatablePaths.length > 0 ? (
            <>
              <button
                type="button"
                disabled={!canEdit || busy}
                onClick={() => void enqueueJob(batch.translatablePaths, 'incremental')}
                className={BATCH_PRIMARY}
              >
                {t('translation.batch.translate', { count: batch.translatablePaths.length })}
              </button>
              <button
                type="button"
                disabled={!canEdit || busy}
                onClick={() => void enqueueJob(batch.translatablePaths, 'full')}
                className={BATCH_BUTTON}
              >
                {t('translation.batch.translateFull', { count: batch.translatablePaths.length })}
              </button>
            </>
          ) : null}

          {batch.reviewablePaths.length > 0 ? (
            <button
              type="button"
              disabled={!canEdit || busy}
              onClick={() => {
                const itemId = firstActiveItemId(selectedFiles, batch.reviewablePaths);
                if (itemId) onOpenReview(itemId);
              }}
              className={BATCH_BUTTON}
            >
              {t('translation.batch.review', { count: batch.reviewablePaths.length })}
            </button>
          ) : null}

          {batch.applicablePaths.length > 0 ? (
            <button
              type="button"
              data-testid="translation-files-batch-apply"
              disabled={!canEdit || busy}
              onClick={() => void applyDrafts(batch.applicablePaths)}
              className={BATCH_BUTTON}
            >
              {t('translation.files.batchApplyDraft')}
            </button>
          ) : null}

          {batch.draftReadyPaths.length > 0 ? (
            <button
              type="button"
              data-testid="translation-batch-checkin"
              disabled={!canEdit || busy}
              onClick={() => requestCheckin(batch.draftReadyPaths, 'checkin')}
              className={BATCH_PRIMARY}
            >
              {t('translation.batch.checkin', { count: batch.draftReadyPaths.length })}
            </button>
          ) : null}

          {batch.syncableAssetPaths.length > 0 ? (
            <button
              type="button"
              disabled={!canEdit || busy}
              onClick={() => void runSyncAssets(batch.syncableAssetPaths, false)}
              className={BATCH_PRIMARY}
            >
              {t('translation.batch.reuseSource', { count: batch.syncableAssetPaths.length })}
            </button>
          ) : null}

          {batch.keepLocalPaths.length > 0 ? (
            <button
              type="button"
              disabled={!canEdit || busy}
              onClick={() => void runMarkSynced(batch.keepLocalPaths)}
              className={BATCH_BUTTON}
            >
              {t('translation.batch.keepLocal', { count: batch.keepLocalPaths.length })}
            </button>
          ) : null}

          {batch.syncableDitavalPaths.length > 0 ? (
            <button
              type="button"
              disabled={!canEdit || busy}
              onClick={() => void runSyncPassthrough(batch.syncableDitavalPaths)}
              className={BATCH_PRIMARY}
            >
              {t('translation.batch.syncConfig', { count: batch.syncableDitavalPaths.length })}
            </button>
          ) : null}

          {batch.metadataOnlyPaths.length > 0 ? (
            <button
              type="button"
              disabled={!canEdit || busy}
              onClick={() => void runMarkSynced(batch.metadataOnlyPaths)}
              className={BATCH_BUTTON}
            >
              {t('translation.batch.confirmSynced', { count: batch.metadataOnlyPaths.length })}
            </button>
          ) : null}

          {batch.deletedPaths.length > 0 ? (
            <>
              <button
                type="button"
                disabled={!canEdit || busy}
                onClick={() => {
                  if (
                    window.confirm(
                      t('translation.batch.deleteConfirm', { count: batch.deletedPaths.length }),
                    )
                  ) {
                    void runResolveDeleted(batch.deletedPaths, 'stage_delete');
                  }
                }}
                className={BATCH_DANGER}
              >
                <Trash2 className="h-3 w-3" aria-hidden="true" />
                {t('translation.batch.stageDelete', { count: batch.deletedPaths.length })}
              </button>
              <button
                type="button"
                disabled={!canEdit || busy}
                onClick={() => void runResolveDeleted(batch.deletedPaths, 'keep_target')}
                className={BATCH_BUTTON}
              >
                {t('translation.batch.keepTarget', { count: batch.deletedPaths.length })}
              </button>
            </>
          ) : null}

          <span className="mx-0.5 h-3.5 w-px bg-blue-200" aria-hidden="true" />

          {batch.applicablePaths.length > 0 ? (
            <button
              type="button"
              disabled={!canEdit || busy}
              data-testid="translation-batch-apply-and-checkin"
              onClick={() => requestCheckin(batch.applicablePaths, 'apply')}
              className={BATCH_PRIMARY}
            >
              {t('translation.batch.applyAndCheckin', { count: batch.applicablePaths.length })}
            </button>
          ) : null}

          {batch.syncableAssetPaths.length + batch.syncableDitavalPaths.length > 0 ? (
            <button
              type="button"
              disabled={!canEdit || busy}
              data-testid="translation-batch-sync-and-checkin"
              onClick={() =>
                requestCheckin(
                  [...batch.syncableAssetPaths, ...batch.syncableDitavalPaths],
                  'sync',
                )
              }
              className={BATCH_PRIMARY}
            >
              {t('translation.batch.syncAndCheckin', {
                count: batch.syncableAssetPaths.length + batch.syncableDitavalPaths.length,
              })}
            </button>
          ) : null}

          {batch.foreignDraftReadyPaths.length > 0 ? (
            <span
              data-testid="translation-batch-foreign-drafts"
              className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10.5px] font-medium text-amber-800"
            >
              <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
              {t('translation.batch.foreignDraftsHint', {
                count: batch.foreignDraftReadyPaths.length,
                owners: batch.foreignDraftOwners.join(', '),
              })}
            </span>
          ) : null}

          {batch.translatablePaths.length === 0 &&
          batch.reviewablePaths.length === 0 &&
          batch.applicablePaths.length === 0 &&
          batch.draftReadyPaths.length === 0 &&
          batch.foreignDraftReadyPaths.length === 0 &&
          batch.syncableAssetPaths.length === 0 &&
          batch.keepLocalPaths.length === 0 &&
          batch.syncableDitavalPaths.length === 0 &&
          batch.metadataOnlyPaths.length === 0 &&
          batch.deletedPaths.length === 0 ? (
            <span className="text-[10.5px] text-slate-500">{t('translation.batch.noLegal')}</span>
          ) : null}
        </div>
      ) : null}

      {checkinRequest ? (
        <form
          data-testid="translation-files-checkin-form"
          onSubmit={(event) => {
            event.preventDefault();
            void confirmCheckin();
          }}
          className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
        >
          <label className="text-[11px] font-medium text-slate-700" htmlFor="translation-checkin-message">
            {t('translation.batch.checkinMessage')}
          </label>
          <input
            id="translation-checkin-message"
            value={checkinMessage}
            onChange={(event) => {
              setCheckinMessage(event.target.value);
              setCheckinMissing(false);
            }}
            placeholder={t('translation.batch.checkinPlaceholder')}
            aria-invalid={checkinMissing}
            className="h-6 min-w-[16rem] flex-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] text-slate-700 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
          />
          <button type="submit" disabled={!canEdit || busy} className={BATCH_PRIMARY}>
            {t('translation.batch.checkinConfirm')}
          </button>
          <button
            type="button"
            onClick={() => {
              setCheckinRequest(null);
              setCheckinMissing(false);
            }}
            className={BATCH_BUTTON}
          >
            {t('translation.batch.checkinCancel')}
          </button>
          {checkinMissing ? (
            <span className="text-[10.5px] text-rose-600">
              {t('translation.batch.checkinRequired')}
            </span>
          ) : null}
        </form>
      ) : null}

      <div className="dita-scroller rounded-lg border border-slate-200 bg-white">
        <table className="w-full table-fixed border-collapse text-[11.5px]">
          <colgroup>
            <col className="w-7" />
            <col />
            <col className="w-24" />
            <col className="w-44" />
            <col className="w-64" />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200 text-left text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-1.5 py-1.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => {
                    setSelected((current) => {
                      const next = new Set(current);
                      if (allSelected) visibleFiles.forEach((file) => next.delete(file.sourcePath));
                      else selectablePaths.forEach((path) => next.add(path));
                      return next;
                    });
                  }}
                  aria-label={t('translation.files.selectAll')}
                  className="h-3 w-3 rounded border-slate-300 text-blue-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
                />
              </th>
              <th scope="col" className="px-1.5 py-1.5 font-semibold">
                {t('translation.files.colPath')}
              </th>
              <th scope="col" className="px-1.5 py-1.5 font-semibold">
                {t('translation.files.colKind')}
              </th>
              <th scope="col" className="px-1.5 py-1.5 font-semibold">
                <div ref={legendRef} className="relative flex items-center gap-1">
                  {t('translation.files.colStatus')}
                  <button
                    type="button"
                    data-testid="translation-status-legend-button"
                    onClick={() => setLegendOpen((open) => !open)}
                    aria-expanded={legendOpen}
                    aria-label={t('translation.statusLegend.buttonAria')}
                    title={t('translation.statusLegend.buttonAria')}
                    className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-slate-400 transition-colors hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
                  >
                    <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  {legendOpen ? (
                    <div
                      data-testid="translation-status-legend"
                      className="absolute left-0 top-full z-30 mt-1 w-72 max-w-[18rem] rounded-lg border border-slate-200 bg-white p-2 text-left font-normal normal-case tracking-normal text-slate-600 shadow-lg"
                    >
                      <p className="mb-1 text-[11px] font-semibold text-slate-900">
                        {t('translation.statusLegend.title')}
                      </p>
                      <div className="space-y-1.5">
                        {STATUS_LEGEND_GROUPS.map((group) => (
                          <div key={group.label}>
                            <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                              {t(group.label)}
                            </p>
                            <ul className="space-y-0.5">
                              {group.statuses.map((status) => (
                                <li key={status} className="flex items-start gap-1.5">
                                  <span
                                    className={`mt-[1px] shrink-0 rounded border px-1 py-[1px] text-[10px] font-semibold ${STATUS_TONE[status]}`}
                                  >
                                    {t(STATUS_LABEL[status])}
                                  </span>
                                  <span className="text-[10.5px] leading-relaxed">
                                    {t(STATUS_DESC[status])}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </th>
              <th scope="col" className="px-1.5 py-1.5 text-right font-semibold">
                {t('translation.files.colActions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleFiles.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[11.5px] text-slate-500">
                  {files.length === 0
                    ? t('translation.files.empty')
                    : scopeCounts[scope] === 0
                      ? t('translation.scope.empty')
                      : t('translation.files.emptyFiltered')}
                </td>
              </tr>
            ) : (
              visibleFiles.map((file) => {
                const capabilities = getRowCapabilities(file);
                const svg = file.fileKind === 'asset' && isSvgAssetPath(file.sourcePath);
                const hint = capabilities.hint ? HINT_LABEL[capabilities.hint] : null;
                const actions = [
                  ...capabilities.primary.map((id) => ({ id, tone: ROW_ACTION[id].tone })),
                  ...capabilities.secondary.map((id) => ({ id, tone: ROW_ACTION[id].tone })),
                  ...capabilities.danger.map((id) => ({ id, tone: ROW_ACTION[id].tone })),
                ];
                return (
                  <tr
                    key={file.id}
                    data-testid={`translation-file-row-${file.id}`}
                    className={`border-b border-slate-100 last:border-b-0 ${
                      selected.has(file.sourcePath) ? 'bg-blue-50/40' : ''
                    }`}
                  >
                    <td className="px-1.5 py-1.5 align-top">
                      <input
                        type="checkbox"
                        checked={selected.has(file.sourcePath)}
                        onChange={() => togglePath(file.sourcePath)}
                        aria-label={t('translation.files.selectRow', { path: file.sourcePath })}
                        className="h-3 w-3 rounded border-slate-300 text-blue-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
                      />
                    </td>
                    <td className="min-w-0 px-1.5 py-1.5 align-top">
                      <div className="truncate font-mono text-[11px] text-slate-800" title={file.sourcePath}>
                        {file.sourcePath}
                      </div>
                      {file.targetPath !== file.sourcePath ? (
                        <div
                          className="truncate font-mono text-[10.5px] text-slate-400"
                          title={file.targetPath}
                        >
                          → {file.targetPath}
                        </div>
                      ) : null}
                      {file.renamedFromPath ? (
                        <div className="truncate text-[10px] text-indigo-600" title={file.renamedFromPath}>
                          {t('translation.files.renamedFrom', { path: file.renamedFromPath })}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-1.5 py-1.5 align-top">
                      <span className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1 py-[1px] text-[10px] font-medium text-slate-600">
                        {svg ? (
                          <ImageGlyph className="h-2.5 w-2.5" aria-hidden="true" />
                        ) : file.fileKind === 'asset' ? (
                          <ImageGlyph className="h-2.5 w-2.5" aria-hidden="true" />
                        ) : (
                          <FileCode2 className="h-2.5 w-2.5" aria-hidden="true" />
                        )}
                        {svg ? t('translation.row.svgKind') : t(KIND_LABEL[file.fileKind])}
                      </span>
                    </td>
                    <td className="px-1.5 py-1.5 align-top">
                      <span
                        className={`inline-flex items-center rounded border px-1 py-[1px] text-[10px] font-semibold ${STATUS_TONE[file.status]}`}
                        title={t(STATUS_DESC[file.status])}
                      >
                        {t(STATUS_LABEL[file.status])}
                      </span>
                      {isForeignDraft(file) ? (
                        <span
                          data-testid={`translation-foreign-draft-badge-${file.id}`}
                          className="ml-1 inline-flex items-center gap-0.5 rounded border border-amber-200 bg-amber-50 px-1 py-[1px] text-[10px] font-medium text-amber-800"
                          title={t('translation.batch.foreignDraftsHint', {
                            count: 1,
                            owners: file.draftOwner?.userName ?? '',
                          })}
                        >
                          {t('translation.files.foreignDraftBadge', {
                            owner: file.draftOwner?.userName ?? '',
                          })}
                        </span>
                      ) : null}
                      <div className="mt-0.5 flex flex-wrap gap-x-1.5 text-[10px] text-slate-500">
                        {file.needsHumanReview ? (
                          <span className="text-amber-700">
                            {t('translation.files.needsHumanReview')}
                          </span>
                        ) : null}
                        {file.localizedAssetOverride ? (
                          <span className="text-teal-700">{t('translation.files.assetOverride')}</span>
                        ) : null}
                        {hint ? <span className="truncate">{t(hint)}</span> : null}
                      </div>
                    </td>
                    <td className="px-1.5 py-1.5 align-top">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {actions.length === 0 ? (
                          <span className="text-[10.5px] text-slate-400">
                            <SlidersHorizontal className="inline h-3 w-3" aria-hidden="true" />
                          </span>
                        ) : (
                          actions.map(({ id, tone }) => (
                            <button
                              key={id}
                              type="button"
                              data-testid={`translation-row-action-${id}-${file.id}`}
                              onClick={() => runRowAction(file, id)}
                              disabled={!canEdit || busy}
                              className={`inline-flex items-center gap-0.5 rounded border px-1.5 py-[1px] text-[10.5px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 disabled:cursor-not-allowed disabled:opacity-40 ${ROW_BUTTON_TONE[tone]}`}
                            >
                              {t(ROW_ACTION[id].label)}
                            </button>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {filesLoading && files.length === 0 ? (
        <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          {t('translation.loading')}
        </p>
      ) : null}
    </section>
  );
}
