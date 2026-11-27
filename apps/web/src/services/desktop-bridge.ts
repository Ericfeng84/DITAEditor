/**
 * Renderer-side façade over `window.ditaDesktop` (exposed by `apps/desktop/src/preload.ts`).
 *
 * The workbench must behave identically in a browser / Docker deployment, so nothing here may
 * assume the bridge exists: `isDesktopApp()` is the single gate every desktop-only control reads,
 * and every accessor returns `null` / a localized no-op outside Electron instead of throwing.
 */

import type { IngestParserRuntimeDetection } from './ingest-api.js';
import type { PublishRuntimeInfo } from './publish-api.js';
import { requestJson } from './workspace-api.js';

/** How `changeDataDir` treats whatever already sits in the selected folder. */
export type DataDirSwitchMode = 'migrate' | 'use-existing' | 'fresh';

/** Result of inspecting a candidate data folder before switching to it. */
export interface DesktopDirInspection {
  path: string;
  exists: boolean;
  writable: boolean;
  hasExistingData: boolean;
  isSameAsCurrent: boolean;
  isNestedConflict: boolean;
  error?: string;
}

export interface DesktopRuntimeStatus {
  dataDir: string;
  defaultDataDir: string;
  isCustomDataDir: boolean;
  isEnvOverridden: boolean;
  ditaHome: string | null;
  notoFontDir: string | null;
  pluginGuideDismissed: boolean;
  platform: string;
  paths: {
    workspaceDir: string;
    importsRootDir: string;
    dbPath: string;
    publishRootDir: string;
  };
}

export interface DesktopPreferencesPatch {
  ditaHome?: string | null;
  notoFontDir?: string | null;
  pluginGuideDismissed?: boolean;
}

export interface DitaDesktopBridge {
  readonly isDesktop: true;
  readonly platform: string;
  pickDirectory: (defaultPath?: string) => Promise<string | null>;
  getStatus: () => Promise<DesktopRuntimeStatus>;
  inspectDataDir: (targetDir: string) => Promise<DesktopDirInspection>;
  changeDataDir: (input: {
    targetDir: string | null;
    mode: DataDirSwitchMode;
  }) => Promise<DesktopRuntimeStatus>;
  updatePreferences: (patch: DesktopPreferencesPatch) => Promise<DesktopRuntimeStatus>;
  openPath: (targetPath: string) => Promise<string>;
  onOpenDesktopSettings: (listener: () => void) => () => void;
}

/** One probed binary (`git --version`, `java -version`, …). */
export interface BinaryProbeResult {
  available: boolean;
  command: string;
  version: string | null;
  error?: string;
}

/** Mirrors `RuntimeEnvironmentReport` from `GET /api/runtime/environment`. */
export interface RuntimeEnvironmentReport {
  checkedAt: string;
  platform: string;
  arch: string;
  git: BinaryProbeResult;
  java: BinaryProbeResult;
  ditaOt: PublishRuntimeInfo;
  parsers: IngestParserRuntimeDetection;
}

declare global {
  interface Window {
    ditaDesktop?: DitaDesktopBridge;
  }
}

/** The Electron bridge, or `null` in a browser / Docker deployment. */
export function getDesktopBridge(): DitaDesktopBridge | null {
  if (typeof window === 'undefined') return null;
  const bridge = window.ditaDesktop;
  return bridge && bridge.isDesktop ? bridge : null;
}

/** True only inside DITAEditor Desktop; every desktop-only affordance must be gated on this. */
export function isDesktopApp(): boolean {
  return getDesktopBridge() !== null;
}

/** Current OS (`darwin` / `win32` / `linux`) when running in the desktop shell. */
export function desktopPlatform(): string | null {
  return getDesktopBridge()?.platform ?? null;
}

/**
 * Probe Git / Java / DITA-OT / Noto CJK / Docling / MarkItDown on the API host.
 * `force` bypasses the server's probe cache so "Re-detect all" reflects a fresh install.
 */
export function fetchRuntimeEnvironment(force = true): Promise<RuntimeEnvironmentReport> {
  return requestJson<RuntimeEnvironmentReport>(
    `/api/runtime/environment?force=${force ? '1' : '0'}`,
    { cache: 'no-store' },
  );
}

/** Whether the report shows a machine that cannot validate / publish yet. */
export function hasMissingCoreTools(
  env: RuntimeEnvironmentReport | null,
): boolean {
  if (!env) return false;
  return !env.git.available || !env.ditaOt.available || !env.ditaOt.fontsAvailable;
}

/** Human-readable list of the missing core tools, in guide-card order. */
export function missingCoreToolIds(env: RuntimeEnvironmentReport | null): string[] {
  if (!env) return [];
  const missing: string[] = [];
  if (!env.ditaOt.available) missing.push('ditaOt');
  if (!env.java.available) missing.push('java');
  if (!env.ditaOt.fontsAvailable) missing.push('fonts');
  if (!env.git.available) missing.push('git');
  return missing;
}
