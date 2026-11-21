import type { XmlParseError } from '@dita/core';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Code2,
  Columns2,
  Eye,
  PanelLeft,
  PanelRight,
  Rocket,
  RotateCcw,
  Save,
} from 'lucide-react';
import type { EditorViewMode, OpenEditorTab } from '../store/editor-store';
import type { IdentityResponse, IdentityUser } from '../services/identity-api';
import { IdentitySwitcher } from './IdentitySwitcher';

export interface WorkbenchHeaderProps {
  /** Brand lockup is rendered in the sidebar strip while it is open; the header takes over when collapsed. */
  showBrand: boolean;
  activeTab: OpenEditorTab | null;
  mode: EditorViewMode;
  xmlError: XmlParseError | null;
  leftSidebarOpen: boolean;
  inspectorOpen: boolean;
  problemsOpen: boolean;
  errorCount: number;
  warningCount: number;
  dirtyCount: number;
  isCurrentDirty: boolean;
  saving: boolean;
  identity: IdentityResponse | null;
  currentUser: IdentityUser | null;
  onSwitchIdentity: (userId: string) => void;
  onToggleLeftSidebar: () => void;
  onResetBaseline: () => void;
  onSaveActive: () => void;
  onSaveAll: () => void;
  onChangeMode: (nextMode: EditorViewMode) => void;
  onToggleProblems: () => void;
  onToggleInspector: () => void;
  onOpenPublish: () => void;
}

export function WorkbenchHeader({
  showBrand,
  activeTab,
  mode,
  xmlError,
  leftSidebarOpen,
  inspectorOpen,
  problemsOpen,
  errorCount,
  warningCount,
  dirtyCount,
  isCurrentDirty,
  saving,
  identity,
  currentUser,
  onSwitchIdentity,
  onToggleLeftSidebar,
  onResetBaseline,
  onSaveActive,
  onSaveAll,
  onChangeMode,
  onToggleProblems,
  onToggleInspector,
  onOpenPublish,
}: WorkbenchHeaderProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3">
      {/* Left: Sidebar Toggle + Brand */}
      <div className="flex min-w-0 items-center gap-1.5">
        <button
          type="button"
          aria-pressed={leftSidebarOpen}
          onClick={onToggleLeftSidebar}
          className={`inline-flex items-center justify-center rounded-md border p-1.5 transition-colors ${
            leftSidebarOpen
              ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
          title={leftSidebarOpen ? '收起左侧项目 / Map 导航栏 (⌘\\)' : '展开左侧项目 / Map 导航栏 (⌘\\)'}
          aria-label={leftSidebarOpen ? '收起左侧导航栏' : '展开左侧导航栏'}
        >
          <PanelLeft className="h-3.5 w-3.5" aria-hidden="true" />
        </button>

        {showBrand ? (
          <div className="flex items-center gap-2 pr-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 font-mono text-xs font-bold text-white shadow-xs">
              D
            </div>
            <div className="hidden leading-tight xl:block">
              <div className="text-xs font-bold tracking-tight text-slate-900">DITAEditor</div>
              <div className="text-[10px] font-medium text-slate-400">DITA 1.3 · Phase 5</div>
            </div>
          </div>
        ) : null}
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
              disabled={!activeTab}
              onClick={() => onChangeMode(item.id)}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 ${
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
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Right: Save, Diagnostics, XML Status, Inspector */}
      <div className="flex shrink-0 items-center gap-1.5">
        <IdentitySwitcher identity={identity} currentUser={currentUser} onChange={onSwitchIdentity} />
        {dirtyCount > 0 ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={saving}
              onClick={isCurrentDirty ? onSaveActive : onSaveAll}
              className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              title="保存更改到本地磁盘 (⌘S)"
            >
              <Save className="h-3 w-3" aria-hidden="true" />
              <span>{saving ? '保存中…' : dirtyCount > 1 ? `保存全部 (${dirtyCount})` : '保存'}</span>
            </button>
            {isCurrentDirty ? (
              <button
                type="button"
                onClick={onResetBaseline}
                className="hidden items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 xl:inline-flex"
                title="还原当前标签页至上次保存状态"
              >
                <RotateCcw className="h-3 w-3" aria-hidden="true" />
                <span>还原</span>
              </button>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          onClick={onOpenPublish}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
          title="发布 HTML5 / PDF（DITA-OT 严格校验）"
        >
          <Rocket className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden lg:inline">发布</span>
        </button>

        {/* Diagnostics toggle pill */}
        <button
          type="button"
          aria-pressed={problemsOpen}
          onClick={onToggleProblems}
          className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
            errorCount > 0
              ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
              : warningCount > 0
                ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                : problemsOpen
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
          title="展开 / 收起底部项目问题诊断面板"
        >
          {errorCount > 0 ? (
            <AlertCircle className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />
          ) : warningCount > 0 ? (
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
          )}
          <span className="hidden md:inline">
            {errorCount > 0 || warningCount > 0
              ? `${errorCount} 错误 · ${warningCount} 警告`
              : '0 问题'}
          </span>
        </button>

        {xmlError ? (
          <span
            className="hidden items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 2xl:inline-flex"
            title={xmlError.message}
          >
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            L{xmlError.line}:{xmlError.column}
          </span>
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
