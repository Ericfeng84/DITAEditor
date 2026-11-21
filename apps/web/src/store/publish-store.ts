import { create } from 'zustand';
import {
  cancelPublishJob,
  createPublishJob,
  fetchPublishJob,
  fetchPublishJobs,
  fetchPublishRuntime,
  runStrictValidation as requestStrictValidation,
  type PublishFormat,
  type PublishJob,
  type PublishRuntimeInfo,
  type StrictValidationInput,
  type StrictValidationResult,
} from '../services/publish-api.js';

interface CreateJobInput {
  rootMap: string;
  format: PublishFormat;
  ditaval?: string | null;
  title?: string;
}

export interface PublishState {
  runtime: PublishRuntimeInfo | null;
  runtimeLoading: boolean;
  runtimeError: string | null;
  jobs: PublishJob[];
  jobsLoading: boolean;
  activeJobId: string | null;
  actionError: string | null;
  submitting: boolean;
  cancelling: boolean;
  strictResult: StrictValidationResult | null;
  strictRunning: boolean;
  strictError: string | null;
  strictTargets: string[];
  loadRuntime: () => Promise<void>;
  loadJobs: () => Promise<void>;
  createJob: (input: CreateJobInput) => Promise<PublishJob | null>;
  cancelJob: (id: string) => Promise<void>;
  selectJob: (id: string | null) => void;
  refreshJob: (id: string) => Promise<void>;
  runStrictValidation: (input: StrictValidationInput) => Promise<StrictValidationResult | null>;
  clearStrictValidation: () => void;
  clearActionError: () => void;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const usePublishStore = create<PublishState>((set, get) => ({
  runtime: null,
  runtimeLoading: false,
  runtimeError: null,
  jobs: [],
  jobsLoading: false,
  activeJobId: null,
  actionError: null,
  submitting: false,
  cancelling: false,
  strictResult: null,
  strictRunning: false,
  strictError: null,
  strictTargets: [],

  loadRuntime: async () => {
    set({ runtimeLoading: true, runtimeError: null });
    try {
      const { runtime } = await fetchPublishRuntime();
      set({ runtime, runtimeLoading: false });
    } catch (error) {
      set({ runtimeLoading: false, runtimeError: messageOf(error) });
    }
  },

  loadJobs: async () => {
    set({ jobsLoading: true });
    try {
      const { jobs } = await fetchPublishJobs(30);
      set((state) => ({
        jobs,
        jobsLoading: false,
        activeJobId:
          state.activeJobId && jobs.some((job) => job.id === state.activeJobId)
            ? state.activeJobId
            : (jobs[0]?.id ?? null),
      }));
    } catch (error) {
      set({ jobsLoading: false, actionError: messageOf(error) });
    }
  },

  createJob: async (input) => {
    set({ submitting: true, actionError: null });
    try {
      const job = await createPublishJob(input);
      set((state) => ({
        submitting: false,
        jobs: [job, ...state.jobs.filter((existing) => existing.id !== job.id)],
        activeJobId: job.id,
      }));
      return job;
    } catch (error) {
      set({ submitting: false, actionError: messageOf(error) });
      return null;
    }
  },

  cancelJob: async (id) => {
    set({ cancelling: true, actionError: null });
    try {
      const job = await cancelPublishJob(id);
      set((state) => ({
        cancelling: false,
        jobs: state.jobs.map((existing) => (existing.id === job.id ? job : existing)),
      }));
    } catch (error) {
      set({ cancelling: false, actionError: messageOf(error) });
    }
  },

  selectJob: (id) => set({ activeJobId: id }),

  refreshJob: async (id) => {
    try {
      const job = await fetchPublishJob(id);
      set((state) => ({
        jobs: state.jobs.map((existing) => (existing.id === job.id ? job : existing)),
      }));
    } catch {
      // The log stream may outlive a job that was pruned; keep the last known state.
    }
  },

  runStrictValidation: async (input) => {
    const targets = input.paths ?? (input.path ? [input.path] : input.rootMapPath ? [input.rootMapPath] : []);
    set({ strictRunning: true, strictError: null, strictTargets: targets });
    try {
      const result = await requestStrictValidation(input);
      set({ strictResult: result, strictRunning: false });
      return result;
    } catch (error) {
      set({ strictRunning: false, strictError: messageOf(error) });
      return null;
    }
  },

  clearStrictValidation: () =>
    set({ strictResult: null, strictError: null, strictTargets: [] }),

  clearActionError: () => set({ actionError: null }),
}));
