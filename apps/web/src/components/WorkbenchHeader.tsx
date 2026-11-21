import { useRef } from 'react';
import type { XmlParseError } from '@dita/core';
import {
  AlertTriangle,
  CheckCircle2,
  Code2,
  Columns2,
  Download,
  Eye,
  FilePlus2,
  FileText,
  PanelRight,
  RotateCcw,
  Save,
  Upload,
} from 'lucide-react';
import type {
  EditorViewMode,
  WorkspaceTopicDoc,
} from '../store/editor-store';

export interface WorkbenchHeaderProps {
  documents: WorkspaceTopicDoc[];
  activeDoc: WorkspaceTopicDoc;
  mode: EditorViewMode;
  xmlError: XmlParseError | null;
  inspectorOpen: boolean;
  isDirty: boolean;
  onSelectDoc: (id: string) => void;
  onOpenNewTopic: () => void;
  onImportFile: (fileName: string, content: string) => void;
  onExportFile: () => void;
  onResetBaseline: () => void;
  onSaveSnapshot: () => void;
  onChangeMode: (nextMode: EditorViewMode) => void;
  onToggleInspector: () => void;
}

const BADGE_COLORS: Record<string, string> = {
  concept: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  task: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  reference: 'bg-amber-100 text-amber-800 border-amber-200',
  topic: 'bg-slate-100 text-slate-700 border-slate-200',
};

export function WorkbenchHeader({
  documents,
  activeDoc,
  mode,
  xmlError,
  inspectorOpen,
  isDirty,
  onSelectDoc,
  onOpenNewTopic,
  onImportFile,
  onExportFile,
  onResetBaseline,
  onSaveSnapshot,
  onChangeMode,
  onToggleInspector,
}: WorkbenchHeaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    onImportFile(file.name, text);
    e.target.value = '';
  };

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3">
      {/* Left: Brand + Document Switcher + File Actions */}
      <div className="flex min-w-0 items-center gap-2">
        <div className="flex items-center gap-2 pr-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 font-mono text-xs font-bold text-white shadow-xs">
            D
          </div>
          <div className="hidden leading-tight md:block">
            <div className="text-xs font-bold tracking-tight text-slate-900">DITAEditor</div>
            <div className="text-[10px] font-medium text-slate-400">DITA 1.3 · Phase 1</div>
          </div>
        </div>

        <span className="h-5 w-px bg-slate-200" aria-hidden="true" />

        {/* Sample / Open Topic Selector */}
        <div className="flex min-w-0 items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          <label htmlFor="active-doc-select" className="sr-only">
            切换当前 DITA 文档
          </label>
          <select
            id="active-doc-select"
            value={activeDoc.id}
            onChange={(e) => onSelectDoc(e.target.value)}
            className="max-w-[200px] truncate rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100 focus:border-indigo-500 focus:outline-none sm:max-w-[260px]"
          >
            {documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                [{doc.badge}] {doc.fileName} — {doc.title}
              </option>
            ))}
          </select>
          <span
            className={`hidden rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold sm:inline-block ${
              BADGE_COLORS[activeDoc.type] ?? BADGE_COLORS.topic
            }`}
          >
            {activeDoc.type}
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenNewTopic}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          title="按标准模板新建 Concept / Task / Reference / Topic"
        >
          <FilePlus2 className="h-3.5 w-3.5 text-indigo-600" aria-hidden="true" />
          <span className="hidden lg:inline">新建</span>
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          title="从本地导入 .dita / .xml 文件"
        >
          <Upload className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          <span className="hidden xl:inline">导入</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".dita,.xml"
          onChange={handleFilePicked}
          className="hidden"
          aria-hidden="true"
        />

        <button
          type="button"
          onClick={onExportFile}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
          title="导出当前 DITA XML 文件"
        >
          <Download className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          <span className="hidden xl:inline">导出</span>
        </button>
      </div>

      {/* Center: Visual | Split | Source Mode Segmented Switch */}
      <div
        role="group"
        aria-label="编辑模式切换"
        className="flex shrink-0 items-center rounded-lg border border-slate-200 bg-slate-100/90 p-0.5"
      >
        {(
          [
            { id: 'visual', label: '可视化', icon: Eye },
            { id: 'split', label: '双栏对比', icon: Columns2 },
            { id: 'source', label: 'XML 源码', icon: Code2 },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = mode === item.id;
          const blocked = Boolean(xmlError && mode === 'source' && item.id !== 'source');
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChangeMode(item.id)}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                active
                  ? 'bg-white text-slate-900 shadow-xs'
                  : blocked
                    ? 'text-rose-500 hover:bg-rose-50'
                    : 'text-slate-600 hover:text-slate-900'
              }`}
              title={
                blocked
                  ? 'XML 语法有误，点击查看拦截提示'
                  : `切换至${item.label}模式`
              }
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Right: XML Well-Formed Status + Diff Snapshot + View Toggles */}
      <div className="flex shrink-0 items-center gap-1.5">
        {xmlError ? (
          <span
            className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700"
            title={xmlError.message}
          >
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            <span>
              错误 L{xmlError.line}:{xmlError.column}
            </span>
          </span>
        ) : (
          <span className="hidden items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 md:inline-flex">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            XML 良构
          </span>
        )}

        {isDirty ? (
          <div className="hidden items-center gap-1 lg:flex">
            <button
              type="button"
              onClick={onSaveSnapshot}
              className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white hover:bg-slate-800"
              title="将当前内容保存为本地基线快照（重置 Diff 计数）"
            >
              <Save className="h-3 w-3" aria-hidden="true" />
              存快照
            </button>
            <button
              type="button"
              onClick={onResetBaseline}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
              title="放弃更改并恢复至基线 XML"
            >
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
              还原
            </button>
          </div>
        ) : null}

        <button
          type="button"
          aria-pressed={inspectorOpen}
          onClick={onToggleInspector}
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
            inspectorOpen
              ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
          title="展开 / 收起右侧属性检查器"
        >
          <PanelRight className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden xl:inline">属性</span>
        </button>
      </div>
    </header>
  );
}
