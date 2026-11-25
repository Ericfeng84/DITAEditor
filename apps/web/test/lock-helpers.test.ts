import { describe, expect, it } from 'vitest';
import { describeLock, resolveFileEditability } from '../src/services/lock-helpers';

const LOCK = {
  filePath: 'topics/intro.dita',
  userId: 'u-writer-lin',
  userName: '林知远',
};

describe('Phase 4 check-out editability projection', () => {
  it('blocks admins on another writer\'s lock and offers a forced unlock instead', () => {
    const result = resolveFileEditability({
      role: 'admin',
      userId: 'u-admin',
      filePath: 'topics/intro.dita',
      locks: [LOCK],
    });
    // Phase 13: an admin may not overwrite somebody else's check-out silently.
    expect(result.editable).toBe(false);
    expect(result.state).toBe('locked-by-other');
    expect(result.canForceUnlock).toBe(true);
    expect(result.reason).toContain('林知远');
  });

  it('lets admins edit files nobody checked out', () => {
    const result = resolveFileEditability({
      role: 'admin',
      userId: 'u-admin',
      filePath: 'topics/intro.dita',
      locks: [],
    });
    expect(result.editable).toBe(true);
    expect(result.state).toBe('admin');
    expect(result.canForceUnlock).toBe(false);
  });

  it('keeps viewers read-only even when the file is unlocked', () => {
    const result = resolveFileEditability({
      role: 'viewer',
      userId: 'u-viewer-zhou',
      filePath: 'topics/intro.dita',
      locks: [],
    });
    expect(result.editable).toBe(false);
    expect(result.state).toBe('viewer');
    expect(result.lock).toBeNull();
  });

  it('requires writers to check out an unlocked file first', () => {
    const result = resolveFileEditability({
      role: 'writer',
      userId: 'u-writer-chen',
      filePath: 'topics/intro.dita',
      locks: [],
    });
    expect(result.editable).toBe(false);
    expect(result.state).toBe('unlocked');
    expect(result.reason).toContain('检出');
  });

  it('unlocks editing for the writer who owns the lock', () => {
    const result = resolveFileEditability({
      role: 'writer',
      userId: 'u-writer-lin',
      filePath: 'topics/intro.dita',
      locks: [LOCK],
    });
    expect(result.editable).toBe(true);
    expect(result.state).toBe('owned');
  });

  it('blocks a second writer on the same file, but not on another file', () => {
    const blocked = resolveFileEditability({
      role: 'writer',
      userId: 'u-writer-chen',
      filePath: 'topics/intro.dita',
      locks: [LOCK],
    });
    expect(blocked.editable).toBe(false);
    expect(blocked.state).toBe('locked-by-other');
    expect(blocked.lock?.userName).toBe('林知远');

    const otherFile = resolveFileEditability({
      role: 'writer',
      userId: 'u-writer-chen',
      filePath: 'topics/tasks.dita',
      locks: [LOCK],
    });
    expect(otherFile.state).toBe('unlocked');
    expect(otherFile.lock).toBeNull();
  });

  it('describes the holder relative to the current identity', () => {
    expect(describeLock(LOCK, 'u-writer-lin')).toBe('由你检出');
    expect(describeLock(LOCK, 'u-writer-chen')).toBe('由 林知远 检出');
  });
});
