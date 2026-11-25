import { create } from 'zustand';
import {
  cancelPublishJob,
  createPublishJob,
  fetchHtmlThemes,
  fetchPublishJob,
  fetchPublishJobs,
  fetchPublishProfile,
  fetchPublishRuntime,
  runStrictValidation as requestStrictValidation,
  savePublishProfile,
  type CreatePublishJobInput,
  type HtmlThemeDescriptor,
  type HtmlThemeId,
  type HtmlThemeOptions,
  type ManualPublishProfile,
  type PublishJob,
  type PublishRuntimeInfo,
  type StrictValidationInput,
  type StrictValidationResult,
} from '../services/publish-api.js';

/** Async load state for the theme catalogue and the manual publish profile. */
export type PublishLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PublishState {
  runtime: PublishRuntimeInfo | null;
  runtimeLoading: boolean;
  runtimeError: string | null;
  themes: HtmlThemeDescriptor[];
  themesStatus: PublishLoadStatus;
  themesError: string | null;
  profile: ManualPublishProfile | null;
  profileStatus: PublishLoadStatus;
  profileError: string | null;
  savingProfile: boolean;
  profileSaveError: string | null;
  profileSaved: boolean;
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
  loadThemes: () => Promise<void>;
  loadProfile: () => Promise<void>;
  saveProfile: (
    themeId: HtmlThemeId,
    themeOptions: HtmlThemeOptions,
  ) => Promise<ManualPublishProfile | null>;
  loadJobs: () => Promise<void>;
  createJob: (input: CreatePublishJobInput) => Promise<PublishJob | null>;
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
  themes: [],
  themesStatus: 'idle',
  themesError: null,
  profile: null,
  profileStatus: 'idle',
  profileError: null,
  savingProfile: false,
  profileSaveError: null,
  profileSaved: false,
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

  loadThemes: async () => {
    set({ themesStatus: 'loading', themesError: null });
    try {
      const themes = await fetchHtmlThemes();
      set({ themes, themesStatus: 'ready' });
    } catch (error) {
      set({ themesStatus: 'error', themesError: messageOf(error) });
    }
  },

  loadProfile: async () => {
    set({ profileStatus: 'loading', profileError: null });
    try {
      const profile = await fetchPublishProfile();
      set({ profile, profileStatus: 'ready' });
    } catch (error) {
      set({ profileStatus: 'error', profileError: messageOf(error) });
    }
  },

  saveProfile: async (themeId, themeOptions) => {
    set({ savingProfile: true, profileSaveError: null, profileSaved: false });
    try {
      const profile = await savePublishProfile({ themeId, themeOptions });
      set({ profile, profileStatus: 'ready', savingProfile: false, profileSaved: true });
      return profile;
    } catch (error) {
      set({ savingProfile: false, profileSaveError: messageOf(error) });
      return null;
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
      // The create request also persists the manual default; refresh so the "default theme"
      // badge follows without a reload.
      if (input.saveAsDefault && input.themeId && input.themeId !== 'vanilla') {
        void get().loadProfile();
      }
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
