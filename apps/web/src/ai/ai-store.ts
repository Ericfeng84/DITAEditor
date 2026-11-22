import { create } from 'zustand';
import {
  fetchAiConfig,
  fetchAiUsage,
  saveAiConfig,
  streamAiRequest,
  testAiConfig,
} from './ai-api';
import type {
  AiConfigPatch,
  AiConfigTestInput,
  AiConfigTestResult,
  AiDiagnosticContext,
  AiDoneEvent,
  AiMetaEvent,
  AiProposal,
  AiProposalVerification,
  AiPublicConfig,
  AiRetryEvent,
  AiStreamRequest,
  AiSubAction,
  AiTargetSpec,
  AiTaskType,
  AiUsageSummary,
} from './ai-types';

export type AiPhase = 'idle' | 'streaming' | 'proposal' | 'error';
export type AiPanelTab = 'chat' | 'settings' | 'usage';

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

/** A pending launch request prepared by an editor entry point (toolbar, diagnostic, XML error). */
export interface AiPanelIntent {
  taskType: AiTaskType;
  target: AiTargetSpec;
  instruction?: string;
  subAction?: AiSubAction;
  diagnostics?: AiDiagnosticContext[];
  /** Send immediately instead of only prefilling the composer. */
  autoSend?: boolean;
  projectPath?: string;
}

interface AiPanelState {
  panelOpen: boolean;
  tab: AiPanelTab;
  phase: AiPhase;
  messages: AiChatMessage[];
  draft: string;
  deltaText: string;
  proposal: AiProposal | null;
  verification: AiProposalVerification | null;
  applied: boolean;
  error: string | null;
  meta: AiMetaEvent | null;
  retry: AiRetryEvent | null;
  done: AiDoneEvent | null;
  pendingIntent: AiPanelIntent | null;
  config: AiPublicConfig | null;
  configLoading: boolean;
  configError: string | null;
  usage: AiUsageSummary | null;
  usageLoading: boolean;
  usageError: string | null;

  openPanel: (intent?: AiPanelIntent) => void;
  closePanel: () => void;
  setTab: (tab: AiPanelTab) => void;
  setDraft: (draft: string) => void;
  setIntent: (intent: AiPanelIntent | null) => void;
  send: (request: AiStreamRequest) => Promise<void>;
  cancel: () => void;
  dismissProposal: () => void;
  markApplied: () => void;
  applyProposal: () => void;
  loadConfig: () => Promise<void>;
  saveConfig: (patch: AiConfigPatch) => Promise<boolean>;
  testConfig: (input: AiConfigTestInput) => Promise<AiConfigTestResult>;
  loadUsage: (days?: number, limit?: number) => Promise<void>;
  reset: () => void;
}

let streamController: AbortController | null = null;

function createId(): string {
  const randomUuid = globalThis.crypto?.randomUUID;
  if (typeof randomUuid === 'function') return randomUuid.call(globalThis.crypto);
  return `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

const INITIAL_STATE = {
  panelOpen: false,
  tab: 'chat' as AiPanelTab,
  phase: 'idle' as AiPhase,
  messages: [] as AiChatMessage[],
  draft: '',
  deltaText: '',
  proposal: null,
  verification: null as AiProposalVerification | null,
  applied: false,
  error: null,
  meta: null,
  retry: null,
  done: null,
  pendingIntent: null,
  config: null,
  configLoading: false,
  configError: null,
  usage: null,
  usageLoading: false,
  usageError: null,
};

export const useAiStore = create<AiPanelState>((set, get) => {
  const markApplied = () => {
    set((state) =>
      state.proposal
        ? { applied: true, phase: 'proposal' as AiPhase }
        : { applied: false },
    );
  };

  return {
    ...INITIAL_STATE,

    openPanel(intent) {
      set((state) => ({
        panelOpen: true,
        ...(intent
          ? {
              pendingIntent: intent,
              draft: intent.instruction ?? state.draft,
              error: null,
            }
          : {}),
      }));
    },

    closePanel() {
      set({ panelOpen: false });
    },

    setTab(tab) {
      set({ tab });
    },

    setDraft(draft) {
      set({ draft });
    },

    setIntent(intent) {
      set((state) => ({
        pendingIntent: intent,
        ...(intent?.instruction !== undefined ? { draft: intent.instruction } : {}),
      }));
    },

    async send(request) {
      if (get().phase === 'streaming') return;
      streamController?.abort();
      const controller = new AbortController();
      streamController = controller;

      const userMessage: AiChatMessage = {
        id: createId(),
        role: 'user',
        content: request.instruction,
      };
      const assistantMessage: AiChatMessage = {
        id: createId(),
        role: 'assistant',
        content: '',
      };
      set((state) => ({
        panelOpen: true,
        phase: 'streaming',
        messages: [...state.messages, userMessage, assistantMessage],
        draft: '',
        deltaText: '',
        proposal: null,
        verification: null,
        applied: false,
        error: null,
        meta: null,
        retry: null,
        done: null,
      }));

      const appendDelta = (text: string) => {
        set((state) => {
          const messages = [...state.messages];
          const last = messages[messages.length - 1];
          if (last?.role === 'assistant') {
            messages[messages.length - 1] = { ...last, content: last.content + text };
          }
          return { deltaText: state.deltaText + text, messages };
        });
      };

      try {
        await streamAiRequest(
          request,
          {
            onMeta: (meta) => set({ meta }),
            onDelta: appendDelta,
            onRetry: (retry) => set({ retry }),
            onProposal: (proposal) => {
              set((state) => {
                const messages = [...state.messages];
                const last = messages[messages.length - 1];
                if (last?.role === 'assistant' && !last.content.trim()) {
                  messages[messages.length - 1] = {
                    ...last,
                    content: proposal.explanation,
                  };
                }
                return {
                  proposal,
                  verification: proposal.verification,
                  phase: 'proposal' as AiPhase,
                  applied: false,
                  error: null,
                  messages,
                };
              });
            },
            onError: (event) =>
              set({ error: event.message, phase: 'error', done: null }),
            onDone: (done) => {
              set((state) => ({
                done,
                phase:
                  state.phase === 'streaming'
                    ? done.status === 'failed'
                      ? 'error'
                      : 'idle'
                    : state.phase,
              }));
            },
          },
          controller.signal,
        );
      } catch (error) {
        if (isAbortError(error) || controller.signal.aborted) {
          set({ phase: 'idle' });
        } else {
          set({ error: errorMessage(error), phase: 'error' });
        }
      } finally {
        if (streamController === controller) streamController = null;
      }
    },

    cancel() {
      streamController?.abort();
      streamController = null;
      set({ phase: 'idle', error: null });
    },

    dismissProposal() {
      set({
        proposal: null,
        verification: null,
        applied: false,
        phase: get().phase === 'proposal' ? 'idle' : get().phase,
      });
    },

    markApplied,
    applyProposal: markApplied,

    async loadConfig() {
      set({ configLoading: true, configError: null });
      try {
        const config = await fetchAiConfig();
        set({ config, configLoading: false });
      } catch (error) {
        set({ configLoading: false, configError: errorMessage(error) });
      }
    },

    async saveConfig(patch) {
      set({ configLoading: true, configError: null });
      try {
        const config = await saveAiConfig(patch);
        set({ config, configLoading: false });
        return true;
      } catch (error) {
        set({ configLoading: false, configError: errorMessage(error) });
        return false;
      }
    },

    async testConfig(input) {
      return testAiConfig(input);
    },

    async loadUsage(days = 30, limit = 50) {
      set({ usageLoading: true, usageError: null });
      try {
        const usage = await fetchAiUsage(days, limit);
        set({ usage, usageLoading: false });
      } catch (error) {
        set({ usageLoading: false, usageError: errorMessage(error) });
      }
    },

    reset() {
      streamController?.abort();
      streamController = null;
      set({ ...INITIAL_STATE });
    },
  };
});

/** Test helper: abort any in-flight stream and restore the initial store state. */
export function resetAiStore(): void {
  useAiStore.getState().reset();
}
