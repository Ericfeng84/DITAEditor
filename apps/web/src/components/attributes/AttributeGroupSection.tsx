import { useId, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { DitaAttributeGroup } from '@dita/core';

export interface AttributeGroupSectionProps {
  group: DitaAttributeGroup;
  /** Localized group title already resolved through the i18n catalogue. */
  title: string;
  /** One-line group purpose from `getAttributeGroupMeta(group, locale).description`. */
  description: string;
  /** English subtitle shown in the header when the group is empty. */
  subtitle: string;
  isOpen: boolean;
  onToggle: () => void;
  filledCount: number;
  /** Replaces the count pill (e.g. the DITAVAL include/exclude/flag status). */
  rightBadge?: ReactNode;
  /** Rendered between the purpose line and the fields (Keyref status card / conref actions). */
  banner?: ReactNode;
  children: ReactNode;
}

/**
 * Collapsible attribute group shared by the Topic attribute panel and the Map node inspector.
 */
export function AttributeGroupSection({
  group,
  title,
  description,
  subtitle,
  isOpen,
  onToggle,
  filledCount,
  rightBadge,
  banner,
  children,
}: AttributeGroupSectionProps) {
  const panelId = useId();

  return (
    <section className="p-3" data-attribute-group={group}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 text-left text-[11px] font-semibold text-slate-700"
      >
        <span className="flex items-center gap-1">
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          )}
          {title}
        </span>
        {rightBadge ?? (
          filledCount > 0 ? (
            <span className="rounded-full bg-blue-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-blue-700">
              {filledCount}
            </span>
          ) : (
            <span className="text-[10px] font-normal text-slate-400">{subtitle}</span>
          )
        )}
      </button>

      {isOpen ? (
        <div id={panelId} className="mt-2">
          <p className="text-[10.5px] leading-snug text-slate-500">{description}</p>
          {banner ? <div className="mt-2 space-y-2">{banner}</div> : null}
          <div className="mt-2.5 space-y-2.5">{children}</div>
        </div>
      ) : null}
    </section>
  );
}
