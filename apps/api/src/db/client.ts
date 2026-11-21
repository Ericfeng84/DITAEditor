import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

export type DitaDatabase = BetterSQLite3Database<typeof schema>;

export interface DitaDatabaseHandle {
  db: DitaDatabase;
  close: () => void;
}

const DDL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL,
  email TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS repositories (
  id TEXT PRIMARY KEY NOT NULL,
  root_dir TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  initialized_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS repositories_root_dir_unique ON repositories (root_dir);

CREATE TABLE IF NOT EXISTS file_locks (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  branch TEXT NOT NULL,
  file_path TEXT NOT NULL,
  user_id TEXT NOT NULL,
  locked_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS file_locks_scope_unique
  ON file_locks (project_id, branch, file_path);
CREATE INDEX IF NOT EXISTS file_locks_scope_idx
  ON file_locks (project_id, branch);

CREATE TABLE IF NOT EXISTS lock_backups (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  branch TEXT NOT NULL,
  file_path TEXT NOT NULL,
  owner_user_id TEXT NOT NULL,
  content TEXT,
  patch TEXT,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS lock_backups_scope_idx
  ON lock_backups (project_id, branch, file_path);

CREATE TABLE IF NOT EXISTS publish_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  branch TEXT NOT NULL,
  user_id TEXT NOT NULL,
  root_map TEXT NOT NULL,
  format TEXT NOT NULL,
  ditaval TEXT,
  title TEXT NOT NULL,
  status TEXT NOT NULL,
  options_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  finished_at INTEGER,
  exit_code INTEGER,
  error TEXT,
  log_path TEXT,
  output_path TEXT,
  artifact_path TEXT,
  artifact_name TEXT,
  artifact_size INTEGER,
  snapshot_path TEXT,
  diagnostics_json TEXT,
  cancel_requested INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS publish_jobs_created_idx ON publish_jobs (created_at);
CREATE INDEX IF NOT EXISTS publish_jobs_project_idx ON publish_jobs (project_id, branch);
`;

/**
 * Adds columns that were introduced after publish_jobs first shipped. CREATE TABLE IF NOT EXISTS
 * cannot evolve an existing table, so upgrades from earlier Phase 5 builds need explicit ALTERs.
 */
function migratePublishJobs(sqlite: Database.Database): void {
  const columns = new Set(
    (sqlite.prepare('PRAGMA table_info(publish_jobs)').all() as Array<{ name: string }>).map(
      (column) => column.name,
    ),
  );
  const additions: Array<{ name: string; ddl: string }> = [
    { name: 'diagnostics_json', ddl: 'diagnostics_json TEXT' },
    {
      name: 'cancel_requested',
      ddl: 'cancel_requested INTEGER NOT NULL DEFAULT 0',
    },
  ];
  for (const addition of additions) {
    if (columns.has(addition.name)) continue;
    sqlite.exec(`ALTER TABLE publish_jobs ADD COLUMN ${addition.ddl}`);
  }
}

/**
 * Opens (and migrates) the local SQLite database. `:memory:` is supported for tests.
 */
export function openDatabase(dbPath: string): DitaDatabaseHandle {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  const sqlite = new Database(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.exec(DDL);
  migratePublishJobs(sqlite);

  const db = drizzle(sqlite, { schema });
  return {
    db,
    close: () => {
      sqlite.close();
    },
  };
}
