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

export type UserRow = typeof users.$inferSelect;
export type FileLockRow = typeof fileLocks.$inferSelect;
export type LockBackupRow = typeof lockBackups.$inferSelect;
