import { cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createServer,
  resetDitaRuntimeCache,
  type DitaRuntimeOptions,
  type RuntimeEnvironmentReport,
} from '../src/index.js';
import {
  detectRuntimeEnvironment,
  parseGitVersion,
  parseJavaVersion,
  probeCommandVersion,
  type BinaryProbeResult,
  type CommandVersionProbe,
} from '../src/modules/runtime/environment-service.js';
import type { ParserRuntimeDetection } from '../src/modules/ingest/parser-settings-service.js';
import type { CommandRunner } from '../src/modules/ingest/parsers/types.js';

const SAMPLE_ROOT = path.resolve(__dirname, '../../../samples/demo-dita-project');
const tempDirs: string[] = [];

interface Fixture {
  root: string;
  projectDir: string;
  importsDir: string;
  dbPath: string;
  worktreesRootDir: string;
  publishRootDir: string;
  draftAssetsDir: string;
}

function createFixture(): Fixture {
  const root = mkdtempSync(path.join(os.tmpdir(), 'dita-runtime-env-'));
  tempDirs.push(root);
  const projectDir = path.join(root, 'project');
  cpSync(SAMPLE_ROOT, projectDir, { recursive: true });
  rmSync(path.join(projectDir, '.git'), { recursive: true, force: true });
  rmSync(path.join(projectDir, '.gitignore'), { force: true });
  return {
    root,
    projectDir,
    importsDir: path.join(root, 'imports'),
    dbPath: path.join(root, 'runtime-env.sqlite'),
    worktreesRootDir: path.join(root, 'worktrees'),
    publishRootDir: path.join(root, 'publish'),
    draftAssetsDir: path.join(root, 'draft-assets'),
  };
}

/** Every CLI parser probe fails fast, so the endpoint never shells out to Docling/MarkItDown. */
function missingCliRunner(): CommandRunner {
  return {
    async run(command) {
      throw new Error(`${command}: not found on PATH`);
    },
    async isAvailable() {
      return false;
    },
  };
}

const PARSER_DETECTION: ParserRuntimeDetection = {
  direct: { available: true, extensions: ['.md', '.txt'] },
  doclingServe: { available: false, version: null, details: 'No Docling serve URL configured.', url: null },
  doclingCli: { available: false, version: null, details: 'Missing.', command: 'docling', enabled: true },
  markitdownCli: {
    available: false,
    version: null,
    details: 'Missing.',
    command: 'markitdown',
    enabled: true,
  },
  supportedExtensions: ['.md', '.txt'],
};

function stubProbe(results: Record<string, BinaryProbeResult>): CommandVersionProbe {
  return async (command) =>
    results[command] ?? { available: false, command, version: null, error: 'unexpected command' };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('binary version parsing', () => {
  it('extracts the git semantic version from the banner', () => {
    expect(parseGitVersion('git version 2.45.1\n', '')).toBe('2.45.1');
    expect(parseGitVersion('git version 2.39.3 (Apple Git-145)', '')).toBe('2.39.3');
    expect(parseGitVersion('', 'unexpected banner')).toBe('unexpected banner');
  });

  it('reads the Java version from stderr, where Oracle/OpenJDK print it', () => {
    expect(
      parseJavaVersion(
        '',
        'openjdk version "21.0.4" 2024-07-16\nOpenJDK Runtime Environment (build 21.0.4+7-LTS)\n',
      ),
    ).toBe('21.0.4');
    expect(parseJavaVersion('', 'java version "1.8.0_412"\nJava(TM) SE Runtime Environment')).toBe(
      '1.8.0_412',
    );
    expect(parseJavaVersion('openjdk 21.0.2 2024-01-16\nOpenJDK 64-Bit Server VM', '')).toBe(
      '21.0.2',
    );
  });
});

describe('detectRuntimeEnvironment', () => {
  let fixture: Fixture;

  beforeEach(() => {
    fixture = createFixture();
  });

  it('reports available git/java and degrades missing binaries without throwing', async () => {
    const calls: string[] = [];
    const base = stubProbe({
      git: { available: true, command: 'git', version: '2.45.1' },
      java: { available: false, command: 'java', version: null, error: 'java: not found on PATH' },
    });
    const report = await detectRuntimeEnvironment(
      {
        ditaRuntime: { command: 'dita-runtime-env-missing-binary', ditaHome: fixture.root },
        parserSettings: { detectRuntimes: async () => PARSER_DETECTION },
        probeCommandVersion: async (command, args, parse, timeoutMs) => {
          calls.push(`${command} ${args.join(' ')} ${String(timeoutMs)}`);
          return base(command, args, parse, timeoutMs);
        },
      },
      { force: true, probeTimeoutMs: 1_111 },
    );

    expect(calls).toEqual(['git --version 1111', 'java -version 1111']);
    expect(report.git).toEqual({ available: true, command: 'git', version: '2.45.1' });
    expect(report.java.available).toBe(false);
    expect(report.java.error).toContain('not found on PATH');
    expect(report.platform).toBe(process.platform);
    expect(report.arch).toBe(process.arch);
    expect(report.parsers.direct.available).toBe(true);
    // The DITA-OT probe really runs and fails fast because the injected command does not exist.
    expect(report.ditaOt.available).toBe(false);
    expect(report.ditaOt.command).toBe('dita-runtime-env-missing-binary');
  });

  it('turns a throwing probe into one unavailable row instead of failing the report', async () => {
    const report = await detectRuntimeEnvironment(
      {
        parserSettings: { detectRuntimes: async () => PARSER_DETECTION },
        probeCommandVersion: async (command) => {
          if (command === 'git') throw new Error('boom');
          return { available: true, command, version: '17.0.1' };
        },
      },
      { force: true },
    );
    expect(report.git.available).toBe(false);
    expect(report.git.error).toBe('boom');
    expect(report.java.version).toBe('17.0.1');
  });

  it('spawns a real binary through probeCommandVersion', async () => {
    const result = await probeCommandVersion(
      process.execPath,
      ['--version'],
      (stdout) => stdout.trim().replace(/^v/, '') || null,
      10_000,
    );
    expect(result.available).toBe(true);
    expect(result.version).toMatch(/^\d+\.\d+\.\d+/);
  }, 20_000);

  it('reports ENOENT for a binary that does not exist', async () => {
    const result = await probeCommandVersion(
      'dita-runtime-env-definitely-missing-binary',
      ['--version'],
      (stdout) => stdout.trim() || null,
      10_000,
    );
    expect(result.available).toBe(false);
    expect(result.version).toBeNull();
    expect(result.error).toContain('not found on PATH');
  });
});

describe('GET /api/runtime/environment', () => {
  let fixture: Fixture;
  let app: ReturnType<typeof createServer> | undefined;
  let ditaRuntime: DitaRuntimeOptions;

  beforeEach(() => {
    fixture = createFixture();
    // Mutable object handed to createServer by reference, exactly like @dita/desktop does.
    // Both paths live under the fixture root so the assertions never depend on host installs.
    ditaRuntime = {
      command: 'dita-runtime-env-missing-binary',
      ditaHome: path.join(fixture.root, 'before-dita-ot'),
      notoFontDir: path.join(fixture.root, 'before-fonts'),
    };
    app = createServer({
      workspaceDir: fixture.projectDir,
      importsRootDir: fixture.importsDir,
      dbPath: fixture.dbPath,
      worktreesRootDir: fixture.worktreesRootDir,
      publishRootDir: fixture.publishRootDir,
      draftAssetsRootDir: fixture.draftAssetsDir,
      ditaRuntime,
      ingestCommandRunner: missingCliRunner(),
      logger: false,
    });
  });

  afterEach(async () => {
    if (app) await app.close();
    app = undefined;
  });

  it('serves a full report without any identity or manual scope headers', async () => {
    const response = await app!.inject({ method: 'GET', url: '/api/runtime/environment' });
    expect(response.statusCode).toBe(200);
    const report = response.json() as RuntimeEnvironmentReport;

    expect(report.platform).toBe(process.platform);
    expect(report.arch).toBe(process.arch);
    expect(typeof report.checkedAt).toBe('string');
    expect(new Date(report.checkedAt).toString()).not.toBe('Invalid Date');
    expect(Object.keys(report.git).sort()).toEqual(['available', 'command', 'version']);
    expect(report.git.command).toBe('git');
    expect(typeof report.git.available).toBe('boolean');
    expect(report.java.command).toBe('java');
    // DITA-OT reports the injected (missing) command; CJK fonts are unresolvable in a bare tmp dir.
    expect(report.ditaOt.command).toBe('dita-runtime-env-missing-binary');
    expect(report.ditaOt.available).toBe(false);
    expect(report.parsers.direct.available).toBe(true);
    expect(report.parsers.doclingCli.available).toBe(false);
    expect(report.parsers.markitdownCli.available).toBe(false);
  });

  it('reflects a mutated ditaRuntime after resetDitaRuntimeCache()', async () => {
    const initial = await app!.inject({ method: 'GET', url: '/api/runtime/environment?force=true' });
    expect(initial.statusCode).toBe(200);
    const before = initial.json() as RuntimeEnvironmentReport;
    expect(before.ditaOt.ditaHome).toBe(path.resolve(fixture.root, 'before-dita-ot'));
    expect(before.ditaOt.fontsPath).toBeNull();
    expect(before.ditaOt.fontsAvailable).toBe(false);
    expect(before.ditaOt.version).toBeNull();

    // Simulate Desktop Settings: point ditaHome at a real install dir and fonts at a real dir.
    const ditaHomeDir = path.join(fixture.root, 'dita-ot-home');
    mkdirSync(path.join(ditaHomeDir, 'bin'), { recursive: true });
    const fontsDir = path.join(fixture.root, 'noto-fonts');
    mkdirSync(fontsDir, { recursive: true });

    ditaRuntime.ditaHome = ditaHomeDir;
    ditaRuntime.notoFontDir = fontsDir;
    resetDitaRuntimeCache();

    const after = await app!.inject({ method: 'GET', url: '/api/runtime/environment' });
    expect(after.statusCode).toBe(200);
    const report = after.json() as RuntimeEnvironmentReport;
    expect(report.ditaOt.ditaHome).toBe(path.resolve(ditaHomeDir));
    expect(report.ditaOt.fontsPath).toBe(path.resolve(fontsDir));
    expect(report.ditaOt.fontsAvailable).toBe(true);

    // A second, cached read keeps the same values (`?force=0` reuses the 30 s cache).
    const cached = await app!.inject({ method: 'GET', url: '/api/runtime/environment?force=0' });
    expect(cached.statusCode).toBe(200);
    expect((cached.json() as RuntimeEnvironmentReport).ditaOt.ditaHome).toBe(
      path.resolve(ditaHomeDir),
    );
  }, 30_000);
});
