import {
  checkXmlWellFormed,
  classifyDitaFileKind,
  computeRelativeDitaHref,
  createTopicTemplate,
  deleteMapNode,
  DITA_KEY_NAME_PATTERN,
  insertMapNode,
  removeMapNodeKey,
  renameMapNodeKeyToken,
  updateMapKeyValueText,
  updateMapNodeAttr,
  updateMapNodeNavtitle,
  updateMapTitle,
  upsertMapKeyInlineText,
  type XmlAttributeEntry,
} from '@dita/core';
import { planMapNodeMove } from '../../../map-tree/map-tree-utils';
import { t } from '../../../i18n/index.js';
import {
  createWorkspaceFile,
} from '../../../services/workspace-api';
import {
  extractTitleFromCheck,
  nextWorkbenchAlert,
} from '../internals.js';
import { ensureFileCheckedOut } from '../../git-store';
import type { EditorWorkbenchState, StoreGet, StoreSet } from '../types.js';
import type { StoreRuntime } from '../runtime.js';

/** Map a workspace asset path to the DITA `@format` token used on `<keydef>`. */
function inferKeyFormat(filePath: string): string | null {
  const kind = classifyDitaFileKind(filePath);
  if (kind === 'ditamap' || kind === 'bookmap') return 'ditamap';
  if (kind === 'topic') return null;
  const lower = filePath.toLowerCase();
  const ext = lower.slice(lower.lastIndexOf('.') + 1);
  switch (ext) {
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
    case 'bmp':
    case 'tif':
    case 'tiff':
    case 'eps':
    case 'pdf':
    case 'html':
    case 'htm':
    case 'xml':
    case 'txt':
      return ext === 'htm' ? 'html' : ext === 'tif' || ext === 'tiff' ? 'tiff' : ext;
    default:
      return null;
  }
}

/** Workbench state slice: see `EditorWorkbenchState` in `../types.ts`. */
export function createMapTreeSlice(
  set: StoreSet,
  get: StoreGet,
  runtime: StoreRuntime,
) {
  return {
    async ensureMapEditable(mapPath) {
      // The in-browser demo workspace has neither locks nor users: every edit is allowed.
      if (get().workspaceMode !== 'api') return true;
      const guard = await ensureFileCheckedOut(mapPath);
      if (guard.ok) return true;
      set({
        alert: nextWorkbenchAlert({
          tone: 'error',
          message: t('lock.mapBlocked', { path: mapPath, message: guard.message }),
        }),
      });
      return false;
    },

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

    async moveMapTreeNodes(dragNodes, targetParent, index) {
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

      // A drag can cross into a submap, so every touched map needs its own check-out.
      for (const mapPath of new Set(plan.updates.map((upd) => upd.mapPath))) {
        if (!(await get().ensureMapEditable(mapPath))) return;
      }

      for (const upd of plan.updates) {
        get().mutateMapXml(upd.mapPath, upd.xml, t('status.mapStructureUpdated'));
      }
    },

    async createMissingMapTarget({ mapPath, targetPath, elementPath, title, topicType, lang }) {
      const cleanPath = targetPath.trim().replace(/^\/+/, '');
      if (!cleanPath) return;

      // The row may only be stale (a teammate's save, or a draft that just materialized).
      if (get().fileSet.has(cleanPath)) {
        await get().refreshWorkspaceTree();
        await get().openFileTab(cleanPath, { mode: 'visual' });
        return;
      }

      const base = cleanPath.slice(cleanPath.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '');
      const id =
        base.toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') ||
        `${topicType}_${Date.now().toString(36)}`;
      const resolvedTitle = title.trim() || base || id;
      const xml = createTopicTemplate(topicType, { id, title: resolvedTitle, lang });

      try {
        if (get().workspaceMode === 'api') {
          await createWorkspaceFile({
            path: cleanPath,
            kind: topicType,
            id,
            title: resolvedTitle,
            lang,
            content: xml,
          });
        } else {
          set((s) => ({ memoryFiles: { ...s.memoryFiles, [cleanPath]: xml } }));
        }
      } catch (err) {
        set({ statusMessage: err instanceof Error ? err.message : String(err) });
        return;
      }

      await get().refreshWorkspaceTree();
      set({
        selectedMapNode: { mapPath, elementPath },
        statusMessage: t('status.missingTargetCreated', { path: cleanPath }),
      });
      await get().openFileTab(cleanPath, { mode: 'visual' });
      await get().refreshSemantics();
      await get().refreshDiagnostics();
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
      const buffered = get().mapBuffers[mapPath];
      if (!buffered) return;
      // Check out the map BEFORE creating its topic, otherwise a rejected map write leaves an
      // orphan topic file behind that no map references.
      if (!(await get().ensureMapEditable(mapPath))) return;

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

    async mountExistingFileInMap({ mapPath, parentPath, targetFilePath, tagName, navtitle }) {
      if (!(await get().ensureMapEditable(mapPath))) return;
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

    async insertMapStructureNode({ mapPath, parentPath, tagName, navtitle, keys, keydefKeyword }) {
      if (!(await get().ensureMapEditable(mapPath))) return;
      const buf = get().mapBuffers[mapPath];
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

    async updateMapAttr(mapPath, elementPath, attrName, value) {
      if (!(await get().ensureMapEditable(mapPath))) return;
      const buf = get().mapBuffers[mapPath];
      if (!buf) return;
      const res = updateMapNodeAttr(buf.xml, elementPath, attrName, value);
      get().mutateMapXml(mapPath, res.xml, t('status.attrUpdated', { name: attrName }));
    },

    async updateMapNavtitle(mapPath, elementPath, navtitle) {
      if (!(await get().ensureMapEditable(mapPath))) return;
      const buf = get().mapBuffers[mapPath];
      if (!buf) return;
      const res = updateMapNodeNavtitle(buf.xml, elementPath, navtitle);
      get().mutateMapXml(mapPath, res.xml, t('status.navtitleUpdated'));
    },

    async renameMapKey(def, nextKey) {
      if (!(await get().ensureMapEditable(def.sourceMapPath))) return false;
      const buf = get().mapBuffers[def.sourceMapPath];
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
      if (get().workspaceMode === 'api') {
        await get().saveFile(def.sourceMapPath);
      }
      return true;
    },

    async updateMapKeyValue(def, nextValue) {
      if (!(await get().ensureMapEditable(def.sourceMapPath))) return false;
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
        await get().saveFile(def.sourceMapPath);
      }
      return true;
    },

    async createMapKey(options) {
      const mapPath = options.mapPath;
      const trimmedKey = options.keyName.trim();
      if (!trimmedKey || !DITA_KEY_NAME_PATTERN.test(trimmedKey)) return { ok: false };
      if (!(await get().ensureMapEditable(mapPath))) return { ok: false };

      const buf = get().mapBuffers[mapPath];
      if (!buf) return { ok: false };

      // Attribute order matters for a minimal Git diff: keys, href, format, scope, keyscope,
      // processing-role. Everything the DITA 1.3 `<keydef>` content model allows, nothing more.
      const attrs: XmlAttributeEntry[] = [
        { name: 'keys', value: trimmedKey, namespaceURI: null },
      ];
      let keydefKeyword: string | undefined;
      let keydefLinktext: string | undefined;

      if (options.bindingKind === 'file') {
        const target = options.targetFilePath?.trim();
        if (!target) return { ok: false };
        attrs.push({
          name: 'href',
          value: computeRelativeDitaHref(mapPath, target),
          namespaceURI: null,
        });
        const format = options.format?.trim() || inferKeyFormat(target);
        if (format) attrs.push({ name: 'format', value: format, namespaceURI: null });
        keydefKeyword = options.textValue?.trim() || undefined;
        keydefLinktext = options.linkText?.trim() || undefined;
      } else if (options.bindingKind === 'external') {
        const url = options.externalUrl?.trim();
        if (!url) return { ok: false };
        attrs.push({ name: 'href', value: url, namespaceURI: null });
        const format = options.format?.trim();
        if (format) attrs.push({ name: 'format', value: format, namespaceURI: null });
        attrs.push({ name: 'scope', value: 'external', namespaceURI: null });
        keydefLinktext = options.linkText?.trim() || undefined;
      } else {
        const text = options.textValue?.trim();
        if (!text) return { ok: false };
        keydefKeyword = text;
        keydefLinktext = options.linkText?.trim() || undefined;
      }

      const keyscope = options.keyscope?.trim();
      if (keyscope) attrs.push({ name: 'keyscope', value: keyscope, namespaceURI: null });
      attrs.push({ name: 'processing-role', value: 'resource-only', namespaceURI: null });

      const inserted = insertMapNode(buf.xml, {
        parentPath: options.parentPath,
        tagName: 'keydef',
        attrs,
        keydefKeyword,
        keydefLinktext,
      });

      get().mutateMapXml(mapPath, inserted.xml, t('status.keyCreated', { key: trimmedKey }));

      if (options.selectCreated !== false) {
        set({ selectedMapNode: { mapPath, elementPath: inserted.insertedPath } });
      }

      // API mode resolves the Keyspace from the files on disk, so the new `<keydef>` must reach the
      // Draft Overlay before the qualified key can be reported back to the calling dialog.
      if (get().workspaceMode === 'api') {
        await get().saveFile(mapPath);
      } else {
        await get().refreshSemantics();
      }

      const keyspace = get().keyspace;
      const samePath = (def: { elementPath: number[] }) =>
        def.elementPath.length === inserted.insertedPath.length &&
        def.elementPath.every((step, index) => step === inserted.insertedPath[index]);
      const match =
        keyspace?.allDefinitions.find(
          (def) => def.sourceMapPath === mapPath && def.key === trimmedKey && samePath(def),
        ) ??
        (keyspace
          ? (Object.values(keyspace.keys).find(
              (def) => def.sourceMapPath === mapPath && def.key === trimmedKey,
            ) ?? Object.values(keyspace.keys).find((def) => def.key === trimmedKey))
          : undefined);

      return {
        ok: true,
        qualifiedKey: match?.qualifiedKey ?? trimmedKey,
        elementPath: inserted.insertedPath,
      };
    },

    async deleteMapKey(def) {
      if (!(await get().ensureMapEditable(def.sourceMapPath))) return false;
      const buf = get().mapBuffers[def.sourceMapPath];
      if (!buf) return false;

      const res = removeMapNodeKey(buf.xml, def.elementPath, def.key);
      if (!res.changed) return false;

      get().mutateMapXml(
        def.sourceMapPath,
        res.xml,
        t('status.keyDeleted', { key: def.qualifiedKey }),
      );

      const selected = get().selectedMapNode;
      if (
        res.removedElement &&
        selected &&
        selected.mapPath === def.sourceMapPath &&
        selected.elementPath !== null &&
        selected.elementPath.length === def.elementPath.length &&
        selected.elementPath.every((step, index) => step === def.elementPath[index])
      ) {
        set({ selectedMapNode: { mapPath: def.sourceMapPath, elementPath: null } });
      }

      if (get().workspaceMode === 'api') {
        await get().saveFile(def.sourceMapPath);
      } else {
        await get().refreshSemantics();
      }
      return true;
    },

    async upsertMapNodeKeyText(mapPath, elementPath, source, value) {
      if (!(await get().ensureMapEditable(mapPath))) return false;
      const buf = get().mapBuffers[mapPath];
      if (!buf) return false;

      const res = upsertMapKeyInlineText(buf.xml, elementPath, source, value);
      // The core helper re-serialises the element even when the text is already identical, so the
      // byte comparison keeps a no-op save (and its Draft Overlay write) out of the store.
      if (!res.changed || res.xml === buf.xml) return false;

      get().mutateMapXml(mapPath, res.xml, t('status.keyTextUpdated'));

      if (get().workspaceMode === 'api') {
        await get().saveFile(mapPath);
      } else {
        await get().refreshSemantics();
      }
      return true;
    },

    async updateMapRootTitle(mapPath, title) {
      if (!(await get().ensureMapEditable(mapPath))) return;
      const buf = get().mapBuffers[mapPath];
      if (!buf) return;
      const res = updateMapTitle(buf.xml, title);
      get().mutateMapXml(mapPath, res.xml, t('status.mapTitleUpdated'));
    },

    async deleteMapTreeNode(mapPath, elementPath) {
      if (!(await get().ensureMapEditable(mapPath))) return;
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
