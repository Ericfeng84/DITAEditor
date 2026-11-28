import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileCog,
  KeyRound,
  Loader2,
  RefreshCw,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useAiStore } from './ai-store';
import type { AiConfigPatch, AiConfigTestResult, AiUsageTaskType } from './ai-types';
import { useI18n, type MessageKey } from '../i18n/index.js';
import { ParserSettingsTab } from '../ingest/ParserSettingsTab.js';

export interface AiSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  /** Pane to show when the dialog opens (the desktop plugin guide jumps straight to parsers). */
  initialTab?: AiSettingsTab;
}

const DEFAULT_TEMPERATURE = 0.2;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_TIMEOUT_MS = 60000;
/** Independent review must stay cold: the reviewer reads, it never improvises. */
const DEFAULT_REVIEWER_TEMPERATURE = 0.1;

type AiSettingsTab = 'llm' | 'parsers';

/** `inherit` sends four explicit `null`s so the server drops every dedicated override. */
type ReviewerMode = 'inherit' | 'dedicated';

/** Bilingual labels for the usage ledger's task families (incl. ingest & translation). */
const TASK_TYPE_KEYS: Record<AiUsageTaskType, MessageKey> = {
  ask: 'aiSettings.taskType.ask',
  authoring: 'aiSettings.taskType.authoring',
  optimize_tags: 'aiSettings.taskType.optimizeTags',
  fix_error: 'aiSettings.taskType.fixError',
  ingest_plan: 'aiSettings.taskType.ingestPlan',
  ingest_write: 'aiSettings.taskType.ingestWrite',
  ingest_repair: 'aiSettings.taskType.ingestRepair',
  translate_batch: 'aiSettings.taskType.translateBatch',
  translate_block: 'aiSettings.taskType.translateBlock',
  translate_refine: 'aiSettings.taskType.translateRefine',
  translate_review: 'aiSettings.taskType.translateReview',
  translate_repair: 'aiSettings.taskType.translateRepair',
};

const USAGE_STATUS_KEYS: Record<'succeeded' | 'failed' | 'cancelled', MessageKey> = {
  succeeded: 'aiSettings.usage.status.succeeded',
  failed: 'aiSettings.usage.status.failed',
  cancelled: 'aiSettings.usage.status.cancelled',
};

function formatNumber(value: number): string {
  return value.toLocaleString('zh-CN');
}

/**
 * Admin-only provider configuration plus read-only usage statistics. Writer/viewer
 * identities can inspect the active model but all mutation controls stay disabled.
 */
export function AiSettingsDialog({ open, onClose, initialTab = 'llm' }: AiSettingsDialogProps) {
  const { t } = useI18n();
  const config = useAiStore((state) => state.config);
  const configLoading = useAiStore((state) => state.configLoading);
  const configError = useAiStore((state) => state.configError);
  const saveConfig = useAiStore((state) => state.saveConfig);
  const testConfig = useAiStore((state) => state.testConfig);
  const usage = useAiStore((state) => state.usage);
  const usageLoading = useAiStore((state) => state.usageLoading);
  const usageError = useAiStore((state) => state.usageError);
  const loadUsage = useAiStore((state) => state.loadUsage);

  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [clearApiKey, setClearApiKey] = useState(false);
  const [temperature, setTemperature] = useState(String(DEFAULT_TEMPERATURE));
  const [maxRetries, setMaxRetries] = useState(String(DEFAULT_MAX_RETRIES));
  const [timeoutMs, setTimeoutMs] = useState(String(DEFAULT_TIMEOUT_MS));
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<AiConfigTestResult | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<AiSettingsTab>('llm');

  /* Phase 16 — independent reviewer model (translation quality review). */
  const [reviewerMode, setReviewerMode] = useState<ReviewerMode>('inherit');
  const [reviewerBaseUrl, setReviewerBaseUrl] = useState('');
  const [reviewerModel, setReviewerModel] = useState('');
  const [reviewerApiKey, setReviewerApiKey] = useState('');
  const [clearReviewerApiKey, setClearReviewerApiKey] = useState(false);
  const [reviewerTemperature, setReviewerTemperature] = useState(
    String(DEFAULT_REVIEWER_TEMPERATURE),
  );
  const [reviewerTesting, setReviewerTesting] = useState(false);
  const [reviewerTestResult, setReviewerTestResult] = useState<AiConfigTestResult | null>(null);
  const [reviewerTestError, setReviewerTestError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !config) return;
    setBaseUrl(config.baseUrl);
    setModel(config.model);
    // SQLite stores REAL as float32, so 0.2 round-trips as 0.20000000298023224.
    setTemperature(String(Number(config.temperature.toFixed(2))));
    setMaxRetries(String(config.maxRetries));
    setTimeoutMs(String(config.timeoutMs));
    setApiKey('');
    setClearApiKey(false);
    setSaved(false);

    const reviewer = config.reviewer;
    setReviewerMode(reviewer?.isDedicated ? 'dedicated' : 'inherit');
    setReviewerBaseUrl(reviewer?.hasDedicatedBaseUrl ? reviewer.baseUrl : '');
    setReviewerModel(reviewer?.hasDedicatedModel ? reviewer.model : '');
    setReviewerTemperature(
      String(
        Number(
          (reviewer?.hasDedicatedTemperature
            ? reviewer.temperature
            : DEFAULT_REVIEWER_TEMPERATURE
          ).toFixed(2),
        ),
      ),
    );
    setReviewerApiKey('');
    setClearReviewerApiKey(false);
    setReviewerTestResult(null);
    setReviewerTestError(null);
  }, [open, config]);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  useEffect(() => {
    if (open && config?.canEdit) void loadUsage(30, 20);
  }, [open, config?.canEdit, loadUsage]);

  const canEdit = config?.canEdit ?? false;
  const reviewer = config?.reviewer ?? null;
  /**
   * In inherit mode the summary still has to name a concrete model.
   *
   * Only an *inheriting* reviewer may report `reviewer.model`: once the pair has a dedicated model,
   * switching back to inherit makes the primary model answer again, so showing the dedicated name
   * would describe a model that will not run.
   */
  const inheritedReviewerModel =
    reviewer && !reviewer.isDedicated ? reviewer.model || config?.model || '' : config?.model || '';
  const selectedReviewerModel =
    reviewerMode === 'dedicated' ? reviewerModel.trim() : inheritedReviewerModel;

  const reviewerDirty = useMemo(() => {
    if (!config) return false;
    const dedicatedNow = reviewerMode === 'dedicated';
    const dedicatedBefore = config.reviewer?.isDedicated ?? false;
    if (dedicatedNow !== dedicatedBefore) return true;
    if (!dedicatedNow) return false;
    return (
      reviewerBaseUrl.trim() !== (config.reviewer?.hasDedicatedBaseUrl ? config.reviewer.baseUrl : '') ||
      reviewerModel.trim() !== (config.reviewer?.hasDedicatedModel ? config.reviewer.model : '') ||
      reviewerApiKey.trim().length > 0 ||
      clearReviewerApiKey ||
      Number(reviewerTemperature) !==
        (config.reviewer?.hasDedicatedTemperature
          ? config.reviewer.temperature
          : DEFAULT_REVIEWER_TEMPERATURE)
    );
  }, [
    clearReviewerApiKey,
    config,
    reviewerApiKey,
    reviewerBaseUrl,
    reviewerMode,
    reviewerModel,
    reviewerTemperature,
  ]);

  const dirty = useMemo(() => {
    if (!config) return false;
    return (
      baseUrl !== config.baseUrl ||
      model !== config.model ||
      apiKey.trim().length > 0 ||
      clearApiKey ||
      Number(temperature) !== config.temperature ||
      Number(maxRetries) !== config.maxRetries ||
      Number(timeoutMs) !== config.timeoutMs ||
      reviewerDirty
    );
  }, [
    apiKey,
    baseUrl,
    clearApiKey,
    config,
    maxRetries,
    model,
    reviewerDirty,
    temperature,
    timeoutMs,
  ]);

  if (!open) return null;

  const buildPatch = (): AiConfigPatch => ({
    baseUrl: baseUrl.trim(),
    model: model.trim(),
    ...(apiKey.trim() ? { apiKey: apiKey.trim() } : clearApiKey ? { apiKey: null } : {}),
    temperature: Number(Number(temperature).toFixed(2)),
    maxRetries: Number(maxRetries),
    timeoutMs: Number(timeoutMs),
    // Inherit mode is expressed as four `null`s — that is the wire contract for "drop the
    // dedicated reviewer and fall back to the primary model at a cold temperature".
    reviewer:
      reviewerMode === 'dedicated'
        ? {
            baseUrl: reviewerBaseUrl.trim() || null,
            model: reviewerModel.trim() || null,
            ...(reviewerApiKey.trim()
              ? { apiKey: reviewerApiKey.trim() }
              : clearReviewerApiKey
                ? { apiKey: null }
                : {}),
            temperature: Number(Number(reviewerTemperature).toFixed(2)),
          }
        : { baseUrl: null, model: null, apiKey: null, temperature: null },
  });

  const handleSave = async () => {
    const ok = await saveConfig(buildPatch());
    setSaved(ok);
    if (ok) {
      setApiKey('');
      setClearApiKey(false);
      setReviewerApiKey('');
      setClearReviewerApiKey(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestError(null);
    setTestResult(null);
    try {
      const result = await testConfig({
        baseUrl: baseUrl.trim() || undefined,
        model: model.trim() || undefined,
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
      });
      setTestResult(result);
    } catch (error) {
      setTestError(error instanceof Error ? error.message : String(error));
    } finally {
      setTesting(false);
    }
  };

  /**
   * Probe the reviewer provider.
   *
   * `role: 'reviewer'` makes the server resolve the *effective* reviewer config (dedicated values
   * first, primary ones as fallback) instead of re-testing the primary model, and it falls back to
   * the saved configuration when a field is left empty — so testing before saving still works.
   */
  const handleTestReviewer = async () => {
    setReviewerTesting(true);
    setReviewerTestError(null);
    setReviewerTestResult(null);
    try {
      const result =
        reviewerMode === 'dedicated'
          ? await testConfig({
              role: 'reviewer',
              baseUrl: reviewerBaseUrl.trim() || undefined,
              model: reviewerModel.trim() || undefined,
              ...(reviewerApiKey.trim() ? { apiKey: reviewerApiKey.trim() } : {}),
            })
          : await testConfig({ role: 'reviewer' });
      setReviewerTestResult(result);
    } catch (error) {
      setReviewerTestError(error instanceof Error ? error.message : String(error));
    } finally {
      setReviewerTesting(false);
    }
  };

  const usageTotals = usage?.totals;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('ai.settings')}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[88vh] w-[min(920px,95vw)] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-2.5">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <Sparkles className="h-4 w-4 text-blue-600" aria-hidden="true" />
              {t('ai.settings')}
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              {t('aiSettings.subtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            aria-label={t('aiSettings.closeAria')}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div role="tablist" className="flex shrink-0 items-center gap-1 border-b border-slate-200 bg-slate-50/70 px-4 py-1.5">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'llm'}
            onClick={() => setTab('llm')}
            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium ${
              tab === 'llm' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-white'
            }`}
          >
            <Sparkles className="h-3 w-3" aria-hidden="true" />
            {t('ingest.parser.tabLlm')}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'parsers'}
            onClick={() => setTab('parsers')}
            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium ${
              tab === 'parsers' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-white'
            }`}
          >
            <FileCog className="h-3 w-3" aria-hidden="true" />
            {t('ingest.parser.tabParsers')}
          </button>
        </div>

        <div className="dita-scroller min-h-0 flex-1 overflow-y-auto">
          {tab === 'parsers' ? (
            <ParserSettingsTab />
          ) : (
            <div className="grid gap-4 p-4 lg:grid-cols-[1.15fr_0.85fr]">
            <section className="space-y-3">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <Settings2 className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                {t('aiSettings.modelService')}
              </h3>

              {!canEdit ? (
                <p className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10.5px] text-slate-600">
                  {t('aiSettings.readOnlyHint')}
                </p>
              ) : null}

              <label className="block">
                <span className="text-[10.5px] font-medium text-slate-600">Base URL</span>
                <input
                  value={baseUrl}
                  disabled={!canEdit}
                  onChange={(event) => setBaseUrl(event.target.value)}
                  placeholder="https://api.openai.com/v1"
                  spellCheck={false}
                  className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1 font-mono text-[11px] text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </label>

              <label className="block">
                <span className="text-[10.5px] font-medium text-slate-600">{t('aiSettings.model')}</span>
                <input
                  value={model}
                  disabled={!canEdit}
                  onChange={(event) => setModel(event.target.value)}
                  placeholder="gpt-4o-mini / deepseek-chat / qwen-plus"
                  spellCheck={false}
                  className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1 font-mono text-[11px] text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 disabled:bg-slate-50 disabled:text-slate-500"
                />
              </label>

              <div className="rounded-md border border-slate-200 bg-slate-50/60 p-2">
                <div className="flex items-center gap-1.5 text-[10.5px] text-slate-600">
                  <KeyRound className="h-3 w-3 text-slate-500" aria-hidden="true" />
                  <span className="font-medium">API Key</span>
                  <span className="ml-auto rounded bg-white px-1.5 py-0.5 font-mono text-[9.5px] text-slate-500">
                    {config
                      ? config.apiKeySource === 'db'
                        ? t('aiSettings.keySource.db')
                        : config.apiKeySource === 'env'
                          ? t('aiSettings.keySource.env')
                          : t('aiSettings.keySource.none')
                      : t('common.loading')}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[10px] text-slate-500">
                  {config?.maskedApiKey ?? (config?.hasApiKey ? '••••••••' : t('aiSettings.noKey'))}
                </p>
                <input
                  type="password"
                  value={apiKey}
                  disabled={!canEdit}
                  onChange={(event) => {
                    setApiKey(event.target.value);
                    if (event.target.value) setClearApiKey(false);
                  }}
                  placeholder={t('aiSettings.keyPlaceholder')}
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 font-mono text-[11px] text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 disabled:bg-slate-50"
                />
                <div className="mt-1 flex items-center gap-2 text-[10px]">
                  <button
                    type="button"
                    disabled={!canEdit || config?.apiKeySource !== 'db'}
                    onClick={() => {
                      setClearApiKey(true);
                      setApiKey('');
                    }}
                    className={`rounded border px-1.5 py-0.5 ${
                      clearApiKey
                        ? 'border-rose-300 bg-rose-50 text-rose-700'
                        : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    {clearApiKey ? t('aiSettings.clearKeyPending') : t('aiSettings.clearKey')}
                  </button>
                  <span className="text-slate-400">{t('aiSettings.clearKeyHint')}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <label className="block">
                  <span className="text-[10.5px] font-medium text-slate-600">Temperature</span>
                  <input
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    value={temperature}
                    disabled={!canEdit}
                    onChange={(event) => setTemperature(event.target.value)}
                    className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-800 outline-none focus:border-blue-400 disabled:bg-slate-50"
                  />
                </label>
                <label className="block">
                  <span className="text-[10.5px] font-medium text-slate-600">{t('aiSettings.maxRetries')}</span>
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={maxRetries}
                    disabled={!canEdit}
                    onChange={(event) => setMaxRetries(event.target.value)}
                    className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-800 outline-none focus:border-blue-400 disabled:bg-slate-50"
                  />
                </label>
                <label className="block">
                  <span className="text-[10.5px] font-medium text-slate-600">{t('aiSettings.timeout')}</span>
                  <input
                    type="number"
                    min={5000}
                    step={1000}
                    value={timeoutMs}
                    disabled={!canEdit}
                    onChange={(event) => setTimeoutMs(event.target.value)}
                    className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-800 outline-none focus:border-blue-400 disabled:bg-slate-50"
                  />
                </label>
              </div>

              <p className="text-[9.5px] text-slate-400">
                {t('aiSettings.contextLimit', { value: config ? formatNumber(config.maxContextChars) : '—' })}
              </p>

              {configError ? (
                <p className="flex items-start gap-1.5 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[10.5px] text-rose-800">
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                  {configError}
                </p>
              ) : null}
              {saved ? (
                <p className="flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10.5px] text-emerald-800">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  {t('aiSettings.saved')}
                </p>
              ) : null}
              {testResult ? (
                <p
                  className={`flex items-start gap-1.5 rounded border px-2 py-1 text-[10.5px] ${
                    testResult.ok
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-rose-200 bg-rose-50 text-rose-800'
                  }`}
                >
                  {testResult.ok ? (
                    <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                  ) : (
                    <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                  )}
                  <span>
                    {testResult.ok ? t('aiSettings.testOk') : t('aiSettings.testFail')} · {testResult.model} ·{' '}
                    {testResult.latencyMs} ms
                    {testResult.message ? ` · ${testResult.message}` : ''}
                  </span>
                </p>
              ) : null}
              {testError ? (
                <p className="flex items-start gap-1.5 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[10.5px] text-rose-800">
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                  {testError}
                </p>
              ) : null}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!canEdit || configLoading || !dirty}
                  onClick={() => void handleSave()}
                  className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {configLoading ? (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="h-3 w-3" aria-hidden="true" />
                  )}
                  {t('aiSettings.save')}
                </button>
                <button
                  type="button"
                  disabled={testing || !baseUrl.trim() || !model.trim()}
                  onClick={() => void handleTest()}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  {testing ? (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="h-3 w-3" aria-hidden="true" />
                  )}
                  {t('aiSettings.test')}
                </button>
              </div>

              {/* Phase 16 — the independent reviewer is a first-class model choice, not a hidden
                  fallback: the card states which model answers, at which temperature, and lets
                  the operator probe it alone so a broken reviewer never hides behind the
                  translator. */}
              <div
                className="rounded-lg border border-slate-200 bg-white"
                data-testid="ai-reviewer-card"
              >
                <div className="flex items-center gap-1.5 border-b border-slate-100 px-2.5 py-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                  <h4 className="text-[11px] font-semibold text-slate-800">
                    {t('aiSettings.reviewer.title')}
                  </h4>
                  <span
                    className={`ml-auto rounded px-1 py-0.5 text-[9px] font-medium ${
                      reviewerMode === 'dedicated'
                        ? 'bg-violet-50 text-violet-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                    data-testid="ai-reviewer-badge"
                  >
                    {reviewerMode === 'dedicated'
                      ? t('aiSettings.reviewer.badgeDedicated')
                      : t('aiSettings.reviewer.badgeInherit')}
                  </span>
                </div>

                <div className="space-y-2 px-2.5 py-2">
                  <p className="text-[10px] leading-snug text-slate-500">
                    {t('aiSettings.reviewer.description')}
                  </p>

                  <div
                    className="grid grid-cols-2 gap-1 rounded-md bg-slate-100 p-0.5"
                    role="group"
                    aria-label={t('aiSettings.reviewer.modeAria')}
                  >
                    {(['inherit', 'dedicated'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        data-testid={`ai-reviewer-mode-${mode}`}
                        aria-pressed={reviewerMode === mode}
                        disabled={!canEdit}
                        onClick={() => setReviewerMode(mode)}
                        className={`rounded px-2 py-1 text-[10px] font-medium transition-colors disabled:opacity-50 ${
                          reviewerMode === mode
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {mode === 'inherit'
                          ? t('aiSettings.reviewer.modeInherit')
                          : t('aiSettings.reviewer.modeDedicated')}
                      </button>
                    ))}
                  </div>

                  {reviewerMode === 'inherit' ? (
                    <div
                      className="space-y-0.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5"
                      data-testid="ai-reviewer-inherit-summary"
                    >
                      <p className="flex items-center gap-1 font-mono text-[10px] text-slate-700">
                        <Sparkles className="h-3 w-3 text-slate-400" aria-hidden="true" />
                        {inheritedReviewerModel || t('aiSettings.reviewer.noModel')}
                      </p>
                      <p className="text-[9.5px] text-slate-500">
                        {t('aiSettings.reviewer.inheritTemperature')}
                      </p>
                      <p className="text-[9.5px] text-slate-400">
                        {t('aiSettings.reviewer.inheritHint')}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5" data-testid="ai-reviewer-dedicated-fields">
                      <label className="block">
                        <span className="text-[10px] font-medium text-slate-600">
                          {t('aiSettings.reviewer.baseUrl')}
                        </span>
                        <input
                          type="url"
                          value={reviewerBaseUrl}
                          disabled={!canEdit}
                          onChange={(event) => setReviewerBaseUrl(event.target.value)}
                          placeholder={t('aiSettings.reviewer.baseUrlPlaceholder')}
                          data-testid="ai-reviewer-base-url"
                          className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1 font-mono text-[11px] outline-none focus:border-blue-400 disabled:bg-slate-50"
                        />
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-medium text-slate-600">
                          {t('aiSettings.reviewer.model')}
                        </span>
                        <input
                          type="text"
                          value={reviewerModel}
                          disabled={!canEdit}
                          onChange={(event) => setReviewerModel(event.target.value)}
                          placeholder={t('aiSettings.reviewer.modelPlaceholder')}
                          data-testid="ai-reviewer-model"
                          className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1 font-mono text-[11px] outline-none focus:border-blue-400 disabled:bg-slate-50"
                        />
                      </label>
                      <label className="block">
                        <span className="flex items-center gap-1 text-[10px] font-medium text-slate-600">
                          <KeyRound className="h-3 w-3 text-slate-400" aria-hidden="true" />
                          {t('aiSettings.reviewer.apiKey')}
                        </span>
                        <input
                          type="password"
                          value={reviewerApiKey}
                          disabled={!canEdit || clearReviewerApiKey}
                          onChange={(event) => setReviewerApiKey(event.target.value)}
                          placeholder={t('aiSettings.keyPlaceholder')}
                          data-testid="ai-reviewer-api-key"
                          className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1 font-mono text-[11px] outline-none focus:border-blue-400 disabled:bg-slate-50"
                        />
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[9.5px] text-slate-500">
                          <span data-testid="ai-reviewer-key-hint">
                            {clearReviewerApiKey
                              ? t('aiSettings.reviewer.clearKeyPending')
                              : reviewer?.hasDedicatedApiKey
                                ? t('aiSettings.reviewer.keyMasked', {
                                    masked: reviewer.maskedApiKey ?? '***',
                                  })
                                : t('aiSettings.reviewer.keyInherited')}
                          </span>
                          {reviewer?.hasDedicatedApiKey && !clearReviewerApiKey ? (
                            <button
                              type="button"
                              disabled={!canEdit}
                              onClick={() => {
                                setReviewerApiKey('');
                                setClearReviewerApiKey(true);
                              }}
                              className="font-medium text-rose-600 hover:underline disabled:opacity-40"
                            >
                              {t('aiSettings.clearKey')}
                            </button>
                          ) : null}
                        </span>
                      </label>
                      <label className="block">
                        <span className="text-[10px] font-medium text-slate-600">
                          {t('aiSettings.reviewer.temperature')}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={0.2}
                          step={0.05}
                          value={reviewerTemperature}
                          disabled={!canEdit}
                          onChange={(event) => setReviewerTemperature(event.target.value)}
                          data-testid="ai-reviewer-temperature"
                          className="mt-0.5 w-24 rounded-md border border-slate-300 px-2 py-1 font-mono text-[11px] outline-none focus:border-blue-400 disabled:bg-slate-50"
                        />
                        <span className="ml-1.5 text-[9.5px] text-slate-400">
                          {t('aiSettings.reviewer.temperatureHint')}
                        </span>
                      </label>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={reviewerTesting || !canEdit}
                      onClick={() => void handleTestReviewer()}
                      data-testid="ai-reviewer-test"
                      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[10.5px] text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      {reviewerTesting ? (
                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                      ) : (
                        <RefreshCw className="h-3 w-3" aria-hidden="true" />
                      )}
                      {t('aiSettings.reviewer.test')}
                    </button>
                    <span
                      className="min-w-0 flex-1 truncate font-mono text-[9.5px] text-slate-400"
                      data-testid="ai-reviewer-effective-model"
                    >
                      {selectedReviewerModel}
                    </span>
                  </div>

                  {reviewerTestResult ? (
                    <p
                      className="flex items-start gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10.5px] text-emerald-800"
                      data-testid="ai-reviewer-test-result"
                    >
                      <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                      <span>
                        {reviewerMode === 'dedicated'
                          ? t('aiSettings.reviewer.testOk')
                          : t('aiSettings.reviewer.testOkInherit')}
                        {' · '}
                        {reviewerTestResult.model} · {reviewerTestResult.latencyMs} ms
                      </span>
                    </p>
                  ) : null}
                  {reviewerTestError ? (
                    <p
                      className="flex items-start gap-1.5 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[10.5px] text-rose-800"
                      data-testid="ai-reviewer-test-error"
                    >
                      <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                      {reviewerTestError}
                    </p>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <Clock className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                {t('aiSettings.usageTitle')}
              </h3>
              {!canEdit ? (
                <p className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10.5px] text-slate-600">
                  {t('aiSettings.usageAdminOnly')}
                </p>
              ) : usageLoading ? (
                <p className="flex items-center gap-1.5 text-[10.5px] text-slate-500">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  {t('aiSettings.usageLoading')}
                </p>
              ) : usageError ? (
                <p className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[10.5px] text-rose-800">
                  {usageError}
                </p>
              ) : usageTotals ? (
                <>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label: t('aiSettings.usage.calls'), value: formatNumber(usageTotals.calls) },
                      { label: t('aiSettings.usage.succeeded'), value: formatNumber(usageTotals.succeeded) },
                      { label: t('aiSettings.usage.failed'), value: formatNumber(usageTotals.failed) },
                      { label: t('aiSettings.usage.cancelled'), value: formatNumber(usageTotals.cancelled) },
                      { label: 'Prompt Tokens', value: formatNumber(usageTotals.promptTokens) },
                      {
                        label: 'Completion Tokens',
                        value: formatNumber(usageTotals.completionTokens),
                      },
                    ].map((item) => (
                      <div key={item.label} className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                        <p className="text-[9px] text-slate-500">{item.label}</p>
                        <p className="font-mono text-[11px] font-semibold text-slate-800">
                          {item.value}
                        </p>
                      </div>
                    ))}
                    <div className="col-span-2 rounded border border-blue-200 bg-blue-50 px-2 py-1">
                      <p className="text-[9px] text-blue-600">{t('aiSettings.usage.totalTokens')}</p>
                      <p className="font-mono text-[12px] font-semibold text-blue-900">
                        {formatNumber(usageTotals.totalTokens)}
                      </p>
                    </div>
                  </div>

                  {usage.byModel.length > 0 ? (
                    <div>
                      <p className="text-[10px] font-medium text-slate-600">{t('aiSettings.usage.byModel')}</p>
                      <ul className="mt-0.5 space-y-0.5">
                        {usage.byModel.slice(0, 5).map((bucket) => (
                          <li key={bucket.model} className="flex items-center gap-2 text-[9.5px] text-slate-600">
                            <span className="min-w-0 flex-1 truncate font-mono">{bucket.model}</span>
                            <span>{t('aiSettings.usage.callCount', { count: bucket.calls })}</span>
                            <span className="font-mono">{formatNumber(bucket.totalTokens)} tok</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {usage.recent.length > 0 ? (
                    <div>
                      <p className="text-[10px] font-medium text-slate-600">{t('aiSettings.usage.recent')}</p>
                      <ul className="mt-0.5 divide-y divide-slate-100 rounded border border-slate-200">
                        {usage.recent.slice(0, 8).map((entry) => (
                          <li key={entry.id} className="flex items-center gap-1.5 px-1.5 py-1 text-[9.5px]">
                            <span
                              className={`rounded px-1 py-0.5 font-medium ${
                                entry.status === 'succeeded'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : entry.status === 'cancelled'
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-rose-50 text-rose-700'
                              }`}
                            >
                              {t(USAGE_STATUS_KEYS[entry.status])}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-slate-600">
                              {t(TASK_TYPE_KEYS[entry.taskType])}
                              {' · '}
                              {entry.filePath ?? '—'}
                            </span>
                            <span className="font-mono text-slate-400">
                              {entry.totalTokens} tok · {(entry.durationMs / 1000).toFixed(1)}s
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="text-[10.5px] text-slate-500">{t('aiSettings.usage.empty')}</p>
              )}
            </section>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end border-t border-slate-200 bg-slate-50 px-4 py-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
