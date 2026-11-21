import { asc, eq } from 'drizzle-orm';
import { users, type UserRow } from '../../db/schema.js';
import type { DitaDatabase } from '../../db/client.js';
import { HttpError } from '../errors.js';

export type UserRole = 'admin' | 'writer' | 'viewer';

export interface IdentityUser {
  id: string;
  displayName: string;
  role: UserRole;
  email: string;
  color: string;
  initials: string;
}

export const DEFAULT_ADMIN_ID = 'u-admin';

interface SeedUser {
  id: string;
  displayName: string;
  role: UserRole;
  email: string;
  color: string;
}

const SEED_USERS: SeedUser[] = [
  {
    id: DEFAULT_ADMIN_ID,
    displayName: '系统管理员',
    role: 'admin',
    email: 'admin@dita.local',
    color: '#4f46e5',
  },
  {
    id: 'u-writer-lin',
    displayName: '林知远',
    role: 'writer',
    email: 'lin@dita.local',
    color: '#0f766e',
  },
  {
    id: 'u-writer-chen',
    displayName: '陈可欣',
    role: 'writer',
    email: 'chen@dita.local',
    color: '#b45309',
  },
  {
    id: 'u-viewer-zhou',
    displayName: '周怀安',
    role: 'viewer',
    email: 'zhou@dita.local',
    color: '#64748b',
  },
];

const ROLE_ORDER: UserRole[] = ['admin', 'writer', 'viewer'];

function toIdentityUser(row: UserRow): IdentityUser {
  return {
    id: row.id,
    displayName: row.displayName,
    role: row.role,
    email: row.email,
    color: row.color,
    initials: row.displayName.slice(0, 1).toUpperCase(),
  };
}

function initialsOf(displayName: string): string {
  return displayName.slice(0, 1).toUpperCase();
}

export class IdentityService {
  constructor(private readonly db: DitaDatabase) {
    this.seed();
  }

  private seed(): void {
    const now = Date.now();
    for (const user of SEED_USERS) {
      this.db
        .insert(users)
        .values({ ...user, createdAt: now })
        .onConflictDoNothing()
        .run();
    }
  }

  list(): IdentityUser[] {
    const rows = this.db.select().from(users).orderBy(asc(users.createdAt)).all();
    return rows.map(toIdentityUser);
  }

  get(userId: string): IdentityUser | undefined {
    const row = this.db.select().from(users).where(eq(users.id, userId)).get();
    return row ? toIdentityUser(row) : undefined;
  }

  /** Missing/unknown identity headers fall back to the seeded admin (local single-team tool). */
  resolve(rawUserId: string | string[] | undefined): IdentityUser {
    const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
    if (userId) {
      const found = this.get(userId);
      if (found) {
        return found;
      }
    }
    const fallback = this.get(DEFAULT_ADMIN_ID);
    if (!fallback) {
      throw new HttpError(500, '身份初始化失败');
    }
    return fallback;
  }

  requireRole(user: IdentityUser, allowed: UserRole[]): void {
    if (!allowed.includes(user.role)) {
      throw new HttpError(403, `当前角色（${user.role}）无权执行此操作`);
    }
  }

  roleRank(role: UserRole): number {
    return ROLE_ORDER.indexOf(role);
  }
}

export { initialsOf };
