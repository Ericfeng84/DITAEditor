import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Sparkles,
  Unlink,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/index.js';
import { editorPath, navigate, translationCenterPath } from '../router/app-router.js';
import type { TranslationLinkView } from '../services/translation-api.js';
import { useTranslationStore } from '../store/translation-store.js';

function boolOption(options: Record<string, unknown>, key: string, fallback: boolean): boolean {
  const value = options[key];
  return typeof value === 'boolean' ? value : fallback;
}

function stringOption(options: Record<string, unknown>, key: string): string {
  const value = options[key];
  return typeof value === 'string' ? value : '';
}

export interface TranslationSettingsTabProps {
  link: TranslationLinkView;
  manualId: string;
  /** Phase 16 Q5: target languages hanging below this pair, so unlinking can warn first. */
  descendantLangs?: readonly string[];
  /** Called after a successful unlink so the center refreshes the family lineage. */
  onUnlinked?: () => void;
}

/**
 * Phase 16 — per-pair options.
 *
 * Everything here lands in `translation_links.options_json`; the pipeline reads it on the next
 * scan/job. Nothing writes into the DITA source or the target worktree, which is why the tab can
 * be edited, saved and reverted freely.
 */
export function TranslationSettingsTab({
  link,
  manualId,
  descendantLangs,
  onUnlinked,
}: TranslationSettingsTabProps) {
  const { t } = useI18n();
  const patchLink = useTranslationStore((state) => state.patchLink);
  const removeLink = useTranslationStore((state) => state.removeLink);
  const actionError = useTranslationStore((state) => state.actionError);

  const [segmentReuse, setSegmentReuse] = useState(true);
  const [qaStrict, setQaStrict] = useState(false);
  /** Phase 16 — both default to `true`: the dual-AI loop and the strict gate are opt-out, not opt-in. */
  const [aiReviewEnabled, setAiReviewEnabled] = useState(true);
  const [ditaOtStrictEnabled, setDitaOtStrictEnabled] = useState(true);
  const [targetLocaleStyle, setTargetLocaleStyle] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const downstreamLangs = descendantLangs ?? [];

  useEffect(() => {
    setSegmentReuse(boolOption(link.options, 'segmentReuse', true));
    setQaStrict(boolOption(link.options, 'qaStrict', false));
    setAiReviewEnabled(boolOption(link.options, 'aiReviewEnabled', true));
    setDitaOtStrictEnabled(boolOption(link.options, 'ditaOtStrictEnabled', true));
    setTargetLocaleStyle(stringOption(link.options, 'targetLocaleStyle'));
    setSaved(false);
    setUnlinkOpen(false);
  }, [link.id, link.options]);

  const save = async () => {
    setBusy(true);
    setSaved(false);
    try {
      const updated = await patchLink(link.id, {
        options: {
          ...link.options,
          segmentReuse,
          qaStrict,
          aiReviewEnabled,
          ditaOtStrictEnabled,
          targetLocaleStyle: targetLocaleStyle.trim(),
        },
      });
      if (updated) setSaved(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dita-scroller space-y-2.5" data-testid="translation-settings-tab">
      <section className="rounded-lg border border-slate-200 bg-white p-3">
        <h3 className="text-[12px] font-semibold text-slate-900">{t('translation.settings.title')}</h3>
        <p className="mt-0.5 text-[11px] text-slate-500">{t('translation.settings.description')}</p>

        <div className="mt-2.5 space-y-2 text-[11.5px]">
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={segmentReuse}
              onChange={(event) => setSegmentReuse(event.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            />
            <span>
              <span className="font-medium text-slate-800">{t('translation.settings.segmentReuse')}</span>
              <span className="mt-0.5 block text-[10.5px] text-slate-500">
                {t('translation.settings.segmentReuseHint')}
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={qaStrict}
              onChange={(event) => setQaStrict(event.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            />
            <span>
              <span className="font-medium text-slate-800">{t('translation.settings.qaStrict')}</span>
              <span className="mt-0.5 block text-[10.5px] text-slate-500">
                {t('translation.settings.qaStrictHint')}
              </span>
            </span>
          </label>

          {/* Phase 16 — the two stages that turn one model's output into a reviewed, schema-valid
              draft. They are persisted per language pair, so a cheap pair can opt out while the
              release pair keeps both gates on. */}
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={aiReviewEnabled}
              data-testid="translation-settings-ai-review"
              onChange={(event) => setAiReviewEnabled(event.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            />
            <span>
              <span className="inline-flex items-center gap-1 font-medium text-slate-800">
                <ShieldCheck className="h-3 w-3 text-slate-400" aria-hidden="true" />
                {t('translation.settings.aiReview')}
              </span>
              <span className="mt-0.5 block text-[10.5px] text-slate-500">
                {t('translation.settings.aiReviewHint')}
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={ditaOtStrictEnabled}
              data-testid="translation-settings-ditaot-strict"
              onChange={(event) => setDitaOtStrictEnabled(event.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            />
            <span>
              <span className="inline-flex items-center gap-1 font-medium text-slate-800">
                <Sparkles className="h-3 w-3 text-slate-400" aria-hidden="true" />
                {t('translation.settings.ditaOtStrict')}
              </span>
              <span className="mt-0.5 block text-[10.5px] text-slate-500">
                {t('translation.settings.ditaOtStrictHint')}
              </span>
            </span>
          </label>

          <div>
            <label htmlFor="translation-locale-style" className="mb-1 block font-medium text-slate-800">
              {t('translation.settings.targetLocaleStyle')}
            </label>
            <input
              id="translation-locale-style"
              value={targetLocaleStyle}
              onChange={(event) => setTargetLocaleStyle(event.target.value)}
              placeholder={t('translation.settings.targetLocaleStylePlaceholder')}
              spellCheck={false}
              className="h-7 w-48 rounded-md border border-slate-300 px-2 font-mono text-[11.5px] outline-none transition-colors focus-visible:border-blue-500 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-600"
            />
          </div>
        </div>

        <div className="mt-3 flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-md border border-blue-600 bg-blue-600 px-2.5 py-1 text-[11.5px] font-semibold text-white shadow-xs transition-colors hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
            {t('translation.settings.save')}
          </button>
          {saved ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
              {t('translation.settings.saved')}
            </span>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
          <span className="font-medium text-slate-800">
            {t('translation.settings.sourceManual', {
              name: link.sourceManual?.name ?? link.sourceManualId,
            })}
          </span>
          <ArrowRight className="h-2.5 w-2.5 shrink-0 text-slate-300" aria-hidden="true" />
          <span className="font-medium text-slate-800">
            {t('translation.settings.targetManual', {
              name: link.targetManual?.name ?? link.targetManualId,
            })}
          </span>
          <span className="rounded border border-slate-200 bg-slate-50 px-1 py-[1px] text-[10.5px] tabular-nums text-slate-600">
            {t('translation.settings.sourceBranch', { branch: link.sourceBranch })}
          </span>
          <span className="rounded border border-slate-200 bg-slate-50 px-1 py-[1px] text-[10.5px] tabular-nums text-slate-600">
            {t('translation.settings.targetBranch', { branch: link.targetBranch })}
          </span>
          <button
            type="button"
            onClick={() => navigate(editorPath(link.targetManualId, { branch: link.targetBranch }))}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
            {t('translation.settings.openTargetManual')}
          </button>
        </div>

        <div className="mt-3 border-t border-slate-100 pt-2.5">
          {unlinkOpen ? (
            <div className="space-y-1.5">
              <p className="text-[11px] text-slate-600">{t('translation.settings.unlinkBody')}</p>
              {downstreamLangs.length > 0 ? (
                <p
                  data-testid="translation-unlink-downstream-warning"
                  className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10.5px] text-amber-800"
                >
                  {t('translation.settings.unlinkDownstreamWarning', {
                    count: downstreamLangs.length,
                    langs: downstreamLangs.join(', '),
                  })}
                </p>
              ) : null}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  data-testid="translation-unlink-confirm"
                  onClick={() => {
                    void removeLink(link.id).then((removed) => {
                      if (!removed) return;
                      // The family shrinks by one node: refresh links *before* leaving the page so
                      // the lineage tree no longer lists the removed branch.
                      onUnlinked?.();
                      navigate(translationCenterPath(manualId, { tab: 'settings' }));
                    });
                  }}
                  className="rounded-md border border-rose-600 bg-rose-600 px-2.5 py-1 text-[11.5px] font-semibold text-white shadow-xs transition-colors hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
                >
                  {t('translation.settings.unlinkConfirm')}
                </button>
                <button
                  type="button"
                  onClick={() => setUnlinkOpen(false)}
                  className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] font-medium text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  {t('translation.settings.unlinkCancel')}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              data-testid="translation-unlink-start"
              onClick={() => setUnlinkOpen(true)}
              className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-0.5 text-[11px] font-medium text-rose-600 transition-colors hover:bg-rose-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
            >
              <Unlink className="h-2.5 w-2.5" aria-hidden="true" />
              {t('translation.settings.unlink')}
            </button>
          )}
        </div>
      </section>

      {actionError ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700">
          {t('translation.error', { message: actionError })}
        </p>
      ) : null}
    </div>
  );
}
