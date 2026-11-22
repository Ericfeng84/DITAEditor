import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  findElementPathAtOffset,
  getPmNodeTagName,
  xmlToPmDoc,
} from '@dita/core';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { parseAiSseFrame, streamAiRequest } from '../src/ai/ai-api';
import { DiffViewer } from '../src/components/DiffViewer';
import {
  AI_SELECTED_TEXT_LIMIT,
  AI_TARGET_SCOPE_LABELS,
  buildLineWindowAiTarget,
  buildSourceAiTarget,
  buildVisualAiTarget,
  resolveScopeTarget,
} from '../src/ai/ai-target';
import { resetAiStore, useAiStore } from '../src/ai/ai-store';
import { translate } from '../src/i18n/messages/index.js';
import type { AiProposal, AiStreamRequest } from '../src/ai/ai-types';
import {
  resolveAiApplyMode,
  useEditorStore,
  type OpenEditorTab,
} from '../src/store/editor-store';

vi.mock('../src/ai/ai-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/ai/ai-api')>();
  return { ...actual, streamAiRequest: vi.fn(actual.streamAiRequest) };
});

const TOPIC_XML = `<?xml version="1.0" encoding="UTF-8"?>
<topic id="intro"><title>Intro</title><body><p>Hello <b>bold</b> world</p></body></topic>`;

const REQUEST: AiStreamRequest = {
  projectPath: 'topics/intro.dita',
  xml: TOPIC_XML,
  taskType: 'ask',
  instruction: '解释选中内容',
  target: { mode: 'element', elementPath: [1, 0, 0] },
};

const PROPOSAL: AiProposal = {
  explanation: '已精简选中段落。',
  changesSummary: ['改写 <b> 内容'],
  originalXml: TOPIC_XML,
  patchedXml: TOPIC_XML.replace('bold', 'brave'),
  targetMode: 'element',
  targetTag: 'b',
  verification: {
    wellFormed: true,
    prosemirrorCompatible: true,
    preservedDoctype: true,
    retryCount: 0,
    warnings: [],
  },
  canRevalidateStrict: true,
};

function findBoldPos(): { pmDoc: ReturnType<typeof xmlToPmDoc>['pmDoc']; pos: number } {
  const { pmDoc } = xmlToPmDoc(TOPIC_XML);
  let pos = -1;
  pmDoc.descendants((node, nodePos) => {
    if (getPmNodeTagName(node) === 'b') {
      pos = nodePos;
      return false;
    }
    return true;
  });
  if (pos < 0) throw new Error('fixture lacks <b>');
  return { pmDoc, pos };
}

describe('Phase 6 AI target extraction (web)', () => {
  it('targets the deepest nested element for a visual selection', () => {
    const { pmDoc, pos } = findBoldPos();
    const parsed = xmlToPmDoc(TOPIC_XML).parsed;
    const target = buildVisualAiTarget(pmDoc, pos + 1, pos + 5, 'bold');
    const xmlPath = findElementPathAtOffset(parsed.document, TOPIC_XML.indexOf('bold'));
    expect(xmlPath.length).toBeGreaterThan(1);
    expect(target.mode).toBe('element');
    expect(target.elementPath).toEqual(xmlPath);
    expect(target.selectedText).toBe('bold');
  });

  it('trims selected text and caps it at 4000 characters', () => {
    const { pmDoc, pos } = findBoldPos();
    const target = buildVisualAiTarget(pmDoc, pos + 1, pos + 2, `  ${'x'.repeat(4200)}  `);
    expect(target.selectedText).toHaveLength(AI_SELECTED_TEXT_LIMIT);
    expect(target.selectedText?.startsWith(' ')).toBe(false);
  });

  it('maps a source caret in well-formed XML to line, column and element path', () => {
    const offset = TOPIC_XML.indexOf('bold');
    const parsed = xmlToPmDoc(TOPIC_XML).parsed;
    const target = buildSourceAiTarget(TOPIC_XML, offset);
    const expectedLine = TOPIC_XML.slice(0, offset).split('\n').length;
    expect(target).toMatchObject({
      mode: 'element',
      line: expectedLine,
      column: offset - TOPIC_XML.lastIndexOf('\n', offset),
      elementPath: findElementPathAtOffset(parsed.document, offset),
    });
  });

  it('falls back to a one-line window when the source XML is malformed', () => {
    const broken = '<topic><title>T</title><body><p>oops</body></topic>';
    const offset = broken.indexOf('oops');
    const target = buildSourceAiTarget(broken, offset);
    const line = broken.slice(0, offset).split('\n').length;
    expect(target).toMatchObject({
      mode: 'line-window',
      line,
      column: offset - broken.lastIndexOf('\n', offset),
      lineEnd: line,
    });
  });

  it('clamps diagnostic line windows to valid source lines', () => {
    expect(buildLineWindowAiTarget(0, -2, 0)).toEqual({
      mode: 'line-window',
      line: 1,
      column: 1,
      lineEnd: 1,
    });
    expect(buildLineWindowAiTarget(4, 2, 2)).toEqual({
      mode: 'line-window',
      line: 4,
      column: 2,
      lineEnd: 4,
    });
  });
});

describe('Phase 6 AI SSE client', () => {
  it('parses named events with multi-line JSON data payloads', () => {
    const frame = 'event: meta\ndata: {"requestId":"r1",\ndata: "model":"m","targetMode":"element","targetTag":"b","contextBadges":[]}';
    expect(parseAiSseFrame(frame)).toEqual({
      event: 'meta',
      data: {
        requestId: 'r1',
        model: 'm',
        targetMode: 'element',
        targetTag: 'b',
        contextBadges: [],
      },
    });
    expect(parseAiSseFrame('data: plain text')).toEqual({
      event: 'message',
      data: 'plain text',
    });
    expect(parseAiSseFrame('event: delta')).toBeNull();
  });

  it('streams frames through the handlers in order', async () => {
    const actual = await vi.importActual<typeof import('../src/ai/ai-api')>(
      '../src/ai/ai-api',
    );
    const encoder = new TextEncoder();
    const frames = [
      'event: meta\ndata: {"requestId":"r1","model":"m","targetMode":"element","targetTag":"b","contextBadges":[]}\n\n',
      'event: delta\ndata: {"text":"正在"}\n\n',
      'event: delta\ndata: {"text":"处理"}\n\n',
      `event: proposal\ndata: ${JSON.stringify(PROPOSAL)}\n\n`,
      'event: done\ndata: {"status":"succeeded","usage":{"promptTokens":1,"completionTokens":2,"totalTokens":3},"durationMs":9}\n\n',
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            for (const frame of frames) controller.enqueue(encoder.encode(frame));
            controller.close();
          },
        });
        return new Response(body, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        });
      }),
    );

    const seen: string[] = [];
    let deltas = '';
    let proposalTag: string | null = null;
    let doneStatus = '';
    await actual.streamAiRequest(
      REQUEST,
      {
        onMeta: (meta) => seen.push(`meta:${meta.requestId}`),
        onDelta: (text) => {
          deltas += text;
        },
        onProposal: (proposal) => {
          proposalTag = proposal.targetTag;
        },
        onDone: (done) => {
          doneStatus = done.status;
        },
      },
      new AbortController().signal,
    );

    expect(seen).toEqual(['meta:r1']);
    expect(deltas).toBe('正在处理');
    expect(proposalTag).toBe('b');
    expect(doneStatus).toBe('succeeded');
    vi.unstubAllGlobals();
  });

  it('rejects with AbortError when the stream is aborted', async () => {
    const actual = await vi.importActual<typeof import('../src/ai/ai-api')>(
      '../src/ai/ai-api',
    );
    const controller = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        const body = new ReadableStream<Uint8Array>({
          start(streamController) {
            streamController.enqueue(
              new TextEncoder().encode('event: delta\ndata: {"text":"a"}\n\n'),
            );
          },
        });
        return new Response(body, { status: 200 });
      }),
    );
    controller.abort();
    await expect(actual.streamAiRequest(REQUEST, {}, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
      message: 'AI 请求已取消',
    });
    vi.unstubAllGlobals();
  });
});

describe('Phase 6 AI apply guard', () => {
  const base = {
    filePath: 'topics/intro.dita',
    locks: [] as const,
    workspaceMode: 'api' as const,
  };

  it('lets admins apply directly', () => {
    expect(
      resolveAiApplyMode({ ...base, role: 'admin', userId: 'u-admin' }),
    ).toBe('apply');
  });

  it('lets the lock owner apply directly', () => {
    expect(
      resolveAiApplyMode({
        ...base,
        role: 'writer',
        userId: 'u-writer-lin',
        locks: [
          {
            filePath: 'topics/intro.dita',
            userId: 'u-writer-lin',
            userName: '林知远',
          },
        ],
      }),
    ).toBe('apply');
  });

  it('requires an unlocked writer to check out first', () => {
    expect(
      resolveAiApplyMode({ ...base, role: 'writer', userId: 'u-writer-chen' }),
    ).toBe('checkout-and-apply');
  });

  it('falls back to preview for files locked by another user', () => {
    expect(
      resolveAiApplyMode({
        ...base,
        role: 'writer',
        userId: 'u-writer-chen',
        locks: [
          {
            filePath: 'topics/intro.dita',
            userId: 'u-writer-lin',
            userName: '林知远',
          },
        ],
      }),
    ).toBe('preview-only');
  });

  it('keeps viewers in preview-only mode', () => {
    expect(
      resolveAiApplyMode({ ...base, role: 'viewer', userId: 'u-viewer-zhou' }),
    ).toBe('preview-only');
  });

  it('always applies in the in-memory demo workspace', () => {
    expect(
      resolveAiApplyMode({
        ...base,
        role: 'viewer',
        userId: 'u-viewer-zhou',
        workspaceMode: 'memory',
      }),
    ).toBe('apply');
  });
});

describe('Phase 6 AI store', () => {
  beforeEach(() => {
    resetAiStore();
    vi.mocked(streamAiRequest).mockReset();
  });

  it('streams deltas and stores a proposal from a send', async () => {
    vi.mocked(streamAiRequest).mockImplementation(async (_request, handlers) => {
      handlers.onMeta?.({
        requestId: 'r1',
        model: 'm',
        targetMode: 'element',
        targetTag: 'b',
        contextBadges: ['lock'],
      });
      handlers.onDelta?.('正在');
      handlers.onDelta?.('分析');
      handlers.onProposal?.(PROPOSAL);
      handlers.onDone?.({
        status: 'succeeded',
        usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
        durationMs: 12,
      });
    });

    await useAiStore.getState().send(REQUEST);
    const state = useAiStore.getState();
    expect(state.phase).toBe('proposal');
    expect(state.deltaText).toBe('正在分析');
    expect(state.proposal?.patchedXml).toContain('brave');
    expect(state.verification?.wellFormed).toBe(true);
    expect(state.meta?.requestId).toBe('r1');
    expect(state.messages.at(-1)?.content).toBe('正在分析');
    expect(state.done?.status).toBe('succeeded');
  });

  it('surfaces stream errors', async () => {
    vi.mocked(streamAiRequest).mockRejectedValue(new Error('上游模型超时'));
    await useAiStore.getState().send(REQUEST);
    expect(useAiStore.getState().phase).toBe('error');
    expect(useAiStore.getState().error).toBe('上游模型超时');
  });

  it('cancels an in-flight request and returns to idle', async () => {
    let receivedSignal: AbortSignal | undefined;
    vi.mocked(streamAiRequest).mockImplementation(
      (_request, _handlers, signal) =>
        new Promise((_resolve, reject) => {
          receivedSignal = signal;
          signal?.addEventListener('abort', () => {
            const error = new Error('AI 请求已取消');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    );

    const pending = useAiStore.getState().send(REQUEST);
    await Promise.resolve();
    expect(useAiStore.getState().phase).toBe('streaming');
    useAiStore.getState().cancel();
    await pending;
    expect(receivedSignal?.aborted).toBe(true);
    expect(useAiStore.getState().phase).toBe('idle');
  });

  it('dismissing a proposal clears its original XML payload', () => {
    useAiStore.setState({
      proposal: PROPOSAL,
      verification: PROPOSAL.verification,
      applied: true,
      phase: 'proposal',
    });
    useAiStore.getState().dismissProposal();
    const state = useAiStore.getState();
    expect(state.proposal).toBeNull();
    expect(state.verification).toBeNull();
    expect(state.applied).toBe(false);
    expect(state.phase).toBe('idle');
  });

  it('exposes the inspector tab selector from the contract', () => {
    expect(useAiStore.getState().tab).toBe('chat');
    useAiStore.getState().setTab('settings');
    expect(useAiStore.getState().tab).toBe('settings');
  });
});

describe('Phase 6 AI buffer application', () => {
  const tab = (path: string, xml: string, title: string): OpenEditorTab => ({
    path,
    fileName: path.split('/').at(-1) ?? path,
    title,
    kind: 'topic' as const,
    docType: 'concept' as const,
    baselineXml: xml,
    xml,
    mode: 'source' as const,
    xmlError: null,
    switchBlockedReason: null,
    visualReloadToken: 0,
  });

  it('applies patched XML to the target tab only and clears its XML error', () => {
    const first = tab('topics/intro.dita', TOPIC_XML, 'Intro');
    const second = tab('topics/other.dita', TOPIC_XML.replace('Intro', 'Other'), 'Other');
    first.xmlError = {
      line: 3,
      column: 1,
      offset: 40,
      message: 'unexpected token',
    };
    first.switchBlockedReason = 'XML 格式错误';
    const refresh = vi.fn(async () => undefined);
    useEditorStore.setState({
      workspaceMode: 'memory',
      openTabs: [first, second],
      activeTabPath: first.path,
      refreshDocumentOverlay: refresh,
    });

    const patched = TOPIC_XML.replace('Intro', 'Welcome');
    const applied = useEditorStore
      .getState()
      .applyAiPatchedXml(first.path, patched);
    const tabs = useEditorStore.getState().openTabs;

    expect(applied).toBe(true);
    expect(tabs[0]?.xml).toBe(patched);
    expect(tabs[0]?.title).toBe('Welcome');
    expect(tabs[0]?.xmlError).toBeNull();
    expect(tabs[0]?.switchBlockedReason).toBeNull();
    expect(tabs[1]?.xml).toBe(second.xml);
    expect(tabs[1]?.xmlError).toBeNull();
    expect(tabs[0]?.baselineXml).toBe(TOPIC_XML);
    expect(refresh).toHaveBeenCalledWith(first.path, patched);
  });

  it('keeps the live ProseMirror history when the visual editor already applied the patch', () => {
    const first = tab('topics/intro.dita', TOPIC_XML, 'Intro');
    first.mode = 'visual';
    first.visualReloadToken = 7;
    useEditorStore.setState({
      workspaceMode: 'memory',
      openTabs: [first],
      activeTabPath: first.path,
      refreshDocumentOverlay: vi.fn(async () => undefined),
    });

    const patched = TOPIC_XML.replace('Intro', 'Welcome');
    useEditorStore
      .getState()
      .applyAiPatchedXml(first.path, patched, { skipVisualReload: true });
    const afterSkip = useEditorStore.getState().openTabs[0];
    expect(afterSkip?.xml).toBe(patched);
    expect(afterSkip?.visualReloadToken).toBe(7);

    useEditorStore.getState().applyAiPatchedXml(first.path, patched);
    expect(useEditorStore.getState().openTabs[0]?.visualReloadToken).toBe(8);
  });

  it('records a malformed patch as an XML error without touching another tab', () => {
    const first = tab('topics/intro.dita', TOPIC_XML, 'Intro');
    const second = tab('topics/other.dita', TOPIC_XML.replace('Intro', 'Other'), 'Other');
    useEditorStore.setState({
      workspaceMode: 'memory',
      openTabs: [first, second],
      activeTabPath: first.path,
      refreshDocumentOverlay: vi.fn(async () => undefined),
    });

    const applied = useEditorStore
      .getState()
      .applyAiPatchedXml(first.path, '<topic><title>broken</topic>');
    const tabs = useEditorStore.getState().openTabs;
    expect(applied).toBe(true);
    expect(tabs[0]?.xml).toBe('<topic><title>broken</topic>');
    expect(tabs[0]?.xmlError).not.toBeNull();
    expect(tabs[1]?.xml).toBe(second.xml);
  });
});

describe('AI target scope (full topic authoring)', () => {
  it('maps the document scope to full-document regardless of the live selection', () => {
    expect(resolveScopeTarget('document', [{ mode: 'element', elementPath: [3, 1] }])).toEqual({
      mode: 'full-document',
    });
    expect(resolveScopeTarget('document', [null, undefined])).toEqual({ mode: 'full-document' });
  });

  it('keeps the fragment scope on the first available target', () => {
    const element = { mode: 'element' as const, elementPath: [3, 1] };
    const line = { mode: 'line-window' as const, line: 12 };
    expect(resolveScopeTarget('fragment', [null, element, line])).toEqual(element);
    expect(resolveScopeTarget('fragment', [element, line])).toEqual(element);
  });

  it('degrades to full-document when no fragment target can be resolved', () => {
    expect(resolveScopeTarget('fragment', [null, undefined])).toEqual({ mode: 'full-document' });
  });

  it('labels both scopes for the panel toggle in every locale', () => {
    // Phase 8: scope labels are message keys resolved at render time, not baked-in Chinese.
    expect(translate('zh-CN', AI_TARGET_SCOPE_LABELS.document)).toBe('整篇 Topic');
    expect(translate('zh-CN', AI_TARGET_SCOPE_LABELS.fragment)).toBe('片段');
    expect(translate('en', AI_TARGET_SCOPE_LABELS.document)).toBe('Full Topic');
    expect(translate('en', AI_TARGET_SCOPE_LABELS.fragment)).toBe('Fragment');
  });
});

describe('AI diff dialog layout', () => {
  it('clamps the merge view to the dialog body instead of overflowing the footer', () => {
    // Without `h-full` the CodeMirror MergeView falls back to its content height inside the
    // dialog's block wrapper and painted over "应用到编辑器", making the button unclickable.
    const markup = renderToStaticMarkup(
      createElement(DiffViewer, {
        oldText: '<concept><title>a</title></concept>',
        newText: '<concept><title>b</title></concept>',
        fromLabel: '缓冲区',
        toLabel: 'AI 补丁',
      }),
    );
    expect(markup).toContain('h-full');
    expect(markup).toContain('flex-1 flex-col overflow-hidden');
  });
});
