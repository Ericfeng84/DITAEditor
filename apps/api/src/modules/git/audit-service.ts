import { randomUUID } from 'node:crypto';
import { and, desc, eq, type SQL } from 'drizzle-orm';
import type { DitaDatabase } from '../../db/client.js';
import { users, versionAuditLogs, type VersionAuditLogRow } from '../../db/schema.js';

/**
 * Phase 13 version audit ledger (`version_audit_logs`).
 *
 * Every lock/version mutation records one append-only row so the workbench can show an
 * honest trail of check-outs, handoffs, check-ins, branch/tag operations, merges and
 * publishes without ever touching DITA XML or Git itself.
 */
export type VersionAuditAction =
  | 'checkout'
  | 'release'
  | 'handoff'
  | 'cancel'
  | 'force_unlock'
  | 'checkin'
  | 'branch_create'
  | 'branch_delete'
  | 'tag_create'
  | 'tag_delete'
  | 'merge'
  | 'restore'
  | 'revert'
  | 'publish';

export interface VersionAuditLogView {
  id: string;
  projectId: string;
  branch: string;
  actorId: string;
  actorName: string;
  actorColor: string;
  action: VersionAuditAction;
  targetPath: string | null;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface VersionAuditRecordInput {
  projectId: string;
  branch: string;
  actorId: string;
  action: VersionAuditAction;
  targetPath?: string | null;
  details?: Record<string, unknown>;
}

export interface VersionAuditListOptions {
  branch?: string;
  action?: string;
  limit?: number;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

function parseDetails(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function toView(
  row: VersionAuditLogRow,
  actor: { displayName: string | null; color: string | null } | null,
): VersionAuditLogView {
  return {
    id: row.id,
    projectId: row.projectId,
    branch: row.branch,
    actorId: row.actorId,
    actorName: actor?.displayName ?? row.actorId,
    actorColor: actor?.color ?? '#64748b',
    action: row.action,
    targetPath: row.targetPath,
    details: parseDetails(row.detailsJson),
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

export class VersionAuditService {
  constructor(private readonly db: DitaDatabase) {}

  record(input: VersionAuditRecordInput): VersionAuditLogView {
    const createdAt = Date.now();
    const row: VersionAuditLogRow = {
      id: randomUUID(),
      projectId: input.projectId,
      branch: input.branch,
      actorId: input.actorId,
      action: input.action,
      targetPath: input.targetPath ?? null,
      detailsJson: JSON.stringify(input.details ?? {}),
      createdAt,
    };
    this.db.insert(versionAuditLogs).values(row).run();
    const actor = this.db
      .select({ displayName: users.displayName, color: users.color })
      .from(users)
      .where(eq(users.id, row.actorId))
      .get();
    return toView(row, actor ?? null);
  }

  list(projectId: string, options: VersionAuditListOptions = {}): VersionAuditLogView[] {
    const filters: SQL[] = [eq(versionAuditLogs.projectId, projectId)];
    if (options.branch) filters.push(eq(versionAuditLogs.branch, options.branch));
    if (options.action) {
      filters.push(eq(versionAuditLogs.action, options.action as VersionAuditAction));
    }
    const requested = options.limit ?? DEFAULT_LIST_LIMIT;
    const limit = Math.min(Math.max(Number.isFinite(requested) ? requested : DEFAULT_LIST_LIMIT, 1), MAX_LIST_LIMIT);
    const rows = this.db
      .select({
        log: versionAuditLogs,
        actorName: users.displayName,
        actorColor: users.color,
      })
      .from(versionAuditLogs)
      .leftJoin(users, eq(users.id, versionAuditLogs.actorId))
      .where(and(...filters))
      .orderBy(desc(versionAuditLogs.createdAt))
      .limit(limit)
      .all();
    return rows.map((entry) =>
      toView(entry.log, {
        displayName: entry.actorName ?? null,
        color: entry.actorColor ?? null,
      }),
    );
  }
}
