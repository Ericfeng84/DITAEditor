/**
 * Phase 10 — manual workbench store (the hub screen).
 *
 * The hub is deliberately decoupled from the editor store: it only knows the manual
 * registry and the caller's assignments, so opening a manual is a plain navigation to
 * `/manuals/:id` where a fresh, isolated editor session is created.
 */
import { DITA_SAMPLE_DOCUMENTS } from '@dita/core';
import { create } from 'zustand';
import { t } from '../i18n/index.js';
import {
  cancelAssignment,
  createAssignment,
  fetchAssignmentSummary,
  fetchAssignments,
  updateAssignment,
  type Assignment,
  type AssignmentCreateInput,
  type AssignmentStatus,
  type AssignmentSummary,
} from '../services/assignments-api';
import {
  createManual as createManualRequest,
  fetchManuals,
  removeManual,
  touchManual,
  updateManual as updateManualRequest,
  type Manual,
  type ManualCreateInput,
  type ManualUpdateInput,
} from '../services/manuals-api.js';

const OFFLINE = import.meta.env.VITE_STATIC_DEMO === 'true';

export interface WorkbenchState {
  manuals: Manual[];
  defaultRootDir: string | null;
  importsRootDir: string | null;
  activeManualId: string | null;
  includeArchived: boolean;
  query: string;
  loading: boolean;
  error: string | null;
  offline: boolean;
  summary: AssignmentSummary | null;
  myAssignments: Assignment[];
  delegatedAssignments: Assignment[];
  assignmentsLoading: boolean;
  busyManualId: string | null;

  refresh: () => Promise<void>;
  refreshAssignments: () => Promise<void>;
  setQuery: (query: string) => void;
  setIncludeArchived: (include: boolean) => void;
  createManual: (input: ManualCreateInput) => Promise<Manual | null>;
  updateManual: (id: string, patch: ManualUpdateInput) => Promise<Manual | null>;
  deleteManual: (id: string) => Promise<boolean>;
  touchManual: (id: string) => Promise<void>;
  delegateTopic: (input: AssignmentCreateInput) => Promise<Assignment | null>;
  setAssignmentStatus: (id: string, status: AssignmentStatus) => Promise<Assignment | null>;
  reassign: (id: string, assigneeId: string) => Promise<Assignment | null>;
  cancelAssignment: (id: string) => Promise<void>;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Offline demo manual: the marketing site sandbox must never hit `/api`. */
function offlineManual(): Manual {
  const now = new Date().toISOString();
  const topics = DITA_SAMPLE_DOCUMENTS.length;
  return {
    id: 'offline-demo',
    name: t('workbench.offlineDemoName'),
    description: t('workbench.offlineDemoDescription'),
    rootDir: t('workbench.offlineDemoRootDir'),
    defaultRootMap: null,
    isBuiltin: true,
    archived: false,
    exists: true,
    currentBranch: 'main',
    stats: { totalTopics: topics, totalMaps: 1 },
    activeAssignmentCount: 0,
    myActiveAssignmentCount: 0,
    createdBy: 'system',
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
  };
}

export const useWorkbenchStore = create<WorkbenchState>((set, get) => {
  const patchManual = (next: Manual) =>
    set((state) => ({
      manuals: state.manuals.map((manual) => (manual.id === next.id ? next : manual)),
      activeManualId: state.activeManualId ?? next.id,
    }));

  return {
    manuals: OFFLINE ? [offlineManual()] : [],
    defaultRootDir: null,
    importsRootDir: null,
    activeManualId: null,
    includeArchived: false,
    query: '',
    loading: false,
    error: null,
    offline: OFFLINE,
    summary: null,
    myAssignments: [],
    delegatedAssignments: [],
    assignmentsLoading: false,
    busyManualId: null,

    async refresh() {
      if (OFFLINE) {
        set({ loading: false, offline: true, error: null });
        return;
      }
      set({ loading: true });
      try {
        const snapshot = await fetchManuals({
          includeArchived: get().includeArchived,
          q: get().query,
        });
        set({
          manuals: snapshot.manuals,
          defaultRootDir: snapshot.defaultRootDir,
          importsRootDir: snapshot.importsRootDir,
          activeManualId: snapshot.activeManualId,
          loading: false,
          offline: false,
          error: null,
        });
      } catch (err) {
        // The workbench still has to render when the API is not running (static hosting).
        set({
          loading: false,
          offline: true,
          error: messageOf(err),
          manuals: get().manuals.length > 0 ? get().manuals : [offlineManual()],
        });
      }
    },

    async refreshAssignments() {
      if (OFFLINE) return;
      set({ assignmentsLoading: true });
      try {
        const [mine, delegated, summary] = await Promise.all([
          fetchAssignments({ scope: 'mine', status: 'active' }),
          fetchAssignments({ scope: 'delegated', status: 'active' }),
          fetchAssignmentSummary(),
        ]);
        set({
          myAssignments: mine.assignments,
          delegatedAssignments: delegated.assignments,
          summary: summary.summary,
          assignmentsLoading: false,
        });
      } catch {
        set({ assignmentsLoading: false, myAssignments: [], delegatedAssignments: [], summary: null });
      }
    },

    setQuery(query) {
      set({ query });
      void get().refresh();
    },

    setIncludeArchived(includeArchived) {
      set({ includeArchived });
      void get().refresh();
    },

    async createManual(input) {
      if (OFFLINE) return null;
      try {
        const { manual } = await createManualRequest(input);
        set((state) => ({
          manuals: [manual, ...state.manuals.filter((item) => item.id !== manual.id)],
          activeManualId: manual.id,
          error: null,
        }));
        return manual;
      } catch (err) {
        set({ error: messageOf(err) });
        return null;
      }
    },

    async updateManual(id, patch) {
      if (OFFLINE) return null;
      try {
        const { manual } = await updateManualRequest(id, patch);
        if (get().includeArchived || !manual.archived) patchManual(manual);
        else
          set((state) => ({
            manuals: state.manuals.filter((item) => item.id !== id),
            error: null,
          }));
        return manual;
      } catch (err) {
        set({ error: messageOf(err) });
        return null;
      }
    },

    async deleteManual(id) {
      if (OFFLINE) return false;
      try {
        await removeManual(id);
        set((state) => ({ manuals: state.manuals.filter((item) => item.id !== id), error: null }));
        return true;
      } catch (err) {
        set({ error: messageOf(err) });
        return false;
      }
    },

    async touchManual(id) {
      if (OFFLINE) return;
      try {
        const { manual } = await touchManual(id);
        patchManual(manual);
      } catch {
        // Touching is bookkeeping only; never block opening a manual on it.
      }
    },

    async delegateTopic(input) {
      try {
        const { assignment } = await createAssignment(input);
        set((state) => ({
          delegatedAssignments: [assignment, ...state.delegatedAssignments],
          error: null,
        }));
        return assignment;
      } catch (err) {
        set({ error: messageOf(err) });
        return null;
      }
    },

    async setAssignmentStatus(id, status) {
      try {
        const { assignment } = await updateAssignment(id, { status });
        await get().refreshAssignments();
        return assignment;
      } catch (err) {
        set({ error: messageOf(err) });
        return null;
      }
    },

    async reassign(id, assigneeId) {
      try {
        const { assignment } = await updateAssignment(id, { assigneeId });
        await get().refreshAssignments();
        return assignment;
      } catch (err) {
        set({ error: messageOf(err) });
        return null;
      }
    },

    async cancelAssignment(id) {
      try {
        await cancelAssignment(id);
        await get().refreshAssignments();
      } catch (err) {
        set({ error: messageOf(err) });
      }
    },
  };
});
