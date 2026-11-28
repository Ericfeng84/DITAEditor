import { Loader2, Plus, X } from 'lucide-react';
import { useEffect, useId, useMemo, useState } from 'react';
import { useI18n } from '../i18n/index.js';
import { fetchManuals, type Manual } from '../services/manuals-api.js';
import type { TranslationLinkView } from '../services/translation-api.js';
import { useTranslationStore } from '../store/translation-store.js';
import type { TranslationLineageSourceOption } from './translation-lineage.js';
import {
  TARGET_LANGUAGES,
  languageLabel,
  pickAvailableTargetLang,
  suggestTargetLang,
} from './target-languages.js';

const OFFLINE = import.meta.env.VITE_STATIC_DEMO === 'true';
const LANG_TAG = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

export interface AddTargetLanguageDialogProps {
  open: boolean;
  /** Source manual the new pair belongs to when no explicit candidate is selected. */
  manualId: string;
  sourceLang?: string | null;
  /**
   * Phase 16 lineage (Q1): every node of the family, root first. Any node may spawn a child
   * language (`zh-CN → en-US → ar-SA`), so the dialog lets the caller pre-select the node whose
   * `+` button opened it instead of always deriving from the root.
   */
  sourceCandidates?: readonly TranslationLineageSourceOption[];
  defaultSourceManualId?: string | null;
  /** Q3: lowercase language tags already used anywhere in the family, which must stay disabled. */
  familyTakenLangs?: readonly string[];
  onClose: () => void;
  onCreated: (link: TranslationLinkView) => void;
}

/**
 * Phase 16 — add one target language to a manual.
 *
 * Two wiring modes, both producing the same `POST /api/translation/links`: create a brand-new
 * paired target manual (`createTargetManual: true` + `targetManualName`) or bind a manual that
 * already exists (`targetManualId`). The API owns the scaffolding, so the dialog never touches
 * the filesystem or Git itself.
 */
export function AddTargetLanguageDialog({
  open,
  manualId,
  sourceLang,
  sourceCandidates,
  defaultSourceManualId,
  familyTakenLangs,
  onClose,
  onCreated,
}: AddTargetLanguageDialogProps) {
  const { locale, t } = useI18n();
  const titleId = useId();
  const addLink = useTranslationStore((state) => state.addLink);
  const actionError = useTranslationStore((state) => state.actionError);
  const links = useTranslationStore((state) => state.links);

  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [sourceManualId, setSourceManualId] = useState('');
  const [targetLang, setTargetLang] = useState('');
  const [targetManualName, setTargetManualName] = useState('');
  const [targetManualId, setTargetManualId] = useState('');
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [busy, setBusy] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);

  const candidates = sourceCandidates ?? [];
  const selectedSource =
    candidates.find((candidate) => candidate.manualId === sourceManualId) ?? candidates[0] ?? null;
  const parentManualId = selectedSource?.manualId ?? manualId;
  const parentLang = selectedSource?.lang ?? sourceLang ?? null;
  const parentBranch = selectedSource?.branch ?? null;

  /**
   * Languages already taken in this family level (Q3). The family set prevents `ar-SA` from being
   * derived twice through different parents, and the per-manual links keep the dialog honest when
   * it is used without the lineage props (backward-compatible standalone mode).
   */
  const familyKey = (familyTakenLangs ?? []).join(',');
  const takenLangs = useMemo(() => {
    const taken = new Set<string>(
      (familyKey ? familyKey.split(',') : []).map((lang) => lang.toLowerCase()),
    );
    for (const link of links) {
      if (link.sourceManualId === parentManualId && link.targetLang) {
        taken.add(link.targetLang.toLowerCase());
      }
    }
    return taken;
  }, [links, parentManualId, familyKey]);

  useEffect(() => {
    if (!open) return;
    setMode('new');
    setSourceManualId(defaultSourceManualId ?? sourceCandidates?.[0]?.manualId ?? '');
    setTargetManualName('');
    setTargetManualId('');
    setValidation(null);
    // Re-running on every candidate edit would fight the user's own parent choice.
  }, [open, defaultSourceManualId]);

  useEffect(() => {
    if (!open) return;
    setTargetLang(pickAvailableTargetLang(suggestTargetLang(parentLang), takenLangs, parentLang));
  }, [open, parentLang, takenLangs]);

  useEffect(() => {
    if (!open || OFFLINE) return;
    let cancelled = false;
    fetchManuals()
      .then((snapshot) => {
        if (!cancelled) setManuals(snapshot.manuals.filter((manual) => manual.id !== parentManualId));
      })
      .catch(() => {
        if (!cancelled) setManuals([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, parentManualId]);

  if (!open) return null;

  const submit = async () => {
    const lang = targetLang.trim();
    if (!lang) {
      setValidation(t('translation.add.targetLangRequired'));
      return;
    }
    if (!LANG_TAG.test(lang)) {
      setValidation(t('translation.add.targetLangInvalid'));
      return;
    }
    if (mode === 'existing' && !targetManualId) {
      setValidation(t('translation.add.manualRequired'));
      return;
    }
    setValidation(null);
    setBusy(true);
    try {
      const link = await addLink({
        sourceManualId: parentManualId,
        targetLang: lang,
        ...(parentBranch ? { sourceBranch: parentBranch } : {}),
        ...(parentLang ? { sourceLang: parentLang } : {}),
        ...(mode === 'new'
          ? {
              createTargetManual: true,
              ...(targetManualName.trim() ? { targetManualName: targetManualName.trim() } : {}),
            }
          : { targetManualId }),
      });
      if (link) onCreated(link);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div className="w-[min(460px,95vw)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div>
            <h2 id={titleId} className="text-[13px] font-semibold text-slate-900">
              {t('translation.add.title')}
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">{t('translation.add.description')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label={t('translation.add.cancel')}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-3 text-[11.5px]">
          <div className="grid grid-cols-2 gap-2">
            {(['new', 'existing'] as const).map((item) => {
              const active = mode === item;
              return (
                <button
                  key={item}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setMode(item)}
                  className={`rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium transition-colors ${
                    active
                      ? 'border-blue-500 bg-blue-50 text-blue-800 ring-1 ring-blue-500'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {item === 'new' ? t('translation.add.modeNew') : t('translation.add.modeExisting')}
                </button>
              );
            })}
          </div>

          {candidates.length > 1 ? (
            <div>
              <label
                htmlFor="translation-add-source"
                className="mb-1 block font-medium text-slate-700"
              >
                {t('translation.add.sourceManual')}
              </label>
              <select
                id="translation-add-source"
                data-testid="translation-add-source"
                value={parentManualId}
                onChange={(event) => setSourceManualId(event.target.value)}
                className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-[12px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {candidates.map((candidate) => (
                  <option key={`${candidate.manualId}-${candidate.branch ?? ''}`} value={candidate.manualId}>
                    {(candidate.pathLangs.length > 0
                      ? candidate.pathLangs.join(' → ')
                      : (candidate.lang ?? candidate.manualId)) +
                      (candidate.manualName ? ` · ${candidate.manualName}` : '')}
                  </option>
                ))}
              </select>
              {selectedSource && selectedSource.progressPercent !== null && selectedSource.progressPercent < 100 ? (
                <p
                  data-testid="translation-add-parent-incomplete"
                  className="mt-1 text-[10.5px] text-amber-700"
                >
                  {t('translation.add.parentIncomplete', {
                    percent: selectedSource.progressPercent,
                  })}
                </p>
              ) : null}
            </div>
          ) : null}

          <div>
            <label htmlFor="translation-add-lang" className="mb-1 block font-medium text-slate-700">
              {t('translation.add.targetLang')}
            </label>
            <select
              id="translation-add-lang"
              data-testid="translation-add-lang"
              value={targetLang}
              onChange={(event) => setTargetLang(event.target.value)}
              className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-[12px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {targetLang ? null : (
                <option value="">{t('translation.add.targetLangSelect')}</option>
              )}
              {TARGET_LANGUAGES.map((tag) => {
                const used = takenLangs.has(tag.toLowerCase());
                return (
                  <option key={tag} value={tag} disabled={used}>
                    {used
                      ? t('translation.add.targetLangUsed', { lang: languageLabel(tag, locale) })
                      : languageLabel(tag, locale)}
                  </option>
                );
              })}
            </select>
          </div>

          {mode === 'new' ? (
            <div>
              <label htmlFor="translation-add-name" className="mb-1 block font-medium text-slate-700">
                {t('translation.add.manualName')}
              </label>
              <input
                id="translation-add-name"
                value={targetManualName}
                onChange={(event) => setTargetManualName(event.target.value)}
                placeholder={t('translation.add.manualNamePlaceholder')}
                className="h-8 w-full rounded-md border border-slate-300 px-2 text-[12px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          ) : (
            <div>
              <label htmlFor="translation-add-manual" className="mb-1 block font-medium text-slate-700">
                {t('translation.add.selectManual')}
              </label>
              <select
                id="translation-add-manual"
                value={targetManualId}
                onChange={(event) => setTargetManualId(event.target.value)}
                className="h-8 w-full rounded-md border border-slate-300 bg-white px-2 text-[12px] outline-none focus:border-blue-500"
              >
                <option value="">{t('translation.add.selectManualPlaceholder')}</option>
                {manuals.map((manual) => (
                  <option key={manual.id} value={manual.id}>
                    {manual.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {validation ? <p className="text-[11px] text-rose-600">{validation}</p> : null}
          {actionError ? (
            <p className="text-[11px] text-rose-600">{t('translation.error', { message: actionError })}</p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-1.5 border-t border-slate-100 bg-slate-50 px-4 py-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] text-slate-600 hover:bg-slate-100"
          >
            {t('translation.add.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-[11.5px] font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="h-3 w-3" aria-hidden="true" />
            )}
            {busy ? t('translation.add.submitting') : t('translation.add.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
