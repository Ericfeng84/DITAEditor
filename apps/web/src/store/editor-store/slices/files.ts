import {
  DITA_KEY_NAME_PATTERN,
  appendReusableFragmentToTopicXml,
  classifyDitaFileKind,
  createMapTemplate,
  createTopicTemplate,
  createWarehouseTopicTemplate,
} from '@dita/core';
import { getCurrentLocale, t } from '../../../i18n/index.js';
import {
  fetchFileContent,
  createWorkspaceDir,
  createWorkspaceFile,
  deleteWorkspaceEntry,
  renameWorkspaceEntry,
  saveFileContent,
} from '../../../services/workspace-api';
import { ensureFileCheckedOut } from '../../git-store';
import { extractTitleSafe, nextWorkbenchAlert } from '../internals.js';
import type { EditorWorkbenchState, StoreGet, StoreSet } from '../types.js';
import type { StoreRuntime } from '../runtime.js';

/** Default location of the shared reuse warehouse topic. */
const DEFAULT_WAREHOUSE_PATH = 'reuse/common-snippets.dita';

/**
 * Normalize a warehouse path to a workspace-relative `.dita` path, appending `-2`, `-3`, … when the
 * path is already taken so creating a warehouse never overwrites an author's topic.
 */
function normalizeWarehousePath(rawPath: string | undefined, exists: (path: string) => boolean): string {
  let path = (rawPath ?? DEFAULT_WAREHOUSE_PATH).trim().replace(/\\/g, '/').replace(/^\.?\/+/, '');
  if (!path) path = DEFAULT_WAREHOUSE_PATH;
  if (!path.toLowerCase().endsWith('.dita')) path = `${path}.dita`;
  if (!exists(path)) return path;
  const dot = path.lastIndexOf('.');
  const stem = dot > 0 ? path.slice(0, dot) : path;
  const ext = dot > 0 ? path.slice(dot) : '.dita';
  let counter = 2;
  while (exists(`${stem}-${counter}${ext}`)) counter += 1;
  return `${stem}-${counter}${ext}`;
}

/** Topic `@id` for a warehouse file: the file stem, sanitized to the DITA id charset. */
function deriveWarehouseTopicId(filePath: string): string {
  const stem = (filePath.split('/').pop() ?? 'common-snippets').replace(/\.dita$/i, '');
  const cleaned = stem.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  const safe = cleaned || 'topic_warehouse';
  return /^[A-Za-z_]/.test(safe) ? safe : `topic_${safe}`;
}

/** Default root-map key name for a warehouse file (`reuse/common-snippets.dita` -> `common-snippets`). */
function deriveWarehouseKeyName(filePath: string): string {
  const stem = (filePath.split('/').pop() ?? 'common-snippets').replace(/\.dita$/i, '');
  return stem.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'reuse';
}

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

    async createWarehouseTopic(options = {}) {
      const state = get();
      const lang = options.lang ?? getCurrentLocale();
      const exists = (path: string) => state.fileSet.has(path) || state.memoryFiles[path] !== undefined;
      const filePath = normalizeWarehousePath(options.filePath, exists);
      const activeRootMapPath = state.activeRootMapPath;
      const mountKey = options.mountKeyInRootMap === true && Boolean(activeRootMapPath);
      const keyName = (options.keyName ?? deriveWarehouseKeyName(filePath)).trim();

      if (mountKey && !DITA_KEY_NAME_PATTERN.test(keyName)) {
        set({
          alert: nextWorkbenchAlert({
            tone: 'error',
            message: t('reuse.invalidKeyName', { key: keyName }),
          }),
        });
        return { ok: false };
      }

      // Check the root map out *before* touching the workspace: a map we cannot edit would leave a
      // warehouse topic behind with no key pointing at it.
      if (mountKey && activeRootMapPath) {
        const editable = await get().ensureMapEditable(activeRootMapPath);
        if (!editable) return { ok: false };
      }

      const topicId = deriveWarehouseTopicId(filePath);
      const title = options.title?.trim() ?? '';
      const xml = createWarehouseTopicTemplate({
        id: topicId,
        ...(title ? { title } : {}),
        lang,
      });

      if (state.workspaceMode === 'api') {
        await createWorkspaceFile({
          path: filePath,
          kind: 'topic',
          id: topicId,
          ...(title ? { title } : {}),
          lang,
          content: xml,
        });
      } else {
        set((s) => ({ memoryFiles: { ...s.memoryFiles, [filePath]: xml } }));
      }
      await get().refreshWorkspaceTree();

      if (mountKey && activeRootMapPath) {
        const created = await get().createMapKey({
          mapPath: activeRootMapPath,
          parentPath: null,
          keyName,
          bindingKind: 'file',
          targetFilePath: filePath,
        });
        // Persist the map right away: the semantic indexer resolves `conkeyref` from disk, so an
        // unsaved key would make the freshly inserted snippet look broken.
        if (created.ok && state.workspaceMode === 'api') {
          await get().saveFile(activeRootMapPath);
        }
      }

      await get().refreshSemantics();
      await get().refreshDiagnostics();
      set({ statusMessage: t('status.warehouseCreated', { path: filePath }) });
      return { ok: true, filePath, ...(mountKey ? { keyName } : {}) };
    },

    async addReusableFragmentToTopic(options) {
      const state = get();
      const targetFilePath = options.targetFilePath;
      const openTab = state.openTabs.find((tab) => tab.path === targetFilePath) ?? null;
      let currentXml: string | null = openTab?.xml ?? null;
      let currentHash: string | undefined = openTab?.contentHash ?? undefined;

      if (currentXml === null) {
        if (state.workspaceMode === 'api') {
          const guard = await ensureFileCheckedOut(targetFilePath);
          if (!guard.ok) {
            set({
              alert: nextWorkbenchAlert({
                tone: 'error',
                message: t('reuse.checkoutBlocked', {
                  path: targetFilePath,
                  message: guard.message,
                }),
              }),
            });
            return { ok: false, error: guard.message };
          }
          try {
            const file = await fetchFileContent(targetFilePath);
            currentXml = file.content;
            currentHash = file.contentHash;
          } catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            set({
              alert: nextWorkbenchAlert({
                tone: 'error',
                message: t('reuse.readFailed', { path: targetFilePath, message: error }),
              }),
            });
            return { ok: false, error };
          }
        } else {
          currentXml = state.memoryFiles[targetFilePath] ?? null;
        }
      }

      if (currentXml === null) {
        return { ok: false, error: t('reuse.fileMissing', { path: targetFilePath }) };
      }

      const res = appendReusableFragmentToTopicXml(currentXml, {
        tagName: options.tagName,
        elementId: options.elementId,
        ...(options.textContent !== undefined ? { textContent: options.textContent } : {}),
        ...(options.fragmentXml !== undefined ? { fragmentXml: options.fragmentXml } : {}),
      });
      if (!res.ok) return { ok: false, error: res.error };

      const nextXml = res.xml;
      if (openTab) {
        const nextTitle = extractTitleSafe(nextXml, openTab.title) ?? openTab.title;
        set((s) => ({
          openTabs: s.openTabs.map((tab) =>
            tab.path === targetFilePath
              ? {
                  ...tab,
                  xml: nextXml,
                  title: nextTitle,
                  xmlError: null,
                  visualReloadToken: tab.visualReloadToken + 1,
                }
              : tab,
          ),
          ...(s.workspaceMode === 'memory'
            ? { memoryFiles: { ...s.memoryFiles, [targetFilePath]: nextXml } }
            : {}),
        }));
        if (state.workspaceMode === 'api') {
          const saved = await get().saveFileEnsuringLock(targetFilePath, { refresh: false });
          if (!saved) {
            return { ok: false, error: t('reuse.saveFailed', { path: targetFilePath }) };
          }
        }
      } else if (state.workspaceMode === 'api') {
        try {
          await saveFileContent(targetFilePath, nextXml, true, currentHash);
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          set({
            alert: nextWorkbenchAlert({
              tone: 'error',
              message: t('reuse.saveFailed', { path: targetFilePath, message: error }),
            }),
          });
          return { ok: false, error };
        }
      } else {
        set((s) => ({ memoryFiles: { ...s.memoryFiles, [targetFilePath]: nextXml } }));
      }

      await get().refreshWorkspaceTree();
      await get().refreshSemantics();
      await get().refreshDiagnostics();
      return {
        ok: true,
        filePath: targetFilePath,
        topicId: res.topicId,
        elementId: res.elementId,
        tagName: res.tagName,
      };
    },
  } satisfies Partial<EditorWorkbenchState>;
}
