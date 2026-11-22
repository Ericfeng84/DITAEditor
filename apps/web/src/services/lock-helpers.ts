import type { IdentityRole } from './identity-api.js';
import { getCurrentLocale, translate } from '../i18n/index.js';

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
        ? translate(getCurrentLocale(), 'lock.adminEditableLocked', { user: lock.userName ?? lock.userId })
        : translate(getCurrentLocale(), 'lock.adminEditableAll'),
      lock,
    };
  }
  if (role === 'viewer') {
    return {
      editable: false,
      state: 'viewer',
      reason: translate(getCurrentLocale(), 'lock.viewerReadOnly'),
      lock,
    };
  }
  if (!filePath) {
    return { editable: false, state: 'unlocked', reason: translate(getCurrentLocale(), 'lock.openToCheckout'), lock: null };
  }
  if (!lock) {
    return {
      editable: false,
      state: 'unlocked',
      reason: translate(getCurrentLocale(), 'lock.notCheckedOut'),
      lock: null,
    };
  }
  if (lock.userId === userId) {
    return {
      editable: true,
      state: 'owned',
      reason: translate(getCurrentLocale(), 'lock.checkedOutByYou'),
      lock,
    };
  }
  return {
    editable: false,
    state: 'locked-by-other',
    reason: translate(getCurrentLocale(), 'lock.checkedOutByOther', { user: lock.userName ?? lock.userId }),
    lock,
  };
}

export function describeLock(lock: LockLike, currentUserId: string | null): string {
  return lock.userId === currentUserId
    ? translate(getCurrentLocale(), 'lock.byYou')
    : translate(getCurrentLocale(), 'lock.byUser', { user: lock.userName ?? lock.userId });
}
