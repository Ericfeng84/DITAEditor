import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Lightweight identities: no passwords, just local role switching for a small team.
 * Roles: admin (full control), writer (check-out / commit), viewer (read-only).
 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull(),
  role: text('role', { enum: ['admin', 'writer', 'viewer'] }).notNull(),
  email: text('email').notNull(),
  color: text('color').notNull(),
  createdAt: integer('created_at').notNull(),
});

/** Local Git repositories bound to a workspace root. */
export const repositories = sqliteTable(
  'repositories',
  {
    id: text('id').primaryKey(),
    rootDir: text('root_dir').notNull(),
    name: text('name').notNull(),
    createdAt: integer('created_at').notNull(),
    initializedAt: integer('initialized_at'),
  },
  (table) => [uniqueIndex('repositories_root_dir_unique').on(table.rootDir)],
);

/** Exclusive check-out locks scoped by project + branch + file path. */
export const fileLocks = sqliteTable(
  'file_locks',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull(),
    branch: text('branch').notNull(),
    filePath: text('file_path').notNull(),
    userId: text('user_id').notNull(),
    lockedAt: integer('locked_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('file_locks_scope_unique').on(table.projectId, table.branch, table.filePath),
    index('file_locks_scope_idx').on(table.projectId, table.branch),
  ],
);

/** Patch/content backups captured by admin force-unlock. */
export const lockBackups = sqliteTable(
  'lock_backups',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull(),
    branch: text('branch').notNull(),
    filePath: text('file_path').notNull(),
    ownerUserId: text('owner_user_id').notNull(),
    content: text('content'),
    patch: text('patch'),
    reason: text('reason').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [index('lock_backups_scope_idx').on(table.projectId, table.branch, table.filePath)],
);

/** Asynchronous DITA-OT publishing jobs (Phase 5). */
export const publishJobs = sqliteTable(
  'publish_jobs',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull(),
    branch: text('branch').notNull(),
    userId: text('user_id').notNull(),
    rootMap: text('root_map').notNull(),
    format: text('format', { enum: ['html5', 'pdf'] }).notNull(),
    ditaval: text('ditaval'),
    title: text('title').notNull(),
    status: text('status', {
      enum: ['queued', 'running', 'succeeded', 'failed', 'cancelled'],
    }).notNull(),
    optionsJson: text('options_json').notNull(),
    createdAt: integer('created_at').notNull(),
    startedAt: integer('started_at'),
    finishedAt: integer('finished_at'),
    exitCode: integer('exit_code'),
    error: text('error'),
    logPath: text('log_path'),
    outputPath: text('output_path'),
    artifactPath: text('artifact_path'),
    artifactName: text('artifact_name'),
    artifactSize: integer('artifact_size'),
    snapshotPath: text('snapshot_path'),
    diagnosticsJson: text('diagnostics_json'),
    cancelRequested: integer('cancel_requested').notNull().default(0),
  },
  (table) => [
    index('publish_jobs_created_idx').on(table.createdAt),
    index('publish_jobs_project_idx').on(table.projectId, table.branch),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type FileLockRow = typeof fileLocks.$inferSelect;
export type LockBackupRow = typeof lockBackups.$inferSelect;
export type PublishJobRow = typeof publishJobs.$inferSelect;
