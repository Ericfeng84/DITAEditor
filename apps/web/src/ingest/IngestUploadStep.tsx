/**
 * Step 1 — pick a file and describe the import.
 *
 * The readiness bar is the honest part of the screen: it reports the LLM configuration and the
 * parser runtimes the API just probed, so a missing Docling install is visible before an upload
 * starts. Everything the step submits mirrors the multipart contract of `POST /api/ingest/jobs`.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileUp,
  Info,
  Loader2,
  MinusCircle,
  PlugZap,
  ScanText,
  Sparkles,
  Upload,
} from 'lucide-react';
import { useI18n } from '../i18n/index.js';
import type {
  IngestEngineChoice,
  IngestJobUpload,
  IngestParserRuntimeDetection,
  IngestParserPublicConfig,
  IngestTargetMode,
  IngestTopicTypeChoice,
} from '../services/ingest-api.js';
import {
  formatBytes,
  formatExtensions,
  isSupportedExtension,
  needsScannedPdfWarning,
  type IngestMountContext,
} from './types.js';

export interface IngestUploadStepProps {
  origin: 'hub' | 'editor';
  manualId?: string;
  branch?: string;
  mountContext?: IngestMountContext | null;
  defaultTargetMode: IngestTargetMode;
  config: IngestParserPublicConfig | null;
  configLoading: boolean;
  detection: IngestParserRuntimeDetection | null;
  probing: boolean;
  probeError: string | null;
  onProbe: () => void;
  llmConfigured: boolean | null;
  canConfigureLlm: boolean;
  onOpenSettings?: () => void;
  submitting: boolean;
  submitError: string | null;
  onSubmit: (upload: IngestJobUpload) => void;
  onCancel: () => void;
}

const ENGINE_OPTIONS: readonly IngestEngineChoice[] = ['auto', 'docling', 'markitdown'];
const TOPIC_TYPES: readonly IngestTopicTypeChoice[] = ['auto', 'concept', 'task', 'reference', 'topic'];

type ReadinessState = 'ok' | 'off' | 'disabled' | 'unknown';

function ReadinessBadge({ state }: { state: ReadinessState }) {
  const { t } = useI18n();
  const map = {
    ok: { icon: CheckCircle2, cls: 'text-emerald-600', label: t('ingest.readiness.available') },
    off: { icon: AlertCircle, cls: 'text-rose-600', label: t('ingest.readiness.unavailable') },
    disabled: { icon: MinusCircle, cls: 'text-slate-400', label: t('ingest.readiness.disabled') },
    unknown: { icon: Info, cls: 'text-slate-400', label: t('ingest.readiness.unknown') },
  } satisfies Record<ReadinessState, { icon: typeof Info; cls: string; label: string }>;
  const entry = map[state];
  const Icon = entry.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[9.5px] font-medium ${entry.cls}`}>
      <Icon className="h-3 w-3" aria-hidden="true" />
      {entry.label}
    </span>
  );
}

function ReadinessRow({
  label,
  state,
  detail,
  children,
}: {
  label: string;
  state: ReadinessState;
  detail?: string | null;
  children?: ReactNode;
}) {
  return (
    <div className="rounded border border-slate-200 bg-white px-2 py-1">
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-[10px] font-medium text-slate-700">{label}</span>
        <ReadinessBadge state={state} />
      </div>
      {detail ? (
        <p className="mt-0.5 truncate font-mono text-[9px] text-slate-400" title={detail}>
          {detail}
        </p>
      ) : null}
      {children}
    </div>
  );
}

export function IngestUploadStep({
  origin,
  manualId,
  branch,
  mountContext,
  defaultTargetMode,
  config,
  configLoading,
  detection,
  probing,
  probeError,
  onProbe,
  llmConfigured,
  canConfigureLlm,
  onOpenSettings,
  submitting,
  submitError,
  onSubmit,
  onCancel,
}: IngestUploadStepProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [engine, setEngine] = useState<IngestEngineChoice>('auto');
  const [targetMode, setTargetMode] = useState<IngestTargetMode>(defaultTargetMode);
  const [manualName, setManualName] = useState('');
  const [manualDescription, setManualDescription] = useState('');
  // Bookmaps are not supported: every generated manual is a standard DITA map.
  const mapKind = 'map' as const;
  const [language, setLanguage] = useState('zh-CN');
  const [topicType, setTopicType] = useState<IngestTopicTypeChoice>('auto');
  const [targetDir, setTargetDir] = useState('');
  const [mountIntoMap, setMountIntoMap] = useState(Boolean(mountContext));
  const [instruction, setInstruction] = useState('');
  const [autoApprove, setAutoApprove] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    setTargetMode(defaultTargetMode);
  }, [defaultTargetMode]);

  useEffect(() => {
    if (config) {
      setEngine(config.defaultEngine);
    }
  }, [config]);

  const extensions = config?.supportedExtensions ?? detection?.supportedExtensions ?? [];
  const maxFileMb = config?.maxFileMb ?? 0;
  const isMarkdown = Boolean(file && /\.(md|markdown|txt)$/iu.test(file.name));
  const pdfWarning = needsScannedPdfWarning(file?.name ?? null, engine);
  const showMountOption = origin === 'editor' && Boolean(mountContext) && targetMode !== 'new_manual';

  const accept = useMemo(() => extensions.map((ext) => (ext.startsWith('.') ? ext : `.${ext}`)).join(','), [extensions]);

  const pickFile = useCallback(
    (candidate: File | null) => {
      setLocalError(null);
      if (!candidate) return;
      if (extensions.length > 0 && !isSupportedExtension(candidate.name, extensions)) {
        const dot = candidate.name.lastIndexOf('.');
        setLocalError(
          t('ingest.upload.unsupported', {
            ext: dot >= 0 ? candidate.name.slice(dot) : candidate.name,
            extensions: formatExtensions(extensions),
          }),
        );
        return;
      }
      if (maxFileMb > 0 && candidate.size > maxFileMb * 1024 * 1024) {
        setLocalError(t('ingest.upload.tooLarge', { maxMb: maxFileMb }));
        return;
      }
      setFile(candidate);
      if (!manualName && targetMode === 'new_manual') {
        const base = candidate.name.replace(/\.[^.]+$/u, '').trim();
        if (base) setManualName(base);
      }
    },
    [extensions, manualName, maxFileMb, t, targetMode],
  );

  const handleSubmit = () => {
    setLocalError(null);
    if (!file) {
      setLocalError(t('ingest.upload.needFile'));
      return;
    }
    if (targetMode === 'new_manual' && !manualName.trim()) {
      setLocalError(t('ingest.upload.needManualName'));
      return;
    }
    onSubmit({
      file,
      targetMode,
      engine,
      autoApprove,
      ...(language.trim() ? { language: language.trim() } : {}),
      ...(targetMode === 'new_manual' ? { mapKind } : {}),
      ...(targetMode !== 'new_manual' && topicType !== 'auto' ? { topicType } : {}),
      ...(targetMode !== 'new_manual' && targetDir.trim() ? { targetDir: targetDir.trim() } : {}),
      ...(instruction.trim() ? { instruction: instruction.trim() } : {}),
      ...(targetMode === 'new_manual' && manualName.trim() ? { manualName: manualName.trim() } : {}),
      ...(targetMode === 'new_manual' && manualDescription.trim()
        ? { manualDescription: manualDescription.trim() }
        : {}),
      ...(targetMode !== 'new_manual' && manualId ? { manualId } : {}),
      ...(targetMode !== 'new_manual' && branch ? { branch } : {}),
      ...(showMountOption && mountIntoMap && mountContext
        ? {
            mountMapPath: mountContext.mapPath,
            ...(mountContext.parentPath ? { mountParentPath: mountContext.parentPath } : {}),
          }
        : {}),
    });
  };

  const doclingServeState: ReadinessState = detection
    ? detection.doclingServe.available
      ? 'ok'
      : 'off'
    : 'unknown';
  const doclingCliState: ReadinessState = detection
    ? detection.doclingCli.available
      ? 'ok'
      : 'off'
    : 'unknown';
  const markitdownState: ReadinessState = detection
    ? detection.markitdownCli.enabled
      ? detection.markitdownCli.available
        ? 'ok'
        : 'off'
      : 'disabled'
    : 'unknown';

  return (
    <div className="space-y-3">
      <section className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
            <PlugZap className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            {t('ingest.readiness.title')}
          </h3>
          <button
            type="button"
            disabled={probing || !config?.canEdit}
            onClick={onProbe}
            title={config?.canEdit ? undefined : t('ingest.readiness.adminOnly')}
            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {probing ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : (
              <ScanText className="h-3 w-3" aria-hidden="true" />
            )}
            {probing ? t('ingest.readiness.probing') : t('ingest.readiness.probe')}
          </button>
        </div>

        <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
          <ReadinessRow
            label={t('ingest.readiness.llm')}
            state={llmConfigured === null ? 'unknown' : llmConfigured ? 'ok' : 'off'}
            detail={llmConfigured ? t('ingest.readiness.llmReady') : t('ingest.readiness.llmMissing')}
          >
            {!llmConfigured && canConfigureLlm && onOpenSettings ? (
              <button
                type="button"
                onClick={onOpenSettings}
                className="mt-1 inline-flex items-center gap-1 rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[9.5px] font-medium text-blue-700 hover:bg-blue-100"
              >
                <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                {t('ingest.readiness.openAiSettings')}
              </button>
            ) : null}
          </ReadinessRow>

          <ReadinessRow
            label={t('ingest.readiness.doclingServe')}
            state={doclingServeState}
            detail={detection?.doclingServe.version ?? detection?.doclingServe.url ?? null}
          />
          <ReadinessRow
            label={t('ingest.readiness.doclingCli')}
            state={doclingCliState}
            detail={detection?.doclingCli.version ?? detection?.doclingCli.command ?? null}
          />
          <ReadinessRow
            label={t('ingest.readiness.markitdown')}
            state={markitdownState}
            detail={detection?.markitdownCli.version ?? detection?.markitdownCli.command ?? null}
          />
        </div>

        {configLoading ? (
          <p className="mt-1.5 flex items-center gap-1.5 text-[10px] text-slate-500">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            {t('common.loading')}
          </p>
        ) : null}
        {probeError ? (
          <p className="mt-1.5 flex items-start gap-1.5 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] text-rose-800">
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            {t('ingest.readiness.probeFailed', { message: probeError })}
          </p>
        ) : null}
      </section>

      <section
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          pickFile(event.dataTransfer.files?.[0] ?? null);
        }}
        className={`rounded-lg border-2 border-dashed p-3 text-center transition-colors ${
          dragging ? 'border-blue-400 bg-blue-50/70' : 'border-slate-300 bg-white'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept || undefined}
          className="hidden"
          onChange={(event) => {
            pickFile(event.target.files?.[0] ?? null);
            event.target.value = '';
          }}
        />
        {file ? (
          <div className="flex items-center justify-center gap-2">
            <FileUp className="h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
            <div className="min-w-0 text-left">
              <p className="truncate text-[11px] font-medium text-slate-800">
                {t('ingest.upload.selectedSize', { name: file.name, size: formatBytes(file.size) })}
              </p>
              {isMarkdown ? (
                <span className="mt-0.5 inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[9.5px] font-medium text-emerald-700">
                  <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" />
                  {t('ingest.upload.directBadge')}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="ml-1 shrink-0 rounded border border-slate-300 bg-white px-2 py-0.5 text-[10px] text-slate-700 hover:bg-slate-50"
            >
              {t('ingest.upload.replace')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center gap-1 py-2 text-slate-600 hover:text-blue-700"
          >
            <Upload className="h-5 w-5" aria-hidden="true" />
            <span className="text-[11px] font-medium">
              {dragging ? t('ingest.upload.dropActive') : t('ingest.upload.dropTitle')}
            </span>
            <span className="text-[9.5px] text-slate-400">
              {t('ingest.upload.supported', { extensions: formatExtensions(extensions) })}
            </span>
            {maxFileMb > 0 ? (
              <span className="text-[9.5px] text-slate-400">
                {t('ingest.upload.maxSize', { maxMb: maxFileMb })}
              </span>
            ) : null}
          </button>
        )}
      </section>

      <section className="grid gap-2 lg:grid-cols-2">
        <div>
          <span className="text-[10px] font-medium text-slate-600">{t('ingest.engine.label')}</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {ENGINE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setEngine(option)}
                aria-pressed={engine === option}
                className={`rounded-md border px-2 py-1 text-[10px] font-medium ${
                  engine === option
                    ? 'border-blue-300 bg-blue-50 text-blue-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t(`ingest.engine.${option}`)}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[9.5px] text-slate-500">{t(`ingest.engine.${engine}Hint`)}</p>
          {pdfWarning ? (
            <p className="mt-1 flex items-start gap-1 rounded border border-amber-200 bg-amber-50 px-1.5 py-1 text-[9.5px] text-amber-800">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
              {t('ingest.engine.markitdownPdfWarning')}
            </p>
          ) : null}
        </div>

        <div>
          <span className="text-[10px] font-medium text-slate-600">{t('ingest.target.label')}</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {(origin === 'hub'
              ? (['new_manual'] as const)
              : (['single_topic', 'multi_topic'] as const)
            ).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTargetMode(option)}
                aria-pressed={targetMode === option}
                className={`rounded-md border px-2 py-1 text-[10px] font-medium ${
                  targetMode === option
                    ? 'border-blue-300 bg-blue-50 text-blue-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {t(`ingest.target.${option === 'new_manual' ? 'newManual' : option === 'single_topic' ? 'singleTopic' : 'multiTopic'}`)}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[9.5px] text-slate-500">
            {t(
              `ingest.target.${targetMode === 'new_manual' ? 'newManualHint' : targetMode === 'single_topic' ? 'singleTopicHint' : 'multiTopicHint'}`,
            )}
          </p>
        </div>
      </section>

      {targetMode === 'new_manual' ? (
        <section className="grid gap-2 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-2">
            <label className="block">
              <span className="text-[10px] font-medium text-slate-600">{t('ingest.target.manualName')}</span>
              <input
                value={manualName}
                onChange={(event) => setManualName(event.target.value)}
                placeholder={t('ingest.target.manualNamePlaceholder')}
                className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-medium text-slate-600">{t('ingest.target.manualDescription')}</span>
              <input
                value={manualDescription}
                onChange={(event) => setManualDescription(event.target.value)}
                placeholder={t('ingest.target.manualDescriptionPlaceholder')}
                className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block col-span-2">
              <span className="text-[10px] font-medium text-slate-600">{t('ingest.target.language')}</span>
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
                className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-800 outline-none focus:border-blue-400"
              >
                <option value="zh-CN">zh-CN</option>
                <option value="en">en</option>
              </select>
            </label>
          </div>
        </section>
      ) : (
        <section className="grid gap-2 sm:grid-cols-2">
          <label className="block">
            <span className="text-[10px] font-medium text-slate-600">{t('ingest.target.topicType')}</span>
            <select
              value={topicType}
              onChange={(event) => setTopicType(event.target.value as IngestTopicTypeChoice)}
              className="mt-0.5 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-800 outline-none focus:border-blue-400"
            >
              {TOPIC_TYPES.map((option) => (
                <option key={option} value={option}>
                  {t(`ingest.target.topicType.${option}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[10px] font-medium text-slate-600">{t('ingest.target.targetDir')}</span>
            <input
              value={targetDir}
              onChange={(event) => setTargetDir(event.target.value)}
              placeholder={t('ingest.target.targetDirPlaceholder')}
              spellCheck={false}
              className="mt-0.5 w-full rounded-md border border-slate-300 px-2 py-1 font-mono text-[11px] text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
            />
          </label>
          {showMountOption && mountContext ? (
            <label className="sm:col-span-2 flex items-start gap-1.5 rounded border border-slate-200 bg-slate-50 px-2 py-1">
              <input
                type="checkbox"
                checked={mountIntoMap}
                onChange={(event) => setMountIntoMap(event.target.checked)}
                className="mt-0.5 h-3 w-3"
              />
              <span className="min-w-0">
                <span className="block text-[10.5px] font-medium text-slate-700">
                  {t('ingest.target.mountIntoMap')}
                </span>
                <span className="block truncate text-[9.5px] text-slate-500">
                  {t('ingest.target.mountHint', { parent: mountContext.parentLabel })}
                </span>
              </span>
            </label>
          ) : null}
        </section>
      )}

      <section className="space-y-2">
        <label className="block">
          <span className="text-[10px] font-medium text-slate-600">{t('ingest.instruction.label')}</span>
          <textarea
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder={t('ingest.instruction.placeholder')}
            rows={2}
            className="mt-0.5 w-full resize-y rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
          />
          <span className="mt-0.5 block text-[9.5px] text-slate-400">{t('ingest.instruction.hint')}</span>
        </label>

        <label className="flex items-start gap-1.5 rounded border border-slate-200 bg-slate-50/70 px-2 py-1.5">
          <input
            type="checkbox"
            checked={autoApprove}
            onChange={(event) => setAutoApprove(event.target.checked)}
            className="mt-0.5 h-3 w-3"
          />
          <span className="min-w-0">
            <span className="block text-[10.5px] font-medium text-slate-700">
              {t('ingest.autoApprove.label')}
            </span>
            <span className="block text-[9.5px] text-slate-500">{t('ingest.autoApprove.hint')}</span>
          </span>
        </label>
      </section>

      {localError ?? submitError ? (
        <p className="flex items-start gap-1.5 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[10.5px] text-rose-800">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          {localError ?? submitError}
        </p>
      ) : null}

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-4 py-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-md border border-slate-200 bg-white px-3 py-1 text-[11px] text-slate-600 hover:bg-slate-50 disabled:opacity-40"
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-[11px] font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="h-3 w-3" aria-hidden="true" />
          )}
          {submitting ? t('ingest.upload.submitting') : t('ingest.upload.submit')}
        </button>
      </div>
    </div>
  );
}
