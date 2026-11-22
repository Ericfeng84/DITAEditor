import type { ReactNode } from 'react';
import { CopyPlus, PanelRightClose, Sparkles, Tag } from 'lucide-react';
import { AttributesPanel, type AttributesPanelProps } from '../editor/visual/AttributesPanel';
import { ConrefReusePanel, type ConrefReusePanelProps } from './ConrefReusePanel';

export type InspectorTab = 'attributes' | 'reuse' | 'ai';

export interface TopicInspectorProps {
  tab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  attributes: AttributesPanelProps;
  reuse: ConrefReusePanelProps;
  /** Rendered by the workbench so the AI assistant can read the active buffer + target. */
  ai: ReactNode;
  /** Collapsing lives on the panel itself now that the header toggle button is gone. */
  onCollapse?: () => void;
}

const TABS: Array<{ id: InspectorTab; label: string; title: string; icon: typeof Tag }> = [
  {
    id: 'ai',
    label: 'AI',
    title: '基于当前元素或整篇 Topic 与 AI 协作编写、优化与修复 DITA XML',
    icon: Sparkles,
  },
  {
    id: 'attributes',
    label: '属性',
    title: '查看与编辑当前元素的 DITA 属性',
    icon: Tag,
  },
  {
    id: 'reuse',
    label: '复用',
    title: '从项目元素插入 conref / conkeyref 内容复用',
    icon: CopyPlus,
  },
];

/**
 * Right-hand inspector for topic documents: a single pane with two switchable tabs so the
 * former modal conref picker lives side-by-side with the attribute inspector.
 */
export function TopicInspector({
  tab,
  onTabChange,
  attributes,
  reuse,
  ai,
  onCollapse,
}: TopicInspectorProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-l border-slate-200 bg-slate-100/90 px-2 py-1.5">
        <div role="tablist" aria-label="右侧检查器视图" className="flex items-center gap-1">
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                title={item.title}
                onClick={() => onTabChange(item.id)}
                className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  active
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>
        {onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            aria-label="收起右侧面板"
            title="收起右侧面板"
            className="ml-auto inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 transition-colors hover:bg-white hover:text-slate-700"
          >
            <PanelRightClose className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div role="tabpanel" className="min-h-0 flex-1">
        {tab === 'attributes' ? (
          <AttributesPanel {...attributes} />
        ) : tab === 'reuse' ? (
          <ConrefReusePanel {...reuse} />
        ) : (
          ai
        )}
      </div>
    </div>
  );
}
