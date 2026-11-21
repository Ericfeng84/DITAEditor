import type { IdentityRole } from './identity-api.js';

export interface LockLike {
  filePath: string;
  userId: string;
  userName?: string;
}

export interface FileEditability {
  editable: boolean;
  /** Short machine-friendly state used by the UI and tests. */
  state: 'admin' | 'viewer' | 'unlocked' | 'owned' | 'locked-by-other';
  reason: string;
  lock: LockLike | null;
}

export interface ResolveEditabilityInput {
  role: IdentityRole | null | undefined;
  userId: string | null | undefined;
  filePath: string | null | undefined;
  locks: readonly LockLike[];
}

/**
 * Pure client-side projection of the server check-out rules:
 * - admins may always edit and can force-unlock;
 * - viewers are read-only;
 * - writers may only edit files they have checked out.
 */
export function resolveFileEditability({
  role,
  userId,
  filePath,
  locks,
}: ResolveEditabilityInput): FileEditability {
  const lock = filePath ? (locks.find((item) => item.filePath === filePath) ?? null) : null;
  if (role === 'admin') {
    return {
      editable: true,
      state: 'admin',
      reason: lock
        ? `管理员可编辑；该文件当前由 ${lock.userName ?? lock.userId} 检出`
        : '管理员可编辑全部文件',
      lock,
    };
  }
  if (role === 'viewer') {
    return {
      editable: false,
      state: 'viewer',
      reason: '只读身份：可浏览、搜索与查看差异，但不能检出或保存',
      lock,
    };
  }
  if (!filePath) {
    return { editable: false, state: 'unlocked', reason: '打开文件后可检出编辑', lock: null };
  }
  if (!lock) {
    return {
      editable: false,
      state: 'unlocked',
      reason: '文件尚未检出：点击“检出”后才能编辑',
      lock: null,
    };
  }
  if (lock.userId === userId) {
    return {
      editable: true,
      state: 'owned',
      reason: '你已检出该文件，可编辑并提交',
      lock,
    };
  }
  return {
    editable: false,
    state: 'locked-by-other',
    reason: `文件已被 ${lock.userName ?? lock.userId} 检出，无法编辑`,
    lock,
  };
}

export function describeLock(lock: LockLike, currentUserId: string | null): string {
  return lock.userId === currentUserId
    ? '由你检出'
    : `由 ${lock.userName ?? lock.userId} 检出`;
}
