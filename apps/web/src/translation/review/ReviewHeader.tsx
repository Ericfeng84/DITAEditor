/**
 * Review header: file navigation, view switcher, actions and the compact status sub-bar.
 */
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Languages,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Save,
  Send,
  Upload,
} from 'lucide-react';
import type { IdentityResponse, IdentityUser } from '../../services/identity-api.js';
import { SessionSettingsMenu } from '../../components/SessionSettingsMenu';
import type {
  TranslationAiReviewReport,
  TranslationDitaOtItemReport,
  TranslationLockInfo,
  TranslationReviewSiblingView,
} from '../../services/translation-api.js';
import {
  AI_VERDICT_KEYS,
  DITAOT_STATUS_KEYS,
  isPendingStatus,
  ITEM_TONE,
  type ReviewViewMode,
  type Translator,
} from './review-shared.js';

export interface ReviewHeaderProps {
  t: Translator;
  sourcePath: string;
  targetPath: string;
  status: TranslationReviewSiblingView['status'];
  siblings: TranslationReviewSiblingView[];
  activeItemId: string;
  pendingOnly: boolean;
  onTogglePendingOnly: () => void;
  onSelectItem: (itemId: string) => void;
  onPrevItem: () => void;
  onNextItem: () => void;
  hasPrevItem: boolean;
  hasNextItem: boolean;
  viewMode: ReviewViewMode;
  onViewModeChange: (mode: ReviewViewMode) => void;
  dirtyCount: number;
  xmlDirty: boolean;
  saving: boolean;
  applying: boolean;
  checkingIn: boolean;
  checkedInHash: string | null;
  canSave: boolean;
  canApply: boolean;
  canCheckin: boolean;
  onSave: () => void;
  onApply: () => void;
  onCheckin: () => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  errorCount: number;
  warningCount: number;
  glossaryCount: number;
  lock: TranslationLockInfo | null;
  segmentProgress: string;
  actionMessage: string | null;
  actionError: string | null;
  readOnly: boolean;
  onBack: () => void;
  /** Session chrome: who the draft actions speak for, switchable without leaving the review. */
  identity: IdentityResponse | null;
  currentUser: IdentityUser | null;
  onSwitchIdentity: (userId: string) => void;
  /** `null` while there is no applied draft to open in the target editor. */
  onOpenTargetEditor: (() => void) | null;
  /** Phase 16 — reviewer AI verdict, rendered as a sub-bar pill (null hides it). */
  aiReview?: TranslationAiReviewReport | null;
  /** Phase 16 — DITA-OT strict result, rendered as a sub-bar pill (null hides it). */
  ditaOtReport?: TranslationDitaOtItemReport | null;
}

const VIEWS: Array<{ id: ReviewViewMode; labelKey: never }> = [
  { id: 'sideBySide', labelKey: 'translation.review.viewSideBySide' as never },
  { id: 'stacked', labelKey: 'translation.review.viewStacked' as never },
  { id: 'hoverReading', labelKey: 'translation.review.viewHover' as never },
  { id: 'xmlDiff', labelKey: 'translation.review.xmlDiff' as never },
];

export function ReviewHeader({
  t,
  sourcePath,
  targetPath,
  status,
  siblings,
  activeItemId,
  pendingOnly,
  onTogglePendingOnly,
  onSelectItem,
  onPrevItem,
  onNextItem,
  hasPrevItem,
  hasNextItem,
  viewMode,
  onViewModeChange,
  dirtyCount,
  xmlDirty,
  saving,
  applying,
  checkingIn,
  checkedInHash,
  canSave,
  canApply,
  canCheckin,
  onSave,
  onApply,
  onCheckin,
  inspectorOpen,
  onToggleInspector,
  errorCount,
  warningCount,
  glossaryCount,
  lock,
  segmentProgress,
  actionMessage,
  actionError,
  readOnly,
  onBack,
  identity,
  currentUser,
  onSwitchIdentity,
  onOpenTargetEditor,
  aiReview = null,
  ditaOtReport = null,
}: ReviewHeaderProps) {
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcherRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!switcherOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (switcherRef.current && target && switcherRef.current.contains(target)) return;
      setSwitcherOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [switcherOpen]);

  const visibleSiblings = pendingOnly ? siblings.filter((entry) => isPendingStatus(entry.status)) : siblings;
  const activeIndex = Math.max(
    visibleSiblings.findIndex((entry) => entry.itemId === activeItemId),
    0,
  );
  const total = visibleSiblings.length;
  const progressLabel = t('translation.review.fileProgress', { index: activeIndex + 1, total });
  const dirty = dirtyCount > 0 || xmlDirty;
  const lockLabel = !lock
    ? t('translation.review.lockFree')
    : lock.isMine
      ? t('translation.review.lockedMine')
      : t('translation.review.lockedBy', { name: lock.userName ?? lock.userId });

  return (
    <header className="review-header">
      <div className="flex h-12 min-w-0 items-center gap-2 px-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden md:inline">{t('translation.review.back')}</span>
        </button>
        <span className="h-5 w-px shrink-0 bg-slate-200" aria-hidden="true" />

        {/* Context anchor: the same slate badge + title + subtitle rhythm as the editor and the
            translation center, so the review reads as one surface, not a separate app. */}
        <span
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white"
          aria-hidden="true"
        >
          <Languages className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0 leading-tight">
          <div className="flex min-w-0 items-center gap-1.5">
            <h1 className="truncate text-xs font-bold tracking-tight text-slate-900">
              {t('translation.review.title')}
            </h1>
            <span
              className={`review-pill ${ITEM_TONE[status] ?? ITEM_TONE.ready_for_review}`}
              data-testid="review-item-status"
            >
              {t(`translation.itemStatus.${status}` as never)}
            </span>
            {dirty ? (
              <span className="review-pill review-pill--dirty" title={t('translation.review.dirty')}>
                {t('translation.review.dirty')}
              </span>
            ) : null}
          </div>
          <div
            className="flex min-w-0 items-center gap-1 font-mono text-[10.5px] text-slate-400"
            title={`${sourcePath} → ${targetPath}`}
          >
            <span className="max-w-[14rem] truncate text-slate-500">{sourcePath}</span>
            <span aria-hidden="true">→</span>
            <span className="max-w-[22rem] truncate font-medium text-blue-700">{targetPath}</span>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5">
            <button
              type="button"
              className="review-icon-button"
              data-testid="review-prev-item"
              aria-label={t('translation.review.prevItem')}
              disabled={!hasPrevItem}
              onClick={onPrevItem}
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </button>

            <div className="review-switcher" ref={switcherRef}>
              <button
                type="button"
                className="review-switcher__trigger"
                data-testid="review-file-switcher"
                aria-expanded={switcherOpen}
                aria-haspopup="listbox"
                onClick={() => setSwitcherOpen((open) => !open)}
              >
                {total === 0 ? t('translation.review.pendingEmpty') : progressLabel}
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
              </button>
              {switcherOpen ? (
                <div className="review-switcher__panel" role="listbox" data-testid="review-file-options">
                  <label className="review-switcher__filter">
                    <input
                      type="checkbox"
                      data-testid="review-pending-only"
                      checked={pendingOnly}
                      onChange={onTogglePendingOnly}
                    />
                    {t('translation.review.pendingOnly')}
                  </label>
                  <div className="review-switcher__list">
                    {visibleSiblings.length === 0 ? (
                      <p className="review-switcher__empty">{t('translation.review.pendingEmpty')}</p>
                    ) : null}
                    {visibleSiblings.map((entry) => (
                      <button
                        key={entry.itemId}
                        type="button"
                        role="option"
                        aria-selected={entry.itemId === activeItemId}
                        className="review-switcher__option"
                        data-testid={`review-file-option-${entry.itemId}`}
                        onClick={() => {
                          setSwitcherOpen(false);
                          onSelectItem(entry.itemId);
                        }}
                      >
                        <span className="review-switcher__option-path">{entry.targetPath}</span>
                        <span className={`review-pill ${ITEM_TONE[entry.status] ?? ITEM_TONE.ready_for_review}`}>
                          {t(`translation.itemStatus.${entry.status}` as never)}
                        </span>
                        {entry.qaErrorCount > 0 ? (
                          <span className="review-qa-chip review-qa-chip--error">{entry.qaErrorCount}</span>
                        ) : null}
                        {entry.qaWarningCount > 0 ? (
                          <span className="review-qa-chip review-qa-chip--warning">{entry.qaWarningCount}</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className="review-icon-button"
              data-testid="review-next-item"
              aria-label={t('translation.review.nextItem')}
              disabled={!hasNextItem}
              onClick={onNextItem}
            >
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="review-header__actions">
            <button
              type="button"
              className="review-button"
              data-testid="review-save"
              title={t('translation.review.saveRevisions')}
              disabled={!canSave || saving}
              onClick={onSave}
            >
              {saving ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="h-3 w-3" aria-hidden="true" />
              )}
              <span className="hidden md:inline">
                {saving ? t('translation.review.saving') : t('translation.review.saveRevisions')}
              </span>
              {dirty ? <span className="review-dirty-dot" aria-hidden="true" /> : null}
            </button>
            <button
              type="button"
              className="review-button review-button--primary"
              data-testid="review-apply-draft"
              disabled={!canApply || applying || readOnly}
              onClick={onApply}
            >
              {applying ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="h-3 w-3" aria-hidden="true" />
              )}
              <span className="whitespace-nowrap">
                {applying ? t('translation.review.applying') : t('translation.review.applyDraft')}
              </span>
            </button>
            <button
              type="button"
              className="review-button review-button--quiet"
              data-testid="review-checkin"
              title={t('translation.review.checkin')}
              disabled={!canCheckin || checkingIn}
              onClick={onCheckin}
            >
              {checkingIn ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              ) : (
                <Send className="h-3 w-3" aria-hidden="true" />
              )}
              <span className="hidden lg:inline">
                {checkedInHash
                  ? t('translation.review.checkedIn', { hash: checkedInHash.slice(0, 7) })
                  : t('translation.review.checkin')}
              </span>
            </button>
            <button
              type="button"
              className="review-toggle"
              data-testid="review-toggle-inspector"
              aria-pressed={inspectorOpen}
              title={
                inspectorOpen
                  ? t('translation.review.inspectorHide')
                  : t('translation.review.inspectorShow')
              }
              onClick={onToggleInspector}
            >
              {inspectorOpen ? (
                <PanelRightClose className="h-3 w-3" aria-hidden="true" />
              ) : (
                <PanelRightOpen className="h-3 w-3" aria-hidden="true" />
              )}
              <span className="hidden xl:inline">
                {inspectorOpen
                  ? t('translation.review.inspectorHide')
                  : t('translation.review.inspectorShow')}
              </span>
            </button>
          </div>

          <SessionSettingsMenu
            identity={identity}
            currentUser={currentUser}
            onChangeIdentity={onSwitchIdentity}
            testId="review-settings-button"
            menuTestId="review-settings-menu"
          />
        </div>
      </div>

      <div className="review-subbar">
        <div className="review-segmented" role="group" aria-label={t('translation.review.viewLabel')}>
          {VIEWS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="review-segmented__item"
              data-testid={`review-view-${entry.id}`}
              aria-pressed={viewMode === entry.id}
              onClick={() => onViewModeChange(entry.id)}
            >
              {t(entry.labelKey)}
            </button>
          ))}
        </div>
        <span className="review-subbar__divider" aria-hidden="true" />
        <span className="review-subbar__lock" data-testid="review-lock" data-mine={lock?.isMine ? 'true' : 'false'}>
          <Check className="h-3 w-3" aria-hidden="true" />
          {lockLabel}
        </span>
        <button
          type="button"
          className="review-qa-badge review-qa-badge--error"
          data-testid="review-qa-errors"
          onClick={onToggleInspector}
        >
          {errorCount} {t('translation.review.qaError')}
        </button>
        <button
          type="button"
          className="review-qa-badge review-qa-badge--warning"
          data-testid="review-qa-warnings"
          onClick={onToggleInspector}
        >
          {warningCount} {t('translation.review.qaWarning')}
        </button>
        {aiReview ? (
          <button
            type="button"
            className={`review-pill review-pill--${aiReview.verdict}`}
            data-testid="review-header-ai-review"
            title={aiReview.summary || undefined}
            onClick={onToggleInspector}
          >
            {t('translation.review.pillAiReview')} · {t(AI_VERDICT_KEYS[aiReview.verdict])}
          </button>
        ) : null}
        {ditaOtReport ? (
          <button
            type="button"
            className={`review-pill review-pill--ditaot-${ditaOtReport.status}`}
            data-testid="review-header-ditaot"
            onClick={onToggleInspector}
          >
            {t('translation.review.pillDitaOt')} · {t(DITAOT_STATUS_KEYS[ditaOtReport.status])}
          </button>
        ) : null}
        <span className="review-subbar__progress" data-testid="review-segment-progress">
          {segmentProgress}
        </span>
        <span className="review-subbar__spacer" />
        {actionError ? (
          <span className="review-inline-error" data-testid="review-error" role="alert">
            {actionError}
          </span>
        ) : null}
        {actionMessage ? (
          <span className="review-subbar__message" data-testid="review-message" role="status">
            {actionMessage}
          </span>
        ) : null}
        {onOpenTargetEditor ? (
          <button
            type="button"
            className="review-button review-button--quiet"
            data-testid="review-open-target-editor"
            onClick={onOpenTargetEditor}
          >
            {t('translation.review.openTargetEditor')}
            <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </button>
        ) : null}
        {actionMessage && hasNextItem ? (
          <button
            type="button"
            className="review-button review-button--quiet"
            data-testid="review-next-after-apply"
            onClick={onNextItem}
          >
            {t('translation.review.nextAfterApply')}
            <ChevronRight className="h-3 w-3" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </header>
  );
}
