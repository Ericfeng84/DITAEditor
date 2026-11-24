/**
 * Phase 10 — topic assignment client (委派 / Assignment).
 *
 * Assignments are soft: they never lock a topic and never touch the DITA XML. They only
 * add an intent layer on top of check-out/check-in.
 */
import { requestJson } from './workspace-api.js';

export type AssignmentStatus = 'pending' | 'in_progress' | 'done' | 'cancelled';
export type AssignmentStatusFilter = AssignmentStatus | 'active' | 'all';
export type AssignmentScope = 'mine' | 'delegated' | 'all';

export interface AssignmentPerson {
  id: string;
  displayName: string;
  color: string;
  initials: string;
  role: string;
}

export interface Assignment {
  id: string;
  manualId: string;
  manualName: string;
  branch: string;
  topicPath: string;
  topicTitle: string | null;
  topicExists: boolean;
  status: AssignmentStatus;
  note: string;
  dueDate: string | null;
  overdue: boolean;
  assignee: AssignmentPerson | null;
  assigner: AssignmentPerson | null;
  lockOwnerId: string | null;
  lockOwnerName: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface AssignmentSummary {
  myPending: number;
  myInProgress: number;
  myOverdue: number;
  delegatedActive: number;
}

export interface AssignmentListQuery {
  scope?: AssignmentScope;
  status?: AssignmentStatusFilter;
  manualId?: string;
  branch?: string;
  topicPath?: string;
}

export interface AssignmentCreateInput {
  manualId?: string;
  branch?: string;
  topicPath: string;
  assigneeId: string;
  note?: string;
  dueDate?: string | null;
}

export interface AssignmentUpdateInput {
  status?: AssignmentStatus;
  assigneeId?: string;
  note?: string;
  dueDate?: string | null;
}

function toQuery(query: AssignmentListQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string' && value.trim()) params.set(key, value);
  }
  const suffix = params.toString();
  return suffix ? `?${suffix}` : '';
}

export function fetchAssignments(query: AssignmentListQuery = {}) {
  return requestJson<{ assignments: Assignment[] }>(`/api/assignments${toQuery(query)}`);
}

export function fetchAssignmentSummary(query: Pick<AssignmentListQuery, 'manualId' | 'branch'> = {}) {
  return requestJson<{ summary: AssignmentSummary }>(
    `/api/assignments/summary${toQuery(query)}`,
  );
}

export function fetchTopicAssignment(manualId: string, branch: string, topicPath: string) {
  const params = new URLSearchParams({ branch, topicPath });
  return requestJson<{ assignment: Assignment | null }>(
    `/api/assignments/manual/${encodeURIComponent(manualId)}/topic?${params.toString()}`,
  );
}

export function createAssignment(input: AssignmentCreateInput) {
  return requestJson<{ assignment: Assignment }>('/api/assignments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function updateAssignment(id: string, patch: AssignmentUpdateInput) {
  return requestJson<{ assignment: Assignment }>(`/api/assignments/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

export function cancelAssignment(id: string) {
  return requestJson<{ assignment: Assignment }>(`/api/assignments/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function deleteAssignment(id: string) {
  return requestJson<{ deleted: string }>(
    `/api/assignments/${encodeURIComponent(id)}?hard=1`,
    { method: 'DELETE' },
  );
}

export function assignmentStatusLabelKey(status: AssignmentStatus) {
  return `assignments.status.${status}` as const;
}
