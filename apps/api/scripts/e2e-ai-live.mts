/**
 * Live Phase 6 end-to-end check against a real OpenAI-compatible endpoint.
 *
 * Usage (from apps/api):
 *   DEEPSEEK_BASE_URL=http://127.0.0.1:3425/v1 \
 *   DEEPSEEK_MODEL=workbuddy/deepseek-v4.1-flash \
 *   DEEPSEEK_API_KEY=magpie \
 *   pnpm exec tsx scripts/e2e-ai-live.mts
 *
 * Boots a throwaway workspace (copy of samples/demo-dita-project), drives the real HTTP API
 * (config test → ask → authoring proposal → patch write → fix_error → usage ledger) and exits
 * non-zero on the first hard failure.
 */
import { spawn } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkXmlWellFormed, extractTargetFragment } from '@dita/core';

const here = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(here, '..');
const repoRoot = path.resolve(apiRoot, '../..');
const PORT = Number(process.env.E2E_PORT ?? 3499);
const BASE = `http://127.0.0.1:${PORT}`;
const TOPIC_PATH = 'concepts/dita-architecture.dita';
const failures: string[] = [];
const startedAt = Date.now();

function log(step: string, detail = ''): void {
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`[${seconds}s] ${step}${detail ? ` — ${detail}` : ''}`);
}

function check(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    log(`PASS ${label}`, detail ?? '');
    return;
  }
  failures.push(label);
  log(`FAIL ${label}`, detail ?? '');
}

interface SseEvent {
  event: string;
  data: Record<string, unknown>;
}

async function readSse(response: Response): Promise<SseEvent[]> {
  const text = await response.text();
  const events: SseEvent[] = [];
  for (const frame of text.split('\n\n')) {
    const lines = frame.split('\n');
    const eventLine = lines.find((line) => line.startsWith('event:'));
    const dataLine = lines.find((line) => line.startsWith('data:'));
    if (!eventLine || !dataLine) continue;
    events.push({
      event: eventLine.slice('event:'.length).trim(),
      data: JSON.parse(dataLine.slice('data:'.length).trim()) as Record<string, unknown>,
    });
  }
  return events;
}

async function streamAi(payload: Record<string, unknown>): Promise<SseEvent[]> {
  const response = await fetch(`${BASE}/api/ai/stream`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`/api/ai/stream ${response.status}: ${await response.text()}`);
  }
  return readSse(response);
}

async function waitForHealth(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const response = await fetch(`${BASE}/health`);
      if (response.ok) return;
    } catch {
      // server not listening yet
    }
    if (Date.now() > deadline) throw new Error('API server did not become healthy in time.');
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

async function main(): Promise<void> {
  const sandbox = await mkdtemp(path.join(tmpdir(), 'dita-ai-e2e-'));
  const workspaceDir = path.join(sandbox, 'workspace');
  await mkdir(workspaceDir, { recursive: true });
  await cp(path.join(repoRoot, 'samples/demo-dita-project'), workspaceDir, { recursive: true });
  log('sandbox', sandbox);

  const serverLog = path.join(sandbox, 'server.log');
  const child = spawn('pnpm', ['exec', 'tsx', 'src/index.ts'], {
    cwd: apiRoot,
    env: {
      ...process.env,
      PORT: String(PORT),
      DITA_WORKSPACE_DIR: workspaceDir,
      DITA_IMPORTS_DIR: path.join(sandbox, 'imports'),
      DITA_WORKSPACES_REGISTRY: path.join(sandbox, 'workspaces.json'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let serverOutput = '';
  child.stdout?.on('data', (chunk: Buffer) => {
    serverOutput += chunk.toString();
  });
  child.stderr?.on('data', (chunk: Buffer) => {
    serverOutput += chunk.toString();
  });

  const shutdown = async (): Promise<void> => {
    child.kill('SIGTERM');
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (!child.killed) child.kill('SIGKILL');
  };

  try {
    await waitForHealth(30_000);
    log('health', BASE);
    log('provider', `${process.env.DEEPSEEK_BASE_URL} · ${process.env.DEEPSEEK_MODEL}`);

    const identity = (await (await fetch(`${BASE}/api/identity`)).json()) as {
      currentUser: { id: string; role: string };
    };
    check(identity.currentUser?.role === 'admin', 'identity resolves admin');

    const tree = (await (await fetch(`${BASE}/api/files/tree`)).json()) as {
      files: Array<{ path: string; children?: Array<{ path: string }> }>;
    };
    const flatPaths: string[] = [];
    const walk = (nodes: Array<{ path: string; children?: Array<{ path: string }> }>): void => {
      for (const node of nodes) {
        flatPaths.push(node.path);
        if (node.children) walk(node.children);
      }
    };
    walk(tree.files);
    check(flatPaths.includes(TOPIC_PATH), 'demo topic exists', `${flatPaths.length} paths`);

    const contentUrl = `${BASE}/api/files/content?path=${encodeURIComponent(TOPIC_PATH)}`;
    const content = (await (await fetch(contentUrl)).json()) as { content: string };
    check(content.content.includes('<concept'), 'topic content readable', `${content.content.length} chars`);

    // 1) Connection test hits the real endpoint with a tiny completion.
    const configTest = (await (
      await fetch(`${BASE}/api/ai/config/test`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
    ).json()) as { ok: boolean; latencyMs: number; model: string; message: string };
    check(configTest.ok, 'POST /api/ai/config/test ok', `${configTest.latencyMs}ms · ${configTest.message}`);

    // 2) Ask mode: explanation only, no proposal.
    const askEvents = await streamAi({
      projectPath: TOPIC_PATH,
      taskType: 'ask',
      instruction: '用一句话说明这个主题讲什么，并指出它属于哪种 DITA 信息类型。',
      target: { mode: 'full-document' },
      includeProjectContext: true,
    });
    const askMeta = askEvents.find((event) => event.event === 'meta');
    const askDone = askEvents.find((event) => event.event === 'done');
    const askText = askEvents
      .filter((event) => event.event === 'delta')
      .map((event) => String(event.data.text ?? ''))
      .join('');
    check(Boolean(askMeta), 'ask: meta event');
    check(askDone?.data.status === 'succeeded', 'ask: done succeeded', String(askDone?.data.status));
    check(askText.trim().length > 0, 'ask: streamed explanation text', `${askText.length} chars`);
    check(
      !askEvents.some((event) => event.event === 'proposal'),
      'ask: no XML proposal emitted',
    );
    check(
      Number((askDone?.data.usage as { totalTokens?: number } | undefined)?.totalTokens ?? 0) > 0,
      'ask: token usage reported',
      JSON.stringify(askDone?.data.usage ?? {}),
    );

    // 3) Authoring mode on one <p>: element path [3,0] (conbody → first p).
    const targetSpec = { mode: 'element' as const, elementPath: [3, 0] };
    const extraction = extractTargetFragment(content.content, targetSpec);
    const originalTarget = extraction.targetXml;
    const authoringEvents = await streamAi({
      projectPath: TOPIC_PATH,
      xml: content.content,
      taskType: 'authoring',
      instruction: '把这一段改写成更简洁的技术说明，保留所有原有语义标签，不要新增事实。',
      target: targetSpec,
      includeProjectContext: true,
    });
    const authoringMeta = authoringEvents.find((event) => event.event === 'meta');
    const proposal = authoringEvents.find((event) => event.event === 'proposal');
    const authoringDone = authoringEvents.find((event) => event.event === 'done');
    check(Boolean(authoringMeta), 'authoring: meta event');
    check(Boolean(proposal), 'authoring: proposal emitted', String(authoringDone?.data.status));

    if (proposal) {
      const data = proposal.data as {
        explanation: string;
        originalXml: string;
        patchedXml: string;
        changesSummary: string[];
        canRevalidateStrict: boolean;
        verification: {
          wellFormed: boolean;
          prosemirrorCompatible: boolean;
          preservedDoctype: boolean;
          retryCount: number;
          warnings: string[];
        };
      };
      const patched = data.patchedXml;
      check(data.originalXml === content.content, 'authoring: originalXml matches buffer');
      check(data.verification.wellFormed, 'authoring: patched XML well-formed');
      check(data.verification.prosemirrorCompatible, 'authoring: patched XML PM-compatible');
      check(data.verification.preservedDoctype, 'authoring: DOCTYPE preserved');
      check(data.explanation.trim().length > 0, 'authoring: explanation text', data.explanation.slice(0, 80));
      check(patched !== content.content, 'authoring: document actually changed');
      check(checkXmlWellFormed(patched).ok, 'authoring: independent well-formed check');
      check(patched.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'authoring: xml declaration kept');
      check(
        patched.includes('<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">'),
        'authoring: DOCTYPE line kept',
      );
      check(patched.includes('<!-- 段落标签与块间加号插入演示 -->'), 'authoring: comments kept');
      const targetStillThere = patched.includes(originalTarget);
      log('authoring: target region untouched', String(targetStillThere));
      log('authoring: retries', String(data.verification.retryCount));
      log('authoring: summary', data.changesSummary.join(' | '));

      // Write it back through the real file API, exactly like applying a proposal in the UI.
      const putResponse = await fetch(contentUrl, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ path: TOPIC_PATH, content: patched }),
      });
      check(putResponse.ok, 'authoring: patched XML saved via PUT /api/files/content');
      const reread = (await (await fetch(contentUrl)).json()) as { content: string };
      check(reread.content === patched, 'authoring: saved bytes round-trip unchanged');
      const onDisk = await readFile(path.join(workspaceDir, TOPIC_PATH), 'utf8');
      check(onDisk === patched, 'authoring: file on disk equals proposal');
    }

    // 3b) Whole-topic authoring, which is what the panel's default scope sends: the model must
    // return a complete root element and the system keeps the XML declaration and DOCTYPE.
    const wholeEvents = await streamAi({
      projectPath: TOPIC_PATH,
      xml: content.content,
      taskType: 'authoring',
      instruction:
        '请把整篇 topic 改写为面向新手的版本：保持 concept 根元素不变，保留所有现有元素与 keyref 用法，' +
        '把 title 改为「DITA 架构（新手版）」，并在 conbody 末尾增加一段简短总结。只输出完整的 concept 元素。',
      target: { mode: 'full-document' },
      includeProjectContext: true,
    });
    const wholeProposal = wholeEvents.find((event) => event.event === 'proposal');
    const wholeError = wholeEvents.find((event) => event.event === 'error');
    const wholeDone = wholeEvents.find((event) => event.event === 'done');
    check(
      Boolean(wholeProposal),
      'whole-topic: proposal emitted',
      String(wholeDone?.data.status ?? (wholeError?.data as { message?: string })?.message ?? ''),
    );
    if (wholeProposal) {
      const data = wholeProposal.data as {
        explanation: string;
        originalXml: string;
        patchedXml: string;
        changesSummary: string[];
        verification: {
          wellFormed: boolean;
          prosemirrorCompatible: boolean;
          preservedDoctype: boolean;
          retryCount: number;
        };
      };
      const patched = data.patchedXml;
      check(data.originalXml === content.content, 'whole-topic: originalXml is the whole buffer');
      check(data.verification.wellFormed, 'whole-topic: patched XML well-formed');
      check(data.verification.prosemirrorCompatible, 'whole-topic: patched XML PM-compatible');
      check(data.verification.preservedDoctype, 'whole-topic: DOCTYPE preserved');
      check(checkXmlWellFormed(patched).ok, 'whole-topic: independent well-formed check');
      check(patched.includes('DITA 架构（新手版）'), 'whole-topic: title rewritten');
      check(patched.trimStart().includes('<concept'), 'whole-topic: root element returned');
      check(patched.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'whole-topic: xml declaration kept');
      log('whole-topic: retries', String(data.verification.retryCount));
      log('whole-topic: summary', data.changesSummary.join(' | '));
    }

    // 4) Fix mode: hand the model a broken buffer and require a well-formed patch.
    const brokenXml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">',
      '<concept id="c1" xml:lang="zh-CN">',
      '  <title>修复演示</title>',
      '  <conbody>',
      '    <p>第一段<ph>缺闭合</p>',
      '    <p>第二段正常。</p>',
      '  </conbody>',
      '</concept>',
    ].join('\n');
    const brokenWellFormed = checkXmlWellFormed(brokenXml).ok;
    check(!brokenWellFormed, 'fix: sample buffer is intentionally malformed');
    const fixEvents = await streamAi({
      projectPath: 'concepts/broken-demo.dita',
      xml: brokenXml,
      taskType: 'fix_error',
      subAction: 'fix_xml',
      instruction: '修复未闭合的 ph 标签，只做最小改动。',
      context: { diagnostics: [{ source: 'xml', message: '标签 ph 未闭合', line: 6 }] },
      target: { mode: 'line-window', line: 6 },
    });
    const fixProposal = fixEvents.find((event) => event.event === 'proposal');
    const fixError = fixEvents.find((event) => event.event === 'error');
    const fixDone = fixEvents.find((event) => event.event === 'done');
    log('fix: outcome', String(fixDone?.data.status));
    if (fixProposal) {
      const patched = String((fixProposal.data as { patchedXml: string }).patchedXml);
      check(checkXmlWellFormed(patched).ok, 'fix: patched XML well-formed');
      check(patched.includes('</ph>'), 'fix: ph tag closed');
    } else {
      log('fix: no proposal', String((fixError?.data as { message?: string })?.message ?? ''));
      check(Boolean(fixError), 'fix: graceful failure path reached');
    }

    // 5) Usage ledger recorded every call.
    const usage = (await (await fetch(`${BASE}/api/ai/usage?days=1`)).json()) as {
      totals: { calls: number; succeeded: number; failed: number; totalTokens: number };
      byTask: Array<{ taskType: string; calls: number }>;
      recent: Array<{ taskType: string; status: string; filePath: string | null }>;
    };
    check(usage.totals.calls >= 3, 'usage: calls recorded', `${usage.totals.calls} calls`);
    check(usage.totals.succeeded >= 2, 'usage: succeeded calls recorded', String(usage.totals.succeeded));
    check(usage.byTask.some((bucket) => bucket.taskType === 'authoring'), 'usage: task buckets');
    check(
      usage.recent.some((row) => row.filePath === TOPIC_PATH),
      'usage: recent rows carry file path',
    );

    // 6) Usage is admin-only.
    const viewerUsage = await fetch(`${BASE}/api/ai/usage?days=1`, {
      headers: { 'x-dita-user-id': 'u-viewer-zhou' },
    });
    check([401, 403].includes(viewerUsage.status), 'usage: non-admin rejected', String(viewerUsage.status));
  } finally {
    await shutdown();
    const tail = serverOutput.trim().split('\n').slice(-25).join('\n');
    if (failures.length > 0) {
      console.error('\n--- server log tail ---\n' + tail + '\n--- end ---');
    }
    // Keep the sandbox for inspection only when something failed.
    if (failures.length === 0) await rm(sandbox, { recursive: true, force: true });
    else console.error(`sandbox kept: ${sandbox}`);
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed:\n- ${failures.join('\n- ')}`);
    process.exitCode = 1;
    return;
  }
  log('ALL CHECKS PASSED', `${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
