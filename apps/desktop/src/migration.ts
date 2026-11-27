import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { DESKTOP_DATA_SUB_ITEMS } from './paths.js';

export interface MigrateDesktopDataDirOptions {
  fromDir: string;
  toDir: string;
}

export interface MigrateDesktopDataDirResult {
  copiedItems: string[];
  updatedDbRows: number;
}

/** SQLite columns holding absolute paths that must follow the data folder. */
const DB_PATH_COLUMNS: ReadonlyArray<readonly [table: string, columns: readonly string[]]> = [
  ['manuals', ['root_dir']],
  ['repositories', ['root_dir']],
  ['publish_jobs', ['log_path', 'output_path', 'artifact_path', 'snapshot_path']],
];

const REGISTRY_RELATIVE_PATH = path.join('workspaces', 'workspaces.json');

const SQLITE_SIDECAR_SUFFIXES = ['-wal', '-shm'] as const;

/** `from`/`to` prefix pairs, including realpath variants (macOS `/var` → `/private/var`). */
type PrefixPair = { from: string; to: string };

function buildPrefixPairs(fromDir: string, toDir: string): PrefixPair[] {
  const pairs: PrefixPair[] = [{ from: fromDir, to: toDir }];
  try {
    const realFrom = realpathSync(fromDir);
    if (realFrom !== fromDir) {
      let realTo = toDir;
      try {
        realTo = realpathSync(toDir);
      } catch {
        // Target does not exist yet; the resolved path is the best available mapping.
      }
      pairs.push({ from: realFrom, to: realTo });
    }
  } catch {
    // Source folder missing: no realpath variant to add.
  }
  return pairs;
}

/**
 * Rewrites a stored absolute path when it lives inside `fromDir`. Exact matches become
 * `toDir`; nested paths keep their relative suffix. Anything else returns `null`.
 */
function rewriteStoredPath(
  value: string,
  pairs: readonly PrefixPair[],
): string | null {
  for (const pair of pairs) {
    if (value === pair.from) return pair.to;
    if (value.startsWith(`${pair.from}/`) || value.startsWith(`${pair.from}\\`)) {
      return `${pair.to}${value.slice(pair.from.length)}`;
    }
  }
  return null;
}

function tableColumns(sqlite: Database.Database, table: string): Set<string> {
  const rows = sqlite.pragma(`table_info(${table})`) as Array<{ name?: unknown }>;
  const columns = new Set<string>();
  for (const row of rows) {
    if (typeof row.name === 'string') columns.add(row.name);
  }
  return columns;
}

function tableExists(sqlite: Database.Database, table: string): boolean {
  const row = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(table) as { name?: unknown } | undefined;
  return typeof row?.name === 'string';
}

/**
 * Flushes WAL pages into the main `.sqlite` file so a copied database is a single file
 * (the API opens SQLite in WAL mode). Safe no-op when the file does not exist.
 */
function checkpointDatabase(dbPath: string): void {
  if (!existsSync(dbPath)) return;
  const sqlite = new Database(dbPath, { fileMustExist: true });
  try {
    sqlite.pragma('wal_checkpoint(TRUNCATE)');
  } finally {
    sqlite.close();
  }
  for (const suffix of SQLITE_SIDECAR_SUFFIXES) {
    const sidecar = `${dbPath}${suffix}`;
    try {
      if (existsSync(sidecar) && statSync(sidecar).size === 0) {
        rmSync(sidecar, { force: true });
      }
    } catch {
      // A locked sidecar is harmless once the main file holds every committed page.
    }
  }
}

function rewriteDatabasePaths(
  dbPath: string,
  pairs: readonly PrefixPair[],
): number {
  if (!existsSync(dbPath)) return 0;
  const sqlite = new Database(dbPath);
  let updatedRows = 0;
  try {
    const apply = sqlite.transaction(() => {
      for (const [table, columns] of DB_PATH_COLUMNS) {
        if (!tableExists(sqlite, table)) continue;
        const existingColumns = tableColumns(sqlite, table);
        const hasId = existingColumns.has('id');
        for (const column of columns) {
          if (!existingColumns.has(column)) continue;
          const keyExpression = hasId ? 'id' : 'rowid';
          const rows = sqlite
            .prepare(
              `SELECT ${keyExpression} AS __key, ${column} AS __value FROM ${table} WHERE ${column} IS NOT NULL AND ${column} <> ''`,
            )
            .all() as Array<{ __key: unknown; __value: unknown }>;
          const update = sqlite.prepare(
            `UPDATE ${table} SET ${column} = ? WHERE ${keyExpression} = ?`,
          );
          for (const row of rows) {
            if (typeof row.__value !== 'string') continue;
            const rewritten = rewriteStoredPath(row.__value, pairs);
            if (rewritten === null || rewritten === row.__value) continue;
            update.run(rewritten, row.__key);
            updatedRows += 1;
          }
        }
      }
    });
    apply();
    sqlite.pragma('wal_checkpoint(TRUNCATE)');
  } finally {
    sqlite.close();
  }
  return updatedRows;
}

function rewriteWorkspaceRegistry(toDir: string, pairs: readonly PrefixPair[]): void {
  const registryPath = path.join(toDir, REGISTRY_RELATIVE_PATH);
  if (!existsSync(registryPath)) return;

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(registryPath, 'utf8'));
  } catch {
    return;
  }
  const container =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as { workspaces?: unknown })
      : null;
  if (!container || !Array.isArray(container.workspaces)) return;

  let changed = false;
  const rewritten = container.workspaces.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object') return entry;
    const record = entry as Record<string, unknown>;
    if (typeof record.path !== 'string') return entry;
    const nextPath = rewriteStoredPath(record.path, pairs);
    if (nextPath === null) return entry;
    changed = true;
    return { ...record, path: nextPath };
  });
  if (!changed) return;

  writeFileSync(
    registryPath,
    `${JSON.stringify({ ...container, workspaces: rewritten }, null, 2)}\n`,
    'utf8',
  );
}

/**
 * Removes `.git/worktrees` from a copied repository. Phase 13 recreates branch worktrees on
 * demand, and stale links would otherwise point into the OLD data folder's `git-worktrees`.
 */
function pruneWorktreeDir(repoDir: string): void {
  const worktreesDir = path.join(repoDir, '.git', 'worktrees');
  rmSync(worktreesDir, { recursive: true, force: true });
}

function pruneCopiedWorktrees(toDir: string): void {
  pruneWorktreeDir(path.join(toDir, 'demo-dita-project'));

  const workspacesDir = path.join(toDir, 'workspaces');
  if (!existsSync(workspacesDir)) return;
  let entries: string[];
  try {
    entries = readdirSync(workspacesDir);
  } catch {
    return;
  }
  for (const name of entries) {
    const candidate = path.join(workspacesDir, name);
    try {
      if (!statSync(candidate).isDirectory()) continue;
    } catch {
      continue;
    }
    pruneWorktreeDir(candidate);
  }
}

/**
 * Copies a DITAEditor data root to a new folder and rewrites every stored absolute path.
 *
 * MUST only run while the embedded `@dita/api` Fastify server (and therefore SQLite) is
 * closed — the caller closes the server first. The source database is checkpointed with
 * `PRAGMA wal_checkpoint(TRUNCATE)` before copying so the destination gets one clean
 * `.sqlite` file and never inherits `-wal`/`-shm` sidecars.
 */
export function migrateDesktopDataDir(
  options: MigrateDesktopDataDirOptions,
): MigrateDesktopDataDirResult {
  const fromDir = path.resolve(options.fromDir);
  const toDir = path.resolve(options.toDir);
  if (fromDir === toDir) {
    throw new Error('The new data folder must differ from the current data folder.');
  }

  mkdirSync(toDir, { recursive: true });

  // Guarantee the source SQLite file is self-contained before it is copied.
  checkpointDatabase(path.join(fromDir, 'dita-editor.sqlite'));

  const copiedItems: string[] = [];
  for (const item of DESKTOP_DATA_SUB_ITEMS) {
    const source = path.join(fromDir, item);
    if (!existsSync(source)) continue;
    const destination = path.join(toDir, item);
    if (item === 'dita-editor.sqlite') {
      // Never carry stale sidecars from a previous run into the new folder.
      for (const suffix of SQLITE_SIDECAR_SUFFIXES) {
        rmSync(`${destination}${suffix}`, { force: true });
      }
    }
    cpSync(source, destination, { recursive: true, force: true });
    copiedItems.push(item);
  }

  pruneCopiedWorktrees(toDir);

  const pairs = buildPrefixPairs(fromDir, toDir);
  const updatedDbRows = rewriteDatabasePaths(path.join(toDir, 'dita-editor.sqlite'), pairs);
  rewriteWorkspaceRegistry(toDir, pairs);

  // The rewrite opened SQLite in WAL mode again; fold it back into a single file.
  checkpointDatabase(path.join(toDir, 'dita-editor.sqlite'));

  return { copiedItems, updatedDbRows };
}
