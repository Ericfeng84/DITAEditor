import { randomUUID } from 'node:crypto';
import {
  buildDitaConstraintSummary,
  extractTargetFragment,
  spliceAndVerifyAiXml,
  type AiFragmentExtraction,
  type AiSpliceResult,
  type AiTargetSpec,
} from '@dita/core';
import type { AIMessageChunk, BaseMessage } from '@langchain/core/messages';
import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { HttpError } from '../errors.js';
import type { WorkspaceManager } from '../files/workspace-fs.js';
import type { IdentityUser } from '../identity/identity-service.js';
import type { WorkspaceSemanticIndexer } from '../indexer/semantic-indexer.js';
import { buildAiContext, EMPTY_AI_CONTEXT, type AiProjectContext } from './ai-context.js';
import type { AiChatModel, AiModelFactory } from './ai-model-factory.js';
import { createExplanationStreamFilter, parseAiOutput } from './ai-output-parser.js';
import { buildAiMessages } from './ai-prompt.js';
import type { AiSettingsService } from './ai-settings-service.js';
import { AiUsageService, type AiUsageStatus } from './ai-usage-service.js';
import type {
  AiProposal,
  AiStreamEvent,
  AiStreamRequest,
  AiUsageTokenSummary,
} from './types.js';

export interface AiServiceLogger {
  warn(message: string): void;
}

export interface AiServiceDeps {
  workspace: WorkspaceManager;
  indexer: WorkspaceSemanticIndexer;
  settings: AiSettingsService;
  usage: AiUsageService;
  modelFactory: AiModelFactory;
  logger?: AiServiceLogger;
}

export interface AiStreamContext {
  signal?: AbortSignal;
}

const MAX_TARGET_CHARS = 12_000;
const DITA_TOPIC_ROOT_TAGS = new Set([
  'concept',
  'task',
  'reference',
  'topic',
  'glossentry',
  'troubleshooting',
]);

function messageChars(messages: BaseMessage[]): number {
  return messages.reduce((total, message) => {
    const content = message.content;
    const text =
      typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content
              .map((part) =>
                typeof part === 'string'
                  ? part
                  : typeof (part as { text?: unknown }).text === 'string'
                    ? (part as { text: string }).text
                    : '',
              )
              .join('')
          : JSON.stringify(content);
    return total + text.length;
  }, 0);
}

function chunkText(chunk: AIMessageChunk): string {
  const content = chunk.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        const text = (part as { text?: unknown }).text;
        return typeof text === 'string' ? text : '';
      })
      .join('');
  }
  return '';
}

function readChunkUsage(chunk: AIMessageChunk): AiUsageTokenSummary | null {
  const metadata = chunk.usage_metadata;
  if (!metadata) return null;
  return {
    promptTokens: metadata.input_tokens ?? 0,
    completionTokens: metadata.output_tokens ?? 0,
    totalTokens: metadata.total_tokens ?? 0,
  };
}

function estimateTokens(chars: number): number {
  return Math.max(1, Math.ceil(chars / 4));
}

function normalizeUsage(usage: AiUsageTokenSummary): AiUsageTokenSummary {
  const totalTokens = usage.totalTokens || usage.promptTokens + usage.completionTokens;
  return { ...usage, totalTokens };
}

function countLines(text: string): number {
  if (text.length === 0) return 0;
  return text.split('\n').length;
}

function collectTagNames(xml: string): Set<string> {
  const tags = new Set<string>();
  const pattern = /<([A-Za-z_][\w.:-]*)/g;
  for (const match of xml.matchAll(pattern)) {
    if (match[1]) tags.add(match[1]);
  }
  return tags;
}

function buildChangesSummary(
  extraction: AiFragmentExtraction,
  candidateXml: string,
  patchedXml: string,
): string[] {
  const lines: string[] = [];
  const modeLabel =
    extraction.mode === 'element'
      ? `元素 <${extraction.targetTag ?? extraction.rootTagName}>`
      : extraction.mode === 'line-window'
        ? `第 ${extraction.lineStart}–${extraction.lineEnd} 行`
        : `整篇 <${extraction.rootTagName}>`;
  lines.push(
    `替换${modeLabel}：${countLines(extraction.targetXml)} 行 → ${countLines(candidateXml)} 行`,
  );

  const before = collectTagNames(extraction.targetXml);
  const after = collectTagNames(candidateXml);
  const added = [...after].filter((tag) => !before.has(tag)).slice(0, 4);
  const removed = [...before].filter((tag) => !after.has(tag)).slice(0, 4);
  if (added.length > 0) lines.push(`新增标签：${added.map((tag) => `<${tag}>`).join('、')}`);
  if (removed.length > 0) lines.push(`移除标签：${removed.map((tag) => `<${tag}>`).join('、')}`);
  if (lines.length < 4 && patchedXml.length !== extraction.originalXml.length) {
    lines.push(`文档长度 ${extraction.originalXml.length} → ${patchedXml.length} 字符`);
  }
  if (lines.length < 4) lines.push('XML 声明、DOCTYPE 与未修改区域保持原样');
  return lines.slice(0, 4);
}

function buildProposal(
  extraction: AiFragmentExtraction,
  explanation: string,
  candidateXml: string,
  splice: Extract<AiSpliceResult, { ok: true }>,
  retryCount: number,
  extraWarnings: string[],
): AiProposal {
  return {
    explanation,
    changesSummary: buildChangesSummary(extraction, candidateXml, splice.patchedXml),
    originalXml: extraction.originalXml,
    patchedXml: splice.patchedXml,
    targetMode: extraction.mode,
    targetTag: extraction.targetTag,
    verification: {
      wellFormed: splice.verification.wellFormed,
      prosemirrorCompatible: splice.verification.prosemirrorCompatible,
      preservedDoctype: splice.verification.preservedDoctype,
      retryCount,
      warnings: [...extraWarnings, ...splice.verification.warnings],
    },
    canRevalidateStrict: DITA_TOPIC_ROOT_TAGS.has(extraction.rootTagName),
  };
}

function retryFeedback(
  attempt: number,
  maxRetries: number,
  splice: Extract<AiSpliceResult, { ok: false }>,
  extraction: AiFragmentExtraction,
): string {
  return [
    `上一次输出未通过校验（第 ${attempt} 次尝试，最多 ${maxRetries} 次重试）。`,
    `错误码：${splice.errorCode}`,
    `错误信息：${splice.errorMessage}`,
    `目标：${extraction.mode === 'element' ? `<${extraction.targetTag}>` : `${extraction.mode}（<${extraction.rootTagName}>）`}。`,
    buildDitaConstraintSummary(extraction.rootTagName, extraction.parentTag),
    '请重新输出：只返回 <dita_patch> 中可安全替换目标范围的完整 XML，不要 Markdown 围栏、XML 声明或 DOCTYPE；如果无法安全修改，只输出 <explanation> 说明原因。',
  ].join('\n');
}

function extractForRequest(
  xml: string,
  target: AiTargetSpec,
): { extraction: AiFragmentExtraction; warnings: string[]; badges: string[] } {
  const warnings: string[] = [];
  const badges: string[] = [];
  let extraction: AiFragmentExtraction;
  try {
    extraction = extractTargetFragment(xml, target, { maxContextChars: 4000 });
  } catch (err) {
    if (target.line === undefined) {
      throw new HttpError(400, `无法定位 AI 目标片段：${err instanceof Error ? err.message : String(err)}`, {
        code: 'invalid-target',
      });
    }
    warnings.push('元素定位失败，已回退到行窗口模式。');
    badges.push('元素定位失败，回退行窗口');
    extraction = extractTargetFragment(
      xml,
      { ...target, mode: 'line-window', line: target.line },
      { maxContextChars: 4000 },
    );
  }

  if (extraction.mode !== 'full-document' && extraction.targetXml.length > MAX_TARGET_CHARS) {
    warnings.push(`目标片段超过 ${MAX_TARGET_CHARS} 字符，已切换整篇模式以避免上下文截断。`);
    badges.push('目标过大，已切换整篇模式');
    extraction = extractTargetFragment(xml, { mode: 'full-document' }, { maxContextChars: 4000 });
  }

  if (extraction.truncated && extraction.mode !== 'full-document') {
    warnings.push('目标片段或上下文已按上下文预算截断。');
  }
  return { extraction, warnings, badges };
}

export class AiService {
  private readonly usage: AiUsageService;
  private readonly logger?: AiServiceLogger;

  constructor(private readonly deps: AiServiceDeps) {
    this.usage = deps.usage;
    this.logger = deps.logger;
  }

  /** Orchestrates one SSE AI request. Emits protocol events; never throws once streaming begins. */
  async *stream(
    request: AiStreamRequest,
    user: IdentityUser,
    context: AiStreamContext = {},
  ): AsyncGenerator<AiStreamEvent> {
    const config = this.deps.settings.resolveConfig();
    const requestId = randomUUID();
    const startedAt = Date.now();
    const branch = request.branch ?? 'default';
    const recordFailure = (message: string): void => {
      this.usage.record({
        projectId: this.deps.workspace.getProjectRootDir(),
        branch,
        userId: user.id,
        userDisplayName: user.displayName,
        taskType: request.taskType,
        subAction: request.subAction ?? request.taskType,
        filePath: request.projectPath,
        model: config.model,
        status: 'failed',
        retryCount: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        durationMs: Date.now() - startedAt,
        errorMessage: message,
      });
    };

    if (!config.apiKey) {
      const message = 'AI 未配置 API Key，请管理员先在 AI 设置中配置。';
      recordFailure(message);
      throw new HttpError(400, message, { code: 'ai-not-configured' });
    }

    let xml = request.xml;
    if (xml === undefined) {
      try {
        xml = (await this.deps.workspace.readFile(request.projectPath)).content;
      } catch (err) {
        const message = `无法读取主题文件 ${request.projectPath}：${err instanceof Error ? err.message : String(err)}`;
        recordFailure(message);
        throw new HttpError(400, message, { code: 'file-unreadable' });
      }
    }

    let extraction: AiFragmentExtraction;
    let warnings: string[];
    let badges: string[];
    try {
      ({ extraction, warnings, badges } = extractForRequest(xml, request.target));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      recordFailure(message);
      throw err;
    }

    let projectContext: AiProjectContext = EMPTY_AI_CONTEXT;
    if (request.includeProjectContext) {
      projectContext = await buildAiContext({
        indexer: this.deps.indexer,
        rootMapPath: request.rootMapPath ?? null,
        ditavalPath: request.ditavalPath ?? null,
        branch,
        currentFilePath: request.projectPath,
      });
    }
    const contextBadges = [...projectContext.badges, ...badges];

    yield {
      event: 'meta',
      data: {
        requestId,
        model: config.model,
        targetMode: extraction.mode,
        targetTag: extraction.targetTag,
        contextBadges,
      },
    };

    const signal = context.signal;
    let status: AiUsageStatus = 'failed';
    let errorMessage: string | null = null;
    let retryCount = 0;
    let usage: AiUsageTokenSummary = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let explanation = '';
    let doneSent = false;
    let lastErrorCode: string | undefined;
    let lastMessages: BaseMessage[] = [];

    try {
      const messages = buildAiMessages({
        taskType: request.taskType,
        subAction: request.subAction,
        instruction: request.instruction,
        projectPath: request.projectPath,
        rootMapPath: request.rootMapPath ?? null,
        ditavalPath: request.ditavalPath ?? null,
        extraction,
        diagnostics: request.context?.diagnostics,
        history: request.history,
        context: projectContext,
        includeProjectContext: request.includeProjectContext,
      });
      lastMessages = messages;

      for (let attempt = 0; attempt <= config.maxRetries; attempt += 1) {
        if (signal?.aborted) {
          status = 'cancelled';
          break;
        }
        const model: AiChatModel = this.deps.modelFactory(config);
        const filter = attempt === 0 ? createExplanationStreamFilter() : null;
        let raw = '';
        let attemptUsage: AiUsageTokenSummary | null = null;

        try {
          for await (const chunk of model.stream(messages, { signal })) {
            if (signal?.aborted) {
              status = 'cancelled';
              break;
            }
            const text = chunkText(chunk);
            raw += text;
            const chunkUsage = readChunkUsage(chunk);
            if (chunkUsage) attemptUsage = chunkUsage;
            if (filter) {
              const delta = filter.push(text);
              if (delta) yield { event: 'delta', data: { text: delta } };
            }
          }
        } catch (err) {
          if (attemptUsage) usage = normalizeUsage(attemptUsage);
          if (signal?.aborted) {
            status = 'cancelled';
            break;
          }
          const message = err instanceof Error ? err.message : String(err);
          errorMessage = message;
          lastErrorCode = 'ai-stream-failed';
          this.logger?.warn(`AI stream failed: ${message}`);
          if (attempt >= config.maxRetries) break;
          retryCount = attempt + 1;
          yield {
            event: 'retry',
            data: { attempt: retryCount, maxRetries: config.maxRetries, reason: message },
          };
          messages.push(new HumanMessage(`上一次请求失败：${message}。请重新输出。`));
          continue;
        }

        if (status === 'cancelled') break;

        if (filter) {
          const tail = filter.flush();
          if (tail) yield { event: 'delta', data: { text: tail } };
        }

        usage = normalizeUsage(
          attemptUsage ?? {
            promptTokens: estimateTokens(messageChars(lastMessages)),
            completionTokens: estimateTokens(raw.length),
            totalTokens: 0,
          },
        );
        const parsed = parseAiOutput(raw);
        if (parsed.explanation) explanation = parsed.explanation;

        if (request.taskType === 'ask') {
          if (parsed.explanation) {
            status = 'succeeded';
          } else {
            errorMessage = 'AI 未返回解释内容。';
            if (attempt < config.maxRetries) {
              retryCount = attempt + 1;
              yield {
                event: 'retry',
                data: { attempt: retryCount, maxRetries: config.maxRetries, reason: errorMessage },
              };
              messages.push(
                new AIMessage(raw),
                new HumanMessage('请只输出 <explanation> 中文说明，不要输出 XML 片段。'),
              );
              continue;
            }
          }
          break;
        }

        if (!parsed.patchXml) {
          errorMessage = 'AI 未返回可替换的 XML 片段。';
          lastErrorCode = 'no-patch';
          if (attempt < config.maxRetries) {
            retryCount = attempt + 1;
            yield {
              event: 'retry',
              data: { attempt: retryCount, maxRetries: config.maxRetries, reason: errorMessage },
            };
            messages.push(
              new AIMessage(raw),
              new HumanMessage(
                '请重新输出：必须先给 <explanation>，再给 <dita_patch> 完整 XML，不要输出空 patch。',
              ),
            );
            continue;
          }
          break;
        }

        const splice = spliceAndVerifyAiXml(xml, extraction, parsed.patchXml);
        if (!splice.ok) {
          errorMessage = splice.errorMessage;
          lastErrorCode = splice.errorCode;
          if (attempt < config.maxRetries) {
            retryCount = attempt + 1;
            yield {
              event: 'retry',
              data: {
                attempt: retryCount,
                maxRetries: config.maxRetries,
                reason: splice.errorMessage,
              },
            };
            messages.push(new AIMessage(raw), new HumanMessage(retryFeedback(
              retryCount,
              config.maxRetries,
              splice,
              extraction,
            )));
            continue;
          }
          break;
        }

        // A retried attempt that finally succeeds must not leave a stale failure in the usage ledger.
        errorMessage = null;
        lastErrorCode = undefined;
        const proposal = buildProposal(
          extraction,
          explanation,
          parsed.patchXml,
          splice,
          retryCount,
          warnings,
        );
        yield { event: 'proposal', data: proposal };
        status = 'succeeded';
        doneSent = true;
        yield {
          event: 'done',
          data: { status, usage, durationMs: Date.now() - startedAt },
        };
        break;
      }

      if (status === 'succeeded' && !doneSent) {
        doneSent = true;
        yield {
          event: 'done',
          data: { status, usage, durationMs: Date.now() - startedAt },
        };
      } else if (status === 'cancelled') {
        doneSent = true;
        yield {
          event: 'done',
          data: { status, usage, durationMs: Date.now() - startedAt },
        };
      } else if (status !== 'succeeded' && !doneSent) {
        yield {
          event: 'error',
          data: {
            message: errorMessage ?? 'AI 生成失败。',
            code: lastErrorCode ?? 'ai-failed',
          },
        };
        doneSent = true;
        yield {
          event: 'done',
          data: { status, usage, durationMs: Date.now() - startedAt },
        };
      }
    } catch (err) {
      if (err instanceof HttpError) throw err;
      if (signal?.aborted) {
        status = 'cancelled';
      } else {
        errorMessage = err instanceof Error ? err.message : String(err);
        this.logger?.warn(`AI orchestration failed: ${errorMessage}`);
      }
      if (!doneSent) {
        if (status !== 'cancelled') {
          yield { event: 'error', data: { message: errorMessage ?? 'AI 生成失败。' } };
        }
        yield {
          event: 'done',
          data: { status, usage, durationMs: Date.now() - startedAt },
        };
      }
    } finally {
      this.usage.record({
        projectId: this.deps.workspace.getProjectRootDir(),
        branch,
        userId: user.id,
        userDisplayName: user.displayName,
        taskType: request.taskType,
        subAction: request.subAction ?? request.taskType,
        filePath: request.projectPath,
        model: config.model,
        status,
        retryCount,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        durationMs: Date.now() - startedAt,
        errorMessage,
      });
    }
  }
}
