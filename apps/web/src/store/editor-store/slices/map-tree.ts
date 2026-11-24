import {
  checkXmlWellFormed,
  classifyDitaFileKind,
  computeRelativeDitaHref,
  createTopicTemplate,
  deleteMapNode,
  insertMapNode,
  renameMapNodeKeyToken,
  updateMapKeyValueText,
  updateMapNodeAttr,
  updateMapNodeNavtitle,
  updateMapTitle,
  type XmlAttributeEntry,
} from '@dita/core';
import { planMapNodeMove } from '../../../map-tree/map-tree-utils';
import { t } from '../../../i18n/index.js';
import {
  createWorkspaceFile,
} from '../../../services/workspace-api';
import {
  extractTitleFromCheck,
} from '../internals.js';
import type { EditorWorkbenchState, StoreGet, StoreSet } from '../types.js';
import type { StoreRuntime } from '../runtime.js';

/** Workbench state slice: see `EditorWorkbenchState` in `../types.ts`. */
export function createMapTreeSlice(
  set: StoreSet,
  get: StoreGet,
  runtime: StoreRuntime,
) {
  return {
    mutateMapXml(mapPath, nextXml, announcement) {
      const state = get();
      const prevBuf = state.mapBuffers[mapPath];
      if (!prevBuf || prevBuf.xml === nextXml) return;

      const check = checkXmlWellFormed(nextXml, { position: false });
      const nextTitle = extractTitleFromCheck(check, mapPath.split('/').pop() ?? mapPath);

      set((s) => ({
        mapBuffers: {
          ...s.mapBuffers,
          [mapPath]: {
            ...prevBuf,
            xml: nextXml,
            undoStack: [...prevBuf.undoStack.slice(-39), prevBuf.xml],
            redoStack: [],
            xmlError: check.ok ? null : check.error,
          },
        },
        openTabs: s.openTabs.map((t) =>
          t.path === mapPath
            ? {
                ...t,
                xml: nextXml,
                title: nextTitle,
                xmlError: check.ok ? null : check.error,
                visualReloadToken: t.visualReloadToken + 1,
              }
            : t,
        ),
        workspaceMaps: s.workspaceMaps.map((m) =>
          m.path === mapPath ? { ...m, title: nextTitle } : m,
        ),
        statusMessage: announcement ?? s.statusMessage,
      }));

      if (state.workspaceMode === 'memory') {
        set((s) => ({
          memoryFiles: { ...s.memoryFiles, [mapPath]: nextXml },
        }));
        void get().refreshSemantics();
        void get().refreshDiagnostics();
      }
      if (get().activeRootMapPath) {
        void runtime.loadMapTreeBuffers(get().activeRootMapPath!, false);
      }
    },

    undoMap(mapPath) {
      const state = get();
      const buf = state.mapBuffers[mapPath];
      if (!buf || buf.undoStack.length === 0) return;

      const previousXml = buf.undoStack[buf.undoStack.length - 1]!;
      const nextUndo = buf.undoStack.slice(0, -1);
      const nextRedo = [...buf.redoStack, buf.xml];
      const check = checkXmlWellFormed(previousXml, { position: false });
      const nextTitle = extractTitleFromCheck(check, mapPath);

      set((s) => ({
        mapBuffers: {
          ...s.mapBuffers,
          [mapPath]: {
            ...buf,
            xml: previousXml,
            undoStack: nextUndo,
            redoStack: nextRedo,
            xmlError: check.ok ? null : check.error,
          },
        },
        openTabs: s.openTabs.map((t) =>
          t.path === mapPath
            ? { ...t, xml: previousXml, title: nextTitle, visualReloadToken: t.visualReloadToken + 1 }
            : t,
        ),
        memoryFiles: s.workspaceMode === 'memory' ? { ...s.memoryFiles, [mapPath]: previousXml } : s.memoryFiles,
        statusMessage: t('status.mapUndo', { path: mapPath }),
      }));
      if (state.workspaceMode === 'memory') {
        void get().refreshSemantics();
        void get().refreshDiagnostics();
      }
    },

    redoMap(mapPath) {
      const state = get();
      const buf = state.mapBuffers[mapPath];
      if (!buf || buf.redoStack.length === 0) return;

      const nextXml = buf.redoStack[buf.redoStack.length - 1]!;
      const nextRedo = buf.redoStack.slice(0, -1);
      const nextUndo = [...buf.undoStack, buf.xml];
      const check = checkXmlWellFormed(nextXml, { position: false });
      const nextTitle = extractTitleFromCheck(check, mapPath);

      set((s) => ({
        mapBuffers: {
          ...s.mapBuffers,
          [mapPath]: {
            ...buf,
            xml: nextXml,
            undoStack: nextUndo,
            redoStack: nextRedo,
            xmlError: check.ok ? null : check.error,
          },
        },
        openTabs: s.openTabs.map((t) =>
          t.path === mapPath
            ? { ...t, xml: nextXml, title: nextTitle, visualReloadToken: t.visualReloadToken + 1 }
            : t,
        ),
        memoryFiles: s.workspaceMode === 'memory' ? { ...s.memoryFiles, [mapPath]: nextXml } : s.memoryFiles,
        statusMessage: t('status.mapRedo', { path: mapPath }),
      }));
      if (state.workspaceMode === 'memory') {
        void get().refreshSemantics();
        void get().refreshDiagnostics();
      }
    },

    selectMapNode(ref, switchInspector = true) {
      set((s) => ({
        selectedMapNode: ref,
        inspectorTarget: switchInspector && ref ? 'map-node' : s.inspectorTarget,
      }));
    },

    moveMapTreeNodes(dragNodes, targetParent, index) {
      const state = get();
      if (!state.activeRootMapPath) return;

      const plan = planMapNodeMove({
        rootMapPath: state.activeRootMapPath,
        dragNodes,
        targetParentNode: targetParent,
        targetIndex: index,
        mapBuffers: state.mapBuffers,
      });

      if (!plan.ok) {
        if (plan.reason) set({ statusMessage: plan.reason });
        return;
      }

      for (const upd of plan.updates) {
        get().mutateMapXml(upd.mapPath, upd.xml, t('status.mapStructureUpdated'));
      }
    },

    async createTopicAndMountInMap({
      mapPath,
      parentPath,
      tagName,
      topicType,
      id,
      title,
      lang,
      targetDir,
    }) {
      const state = get();
      const buf = state.mapBuffers[mapPath];
      if (!buf) return;

      const cleanId =
        id
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_-]+/g, '_')
          .replace(/^_+|_+$/g, '') || `${topicType}_${Date.now().toString(36)}`;
      const slug = cleanId.replace(/_/g, '-');
      const cleanDir = targetDir.trim().replace(/^\/+|\/+$/g, '');
      let relPath = cleanDir ? `${cleanDir}/${slug}.dita` : `${slug}.dita`;
      if (state.fileSet.has(relPath)) {
        const suffix = Date.now().toString(36).slice(-4);
        relPath = cleanDir ? `${cleanDir}/${slug}-${suffix}.dita` : `${slug}-${suffix}.dita`;
      }

      const xml = createTopicTemplate(topicType, { id: cleanId, title, lang });

      if (state.workspaceMode === 'api') {
        await createWorkspaceFile({
          path: relPath,
          kind: topicType,
          id: cleanId,
          title,
          lang,
          content: xml,
        });
      } else {
        set((s) => ({
          memoryFiles: { ...s.memoryFiles, [relPath]: xml },
        }));
      }

      await get().refreshWorkspaceTree();

      const relativeHref = computeRelativeDitaHref(mapPath, relPath);
      const attrs: XmlAttributeEntry[] = [
        { name: 'href', value: relativeHref, namespaceURI: null },
        { name: 'type', value: topicType, namespaceURI: null },
      ];
      const latestMapXml = get().mapBuffers[mapPath]?.xml ?? buf.xml;
      const inserted = insertMapNode(latestMapXml, {
        parentPath,
        tagName,
        attrs,
        navtitle: title,
      });

      get().mutateMapXml(mapPath, inserted.xml, t('status.mountedNew', { path: relPath }));
      set({
        selectedMapNode: { mapPath, elementPath: inserted.insertedPath },
      });

      await get().openFileTab(relPath, { mode: 'visual' });
      await get().refreshSemantics();
      await get().refreshDiagnostics();
    },

    mountExistingFileInMap({ mapPath, parentPath, targetFilePath, tagName, navtitle }) {
      const state = get();
      const buf = state.mapBuffers[mapPath];
      if (!buf) return;

      const relativeHref = computeRelativeDitaHref(mapPath, targetFilePath);
      const kind = classifyDitaFileKind(targetFilePath);
      const isSubmap = kind === 'ditamap' || kind === 'bookmap' || tagName === 'mapref';

      const attrs: XmlAttributeEntry[] = [
        { name: 'href', value: relativeHref, namespaceURI: null },
      ];
      if (isSubmap) {
        attrs.push({ name: 'format', value: 'ditamap', namespaceURI: null });
      }
      const derivedTitle = navtitle?.trim() || state.topicTitles[targetFilePath];

      const inserted = insertMapNode(buf.xml, {
        parentPath,
        tagName: isSubmap && tagName === 'topicref' ? 'mapref' : tagName,
        attrs,
        navtitle: derivedTitle,
      });

      get().mutateMapXml(mapPath, inserted.xml, t('status.mounted', { path: targetFilePath }));
      set({
        selectedMapNode: { mapPath, elementPath: inserted.insertedPath },
        inspectorTarget: 'map-node',
      });
    },

    insertMapStructureNode({ mapPath, parentPath, tagName, navtitle, keys, keydefKeyword }) {
      const state = get();
      const buf = state.mapBuffers[mapPath];
      if (!buf) return;

      const attrs: XmlAttributeEntry[] = [];
      if (tagName === 'keydef') {
        attrs.push({
          name: 'keys',
          value: keys?.trim() || `key_${Date.now().toString(36).slice(-4)}`,
          namespaceURI: null,
        });
        attrs.push({
          name: 'processing-role',
          value: 'resource-only',
          namespaceURI: null,
        });
      }

      const inserted = insertMapNode(buf.xml, {
        parentPath,
        tagName,
        attrs,
        navtitle: tagName === 'topicgroup' || tagName === 'keydef' ? undefined : navtitle,
        keydefKeyword,
      });

      get().mutateMapXml(mapPath, inserted.xml, t('status.insertedTag', { tag: tagName }));
      set({
        selectedMapNode: { mapPath, elementPath: inserted.insertedPath },
        inspectorTarget: 'map-node',
      });
    },

    updateMapAttr(mapPath, elementPath, attrName, value) {
      const buf = get().mapBuffers[mapPath];
      if (!buf) return;
      const res = updateMapNodeAttr(buf.xml, elementPath, attrName, value);
      get().mutateMapXml(mapPath, res.xml, t('status.attrUpdated', { name: attrName }));
    },

    updateMapNavtitle(mapPath, elementPath, navtitle) {
      const buf = get().mapBuffers[mapPath];
      if (!buf) return;
      const res = updateMapNodeNavtitle(buf.xml, elementPath, navtitle);
      get().mutateMapXml(mapPath, res.xml, t('status.navtitleUpdated'));
    },

    renameMapKey(def, nextKey) {
      const state = get();
      const buf = state.mapBuffers[def.sourceMapPath];
      if (!buf) return false;

      const res = renameMapNodeKeyToken(buf.xml, def.elementPath, def.key, nextKey);
      if (!res.changed) return false;

      get().mutateMapXml(
        def.sourceMapPath,
        res.xml,
        t('status.keyRenamed', { from: def.key, to: nextKey }),
      );

      // In API mode the keyspace is resolved server-side from the files on disk, so the rename must
      // be persisted before `refreshSemantics()` can report the new key name.
      if (state.workspaceMode === 'api') {
        void get().saveFile(def.sourceMapPath);
      }
      return true;
    },

    updateMapKeyValue(def, nextValue) {
      const state = get();
      const buf = state.mapBuffers[def.sourceMapPath];
      if (!buf) return false;

      const trimmed = nextValue.trim();
      if (!trimmed) return false;

      const source =
        def.inlineTextSource && def.inlineTextSource !== 'none' ? def.inlineTextSource : null;

      if (source) {
        const res = updateMapKeyValueText(buf.xml, def.elementPath, source, trimmed);
        if (!res.changed) return false;
        get().mutateMapXml(
          def.sourceMapPath,
          res.xml,
          t('status.keyValueUpdated', { key: def.qualifiedKey }),
        );
      } else if (def.href !== undefined) {
        const res = updateMapNodeAttr(buf.xml, def.elementPath, 'href', trimmed);
        if (res.xml === buf.xml) return false;
        get().mutateMapXml(
          def.sourceMapPath,
          res.xml,
          t('status.keyValueUpdated', { key: def.qualifiedKey }),
        );
      } else {
        return false;
      }

      // Same reason as `renameMapKey`: the keyspace is re-indexed from persisted map files.
      if (state.workspaceMode === 'api') {
        void get().saveFile(def.sourceMapPath);
      }
      return true;
    },

    updateMapRootTitle(mapPath, title) {
      const buf = get().mapBuffers[mapPath];
      if (!buf) return;
      const res = updateMapTitle(buf.xml, title);
      get().mutateMapXml(mapPath, res.xml, t('status.mapTitleUpdated'));
    },

    deleteMapTreeNode(mapPath, elementPath) {
      const buf = get().mapBuffers[mapPath];
      if (!buf) return;
      const res = deleteMapNode(buf.xml, elementPath);
      if (res.deleted) {
        get().mutateMapXml(mapPath, res.xml, t('status.nodeRemoved'));
        set({ selectedMapNode: { mapPath, elementPath: null } });
      }
    },

    async jumpToMapNodeSource(mapPath, line) {
      await get().openFileTab(mapPath, {
        mode: 'source',
        jumpLine: line,
      });
    },


  } satisfies Partial<EditorWorkbenchState>;
}
