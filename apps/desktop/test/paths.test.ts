import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  augmentDesktopPath,
  ensureInitialWorkspace,
  inspectDataDirCandidate,
  normalizeDesktopVersion,
  resolveDesktopPaths,
} from '../src/paths.js';

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe('resolveDesktopPaths', () => {
  it('points packaged assets into resourcesDir and writable state into userDataDir', () => {
    const resolved = resolveDesktopPaths({
      isPackaged: true,
      userDataDir: '/Users/alice/Library/Application Support/DITAEditor',
      resourcesDir: '/Applications/DITAEditor.app/Contents/Resources',
      repoRoot: '/ignored',
    });

    expect(resolved.webDistDir).toBe(
      path.join('/Applications/DITAEditor.app/Contents/Resources', 'web-dist'),
    );
    expect(resolved.pluginDir).toBe(
      path.join(
        '/Applications/DITAEditor.app/Contents/Resources',
        'dita-ot-plugins',
        'com.ditaeditor.pdf-cjk',
      ),
    );
    expect(resolved.htmlThemesDir).toBe(
      path.join('/Applications/DITAEditor.app/Contents/Resources', 'dita-ot-plugins', 'html5-themes'),
    );
    expect(resolved.pdfThemesDir).toBe(
      path.join('/Applications/DITAEditor.app/Contents/Resources', 'dita-ot-plugins', 'pdf-themes'),
    );
    expect(resolved.dbPath).toBe(
      path.join('/Users/alice/Library/Application Support/DITAEditor', 'dita-editor.sqlite'),
    );
    expect(resolved.workspaceDir).toBe(
      path.join('/Users/alice/Library/Application Support/DITAEditor', 'demo-dita-project'),
    );
  });

  it('points dev assets into repoRoot and honours dataDirOverride', () => {
    const resolved = resolveDesktopPaths({
      isPackaged: false,
      userDataDir: '/tmp/default-user-data',
      resourcesDir: '/tmp/resources',
      repoRoot: '/repo/DITAEditor',
      dataDirOverride: '/tmp/custom-data',
    });

    expect(resolved.webDistDir).toBe(path.join('/repo/DITAEditor', 'apps', 'web', 'dist'));
    expect(resolved.sampleTemplateDir).toBe(
      path.join('/repo/DITAEditor', 'samples', 'demo-dita-project'),
    );
    expect(resolved.dataDir).toBe(path.resolve('/tmp/custom-data'));
    expect(resolved.htmlThemesDir).toBe(path.join('/repo/DITAEditor', 'dita-ot-plugins', 'html5-themes'));
    expect(resolved.pdfThemesDir).toBe(path.join('/repo/DITAEditor', 'dita-ot-plugins', 'pdf-themes'));
  });
});

describe('ensureInitialWorkspace', () => {
  it('copies the sample project once and strips .git, without overwriting existing user edits', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'dita-desktop-test-'));
    tempDirs.push(root);
    const templateDir = path.join(root, 'template');
    const targetDir = path.join(root, 'userData', 'demo-dita-project');

    mkdirSync(path.join(templateDir, '.git'), { recursive: true });
    writeFileSync(path.join(templateDir, '.git', 'HEAD'), 'ref: refs/heads/main\n');
    writeFileSync(path.join(templateDir, 'topic.dita'), '<topic id="t1"><title>Init</title></topic>');

    expect(ensureInitialWorkspace(templateDir, targetDir)).toBe(true);
    expect(existsSync(path.join(targetDir, 'topic.dita'))).toBe(true);
    expect(existsSync(path.join(targetDir, '.git'))).toBe(false);

    // Subsequent launches must preserve user edits
    writeFileSync(path.join(targetDir, 'topic.dita'), '<topic id="t1"><title>Edited</title></topic>');
    expect(ensureInitialWorkspace(templateDir, targetDir)).toBe(false);
    expect(readFileSync(path.join(targetDir, 'topic.dita'), 'utf8')).toContain('Edited');
  });
});

describe('normalizeDesktopVersion', () => {
  it('strips leading v and validates semver strings', () => {
    expect(normalizeDesktopVersion('v1.3.0', '1.2.0')).toBe('1.3.0');
    expect(normalizeDesktopVersion('V2.0.0-beta.1', '1.2.0')).toBe('2.0.0-beta.1');
    expect(normalizeDesktopVersion('not-a-version', '1.2.0')).toBe('1.2.0');
    expect(normalizeDesktopVersion(undefined, '1.2.0')).toBe('1.2.0');
  });
});

describe('augmentDesktopPath', () => {
  it('keeps existing PATH entries first and appends missing macOS/Linux tool folders', () => {
    const home = '/Users/alice';
    const augmented = augmentDesktopPath('/usr/bin:/bin', 'darwin', home);
    const segments = augmented.split(':');

    expect(segments.slice(0, 2)).toEqual(['/usr/bin', '/bin']);
    expect(segments).toContain('/opt/homebrew/bin');
    expect(segments).toContain('/opt/homebrew/sbin');
    expect(segments).toContain('/usr/local/bin');
    expect(segments).toContain(path.join(home, '.local', 'bin'));
    expect(segments).toContain(path.join(home, '.cargo', 'bin'));
    // No duplicates, and the caller's ordering is preserved.
    expect(new Set(segments).size).toBe(segments.length);
  });

  it('does not append directories that already exist in PATH', () => {
    const home = '/Users/alice';
    const existing = ['/usr/local/bin', '/opt/homebrew/bin', '/bin'].join(':');
    const segments = augmentDesktopPath(existing, 'darwin', home).split(':');

    expect(segments.slice(0, 3)).toEqual(['/usr/local/bin', '/opt/homebrew/bin', '/bin']);
    expect(segments.filter((entry) => entry === '/usr/local/bin')).toHaveLength(1);
    expect(segments.filter((entry) => entry === '/opt/homebrew/bin')).toHaveLength(1);
  });

  it('adds the Git cmd shim folder on Windows without duplicating existing entries', () => {
    const home = 'C:\\Users\\alice';
    const augmented = augmentDesktopPath(
      'C:\\Windows\\system32;C:\\Users\\alice\\AppData\\Local\\Programs\\Git\\cmd',
      'win32',
      home,
    );
    const segments = augmented.split(';');

    expect(segments[0]).toBe('C:\\Windows\\system32');
    expect(segments).toContain(path.win32.join(home, '.local', 'bin'));
    expect(
      segments.filter((entry) => entry.toLowerCase().endsWith('git\\cmd'.toLowerCase())),
    ).toHaveLength(1);
  });

  it('handles an undefined PATH by returning only the appended folders', () => {
    const segments = augmentDesktopPath(undefined, 'linux', '/home/alice').split(':');
    expect(segments).toEqual([
      '/opt/homebrew/bin',
      '/opt/homebrew/sbin',
      '/usr/local/bin',
      '/home/alice/.local/bin',
      '/home/alice/.cargo/bin',
    ]);
  });
});

describe('inspectDataDirCandidate', () => {
  it('reports a fresh sibling folder as writable and non-conflicting', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'dita-desktop-inspect-'));
    tempDirs.push(root);
    const current = path.join(root, 'current-data');
    const target = path.join(root, 'new-data');
    mkdirSync(current, { recursive: true });

    const inspection = inspectDataDirCandidate(target, current);
    expect(inspection.path).toBe(path.resolve(target));
    expect(inspection.exists).toBe(false);
    expect(inspection.writable).toBe(true);
    expect(inspection.hasExistingData).toBe(false);
    expect(inspection.isSameAsCurrent).toBe(false);
    expect(inspection.isNestedConflict).toBe(false);
    expect(inspection.error).toBeUndefined();
  });

  it('detects the current folder, nested folders and existing data', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'dita-desktop-inspect-'));
    tempDirs.push(root);
    const current = path.join(root, 'current-data');
    mkdirSync(path.join(current, 'workspaces'), { recursive: true });
    writeFileSync(path.join(current, 'dita-editor.sqlite'), '');

    const same = inspectDataDirCandidate(` ${current}/ `, current);
    expect(same.isSameAsCurrent).toBe(true);
    expect(same.hasExistingData).toBe(true);
    expect(same.writable).toBe(true);

    const nested = inspectDataDirCandidate(path.join(current, 'workspaces', 'inner'), current);
    expect(nested.isNestedConflict).toBe(true);
    expect(nested.isSameAsCurrent).toBe(false);

    const parent = inspectDataDirCandidate(root, current);
    expect(parent.isNestedConflict).toBe(true);
  });

  it('rejects a file path and an empty candidate without throwing', () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'dita-desktop-inspect-'));
    tempDirs.push(root);
    const filePath = path.join(root, 'not-a-dir.txt');
    writeFileSync(filePath, 'x');

    const inspection = inspectDataDirCandidate(filePath, root);
    expect(inspection.writable).toBe(false);
    expect(inspection.error).toContain('not a directory');

    const empty = inspectDataDirCandidate('   ', root);
    expect(empty.writable).toBe(false);
    expect(empty.path).toBe('');
    expect(empty.error).toBeDefined();
  });
});
