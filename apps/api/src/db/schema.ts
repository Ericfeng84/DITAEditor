import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

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

/**
 * Manuals (Phase 10): one manual = one independent workspace directory + Git repository.
 * `id` reuses `repositoryIdFor(realpath(rootDir))` so locks, publish jobs and AI audit rows
 * keep pointing at the same identity without an extra mapping table.
 */
export const manuals = sqliteTable(
  'manuals',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    rootDir: text('root_dir').notNull(),
    defaultRootMap: text('default_root_map'),
    isBuiltin: integer('is_builtin').notNull().default(0),
    archived: integer('archived').notNull().default(0),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    lastOpenedAt: integer('last_opened_at').notNull().default(0),
    /** Phase 13: JSON array of branch names that may not be deleted (default `["main"]`). */
    protectedBranchesJson: text('protected_branches_json').notNull().default('["main"]'),
  },
  (table) => [
    uniqueIndex('manuals_root_dir_unique').on(table.rootDir),
    index('manuals_archived_opened_idx').on(table.archived, table.lastOpenedAt),
  ],
);

/**
 * Per-manual HTML5 theme preferences (Phase 12). `manualId` references `manuals.id` and
 * `updatedBy` references `users.id`; the table declares no foreign keys because the rest of
 * this schema keeps relations as plain text columns too. `updatedAt` is an ISO timestamp
 * string rather than the epoch integers used by the older tables.
 */
export const manualPublishProfiles = sqliteTable('manual_publish_profiles', {
  manualId: text('manual_id').primaryKey(),
  htmlThemeId: text('html_theme_id').notNull().default('tech-docs'),
  htmlThemeOptionsJson: text('html_theme_options_json').notNull().default('{}'),
  updatedBy: text('updated_by'),
  updatedAt: text('updated_at').notNull(),
});

/**
 * Topic editing assignments (Phase 10). Soft collaboration metadata only: nothing is ever
 * written into DITA XML or Git. The partial unique index keeps at most one active
 * (`pending` / `in_progress`) assignment per (manual, branch, topic).
 */
export const topicAssignments = sqliteTable(
  'topic_assignments',
  {
    id: text('id').primaryKey(),
    manualId: text('manual_id').notNull(),
    branch: text('branch').notNull(),
    topicPath: text('topic_path').notNull(),
    assigneeId: text('assignee_id').notNull(),
    assignerId: text('assigner_id').notNull(),
    status: text('status', {
      enum: ['pending', 'in_progress', 'done', 'cancelled'],
    }).notNull(),
    note: text('note').notNull().default(''),
    dueDate: text('due_date'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    completedAt: integer('completed_at'),
  },
  (table) => [
    index('topic_assignments_assignee_idx').on(table.assigneeId, table.status, table.updatedAt),
    index('topic_assignments_assigner_idx').on(table.assignerId, table.status, table.updatedAt),
    index('topic_assignments_manual_branch_idx').on(table.manualId, table.branch, table.status),
  ],
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

/**
 * Phase 13 personal draft overlay: uncommitted per-user file changes that never touch the
 * shared branch `workDir` (which stays clean at Git `HEAD`). Ownership is enforced by
 * `file_locks`; text content lives in `content`, binary draft assets live outside the repo
 * under `draftAssetsRootDir` and are referenced by `assetBlobPath`.
 */
export const workingDrafts = sqliteTable(
  'working_drafts',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull(),
    branch: text('branch').notNull(),
    /** Target POSIX path after the draft operation. */
    filePath: text('file_path').notNull(),
    userId: text('user_id').notNull(),
    op: text('op', { enum: ['edit', 'create', 'delete', 'rename'] }).notNull(),
    /** Baseline original path; only set for `op = 'rename'`. */
    originalPath: text('original_path'),
    /** UTF-8 text content; `NULL` for deletes and binary drafts. */
    content: text('content'),
    /** Binary draft blob path relative to `draftAssetsRootDir`; `NULL` for text drafts. */
    assetBlobPath: text('asset_blob_path'),
    /** Baseline HEAD SHA when the draft was created. */
    baseCommit: text('base_commit'),
    /** `sha256(content)` first 16 hex chars, for optimistic concurrency checks. */
    contentHash: text('content_hash'),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('working_drafts_scope_unique').on(table.projectId, table.branch, table.filePath),
    index('working_drafts_user_idx').on(table.projectId, table.branch, table.userId),
  ],
);

/** Phase 13 version audit ledger: who performed which version action, on which path. */
export const versionAuditLogs = sqliteTable(
  'version_audit_logs',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull(),
    branch: text('branch').notNull(),
    actorId: text('actor_id').notNull(),
    action: text('action', {
      enum: [
        'checkout',
        'release',
        'handoff',
        'cancel',
        'force_unlock',
        'checkin',
        'branch_create',
        'branch_delete',
        'tag_create',
        'tag_delete',
        'merge',
        'restore',
        'revert',
        'publish',
      ],
    }).notNull(),
    targetPath: text('target_path'),
    detailsJson: text('details_json').notNull().default('{}'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('version_audit_project_time_idx').on(table.projectId, table.createdAt),
    index('version_audit_branch_idx').on(table.projectId, table.branch, table.createdAt),
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
    /** Phase 13 publish traceability: `baseline` | `tag` | `commit` | `my_drafts`. */
    sourceMode: text('source_mode', { enum: ['baseline', 'tag', 'commit', 'my_drafts'] })
      .notNull()
      .default('baseline'),
    sourceRef: text('source_ref'),
    commitHash: text('commit_hash'),
    isDirty: integer('is_dirty').notNull().default(0),
    dirtyFilesJson: text('dirty_files_json'),
  },
  (table) => [
    index('publish_jobs_created_idx').on(table.createdAt),
    index('publish_jobs_project_idx').on(table.projectId, table.branch),
  ],
);

/** AI provider configuration — one singleton row (`id = 'default'`). */
export const aiSettings = sqliteTable('ai_settings', {
  id: text('id').primaryKey(),
  baseUrl: text('base_url').notNull(),
  model: text('model').notNull(),
  apiKey: text('api_key'),
  temperature: real('temperature').notNull().default(0.2),
  maxRetries: integer('max_retries').notNull().default(2),
  timeoutMs: integer('timeout_ms').notNull().default(45000),
  updatedBy: text('updated_by').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/** AI call audit ledger. Document content is never stored here. */
export const aiUsageLogs = sqliteTable(
  'ai_usage_logs',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id').notNull(),
    branch: text('branch').notNull(),
    userId: text('user_id').notNull(),
    userDisplayName: text('user_display_name').notNull(),
    taskType: text('task_type', {
      enum: ['ask', 'authoring', 'optimize_tags', 'fix_error'],
    }).notNull(),
    subAction: text('sub_action').notNull(),
    filePath: text('file_path'),
    model: text('model').notNull(),
    status: text('status', { enum: ['succeeded', 'failed', 'cancelled'] }).notNull(),
    retryCount: integer('retry_count').notNull().default(0),
    promptTokens: integer('prompt_tokens').notNull().default(0),
    completionTokens: integer('completion_tokens').notNull().default(0),
    totalTokens: integer('total_tokens').notNull().default(0),
    durationMs: integer('duration_ms').notNull().default(0),
    errorMessage: text('error_message'),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('ai_usage_created_idx').on(table.createdAt),
    index('ai_usage_project_idx').on(table.projectId, table.branch),
    index('ai_usage_task_idx').on(table.taskType),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type FileLockRow = typeof fileLocks.$inferSelect;
export type LockBackupRow = typeof lockBackups.$inferSelect;
export type PublishJobRow = typeof publishJobs.$inferSelect;
export type AiSettingsRow = typeof aiSettings.$inferSelect;
export type AiUsageLogRow = typeof aiUsageLogs.$inferSelect;
/**
 * `protectedBranchesJson` is optional on the select type: rows inserted through Drizzle
 * get the SQL default `["main"]`, and callers that construct a row literal (the manual
 * registry) must not have to repeat it. Runtime reads always see a value.
 */
export type ManualRow = Omit<typeof manuals.$inferSelect, 'protectedBranchesJson'> & {
  protectedBranchesJson?: string;
};
export type TopicAssignmentRow = typeof topicAssignments.$inferSelect;
export type ManualPublishProfileRow = typeof manualPublishProfiles.$inferSelect;
export type WorkingDraftRow = typeof workingDrafts.$inferSelect;
export type VersionAuditLogRow = typeof versionAuditLogs.$inferSelect;
