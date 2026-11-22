import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { extractTargetFragment, normalizeLocale } from '@dita/core';
import { buildAiMessages } from '../src/modules/ai/ai-prompt.js';
import { createServer } from '../src/index.js';
import { httpError, localizeErrorMessage } from '../src/modules/errors.js';
import { apiT } from '../src/i18n/messages.js';

const tempDirs: string[] = [];
const WRITER_A = { 'x-dita-user-id': 'u-writer-lin' };
const WRITER_B = { 'x-dita-user-id': 'u-writer-chen' };
const SAMPLE_ROOT = path.resolve(__dirname, '../../../samples/demo-dita-project');
const FILE_A = 'concepts/single-sourcing.dita';

function createFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'dita-phase8-'));
  tempDirs.push(root);
  const projectDir = path.join(root, 'project');
  cpSync(SAMPLE_ROOT, projectDir, { recursive: true });
  rmSync(path.join(projectDir, '.git'), { recursive: true, force: true });
  rmSync(path.join(projectDir, '.gitignore'), { force: true });
  return {
    projectDir,
    importsDir: path.join(root, 'imports'),
    dbPath: path.join(root, 'phase8.sqlite'),
    worktreesRootDir: path.join(root, 'worktrees'),
  };
}

function createApp(fixture: ReturnType<typeof createFixture>) {
  return createServer({
    workspaceDir: fixture.projectDir,
    importsRootDir: fixture.importsDir,
    dbPath: fixture.dbPath,
    worktreesRootDir: fixture.worktreesRootDir,
    logger: false,
  });
}

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true });
  }
});

describe('Phase 8 request locale resolution', () => {
  it('normalizes UI locales and falls back to zh-CN', () => {
    expect(normalizeLocale('en')).toBe('en');
    expect(normalizeLocale('en-US')).toBe('en');
    expect(normalizeLocale('zh')).toBe('zh-CN');
    expect(normalizeLocale('zh-Hans-CN')).toBe('zh-CN');
    expect(normalizeLocale('fr-FR')).toBe('zh-CN');
    expect(normalizeLocale(undefined)).toBe('zh-CN');
  });

  it('localizes an HttpError through its i18n key', () => {
    expect(apiT('en', 'validate.pathOutside', { path: '/tmp/x' })).toBe(
      'The validation path is outside the workspace: /tmp/x',
    );
    const error = new Error('校验路径超出工作区：/tmp/x');
    expect(localizeErrorMessage(error, 'zh-CN')).toBe('校验路径超出工作区：/tmp/x');
    expect(localizeErrorMessage(error, 'en')).toBe('校验路径超出工作区：/tmp/x');
    expect(
      localizeErrorMessage(
        httpError(400, 'validate.pathOutside', { path: '/tmp/x' }),
        'en',
      ),
    ).toBe('The validation path is outside the workspace: /tmp/x');
  });
});

describe('Phase 8 API responses follow x-dita-locale', () => {
  it('serves identity role labels in the requested language', async () => {
    const app = createApp(createFixture());
    await app.ready();
    try {
      const zh = await app.inject({ method: 'GET', url: '/api/identity' });
      expect(zh.statusCode).toBe(200);
      const zhRoles = zh.json().roles as { label: string; description: string }[];
      expect(zhRoles.map((role) => role.label)).toEqual(['管理员', '作者', '审阅者']);

      const en = await app.inject({
        method: 'GET',
        url: '/api/identity',
        headers: { 'x-dita-locale': 'en' },
      });
      expect(en.statusCode).toBe(200);
      const enRoles = en.json().roles as { label: string; description: string }[];
      expect(enRoles.map((role) => role.label)).toEqual(['Admin', 'Writer', 'Viewer']);
      expect(enRoles[0]?.description).toContain('Full access');
    } finally {
      await app.close();
    }
  });

  it('honours Accept-Language when no x-dita-locale header is sent', async () => {
    const app = createApp(createFixture());
    await app.ready();
    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/identity',
        headers: { 'accept-language': 'en-GB,en;q=0.9' },
      });
      const roles = response.json().roles as { label: string }[];
      expect(roles[0]?.label).toBe('Admin');

      const explicitZhWins = await app.inject({
        method: 'GET',
        url: '/api/identity',
        headers: { 'accept-language': 'en-GB', 'x-dita-locale': 'zh-CN' },
      });
      expect((explicitZhWins.json().roles as { label: string }[])[0]?.label).toBe('管理员');
    } finally {
      await app.close();
    }
  });

  it('localizes lock conflicts and validation errors', async () => {
    const fixture = createFixture();
    const app = createApp(fixture);
    await app.ready();
    try {
      const checkout = await app.inject({
        method: 'POST',
        url: '/api/locks/checkout',
        headers: WRITER_A,
        payload: { path: FILE_A },
      });
      expect(checkout.statusCode).toBe(200);

      const conflictZh = await app.inject({
        method: 'POST',
        url: '/api/locks/checkout',
        headers: WRITER_B,
        payload: { path: FILE_A },
      });
      expect(conflictZh.statusCode).toBeGreaterThanOrEqual(400);
      expect(conflictZh.json().error).toContain('文件已被');

      const conflictEn = await app.inject({
        method: 'POST',
        url: '/api/locks/checkout',
        headers: { ...WRITER_B, 'x-dita-locale': 'en' },
        payload: { path: FILE_A },
      });
      expect(conflictEn.statusCode).toBe(conflictZh.statusCode);
      expect(conflictEn.json().error).toContain('The file is already checked out by');
      expect(conflictEn.json().error).toContain('林知远');

      const outsideEn = await app.inject({
        method: 'POST',
        url: '/api/validate/strict',
        headers: { ...WRITER_A, 'x-dita-locale': 'en' },
        payload: { path: '../../etc/passwd' },
      });
      expect(outsideEn.statusCode).toBe(200);
      expect(outsideEn.json().message).toContain('outside the workspace');

      const outsideZh = await app.inject({
        method: 'POST',
        url: '/api/validate/strict',
        headers: WRITER_A,
        payload: { path: '../../etc/passwd' },
      });
      expect(outsideZh.json().message).toContain('超出工作区');
    } finally {
      await app.close();
    }
  });

  it('localizes the AI not-configured guard', async () => {
    const app = createApp(createFixture());
    await app.ready();
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/ai/stream',
        headers: { ...WRITER_A, 'x-dita-locale': 'en' },
        payload: {
          projectPath: FILE_A,
          taskType: 'ask',
          target: { mode: 'full-document' },
          instruction: 'Tighten the wording.',
        },
      });
      expect(response.statusCode).toBe(400);
      expect(response.json().error).toContain('AI has no API key');

      const zh = await app.inject({
        method: 'POST',
        url: '/api/ai/stream',
        headers: WRITER_A,
        payload: {
          projectPath: FILE_A,
          taskType: 'ask',
          target: { mode: 'full-document' },
          instruction: '请润色文案。',
        },
      });
      expect(zh.json().error).toContain('AI 未配置 API Key');
    } finally {
      await app.close();
    }
  });
});

describe('AI prompt locale', () => {
  const TOPIC = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">
<concept id="probe" xml:lang="zh-CN"><title>探针</title><conbody><p>正文。</p></conbody></concept>
`;

  function prompts(locale: 'zh-CN' | 'en'): { system: string; human: string } {
    const extraction = extractTargetFragment(TOPIC, { mode: 'full-document' }, { locale });
    const messages = buildAiMessages({
      taskType: 'ask',
      instruction: 'Where is single-sourcing enforced?',
      projectPath: 'concepts/probe.dita',
      rootMapPath: null,
      ditavalPath: null,
      extraction,
      includeProjectContext: false,
      locale,
    });
    return {
      system: String(messages[0]?.content ?? ''),
      human: messages.map((message) => String(message.content ?? '')).join('\n'),
    };
  }

  it('demands an English explanation while keeping the Chinese document untouched', () => {
    const { system, human } = prompts('en');
    expect(system).toContain('Explain in English');
    expect(system).toContain('Answer in English');
    expect(system).not.toMatch(/[\u3400-\u9fff]/);
    // The document body keeps its own xml:lang; only the explanation language follows the UI.
    expect(human).toContain('xml:lang="zh-CN"');
  });

  it('keeps the Chinese prompt when the UI locale is zh-CN', () => {
    const { system } = prompts('zh-CN');
    expect(system).toContain('回答使用中文');
    expect(system).not.toContain('Answer in English');
  });
});
