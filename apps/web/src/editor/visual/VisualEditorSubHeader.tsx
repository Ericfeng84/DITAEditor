import type { ReactNode } from 'react';
import { Filter } from 'lucide-react';
import type { ParsedDitaval } from '@dita/core';
import { useI18n } from '../../i18n/index.js';
import type { DitavalTopicSummary } from './ditaval-summary';

export interface VisualEditorSubHeaderProps {
  activeDitaval: ParsedDitaval | null;
  activeDitavalPath: string | null;
  ditavalTopicSummary: DitavalTopicSummary | null;
  /** Collapsible document outline toggle. */
  tagModeSlot?: ReactNode;
  /** Save affordance, pinned with the other topic actions on the far right. */
  saveSlot?: ReactNode;
  /** Lock state and assignment chip for the open topic, kept on one row with the toolbar. */
  contextSlot?: ReactNode;
  /**
   * Render as a segment of the document toolbar row instead of its own bordered bar. Two stacked
   * chrome rows cost ~44px of canvas for controls that are not document state, so `VisualEditor`
   * merges this strip into the formatting bar and only falls back to a standalone row when there is
   * no toolbar to merge with (read-only topics, source-only layouts).
   */
  merged?: boolean;
  /**
   * Formatting toolbar, rendered as the flexible middle of the merged row: display options stay on
   * the left, the topic actions (delegation / lock / save) stay pinned to the far right, and this
   * slot is the only part allowed to shrink — it scrolls horizontally inside its own track so the
   * bar always stays exactly one row tall.
   */
  toolbarSlot?: ReactNode;
}

/**
 * Compact visual-mode sub-header: the display options (tag disclosure) on the left, the topic's
 * lock/assignment context, the active DITAVAL badge and the save affordance on the right.
 *
 * Two controls deliberately live elsewhere: the authoring-guide chip sits in the footer bar, and the
 * task content-model switch sits beside it there (see `BreadcrumbBar`), so this row only carries what
 * has to be read at a glance while writing.
 */
export function VisualEditorSubHeader({
  activeDitaval,
  activeDitavalPath,
  ditavalTopicSummary,
  tagModeSlot,
  saveSlot,
  contextSlot,
  merged = false,
  toolbarSlot,
}: VisualEditorSubHeaderProps) {
  const { t } = useI18n();

  return (
    <div
      className={
        merged
          ? 'flex min-w-0 flex-1 items-center gap-2'
          : '@container flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/95 px-3 py-1.5 text-xs'
      }
    >
      {/* Display options, grouped and kept whole: what the canvas discloses about the open
          document. The outline has no control here any more (it is a navigation pane): it opens
          from the footer breadcrumb levels, see `handleSelectBreadcrumb`. */}
      <div
        className={
          merged
            ? 'flex shrink-0 items-center gap-2.5'
            : 'flex min-w-0 shrink items-center gap-2.5 overflow-hidden'
        }
      >
        {tagModeSlot}
      </div>

      {merged ? (
        <>
          <span aria-hidden="true" className="h-4 w-px shrink-0 bg-slate-200" />
          {/* The only track allowed to shrink: it scrolls instead of wrapping, so the merged row
              stays exactly one line tall however narrow the pane gets. */}
          <div className="flex min-w-0 flex-1 items-center overflow-x-auto [scrollbar-width:thin]">
            {toolbarSlot}
          </div>
        </>
      ) : null}

      {/* Topic actions, pinned to the far right edge: lock/assignment context, DITAVAL badge and
          the save affordance. */}
      <div className="flex shrink-0 items-center justify-end gap-2">
        {contextSlot ? (
          <div className="flex min-w-0 items-center gap-1.5">{contextSlot}</div>
        ) : null}

        {activeDitaval ? (
          <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-[10.5px] font-medium text-teal-800">
            <Filter className="h-3 w-3 text-teal-600" aria-hidden="true" />
            <span className="max-w-[140px] truncate">{activeDitavalPath?.split('/').pop()}</span>
            {ditavalTopicSummary ? (
              <span className="font-mono text-[10px] text-teal-700">
                · {t('visual.ditavalExcluded')} {ditavalTopicSummary.excluded} ·{' '}
                {t('visual.ditavalFlagged')} {ditavalTopicSummary.flagged}
              </span>
            ) : null}
          </div>
        ) : null}
        {saveSlot}
      </div>
    </div>
  );
}
