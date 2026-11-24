/**
 * Phase 10 — assignment state for the *editor* session.
 *
 * Everything here is scoped by the active manual/branch headers set in `AppShell`, so the
 * store never needs to know about routes. The editor only asks two questions: "is the open
 * topic assigned?" and "what is on my plate in this branch?".
 */
import { create } from 'zustand';
import {
  cancelAssignment as cancelAssignmentRequest,
  createAssignment,
  fetchAssignments,
  updateAssignment,
  type Assignment,
  type AssignmentStatus,
} from '../services/assignments-api';

export interface AssignmentState {
  /** Assignment of the active topic on the active branch (any status). */
  active: Assignment | null;
  activeTopicPath: string | null;
  mine: Assignment[];
  delegated: Assignment[];
  loading: boolean;
  busy: boolean;
  error: string | null;
  /** Paths the user dismissed with "hide for this session". */
  dismissed: Set<string>;

  refreshForTopic: (topicPath: string | null) => Promise<void>;
  refreshLists: () => Promise<void>;
  delegate: (input: { topicPath: string; assigneeId: string; note?: string; dueDate?: string | null }) => Promise<Assignment | null>;
  reassign: (id: string, assigneeId: string) => Promise<Assignment | null>;
  setStatus: (id: string, status: AssignmentStatus) => Promise<Assignment | null>;
  cancel: (id: string) => Promise<void>;
  dismiss: (topicPath: string) => void;
  clear: () => void;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export const useAssignmentStore = create<AssignmentState>((set, get) => ({
  active: null,
  activeTopicPath: null,
  mine: [],
  delegated: [],
  loading: false,
  busy: false,
  error: null,
  dismissed: new Set<string>(),

  async refreshForTopic(topicPath) {
    if (!topicPath) {
      set({ active: null, activeTopicPath: null });
      return;
    }
    set({ activeTopicPath: topicPath });
    try {
      // Header-scoped query: the server resolves manual + branch from the active scope, so the
      // editor never has to thread ids through its own state.
      const { assignments } = await fetchAssignments({ scope: 'all', status: 'all', topicPath });
      const assignment = assignments[0] ?? null;
      // Ignore stale responses for a topic the user already navigated away from.
      if (get().activeTopicPath !== topicPath) return;
      set({ active: assignment, error: null });
    } catch {
      if (get().activeTopicPath === topicPath) set({ active: null });
    }
  },

  async refreshLists() {
    set({ loading: true });
    try {
      const [mine, delegated] = await Promise.all([
        fetchAssignments({ scope: 'mine', status: 'active' }),
        fetchAssignments({ scope: 'delegated', status: 'active' }),
      ]);
      set({ mine: mine.assignments, delegated: delegated.assignments, loading: false, error: null });
    } catch (err) {
      set({ loading: false, error: messageOf(err) });
    }
  },

  async delegate(input) {
    set({ busy: true });
    try {
      const { assignment } = await createAssignment(input);
      set((state) => ({
        busy: false,
        error: null,
        delegated: [assignment, ...state.delegated.filter((item) => item.id !== assignment.id)],
        active: state.activeTopicPath === input.topicPath ? assignment : state.active,
      }));
      // Delegation to yourself lands in both lists, so re-read instead of splicing by hand.
      void get().refreshLists();
      return assignment;
    } catch (err) {
      set({ busy: false, error: messageOf(err) });
      return null;
    }
  },

  async reassign(id, assigneeId) {
    set({ busy: true });
    try {
      const { assignment } = await updateAssignment(id, { assigneeId });
      set((state) => ({
        busy: false,
        error: null,
        active: state.active?.id === id ? assignment : state.active,
        delegated: state.delegated.map((item) => (item.id === id ? assignment : item)),
        mine: state.mine.map((item) => (item.id === id ? assignment : item)),
      }));
      void get().refreshLists();
      return assignment;
    } catch (err) {
      set({ busy: false, error: messageOf(err) });
      return null;
    }
  },

  async setStatus(id, status) {
    set({ busy: true });
    try {
      const { assignment } = await updateAssignment(id, { status });
      set((state) => ({
        busy: false,
        error: null,
        active: state.active?.id === id ? assignment : state.active,
        mine:
          status === 'done'
            ? state.mine.filter((item) => item.id !== id)
            : state.mine.map((item) => (item.id === id ? assignment : item)),
      }));
      void get().refreshLists();
      return assignment;
    } catch (err) {
      set({ busy: false, error: messageOf(err) });
      return null;
    }
  },

  async cancel(id) {
    set({ busy: true });
    try {
      await cancelAssignmentRequest(id);
      set((state) => ({
        busy: false,
        active: state.active?.id === id ? { ...state.active, status: 'cancelled' } : state.active,
        delegated: state.delegated.filter((item) => item.id !== id),
        mine: state.mine.filter((item) => item.id !== id),
      }));
      void get().refreshLists();
    } catch (err) {
      set({ busy: false, error: messageOf(err) });
    }
  },

  dismiss(topicPath) {
    set((state) => ({ dismissed: new Set(state.dismissed).add(topicPath) }));
  },

  clear() {
    set({
      active: null,
      activeTopicPath: null,
      mine: [],
      delegated: [],
      loading: false,
      error: null,
      dismissed: new Set<string>(),
    });
  },
}));
