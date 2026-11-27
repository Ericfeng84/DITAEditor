import {
  classifyDitaFileKind,
  createMapTemplate,
  createTopicTemplate,
} from '@dita/core';
import { t } from '../../../i18n/index.js';
import {
  createWorkspaceDir,
  createWorkspaceFile,
  deleteWorkspaceEntry,
  renameWorkspaceEntry,
  saveFileContent,
} from '../../../services/workspace-api';
import type { EditorWorkbenchState, StoreGet, StoreSet } from '../types.js';
import type { StoreRuntime } from '../runtime.js';

/** Workbench state slice: see `EditorWorkbenchState` in `../types.ts`. */
export function createFilesSlice(
  set: StoreSet,
  get: StoreGet,
  runtime: StoreRuntime,
) {
  return {
    async createStandaloneTopic(type, id, title, lang, targetDir = 'concepts') {
      const cleanId =
        id
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, '_')
          .replace(/^_+|_+$/g, '') || `${type}_${Date.now().toString(36)}`;
      const slug = cleanId.replace(/_/g, '-');
      const dir = targetDir.trim().replace(/^\/+|\/+$/g, '');
      let relPath = dir ? `${dir}/${slug}.dita` : `${slug}.dita`;
      if (get().fileSet.has(relPath)) {
        relPath = dir
          ? `${dir}/${slug}-${Date.now().toString(36).slice(-4)}.dita`
          : `${slug}-${Date.now().toString(36).slice(-4)}.dita`;
      }

      const xml = createTopicTemplate(type, { id: cleanId, title, lang });
      if (get().workspaceMode === 'api') {
        await createWorkspaceFile({ path: relPath, kind: type, id: cleanId, title, lang, content: xml });
      } else {
        set((s) => ({ memoryFiles: { ...s.memoryFiles, [relPath]: xml } }));
      }
      await get().refreshWorkspaceTree();
      await get().refreshSemantics();
      await get().openFileTab(relPath, { mode: 'visual' });
      set({ statusMessage: t('status.created', { path: relPath }) });
    },

    async createNewMapFile({ kind, fileName, id, title, lang, targetDir = '' }) {
      const rawName = fileName.trim() || id.trim() || `${kind}-${Date.now().toString(36).slice(-4)}`;
      const withExt = rawName.endsWith('.ditamap') ? rawName : `${rawName}.ditamap`;
      const dir = targetDir.trim().replace(/^\/+|\/+$/g, '');
      const relPath = dir ? `${dir}/${withExt}` : withExt;
      const xml = createMapTemplate(kind, { id, title, lang });

      if (get().workspaceMode === 'api') {
        await createWorkspaceFile({ path: relPath, kind, id, title, lang, content: xml });
      } else {
        set((s) => ({ memoryFiles: { ...s.memoryFiles, [relPath]: xml } }));
      }

      await get().refreshWorkspaceTree();
      await get().selectRootMap(relPath);
      await get().openFileTab(relPath, { mode: 'source' });
      set({ statusMessage: t('status.createdActive', { path: relPath }) });
    },

    async importSingleLocalFile(fileName, content) {
      const kind = classifyDitaFileKind(fileName);
      const baseName = fileName.split('/').pop() ?? fileName;
      const relPath = kind === 'ditamap' ? baseName : `imported/${baseName}`;

      if (get().workspaceMode === 'api') {
        await saveFileContent(relPath, content, true);
      } else {
        set((s) => ({ memoryFiles: { ...s.memoryFiles, [relPath]: content } }));
      }

      await get().refreshWorkspaceTree();
      if (kind === 'ditamap') {
        await get().selectRootMap(relPath);
      } else {
        await get().refreshSemantics();
      }
      await get().openFileTab(relPath);
      set({ statusMessage: t('status.imported', { path: relPath }) });
    },

    async createWorkspaceFolder(dirPath) {
      const clean = dirPath.trim().replace(/^\/+|\/+$/g, '');
      if (!clean) return;
      if (get().workspaceMode === 'api') {
        await createWorkspaceDir(clean);
      }
      await get().refreshWorkspaceTree();
      set({ statusMessage: t('status.createdDir', { path: clean }) });
    },

    async renameWorkspaceFile(fromPath, toPath) {
      if (get().workspaceMode === 'api') {
        await renameWorkspaceEntry(fromPath, toPath);
      } else {
        const files = { ...get().memoryFiles };
        if (files[fromPath] !== undefined) {
          files[toPath] = files[fromPath]!;
          delete files[fromPath];
          set({ memoryFiles: files });
        }
      }

      set((s) => ({
        openTabs: s.openTabs.map((t) =>
          t.path === fromPath
            ? { ...t, path: toPath, fileName: toPath.split('/').pop() ?? toPath }
            : t,
        ),
        activeTabPath: s.activeTabPath === fromPath ? toPath : s.activeTabPath,
        activeRootMapPath: s.activeRootMapPath === fromPath ? toPath : s.activeRootMapPath,
      }));
      await get().refreshWorkspaceTree();
      await get().refreshSemantics();
      await get().refreshDiagnostics();
      set({ statusMessage: t('status.renamed', { from: fromPath, to: toPath }) });
    },

    async deleteWorkspaceFile(filePath) {
      if (get().workspaceMode === 'api') {
        await deleteWorkspaceEntry(filePath);
      } else {
        const files = { ...get().memoryFiles };
        delete files[filePath];
        set({ memoryFiles: files });
      }

      get().closeTab(filePath);
      await get().refreshWorkspaceTree();
      await get().refreshSemantics();
      await get().refreshDiagnostics();
      set({ statusMessage: t('status.deleted', { path: filePath }) });
    },


  } satisfies Partial<EditorWorkbenchState>;
}
