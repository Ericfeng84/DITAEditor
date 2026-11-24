import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ensureInitialWorkspace,
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
