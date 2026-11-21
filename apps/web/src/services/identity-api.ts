/**
 * Lightweight, password-less identity state for the workbench.
 *
 * The selected user id is sent as `x-dita-user-id` on every API request. The backend
 * treats it as a display identity only (not an authentication boundary) and falls back
 * to the seeded administrator when the header is missing.
 */
export type IdentityRole = 'admin' | 'writer' | 'viewer';

export interface IdentityUser {
  id: string;
  displayName: string;
  initials: string;
  email: string;
  color: string;
  role: IdentityRole;
}

export interface IdentityRoleInfo {
  id: IdentityRole;
  label: string;
  description: string;
}

export interface IdentityResponse {
  users: IdentityUser[];
  currentUser: IdentityUser;
  roles: IdentityRoleInfo[];
}

export const CURRENT_USER_STORAGE_KEY = 'dita.currentUserId';

export function getCurrentUserId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(CURRENT_USER_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setCurrentUserId(userId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, userId);
  } catch {
    // Privacy modes may reject storage; the in-memory store still tracks the identity.
  }
}

export const ROLE_LABELS: Record<IdentityRole, string> = {
  admin: '管理员',
  writer: '写作',
  viewer: '只读',
};
