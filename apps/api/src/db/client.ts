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
  cancel_requested INTEGER NOT NULL DEFAULT 0,
  source_mode TEXT NOT NULL DEFAULT 'baseline',
  source_ref TEXT,
  commit_hash TEXT,
  is_dirty INTEGER NOT NULL DEFAULT 0,
  dirty_files_json TEXT
);
CREATE INDEX IF NOT EXISTS publish_jobs_created_idx ON publish_jobs (created_at);
CREATE INDEX IF NOT EXISTS publish_jobs_project_idx ON publish_jobs (project_id, branch);

CREATE TABLE IF NOT EXISTS ai_settings (
  id TEXT PRIMARY KEY NOT NULL,
  base_url TEXT NOT NULL,
  model TEXT NOT NULL,
  api_key TEXT,
  temperature REAL NOT NULL DEFAULT 0.2,
  max_retries INTEGER NOT NULL DEFAULT 2,
  timeout_ms INTEGER NOT NULL DEFAULT 45000,
  reviewer_base_url TEXT,
  reviewer_model TEXT,
  reviewer_api_key TEXT,
  reviewer_temperature REAL,
  updated_by TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  branch TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_display_name TEXT NOT NULL,
  task_type TEXT NOT NULL,
  sub_action TEXT NOT NULL,
  file_path TEXT,
  model TEXT NOT NULL,
  status TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ai_usage_created_idx ON ai_usage_logs (created_at);
CREATE INDEX IF NOT EXISTS ai_usage_project_idx ON ai_usage_logs (project_id, branch);
CREATE INDEX IF NOT EXISTS ai_usage_task_idx ON ai_usage_logs (task_type);

CREATE TABLE IF NOT EXISTS manuals (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  root_dir TEXT NOT NULL,
  default_root_map TEXT,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_opened_at INTEGER NOT NULL DEFAULT 0,
  protected_branches_json TEXT NOT NULL DEFAULT '["main"]',
  source_lang TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS manuals_root_dir_unique ON manuals (root_dir);
CREATE INDEX IF NOT EXISTS manuals_archived_opened_idx
  ON manuals (archived, last_opened_at DESC);

CREATE TABLE IF NOT EXISTS topic_assignments (
  id TEXT PRIMARY KEY NOT NULL,
  manual_id TEXT NOT NULL,
  branch TEXT NOT NULL,
  topic_path TEXT NOT NULL,
  assignee_id TEXT NOT NULL,
  assigner_id TEXT NOT NULL,
  status TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  due_date TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS topic_assignments_active_unique
  ON topic_assignments (manual_id, branch, topic_path)
  WHERE status IN ('pending', 'in_progress');
CREATE INDEX IF NOT EXISTS topic_assignments_assignee_idx
  ON topic_assignments (assignee_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS topic_assignments_assigner_idx
  ON topic_assignments (assigner_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS topic_assignments_manual_branch_idx
  ON topic_assignments (manual_id, branch, status);

CREATE TABLE IF NOT EXISTS manual_publish_profiles (
  manual_id TEXT PRIMARY KEY NOT NULL,
  html_theme_id TEXT NOT NULL DEFAULT 'tech-docs',
  html_theme_options_json TEXT NOT NULL DEFAULT '{}',
  pdf_theme_id TEXT NOT NULL DEFAULT 'tech-manual',
  pdf_theme_options_json TEXT NOT NULL DEFAULT '{}',
  updated_by TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS working_drafts (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  branch TEXT NOT NULL,
  file_path TEXT NOT NULL,
  user_id TEXT NOT NULL,
  op TEXT NOT NULL,
  original_path TEXT,
  content TEXT,
  asset_blob_path TEXT,
  base_commit TEXT,
  content_hash TEXT,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS working_drafts_scope_unique
  ON working_drafts (project_id, branch, file_path);
CREATE INDEX IF NOT EXISTS working_drafts_user_idx
  ON working_drafts (project_id, branch, user_id);

CREATE TABLE IF NOT EXISTS version_audit_logs (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL,
  branch TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_path TEXT,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS version_audit_project_time_idx
  ON version_audit_logs (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS version_audit_branch_idx
  ON version_audit_logs (project_id, branch, created_at DESC);

CREATE TABLE IF NOT EXISTS ingest_parser_settings (
  id TEXT PRIMARY KEY NOT NULL,
  default_engine TEXT NOT NULL DEFAULT 'auto',
  prefer_markitdown_for_office INTEGER NOT NULL DEFAULT 1,
  docling_mode TEXT NOT NULL DEFAULT 'auto',
  docling_serve_url TEXT,
  docling_api_key TEXT,
  docling_cli_command TEXT NOT NULL DEFAULT 'docling',
  docling_do_ocr INTEGER NOT NULL DEFAULT 1,
  docling_table_mode TEXT NOT NULL DEFAULT 'accurate',
  markitdown_enabled INTEGER NOT NULL DEFAULT 1,
  markitdown_cli_command TEXT NOT NULL DEFAULT 'markitdown',
  markitdown_keep_data_uris INTEGER NOT NULL DEFAULT 1,
  timeout_ms INTEGER NOT NULL DEFAULT 180000,
  max_file_mb INTEGER NOT NULL DEFAULT 80,
  updated_by TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ingest_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  target_mode TEXT NOT NULL,
  project_id TEXT,
  branch TEXT,
  user_id TEXT NOT NULL,
  source_filename TEXT NOT NULL,
  source_ext TEXT NOT NULL,
  source_size INTEGER NOT NULL DEFAULT 0,
  requested_engine TEXT NOT NULL DEFAULT 'auto',
  engine_used TEXT,
  status TEXT NOT NULL,
  auto_approve INTEGER NOT NULL DEFAULT 0,
  options_json TEXT NOT NULL DEFAULT '{}',
  markdown_path TEXT,
  assets_json TEXT,
  plan_json TEXT,
  progress_json TEXT,
  validation_json TEXT,
  result_json TEXT,
  created_manual_id TEXT,
  error TEXT,
  cancel_requested INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  finished_at INTEGER
);
CREATE INDEX IF NOT EXISTS ingest_jobs_created_idx ON ingest_jobs (created_at DESC);
CREATE INDEX IF NOT EXISTS ingest_jobs_status_idx ON ingest_jobs (status, created_at DESC);
CREATE INDEX IF NOT EXISTS ingest_jobs_user_idx ON ingest_jobs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ingest_jobs_project_idx ON ingest_jobs (project_id, branch);

CREATE TABLE IF NOT EXISTS translation_links (
  id TEXT PRIMARY KEY NOT NULL,
  source_manual_id TEXT NOT NULL,
  source_branch TEXT NOT NULL DEFAULT 'main',
  target_manual_id TEXT NOT NULL,
  target_branch TEXT NOT NULL DEFAULT 'main',
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  options_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS translation_links_source_lang_unique
  ON translation_links (source_manual_id, source_branch, target_lang);
CREATE UNIQUE INDEX IF NOT EXISTS translation_links_target_unique
  ON translation_links (target_manual_id, target_branch);
CREATE INDEX IF NOT EXISTS translation_links_source_idx
  ON translation_links (source_manual_id, source_branch);

CREATE TABLE IF NOT EXISTS translation_file_states (
  id TEXT PRIMARY KEY NOT NULL,
  link_id TEXT NOT NULL,
  source_path TEXT NOT NULL,
  target_path TEXT NOT NULL,
  file_kind TEXT NOT NULL,
  status TEXT NOT NULL,
  last_source_commit TEXT,
  last_source_blob_hash TEXT,
  last_source_translatable_hash TEXT,
  last_target_commit TEXT,
  last_target_blob_hash TEXT,
  renamed_from_path TEXT,
  localized_asset_override INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS translation_file_states_link_path_unique
  ON translation_file_states (link_id, source_path);
CREATE INDEX IF NOT EXISTS translation_file_states_link_status_idx
  ON translation_file_states (link_id, status);

CREATE TABLE IF NOT EXISTS translation_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  link_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  source_commit TEXT,
  total_items INTEGER NOT NULL DEFAULT 0,
  completed_items INTEGER NOT NULL DEFAULT 0,
  failed_items INTEGER NOT NULL DEFAULT 0,
  options_json TEXT NOT NULL DEFAULT '{}',
  validation_report_json TEXT,
  cancel_requested INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  finished_at INTEGER
);
CREATE INDEX IF NOT EXISTS translation_jobs_link_created_idx
  ON translation_jobs (link_id, created_at DESC);
CREATE INDEX IF NOT EXISTS translation_jobs_status_created_idx
  ON translation_jobs (status, created_at DESC);

CREATE TABLE IF NOT EXISTS translation_items (
  id TEXT PRIMARY KEY NOT NULL,
  job_id TEXT NOT NULL,
  link_id TEXT NOT NULL,
  source_path TEXT NOT NULL,
  target_path TEXT NOT NULL,
  status TEXT NOT NULL,
  mode_used TEXT,
  source_commit TEXT,
  prev_source_commit TEXT,
  reviewer_id TEXT,
  proposed_xml TEXT,
  segments_json TEXT,
  qa_report_json TEXT,
  ai_review_json TEXT,
  dita_ot_report_json TEXT,
  reused_segments INTEGER NOT NULL DEFAULT 0,
  translated_segments INTEGER NOT NULL DEFAULT 0,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS translation_items_job_status_idx ON translation_items (job_id, status);
CREATE INDEX IF NOT EXISTS translation_items_link_source_idx
  ON translation_items (link_id, source_path);
CREATE INDEX IF NOT EXISTS translation_items_reviewer_idx ON translation_items (reviewer_id, status);

CREATE TABLE IF NOT EXISTS glossaries (
  id TEXT PRIMARY KEY NOT NULL,
  scope TEXT NOT NULL,
  manual_id TEXT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  source_lang TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS glossaries_scope_enabled_idx
  ON glossaries (scope, manual_id, enabled);

CREATE TABLE IF NOT EXISTS glossary_terms (
  id TEXT PRIMARY KEY NOT NULL,
  glossary_id TEXT NOT NULL,
  source_term TEXT NOT NULL,
  synonyms_json TEXT NOT NULL DEFAULT '[]',
  case_sensitive INTEGER NOT NULL DEFAULT 0,
  do_not_translate INTEGER NOT NULL DEFAULT 0,
  part_of_speech TEXT,
  context_note TEXT,
  status TEXT NOT NULL DEFAULT 'approved',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS glossary_terms_glossary_term_unique
  ON glossary_terms (glossary_id, source_term);
CREATE INDEX IF NOT EXISTS glossary_terms_glossary_status_idx
  ON glossary_terms (glossary_id, status);

CREATE TABLE IF NOT EXISTS glossary_translations (
  id TEXT PRIMARY KEY NOT NULL,
  term_id TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  target_term TEXT NOT NULL,
  forbidden_targets_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS glossary_translations_term_lang_unique
  ON glossary_translations (term_id, target_lang);
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
    { name: 'source_mode', ddl: "source_mode TEXT NOT NULL DEFAULT 'baseline'" },
    { name: 'source_ref', ddl: 'source_ref TEXT' },
    { name: 'commit_hash', ddl: 'commit_hash TEXT' },
    { name: 'is_dirty', ddl: 'is_dirty INTEGER NOT NULL DEFAULT 0' },
    { name: 'dirty_files_json', ddl: 'dirty_files_json TEXT' },
  ];
  for (const addition of additions) {
    if (columns.has(addition.name)) continue;
    sqlite.exec(`ALTER TABLE publish_jobs ADD COLUMN ${addition.ddl}`);
  }
}

/**
 * Phase 13 Stage 3: protected branch policy per manual. Older installations get the
 * default `["main"]` so `main` cannot be deleted by accident. Phase 16 adds the nullable
 * `source_lang` column; both are applied independently so either upgrade order works.
 */
function migrateManuals(sqlite: Database.Database): void {
  const columns = new Set(
    (sqlite.prepare('PRAGMA table_info(manuals)').all() as Array<{ name: string }>).map(
      (column) => column.name,
    ),
  );
  const additions: Array<{ name: string; ddl: string }> = [
    {
      name: 'protected_branches_json',
      ddl: "protected_branches_json TEXT NOT NULL DEFAULT '[\"main\"]'",
    },
    { name: 'source_lang', ddl: 'source_lang TEXT' },
  ];
  for (const addition of additions) {
    if (columns.has(addition.name)) continue;
    sqlite.exec(`ALTER TABLE manuals ADD COLUMN ${addition.ddl}`);
  }
}

/**
 * Phase 15: PDF theme columns on the per-manual publish profile. Installations created before
 * PDF theming shipped only carry the HTML5 columns, so add the PDF pair in place; the defaults
 * (`tech-manual` + `{}`) reproduce the pre-Phase-15 PDF output.
 */
function migrateManualPublishProfiles(sqlite: Database.Database): void {
  const columns = new Set(
    (
      sqlite.prepare('PRAGMA table_info(manual_publish_profiles)').all() as Array<{
        name: string;
      }>
    ).map((column) => column.name),
  );
  const additions: Array<{ name: string; ddl: string }> = [
    { name: 'pdf_theme_id', ddl: "pdf_theme_id TEXT NOT NULL DEFAULT 'tech-manual'" },
    { name: 'pdf_theme_options_json', ddl: "pdf_theme_options_json TEXT NOT NULL DEFAULT '{}'" },
  ];
  for (const addition of additions) {
    if (columns.has(addition.name)) continue;
    sqlite.exec(`ALTER TABLE manual_publish_profiles ADD COLUMN ${addition.ddl}`);
  }
}

/**
 * Phase 16: optional dedicated reviewer AI configuration on the `ai_settings` singleton.
 * Existing installations keep working: every new column is nullable and `null` means
 * "inherit the primary role / env default".
 */
function migrateAiSettings(sqlite: Database.Database): void {
  const columns = new Set(
    (sqlite.prepare('PRAGMA table_info(ai_settings)').all() as Array<{ name: string }>).map(
      (column) => column.name,
    ),
  );
  const additions: Array<{ name: string; ddl: string }> = [
    { name: 'reviewer_base_url', ddl: 'reviewer_base_url TEXT' },
    { name: 'reviewer_model', ddl: 'reviewer_model TEXT' },
    { name: 'reviewer_api_key', ddl: 'reviewer_api_key TEXT' },
    { name: 'reviewer_temperature', ddl: 'reviewer_temperature REAL' },
  ];
  for (const addition of additions) {
    if (columns.has(addition.name)) continue;
    sqlite.exec(`ALTER TABLE ai_settings ADD COLUMN ${addition.ddl}`);
  }
}

/**
 * Phase 16: job-level DITA-OT strict validation summary. Older jobs simply carry no report.
 */
function migrateTranslationJobs(sqlite: Database.Database): void {
  const columns = new Set(
    (sqlite.prepare('PRAGMA table_info(translation_jobs)').all() as Array<{ name: string }>).map(
      (column) => column.name,
    ),
  );
  const additions: Array<{ name: string; ddl: string }> = [
    { name: 'validation_report_json', ddl: 'validation_report_json TEXT' },
  ];
  for (const addition of additions) {
    if (columns.has(addition.name)) continue;
    sqlite.exec(`ALTER TABLE translation_jobs ADD COLUMN ${addition.ddl}`);
  }
}

/**
 * Phase 16: independent reviewer verdict + per-item DITA-OT report. `status` is a plain TEXT
 * column, so the new `ai_reviewing` state needs no ALTER.
 */
function migrateTranslationItems(sqlite: Database.Database): void {
  const columns = new Set(
    (sqlite.prepare('PRAGMA table_info(translation_items)').all() as Array<{ name: string }>).map(
      (column) => column.name,
    ),
  );
  const additions: Array<{ name: string; ddl: string }> = [
    { name: 'ai_review_json', ddl: 'ai_review_json TEXT' },
    { name: 'dita_ot_report_json', ddl: 'dita_ot_report_json TEXT' },
  ];
  for (const addition of additions) {
    if (columns.has(addition.name)) continue;
    sqlite.exec(`ALTER TABLE translation_items ADD COLUMN ${addition.ddl}`);
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
  migrateManuals(sqlite);
  migrateManualPublishProfiles(sqlite);
  migrateAiSettings(sqlite);
  migrateTranslationJobs(sqlite);
  migrateTranslationItems(sqlite);

  const db = drizzle(sqlite, { schema });
  return {
    db,
    close: () => {
      sqlite.close();
    },
  };
}
