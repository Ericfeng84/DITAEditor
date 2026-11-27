/**
 * Storage pane of the desktop settings dialog: shows where DITAEditor keeps its data, lets the
 * user reopen that folder, and switches to another folder with an explicit migration policy.
 *
 * Switching restarts the embedded API server, so every candidate folder is inspected first and
 * blocking problems (read-only, same folder, nested folders) are surfaced before the action.
 */

import { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  Database,
  Download,
  FolderInput,
  FolderOpen,
  HardDrive,
  Loader2,
  Package,
  RotateCcw,
  Upload,
} from 'lucide-react';
import { useI18n } from '../i18n/index.js';
import type { MessageKey } from '../i18n/messages/index.js';
import {
  getDesktopBridge,
  type DataDirSwitchMode,
  type DesktopDirInspection,
} from '../services/desktop-bridge.js';
import { useDesktopStore } from '../store/desktop-store.js';

const SECONDARY_BTN =
  'inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 ' +
  'text-[11px] font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-45';

const PRIMARY_BTN =
  'inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[11.5px] ' +
  'font-semibold text-white shadow-sm shadow-blue-600/20 transition-colors hover:bg-blue-700 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-45';

const PATH_ROW_CLASS =
  'flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-[10.5px]';

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function describeInspectionBlockers(
  inspection: DesktopDirInspection,
): ('notWritable' | 'sameAsCurrent' | 'nestedConflict')[] {
  const blockers: ('notWritable' | 'sameAsCurrent' | 'nestedConflict')[] = [];
  if (!inspection.writable) blockers.push('notWritable');
  if (inspection.isSameAsCurrent) blockers.push('sameAsCurrent');
  if (inspection.isNestedConflict) blockers.push('nestedConflict');
  return blockers;
}

interface ModeOption {
  value: DataDirSwitchMode;
  labelKey: MessageKey;
  descriptionKey: MessageKey;
}

const MODE_OPTIONS: readonly ModeOption[] = [
  { value: 'migrate', labelKey: 'desktop.storage.modeMigrate', descriptionKey: 'desktop.storage.modeMigrateDesc' },
  {
    value: 'use-existing',
    labelKey: 'desktop.storage.modeUseExisting',
    descriptionKey: 'desktop.storage.modeUseExistingDesc',
  },
  { value: 'fresh', labelKey: 'desktop.storage.modeFresh', descriptionKey: 'desktop.storage.modeFreshDesc' },
];

function StorageBlockerList({ blockers }: { blockers: ReturnType<typeof describeInspectionBlockers> }) {
  const { t } = useI18n();
  if (blockers.length === 0) return null;
  return (
    <ul className="space-y-1">
      {blockers.map((blocker) => (
        <li key={blocker} className="flex items-start gap-1.5 text-[10.5px] text-rose-700">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
          <span>{t(`desktop.storage.${blocker}` as MessageKey)}</span>
        </li>
      ))}
    </ul>
  );
}

export function DesktopStorageTab() {
  const { t } = useI18n();
  const status = useDesktopStore((state) => state.status);
  const statusLoading = useDesktopStore((state) => state.statusLoading);
  const statusError = useDesktopStore((state) => state.statusError);
  const busy = useDesktopStore((state) => state.busy);
  const actionError = useDesktopStore((state) => state.actionError);
  const changeDataDir = useDesktopStore((state) => state.changeDataDir);

  const [candidate, setCandidate] = useState<DesktopDirInspection | null>(null);
  const [mode, setMode] = useState<DataDirSwitchMode>('migrate');
  const [picking, setPicking] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);

  const bridge = getDesktopBridge();
  const envOverridden = status?.isEnvOverridden ?? false;
  const blockers = candidate ? describeInspectionBlockers(candidate) : [];
  const blocked = blockers.length > 0;
  const hasExistingData = candidate?.hasExistingData ?? false;
  const recommendedMode: DataDirSwitchMode = hasExistingData ? 'use-existing' : 'migrate';

  const chooseFolder = async () => {
    if (!bridge || picking) return;
    setInspectError(null);
    setPicking(true);
    try {
      const picked = await bridge.pickDirectory(status?.dataDir ?? undefined);
      if (!picked) return;
      const inspection = await bridge.inspectDataDir(picked);
      setCandidate(inspection);
      setMode(inspection.hasExistingData ? 'use-existing' : 'migrate');
    } catch (error) {
      setInspectError(t('desktop.storage.inspectFailed', { message: toMessage(error) }));
    } finally {
      setPicking(false);
    }
  };

  const applySwitch = async () => {
    if (!candidate || blocked) return;
    await changeDataDir({ targetDir: candidate.path, mode });
  };

  const restoreDefault = async () => {
    if (!bridge || !status) return;
    setRestoring(true);
    setInspectError(null);
    try {
      const inspection = await bridge.inspectDataDir(status.defaultDataDir);
      const nextMode: DataDirSwitchMode = inspection.hasExistingData ? 'use-existing' : 'migrate';
      await changeDataDir({ targetDir: null, mode: nextMode });
    } catch (error) {
      setInspectError(t('desktop.storage.inspectFailed', { message: toMessage(error) }));
    } finally {
      setRestoring(false);
    }
  };

  const openFolder = () => {
    if (!bridge || !status) return;
    void bridge.openPath(status.dataDir);
  };

  const badge = status?.isEnvOverridden
    ? { key: 'desktop.storage.badgeEnv' as MessageKey, cls: 'border-amber-200 bg-amber-50 text-amber-800' }
    : status?.isCustomDataDir
      ? { key: 'desktop.storage.badgeCustom' as MessageKey, cls: 'border-blue-200 bg-blue-50 text-blue-800' }
      : { key: 'desktop.storage.badgeDefault' as MessageKey, cls: 'border-slate-200 bg-slate-50 text-slate-600' };

  const managedRows: { key: MessageKey; path: string; icon: typeof HardDrive }[] = status
    ? [
        { key: 'desktop.storage.managed.workspace', path: status.paths.workspaceDir, icon: FolderOpen },
        { key: 'desktop.storage.managed.imports', path: status.paths.importsRootDir, icon: Download },
        { key: 'desktop.storage.managed.db', path: status.paths.dbPath, icon: Database },
        { key: 'desktop.storage.managed.publish', path: status.paths.publishRootDir, icon: Package },
      ]
    : [];

  return (
    <div className="space-y-3.5">
      {statusLoading && !status ? (
        <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
          {t('common.loading')}
        </p>
      ) : null}
      {statusError ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[10.5px] text-rose-800">
          {statusError}
        </p>
      ) : null}

      {status ? (
        <section className="rounded-lg border border-slate-200 bg-slate-50/60 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                <HardDrive className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                {t('desktop.storage.currentTitle')}
              </h3>
              <p
                className="mt-1 break-all font-mono text-[11px] text-slate-800"
                data-testid="desktop-storage-current-path"
              >
                {status.dataDir}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span
                className={`rounded-full border px-2 py-0.5 text-[9.5px] font-semibold ${badge.cls}`}
                data-testid="desktop-storage-badge"
              >
                {t(badge.key)}
              </span>
              <button
                type="button"
                onClick={openFolder}
                aria-label={t('desktop.storage.openFolderAria')}
                className={SECONDARY_BTN}
              >
                <FolderOpen className="h-3 w-3" aria-hidden="true" />
                {t('desktop.storage.openFolder')}
              </button>
            </div>
          </div>

          <div className="mt-2.5">
            <h4 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {t('desktop.storage.managedTitle')}
            </h4>
            <ul className="space-y-1">
              {managedRows.map((row) => {
                const Icon = row.icon;
                return (
                  <li key={row.key} className={PATH_ROW_CLASS}>
                    <Icon className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
                    <span className="w-40 shrink-0 truncate text-[10px] text-slate-500">{t(row.key)}</span>
                    <span className="min-w-0 flex-1 break-all font-mono text-slate-700" title={row.path}>
                      {row.path}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ) : null}

      {envOverridden ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10.5px] text-amber-900">
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            {t('desktop.storage.envNoticeTitle')}
          </p>
          <p className="mt-0.5 text-amber-800">{t('desktop.storage.envNoticeBody')}</p>
        </div>
      ) : null}

      {!envOverridden ? (
        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="text-[11px] font-semibold text-slate-700">{t('desktop.storage.changeTitle')}</h3>
          <p className="mt-0.5 text-[10.5px] text-slate-500">{t('desktop.storage.changeBody')}</p>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => void chooseFolder()}
              disabled={picking || busy || !bridge}
              className={SECONDARY_BTN}
              data-testid="desktop-storage-choose"
            >
              {picking ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
              ) : (
                <FolderInput className="h-3 w-3" aria-hidden="true" />
              )}
              {picking ? t('desktop.storage.choosing') : t('desktop.storage.chooseFolder')}
            </button>
          </div>

          {inspectError ? (
            <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[10.5px] text-rose-800">
              {inspectError}
            </p>
          ) : null}

          {candidate ? (
            <div
              className="mt-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-2.5"
              data-testid="desktop-storage-candidate"
            >
              <h4 className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {t('desktop.storage.candidateTitle')}
              </h4>
              <p className="mt-0.5 break-all font-mono text-[10.5px] text-slate-800">{candidate.path}</p>

              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9.5px] font-medium ${
                    candidate.writable
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-rose-200 bg-rose-50 text-rose-800'
                  }`}
                >
                  <Check className="h-2.5 w-2.5" aria-hidden="true" />
                  {candidate.writable ? t('desktop.storage.writable') : t('desktop.storage.readonly')}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9.5px] font-medium ${
                    candidate.hasExistingData
                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                  data-testid="desktop-storage-existing-badge"
                >
                  <Database className="h-2.5 w-2.5" aria-hidden="true" />
                  {candidate.hasExistingData
                    ? t('desktop.storage.existingData')
                    : t('desktop.storage.emptyFolder')}
                </span>
              </div>

              {candidate.error ? (
                <p className="mt-1.5 text-[10.5px] text-rose-700">{candidate.error}</p>
              ) : null}
              <div className="mt-1.5">
                <StorageBlockerList blockers={blockers} />
              </div>

              {!blocked ? (
                <fieldset className="mt-2.5">
                  <legend className="mb-1 text-[10.5px] font-medium text-slate-600">
                    {t('desktop.storage.modeTitle')}
                  </legend>
                  <div className="space-y-1">
                    {MODE_OPTIONS.filter(
                      (option) => option.value !== 'use-existing' || hasExistingData,
                    ).map((option) => {
                      const selected = mode === option.value;
                      return (
                        <label
                          key={option.value}
                          className={`flex cursor-pointer items-start gap-2 rounded-md border px-2 py-1.5 transition-colors ${
                            selected
                              ? 'border-blue-300 bg-blue-50/70'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="radio"
                            name="desktop-data-dir-mode"
                            value={option.value}
                            checked={selected}
                            onChange={() => setMode(option.value)}
                            className="mt-0.5 h-3 w-3 text-blue-600 focus:ring-blue-200"
                          />
                          <span className="min-w-0">
                            <span className="flex items-center gap-1.5 text-[10.5px] font-medium text-slate-800">
                              {t(option.labelKey)}
                              {option.value === recommendedMode ? (
                                <span className="rounded bg-emerald-100 px-1 py-[1px] text-[9px] font-semibold text-emerald-800">
                                  {t('desktop.storage.modeRecommended')}
                                </span>
                              ) : null}
                            </span>
                            <span className="mt-0.5 block text-[10px] leading-relaxed text-slate-500">
                              {t(option.descriptionKey)}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  {mode === 'migrate' && hasExistingData ? (
                    <p className="mt-1 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] text-amber-900">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                      {t('desktop.storage.modeMigrateWarn')}
                    </p>
                  ) : null}
                </fieldset>
              ) : null}

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void applySwitch()}
                  disabled={blocked || busy || !bridge}
                  className={PRIMARY_BTN}
                  data-testid="desktop-storage-apply"
                >
                  {busy ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {busy ? t('desktop.storage.applying') : t('desktop.storage.apply')}
                </button>
                <span className="text-[10px] text-slate-500">{t('desktop.storage.switchHint')}</span>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {status?.isCustomDataDir && !envOverridden ? (
        <section className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="text-[11px] font-semibold text-slate-700">{t('desktop.storage.restoreTitle')}</h3>
          <p className="mt-0.5 break-all font-mono text-[10px] text-slate-500">
            {t('desktop.storage.restoreBody', { path: status.dataDir })}
          </p>
          <p className="mt-0.5 break-all font-mono text-[10px] text-slate-500">{status.defaultDataDir}</p>
          <button
            type="button"
            onClick={() => void restoreDefault()}
            disabled={busy || restoring || !bridge}
            className={`${SECONDARY_BTN} mt-2`}
            data-testid="desktop-storage-restore"
          >
            {restoring ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : (
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
            )}
            {restoring ? t('desktop.storage.restoring') : t('desktop.storage.restoreDefault')}
          </button>
        </section>
      ) : null}

      {actionError ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[10.5px] text-rose-800">
          {actionError}
        </p>
      ) : null}
    </div>
  );
}
