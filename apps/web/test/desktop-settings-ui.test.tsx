// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HubHeader } from '../src/workbench/HubHeader';
import { WorkbenchHeader } from '../src/components/WorkbenchHeader';
import { DesktopSettingsDialog } from '../src/desktop/DesktopSettingsDialog';
import { DesktopPluginBanner } from '../src/desktop/DesktopPluginBanner';
import {
  isDesktopApp,
  type DesktopDirInspection,
  type DesktopRuntimeStatus,
  type DitaDesktopBridge,
  type RuntimeEnvironmentReport,
} from '../src/services/desktop-bridge';
import { useDesktopStore } from '../src/store/desktop-store';
import { t } from '../src/i18n/index.js';

/**
 * The desktop storage/plugin surface lives behind `window.ditaDesktop`, so these tests exercise the
 * real components twice: once as the browser/Docker build (bridge absent → nothing renders) and
 * once with a mocked preload bridge, asserting the folder-switch and install-guide contracts.
 */

const DATA_DIR = '/Users/tester/Library/Application Support/DITAEditor';
const DEFAULT_DIR = '/Users/tester/Library/Application Support/DITAEditor';
const PICKED_DIR = '/Volumes/Data/DITAEditor';

const STATUS: DesktopRuntimeStatus = {
  dataDir: DATA_DIR,
  defaultDataDir: DEFAULT_DIR,
  isCustomDataDir: false,
  isEnvOverridden: false,
  ditaHome: null,
  notoFontDir: null,
  pluginGuideDismissed: false,
  platform: 'darwin',
  paths: {
    workspaceDir: `${DATA_DIR}/workspace`,
    importsRootDir: `${DATA_DIR}/imports`,
    dbPath: `${DATA_DIR}/ditaeditor.sqlite`,
    publishRootDir: `${DATA_DIR}/publish`,
  },
};

const CUSTOM_STATUS: DesktopRuntimeStatus = {
  ...STATUS,
  dataDir: PICKED_DIR,
  isCustomDataDir: true,
  ditaHome: '/opt/dita-ot',
};

const CHECKED_AT = '2026-11-27T10:00:00.000Z';

function buildEnv(overrides: Partial<RuntimeEnvironmentReport> = {}): RuntimeEnvironmentReport {
  return {
    checkedAt: CHECKED_AT,
    platform: 'darwin',
    arch: 'arm64',
    git: { available: true, command: 'git', version: 'git version 2.45.0' },
    java: { available: true, command: 'java', version: 'openjdk 21.0.4' },
    ditaOt: {
      available: true,
      command: 'dita',
      ditaHome: '/opt/dita-ot',
      version: 'DITA-OT 4.2.1',
      pluginInstalled: true,
      pluginPath: null,
      fopConfigPath: null,
      fontsAvailable: true,
      fontsPath: '/usr/share/fonts/noto-cjk',
      checkedAt: CHECKED_AT,
    },
    parsers: {
      direct: { available: true, extensions: ['.md', '.txt'] },
      doclingServe: { available: false, version: null, details: null, url: 'http://localhost:5001' },
      doclingCli: { available: false, version: null, details: null, command: 'docling' },
      markitdownCli: { available: false, version: null, details: null, command: 'markitdown', enabled: true },
      supportedExtensions: ['.md', '.txt', '.docx', '.pdf'],
    },
    ...overrides,
  };
}

const ENV = buildEnv();

const MISSING_ENV = buildEnv({
  git: { available: false, command: 'git', version: null },
  java: { available: false, command: 'java', version: null },
  ditaOt: {
    ...buildEnv().ditaOt,
    available: false,
    version: null,
    ditaHome: null,
    fontsAvailable: false,
    fontsPath: null,
  },
});

const INSPECTION_EXISTING: DesktopDirInspection = {
  path: PICKED_DIR,
  exists: true,
  writable: true,
  hasExistingData: true,
  isSameAsCurrent: false,
  isNestedConflict: false,
};

const INSPECTION_EMPTY: DesktopDirInspection = {
  ...INSPECTION_EXISTING,
  hasExistingData: false,
};

const INSPECTION_CONFLICT: DesktopDirInspection = {
  ...INSPECTION_EXISTING,
  hasExistingData: false,
  isNestedConflict: true,
};

/** `requestJson` only needs `ok`, `status` and `text()`. */
function mockFetch(payload: unknown) {
  const fn = vi.fn(
    async () =>
      ({
        ok: true,
        status: 200,
        text: async () => JSON.stringify(payload),
      }) as unknown as Response,
  );
  vi.stubGlobal('fetch', fn);
  return fn;
}

function installBridge(overrides: Partial<DitaDesktopBridge> = {}): DitaDesktopBridge {
  const bridge: DitaDesktopBridge = {
    isDesktop: true,
    platform: 'darwin',
    pickDirectory: vi.fn(async () => PICKED_DIR),
    getStatus: vi.fn(async () => STATUS),
    inspectDataDir: vi.fn(async () => INSPECTION_EXISTING),
    changeDataDir: vi.fn(async () => CUSTOM_STATUS),
    updatePreferences: vi.fn(async () => STATUS),
    openPath: vi.fn(async () => ''),
    onOpenDesktopSettings: vi.fn(() => () => {}),
    ...overrides,
  };
  window.ditaDesktop = bridge;
  return bridge;
}

const HUB_PROPS = {
  identity: null,
  currentUser: null,
  onSwitchIdentity: () => {},
  onRefresh: () => {},
  loading: false,
  offline: false,
};

const WORKBENCH_PROPS = {
  showBrand: true,
  activeTab: null,
  mode: 'visual' as const,
  xmlError: null,
  leftSidebarOpen: true,
  problemsOpen: false,
  errorCount: 0,
  warningCount: 0,
  dirtyCount: 0,
  identity: null,
  currentUser: null,
  onSwitchIdentity: () => {},
  onToggleLeftSidebar: () => {},
  onChangeMode: () => {},
  onToggleProblems: () => {},
  showInspectorExpand: false,
  onExpandInspector: () => {},
};

beforeEach(() => {
  delete window.ditaDesktop;
  useDesktopStore.getState().reset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete window.ditaDesktop;
  useDesktopStore.getState().reset();
});

describe('desktop bridge gating', () => {
  it('reports browser mode and hides every desktop-only control', () => {
    mockFetch(ENV);
    expect(isDesktopApp()).toBe(false);

    render(<HubHeader {...HUB_PROPS} />);
    expect(screen.queryByTestId('desktop-settings-button')).toBeNull();

    cleanup();
    render(<WorkbenchHeader {...WORKBENCH_PROPS} />);
    expect(screen.queryByTestId('desktop-settings-button')).toBeNull();
  });

  it('shows the header button in the desktop shell and opens the storage tab', async () => {
    installBridge();
    mockFetch(ENV);
    expect(isDesktopApp()).toBe(true);

    render(<HubHeader {...HUB_PROPS} />);
    const button = screen.getByTestId('desktop-settings-button');
    fireEvent.click(button);

    const state = useDesktopStore.getState();
    expect(state.dialogOpen).toBe(true);
    expect(state.activeTab).toBe('storage');
    await waitFor(() => expect(useDesktopStore.getState().status).not.toBeNull());
  });
});

describe('DesktopSettingsDialog storage tab', () => {
  it('shows the data folder, inspects a picked folder and switches with the chosen mode', async () => {
    const bridge = installBridge();
    mockFetch(ENV);
    useDesktopStore.getState().openDialog('storage');

    render(<DesktopSettingsDialog />);
    await screen.findByTestId('desktop-settings-dialog');

    await waitFor(() =>
      expect(screen.getByTestId('desktop-storage-current-path').textContent).toContain(DATA_DIR),
    );
    expect(screen.getByTestId('desktop-storage-badge').textContent).toContain(
      t('desktop.storage.badgeDefault'),
    );

    fireEvent.click(screen.getByTestId('desktop-storage-choose'));
    await screen.findByTestId('desktop-storage-candidate');

    expect(bridge.pickDirectory).toHaveBeenCalledWith(DATA_DIR);
    expect(bridge.inspectDataDir).toHaveBeenCalledWith(PICKED_DIR);
    expect(screen.getByTestId('desktop-storage-existing-badge').textContent).toContain(
      t('desktop.storage.existingData'),
    );

    // Existing data ⇒ "use-existing" is the recommended default.
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    const useExisting = radios.find((radio) => radio.value === 'use-existing');
    expect(useExisting?.checked).toBe(true);

    const fresh = radios.find((radio) => radio.value === 'fresh');
    expect(fresh).toBeTruthy();
    fireEvent.click(fresh!);
    expect(fresh?.checked).toBe(true);

    fireEvent.click(screen.getByTestId('desktop-storage-apply'));
    await waitFor(() =>
      expect(bridge.changeDataDir).toHaveBeenCalledWith({ targetDir: PICKED_DIR, mode: 'fresh' }),
    );
  });

  it('blocks the switch when the picked folder is nested inside the current one', async () => {
    installBridge({ inspectDataDir: vi.fn(async () => INSPECTION_CONFLICT) });
    mockFetch(ENV);
    useDesktopStore.getState().openDialog('storage');

    render(<DesktopSettingsDialog />);
    await screen.findByTestId('desktop-settings-dialog');
    fireEvent.click(screen.getByTestId('desktop-storage-choose'));

    await screen.findByTestId('desktop-storage-candidate');
    expect(screen.getByText(t('desktop.storage.nestedConflict'))).toBeTruthy();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    expect((screen.getByTestId('desktop-storage-apply') as HTMLButtonElement).disabled).toBe(true);
  });

  it('offers restoring the default folder for a custom data dir', async () => {
    const bridge = installBridge({ getStatus: vi.fn(async () => CUSTOM_STATUS) });
    mockFetch(ENV);
    useDesktopStore.getState().openDialog('storage');

    render(<DesktopSettingsDialog />);
    await screen.findByTestId('desktop-settings-dialog');
    await waitFor(() =>
      expect(screen.getByTestId('desktop-storage-current-path').textContent).toContain(PICKED_DIR),
    );
    expect(screen.getByTestId('desktop-storage-badge').textContent).toContain(
      t('desktop.storage.badgeCustom'),
    );

    // Restoring re-inspects the default folder, then switches with the matching mode.
    fireEvent.click(screen.getByTestId('desktop-storage-restore'));
    await waitFor(() =>
      expect(bridge.changeDataDir).toHaveBeenCalledWith({ targetDir: null, mode: 'use-existing' }),
    );
  });
});

describe('DesktopSettingsDialog plugin guide tab', () => {
  it('renders probed statuses, install commands and OS-specific instructions', async () => {
    installBridge();
    mockFetch(ENV);
    useDesktopStore.getState().openDialog('plugins');

    render(<DesktopSettingsDialog />);
    await screen.findByTestId('desktop-settings-dialog');
    await waitFor(() => expect(useDesktopStore.getState().env).not.toBeNull());

    expect(screen.getByTestId('desktop-plugins-readiness').textContent).toContain(t('desktop.plugins.readiness', { ready: 4, total: 4 }));
    expect(screen.getByText('git version 2.45.0')).toBeTruthy();
    expect(screen.getByText('openjdk 21.0.4')).toBeTruthy();
    expect(screen.getByText(t('desktop.ingest.markitdown'))).toBeTruthy();

    // macOS commands by default (platform darwin), plus the bundled plugin note.
    expect(screen.getByText('brew install dita-ot')).toBeTruthy();
    expect(screen.getByText(t('desktop.ditaOt.bundled'))).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: t('desktop.plugins.os.windows') }));
    expect(screen.getByText('winget install Git.Git')).toBeTruthy();
  });

  it('re-detects on demand and stores a picked DITA-OT folder', async () => {
    const bridge = installBridge({ pickDirectory: vi.fn(async () => '/opt/dita-ot-4.2.1') });
    const fetchMock = mockFetch(MISSING_ENV);
    useDesktopStore.getState().openDialog('plugins');

    render(<DesktopSettingsDialog />);
    await screen.findByTestId('desktop-settings-dialog');
    await waitFor(() => expect(useDesktopStore.getState().env).not.toBeNull());

    // Missing core tools ⇒ the readiness line names them instead of claiming all good.
    expect(screen.getByTestId('desktop-plugins-readiness').textContent).toContain(
      t('desktop.banner.missing.ditaOt'),
    );

    fireEvent.click(screen.getByTestId('desktop-plugins-redetect'));
    await waitFor(() =>
      expect(fetchMock.mock.calls.some((call) => String(call[0]).includes('force=1'))).toBe(true),
    );

    fireEvent.click(screen.getByTestId('desktop-plugins-select-dita-home'));
    await waitFor(() =>
      expect(bridge.updatePreferences).toHaveBeenCalledWith({ ditaHome: '/opt/dita-ot-4.2.1' }),
    );
    expect(bridge.pickDirectory).toHaveBeenCalled();
  });
});

describe('DesktopPluginBanner', () => {
  it('lists missing tools and lets the user open the guide or dismiss it', async () => {
    const bridge = installBridge();
    mockFetch(MISSING_ENV);

    render(<DesktopPluginBanner />);
    const banner = await screen.findByTestId('desktop-plugin-banner');
    expect(banner.textContent).toContain(t('desktop.banner.missing.git'));

    fireEvent.click(screen.getByTestId('desktop-plugin-banner-guide'));
    expect(useDesktopStore.getState().dialogOpen).toBe(true);
    expect(useDesktopStore.getState().activeTab).toBe('plugins');

    fireEvent.click(screen.getByTestId('desktop-plugin-banner-dismiss'));
    await waitFor(() => expect(bridge.updatePreferences).toHaveBeenCalledWith({ pluginGuideDismissed: true }));
  });

  it('stays hidden when every core tool is present', async () => {
    installBridge();
    mockFetch(ENV);

    render(<DesktopPluginBanner />);
    await waitFor(() => expect(useDesktopStore.getState().env).not.toBeNull());
    expect(screen.queryByTestId('desktop-plugin-banner')).toBeNull();
  });

  it('renders nothing in browser mode', () => {
    mockFetch(ENV);
    render(<DesktopPluginBanner />);
    expect(screen.queryByTestId('desktop-plugin-banner')).toBeNull();
  });
});
