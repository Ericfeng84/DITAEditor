/**
 * Admin tab — document parser routing.
 *
 * Reads/writes `IngestParserPublicConfig`; the API reduces secrets to `hasDoclingApiKey` /
 * `maskedDoclingApiKey`, so the key input follows the same "empty keeps the stored value"
 * contract as the LLM key field. Non-admins see the same screen read-only.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  FileCog,
  FileText,
  Info,
  KeyRound,
  Loader2,
  RefreshCw,
  Save,
  ScanText,
  Terminal,
} from 'lucide-react';
import { useI18n } from '../i18n/index.js';
import {
  fetchIngestConfig,
  testIngestConfig,
  updateIngestConfig,
  type IngestDoclingMode,
  type IngestEngineChoice,
  type IngestParserConfigPatch,
  type IngestParserPublicConfig,
  type IngestParserRuntimeDetection,
} from '../services/ingest-api.js';
import { formatExtensions } from './types.js';

const ENGINE_OPTIONS: readonly IngestEngineChoice[] = ['auto', 'docling', 'markitdown'];
const DOCLING_MODES: readonly IngestDoclingMode[] = ['auto', 'serve', 'cli', 'off'];

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Shared status pill for the runtime probe results. */
function RuntimeRow({
  label,
  available,
  version,
  detail,
}: {
  label: string;
  available: boolean;
  version?: string | null;
  detail?: string | null;
}) {
  const { t } = useI18n();
  return (
    <li className="flex items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1">
      <span
        className={`shrink-0 rounded-full p-0.5 ${available ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
      >
        {available ? (
          <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" />
        ) : (
          <Ban className="h-2.5 w-2.5" aria-hidden="true" />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-slate-700">{label}</span>
      {version ? (
        <span className="shrink-0 rounded bg-slate-100 px-1 font-mono text-[9px] text-slate-600">{version}</span>
      ) : null}
      <span className={`shrink-0 text-[9px] ${available ? 'text-emerald-700' : 'text-slate-500'}`}>
        {available ? t('ingest.readiness.available') : t('ingest.readiness.unavailable')}
      </span>
      {detail ? <span className="sr-only">{detail}</span> : null}
    </li>
  );
}

export function ParserSettingsTab() {
  const { t } = useI18n();
  const [config, setConfig] = useState<IngestParserPublicConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [detection, setDetection] = useState<IngestParserRuntimeDetection | null>(null);

  const [defaultEngine, setDefaultEngine] = useState<IngestEngineChoice>('auto');
  const [preferMarkitdownForOffice, setPreferMarkitdownForOffice] = useState(false);
  const [timeoutMs, setTimeoutMs] = useState('180000');
  const [maxFileMb, setMaxFileMb] = useState('80');
  const [doclingMode, setDoclingMode] = useState<IngestDoclingMode>('auto');
  const [doclingServeUrl, setDoclingServeUrl] = useState('');
  const [doclingApiKey, setDoclingApiKey] = useState('');
  const [clearDoclingKey, setClearDoclingKey] = useState(false);
  const [doclingCliCommand, setDoclingCliCommand] = useState('');
  const [doclingDoOcr, setDoclingDoOcr] = useState(true);
  const [doclingTableMode, setDoclingTableMode] = useState<'fast' | 'accurate'>('accurate');
  const [markitdownEnabled, setMarkitdownEnabled] = useState(true);
  const [markitdownCliCommand, setMarkitdownCliCommand] = useState('');
  const [markitdownKeepDataUris, setMarkitdownKeepDataUris] = useState(false);

  const hydrate = useCallback((next: IngestParserPublicConfig) => {
    setConfig(next);
    setDefaultEngine(next.defaultEngine);
    setPreferMarkitdownForOffice(next.preferMarkitdownForOffice);
    setTimeoutMs(String(next.timeoutMs));
    setMaxFileMb(String(next.maxFileMb));
    setDoclingMode(next.doclingMode);
    setDoclingServeUrl(next.doclingServeUrl ?? '');
    setDoclingCliCommand(next.doclingCliCommand);
    setDoclingDoOcr(next.doclingDoOcr);
    setDoclingTableMode(next.doclingTableMode);
    setMarkitdownEnabled(next.markitdownEnabled);
    setMarkitdownCliCommand(next.markitdownCliCommand);
    setMarkitdownKeepDataUris(next.markitdownKeepDataUris);
    setDoclingApiKey('');
    setClearDoclingKey(false);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      hydrate(await fetchIngestConfig());
    } catch (error) {
      setLoadError(messageOf(error));
    } finally {
      setLoading(false);
    }
  }, [hydrate]);

  useEffect(() => {
    void load();
  }, [load]);

  const canEdit = config?.canEdit ?? false;

  const dirty = useMemo(() => {
    if (!config) return false;
    return (
      defaultEngine !== config.defaultEngine ||
      preferMarkitdownForOffice !== config.preferMarkitdownForOffice ||
      Number(timeoutMs) !== config.timeoutMs ||
      Number(maxFileMb) !== config.maxFileMb ||
      doclingMode !== config.doclingMode ||
      doclingServeUrl.trim() !== (config.doclingServeUrl ?? '') ||
      doclingApiKey.trim().length > 0 ||
      clearDoclingKey ||
      doclingCliCommand.trim() !== config.doclingCliCommand ||
      doclingDoOcr !== config.doclingDoOcr ||
      doclingTableMode !== config.doclingTableMode ||
      markitdownEnabled !== config.markitdownEnabled ||
      markitdownCliCommand.trim() !== config.markitdownCliCommand ||
      markitdownKeepDataUris !== config.markitdownKeepDataUris
    );
  }, [
    clearDoclingKey,
    config,
    defaultEngine,
    doclingApiKey,
    doclingCliCommand,
    doclingDoOcr,
    doclingMode,
    doclingServeUrl,
    doclingTableMode,
    markitdownCliCommand,
    markitdownEnabled,
    markitdownKeepDataUris,
    maxFileMb,
    preferMarkitdownForOffice,
    timeoutMs,
  ]);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    const patch: IngestParserConfigPatch = {
      defaultEngine,
      preferMarkitdownForOffice,
      timeoutMs: Number(timeoutMs),
      maxFileMb: Number(maxFileMb),
      doclingMode,
      doclingServeUrl: doclingServeUrl.trim() ? doclingServeUrl.trim() : null,
      doclingCliCommand: doclingCliCommand.trim(),
      doclingDoOcr,
      doclingTableMode,
      markitdownEnabled,
      markitdownCliCommand: markitdownCliCommand.trim(),
      markitdownKeepDataUris,
      ...(doclingApiKey.trim()
        ? { doclingApiKey: doclingApiKey.trim() }
        : clearDoclingKey
          ? { doclingApiKey: null }
          : {}),
    };
    try {
      hydrate(await updateIngestConfig(patch));
      setSaved(true);
    } catch (error) {
      setSaveError(t('ingest.parser.saveFailed', { message: messageOf(error) }));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestError(null);
    try {
      setDetection(await testIngestConfig());
    } catch (error) {
      setTestError(t('ingest.parser.testFailed', { message: messageOf(error) }));
    } finally {
      setTesting(false);
    }
  };

  const inputClass =
    'mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 disabled:bg-slate-50 disabled:text-slate-500';
  const monoClass = `${inputClass} font-mono`;
  const fieldLabel = 'text-[10.5px] font-medium text-slate-600';

  if (loading && !config) {
    return (
      <p className="flex items-center gap-1.5 p-4 text-[11px] text-slate-500">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        {t('ingest.parser.loading')}
      </p>
    );
  }

  if (!config) {
    return (
      <div className="p-4">
        <p className="flex items-start gap-1.5 rounded border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-800">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          {t('ingest.parser.loadFailed', { message: loadError ?? '—' })}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-2 inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-3 w-3" aria-hidden="true" />
          {t('ingest.readiness.probe')}
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 p-4 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="space-y-3">
        <p className="text-[10.5px] text-slate-500">{t('ingest.parser.subtitle')}</p>
        {!canEdit ? (
          <p className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10.5px] text-slate-600">
            {t('ingest.parser.readOnly')}
          </p>
        ) : null}

        <div className="space-y-2 rounded-lg border border-slate-200 p-2.5">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
            <FileCog className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            {t('ingest.parser.routing')}
          </h3>

          <label className="block">
            <span className={fieldLabel}>{t('ingest.parser.defaultEngine')}</span>
            <select
              value={defaultEngine}
              disabled={!canEdit}
              onChange={(event) => setDefaultEngine(event.target.value as IngestEngineChoice)}
              className={`${inputClass} bg-white`}
            >
              {ENGINE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(`ingest.engine.${option}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-start gap-1.5">
            <input
              type="checkbox"
              checked={preferMarkitdownForOffice}
              disabled={!canEdit}
              onChange={(event) => setPreferMarkitdownForOffice(event.target.checked)}
              className="mt-0.5 h-3 w-3"
            />
            <span className="min-w-0">
              <span className="block text-[10.5px] font-medium text-slate-700">
                {t('ingest.parser.preferMarkitdownForOffice')}
              </span>
              <span className="block text-[9.5px] text-slate-400">
                {t('ingest.parser.preferMarkitdownForOfficeHint')}
              </span>
            </span>
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className={fieldLabel}>{t('ingest.parser.timeoutMs')}</span>
              <input
                type="number"
                min={5000}
                max={3600000}
                step={1000}
                value={timeoutMs}
                disabled={!canEdit}
                onChange={(event) => setTimeoutMs(event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className={fieldLabel}>{t('ingest.parser.maxFileMb')}</span>
              <input
                type="number"
                min={1}
                max={100}
                value={maxFileMb}
                disabled={!canEdit}
                onChange={(event) => setMaxFileMb(event.target.value)}
                className={inputClass}
              />
            </label>
          </div>
          <p className="text-[9.5px] text-slate-400">
            {t('ingest.parser.timeoutHint')} · {t('ingest.parser.maxFileMbHint')}
          </p>
          <p className="text-[9.5px] text-slate-400">
            {t('ingest.parser.supported', { extensions: formatExtensions(config.supportedExtensions) })}
          </p>
        </div>

        <div className="space-y-2 rounded-lg border border-slate-200 p-2.5">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
            <FileText className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            {t('ingest.parser.markitdownCard')}
          </h3>
          <label className="flex items-center gap-1.5 text-[10.5px] text-slate-700">
            <input
              type="checkbox"
              checked={markitdownEnabled}
              disabled={!canEdit}
              onChange={(event) => setMarkitdownEnabled(event.target.checked)}
              className="h-3 w-3"
            />
            {t('ingest.parser.markitdownEnabled')}
          </label>
          <label className="block">
            <span className={fieldLabel}>{t('ingest.parser.markitdownCliCommand')}</span>
            <input
              value={markitdownCliCommand}
              disabled={!canEdit || !markitdownEnabled}
              onChange={(event) => setMarkitdownCliCommand(event.target.value)}
              placeholder="markitdown"
              spellCheck={false}
              className={monoClass}
            />
          </label>
          <label className="flex items-start gap-1.5">
            <input
              type="checkbox"
              checked={markitdownKeepDataUris}
              disabled={!canEdit || !markitdownEnabled}
              onChange={(event) => setMarkitdownKeepDataUris(event.target.checked)}
              className="mt-0.5 h-3 w-3"
            />
            <span className="min-w-0">
              <span className="block text-[10.5px] font-medium text-slate-700">
                {t('ingest.parser.markitdownKeepDataUris')}
              </span>
              <span className="block text-[9.5px] text-slate-400">
                {t('ingest.parser.markitdownKeepDataUrisHint')}
              </span>
            </span>
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <div className="space-y-2 rounded-lg border border-slate-200 p-2.5">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
            <ScanText className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            {t('ingest.parser.doclingCard')}
          </h3>

          <label className="block">
            <span className={fieldLabel}>{t('ingest.parser.doclingMode')}</span>
            <select
              value={doclingMode}
              disabled={!canEdit}
              onChange={(event) => setDoclingMode(event.target.value as IngestDoclingMode)}
              className={`${inputClass} bg-white`}
            >
              {DOCLING_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {t(`ingest.parser.doclingMode.${mode}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={fieldLabel}>{t('ingest.parser.doclingServeUrl')}</span>
            <input
              value={doclingServeUrl}
              disabled={!canEdit || doclingMode === 'off' || doclingMode === 'cli'}
              onChange={(event) => setDoclingServeUrl(event.target.value)}
              placeholder="http://localhost:5001"
              spellCheck={false}
              className={monoClass}
            />
          </label>

          <div className="rounded-md border border-slate-200 bg-slate-50/60 p-2">
            <div className="flex items-center gap-1.5 text-[10.5px] text-slate-600">
              <KeyRound className="h-3 w-3 text-slate-500" aria-hidden="true" />
              <span className="font-medium">{t('ingest.parser.doclingApiKey')}</span>
              <span className="ml-auto rounded bg-white px-1.5 py-0.5 font-mono text-[9.5px] text-slate-500">
                {config.hasDoclingApiKey ? t('ingest.parser.hasKey') : t('ingest.parser.noKey')}
              </span>
            </div>
            <p className="mt-1 font-mono text-[10px] text-slate-500">
              {config.maskedDoclingApiKey ?? (config.hasDoclingApiKey ? '••••••••' : t('ingest.parser.noKey'))}
            </p>
            <input
              type="password"
              value={doclingApiKey}
              disabled={!canEdit || doclingMode === 'off' || doclingMode === 'cli'}
              onChange={(event) => {
                setDoclingApiKey(event.target.value);
                if (event.target.value) setClearDoclingKey(false);
              }}
              placeholder={t('ingest.parser.doclingKeyPlaceholder')}
              autoComplete="new-password"
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 font-mono text-[11px] text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 disabled:bg-slate-50"
            />
            <div className="mt-1 flex items-center gap-2 text-[10px]">
              <button
                type="button"
                disabled={!canEdit || !config.hasDoclingApiKey}
                onClick={() => {
                  setClearDoclingKey(true);
                  setDoclingApiKey('');
                }}
                className={`rounded border px-1.5 py-0.5 ${
                  clearDoclingKey
                    ? 'border-rose-300 bg-rose-50 text-rose-700'
                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                {clearDoclingKey ? t('ingest.parser.clearKeyPending') : t('ingest.parser.clearKey')}
              </button>
              <span className="text-slate-400">{t('ingest.parser.doclingApiKeyHint')}</span>
            </div>
          </div>

          <label className="block">
            <span className={fieldLabel}>{t('ingest.parser.doclingCliCommand')}</span>
            <input
              value={doclingCliCommand}
              disabled={!canEdit || doclingMode === 'off' || doclingMode === 'serve'}
              onChange={(event) => setDoclingCliCommand(event.target.value)}
              placeholder="docling"
              spellCheck={false}
              className={monoClass}
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-1.5 text-[10.5px] text-slate-700">
              <input
                type="checkbox"
                checked={doclingDoOcr}
                disabled={!canEdit || doclingMode === 'off'}
                onChange={(event) => setDoclingDoOcr(event.target.checked)}
                className="h-3 w-3"
              />
              {t('ingest.parser.doclingDoOcr')}
            </label>
            <label className="block">
              <span className={fieldLabel}>{t('ingest.parser.doclingTableMode')}</span>
              <select
                value={doclingTableMode}
                disabled={!canEdit || doclingMode === 'off'}
                onChange={(event) =>
                  setDoclingTableMode(event.target.value === 'fast' ? 'fast' : 'accurate')
                }
                className={`${inputClass} bg-white`}
              >
                <option value="accurate">{t('ingest.parser.doclingTableMode.accurate')}</option>
                <option value="fast">{t('ingest.parser.doclingTableMode.fast')}</option>
              </select>
            </label>
          </div>
        </div>

        <div className="space-y-1.5 rounded-lg border border-slate-200 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <Terminal className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              {t('ingest.parser.availability')}
            </h3>
            <button
              type="button"
              onClick={() => void handleTest()}
              disabled={testing || !canEdit}
              title={canEdit ? undefined : t('ingest.parser.needAdminProbe')}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[10.5px] text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {testing ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              ) : (
                <ScanText className="h-3 w-3" aria-hidden="true" />
              )}
              {testing ? t('ingest.parser.testing') : t('ingest.parser.test')}
            </button>
          </div>

          {detection ? (
            <ul className="space-y-1">
              <RuntimeRow
                label={t('ingest.parser.runtime.direct')}
                available={detection.direct.available}
                detail={formatExtensions(detection.direct.extensions)}
              />
              <RuntimeRow
                label={t('ingest.parser.runtime.doclingServe')}
                available={detection.doclingServe.available}
                version={detection.doclingServe.version}
                detail={detection.doclingServe.url}
              />
              <RuntimeRow
                label={t('ingest.parser.runtime.doclingCli')}
                available={detection.doclingCli.available}
                version={detection.doclingCli.version}
                detail={detection.doclingCli.command}
              />
              <RuntimeRow
                label={t('ingest.parser.runtime.markitdownCli')}
                available={detection.markitdownCli.enabled && detection.markitdownCli.available}
                version={detection.markitdownCli.version}
                detail={detection.markitdownCli.command}
              />
            </ul>
          ) : (
            <p className="flex items-start gap-1 text-[9.5px] text-slate-400">
              <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              {t('ingest.readiness.unknown')}
            </p>
          )}

          {testError ? (
            <p className="flex items-start gap-1.5 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[10.5px] text-rose-800">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              {testError}
            </p>
          ) : null}
        </div>

        {saveError ? (
          <p className="flex items-start gap-1.5 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[10.5px] text-rose-800">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            {saveError}
          </p>
        ) : null}
        {saved ? (
          <p className="flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10.5px] text-emerald-800">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            {t('ingest.parser.saved')}
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!canEdit || saving || !dirty}
            className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="h-3 w-3" aria-hidden="true" />
            )}
            {saving ? t('ingest.parser.saving') : t('ingest.parser.save')}
          </button>
          {dirty ? <span className="text-[9.5px] text-amber-600">{t('ingest.parser.unsaved')}</span> : null}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10.5px] text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
            {t('common.cancel')}
          </button>
        </div>
      </section>
    </div>
  );
}
