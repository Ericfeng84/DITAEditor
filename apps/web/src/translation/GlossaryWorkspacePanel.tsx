import {
  Check,
  Download,
  FileUp,
  Languages,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useI18n, type MessageKey } from '../i18n/index.js';
import type {
  CreateGlossaryInput,
  CreateGlossaryTermInput,
  GlossaryExchangeFormat,
  GlossaryImportResult,
  GlossaryScope,
  GlossaryTermStatus,
  GlossaryTermView,
  GlossaryView,
  UpdateGlossaryTermInput,
} from '../services/translation-api.js';
import { useTranslationStore } from '../store/translation-store.js';

const TERM_STATUS_KEYS: Record<GlossaryTermStatus, MessageKey> = {
  approved: 'translation.termStatus.approved',
  draft: 'translation.termStatus.draft',
  deprecated: 'translation.termStatus.deprecated',
};

const TERM_STATUS_TONE: Record<GlossaryTermStatus, string> = {
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  draft: 'border-slate-200 bg-slate-50 text-slate-600',
  deprecated: 'border-rose-200 bg-rose-50 text-rose-600',
};

/* -------------------------------------------------------------------------- */
/* Shared overlay dialog (jsdom has no HTMLDialogElement.showModal)            */
/* -------------------------------------------------------------------------- */

function OverlayDialog({
  title,
  onClose,
  children,
  width = 'max-w-lg',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`w-full ${width} max-h-[88vh] overflow-y-auto rounded-xl bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
          <h2 className="text-[12.5px] font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="rounded p-0.5 text-slate-500 hover:bg-slate-100"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
        <div className="p-3">{children}</div>
      </div>
    </div>
  );
}

const fieldClass =
  'h-7 w-full rounded-md border border-slate-300 px-2 text-[11.5px] text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
const labelClass = 'mb-0.5 block text-[10.5px] font-medium text-slate-600';

/* -------------------------------------------------------------------------- */
/* Glossary create/edit                                                       */
/* -------------------------------------------------------------------------- */

function GlossaryFormDialog({
  glossary,
  defaultSourceLang,
  scope,
  manualId,
  onClose,
}: {
  glossary: GlossaryView | null;
  defaultSourceLang: string;
  scope: GlossaryScope;
  manualId: string | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const addGlossary = useTranslationStore((state) => state.addGlossary);
  const patchGlossary = useTranslationStore((state) => state.patchGlossary);
  const [name, setName] = useState(glossary?.name ?? '');
  const [description, setDescription] = useState(glossary?.description ?? '');
  const [sourceLang, setSourceLang] = useState(glossary?.sourceLang ?? defaultSourceLang);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      if (glossary) {
        const updated = await patchGlossary(glossary.id, {
          name: trimmed,
          description: description.trim(),
          sourceLang: sourceLang.trim(),
        });
        if (updated) onClose();
      } else {
        const input: CreateGlossaryInput = {
          scope,
          manualId: scope === 'manual' ? (manualId ?? undefined) : undefined,
          name: trimmed,
          description: description.trim() || undefined,
          sourceLang: sourceLang.trim(),
          enabled: true,
        };
        const created = await addGlossary(input);
        if (created) onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <OverlayDialog
      title={glossary ? t('translation.glossary.edit') : t('translation.glossary.new')}
      onClose={onClose}
    >
      <div className="space-y-2">
        <div>
          <label className={labelClass} htmlFor="glossary-name">
            {t('translation.glossary.name')}
          </label>
          <input
            id="glossary-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('translation.glossary.namePlaceholder')}
            className={fieldClass}
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="glossary-description">
            {t('translation.glossary.description')}
          </label>
          <textarea
            id="glossary-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t('translation.glossary.descriptionPlaceholder')}
            rows={2}
            className="w-full rounded-md border border-slate-300 px-2 py-1 text-[11.5px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
        <div>
          <label className={labelClass} htmlFor="glossary-source-lang">
            {t('translation.glossary.sourceLang')}
          </label>
          <input
            id="glossary-source-lang"
            value={sourceLang}
            onChange={(event) => setSourceLang(event.target.value)}
            spellCheck={false}
            className={`${fieldClass} w-32 font-mono`}
          />
        </div>
        <div className="flex items-center justify-end gap-1.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] text-slate-600 hover:bg-slate-50"
          >
            {t('translation.glossary.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !name.trim()}
            data-testid="glossary-form-submit"
            className="rounded-md bg-slate-900 px-2.5 py-1 text-[11.5px] font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {glossary
              ? t('translation.glossary.save')
              : busy
                ? t('translation.glossary.creating')
                : t('translation.glossary.create')}
          </button>
        </div>
      </div>
    </OverlayDialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Term create/edit                                                           */
/* -------------------------------------------------------------------------- */

interface TranslationRow {
  targetLang: string;
  targetTerm: string;
  forbiddenTargets: string;
}

function splitList(value: string): string[] {
  return value
    .split(/[,，;]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function TermFormDialog({
  glossary,
  term,
  defaultTargetLang,
  onClose,
}: {
  glossary: GlossaryView;
  term: GlossaryTermView | null;
  defaultTargetLang: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const addTerm = useTranslationStore((state) => state.addTerm);
  const patchTerm = useTranslationStore((state) => state.patchTerm);
  const [sourceTerm, setSourceTerm] = useState(term?.sourceTerm ?? '');
  const [synonyms, setSynonyms] = useState((term?.synonyms ?? []).join(', '));
  const [caseSensitive, setCaseSensitive] = useState(term?.caseSensitive ?? false);
  const [doNotTranslate, setDoNotTranslate] = useState(term?.doNotTranslate ?? false);
  const [partOfSpeech, setPartOfSpeech] = useState(term?.partOfSpeech ?? '');
  const [contextNote, setContextNote] = useState(term?.contextNote ?? '');
  const [status, setStatus] = useState<GlossaryTermStatus>(term?.status ?? 'approved');
  const [rows, setRows] = useState<TranslationRow[]>(() =>
    term && term.translations.length > 0
      ? term.translations.map((translation) => ({
          targetLang: translation.targetLang,
          targetTerm: translation.targetTerm,
          forbiddenTargets: translation.forbiddenTargets.join(', '),
        }))
      : [{ targetLang: defaultTargetLang, targetTerm: '', forbiddenTargets: '' }],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateRow = (index: number, patch: Partial<TranslationRow>) => {
    setRows((previous) =>
      previous.map((row, position) => (position === index ? { ...row, ...patch } : row)),
    );
  };

  const submit = async () => {
    const trimmed = sourceTerm.trim();
    if (!trimmed) {
      setError(t('translation.glossary.term.sourceTermRequired'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const translations = rows
        .filter((row) => row.targetLang.trim() && row.targetTerm.trim())
        .map((row) => ({
          targetLang: row.targetLang.trim(),
          targetTerm: row.targetTerm.trim(),
          forbiddenTargets: splitList(row.forbiddenTargets),
        }));
      const base = {
        sourceTerm: trimmed,
        synonyms: splitList(synonyms),
        caseSensitive,
        doNotTranslate,
        partOfSpeech: partOfSpeech.trim() || null,
        contextNote: contextNote.trim() || null,
        status,
        translations,
      };
      if (term) {
        const patch: UpdateGlossaryTermInput = { ...base, replaceTranslations: true };
        const updated = await patchTerm(term.id, patch);
        if (updated) onClose();
      } else {
        const input: CreateGlossaryTermInput = base;
        const created = await addTerm(glossary.id, input);
        if (created) onClose();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <OverlayDialog
      title={term ? t('translation.glossary.editTerm') : t('translation.glossary.addTerm')}
      onClose={onClose}
      width="max-w-2xl"
    >
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass} htmlFor="term-source">
              {t('translation.glossary.term.sourceTerm')}
            </label>
            <input
              id="term-source"
              value={sourceTerm}
              onChange={(event) => setSourceTerm(event.target.value)}
              placeholder={t('translation.glossary.term.sourceTermPlaceholder')}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="term-synonyms">
              {t('translation.glossary.term.synonyms')}
            </label>
            <input
              id="term-synonyms"
              value={synonyms}
              onChange={(event) => setSynonyms(event.target.value)}
              placeholder={t('translation.glossary.term.synonymsPlaceholder')}
              className={fieldClass}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-700">
          <label className="inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(event) => setCaseSensitive(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
            />
            {t('translation.glossary.term.caseSensitive')}
          </label>
          <label className="inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={doNotTranslate}
              onChange={(event) => setDoNotTranslate(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600"
            />
            {t('translation.glossary.term.doNotTranslate')}
          </label>
          <label className="inline-flex items-center gap-1">
            {t('translation.glossary.term.status')}
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as GlossaryTermStatus)}
              className="h-6 rounded border border-slate-300 bg-white px-1 text-[11px]"
            >
              {(['approved', 'draft', 'deprecated'] as GlossaryTermStatus[]).map((value) => (
                <option key={value} value={value}>
                  {t(TERM_STATUS_KEYS[value])}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className={labelClass} htmlFor="term-pos">
              {t('translation.glossary.term.partOfSpeech')}
            </label>
            <input
              id="term-pos"
              value={partOfSpeech}
              onChange={(event) => setPartOfSpeech(event.target.value)}
              placeholder={t('translation.glossary.term.partOfSpeechPlaceholder')}
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="term-note">
              {t('translation.glossary.term.contextNote')}
            </label>
            <input
              id="term-note"
              value={contextNote}
              onChange={(event) => setContextNote(event.target.value)}
              placeholder={t('translation.glossary.term.contextNotePlaceholder')}
              className={fieldClass}
            />
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-slate-50/60 p-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10.5px] font-medium text-slate-600">
              {t('translation.glossary.term.translations')}
            </span>
            <button
              type="button"
              onClick={() =>
                setRows((previous) => [
                  ...previous,
                  { targetLang: defaultTargetLang, targetTerm: '', forbiddenTargets: '' },
                ])
              }
              className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-50"
            >
              <Plus className="h-2.5 w-2.5" aria-hidden="true" />
              {t('translation.glossary.term.addTranslation')}
            </button>
          </div>
          <div className="space-y-1.5">
            {rows.map((row, index) => (
              <div key={index} className="grid grid-cols-[70px_1fr_1fr_auto] items-center gap-1.5">
                <input
                  value={row.targetLang}
                  onChange={(event) => updateRow(index, { targetLang: event.target.value })}
                  aria-label={t('translation.glossary.term.targetLang')}
                  spellCheck={false}
                  className="h-6 rounded border border-slate-300 px-1 font-mono text-[11px]"
                />
                <input
                  value={row.targetTerm}
                  onChange={(event) => updateRow(index, { targetTerm: event.target.value })}
                  aria-label={t('translation.glossary.term.targetTerm')}
                  placeholder={t('translation.glossary.term.targetTermPlaceholder')}
                  className="h-6 rounded border border-slate-300 px-1 text-[11px]"
                />
                <input
                  value={row.forbiddenTargets}
                  onChange={(event) => updateRow(index, { forbiddenTargets: event.target.value })}
                  aria-label={t('translation.glossary.term.forbiddenTargets')}
                  placeholder={t('translation.glossary.term.forbiddenPlaceholder')}
                  className="h-6 rounded border border-slate-300 px-1 text-[11px]"
                />
                <button
                  type="button"
                  onClick={() => setRows((previous) => previous.filter((_, p) => p !== index))}
                  disabled={rows.length === 1}
                  aria-label={t('translation.glossary.term.removeTranslation')}
                  className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600 disabled:opacity-30"
                >
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {error ? <p className="text-[11px] text-rose-600">{error}</p> : null}

        <div className="flex items-center justify-end gap-1.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] text-slate-600 hover:bg-slate-50"
          >
            {t('translation.glossary.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy}
            data-testid="term-form-submit"
            className="rounded-md bg-slate-900 px-2.5 py-1 text-[11.5px] font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {busy ? t('translation.glossary.savingTerm') : t('translation.glossary.saveTerm')}
          </button>
        </div>
      </div>
    </OverlayDialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Import                                                                     */
/* -------------------------------------------------------------------------- */

function ImportDialog({
  glossaryId,
  defaultTargetLang,
  onClose,
}: {
  glossaryId: string;
  defaultTargetLang: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const runImport = useTranslationStore((state) => state.runImport);
  const [format, setFormat] = useState<GlossaryExchangeFormat>('csv');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<GlossaryImportResult | null>(null);
  const [emptyError, setEmptyError] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const dryRun = async () => {
    if (!content.trim()) {
      setEmptyError(true);
      return;
    }
    setEmptyError(false);
    setBusy(true);
    try {
      const result = await runImport(glossaryId, {
        format,
        content,
        dryRun: true,
        targetLang: defaultTargetLang || undefined,
      });
      if (result) setPreview(result);
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!content.trim()) {
      setEmptyError(true);
      return;
    }
    setBusy(true);
    try {
      const result = await runImport(glossaryId, {
        format,
        content,
        dryRun: false,
        targetLang: defaultTargetLang || undefined,
      });
      if (result) onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <OverlayDialog title={t('translation.glossary.importTitle')} onClose={onClose} width="max-w-2xl">
      <div className="space-y-2">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className={labelClass} htmlFor="glossary-import-format">
              {t('translation.glossary.importFormat')}
            </label>
            <select
              id="glossary-import-format"
              value={format}
              onChange={(event) => {
                setFormat(event.target.value as GlossaryExchangeFormat);
                setPreview(null);
              }}
              className="h-7 rounded-md border border-slate-300 bg-white px-1.5 text-[11.5px]"
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
              <option value="tbx">TBX</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11.5px] font-medium text-slate-600 hover:bg-slate-50"
          >
            <FileUp className="h-3 w-3" aria-hidden="true" />
            {t('translation.glossary.importFile')}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.json,.tbx,.txt"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                setContent(String(reader.result ?? ''));
                setPreview(null);
              };
              reader.readAsText(file);
            }}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="glossary-import-content">
            {t('translation.glossary.importContent')}
          </label>
          <textarea
            id="glossary-import-content"
            value={content}
            onChange={(event) => {
              setContent(event.target.value);
              setPreview(null);
            }}
            placeholder={t('translation.glossary.importContentPlaceholder')}
            rows={7}
            spellCheck={false}
            className="w-full resize-y rounded-md border border-slate-300 px-2 py-1 font-mono text-[11px] outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {emptyError ? (
          <p className="text-[11px] text-rose-600">{t('translation.glossary.importEmpty')}</p>
        ) : null}

        {preview ? (
          <div className="rounded-md border border-slate-200 bg-slate-50/60 p-2" data-testid="import-preview">
            <p className="text-[10.5px] font-medium text-slate-600">
              {t('translation.glossary.importPreview')}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10.5px]">
              <span className="rounded border border-emerald-200 bg-emerald-50 px-1 py-[1px] font-medium text-emerald-700">
                {t('translation.glossary.importNew', { count: preview.stats.newCount })}
              </span>
              <span className="rounded border border-blue-200 bg-blue-50 px-1 py-[1px] font-medium text-blue-700">
                {t('translation.glossary.importUpdate', { count: preview.stats.updateCount })}
              </span>
              <span className="rounded border border-rose-200 bg-rose-50 px-1 py-[1px] font-medium text-rose-700">
                {t('translation.glossary.importInvalid', { count: preview.stats.invalidCount })}
              </span>
            </div>
            {preview.preview.length > 0 ? (
              <ul className="mt-1.5 max-h-32 space-y-0.5 overflow-y-auto">
                {preview.preview.slice(0, 40).map((row, index) => (
                  <li key={index} className="font-mono text-[10px] text-slate-600">
                    <span className="mr-1 rounded bg-white px-1 text-slate-500">
                      {t(`translation.glossary.importAction.${row.action}` as MessageKey)}
                    </span>
                    {row.sourceTerm}
                    {row.targetTerm ? ` → ${row.targetTerm}` : ''}
                  </li>
                ))}
              </ul>
            ) : null}
            {preview.errors.length > 0 ? (
              <div className="mt-1.5">
                <p className="text-[10.5px] font-medium text-rose-700">
                  {t('translation.glossary.importErrors')}
                </p>
                <ul className="max-h-24 space-y-0.5 overflow-y-auto">
                  {preview.errors.slice(0, 30).map((issue, index) => (
                    <li key={index} className="text-[10px] text-rose-600">
                      {t('translation.glossary.importRowError', {
                        row: issue.row,
                        message: issue.message,
                      })}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-1.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11.5px] text-slate-600 hover:bg-slate-50"
          >
            {t('translation.glossary.importClose')}
          </button>
          <button
            type="button"
            onClick={() => void dryRun()}
            disabled={busy}
            data-testid="import-dry-run"
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11.5px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {busy ? t('translation.glossary.importRunning') : t('translation.glossary.importDryRun')}
          </button>
          <button
            type="button"
            onClick={() => void commit()}
            disabled={busy || !preview}
            data-testid="import-commit"
            className="rounded-md bg-slate-900 px-2.5 py-1 text-[11.5px] font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {t('translation.glossary.importCommit')}
          </button>
        </div>
      </div>
    </OverlayDialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Panel                                                                      */
/* -------------------------------------------------------------------------- */

export interface GlossaryWorkspacePanelProps {
  scope: GlossaryScope;
  manualId?: string | null;
  defaultSourceLang?: string | null;
  defaultTargetLang?: string | null;
}

export function GlossaryWorkspacePanel({
  scope,
  manualId = null,
  defaultSourceLang = null,
  defaultTargetLang = null,
}: GlossaryWorkspacePanelProps) {
  const { t } = useI18n();
  const glossaries = useTranslationStore((state) => state.glossaries);
  const glossariesLoading = useTranslationStore((state) => state.glossariesLoading);
  const glossariesError = useTranslationStore((state) => state.glossariesError);
  const activeGlossaryId = useTranslationStore((state) => state.activeGlossaryId);
  const terms = useTranslationStore((state) => state.terms);
  const termsLoading = useTranslationStore((state) => state.termsLoading);
  const termsError = useTranslationStore((state) => state.termsError);
  const actionError = useTranslationStore((state) => state.actionError);
  const actionMessage = useTranslationStore((state) => state.actionMessage);
  const clearActionFeedback = useTranslationStore((state) => state.clearActionFeedback);
  const loadGlossaries = useTranslationStore((state) => state.loadGlossaries);
  const patchGlossary = useTranslationStore((state) => state.patchGlossary);
  const removeGlossary = useTranslationStore((state) => state.removeGlossary);
  const selectGlossary = useTranslationStore((state) => state.selectGlossary);
  const loadTerms = useTranslationStore((state) => state.loadTerms);
  const removeTerm = useTranslationStore((state) => state.removeTerm);
  const runExport = useTranslationStore((state) => state.runExport);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | GlossaryTermStatus>('');
  const [glossaryForm, setGlossaryForm] = useState<{ open: boolean; glossary: GlossaryView | null }>(
    { open: false, glossary: null },
  );
  const [termForm, setTermForm] = useState<{ open: boolean; term: GlossaryTermView | null }>({
    open: false,
    term: null,
  });
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    void loadGlossaries(scope === 'manual' ? { scope, manualId: manualId ?? undefined } : { scope });
  }, [scope, manualId, loadGlossaries]);

  useEffect(() => {
    if (!activeGlossaryId) return;
    void loadTerms(activeGlossaryId, {
      search: query.trim() || undefined,
      status: statusFilter || undefined,
    });
  }, [activeGlossaryId, query, statusFilter, loadTerms]);

  const activeGlossary = glossaries.find((entry) => entry.id === activeGlossaryId) ?? null;
  const targetLang = defaultTargetLang ?? '';

  const exportAs = async (format: GlossaryExchangeFormat) => {
    setExportOpen(false);
    if (!activeGlossary) return;
    await runExport(activeGlossary.id, { format });
  };

  return (
    <div className="space-y-2" data-testid="glossary-workspace">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <p className="text-[11px] text-slate-500">
          {scope === 'manual' ? t('translation.glossary.scopedHint') : t('translation.glossary.globalHint')}
        </p>
        <button
          type="button"
          onClick={() => setGlossaryForm({ open: true, glossary: null })}
          data-testid="glossary-create"
          className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-1 text-[11.5px] font-medium text-white hover:bg-slate-800"
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
          {t('translation.glossary.new')}
        </button>
      </div>

      {(glossariesError || actionError || termsError) ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700">
          {t('translation.error', {
            message: glossariesError ?? actionError ?? termsError ?? '',
          })}
        </p>
      ) : null}
      {actionMessage ? (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700">
          <button type="button" onClick={clearActionFeedback} className="float-right text-emerald-600">
            ×
          </button>
          {actionMessage}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-2 lg:grid-cols-[220px_1fr]">
        {/* ------------------------------------------------------------- list */}
        <aside className="rounded-lg border border-slate-200 bg-white">
          <h3 className="border-b border-slate-100 px-2 py-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-500">
            {t('translation.glossary.list')}
          </h3>
          {glossariesLoading && glossaries.length === 0 ? (
            <p className="flex items-center gap-1 px-2 py-3 text-[11px] text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              {t('translation.loading')}
            </p>
          ) : glossaries.length === 0 ? (
            <p className="px-2 py-3 text-[11px] text-slate-500">{t('translation.glossary.empty')}</p>
          ) : (
            <ul className="p-1">
              {glossaries.map((glossary) => {
                const active = glossary.id === activeGlossaryId;
                return (
                  <li key={glossary.id}>
                    <div
                      className={`group rounded-md px-1.5 py-1 ${
                        active ? 'bg-blue-50 ring-1 ring-blue-300' : 'hover:bg-slate-50'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => void selectGlossary(glossary.id)}
                        data-testid={`glossary-item-${glossary.id}`}
                        className="block w-full text-left"
                      >
                        <div className="flex items-center gap-1">
                          <span className="truncate text-[11.5px] font-medium text-slate-800">
                            {glossary.name}
                          </span>
                          <span className="shrink-0 rounded border border-slate-200 bg-white px-1 text-[9px] text-slate-500">
                            {glossary.scope === 'global'
                              ? t('translation.glossary.scopeGlobal')
                              : t('translation.glossary.scopeManual')}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-[9.5px] text-slate-500">
                          <span className="font-mono">{glossary.sourceLang}</span>
                          <span>·</span>
                          <span>{t('translation.glossary.termCount', { count: glossary.termCount })}</span>
                          <span
                            className={`ml-auto rounded px-1 ${
                              glossary.enabled
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            {glossary.enabled
                              ? t('translation.glossary.enabledOn')
                              : t('translation.glossary.enabledOff')}
                          </span>
                        </div>
                      </button>
                      <div className="mt-0.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <button
                          type="button"
                          onClick={() => void patchGlossary(glossary.id, { enabled: !glossary.enabled })}
                          aria-label={t('translation.glossary.enabled')}
                          title={t('translation.glossary.enabled')}
                          className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-emerald-600"
                        >
                          <Check className="h-2.5 w-2.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setGlossaryForm({ open: true, glossary })}
                          aria-label={t('translation.glossary.edit')}
                          title={t('translation.glossary.edit')}
                          className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-blue-600"
                        >
                          <Pencil className="h-2.5 w-2.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(t('translation.glossary.deleteConfirm', { name: glossary.name }))) {
                              void removeGlossary(glossary.id);
                            }
                          }}
                          aria-label={t('translation.glossary.delete')}
                          title={t('translation.glossary.delete')}
                          className="rounded p-0.5 text-slate-400 hover:bg-white hover:text-rose-600"
                        >
                          <Trash2 className="h-2.5 w-2.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* ------------------------------------------------------------ terms */}
        <section className="min-w-0 rounded-lg border border-slate-200 bg-white">
          {!activeGlossary ? (
            <p className="px-3 py-6 text-center text-[11.5px] text-slate-500">
              {t('translation.glossary.needGlossary')}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-2 py-1.5">
                <Languages className="h-3 w-3 text-slate-400" aria-hidden="true" />
                <span className="text-[11.5px] font-semibold text-slate-800">{activeGlossary.name}</span>
                <span className="rounded border border-slate-200 bg-slate-50 px-1 font-mono text-[9.5px] text-slate-500">
                  {activeGlossary.sourceLang}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setImportOpen(true)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10.5px] font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <FileUp className="h-2.5 w-2.5" aria-hidden="true" />
                    {t('translation.glossary.import')}
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setExportOpen((open) => !open)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10.5px] font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <Download className="h-2.5 w-2.5" aria-hidden="true" />
                      {t('translation.glossary.export')}
                    </button>
                    {exportOpen ? (
                      <div
                        role="menu"
                        className="absolute right-0 z-20 mt-1 w-32 rounded-md border border-slate-200 bg-white py-0.5 shadow-lg"
                      >
                        {(
                          [
                            ['csv', 'translation.glossary.exportCsv'],
                            ['json', 'translation.glossary.exportJson'],
                            ['tbx', 'translation.glossary.exportTbx'],
                          ] as [GlossaryExchangeFormat, MessageKey][]
                        ).map(([format, key]) => (
                          <button
                            key={format}
                            type="button"
                            role="menuitem"
                            onClick={() => void exportAs(format)}
                            className="block w-full px-2 py-1 text-left text-[10.5px] text-slate-700 hover:bg-slate-50"
                          >
                            {t(key)}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setTermForm({ open: true, term: null })}
                    data-testid="glossary-add-term"
                    className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-1.5 py-0.5 text-[10.5px] font-medium text-white hover:bg-slate-800"
                  >
                    <Plus className="h-2.5 w-2.5" aria-hidden="true" />
                    {t('translation.glossary.addTerm')}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-2 py-1.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-1.5 top-1.5 h-3 w-3 text-slate-400" aria-hidden="true" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={t('translation.glossary.termsSearch')}
                    aria-label={t('translation.glossary.termsSearchAria')}
                    className="h-6 w-44 rounded border border-slate-300 pl-5 pr-1.5 text-[11px] outline-none focus:border-blue-500"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as '' | GlossaryTermStatus)}
                  aria-label={t('translation.glossary.termsFilterStatus')}
                  className="h-6 rounded border border-slate-300 bg-white px-1 text-[11px]"
                >
                  <option value="">{t('translation.files.filterAll')}</option>
                  {(['approved', 'draft', 'deprecated'] as GlossaryTermStatus[]).map((value) => (
                    <option key={value} value={value}>
                      {t(TERM_STATUS_KEYS[value])}
                    </option>
                  ))}
                </select>
                <span className="text-[10.5px] text-slate-400">
                  {t('translation.glossary.termCount', { count: terms.length })}
                </span>
              </div>

              <table className="w-full border-collapse text-[11.5px]">
                <thead>
                  <tr className="bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-1 font-medium">{t('translation.glossary.term.sourceTerm')}</th>
                    <th className="px-2 py-1 font-medium">{t('translation.glossary.term.translations')}</th>
                    <th className="px-2 py-1 font-medium">{t('translation.glossary.term.status')}</th>
                    <th className="px-2 py-1 text-right font-medium">{t('translation.files.colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {termsLoading && terms.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-2 py-4 text-center text-[11px] text-slate-500">
                        {t('translation.loading')}
                      </td>
                    </tr>
                  ) : terms.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-2 py-4 text-center text-[11px] text-slate-500">
                        {t('translation.glossary.emptyTerms')}
                      </td>
                    </tr>
                  ) : (
                    terms.map((term) => (
                      <tr
                        key={term.id}
                        data-testid={`glossary-term-${term.id}`}
                        className="border-t border-slate-100 align-top hover:bg-slate-50/60"
                      >
                        <td className="px-2 py-1">
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="font-medium text-slate-800">{term.sourceTerm}</span>
                            {term.doNotTranslate ? (
                              <span className="rounded border border-slate-300 bg-slate-100 px-1 text-[9px] font-medium text-slate-600">
                                {t('translation.glossary.term.dntBadge')}
                              </span>
                            ) : null}
                            {term.caseSensitive ? (
                              <span className="rounded border border-slate-200 bg-white px-1 text-[9px] text-slate-500">
                                {t('translation.glossary.term.caseSensitiveBadge')}
                              </span>
                            ) : null}
                          </div>
                          {term.synonyms.length > 0 ? (
                            <p className="mt-0.5 text-[9.5px] text-slate-500">
                              {t('translation.glossary.term.synonymsLabel', {
                                list: term.synonyms.join(', '),
                              })}
                            </p>
                          ) : null}
                          {term.contextNote ? (
                            <p className="mt-0.5 text-[9.5px] text-slate-400">{term.contextNote}</p>
                          ) : null}
                        </td>
                        <td className="px-2 py-1">
                          <ul className="space-y-0.5">
                            {term.translations.map((translation) => (
                              <li key={translation.id} className="flex flex-wrap items-center gap-1">
                                <span className="rounded border border-slate-200 bg-slate-50 px-1 font-mono text-[9px] text-slate-500">
                                  {translation.targetLang}
                                </span>
                                <span className="text-slate-800">{translation.targetTerm}</span>
                                {translation.forbiddenTargets.length > 0 ? (
                                  <span className="rounded border border-rose-200 bg-rose-50 px-1 text-[9px] text-rose-600">
                                    {t('translation.glossary.term.forbiddenBadge')}:{' '}
                                    {translation.forbiddenTargets.join(' / ')}
                                  </span>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </td>
                        <td className="px-2 py-1">
                          <span
                            className={`inline-flex items-center rounded border px-1 py-[1px] text-[10px] font-medium ${TERM_STATUS_TONE[term.status]}`}
                          >
                            {t(TERM_STATUS_KEYS[term.status])}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-2 py-1 text-right">
                          <button
                            type="button"
                            onClick={() => setTermForm({ open: true, term })}
                            aria-label={t('translation.glossary.editTerm')}
                            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"
                          >
                            <Pencil className="h-3 w-3" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                window.confirm(
                                  t('translation.glossary.deleteTermConfirm', { term: term.sourceTerm }),
                                )
                              ) {
                                void removeTerm(term.id);
                              }
                            }}
                            aria-label={t('translation.glossary.delete')}
                            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
                          >
                            <Trash2 className="h-3 w-3" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </>
          )}
        </section>
      </div>

      {glossaryForm.open ? (
        <GlossaryFormDialog
          glossary={glossaryForm.glossary}
          defaultSourceLang={defaultSourceLang ?? ''}
          scope={scope}
          manualId={manualId}
          onClose={() => setGlossaryForm({ open: false, glossary: null })}
        />
      ) : null}

      {termForm.open && activeGlossary ? (
        <TermFormDialog
          glossary={activeGlossary}
          term={termForm.term}
          defaultTargetLang={targetLang}
          onClose={() => setTermForm({ open: false, term: null })}
        />
      ) : null}

      {importOpen && activeGlossary ? (
        <ImportDialog
          glossaryId={activeGlossary.id}
          defaultTargetLang={targetLang}
          onClose={() => setImportOpen(false)}
        />
      ) : null}
    </div>
  );
}
