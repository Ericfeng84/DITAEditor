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
  /**
   * Phase 13: admins no longer silently overwrite someone else's check-out. Their editing is
   * blocked exactly like a writer's, but the UI keeps the explicit "force unlock" escape hatch.
   */
  canForceUnlock: boolean;
}

export interface ResolveEditabilityInput {
  role: IdentityRole | null | undefined;
  userId: string | null | undefined;
  filePath: string | null | undefined;
  locks: readonly LockLike[];
}

/**
 * Pure client-side projection of the server check-out rules:
 * - admins may edit anything they hold or that is free, but must force-unlock a file locked by
 *   another identity (the API answers `409 locks.heldByOther` for a silent overwrite);
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
  const heldByOther = lock !== null && lock.userId !== userId;
  if (role === 'admin') {
    if (lock && heldByOther) {
      return {
        editable: false,
        state: 'locked-by-other',
        reason: translate(getCurrentLocale(), 'lock.adminHeldByOther', {
          user: lock.userName ?? lock.userId,
        }),
        lock,
        canForceUnlock: true,
      };
    }
    return {
      editable: true,
      state: 'admin',
      reason: translate(getCurrentLocale(), 'lock.adminEditableAll'),
      lock,
      canForceUnlock: false,
    };
  }
  if (role === 'viewer') {
    return {
      editable: false,
      state: 'viewer',
      reason: translate(getCurrentLocale(), 'lock.viewerReadOnly'),
      lock,
      canForceUnlock: false,
    };
  }
  if (!filePath) {
    return {
      editable: false,
      state: 'unlocked',
      reason: translate(getCurrentLocale(), 'lock.openToCheckout'),
      lock: null,
      canForceUnlock: false,
    };
  }
  if (!lock) {
    return {
      editable: false,
      state: 'unlocked',
      reason: translate(getCurrentLocale(), 'lock.notCheckedOut'),
      lock: null,
      canForceUnlock: false,
    };
  }
  if (lock.userId === userId) {
    return {
      editable: true,
      state: 'owned',
      reason: translate(getCurrentLocale(), 'lock.checkedOutByYou'),
      lock,
      canForceUnlock: false,
    };
  }
  return {
    editable: false,
    state: 'locked-by-other',
    reason: translate(getCurrentLocale(), 'lock.checkedOutByOther', { user: lock.userName ?? lock.userId }),
    lock,
    canForceUnlock: false,
  };
}

export function describeLock(lock: LockLike, currentUserId: string | null): string {
  return lock.userId === currentUserId
    ? translate(getCurrentLocale(), 'lock.byYou')
    : translate(getCurrentLocale(), 'lock.byUser', { user: lock.userName ?? lock.userId });
}

export interface CanManageMapKeysInput {
  workspaceMode: 'api' | 'memory';
  role: IdentityRole | null | undefined;
}

/**
 * Key management is a *map* concern, not a topic concern: `createMapKey`, `renameMapKey`,
 * `updateMapKeyValue`, `deleteMapKey` and `upsertMapNodeKeyText` all write the `.ditamap` and
 * check that map out themselves via `ensureMapEditable(mapPath)`. Permission therefore depends
 * only on the workspace mode and the identity role — never on whether the topic tab next to it
 * happens to be checked out by the current user.
 */
export function canManageMapKeys({ workspaceMode, role }: CanManageMapKeysInput): boolean {
  return workspaceMode === 'memory' || role === 'admin' || role === 'writer';
}
