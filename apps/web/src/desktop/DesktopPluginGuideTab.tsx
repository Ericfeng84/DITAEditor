/**
 * Plugin & runtime install guide for DITAEditor Desktop.
 *
 * Every card separates three things the user can actually act on: what the tool unlocks, whether
 * this machine already has it (probed through `GET /api/runtime/environment`), and the exact OS
 * commands / folder pickers that fix a missing install. Nothing here runs installs itself — the
 * desktop shell only stores a custom `ditaHome` / `notoFontDir` and re-probes.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Cpu,
  ExternalLink,
  FileCode2,
  FolderSearch,
  Info,
  Languages,
  Loader2,
  PlugZap,
  RefreshCw,
  Trash2,
  Wrench,
} from 'lucide-react';
import { formatDateTime, useI18n } from '../i18n/index.js';
import type { MessageKey } from '../i18n/messages/index.js';
import { getDesktopBridge } from '../services/desktop-bridge.js';
import { useDesktopStore } from '../store/desktop-store.js';

export interface DesktopPluginGuideTabProps {
  /** Opens `AiSettingsDialog` on its parser tab so CLI commands / Docling Serve URL can be edited. */
  onOpenParserSettings?: () => void;
}

type GuideOs = 'mac' | 'windows' | 'linux';
type ProbeState = 'available' | 'missing' | 'disabled' | 'unknown';

const SECONDARY_BTN =
  'inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 text-[10.5px] ' +
  'font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-45';

const LINK_CLASS =
  'inline-flex items-center gap-1 text-[10.5px] font-medium text-blue-700 underline-offset-2 hover:underline';

function osFromPlatform(platform: string | null | undefined): GuideOs {
  if (platform === 'win32') return 'windows';
  if (platform === 'linux') return 'linux';
  return 'mac';
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** One copyable shell command; the feedback is local so several commands can flash independently. */
function CopyCommand({ command }: { command: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(command);
    } catch {
      /* Clipboard permission denied — the command stays visible for manual copying. */
    }
    setCopied(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-900 px-2 py-1">
      <code className="min-w-0 flex-1 select-all break-all font-mono text-[10.5px] text-slate-100">
        {command}
      </code>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={t('desktop.plugins.card.copyAria')}
        title={t('desktop.plugins.card.copyAria')}
        className={`inline-flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] font-semibold transition-colors ${
          copied ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-200 hover:bg-white/20'
        }`}
      >
        {copied ? (
          <CheckCircle2 className="h-2.5 w-2.5" aria-hidden="true" />
        ) : (
          <Copy className="h-2.5 w-2.5" aria-hidden="true" />
        )}
        {copied ? t('desktop.plugins.card.copied') : t('desktop.plugins.card.copy')}
      </button>
    </div>
  );
}

function CommandList({ commands }: { commands: readonly string[] }) {
  return (
    <div className="space-y-1">
      {commands.map((command) => (
        <CopyCommand key={command} command={command} />
      ))}
    </div>
  );
}

function StatusPill({ state }: { state: ProbeState }) {
  const { t } = useI18n();
  const map = {
    available: { key: 'desktop.plugins.status.available', cls: 'border-emerald-200 bg-emerald-50 text-emerald-800', Icon: CheckCircle2 },
    missing: { key: 'desktop.plugins.status.missing', cls: 'border-rose-200 bg-rose-50 text-rose-800', Icon: AlertCircle },
    disabled: { key: 'desktop.plugins.status.disabled', cls: 'border-slate-200 bg-slate-50 text-slate-500', Icon: Info },
    unknown: { key: 'desktop.plugins.status.unknown', cls: 'border-slate-200 bg-white text-slate-500', Icon: Info },
  } as const;
  const entry = map[state];
  const Icon = entry.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9.5px] font-medium ${entry.cls}`}
    >
      <Icon className="h-2.5 w-2.5" aria-hidden="true" />
      {t(entry.key)}
    </span>
  );
}

function StatusRow({
  label,
  state,
  detail,
}: {
  label: string;
  state: ProbeState;
  detail?: string | null;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2 py-1">
      <span className="min-w-0 truncate text-[10.5px] font-medium text-slate-700">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5">
        {detail ? (
          <span className="max-w-52 truncate font-mono text-[9.5px] text-slate-500" title={detail}>
            {detail}
          </span>
        ) : null}
        <StatusPill state={state} />
      </span>
    </div>
  );
}

function GuideCard({
  icon,
  title,
  purpose,
  ready,
  children,
}: {
  icon: typeof PlugZap;
  title: string;
  purpose: string;
  ready: boolean;
  children: ReactNode;
}) {
  const Icon = icon;
  return (
    <section className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-900 text-white">
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[11.5px] font-semibold text-slate-800">{title}</h3>
            <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">{purpose}</p>
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-semibold ${
            ready
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}
        >
          {ready ? <CheckCircle2 className="mr-1 inline h-2.5 w-2.5" aria-hidden="true" /> : null}
          {ready ? 'OK' : '+'}
        </span>
      </div>
      <div className="mt-2 space-y-2">{children}</div>
    </section>
  );
}

export function DesktopPluginGuideTab({ onOpenParserSettings }: DesktopPluginGuideTabProps) {
  const { t } = useI18n();
  const status = useDesktopStore((state) => state.status);
  const env = useDesktopStore((state) => state.env);
  const envLoading = useDesktopStore((state) => state.envLoading);
  const envError = useDesktopStore((state) => state.envError);
  const busy = useDesktopStore((state) => state.busy);
  const actionError = useDesktopStore((state) => state.actionError);
  const refreshEnvironment = useDesktopStore((state) => state.refreshEnvironment);
  const updatePreferences = useDesktopStore((state) => state.updatePreferences);

  const [os, setOs] = useState<GuideOs>(() =>
    osFromPlatform(status?.platform ?? env?.platform ?? null),
  );
  const [pickError, setPickError] = useState<string | null>(null);

  const bridge = getDesktopBridge();

  // Follow the probed platform once it arrives (the OS pills stay switchable afterwards).
  useEffect(() => {
    const detected = status?.platform ?? env?.platform;
    if (detected) setOs(osFromPlatform(detected));
  }, [status?.platform, env?.platform]);

  const pickFolder = async (field: 'ditaHome' | 'notoFontDir') => {
    if (!bridge) return;
    setPickError(null);
    try {
      const picked = await bridge.pickDirectory(status?.[field] ?? undefined);
      if (!picked) return;
      const ok = await updatePreferences(
        field === 'ditaHome' ? { ditaHome: picked } : { notoFontDir: picked },
      );
      if (ok) await refreshEnvironment(true);
    } catch (error) {
      setPickError(t('desktop.storage.pickFailed', { message: toMessage(error) }));
    }
  };

  const clearPath = async (field: 'ditaHome' | 'notoFontDir') => {
    setPickError(null);
    const ok = await updatePreferences(
      field === 'ditaHome' ? { ditaHome: null } : { notoFontDir: null },
    );
    if (ok) await refreshEnvironment(true);
  };

  const stateOf = (available: boolean | undefined): ProbeState =>
    available === undefined ? 'unknown' : available ? 'available' : 'missing';

  const missingTools = [
    !env?.ditaOt.available ? t('desktop.banner.missing.ditaOt') : null,
    !env?.java.available ? t('desktop.banner.missing.java') : null,
    !env?.ditaOt.fontsAvailable ? t('desktop.banner.missing.fonts') : null,
    !env?.git.available ? t('desktop.banner.missing.git') : null,
  ].filter((value): value is string => value !== null);

  const coreChecks = [
    env?.ditaOt.available ?? false,
    env?.java.available ?? false,
    env?.ditaOt.fontsAvailable ?? false,
    env?.git.available ?? false,
  ];
  const coreReady = coreChecks.filter(Boolean).length;
  const coreTotal = coreChecks.length;

  const parserChecks = [
    env?.parsers.markitdownCli.available ?? false,
    env?.parsers.doclingCli.available ?? false,
    env?.parsers.doclingServe.available ?? false,
  ];
  const parsersReady = parserChecks.filter(Boolean).length;

  const isMac = os === 'mac';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
            <Wrench className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            {t('desktop.plugins.title')}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500" data-testid="desktop-plugins-readiness">
            {t('desktop.plugins.readiness', { ready: coreReady, total: coreTotal })}
            {' · '}
            {missingTools.length > 0
              ? t('desktop.plugins.readinessMissing', { tools: missingTools.join(', ') })
              : t('desktop.plugins.readinessOk')}
          </p>
          <p className="mt-0.5 text-[9.5px] text-slate-400">
            {t('desktop.plugins.readiness', {
              ready: parsersReady,
              total: parserChecks.length,
            })}
            {' · '}
            MarkItDown / Docling
            {env?.checkedAt ? ` · ${t('desktop.plugins.detectedAt', { time: formatDateTime(env.checkedAt) })}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <div
            role="group"
            aria-label={t('desktop.plugins.os.switcherAria')}
            className="flex items-center rounded-md border border-slate-200 bg-white p-0.5"
          >
            {(['mac', 'windows'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={os === option}
                onClick={() => setOs(option)}
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                  os === option ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {t(option === 'mac' ? 'desktop.plugins.os.mac' : 'desktop.plugins.os.windows')}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void refreshEnvironment(true)}
            disabled={envLoading}
            className={SECONDARY_BTN}
            data-testid="desktop-plugins-redetect"
          >
            {envLoading ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="h-3 w-3" aria-hidden="true" />
            )}
            {envLoading ? t('desktop.plugins.redetecting') : t('desktop.plugins.redetect')}
          </button>
        </div>
      </div>

      {envError ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[10.5px] text-rose-800">
          {t('desktop.plugins.envError', { message: envError })}
        </p>
      ) : null}
      {pickError || actionError ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[10.5px] text-rose-800">
          {pickError ?? actionError}
        </p>
      ) : null}

      {/* 1. DITA-OT + Java */}
      <GuideCard
        icon={Cpu}
        title={t('desktop.ditaOt.title')}
        purpose={t('desktop.ditaOt.purpose')}
        ready={Boolean(env?.ditaOt.available && env?.java.available)}
      >
        <div className="space-y-1">
          <StatusRow
            label={t('desktop.ditaOt.java')}
            state={stateOf(env?.java.available)}
            detail={env?.java.version ?? env?.java.command ?? null}
          />
          <StatusRow
            label={t('desktop.ditaOt.ditaOt')}
            state={stateOf(env?.ditaOt.available)}
            detail={
              env?.ditaOt.version
                ? t('desktop.ditaOt.version', { version: env.ditaOt.version })
                : (env?.ditaOt.command ?? null)
            }
          />
        </div>

        {status?.ditaHome ? (
          <div className="flex items-center justify-between gap-2 rounded-md border border-blue-200 bg-blue-50 px-2 py-1">
            <span className="min-w-0 truncate font-mono text-[10px] text-blue-900" title={status.ditaHome}>
              {t('desktop.plugins.card.customPath', { path: status.ditaHome })}
            </span>
            <button
              type="button"
              onClick={() => void clearPath('ditaHome')}
              disabled={busy}
              className="inline-flex shrink-0 items-center gap-1 rounded px-1 py-0.5 text-[9.5px] font-medium text-blue-800 hover:bg-blue-100"
            >
              <Trash2 className="h-2.5 w-2.5" aria-hidden="true" />
              {t('desktop.plugins.card.clearPath')}
            </button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => void pickFolder('ditaHome')}
            disabled={busy || !bridge}
            className={SECONDARY_BTN}
            data-testid="desktop-plugins-select-dita-home"
          >
            <FolderSearch className="h-3 w-3" aria-hidden="true" />
            {t('desktop.ditaOt.selectFolder')}
          </button>
          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[9.5px] font-medium text-slate-600">
            <PlugZap className="h-2.5 w-2.5" aria-hidden="true" />
            {t('desktop.plugins.card.bundled')}
          </span>
        </div>

        <p className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] leading-relaxed text-slate-600">
          {t('desktop.ditaOt.bundled')}
        </p>

        <div>
          <p className="mb-1 text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">
            {t('desktop.plugins.card.installCommands')}
          </p>
          <p className="mb-1 text-[10px] text-slate-500">
            {isMac ? t('desktop.ditaOt.macStep1') : t('desktop.ditaOt.winStep1')}
          </p>
          <CommandList
            commands={
              isMac
                ? ['brew install --cask temurin@21', 'brew install dita-ot']
                : [
                    'winget install EclipseAdoptium.Temurin.21.JRE',
                    'Expand-Archive .\\dita-ot-4.2.1.zip -DestinationPath C:\\dita-ot',
                  ]
            }
          />
          <p className="mt-1 text-[10px] text-slate-500">
            {isMac ? t('desktop.ditaOt.macStep2') : t('desktop.ditaOt.winStep2')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="https://www.dita-ot.org/download"
            target="_blank"
            rel="noreferrer"
            className={LINK_CLASS}
          >
            <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
            {t('desktop.ditaOt.download')}
          </a>
          <a href="https://adoptium.net/" target="_blank" rel="noreferrer" className={LINK_CLASS}>
            <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
            {t('desktop.ditaOt.adoptium')}
          </a>
        </div>
      </GuideCard>

      {/* 2. Noto CJK fonts */}
      <GuideCard
        icon={Languages}
        title={t('desktop.fonts.title')}
        purpose={t('desktop.fonts.purpose')}
        ready={Boolean(env?.ditaOt.fontsAvailable)}
      >
        <StatusRow
          label={t('desktop.fonts.status')}
          state={stateOf(env?.ditaOt.fontsAvailable)}
          detail={env?.ditaOt.fontsPath ?? null}
        />

        {status?.notoFontDir ? (
          <div className="flex items-center justify-between gap-2 rounded-md border border-blue-200 bg-blue-50 px-2 py-1">
            <span
              className="min-w-0 truncate font-mono text-[10px] text-blue-900"
              title={status.notoFontDir}
            >
              {t('desktop.plugins.card.customPath', { path: status.notoFontDir })}
            </span>
            <button
              type="button"
              onClick={() => void clearPath('notoFontDir')}
              disabled={busy}
              className="inline-flex shrink-0 items-center gap-1 rounded px-1 py-0.5 text-[9.5px] font-medium text-blue-800 hover:bg-blue-100"
            >
              <Trash2 className="h-2.5 w-2.5" aria-hidden="true" />
              {t('desktop.plugins.card.clearPath')}
            </button>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => void pickFolder('notoFontDir')}
            disabled={busy || !bridge}
            className={SECONDARY_BTN}
            data-testid="desktop-plugins-select-fonts"
          >
            <FolderSearch className="h-3 w-3" aria-hidden="true" />
            {t('desktop.fonts.selectFolder')}
          </button>
        </div>

        <div>
          <p className="mb-1 text-[10px] text-slate-500">
            {isMac ? t('desktop.fonts.macStep1') : t('desktop.fonts.winStep1')}
          </p>
          <CommandList
            commands={
              isMac
                ? ['brew install --cask font-noto-sans-cjk-sc']
                : [
                    'Expand-Archive .\\03_NotoSansCJK-OTF-VF.zip -DestinationPath $env:TEMP\\noto-cjk',
                    'Copy-Item $env:TEMP\\noto-cjk\\*.otf "$env:LOCALAPPDATA\\Microsoft\\Windows\\Fonts"',
                  ]
            }
          />
          <p className="mt-1 text-[10px] text-slate-500">
            {isMac ? t('desktop.fonts.macStep2') : t('desktop.fonts.winStep2')}
          </p>
        </div>

        <a
          href="https://github.com/notofonts/noto-cjk/releases"
          target="_blank"
          rel="noreferrer"
          className={LINK_CLASS}
        >
          <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
          {t('desktop.fonts.download')}
        </a>
      </GuideCard>

      {/* 3. Git */}
      <GuideCard
        icon={FileCode2}
        title={t('desktop.git.title')}
        purpose={t('desktop.git.purpose')}
        ready={Boolean(env?.git.available)}
      >
        <StatusRow
          label={t('desktop.git.status')}
          state={stateOf(env?.git.available)}
          detail={env?.git.version ?? env?.git.command ?? null}
        />
        <div>
          <p className="mb-1 text-[10px] text-slate-500">
            {isMac ? t('desktop.git.macStep1') : t('desktop.git.winStep1')}
          </p>
          <CommandList
            commands={
              isMac ? ['xcode-select --install', 'brew install git'] : ['winget install Git.Git']
            }
          />
          <p className="mt-1 text-[10px] text-slate-500">
            {isMac ? t('desktop.git.macStep2') : t('desktop.git.winStep2')}
          </p>
        </div>
        <a href="https://git-scm.com/downloads" target="_blank" rel="noreferrer" className={LINK_CLASS}>
          <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
          {t('desktop.git.download')}
        </a>
      </GuideCard>

      {/* 4. Ingest parsers */}
      <GuideCard
        icon={FileCode2}
        title={t('desktop.ingest.title')}
        purpose={t('desktop.ingest.purpose')}
        ready={Boolean(
          env?.parsers.markitdownCli.available ||
            env?.parsers.doclingCli.available ||
            env?.parsers.doclingServe.available,
        )}
      >
        <div className="space-y-1">
          <StatusRow
            label={t('desktop.ingest.markitdown')}
            state={
              env?.parsers.markitdownCli.enabled === false
                ? 'disabled'
                : stateOf(env?.parsers.markitdownCli.available)
            }
            detail={env?.parsers.markitdownCli.version ?? env?.parsers.markitdownCli.command ?? null}
          />
          <StatusRow
            label={t('desktop.ingest.doclingCli')}
            state={stateOf(env?.parsers.doclingCli.available)}
            detail={env?.parsers.doclingCli.version ?? env?.parsers.doclingCli.command ?? null}
          />
          <StatusRow
            label={t('desktop.ingest.doclingServe')}
            state={stateOf(env?.parsers.doclingServe.available)}
            detail={env?.parsers.doclingServe.url ?? null}
          />
        </div>

        <p className="flex items-start gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] leading-relaxed text-slate-600">
          <Info className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
          {t('desktop.ingest.direct')}
        </p>

        <div>
          <p className="mb-1 text-[10px] text-slate-500">
            {isMac ? t('desktop.ingest.macStep1') : t('desktop.ingest.winStep1')}
          </p>
          <CommandList
            commands={
              isMac
                ? ["pipx install 'markitdown[all]'", 'pipx install docling']
                : ['pipx install "markitdown[all]"', 'pipx install docling']
            }
          />
          <p className="mt-1 text-[10px] text-slate-500">
            {isMac ? t('desktop.ingest.macStep2') : t('desktop.ingest.winStep2')}
          </p>
          <CommandList
            commands={[
              isMac
                ? 'docker run -p 5001:5001 quay.io/docling-project/docling-serve'
                : 'docker run -p 5001:5001 quay.io/docling-project/docling-serve',
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href="https://docling-project.github.io/docling/"
            target="_blank"
            rel="noreferrer"
            className={LINK_CLASS}
          >
            <ExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
            {t('desktop.ingest.download')}
          </a>
          {onOpenParserSettings ? (
            <button
              type="button"
              onClick={onOpenParserSettings}
              className={SECONDARY_BTN}
              data-testid="desktop-plugins-open-parser-settings"
            >
              <Wrench className="h-3 w-3" aria-hidden="true" />
              {t('desktop.ingest.openParserSettings')}
            </button>
          ) : null}
        </div>
      </GuideCard>

      <p className="text-[9.5px] text-slate-400">{t('desktop.plugins.card.notes')}</p>
    </div>
  );
}
