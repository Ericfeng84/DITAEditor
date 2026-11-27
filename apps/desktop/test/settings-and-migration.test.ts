import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { migrateDesktopDataDir } from '../src/migration.js';
import {
  DESKTOP_SETTINGS_FILENAME,
  loadDesktopSettings,
  saveDesktopSettings,
  type DesktopSettings,
} from '../src/settings.js';

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('loadDesktopSettings', () => {
  it('returns an empty object when the file is missing', () => {
    const userDataDir = makeTempDir('dita-settings-missing-');
    expect(loadDesktopSettings(userDataDir)).toEqual({});
  });

  it('returns an empty object for corrupt or unexpected JSON instead of throwing', () => {
    const userDataDir = makeTempDir('dita-settings-corrupt-');
    writeFileSync(path.join(userDataDir, DESKTOP_SETTINGS_FILENAME), '{not json');
    expect(loadDesktopSettings(userDataDir)).toEqual({});

    writeFileSync(path.join(userDataDir, DESKTOP_SETTINGS_FILENAME), '[1, 2, 3]');
    expect(loadDesktopSettings(userDataDir)).toEqual({});

    writeFileSync(path.join(userDataDir, DESKTOP_SETTINGS_FILENAME), 'null');
    expect(loadDesktopSettings(userDataDir)).toEqual({});
  });

  it('validates field types and trims valid paths', () => {
    const userDataDir = makeTempDir('dita-settings-validate-');
    writeFileSync(
      path.join(userDataDir, DESKTOP_SETTINGS_FILENAME),
      JSON.stringify({
        dataDir: '  /tmp/custom-data  ',
        ditaHome: 42,
        notoFontDir: '   ',
        pluginGuideDismissed: 'yes',
        unknownKey: true,
      }),
    );

    expect(loadDesktopSettings(userDataDir)).toEqual({
      dataDir: '/tmp/custom-data',
    } satisfies DesktopSettings);
  });
});

describe('saveDesktopSettings', () => {
  it('merges patches, deletes keys with null, and persists atomically', () => {
    const userDataDir = makeTempDir('dita-settings-save-');
    mkdirSync(userDataDir, { recursive: true });

    const first = saveDesktopSettings(userDataDir, {
      dataDir: '/tmp/data-one',
      ditaHome: '/opt/dita-ot',
      notoFontDir: '/usr/share/fonts/noto-cjk',
      pluginGuideDismissed: true,
    });
    expect(first).toEqual({
      dataDir: '/tmp/data-one',
      ditaHome: '/opt/dita-ot',
      notoFontDir: '/usr/share/fonts/noto-cjk',
      pluginGuideDismissed: true,
    });
    expect(loadDesktopSettings(userDataDir)).toEqual(first);

    const second = saveDesktopSettings(userDataDir, {
      dataDir: null,
      notoFontDir: undefined,
      pluginGuideDismissed: false,
    });
    expect(second).toEqual({
      ditaHome: '/opt/dita-ot',
      pluginGuideDismissed: false,
    });
    expect(loadDesktopSettings(userDataDir)).toEqual(second);

    // Atomic write leaves no temp files behind and writes valid JSON.
    const entries = readdirSync(userDataDir);
    expect(entries).toEqual([DESKTOP_SETTINGS_FILENAME]);
    const raw = JSON.parse(
      readFileSync(path.join(userDataDir, DESKTOP_SETTINGS_FILENAME), 'utf8'),
    ) as DesktopSettings;
    expect(raw.ditaHome).toBe('/opt/dita-ot');
  });

  it('creates the userData directory on first save', () => {
    const root = makeTempDir('dita-settings-nested-');
    const userDataDir = path.join(root, 'nested', 'userData');
    const saved = saveDesktopSettings(userDataDir, { pluginGuideDismissed: true });
    expect(saved).toEqual({ pluginGuideDismissed: true });
    expect(existsSync(path.join(userDataDir, DESKTOP_SETTINGS_FILENAME))).toBe(true);
  });
});

interface FixturePaths {
  fromDir: string;
  toDir: string;
}

/**
 * Builds a realistic data root: real SQLite DB (manuals/repositories/publish_jobs), the
 * sample project + a manual repo with `.git/worktrees`, `workspaces.json`, `publishes`, and
 * a `git-worktrees` folder that must NOT be migrated.
 */
function createDataRootFixture(): FixturePaths {
  const root = makeTempDir('dita-migrate-');
  const fromDir = path.join(root, 'old-data');
  const toDir = path.join(root, 'new-data');
  mkdirSync(fromDir, { recursive: true });

  // Repositories + worktree links that must be pruned after the copy.
  const demoRepo = path.join(fromDir, 'demo-dita-project');
  mkdirSync(path.join(demoRepo, '.git', 'worktrees', 'feature-login'), { recursive: true });
  mkdirSync(path.join(demoRepo, '.git', 'objects'), { recursive: true });
  writeFileSync(path.join(demoRepo, '.git', 'config'), '[core]\n\tbare = false\n');
  writeFileSync(path.join(demoRepo, 'topic.dita'), '<topic id="t1"><title>Demo</title></topic>');

  const manualRepo = path.join(fromDir, 'workspaces', 'manual-a');
  mkdirSync(path.join(manualRepo, '.git', 'worktrees', 'release-1.0'), { recursive: true });
  writeFileSync(path.join(manualRepo, '.git', 'config'), '[core]\n\tbare = false\n');
  writeFileSync(path.join(manualRepo, 'index.ditamap'), '<map/>');

  writeFileSync(
    path.join(fromDir, 'workspaces', 'workspaces.json'),
    `${JSON.stringify(
      {
        version: 1,
        workspaces: [
          { path: manualRepo, name: 'manual-a', lastOpenedAt: 1 },
          { path: '/somewhere/else', name: 'elsewhere', lastOpenedAt: 2 },
        ],
      },
      null,
      2,
    )}\n`,
  );

  mkdirSync(path.join(fromDir, 'publishes', 'job-1'), { recursive: true });
  writeFileSync(path.join(fromDir, 'publishes', 'job-1', 'log.txt'), 'build ok\n');

  // Shared branch-worktree root: must never be copied (recreated on demand).
  mkdirSync(path.join(fromDir, 'git-worktrees'), { recursive: true });
  writeFileSync(path.join(fromDir, 'git-worktrees', 'stale.txt'), 'stale\n');

  const db = new Database(path.join(fromDir, 'dita-editor.sqlite'));
  try {
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE manuals (
        id TEXT PRIMARY KEY NOT NULL,
        root_dir TEXT NOT NULL
      );
      CREATE TABLE repositories (
        id TEXT PRIMARY KEY NOT NULL,
        root_dir TEXT NOT NULL
      );
      CREATE TABLE publish_jobs (
        id TEXT PRIMARY KEY NOT NULL,
        log_path TEXT,
        output_path TEXT,
        artifact_path TEXT,
        snapshot_path TEXT
      );
    `);
    const insertManual = db.prepare('INSERT INTO manuals (id, root_dir) VALUES (?, ?)');
    insertManual.run('manual-a', demoRepo);
    insertManual.run('manual-external', '/opt/external-manual');
    db.prepare('INSERT INTO repositories (id, root_dir) VALUES (?, ?)').run(
      'manual-a',
      path.join(fromDir, 'workspaces', 'manual-a'),
    );
    db.prepare(
      `INSERT INTO publish_jobs (id, log_path, output_path, artifact_path, snapshot_path)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(
      'job-1',
      path.join(fromDir, 'publishes', 'job-1', 'build.log'),
      path.join(fromDir, 'publishes', 'job-1', 'out'),
      path.join(fromDir, 'publishes', 'job-1', 'out', 'result.zip'),
      path.join(fromDir, 'publishes', 'job-1', 'snapshot'),
    );
    // A job whose paths live outside the data root must not be touched.
    db.prepare(
      `INSERT INTO publish_jobs (id, log_path, output_path, artifact_path, snapshot_path)
       VALUES (?, ?, ?, ?, ?)`,
    ).run('job-external', '/var/log/external.log', null, null, null);
  } finally {
    db.close();
  }

  return { fromDir, toDir };
}

describe('migrateDesktopDataDir', () => {
  it('copies data, rewrites stored paths, and prunes stale git worktrees', () => {
    const { fromDir, toDir } = createDataRootFixture();

    const result = migrateDesktopDataDir({ fromDir, toDir });

    expect(result.copiedItems).toEqual([
      'dita-editor.sqlite',
      'demo-dita-project',
      'workspaces',
      'publishes',
    ]);
    expect(result.updatedDbRows).toBeGreaterThanOrEqual(6);

    // Files copied, shared worktree root skipped.
    expect(existsSync(path.join(toDir, 'dita-editor.sqlite'))).toBe(true);
    expect(existsSync(path.join(toDir, 'demo-dita-project', 'topic.dita'))).toBe(true);
    expect(existsSync(path.join(toDir, 'workspaces', 'manual-a', 'index.ditamap'))).toBe(true);
    expect(existsSync(path.join(toDir, 'publishes', 'job-1', 'log.txt'))).toBe(true);
    expect(existsSync(path.join(toDir, 'git-worktrees'))).toBe(false);

    // `.git/worktrees` pruned, the rest of `.git` survives.
    expect(existsSync(path.join(toDir, 'demo-dita-project', '.git', 'worktrees'))).toBe(false);
    expect(existsSync(path.join(toDir, 'demo-dita-project', '.git', 'objects'))).toBe(true);
    expect(existsSync(path.join(toDir, 'demo-dita-project', '.git', 'config'))).toBe(true);
    expect(existsSync(path.join(toDir, 'workspaces', 'manual-a', '.git', 'worktrees'))).toBe(
      false,
    );
    expect(existsSync(path.join(toDir, 'workspaces', 'manual-a', '.git', 'config'))).toBe(true);

    // Single clean SQLite file: no WAL sidecars left behind.
    expect(existsSync(path.join(toDir, 'dita-editor.sqlite-wal'))).toBe(false);
    expect(existsSync(path.join(toDir, 'dita-editor.sqlite-shm'))).toBe(false);

    const db = new Database(path.join(toDir, 'dita-editor.sqlite'), { readonly: true });
    try {
      const manuals = db
        .prepare('SELECT id, root_dir FROM manuals ORDER BY id')
        .all() as Array<{ id: string; root_dir: string }>;
      expect(manuals).toEqual([
        { id: 'manual-a', root_dir: path.join(toDir, 'demo-dita-project') },
        { id: 'manual-external', root_dir: '/opt/external-manual' },
      ]);

      const repositories = db
        .prepare('SELECT id, root_dir FROM repositories')
        .all() as Array<{ id: string; root_dir: string }>;
      expect(repositories).toEqual([
        { id: 'manual-a', root_dir: path.join(toDir, 'workspaces', 'manual-a') },
      ]);

      const jobs = db
        .prepare(
          'SELECT id, log_path, output_path, artifact_path, snapshot_path FROM publish_jobs ORDER BY id',
        )
        .all() as Array<Record<string, string | null>>;
      expect(jobs).toEqual([
        {
          id: 'job-1',
          log_path: path.join(toDir, 'publishes', 'job-1', 'build.log'),
          output_path: path.join(toDir, 'publishes', 'job-1', 'out'),
          artifact_path: path.join(toDir, 'publishes', 'job-1', 'out', 'result.zip'),
          snapshot_path: path.join(toDir, 'publishes', 'job-1', 'snapshot'),
        },
        {
          id: 'job-external',
          log_path: '/var/log/external.log',
          output_path: null,
          artifact_path: null,
          snapshot_path: null,
        },
      ]);
    } finally {
      db.close();
    }

    const registry = JSON.parse(
      readFileSync(path.join(toDir, 'workspaces', 'workspaces.json'), 'utf8'),
    ) as { version: number; workspaces: Array<{ path: string; name: string }> };
    expect(registry.version).toBe(1);
    expect(registry.workspaces.map((entry) => entry.path)).toEqual([
      path.join(toDir, 'workspaces', 'manual-a'),
      '/somewhere/else',
    ]);
  });

  it('creates the target folder and tolerates a missing source data root', () => {
    const root = makeTempDir('dita-migrate-empty-');
    const fromDir = path.join(root, 'does-not-exist');
    const toDir = path.join(root, 'nested', 'new-data');

    const result = migrateDesktopDataDir({ fromDir, toDir });
    expect(result).toEqual({ copiedItems: [], updatedDbRows: 0 });
    expect(existsSync(toDir)).toBe(true);
  });

  it('refuses to migrate a data folder onto itself', () => {
    const root = makeTempDir('dita-migrate-same-');
    expect(() => migrateDesktopDataDir({ fromDir: root, toDir: `${root}/` })).toThrow(
      /must differ/,
    );
  });

  it('drops stale WAL sidecars already present in the destination folder', () => {
    const { fromDir, toDir } = createDataRootFixture();
    mkdirSync(toDir, { recursive: true });
    writeFileSync(path.join(toDir, 'dita-editor.sqlite-wal'), 'stale');
    writeFileSync(path.join(toDir, 'dita-editor.sqlite-shm'), 'stale');

    migrateDesktopDataDir({ fromDir, toDir });

    expect(existsSync(path.join(toDir, 'dita-editor.sqlite-wal'))).toBe(false);
    expect(existsSync(path.join(toDir, 'dita-editor.sqlite-shm'))).toBe(false);
  });
});
