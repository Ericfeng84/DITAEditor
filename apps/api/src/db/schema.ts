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
    /**
     * Phase 16: the language this manual's content is authored in (`en`, `zh-CN`, …). Null until
     * a translation link is created or the root map/topic `xml:lang` is inferred lazily.
     */
    sourceLang: text('source_lang'),
  },
  (table) => [
    uniqueIndex('manuals_root_dir_unique').on(table.rootDir),
    index('manuals_archived_opened_idx').on(table.archived, table.lastOpenedAt),
  ],
);

/**
 * Per-manual publishing preferences (Phase 12 HTML5 themes, Phase 15 PDF themes). `manualId`
 * references `manuals.id` and `updatedBy` references `users.id`; the table declares no foreign
 * keys because the rest of this schema keeps relations as plain text columns too. `updatedAt`
 * is an ISO timestamp string rather than the epoch integers used by the older tables.
 *
 * The HTML5 and PDF sides are independent: updating one side never rewrites the other.
 */
export const manualPublishProfiles = sqliteTable('manual_publish_profiles', {
  manualId: text('manual_id').primaryKey(),
  htmlThemeId: text('html_theme_id').notNull().default('tech-docs'),
  htmlThemeOptionsJson: text('html_theme_options_json').notNull().default('{}'),
  pdfThemeId: text('pdf_theme_id').notNull().default('tech-manual'),
  pdfThemeOptionsJson: text('pdf_theme_options_json').notNull().default('{}'),
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
  /** Phase 16: optional dedicated reviewer role overrides (null = inherit primary / env). */
  reviewerBaseUrl: text('reviewer_base_url'),
  reviewerModel: text('reviewer_model'),
  reviewerApiKey: text('reviewer_api_key'),
  reviewerTemperature: real('reviewer_temperature'),
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
      enum: [
        'ask',
        'authoring',
        'optimize_tags',
        'fix_error',
        'ingest_plan',
        'ingest_write',
        'ingest_repair',
        // Phase 16 translation: batched topic translation, single block translation, refine pass.
        'translate_batch',
        'translate_block',
        'translate_refine',
        // Phase 16: independent reviewer AI and targeted repair passes.
        'translate_review',
        'translate_repair',
      ],
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

/**
 * Phase 14 ingest parser configuration — one singleton row (`id = 'default'`). Values chosen
 * here override the `INGEST_*` / `DOCLING_*` / `MARKITDOWN_*` environment fallbacks; an empty
 * column means "keep using the environment / built-in default".
 */
export const ingestParserSettings = sqliteTable('ingest_parser_settings', {
  id: text('id').primaryKey(),
  defaultEngine: text('default_engine', { enum: ['auto', 'docling', 'markitdown'] })
    .notNull()
    .default('auto'),
  preferMarkitdownForOffice: integer('prefer_markitdown_for_office').notNull().default(1),
  doclingMode: text('docling_mode', { enum: ['auto', 'serve', 'cli', 'off'] })
    .notNull()
    .default('auto'),
  doclingServeUrl: text('docling_serve_url'),
  doclingApiKey: text('docling_api_key'),
  doclingCliCommand: text('docling_cli_command').notNull().default('docling'),
  doclingDoOcr: integer('docling_do_ocr').notNull().default(1),
  doclingTableMode: text('docling_table_mode', { enum: ['fast', 'accurate'] })
    .notNull()
    .default('accurate'),
  markitdownEnabled: integer('markitdown_enabled').notNull().default(1),
  markitdownCliCommand: text('markitdown_cli_command').notNull().default('markitdown'),
  markitdownKeepDataUris: integer('markitdown_keep_data_uris').notNull().default(1),
  timeoutMs: integer('timeout_ms').notNull().default(180000),
  maxFileMb: integer('max_file_mb').notNull().default(80),
  updatedBy: text('updated_by').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/**
 * Phase 14 document ingest jobs: one row per uploaded source document, from queued parsing
 * through Planner/Writer completion. Binary assets live on disk (`assetsJson` indexes them);
 * the resulting manual/topic paths are recorded in `resultJson` so a job is fully auditable.
 */
export const ingestJobs = sqliteTable(
  'ingest_jobs',
  {
    id: text('id').primaryKey(),
    targetMode: text('target_mode', {
      enum: ['new_manual', 'single_topic', 'multi_topic'],
    }).notNull(),
    projectId: text('project_id'),
    branch: text('branch'),
    userId: text('user_id').notNull(),
    sourceFilename: text('source_filename').notNull(),
    sourceExt: text('source_ext').notNull(),
    sourceSize: integer('source_size').notNull().default(0),
    requestedEngine: text('requested_engine', { enum: ['auto', 'docling', 'markitdown'] })
      .notNull()
      .default('auto'),
    engineUsed: text('engine_used', {
      enum: ['direct', 'docling-serve', 'docling-cli', 'markitdown-cli'],
    }),
    status: text('status', {
      enum: [
        'queued',
        'parsing',
        'planning',
        'awaiting_plan_approval',
        'writing',
        'validating',
        'repairing',
        'materializing',
        'succeeded',
        'failed',
        'cancelled',
      ],
    }).notNull(),
    autoApprove: integer('auto_approve').notNull().default(0),
    optionsJson: text('options_json').notNull().default('{}'),
    markdownPath: text('markdown_path'),
    assetsJson: text('assets_json'),
    planJson: text('plan_json'),
    progressJson: text('progress_json'),
    validationJson: text('validation_json'),
    resultJson: text('result_json'),    createdManualId: text('created_manual_id'),
    error: text('error'),
    cancelRequested: integer('cancel_requested').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    startedAt: integer('started_at'),
    finishedAt: integer('finished_at'),
  },
  (table) => [
    index('ingest_jobs_created_idx').on(table.createdAt),
    index('ingest_jobs_status_idx').on(table.status, table.createdAt),
    index('ingest_jobs_user_idx').on(table.userId, table.createdAt),
    index('ingest_jobs_project_idx').on(table.projectId, table.branch),
  ],
);

/* -------------------------------------------------------------------------- */
/* Phase 16 — paired-manual translation model (see docs/adr/0005)              */
/* -------------------------------------------------------------------------- */

/**
 * One directed language pair between two independent manuals.
 *
 * Translation metadata lives exclusively in SQLite: no XML attribute, DITA element or Git
 * note is ever written to describe the pairing, so both manuals stay standard DITA 1.3.
 */
export const translationLinks = sqliteTable(
  'translation_links',
  {
    id: text('id').primaryKey(),
    sourceManualId: text('source_manual_id').notNull(),
    sourceBranch: text('source_branch').notNull().default('main'),
    targetManualId: text('target_manual_id').notNull(),
    targetBranch: text('target_branch').notNull().default('main'),
    sourceLang: text('source_lang').notNull(),
    targetLang: text('target_lang').notNull(),
    optionsJson: text('options_json').notNull().default('{}'),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('translation_links_source_lang_unique').on(
      table.sourceManualId,
      table.sourceBranch,
      table.targetLang,
    ),
    uniqueIndex('translation_links_target_unique').on(
      table.targetManualId,
      table.targetBranch,
    ),
    index('translation_links_source_idx').on(table.sourceManualId, table.sourceBranch),
  ],
);

/**
 * Per-file sync watermark for one translation link. `lastSourceTranslatableHash` is the
 * fingerprint of the *translatable* payload only, which is what distinguishes `outdated` from
 * `outdated_metadata_only` (comment / formatting / prolog edits).
 *
 * `lastSourceCommit` is the source commit the stored translation was actually built from (the
 * `S0` seed of the next incremental job), not "whatever the scan last saw": a scan that only
 * *detects* `outdated` content must leave it untouched, or the next plan diffs the new source
 * against itself and silently reuses the stale translation.
 */
export const translationFileStates = sqliteTable(
  'translation_file_states',
  {
    id: text('id').primaryKey(),
    linkId: text('link_id').notNull(),
    sourcePath: text('source_path').notNull(),
    targetPath: text('target_path').notNull(),
    fileKind: text('file_kind', {
      enum: ['topic', 'map', 'keydef_map', 'ditaval', 'asset'],
    }).notNull(),
    status: text('status').notNull(),
    /**
     * Source commit the translation was built from (`S0` of the next incremental job). Written by
     * check-in / `mark-synced` / a scan that finds the pair already in sync — never by a scan that
     * only detects a source change.
     */
    lastSourceCommit: text('last_source_commit'),
    lastSourceBlobHash: text('last_source_blob_hash'),
    lastSourceTranslatableHash: text('last_source_translatable_hash'),
    lastTargetCommit: text('last_target_commit'),
    lastTargetBlobHash: text('last_target_blob_hash'),
    renamedFromPath: text('renamed_from_path'),
    localizedAssetOverride: integer('localized_asset_override').notNull().default(0),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('translation_file_states_link_path_unique').on(table.linkId, table.sourcePath),
    index('translation_file_states_link_status_idx').on(table.linkId, table.status),
  ],
);

/** One incremental or full translation run over a link. */
export const translationJobs = sqliteTable(
  'translation_jobs',
  {
    id: text('id').primaryKey(),
    linkId: text('link_id').notNull(),
    userId: text('user_id').notNull(),
    mode: text('mode', { enum: ['incremental', 'full'] }).notNull(),
    status: text('status', {
      enum: ['queued', 'running', 'completed', 'completed_with_errors', 'failed', 'cancelled'],
    }).notNull(),
    sourceCommit: text('source_commit'),
    totalItems: integer('total_items').notNull().default(0),
    completedItems: integer('completed_items').notNull().default(0),
    failedItems: integer('failed_items').notNull().default(0),
    optionsJson: text('options_json').notNull().default('{}'),
    /** Phase 16: job-level DITA-OT strict validation summary. */
    validationReportJson: text('validation_report_json'),
    cancelRequested: integer('cancel_requested').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    startedAt: integer('started_at'),
    finishedAt: integer('finished_at'),
  },
  (table) => [
    index('translation_jobs_link_created_idx').on(table.linkId, table.createdAt),
    index('translation_jobs_status_created_idx').on(table.status, table.createdAt),
  ],
);

/** One proposed translation for one target file inside a translation job. */
export const translationItems = sqliteTable(
  'translation_items',
  {
    id: text('id').primaryKey(),
    jobId: text('job_id').notNull(),
    linkId: text('link_id').notNull(),
    sourcePath: text('source_path').notNull(),
    targetPath: text('target_path').notNull(),
    status: text('status', {
      enum: [
        'queued',
        'ai_translating',
        'ai_reviewing',
        'validating',
        'ready_for_review',
        'in_review',
        'approved_draft',
        'checked_in',
        'failed',
        'cancelled',
      ],
    }).notNull(),
    modeUsed: text('mode_used'),
    sourceCommit: text('source_commit'),
    prevSourceCommit: text('prev_source_commit'),
    reviewerId: text('reviewer_id'),
    proposedXml: text('proposed_xml'),
    segmentsJson: text('segments_json'),
    qaReportJson: text('qa_report_json'),
    /** Phase 16: independent reviewer AI verdict + job-level DITA-OT report. */
    aiReviewJson: text('ai_review_json'),
    ditaOtReportJson: text('dita_ot_report_json'),
    reusedSegments: integer('reused_segments').notNull().default(0),
    translatedSegments: integer('translated_segments').notNull().default(0),
    retryCount: integer('retry_count').notNull().default(0),
    error: text('error'),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('translation_items_job_status_idx').on(table.jobId, table.status),
    index('translation_items_link_source_idx').on(table.linkId, table.sourcePath),
    index('translation_items_reviewer_idx').on(table.reviewerId, table.status),
  ],
);

/** A glossary container: company-wide (`global`) or scoped to one manual. */
export const glossaries = sqliteTable(
  'glossaries',
  {
    id: text('id').primaryKey(),
    scope: text('scope', { enum: ['global', 'manual'] }).notNull(),
    manualId: text('manual_id'),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    sourceLang: text('source_lang').notNull(),
    enabled: integer('enabled').notNull().default(1),
    createdBy: text('created_by').notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('glossaries_scope_enabled_idx').on(table.scope, table.manualId, table.enabled),
  ],
);

/** One source-language term (plus synonyms) inside a glossary. */
export const glossaryTerms = sqliteTable(
  'glossary_terms',
  {
    id: text('id').primaryKey(),
    glossaryId: text('glossary_id').notNull(),
    sourceTerm: text('source_term').notNull(),
    synonymsJson: text('synonyms_json').notNull().default('[]'),
    caseSensitive: integer('case_sensitive').notNull().default(0),
    doNotTranslate: integer('do_not_translate').notNull().default(0),
    partOfSpeech: text('part_of_speech'),
    contextNote: text('context_note'),
    status: text('status', { enum: ['approved', 'draft', 'deprecated'] })
      .notNull()
      .default('approved'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('glossary_terms_glossary_term_unique').on(table.glossaryId, table.sourceTerm),
    index('glossary_terms_glossary_status_idx').on(table.glossaryId, table.status),
  ],
);

/** The approved rendering of one term in one target language. */
export const glossaryTranslations = sqliteTable(
  'glossary_translations',
  {
    id: text('id').primaryKey(),
    termId: text('term_id').notNull(),
    targetLang: text('target_lang').notNull(),
    targetTerm: text('target_term').notNull(),
    forbiddenTargetsJson: text('forbidden_targets_json').notNull().default('[]'),
    notes: text('notes'),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('glossary_translations_term_lang_unique').on(table.termId, table.targetLang),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type TranslationLinkRow = typeof translationLinks.$inferSelect;
export type TranslationFileStateRow = typeof translationFileStates.$inferSelect;
export type TranslationJobRow = typeof translationJobs.$inferSelect;
export type TranslationItemRow = typeof translationItems.$inferSelect;
export type GlossaryRow = typeof glossaries.$inferSelect;
export type GlossaryTermRow = typeof glossaryTerms.$inferSelect;
export type GlossaryTranslationRow = typeof glossaryTranslations.$inferSelect;
export type FileLockRow = typeof fileLocks.$inferSelect;
export type LockBackupRow = typeof lockBackups.$inferSelect;
export type PublishJobRow = typeof publishJobs.$inferSelect;
export type AiSettingsRow = typeof aiSettings.$inferSelect;
export type AiUsageLogRow = typeof aiUsageLogs.$inferSelect;
export type IngestParserSettingsRow = typeof ingestParserSettings.$inferSelect;
export type IngestJobRow = typeof ingestJobs.$inferSelect;
/**
 * `protectedBranchesJson` and `sourceLang` are optional on the select type: rows inserted through
 * Drizzle get the SQL default `["main"]` / `NULL`, and callers that construct a row literal (the
 * manual registry) must not have to repeat them. Runtime reads always see a value.
 */
export type ManualRow = Omit<
  typeof manuals.$inferSelect,
  'protectedBranchesJson' | 'sourceLang'
> & {
  protectedBranchesJson?: string;
  /** Phase 16: authored language of the manual, `null` until translated/linked or inferred. */
  sourceLang?: string | null;
};
export type TopicAssignmentRow = typeof topicAssignments.$inferSelect;
export type ManualPublishProfileRow = typeof manualPublishProfiles.$inferSelect;
export type WorkingDraftRow = typeof workingDrafts.$inferSelect;
export type VersionAuditLogRow = typeof versionAuditLogs.$inferSelect;
