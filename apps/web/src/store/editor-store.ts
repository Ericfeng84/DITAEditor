import { create } from 'zustand';
import {
  checkXmlWellFormed,
  createTopicTemplate,
  DITA_SAMPLE_DOCUMENTS,
  type DitaTopicTemplateType,
  type XmlParseError,
} from '@dita/core';
import { computeXmlLineDiffStats } from '../editor/bridge/xml-bridge';

export type EditorViewMode = 'visual' | 'split' | 'source';
export type TagDisplayMode = 'none' | 'tags' | 'full';

export interface WorkspaceTopicDoc {
  id: string;
  fileName: string;
  title: string;
  type: DitaTopicTemplateType;
  badge: string;
  description: string;
  /** Baseline XML used to track minimal Git-diff line changes */
  baselineXml: string;
  /** Latest XML source of truth */
  xml: string;
  isCustom?: boolean;
}

export interface EditorWorkbenchState {
  documents: WorkspaceTopicDoc[];
  activeDocId: string;
  mode: EditorViewMode;
  xmlError: XmlParseError | null;
  /** Non-null when Source -> Visual switch was explicitly blocked by malformed XML */
  switchBlockedReason: string | null;
  tagDisplayMode: TagDisplayMode;
  inspectorOpen: boolean;
  statusMessage: string;
  /** Monotonic revision incremented on external XML loads/switches so Visual editor reloads cleanly */
  visualReloadToken: number;
  /** Pending cursor targets for bidirectional Visual <-> Source jump */
  pendingSourceOffset: number | null;
  pendingVisualPmPos: number | null;

  // Actions
  selectDocument: (docId: string) => void;
  createNewDocument: (type: DitaTopicTemplateType, id: string, title: string, lang: string) => void;
  importLocalDocument: (fileName: string, xml: string) => { ok: boolean; error?: XmlParseError };
  resetCurrentToBaseline: () => void;
  markBaselineSaved: () => void;
  setMode: (nextMode: EditorViewMode, sourceCursorOffset?: number, visualCursorPos?: number) => boolean;
  updateXmlFromVisual: (xml: string) => void;
  updateXmlFromSource: (xml: string) => void;
  setTagDisplayMode: (mode: TagDisplayMode) => void;
  setInspectorOpen: (open: boolean) => void;
  announce: (msg: string) => void;
  clearPendingSourceOffset: () => void;
  clearPendingVisualPmPos: () => void;
  requestSourceJump: (offset: number) => void;
  requestVisualJump: (pmPos: number) => void;
  clearSwitchBlockedReason: () => void;
}

function detectTopicTypeFromXml(xml: string): DitaTopicTemplateType {
  const m = /<(concept|task|reference|topic)\b/.exec(xml);
  if (m && (m[1] === 'concept' || m[1] === 'task' || m[1] === 'reference' || m[1] === 'topic')) {
    return m[1];
  }
  return 'topic';
}

function extractTitleFromXml(xml: string, fallback: string): string {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/.exec(xml);
  if (!m) return fallback;
  const plain = m[1]!.replace(/<[^>]+>/g, '').trim();
  return plain || fallback;
}

const initialDocuments: WorkspaceTopicDoc[] = DITA_SAMPLE_DOCUMENTS.map((sample) => ({
  id: sample.id,
  fileName: sample.fileName,
  title: sample.title,
  type: sample.type,
  badge: sample.badge,
  description: sample.description,
  baselineXml: sample.xml,
  xml: sample.xml,
}));

export const useEditorStore = create<EditorWorkbenchState>((set, get) => ({
  documents: initialDocuments,
  activeDocId: initialDocuments[0]!.id,
  mode: 'visual',
  xmlError: null,
  switchBlockedReason: null,
  tagDisplayMode: 'full',
  inspectorOpen: true,
  statusMessage: '',
  visualReloadToken: 1,
  pendingSourceOffset: null,
  pendingVisualPmPos: null,

  selectDocument(docId) {
    const doc = get().documents.find((d) => d.id === docId);
    if (!doc) return;
    const check = checkXmlWellFormed(doc.xml, { position: false });
    set((state) => ({
      activeDocId: docId,
      xmlError: check.ok ? null : check.error,
      switchBlockedReason: null,
      mode: !check.ok && state.mode === 'visual' ? 'source' : state.mode,
      visualReloadToken: state.visualReloadToken + 1,
      pendingSourceOffset: null,
      pendingVisualPmPos: null,
      statusMessage: `已切换到 ${doc.fileName}`,
    }));
  },

  createNewDocument(type, id, title, lang) {
    const xml = createTopicTemplate(type, { id, title, lang });
    const slug = id.trim() || `${type}_${Date.now().toString(36)}`;
    const newDoc: WorkspaceTopicDoc = {
      id: `doc-${Date.now().toString(36)}`,
      fileName: `${slug}.dita`,
      title: title.trim() || slug,
      type,
      badge: type.charAt(0).toUpperCase() + type.slice(1),
      description: `新建 ${type} 主题文档`,
      baselineXml: xml,
      xml,
      isCustom: true,
    };
    set((state) => ({
      documents: [newDoc, ...state.documents],
      activeDocId: newDoc.id,
      xmlError: null,
      switchBlockedReason: null,
      mode: state.mode === 'source' ? 'visual' : state.mode,
      visualReloadToken: state.visualReloadToken + 1,
      statusMessage: `已新建 ${newDoc.fileName}`,
    }));
  },

  importLocalDocument(fileName, xml) {
    const check = checkXmlWellFormed(xml, { position: false });
    const type = detectTopicTypeFromXml(xml);
    const title = extractTitleFromXml(xml, fileName.replace(/\.[^.]+$/, ''));
    const newDoc: WorkspaceTopicDoc = {
      id: `import-${Date.now().toString(36)}`,
      fileName,
      title,
      type,
      badge: type.charAt(0).toUpperCase() + type.slice(1),
      description: '本地导入的 DITA 文件',
      baselineXml: xml,
      xml,
      isCustom: true,
    };
    set((state) => ({
      documents: [newDoc, ...state.documents],
      activeDocId: newDoc.id,
      xmlError: check.ok ? null : check.error,
      switchBlockedReason: check.ok ? null : `导入的 XML 存在语法错误，已在源码模式下打开。`,
      mode: check.ok ? state.mode : 'source',
      visualReloadToken: state.visualReloadToken + 1,
      statusMessage: `已导入 ${fileName}`,
    }));
    return check.ok ? { ok: true } : { ok: false, error: check.error };
  },

  resetCurrentToBaseline() {
    const state = get();
    const active = state.documents.find((d) => d.id === state.activeDocId);
    if (!active) return;
    set({
      documents: state.documents.map((d) =>
        d.id === active.id ? { ...d, xml: d.baselineXml } : d,
      ),
      xmlError: null,
      switchBlockedReason: null,
      visualReloadToken: state.visualReloadToken + 1,
      statusMessage: `已还原 ${active.fileName} 至初始基线`,
    });
  },

  markBaselineSaved() {
    const state = get();
    const active = state.documents.find((d) => d.id === state.activeDocId);
    if (!active) return;
    set({
      documents: state.documents.map((d) =>
        d.id === active.id
          ? {
              ...d,
              baselineXml: d.xml,
              title: extractTitleFromXml(d.xml, d.title),
            }
          : d,
      ),
      statusMessage: `已将当前内容设为基线快照 (${active.fileName})`,
    });
  },

  setMode(nextMode) {
    const state = get();
    if (nextMode === state.mode) return true;

    const active = state.documents.find((d) => d.id === state.activeDocId);
    if (!active) return false;

    // Guard Source -> Visual / Split transitions with strict XML well-formedness check!
    if ((nextMode === 'visual' || nextMode === 'split') && state.mode === 'source') {
      const check = checkXmlWellFormed(active.xml, { position: false });
      if (!check.ok) {
        set({
          xmlError: check.error,
          switchBlockedReason: `第 ${check.error.line} 行第 ${check.error.column} 列存在 XML 语法错误：${check.error.message}。请修复后再切换到可视化模式。`,
          statusMessage: 'XML 语法非法，已拦截切换到可视化视图',
        });
        return false;
      }
      set({
        mode: nextMode,
        xmlError: null,
        switchBlockedReason: null,
        visualReloadToken: state.visualReloadToken + 1,
        statusMessage: nextMode === 'visual' ? '已切换到可视化模式' : '已切换到双栏对比模式',
      });
      return true;
    }

    set({
      mode: nextMode,
      switchBlockedReason: null,
      statusMessage:
        nextMode === 'source'
          ? '已切换到 XML 源码模式'
          : nextMode === 'split'
            ? '已切换到双栏对比模式'
            : '已切换到可视化模式',
    });
    return true;
  },

  updateXmlFromVisual(xml) {
    set((state) => ({
      documents: state.documents.map((d) =>
        d.id === state.activeDocId
          ? { ...d, xml, title: extractTitleFromXml(xml, d.title) }
          : d,
      ),
      xmlError: null,
      switchBlockedReason: null,
    }));
  },

  updateXmlFromSource(xml) {
    const check = checkXmlWellFormed(xml, { position: false });
    set((state) => ({
      documents: state.documents.map((d) =>
        d.id === state.activeDocId
          ? {
              ...d,
              xml,
              title: check.ok ? extractTitleFromXml(xml, d.title) : d.title,
            }
          : d,
      ),
      xmlError: check.ok ? null : check.error,
      switchBlockedReason: check.ok ? null : state.switchBlockedReason,
      // In split mode, auto-reload Visual pane whenever Source becomes valid XML
      visualReloadToken:
        check.ok && state.mode === 'split'
          ? state.visualReloadToken + 1
          : state.visualReloadToken,
    }));
  },

  setTagDisplayMode(tagDisplayMode) {
    const labelMap: Record<TagDisplayMode, string> = {
      none: '已隐藏段落与元素标签',
      tags: '已切换为紧凑元素标签视图',
      full: '已切换为完整标签与属性视图',
    };
    set({
      tagDisplayMode,
      statusMessage: labelMap[tagDisplayMode],
    });
  },

  setInspectorOpen(open) {
    set({ inspectorOpen: open });
  },

  announce(msg) {
    set({ statusMessage: msg });
  },

  clearPendingSourceOffset() {
    set({ pendingSourceOffset: null });
  },

  clearPendingVisualPmPos() {
    set({ pendingVisualPmPos: null });
  },

  requestSourceJump(offset) {
    set({ pendingSourceOffset: offset });
  },

  requestVisualJump(pmPos) {
    set({ pendingVisualPmPos: pmPos });
  },

  clearSwitchBlockedReason() {
    set({ switchBlockedReason: null });
  },
}));

export function selectActiveDocument(state: EditorWorkbenchState): WorkspaceTopicDoc {
  return (
    state.documents.find((d) => d.id === state.activeDocId) ?? state.documents[0]!
  );
}

export function getActiveDocDiffStats(doc: WorkspaceTopicDoc) {
  return computeXmlLineDiffStats(doc.baselineXml, doc.xml);
}
