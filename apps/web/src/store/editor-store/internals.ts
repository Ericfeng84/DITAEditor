import {
  checkXmlWellFormed,
  DitaSemanticIndex,
  extractDitaDocumentTitle,
  extractDitaDocumentTitleFromDocument,
} from '@dita/core';
import type { DitaFileKind, DitaProfilingAttrName } from '@dita/core';
import { getCurrentLocale, onLocaleChange } from '../../i18n/index.js';
import { createInMemoryDemoWorkspace } from '../../services/demo-workspace.js';
import type { WorkspaceDiagnostic, WorkspaceFileNode } from '../../services/workspace-api';
import type { EditorWorkbenchState, OpenEditorTab } from './types.js';

export function collectFileSetFromTree(nodes: readonly WorkspaceFileNode[]): Set<string> {
  const set = new Set<string>();
  const walk = (list: readonly WorkspaceFileNode[]) => {
    for (const n of list) {
      if (n.kind === 'directory') {
        if (n.children) walk(n.children);
      } else {
        set.add(n.path);
      }
    }
  };
  walk(nodes);
  return set;
}

export function detectTopicTypeFromXml(xml: string, fallbackKind: DitaFileKind): OpenEditorTab['docType'] {
  if (fallbackKind === 'bookmap') return 'bookmap';
  if (fallbackKind === 'ditamap') return 'map';
  if (fallbackKind === 'ditaval') return 'ditaval';
  const m = /<(concept|task|reference|topic|map|bookmap)\b/.exec(xml);
  if (
    m &&
    (m[1] === 'concept' ||
      m[1] === 'task' ||
      m[1] === 'reference' ||
      m[1] === 'topic' ||
      m[1] === 'map' ||
      m[1] === 'bookmap')
  ) {
    return m[1];
  }
  return 'topic';
}

export function extractTitleSafe(xml: string, fallback: string): string {
  return extractDitaDocumentTitle(xml) ?? fallback;
}

export function extractTitleFromCheck(
  check: ReturnType<typeof checkXmlWellFormed>,
  fallback: string,
): string {
  return check.ok
    ? (extractDitaDocumentTitleFromDocument(check.parsed.document) ?? fallback)
    : fallback;
}

export function lineNumberToOffset(text: string, line: number): number {
  if (line <= 1) return 0;
  let current = 1;
  let idx = 0;
  while (current < line && idx < text.length) {
    const nl = text.indexOf('\n', idx);
    if (nl === -1) return text.length;
    idx = nl + 1;
    current++;
  }
  return idx;
}

export const EMPTY_PROFILING_CATALOG: Record<DitaProfilingAttrName, string[]> = {
  audience: [],
  platform: [],
  product: [],
  otherprops: [],
  props: [],
  rev: [],
};

export const memorySemanticIndex = new DitaSemanticIndex();
memorySemanticIndex.setUiLocale(getCurrentLocale());
onLocaleChange((locale) => memorySemanticIndex.setUiLocale(locale));
/**
 * Mutable module-level runtime state shared by `runtime.ts` and the demo semantic index.
 * Kept in one holder so both modules observe the same generation counter and timers.
 */
export const storeRuntimeState = {
  overlayDebounceTimers: new Map<string, ReturnType<typeof setTimeout>>(),
  semanticsDebounceTimer: null as ReturnType<typeof setTimeout> | null,
  workspaceGeneration: 0,
};

/** Content last pushed into `memorySemanticIndex`, so incremental sync can diff. */
const memoryIndexContents = new Map<string, string>();

export function cancelOverlayRefresh(filePath: string): void {
  const timer = storeRuntimeState.overlayDebounceTimers.get(filePath);
  if (timer) {
    clearTimeout(timer);
    storeRuntimeState.overlayDebounceTimers.delete(filePath);
  }
}

export function cancelAllPendingRefreshes(): void {
  storeRuntimeState.workspaceGeneration += 1;
  for (const timer of storeRuntimeState.overlayDebounceTimers.values()) {
    clearTimeout(timer);
  }
  storeRuntimeState.overlayDebounceTimers.clear();
  if (storeRuntimeState.semanticsDebounceTimer) {
    clearTimeout(storeRuntimeState.semanticsDebounceTimer);
    storeRuntimeState.semanticsDebounceTimer = null;
  }
}

/**
 * Reset the demo-mode semantic index and mirror cache together on workspace reload/import.
 */
export function resetMemorySemanticIndex(files: Record<string, string>): void {
  memoryIndexContents.clear();
  memorySemanticIndex.loadFiles(files);
  for (const [filePath, content] of Object.entries(files)) {
    memoryIndexContents.set(filePath, content);
  }
}

/**
 * Overlay live unsaved map buffers and open tab buffers onto `memoryFiles` so semantic refreshes
 * in demo mode reflect in-progress edits rather than reverting them to the last saved snapshot.
 */
export function collectMemoryIndexFiles(
  state: Pick<EditorWorkbenchState, 'memoryFiles' | 'mapBuffers' | 'openTabs'>,
): Record<string, string> {
  const merged: Record<string, string> = { ...state.memoryFiles };
  for (const [filePath, buf] of Object.entries(state.mapBuffers)) {
    merged[filePath] = buf.xml;
  }
  for (const tab of state.openTabs) {
    merged[tab.path] = tab.xml;
  }
  return merged;
}

/**
 * Incrementally reconcile the demo-mode semantic index with the workspace file
 * map. Editing a large project used to re-parse every file on each keystroke.
 */
export function syncMemorySemanticIndex(files: Record<string, string>): void {
  for (const [filePath, content] of Object.entries(files)) {
    if (memoryIndexContents.get(filePath) === content) continue;
    memoryIndexContents.set(filePath, content);
    memorySemanticIndex.updateFile(filePath, content);
  }
  for (const filePath of Array.from(memoryIndexContents.keys())) {
    if (filePath in files) continue;
    memoryIndexContents.delete(filePath);
    memorySemanticIndex.removeFile(filePath);
  }
}

export function updateMemoryIndexFile(filePath: string, content: string): void {
  memoryIndexContents.set(filePath, content);
  memorySemanticIndex.updateFile(filePath, content);
}

export function computeMemoryDiagnostics(
  files: Record<string, string>,
  assets: Record<string, string>,
  rootMapPath: string | null,
): WorkspaceDiagnostic[] {
  syncMemorySemanticIndex(files);
  return memorySemanticIndex.collectSemanticDiagnostics(rootMapPath, {
    assetPaths: new Set(Object.keys(assets)),
  });
}

export const initialMemoryDemo = createInMemoryDemoWorkspace();
export const initialFileSet = collectFileSetFromTree(initialMemoryDemo.snapshot.files);
resetMemorySemanticIndex(initialMemoryDemo.files);

