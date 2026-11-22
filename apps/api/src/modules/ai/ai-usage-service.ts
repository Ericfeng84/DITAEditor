import { randomUUID } from 'node:crypto';
import { and, desc, gte } from 'drizzle-orm';
import type { DitaDatabase } from '../../db/client.js';
import { aiUsageLogs, type AiUsageLogRow } from '../../db/schema.js';
import type {
  AiTaskType,
  AiUsageDayBucket,
  AiUsageLogView,
  AiUsageModelBucket,
  AiUsageSummary,
  AiUsageTaskBucket,
  AiUsageTokenSummary,
  AiUsageTotals,
  AiUsageUserBucket,
} from './types.js';

export type AiUsageStatus = 'succeeded' | 'failed' | 'cancelled';

export interface AiUsageRecordInput {
  projectId: string;
  branch: string;
  userId: string;
  userDisplayName: string;
  taskType: AiTaskType;
  subAction: string;
  filePath: string | null;
  model: string;
  status: AiUsageStatus;
  retryCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  durationMs: number;
  errorMessage?: string | null;
}

export interface AiUsageSummaryOptions {
  days: number;
  limit: number;
}

const MS_PER_DAY = 86_400_000;

function emptyTokens(): AiUsageTokenSummary {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

function addTokens(target: AiUsageTokenSummary, row: AiUsageLogRow): void {
  target.promptTokens += row.promptTokens;
  target.completionTokens += row.completionTokens;
  target.totalTokens += row.totalTokens;
}

function toIso(value: number): string {
  return new Date(value).toISOString();
}

function toDayBucketKey(value: number): string {
  return new Date(value).toISOString().slice(0, 10);
}

function toLogView(row: AiUsageLogRow): AiUsageLogView {
  return {
    id: row.id,
    projectId: row.projectId,
    branch: row.branch,
    userId: row.userId,
    userDisplayName: row.userDisplayName,
    taskType: row.taskType,
    subAction: row.subAction,
    filePath: row.filePath,
    model: row.model,
    status: row.status,
    retryCount: row.retryCount,
    promptTokens: row.promptTokens,
    completionTokens: row.completionTokens,
    totalTokens: row.totalTokens,
    durationMs: row.durationMs,
    errorMessage: row.errorMessage,
    createdAt: toIso(row.createdAt),
  };
}

export class AiUsageService {
  constructor(private readonly db: DitaDatabase) {}

  record(input: AiUsageRecordInput): void {
    this.db
      .insert(aiUsageLogs)
      .values({
        id: randomUUID(),
        projectId: input.projectId,
        branch: input.branch,
        userId: input.userId,
        userDisplayName: input.userDisplayName,
        taskType: input.taskType,
        subAction: input.subAction,
        filePath: input.filePath,
        model: input.model,
        status: input.status,
        retryCount: input.retryCount,
        promptTokens: input.promptTokens,
        completionTokens: input.completionTokens,
        totalTokens: input.totalTokens,
        durationMs: input.durationMs,
        errorMessage: input.errorMessage ?? null,
        createdAt: Date.now(),
      })
      .run();
  }

  summary(options: AiUsageSummaryOptions): AiUsageSummary {
    const since = Date.now() - options.days * MS_PER_DAY;
    const rows = this.db
      .select()
      .from(aiUsageLogs)
      .where(and(gte(aiUsageLogs.createdAt, since)))
      .orderBy(desc(aiUsageLogs.createdAt))
      .all();

    const totals: AiUsageTotals = {
      ...emptyTokens(),
      calls: rows.length,
      succeeded: 0,
      failed: 0,
      cancelled: 0,
      avgDurationMs: 0,
    };
    const days = new Map<string, AiUsageDayBucket>();
    const tasks = new Map<AiTaskType, AiUsageTaskBucket>();
    const users = new Map<string, AiUsageUserBucket>();
    const models = new Map<string, AiUsageModelBucket>();
    let durationSum = 0;

    for (const row of rows) {
      addTokens(totals, row);
      totals[row.status] += 1;
      durationSum += row.durationMs;

      const dayKey = toDayBucketKey(row.createdAt);
      const day = days.get(dayKey) ?? { day: dayKey, calls: 0, ...emptyTokens() };
      day.calls += 1;
      addTokens(day, row);
      days.set(dayKey, day);

      const task = tasks.get(row.taskType) ?? {
        taskType: row.taskType,
        calls: 0,
        ...emptyTokens(),
      };
      task.calls += 1;
      addTokens(task, row);
      tasks.set(row.taskType, task);

      const user = users.get(row.userId) ?? {
        userId: row.userId,
        displayName: row.userDisplayName,
        calls: 0,
        ...emptyTokens(),
      };
      user.calls += 1;
      addTokens(user, row);
      users.set(row.userId, user);

      const model = models.get(row.model) ?? { model: row.model, calls: 0, ...emptyTokens() };
      model.calls += 1;
      addTokens(model, row);
      models.set(row.model, model);
    }

    totals.avgDurationMs = rows.length === 0 ? 0 : Math.round(durationSum / rows.length);

    return {
      days: options.days,
      totals,
      byDay: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)),
      byTask: [...tasks.values()].sort((a, b) => b.calls - a.calls || a.taskType.localeCompare(b.taskType)),
      byUser: [...users.values()].sort(
        (a, b) => b.calls - a.calls || a.displayName.localeCompare(b.displayName),
      ),
      byModel: [...models.values()].sort(
        (a, b) => b.calls - a.calls || a.model.localeCompare(b.model),
      ),
      recent: rows.slice(0, options.limit).map(toLogView),
    };
  }
}
