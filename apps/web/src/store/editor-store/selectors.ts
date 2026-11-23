import { DITA_MAP_CONTAINER_NODE_TAGS } from '@dita/core';
import { computeXmlLineDiffStats } from '../../editor/bridge/xml-bridge';
import type { IdentityRole } from '../../services/identity-api';
import { resolveFileEditability } from '../../services/lock-helpers';
import type { LockLike } from '../../services/lock-helpers';
import type { EditorWorkbenchState, OpenEditorTab } from './types.js';

export function selectActiveTab(state: Pick<EditorWorkbenchState, 'openTabs' | 'activeTabPath'>): OpenEditorTab | null {
  if (!state.activeTabPath) return state.openTabs[0] ?? null;
  return state.openTabs.find((t) => t.path === state.activeTabPath) ?? state.openTabs[0] ?? null;
}

export function getTabDiffStats(tab: OpenEditorTab | null) {
  if (!tab) {
    return { changedLines: 0, addedLines: 0, removedLines: 0, isIdentical: true };
  }
  return computeXmlLineDiffStats(tab.baselineXml, tab.xml);
}

export function isDitaContainerTagName(tagName: string): boolean {
  return DITA_MAP_CONTAINER_NODE_TAGS.has(tagName);
}


export type AiApplyMode = 'apply' | 'checkout-and-apply' | 'preview-only';

export interface ResolveAiApplyModeInput {
  role: IdentityRole | null | undefined;
  userId: string | null | undefined;
  filePath: string | null | undefined;
  locks: readonly LockLike[];
  workspaceMode: 'api' | 'memory';
}

/**
 * Decide how an AI proposal may reach the editor buffer. The offline demo has no server
 * locks, admins and owners apply directly, an unlocked writer gets a checkout step, and
 * viewers / files locked by someone else stay preview-only (contract §4).
 */
export function resolveAiApplyMode(input: ResolveAiApplyModeInput): AiApplyMode {
  if (input.workspaceMode === 'memory') return 'apply';
  const editability = resolveFileEditability(input);
  if (editability.state === 'admin' || editability.state === 'owned') return 'apply';
  if (editability.state === 'unlocked' && input.role === 'writer' && input.filePath) {
    return 'checkout-and-apply';
  }
  return 'preview-only';
}
