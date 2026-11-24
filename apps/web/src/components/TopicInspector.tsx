import type { ReactNode } from 'react';
import { CopyPlus, PanelRightClose, Sparkles, Tag } from 'lucide-react';
import { AttributesPanel, type AttributesPanelProps } from '../editor/visual/AttributesPanel';
import { useI18n } from '../i18n/index.js';
import type { MessageKey } from '../i18n/messages/index.js';
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

const TABS: Array<{
  id: InspectorTab;
  labelKey: MessageKey;
  titleKey: MessageKey;
  icon: typeof Tag;
}> = [
  {
    id: 'ai',
    labelKey: 'inspector.tab.ai',
    titleKey: 'inspector.tab.aiTitle',
    icon: Sparkles,
  },
  {
    id: 'attributes',
    labelKey: 'inspector.tab.attributes',
    titleKey: 'inspector.tab.attributesTitle',
    icon: Tag,
  },
  {
    id: 'reuse',
    labelKey: 'inspector.tab.reuse',
    titleKey: 'inspector.tab.reuseTitle',
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
  const { t } = useI18n();
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1 border-b border-l border-slate-200 bg-slate-100/90 px-2 py-1.5">
        <div role="tablist" aria-label={t('inspector.tabsAria')} className="flex items-center gap-1">
          {TABS.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                title={t(item.titleKey)}
                onClick={() => onTabChange(item.id)}
                className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  active
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                {t(item.labelKey)}
              </button>
            );
          })}
        </div>
        {onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            aria-label={t('inspector.collapse')}
            title={t('inspector.collapse')}
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
