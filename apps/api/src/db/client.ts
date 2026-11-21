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
`;

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

  const db = drizzle(sqlite, { schema });
  return {
    db,
    close: () => {
      sqlite.close();
    },
  };
}
