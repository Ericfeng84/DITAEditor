/**
 * Phase 16 Stage 4 — translation center / bilingual review / glossary state.
 *
 * One store for the three screens because they share the same identity-scoped cache: the review
 * page refreshes the queue tab's item rows, the queue tab re-reads the link counters after a
 * batch check-in, and the glossary panel feeds the review pane's term hits. Keeping them together
 * avoids three stores racing the same endpoints with three stale copies.
 *
 * Every action swallows nothing: the error is stored in a named `*Error` slice and the action
 * resolves `null` / `false` so a component can render an inline message instead of throwing into
 * a React render pass.
 */
import { create } from 'zustand';
import {
  applyTranslationToDraft,
  assignTranslationItemReviewer,
  batchApplyTranslationDrafts,
  batchCheckinTranslationLink,
  cancelTranslationJob,
  createGlossary,
  createGlossaryTerm,
  createTranslationLink,
  deleteGlossary,
  deleteGlossaryTerm,
  deleteTranslationLink,
  enqueueTranslationJob,
  exportGlossary,
  fetchEffectiveGlossary,
  fetchGlossaries,
  fetchGlossaryTerms,
  fetchTranslationFiles,
  fetchTranslationJob,
  fetchTranslationJobs,
  fetchTranslationLink,
  fetchTranslationLinks,
  fetchTranslationReview,
  importGlossary,
  isTerminalJobStatus,
  markTranslationFilesSynced,
  refineTranslationSegment,
  retryFailedTranslationJob,
  resolveDeletedTranslationFiles,
  saveTranslationReview,
  scanTranslationLink,
  subscribeTranslationJobStream,
  syncTranslationAssets,
  syncTranslationPassthrough,
  updateGlossary,
  updateGlossaryTerm,
  updateTranslationLink,
  validateTranslationItemStrict,
  type ApplyTranslationDraftResult,
  type BatchApplyDraftInput,
  type BatchApplyDraftResult,
  type BatchCheckinInput,
  type BatchCheckinResult,
  type CreateGlossaryInput,
  type CreateGlossaryTermInput,
  type CreateTranslationLinkInput,
  type EffectiveGlossaryResult,
  type EnqueueTranslationJobInput,
  type GlossaryExchangeFormat,
  type GlossaryImportInput,
  type GlossaryImportResult,
  type GlossaryTermFilter,
  type GlossaryTermView,
  type GlossaryView,
  type MarkSyncedResult,
  type RefineTranslationSegmentResult,
  type ResolveDeletedAction,
  type ResolveDeletedResult,
  type SaveReviewEditsInput,
  type SyncAssetsResult,
  type SyncPassthroughResult,
  type TranslationFileCounts,
  type TranslationFileStateFilter,
  type TranslationFileStateView,
  type TranslationJobSnapshot,
  type TranslationJobView,
  type TranslationLinkView,
  type TranslationReviewPayload,
  type TranslationScanResult,
  type TranslationScanSummary,
  type UpdateGlossaryInput,
  type UpdateGlossaryTermInput,
  type UpdateTranslationLinkInput,
} from '../services/translation-api.js';

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Active SSE subscription, keyed by the job id it was opened for. */
let streamController: AbortController | null = null;
let streamJobId: string | null = null;

export interface TranslationState {
  /* Links & file matrix */
  links: TranslationLinkView[];
  linksLoading: boolean;
  linksError: string | null;
  /**
   * Compact copy used by the editor header capsule. The capsule is always shown in API mode; the
   * count only changes its label, so a manual with no target language still reaches the center.
   */
  entryLinks: TranslationLinkView[];
  files: TranslationFileStateView[];
  counts: TranslationFileCounts | null;
  filesLoading: boolean;
  filesError: string | null;
  scanning: boolean;
  lastScan: TranslationScanSummary | null;
  syncBusy: boolean;

  /* Job queue */
  jobs: TranslationJobView[];
  jobsLoading: boolean;
  jobsError: string | null;
  activeJobId: string | null;
  jobSnapshot: TranslationJobSnapshot | null;
  streaming: boolean;
  streamError: string | null;

  /* Bilingual review */
  review: TranslationReviewPayload | null;
  reviewLoading: boolean;
  reviewError: string | null;
  reviewSaving: boolean;
  applyingDraft: boolean;
  refiningSegmentId: string | null;
  /** Phase 16 — a manual DITA-OT strict re-check is running for the open review item. */
  validatingStrict: boolean;

  /* Glossaries */
  glossaries: GlossaryView[];
  glossariesLoading: boolean;
  glossariesError: string | null;
  activeGlossaryId: string | null;
  terms: GlossaryTermView[];
  termsLoading: boolean;
  termsError: string | null;
  effectiveGlossary: EffectiveGlossaryResult | null;

  /* Shared feedback */
  actionError: string | null;
  actionMessage: string | null;

  loadLinks: (filter?: { manualId?: string; branch?: string }) => Promise<TranslationLinkView[]>;
  loadEntryLinks: (manualId: string, branch?: string | null) => Promise<TranslationLinkView[]>;
  loadLink: (linkId: string) => Promise<TranslationLinkView | null>;
  addLink: (input: CreateTranslationLinkInput) => Promise<TranslationLinkView | null>;
  patchLink: (
    linkId: string,
    patch: UpdateTranslationLinkInput,
  ) => Promise<TranslationLinkView | null>;
  removeLink: (linkId: string) => Promise<boolean>;

  loadFiles: (linkId: string, filter?: TranslationFileStateFilter) => Promise<void>;
  scanLink: (linkId: string) => Promise<TranslationScanResult | null>;
  syncAssets: (
    linkId: string,
    paths?: string[],
    options?: { force?: boolean },
  ) => Promise<SyncAssetsResult | null>;
  syncPassthrough: (linkId: string, paths?: string[]) => Promise<SyncPassthroughResult | null>;
  resolveDeleted: (
    linkId: string,
    input: { paths: string[]; action: ResolveDeletedAction },
  ) => Promise<ResolveDeletedResult | null>;
  markSynced: (linkId: string, paths: string[]) => Promise<MarkSyncedResult | null>;
  batchCheckin: (linkId: string, input: BatchCheckinInput) => Promise<BatchCheckinResult | null>;
  batchApplyDrafts: (
    linkId: string,
    input: BatchApplyDraftInput,
  ) => Promise<BatchApplyDraftResult | null>;

  loadJobs: (filter: { linkId?: string } & { limit?: number }) => Promise<void>;
  enqueue: (input: EnqueueTranslationJobInput) => Promise<TranslationJobSnapshot | null>;
  openJob: (jobId: string) => Promise<TranslationJobSnapshot | null>;
  cancelJob: (jobId: string) => Promise<TranslationJobSnapshot | null>;
  retryFailed: (jobId: string) => Promise<TranslationJobSnapshot | null>;
  assignReviewer: (itemId: string, reviewerId: string | null) => Promise<boolean>;
  subscribeJob: (jobId: string) => void;
  unsubscribeJob: () => void;

  loadReview: (itemId: string) => Promise<TranslationReviewPayload | null>;
  saveReview: (itemId: string, input: SaveReviewEditsInput) => Promise<TranslationReviewPayload | null>;
  refineSegment: (
    itemId: string,
    segmentId: string,
    instruction: string,
    currentTargetXml?: string,
  ) => Promise<RefineTranslationSegmentResult | null>;
  applyDraft: (itemId: string) => Promise<ApplyTranslationDraftResult | null>;
  validateActiveItemStrict: (itemId: string) => Promise<boolean>;

  loadGlossaries: (filter?: {
    scope?: 'global' | 'manual';
    manualId?: string;
    sourceLang?: string;
  }) => Promise<GlossaryView[]>;
  addGlossary: (input: CreateGlossaryInput) => Promise<GlossaryView | null>;
  patchGlossary: (glossaryId: string, patch: UpdateGlossaryInput) => Promise<GlossaryView | null>;
  removeGlossary: (glossaryId: string) => Promise<boolean>;
  selectGlossary: (glossaryId: string | null) => Promise<void>;
  loadTerms: (glossaryId: string, filter?: GlossaryTermFilter) => Promise<void>;
  addTerm: (glossaryId: string, input: CreateGlossaryTermInput) => Promise<GlossaryTermView | null>;
  patchTerm: (termId: string, patch: UpdateGlossaryTermInput) => Promise<GlossaryTermView | null>;
  removeTerm: (termId: string) => Promise<boolean>;
  runImport: (glossaryId: string, input: GlossaryImportInput) => Promise<GlossaryImportResult | null>;
  runExport: (
    glossaryId: string,
    options: { format: GlossaryExchangeFormat; targetLang?: string },
  ) => Promise<string | null>;
  loadEffectiveGlossary: (filter: {
    manualId?: string | null;
    sourceLang?: string | null;
    targetLang: string;
  }) => Promise<EffectiveGlossaryResult | null>;

  clearActionFeedback: () => void;
  reset: () => void;
}

/** The empty slices, reused by `reset()` so the store cannot drift from its own shape. */
function emptyState() {
  return {
    links: [] as TranslationLinkView[],
    linksLoading: false,
    linksError: null as string | null,
    entryLinks: [] as TranslationLinkView[],
    files: [] as TranslationFileStateView[],
    counts: null as TranslationFileCounts | null,
    filesLoading: false,
    filesError: null as string | null,
    scanning: false,
    lastScan: null as TranslationScanSummary | null,
    syncBusy: false,
    jobs: [] as TranslationJobView[],
    jobsLoading: false,
    jobsError: null as string | null,
    activeJobId: null as string | null,
    jobSnapshot: null as TranslationJobSnapshot | null,
    streaming: false,
    streamError: null as string | null,
    review: null as TranslationReviewPayload | null,
    reviewLoading: false,
    reviewError: null as string | null,
    reviewSaving: false,
    applyingDraft: false,
    refiningSegmentId: null as string | null,
    validatingStrict: false,
    glossaries: [] as GlossaryView[],
    glossariesLoading: false,
    glossariesError: null as string | null,
    activeGlossaryId: null as string | null,
    terms: [] as GlossaryTermView[],
    termsLoading: false,
    termsError: null as string | null,
    effectiveGlossary: null as EffectiveGlossaryResult | null,
    actionError: null as string | null,
    actionMessage: null as string | null,
  };
}

export const useTranslationStore = create<TranslationState>((set, get) => ({
  ...emptyState(),

  /* ------------------------------------------------------------------ links */

  loadLinks: async (filter = {}) => {
    set({ linksLoading: true, linksError: null });
    try {
      const { links } = await fetchTranslationLinks(filter);
      set({ links, linksLoading: false });
      return links;
    } catch (error) {
      set({ linksLoading: false, linksError: messageOf(error) });
      return [];
    }
  },

  loadEntryLinks: async (manualId, branch) => {
    try {
      const { links } = await fetchTranslationLinks({
        manualId,
        ...(branch ? { branch } : {}),
      });
      set({ entryLinks: links });
      return links;
    } catch {
      // The editor capsule is decoration; a failed lookup must stay silent.
      set({ entryLinks: [] });
      return [];
    }
  },

  loadLink: async (linkId) => {
    try {
      const { link } = await fetchTranslationLink(linkId);
      set((state) => ({
        links: state.links.some((entry) => entry.id === link.id)
          ? state.links.map((entry) => (entry.id === link.id ? link : entry))
          : [...state.links, link],
      }));
      return link;
    } catch (error) {
      set({ linksError: messageOf(error) });
      return null;
    }
  },

  addLink: async (input) => {
    set({ actionError: null, actionMessage: null });
    try {
      const { link } = await createTranslationLink(input);
      set((state) => ({ links: [...state.links, link] }));
      return link;
    } catch (error) {
      set({ actionError: messageOf(error) });
      return null;
    }
  },

  patchLink: async (linkId, patch) => {
    set({ actionError: null, actionMessage: null });
    try {
      const { link } = await updateTranslationLink(linkId, patch);
      set((state) => ({ links: state.links.map((entry) => (entry.id === linkId ? link : entry)) }));
      return link;
    } catch (error) {
      set({ actionError: messageOf(error) });
      return null;
    }
  },

  removeLink: async (linkId) => {
    set({ actionError: null, actionMessage: null });
    try {
      await deleteTranslationLink(linkId);
      set((state) => ({
        links: state.links.filter((entry) => entry.id !== linkId),
        entryLinks: state.entryLinks.filter((entry) => entry.id !== linkId),
        files: [],
        counts: null,
        jobs: [],
        jobSnapshot: null,
        lastScan: null,
      }));
      return true;
    } catch (error) {
      set({ actionError: messageOf(error) });
      return false;
    }
  },

  /* ------------------------------------------------------- files & sync */

  loadFiles: async (linkId, filter = {}) => {
    set({ filesLoading: true, filesError: null });
    try {
      const { files, counts } = await fetchTranslationFiles(linkId, filter);
      // A stubbed/older backend may omit `files`; the tab must still render an empty table.
      set({ files: files ?? [], ...(counts ? { counts } : {}), filesLoading: false });
    } catch (error) {
      set({ filesLoading: false, filesError: messageOf(error) });
    }
  },

  scanLink: async (linkId) => {
    set({ scanning: true, actionError: null, actionMessage: null });
    try {
      const result = await scanTranslationLink(linkId);
      set({
        scanning: false,
        lastScan: result.summary,
        files: result.files,
        counts: result.summary.counts,
      });
      // The link row carries the same counters; refresh it so the language bar stays honest.
      void get().loadLink(linkId);
      return result;
    } catch (error) {
      set({ scanning: false, actionError: messageOf(error) });
      return null;
    }
  },

  syncAssets: async (linkId, paths, options) => {
    set({ syncBusy: true, actionError: null, actionMessage: null });
    try {
      const result = await syncTranslationAssets(linkId, {
        ...(paths && paths.length > 0 ? { paths } : {}),
        ...(options?.force ? { force: true } : {}),
      });
      set({ syncBusy: false });
      // Synced assets advance to `draft_ready`, so the matrix and the counters are both stale now.
      await get().loadFiles(linkId);
      void get().loadLink(linkId);
      return result;
    } catch (error) {
      set({ syncBusy: false, actionError: messageOf(error) });
      return null;
    }
  },

  syncPassthrough: async (linkId, paths) => {
    set({ syncBusy: true, actionError: null, actionMessage: null });
    try {
      const result = await syncTranslationPassthrough(
        linkId,
        paths && paths.length > 0 ? { paths } : {},
      );
      set({ syncBusy: false });
      await get().loadFiles(linkId);
      void get().loadLink(linkId);
      return result;
    } catch (error) {
      set({ syncBusy: false, actionError: messageOf(error) });
      return null;
    }
  },

  resolveDeleted: async (linkId, input) => {
    set({ syncBusy: true, actionError: null, actionMessage: null });
    try {
      const result = await resolveDeletedTranslationFiles(linkId, input);
      set({ syncBusy: false });
      await get().loadFiles(linkId);
      void get().loadLink(linkId);
      return result;
    } catch (error) {
      set({ syncBusy: false, actionError: messageOf(error) });
      return null;
    }
  },

  markSynced: async (linkId, paths) => {
    set({ syncBusy: true, actionError: null, actionMessage: null });
    try {
      const result = await markTranslationFilesSynced(linkId, paths);
      set({ syncBusy: false });
      await get().loadFiles(linkId);
      void get().loadLink(linkId);
      return result;
    } catch (error) {
      set({ syncBusy: false, actionError: messageOf(error) });
      return null;
    }
  },

  batchCheckin: async (linkId, input) => {
    set({ syncBusy: true, actionError: null, actionMessage: null });
    try {
      const result = await batchCheckinTranslationLink(linkId, input);
      set({ syncBusy: false });
      await get().loadFiles(linkId);
      void get().loadLink(linkId);
      // Phase 16: a check-in rescans this pair *and* every downstream sibling/descendant, so the
      // family list has to be re-read — otherwise the lineage tree keeps showing stale progress
      // percentages for the children of the pair that was just checked in.
      const sourceManualId =
        get().links.find((entry) => entry.id === linkId)?.sourceManualId ??
        get().entryLinks.find((entry) => entry.id === linkId)?.sourceManualId;
      if (sourceManualId) void get().loadLinks({ manualId: sourceManualId });
      return result;
    } catch (error) {
      set({ syncBusy: false, actionError: messageOf(error) });
      return null;
    }
  },

  batchApplyDrafts: async (linkId, input) => {
    set({ syncBusy: true, actionError: null, actionMessage: null });
    try {
      const result = await batchApplyTranslationDrafts(linkId, input);
      set({ syncBusy: false });
      await get().loadFiles(linkId);
      // Refresh only *this* link: `loadLinks()` pulls every link of every manual into
      // `state.links`, which made the center header render duplicate language pills.
      void get().loadLink(linkId);
      void get().loadJobs({ linkId });
      return result;
    } catch (error) {
      set({ syncBusy: false, actionError: messageOf(error) });
      return null;
    }
  },

  /* ------------------------------------------------------------------ jobs */

  loadJobs: async (filter) => {
    set({ jobsLoading: true, jobsError: null });
    try {
      const { jobs } = await fetchTranslationJobs(filter);
      set({ jobs, jobsLoading: false });
    } catch (error) {
      set({ jobsLoading: false, jobsError: messageOf(error) });
    }
  },

  enqueue: async (input) => {
    set({ actionError: null, actionMessage: null });
    try {
      const snapshot = await enqueueTranslationJob(input);
      set({ activeJobId: snapshot.job.id, jobSnapshot: snapshot });
      void get().loadJobs({ linkId: input.linkId });
      get().subscribeJob(snapshot.job.id);
      return snapshot;
    } catch (error) {
      set({ actionError: messageOf(error) });
      return null;
    }
  },

  openJob: async (jobId) => {
    set({ activeJobId: jobId });
    try {
      const snapshot = await fetchTranslationJob(jobId);
      set({ jobSnapshot: snapshot });
      if (!isTerminalJobStatus(snapshot.job.status)) get().subscribeJob(jobId);
      return snapshot;
    } catch (error) {
      set({ jobsError: messageOf(error) });
      return null;
    }
  },

  cancelJob: async (jobId) => {
    set({ actionError: null });
    try {
      const snapshot = await cancelTranslationJob(jobId);
      set({ jobSnapshot: snapshot });
      void get().loadJobs({ linkId: snapshot.job.linkId });
      return snapshot;
    } catch (error) {
      set({ actionError: messageOf(error) });
      return null;
    }
  },

  retryFailed: async (jobId) => {
    set({ actionError: null });
    try {
      const snapshot = await retryFailedTranslationJob(jobId);
      set({ jobSnapshot: snapshot, activeJobId: snapshot.job.id });
      void get().loadJobs({ linkId: snapshot.job.linkId });
      get().subscribeJob(snapshot.job.id);
      return snapshot;
    } catch (error) {
      set({ actionError: messageOf(error) });
      return null;
    }
  },

  assignReviewer: async (itemId, reviewerId) => {
    set({ actionError: null });
    try {
      const { item } = await assignTranslationItemReviewer(itemId, reviewerId);
      set((state) =>
        state.jobSnapshot
          ? {
              jobSnapshot: {
                ...state.jobSnapshot,
                items: state.jobSnapshot.items.map((entry) =>
                  entry.id === item.id ? item : entry,
                ),
              },
            }
          : {},
      );
      return true;
    } catch (error) {
      set({ actionError: messageOf(error) });
      return false;
    }
  },

  subscribeJob: (jobId) => {
    if (streamJobId === jobId && streamController) return;
    get().unsubscribeJob();
    const controller = new AbortController();
    streamController = controller;
    streamJobId = jobId;
    set({ streaming: true, streamError: null, activeJobId: jobId });
    void subscribeTranslationJobStream(
      jobId,
      (event) => {
        if (event.event === 'job.snapshot') {
          set({ jobSnapshot: event.data as TranslationJobSnapshot });
          return;
        }
        if (event.event === 'job.updated' || event.event === 'job.completed') {
          const job = event.data as TranslationJobView;
          set((state) => ({
            jobSnapshot: state.jobSnapshot ? { ...state.jobSnapshot, job } : state.jobSnapshot,
            // The Files tab renders its banner from the job list, so keep that entry fresh too —
            // otherwise the inline progress bar would freeze until the stream ends.
            jobs: state.jobs.map((entry) => (entry.id === job.id ? job : entry)),
            streaming: event.event === 'job.updated',
          }));
          if (event.event === 'job.completed') {
            set({ streaming: false });
            void get().loadJobs({ linkId: job.linkId });
            // Files tab keeps its own view of the matrix; refresh it so progress lands there too.
            void get().loadFiles(job.linkId).then(() => get().loadLink(job.linkId));
          }
          return;
        }
        if (event.event === 'item.updated') {
          const item = event.data as TranslationJobSnapshot['items'][number];
          const settled = item.status === 'ready_for_review' || item.status === 'failed';
          set((state) =>
            state.jobSnapshot
              ? {
                  jobSnapshot: {
                    ...state.jobSnapshot,
                    items: state.jobSnapshot.items.some((entry) => entry.id === item.id)
                      ? state.jobSnapshot.items.map((entry) =>
                          entry.id === item.id ? item : entry,
                        )
                      : [...state.jobSnapshot.items, item],
                  },
                }
              : {},
          );
          // An item that reaches review (or fails) flips a row's status, so re-read the matrix.
          if (settled) {
            const linkId = get().jobSnapshot?.job.linkId;
            if (linkId) void get().loadFiles(linkId).then(() => get().loadLink(linkId));
          }
        }
      },
      controller.signal,
    )
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        set({ streamError: messageOf(error), streaming: false });
      })
      .finally(() => {
        if (streamController === controller) {
          streamController = null;
          streamJobId = null;
          set({ streaming: false });
        }
      });
  },

  unsubscribeJob: () => {
    if (streamController) {
      streamController.abort();
      streamController = null;
    }
    streamJobId = null;
    set({ streaming: false });
  },

  /* ---------------------------------------------------------------- review */

  loadReview: async (itemId) => {
    set({ reviewLoading: true, reviewError: null });
    try {
      const review = await fetchTranslationReview(itemId);
      set({ review, reviewLoading: false });
      return review;
    } catch (error) {
      set({ reviewLoading: false, reviewError: messageOf(error) });
      return null;
    }
  },

  saveReview: async (itemId, input) => {
    set({ reviewSaving: true, actionError: null, actionMessage: null });
    try {
      const review = await saveTranslationReview(itemId, input);
      set({ review, reviewSaving: false });
      return review;
    } catch (error) {
      set({ reviewSaving: false, actionError: messageOf(error) });
      return null;
    }
  },

  refineSegment: async (itemId, segmentId, instruction, currentTargetXml) => {
    set({ refiningSegmentId: segmentId, actionError: null });
    try {
      const result = await refineTranslationSegment(itemId, {
        segmentId,
        instruction,
        ...(currentTargetXml === undefined ? {} : { currentTargetXml }),
      });
      set({ refiningSegmentId: null });
      return result;
    } catch (error) {
      set({ refiningSegmentId: null, actionError: messageOf(error) });
      return null;
    }
  },

  applyDraft: async (itemId) => {
    set({ applyingDraft: true, actionError: null, actionMessage: null });
    try {
      const result = await applyTranslationToDraft(itemId);
      set((state) => {
        if (!state.review) return { applyingDraft: false };
        const siblings = state.review.siblings;
        return {
          applyingDraft: false,
          // The review header and the file switcher both read this payload, so the row that was
          // just applied has to advance with the item — otherwise the switcher keeps showing the
          // pre-apply status until the queue is reloaded.
          review: {
            ...state.review,
            item: result.item,
            lock: result.lock,
            ...(siblings
              ? {
                  siblings: siblings.map((entry) =>
                    entry.itemId === result.item.id
                      ? { ...entry, status: result.item.status }
                      : entry,
                  ),
                }
              : {}),
          },
        };
      });
      return result;
    } catch (error) {
      set({ applyingDraft: false, actionError: messageOf(error) });
      return null;
    }
  },

  /**
   * Phase 16 — re-run the DITA-OT strict gate for the open item.
   *
   * The refreshed item row is written to `review.item` *and* to every matching entry of the job
   * snapshot, because the queue tab (items) and the review header (payload) read the same row from
   * two slices; patching only one leaves a stale badge until the next navigation.
   */
  validateActiveItemStrict: async (itemId) => {
    set({ validatingStrict: true, actionError: null, actionMessage: null });
    try {
      const { item, ditaOtReport } = await validateTranslationItemStrict(itemId);
      set((state) => ({
        validatingStrict: false,
        review: state.review ? { ...state.review, item, ditaOtReport } : state.review,
        jobSnapshot: state.jobSnapshot
          ? {
              ...state.jobSnapshot,
              items: state.jobSnapshot.items.map((entry) =>
                entry.id === item.id ? { ...entry, ...item } : entry,
              ),
            }
          : state.jobSnapshot,
      }));
      return true;
    } catch (error) {
      set({ validatingStrict: false, actionError: messageOf(error) });
      return false;
    }
  },

  /* ------------------------------------------------------------- glossaries */
  loadGlossaries: async (filter = {}) => {
    set({ glossariesLoading: true, glossariesError: null });
    try {
      const { glossaries } = await fetchGlossaries(filter);
      set((state) => ({
        glossaries,
        glossariesLoading: false,
        activeGlossaryId:
          state.activeGlossaryId && glossaries.some((entry) => entry.id === state.activeGlossaryId)
            ? state.activeGlossaryId
            : (glossaries[0]?.id ?? null),
      }));
      return glossaries;
    } catch (error) {
      set({ glossariesLoading: false, glossariesError: messageOf(error) });
      return [];
    }
  },

  addGlossary: async (input) => {
    set({ actionError: null, actionMessage: null });
    try {
      const { glossary } = await createGlossary(input);
      set((state) => ({ glossaries: [...state.glossaries, glossary], activeGlossaryId: glossary.id }));
      return glossary;
    } catch (error) {
      set({ actionError: messageOf(error) });
      return null;
    }
  },

  patchGlossary: async (glossaryId, patch) => {
    set({ actionError: null, actionMessage: null });
    try {
      const { glossary } = await updateGlossary(glossaryId, patch);
      set((state) => ({
        glossaries: state.glossaries.map((entry) =>
          entry.id === glossaryId ? glossary : entry,
        ),
      }));
      return glossary;
    } catch (error) {
      set({ actionError: messageOf(error) });
      return null;
    }
  },

  removeGlossary: async (glossaryId) => {
    set({ actionError: null, actionMessage: null });
    try {
      await deleteGlossary(glossaryId);
      set((state) => ({
        glossaries: state.glossaries.filter((entry) => entry.id !== glossaryId),
        activeGlossaryId: state.activeGlossaryId === glossaryId ? null : state.activeGlossaryId,
        terms: state.activeGlossaryId === glossaryId ? [] : state.terms,
      }));
      return true;
    } catch (error) {
      set({ actionError: messageOf(error) });
      return false;
    }
  },

  selectGlossary: async (glossaryId) => {
    set({ activeGlossaryId: glossaryId, terms: [], termsError: null });
    if (glossaryId) await get().loadTerms(glossaryId);
  },

  loadTerms: async (glossaryId, filter = {}) => {
    set({ termsLoading: true, termsError: null });
    try {
      const { terms } = await fetchGlossaryTerms(glossaryId, filter);
      set({ terms, termsLoading: false });
    } catch (error) {
      set({ termsLoading: false, termsError: messageOf(error) });
    }
  },

  addTerm: async (glossaryId, input) => {
    set({ actionError: null, actionMessage: null });
    try {
      const { term } = await createGlossaryTerm(glossaryId, input);
      set((state) => ({
        terms: [term, ...state.terms],
        glossaries: state.glossaries.map((entry) =>
          entry.id === glossaryId ? { ...entry, termCount: entry.termCount + 1 } : entry,
        ),
      }));
      return term;
    } catch (error) {
      set({ actionError: messageOf(error) });
      return null;
    }
  },

  patchTerm: async (termId, patch) => {
    set({ actionError: null, actionMessage: null });
    try {
      const { term } = await updateGlossaryTerm(termId, patch);
      set((state) => ({
        terms: state.terms.map((entry) => (entry.id === termId ? term : entry)),
      }));
      return term;
    } catch (error) {
      set({ actionError: messageOf(error) });
      return null;
    }
  },

  removeTerm: async (termId) => {
    set({ actionError: null, actionMessage: null });
    try {
      await deleteGlossaryTerm(termId);
      set((state) => {
        const removed = state.terms.find((entry) => entry.id === termId);
        return {
          terms: state.terms.filter((entry) => entry.id !== termId),
          glossaries: removed
            ? state.glossaries.map((entry) =>
                entry.id === removed.glossaryId
                  ? { ...entry, termCount: Math.max(0, entry.termCount - 1) }
                  : entry,
              )
            : state.glossaries,
        };
      });
      return true;
    } catch (error) {
      set({ actionError: messageOf(error) });
      return false;
    }
  },

  runImport: async (glossaryId, input) => {
    set({ actionError: null, actionMessage: null });
    try {
      const result = await importGlossary(glossaryId, input);
      if (!input.dryRun) await get().loadTerms(glossaryId);
      return result;
    } catch (error) {
      set({ actionError: messageOf(error) });
      return null;
    }
  },

  runExport: async (glossaryId, options) => {
    set({ actionError: null });
    try {
      const result = await exportGlossary(glossaryId, options);
      if (typeof window !== 'undefined' && typeof URL.createObjectURL === 'function') {
        const blob = new Blob([result.content], { type: result.contentType });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = result.filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
      }
      return result.filename;
    } catch (error) {
      set({ actionError: messageOf(error) });
      return null;
    }
  },

  loadEffectiveGlossary: async (filter) => {
    try {
      const result = await fetchEffectiveGlossary(filter);
      set({ effectiveGlossary: result });
      return result;
    } catch (error) {
      set({ actionError: messageOf(error) });
      return null;
    }
  },

  clearActionFeedback: () => set({ actionError: null, actionMessage: null }),

  reset: () => {
    if (streamController) {
      streamController.abort();
      streamController = null;
    }
    streamJobId = null;
    set({ ...emptyState() });
  },
}));
