/**
 * Layer 2 autonomous repair agent (tool-using LLM).
 *
 * The deterministic repair loop in `validator-repair-agent.ts` can only fix one diagnostic batch per
 * LLM round trip, and DITA-OT in `strict` mode aborts on the *first* error — so a 20-topic import
 * with three broken topics needed one round per topic and repeatedly burned its global budget on
 * the same file. This agent flips the loop around: the model gets real tools, so it can read every
 * broken topic, write all fixes in one batch, and only then ask DITA-OT (in `lax` mode, which lists
 * *all* broken files in one JVM call) to verify — finishing with one `strict` confirmation.
 *
 * Guardrails (all non-negotiable):
 * - Sandboxed to `stagingDir`; paths escaping it are rejected before any filesystem call.
 * - Writes are limited to files this job generated (topics, root map, keys map).
 * - Bounded DITA-OT calls (`maxDitaOtCalls`) and bounded LLM steps (`maxSteps`).
 * - A no-progress circuit breaker stops early when two validations report identical errors.
 * - `throwIfAborted` before every model call and every tool execution.
 * - Any failure to bind/use tools degrades to `usedToolAgent: false` (caller falls back to the
 *   deterministic per-topic loop). `AbortError` / `IngestAgentAbortedError` are never swallowed.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';
import {
  checkXmlWellFormed,
  keysMapPathFor,
  normalizePosixPath,
  type IngestDiagnosticItem,
  type IngestOutlinePlan,
} from '@dita/core';
import type { ResolvedAiConfig } from '../../ai/ai-settings-service.js';
import { validateStrict } from '../../validate/strict-validator.js';
import type { StrictDiagnostic, StrictValidationResult } from '../../validate/strict-validator.js';
import { postProcessGeneratedTopicXml } from './writer-agent.js';
import { validateTopicLayer1 } from './validator-repair-agent.js';
import {
  IngestAgentAbortedError,
  throwIfAborted,
  type GeneratedTopicArtifact,
  type IngestAgentCallbacks,
  type IngestAgentContext,
  type IngestAgentDeps,
} from './types.js';

const MIN_TOOL_STEPS = 8;
const MAX_TOOL_STEPS = 24;
const MIN_DITA_OT_CALLS = 4;
const MAX_DITA_OT_CALLS = 8;
/** Lines returned per `read_staged_file` call (keeps a whole topic inside one context window). */
const READ_WINDOW_LINES = 250;
const MAX_REPORTED_ERRORS = 40;
const MAX_REPORTED_WARNINGS = 5;
const MAX_REPORTED_ASSETS = 40;

export interface DitaOtRepairAgentInput {
  plan: IngestOutlinePlan;
  /** Mutable artifacts: the agent edits them in place so the caller materializes its fixes. */
  artifacts: GeneratedTopicArtifact[];
  /** Temporary project directory handed to DITA-OT; the only writable area. */
  stagingDir: string;
  /** Normalized workspace-relative paths of every generated topic. */
  targets: readonly string[];
  rootMapPath: string;
  /** Keys map path, when the plan adds `keys="…"`/`keyref` links. */
  keysMapPath?: string | null;
  availableAssetPaths?: ReadonlySet<string>;
  assetPathById?: ReadonlyMap<string, string>;
  language?: string;
  /** Number of topics that failed the initial whole-map strict run. */
  initialBrokenCount: number;
  /** Initial strict diagnostics, offered to the model as a starting point. */
  initialDiagnostics?: readonly StrictDiagnostic[];
  callbacks?: IngestAgentCallbacks;
}

export interface DitaOtRepairAgentResult {
  /** False when the model cannot call tools (or the very first tool call was rejected). */
  usedToolAgent: boolean;
  /** Map/keymap files the agent rewrote; fed to `materializeNewManual` as `fileOverrides`. */
  repairedFiles: Record<string, string>;
  /** True when the run ended with a clean whole-map `strict` run and no edit after it. */
  strictVerified: boolean;
  /** Diagnostics of the last whole-map `strict` run the agent performed, if any. */
  lastStrict?: { ok: boolean; diagnostics: readonly StrictDiagnostic[]; message?: string };
}

/* ------------------------------------------------------------------------------------------ */
/* Tool plumbing                                                                              */
/* ------------------------------------------------------------------------------------------ */

interface ToolSpec {
  name: string;
  /** Bound-tool instance handed to `model.bindTools`. */
  definition: StructuredToolInterface;
  run(rawArgs: unknown): Promise<string>;
}

/** Declares one structured tool: the same zod schema drives the model and the dispatcher. */
function defineTool<SchemaT extends z.ZodObject<z.ZodRawShape>>(
  name: string,
  description: string,
  schema: SchemaT,
  run: (args: z.infer<SchemaT>) => Promise<string>,
): ToolSpec {
  return {
    name,
    definition: tool(async (args: z.infer<SchemaT>) => run(args), { name, description, schema }),
    async run(rawArgs: unknown): Promise<string> {
      const parsed = schema.safeParse(rawArgs ?? {});
      if (!parsed.success) {
        return JSON.stringify({
          ok: false,
          error: `Invalid arguments for ${name}: ${parsed.error.issues
            .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
            .join('; ')}`,
        });
      }
      return run(parsed.data);
    },
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Agent                                                                                      */
/* ------------------------------------------------------------------------------------------ */

/** Runs the bounded tool-calling repair agent. Never throws for "model has no tools". */
export async function runDitaOtRepairAgent(
  input: DitaOtRepairAgentInput,
  deps: IngestAgentDeps,
  ctx: IngestAgentContext,
): Promise<DitaOtRepairAgentResult> {
  throwIfAborted(ctx.signal);
  const noTools: DitaOtRepairAgentResult = { usedToolAgent: false, repairedFiles: {}, strictVerified: false };

  const config = deps.settings.resolveConfig();
  if (!config.apiKey) return noTools;
  const model = deps.modelFactory(config);
  if (!model.bindTools) return noTools; // scripted stubs / non-tool providers

  // `IngestService` never injects a validator in production (only tests do), so default to the
  // real DITA-OT runner — otherwise the tool agent would be dead code outside the test suite.
  const runStrict = deps.strictValidator ?? validateStrict;

  const callbacks = input.callbacks;
  const language = input.language ?? input.plan.language ?? 'en';
  const rootMapPath = normalizePosixPath(input.rootMapPath);
  const keysMapPath =
    input.keysMapPath && input.plan.createKeysMap && input.plan.suggestedKeys.length > 0
      ? normalizePosixPath(input.keysMapPath)
      : null;
  const assetPathById = new Map<string, string>(input.assetPathById ?? []);
  const availableAssetPaths = new Set<string>();
  for (const path of input.availableAssetPaths ?? []) availableAssetPaths.add(normalizePosixPath(path));

  const artifacts = input.artifacts;
  const artifactByPath = new Map<string, GeneratedTopicArtifact>();
  for (const artifact of artifacts) artifactByPath.set(normalizePosixPath(artifact.node.filePath), artifact);
  const targets = Array.from(new Set(input.targets.map((path) => normalizePosixPath(path))));

  const initialBrokenCount = Math.max(1, input.initialBrokenCount);
  const maxDitaOtCalls = Math.min(MAX_DITA_OT_CALLS, Math.max(MIN_DITA_OT_CALLS, initialBrokenCount + 3));
  const maxSteps = Math.min(MAX_TOOL_STEPS, Math.max(MIN_TOOL_STEPS, initialBrokenCount * 4));

  // ---- mutable run state -------------------------------------------------------------------
  const repairedFiles: Record<string, string> = {};
  let ditaOtCalls = 0;
  let strictVerified = false;
  let lastStrict: { ok: boolean; diagnostics: readonly StrictDiagnostic[]; message?: string } | null = null;
  let previousFingerprint: string | null = null;
  let noProgress = false;
  /** Staging-relative paths currently holding DITA-OT error diagnostics. */
  let errorPaths = new Set<string>();

  const invalidateStrict = (): void => {
    strictVerified = false;
  };

  const stagingPath = (rawPath: string): string => {
    const relativePath = normalizePosixPath(rawPath);
    const target = resolve(input.stagingDir, relativePath);
    const root = resolve(input.stagingDir);
    if (target !== root && !target.startsWith(`${root}${sep}`)) {
      throw new Error(`Refusing to touch a path outside the staging directory: ${rawPath}`);
    }
    return target;
  };

  const writeStagingFile = (relativePath: string, content: string): void => {
    const target = stagingPath(relativePath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content, 'utf8');
  };

  /* ---- tool 1: dita_ot_validate ---------------------------------------------------------- */
  const validateTool = defineTool(
    'dita_ot_validate',
    'Run real DITA-OT validation on the generated manual. mode="lax" keeps going after the first error and lists every broken file (use it to scan); mode="strict" aborts on the first error (use it once at the end to prove zero errors). Omit target to validate the whole map.',
    z.object({
      mode: z.enum(['lax', 'strict']).default('lax'),
      target: z.string().optional(),
    }),
    async (args) => {
      const requested = args.target?.trim() ?? '';
      const targetPath = requested ? normalizePosixPath(requested) : null;
      if (targetPath && !artifactByPath.has(targetPath) && targetPath !== rootMapPath && targetPath !== keysMapPath) {
        return JSON.stringify({
          ok: false,
          error: `Unknown target "${requested}". Generated paths are listed by list_staged_files.`,
        });
      }
      if (ditaOtCalls >= maxDitaOtCalls) {
        return JSON.stringify({
          ok: false,
          budgetExhausted: true,
          remainingCalls: 0,
          error: `DITA-OT call budget exhausted (${maxDitaOtCalls} calls). Fix with write_staged_file using the diagnostics you already have; do not validate again.`,
        });
      }
      ditaOtCalls += 1;
      let result: StrictValidationResult;
      try {
        result = await runStrict({
          workDir: input.stagingDir,
          paths: targetPath ? [targetPath] : [...targets],
          rootMapPath: targetPath ? null : rootMapPath,
          processingMode: args.mode,
          ...(deps.ditaRuntime ? { runtimeOptions: deps.ditaRuntime } : {}),
          ...(ctx.signal ? { signal: ctx.signal } : {}),
          locale: ctx.locale,
        });
      } catch (error) {
        if (ctx.signal?.aborted) throw error;
        return JSON.stringify({
          ok: false,
          error: `DITA-OT could not run: ${describeError(error)}`,
          remainingCalls: Math.max(0, maxDitaOtCalls - ditaOtCalls),
        });
      }
      throwIfAborted(ctx.signal);
      if (!result.available) {
        return JSON.stringify({
          ok: false,
          unavailable: true,
          error: result.message ?? 'DITA-OT runtime is not available.',
          remainingCalls: Math.max(0, maxDitaOtCalls - ditaOtCalls),
        });
      }

      const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
      const warnings = result.diagnostics.filter((diagnostic) => diagnostic.severity !== 'error');
      errorPaths = new Set(errors.map((diagnostic) => normalizePosixPath(diagnostic.filePath || '')));

      if (args.mode === 'strict' && !targetPath) {
        lastStrict = {
          ok: result.ok,
          diagnostics: result.diagnostics,
          ...(result.message ? { message: result.message } : {}),
        };
        strictVerified = result.ok;
      }

      callbacks?.onLog?.({
        level: 'info',
        message: `DITA-OT ${args.mode}${targetPath ? ` · ${targetPath}` : ' · whole map'}: ${errors.length} error(s), ${warnings.length} warning(s).`,
      });

      const fingerprint = buildFingerprint(errors);
      if (fingerprint && previousFingerprint !== null && fingerprint === previousFingerprint) {
        noProgress = true;
        callbacks?.onLog?.({
          level: 'warn',
          message: 'DITA-OT repair agent is making no progress: two validations reported identical errors.',
        });
      }
      previousFingerprint = fingerprint || null;

      return JSON.stringify({
        ok: result.ok,
        mode: args.mode,
        target: targetPath,
        entryPoint: result.entryPoint ?? null,
        errorCount: errors.length,
        warningCount: warnings.length,
        remainingCalls: Math.max(0, maxDitaOtCalls - ditaOtCalls),
        errors: groupByFile(errors.slice(0, MAX_REPORTED_ERRORS)),
        warnings: warnings
          .slice(0, MAX_REPORTED_WARNINGS)
          .map((warning) => `${normalizePosixPath(warning.filePath || '')}:${warning.line}: ${warning.message}`),
        truncated: errors.length > MAX_REPORTED_ERRORS,
        ...(noProgress
          ? { noProgress: true, hint: 'Identical errors repeated twice; stop validating and fix the files directly.' }
          : {}),
        ...(result.ok ? { hint: 'Zero errors. Reply with a short summary and no tool calls.' } : {}),
      });
    },
  );

  /* ---- tool 2: list_staged_files --------------------------------------------------------- */
  const listTool = defineTool(
    'list_staged_files',
    'List the generated topic files (with their DITA type and whether they currently hold errors), the root map path, the keys map path and the available image assets.',
    z.object({}),
    async () => {
      return JSON.stringify({
        rootMapPath,
        keysMapPath,
        topics: artifacts.map((artifact) => {
          const path = normalizePosixPath(artifact.node.filePath);
          return {
            filePath: path,
            type: artifact.node.type,
            topicId: artifact.node.topicId,
            title: artifact.node.title,
            hasErrors: !artifact.ok || errorPaths.has(path),
          };
        }),
        assets: Array.from(availableAssetPaths).slice(0, MAX_REPORTED_ASSETS),
      });
    },
  );

  /* ---- tool 3: read_staged_file ---------------------------------------------------------- */
  const readTool = defineTool(
    'read_staged_file',
    'Read a generated file from the staging directory with 1-based line numbers. Windows of 250 lines: use startLine/endLine for longer files.',
    z.object({
      path: z.string(),
      startLine: z.number().int().min(1).optional(),
      endLine: z.number().int().min(1).optional(),
    }),
    async (args) => {
      const relativePath = normalizePosixPath(args.path);
      const allowed =
        artifactByPath.has(relativePath) || relativePath === rootMapPath || relativePath === keysMapPath;
      if (!allowed) {
        return JSON.stringify({
          ok: false,
          error: `"${relativePath}" is not a generated file. Allowed: ${[
            ...artifactByPath.keys(),
            rootMapPath,
            ...(keysMapPath ? [keysMapPath] : []),
          ].join(', ')}`,
        });
      }
      let content: string;
      try {
        content = readFileSync(stagingPath(relativePath), 'utf8');
      } catch (error) {
        return JSON.stringify({ ok: false, error: `Cannot read ${relativePath}: ${describeError(error)}` });
      }
      const lines = content.split('\n');
      const startLine = Math.max(1, args.startLine ?? 1);
      const endLine = Math.max(startLine, args.endLine ?? startLine + READ_WINDOW_LINES - 1);
      const window = lines.slice(startLine - 1, endLine);
      const numbered = window.map((line, index) => `${startLine + index}: ${line}`).join('\n');
      return [
        `${relativePath} (lines ${startLine}-${Math.min(endLine, lines.length)} of ${lines.length})`,
        numbered,
      ].join('\n');
    },
  );

  /* ---- tool 4: write_staged_file --------------------------------------------------------- */
  const writeTool = defineTool(
    'write_staged_file',
    'Replace a generated file with corrected XML. Only generated topics, the root map and the keys map can be written. The XML is post-processed and Layer-1 validated immediately, so the result tells you whether the file is now structurally valid.',
    z.object({ path: z.string(), xml: z.string().min(1) }),
    async (args) => {
      const relativePath = normalizePosixPath(args.path);
      const artifact = artifactByPath.get(relativePath);

      if (!artifact) {
        if (relativePath !== rootMapPath && relativePath !== keysMapPath) {
          return JSON.stringify({
            ok: false,
            error: `Refusing to write "${relativePath}": only the generated topics, the root map and the keys map may be modified.`,
          });
        }
        const wellFormed = checkXmlWellFormed(args.xml);
        if (!wellFormed.ok) {
          return JSON.stringify({
            ok: false,
            error: `Map XML is not well-formed (line ${wellFormed.error.line}, column ${wellFormed.error.column}): ${wellFormed.error.message}. Nothing was written.`,
          });
        }
        try {
          writeStagingFile(relativePath, args.xml);
        } catch (error) {
          return JSON.stringify({ ok: false, error: `Cannot write ${relativePath}: ${describeError(error)}` });
        }
        repairedFiles[relativePath] = args.xml;
        invalidateStrict();
        return JSON.stringify({ ok: true, path: relativePath, kind: 'map' });
      }

      const xml = postProcessGeneratedTopicXml(args.xml, {
        node: artifact.node,
        language,
        assetPathById,
      });
      const recheck = validateTopicLayer1({
        node: artifact.node,
        xml,
        locale: ctx.locale,
        availableAssetPaths,
        ...(ctx.existingPaths ? { existingPaths: ctx.existingPaths } : {}),
      });
      artifact.xml = xml;
      artifact.repairAttempts += 1;
      artifact.repaired = true;
      artifact.issues = recheck.issues;
      artifact.ok = recheck.ok;
      try {
        writeStagingFile(relativePath, xml);
      } catch (error) {
        return JSON.stringify({ ok: false, error: `Cannot write ${relativePath}: ${describeError(error)}` });
      }
      invalidateStrict();

      const errors = recheck.issues.filter((issue) => issue.severity === 'error');
      callbacks?.onLayer2Repair?.({
        topicId: artifact.node.topicId,
        filePath: relativePath,
        attempt: artifact.repairAttempts,
        issues: errors,
      });
      callbacks?.onTopicStatus?.({
        topicId: artifact.node.topicId,
        filePath: relativePath,
        title: artifact.node.title,
        status: recheck.ok ? 'done' : 'repairing',
        attempts: artifact.repairAttempts,
        ...(recheck.ok ? {} : { error: errors[0]?.message ?? 'Layer 1 validation failed.' }),
      });

      return JSON.stringify({
        ok: recheck.ok,
        path: relativePath,
        layer1Errors: errors.slice(0, 10).map((issue) => `${issue.code ?? issue.source}: ${issue.message}`),
      });
    },
  );

  const tools: ToolSpec[] = [validateTool, listTool, readTool, writeTool];
  const toolByName = new Map(tools.map((spec) => [spec.name, spec]));

  // ---- bind + run --------------------------------------------------------------------------
  let bound: ReturnType<NonNullable<typeof model.bindTools>>;
  try {
    bound = model.bindTools(tools.map((spec) => spec.definition));
  } catch (error) {
    if (isUnsupportedToolError(error)) return noTools;
    throw error;
  }

  const messages: BaseMessage[] = [
    new SystemMessage(buildSystemPrompt(language)),
    new HumanMessage(buildUserPrompt({ input, targets, rootMapPath, keysMapPath, language })),
  ];

  for (let step = 1; step <= maxSteps; step += 1) {
    throwIfAborted(ctx.signal);
    if (noProgress || ditaOtCalls >= maxDitaOtCalls) break;

    const startedAt = Date.now();
    let message: AIMessage;
    try {
      message = await bound.invoke(messages, ctx.signal ? { signal: ctx.signal } : undefined);
      throwIfAborted(ctx.signal);
    } catch (error) {
      recordAgentUsage(deps, ctx, config, {
        status: ctx.signal?.aborted ? 'cancelled' : 'failed',
        durationMs: Date.now() - startedAt,
        retryCount: step,
        errorMessage: describeError(error),
      });
      if (step === 1 && isUnsupportedToolError(error)) return noTools;
      throw error;
    }

    const usage = readUsage(message);
    recordAgentUsage(deps, ctx, config, {
      status: 'succeeded',
      durationMs: Date.now() - startedAt,
      retryCount: step,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      totalTokens: usage.totalTokens,
    });

    const calls = message.tool_calls ?? [];
    if (calls.length === 0) break;
    messages.push(message);

    for (const call of calls) {
      throwIfAborted(ctx.signal);
      const spec = toolByName.get(call.name);
      let content: string;
      try {
        content = spec ? await spec.run(call.args) : JSON.stringify({ ok: false, error: `Unknown tool "${call.name}".` });
      } catch (error) {
        if (ctx.signal?.aborted) throw error;
        content = JSON.stringify({ ok: false, error: describeError(error) });
      }
      messages.push(
        new ToolMessage({
          content,
          tool_call_id: call.id ?? `${call.name}_${step}`,
          name: call.name,
        }),
      );
      if (noProgress) break;
    }

    if (noProgress) break;
  }

  return {
    usedToolAgent: true,
    repairedFiles,
    strictVerified,
    ...(lastStrict ? { lastStrict } : {}),
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Prompts                                                                                    */
/* ------------------------------------------------------------------------------------------ */

function buildSystemPrompt(language: string): string {
  return [
    'You are the DITA-OT repair agent of a DITA 1.3 authoring workbench.',
    'A freshly generated manual fails `dita --validate`. Make it validate with ZERO errors.',
    '',
    'Workflow — follow it exactly:',
    '1. list_staged_files to see the generated topics and the root map.',
    '2. read_staged_file for EVERY topic that has errors (batch the reads).',
    '3. write_staged_file for every broken file BEFORE validating again — batch all fixes of one',
    '   round into a single burst of writes.',
    '4. dita_ot_validate with mode="lax" to scan the whole map for remaining errors; fix them all.',
    '5. Finish with exactly one dita_ot_validate with mode="strict" and no target. It must report',
    '   zero errors, then reply with a short plain-text summary and no tool calls.',
    '',
    'Rules:',
    '- Only generated files may be written; stay inside the staging directory.',
    '- Change only what the diagnostics require: keep prose, titles, ids, xml:lang, keys and links.',
    '- Keep the OASIS DITA 1.3 DOCTYPE, the root element type and the root id.',
    '- <task> content lives in <taskbody> (<prereq>, <context>, <steps>, <result>, <postreq>);',
    '  never place those directly in <task>, and never put <result> inside <step>.',
    '- External http(s)/mailto targets in <xref>/<link> need scope="external" and format="html"',
    '  (format="pdf" for .pdf URLs).',
    '- You are bounded: a fixed number of DITA-OT calls and LLM steps. Do not re-validate the same',
    '  unchanged files; if two validations report identical errors, stop and report.',
    `- Write prose in this language: ${language}.`,
  ].join('\n');
}

function buildUserPrompt(args: {
  input: DitaOtRepairAgentInput;
  targets: readonly string[];
  rootMapPath: string;
  keysMapPath: string | null;
  language: string;
}): string {
  const { input, targets, rootMapPath, keysMapPath, language } = args;
  const diagnostics = (input.initialDiagnostics ?? [])
    .filter((diagnostic) => diagnostic.severity === 'error')
    .slice(0, 20)
    .map(
      (diagnostic) =>
        `- ${normalizePosixPath(diagnostic.filePath || '')}:${diagnostic.line ?? 0}: ${diagnostic.code ?? 'ERROR'} ${diagnostic.message}`,
    );
  return [
    `Manual: ${input.plan.title || input.plan.rootMapPath}`,
    `Root map: ${rootMapPath}`,
    keysMapPath ? `Keys map: ${keysMapPath}` : 'Keys map: (none)',
    `Language: ${language}`,
    `Generated topics (${targets.length}):`,
    ...targets.map((path) => {
      const artifact = input.artifacts.find((candidate) => normalizePosixPath(candidate.node.filePath) === path);
      return `- ${path} (${artifact?.node.type ?? 'topic'}, id=${artifact?.node.topicId ?? '?'})`;
    }),
    '',
    `The first DITA-OT strict run reported errors in ${input.initialBrokenCount} file(s).`,
    diagnostics.length > 0 ? 'First reported errors:' : '',
    ...diagnostics,
  ]
    .filter((line) => line !== '')
    .join('\n');
}

/* ------------------------------------------------------------------------------------------ */
/* Helpers                                                                                    */
/* ------------------------------------------------------------------------------------------ */

function groupByFile(
  diagnostics: readonly StrictDiagnostic[],
): Record<string, Array<{ line: number; column: number; code: string | null; message: string }>> {
  const grouped: Record<string, Array<{ line: number; column: number; code: string | null; message: string }>> = {};
  for (const diagnostic of diagnostics) {
    const path = normalizePosixPath(diagnostic.filePath || '');
    const bucket = grouped[path] ?? [];
    bucket.push({
      line: diagnostic.line,
      column: diagnostic.column,
      code: diagnostic.code ?? null,
      message: diagnostic.message,
    });
    grouped[path] = bucket;
  }
  return grouped;
}

/** Stable identity of an error set, used by the no-progress circuit breaker. */
function buildFingerprint(errors: readonly StrictDiagnostic[]): string {
  return errors
    .map(
      (diagnostic) =>
        `${normalizePosixPath(diagnostic.filePath || '')}|${diagnostic.code ?? ''}|${diagnostic.line ?? 0}|${diagnostic.message}`,
    )
    .sort()
    .join('\n');
}

function isUnsupportedToolError(error: unknown): boolean {
  if (error instanceof IngestAgentAbortedError) return false;
  const name = error instanceof Error ? error.name : '';
  if (name === 'AbortError') return false;
  const message = describeError(error);
  return /(?:does(?:n't| not) support (?:tools?|function|tool calling)|unsupported (?:tools?|function)|tool[_ ]?calls? (?:are|is) not supported|no tools? support)/iu.test(
    message,
  );
}

function recordAgentUsage(
  deps: IngestAgentDeps,
  ctx: IngestAgentContext,
  config: ResolvedAiConfig,
  outcome: {
    status: 'succeeded' | 'failed' | 'cancelled';
    durationMs: number;
    retryCount: number;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    errorMessage?: string;
  },
): void {
  try {
    deps.usage.record({
      projectId: ctx.projectId,
      branch: ctx.branch,
      userId: ctx.user.id,
      userDisplayName: ctx.user.displayName,
      taskType: 'ingest_repair',
      subAction: 'layer2_agent',
      filePath: null,
      model: config.model,
      status: outcome.status,
      retryCount: outcome.retryCount,
      promptTokens: outcome.promptTokens ?? 0,
      completionTokens: outcome.completionTokens ?? 0,
      totalTokens: outcome.totalTokens ?? 0,
      durationMs: outcome.durationMs,
      errorMessage: outcome.errorMessage ?? null,
    });
  } catch {
    // Usage accounting must never break an import.
  }
}

function readUsage(message: AIMessage): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} {
  const usage = message.usage_metadata;
  const promptTokens = usage?.input_tokens ?? 0;
  const completionTokens = usage?.output_tokens ?? 0;
  return {
    promptTokens,
    completionTokens,
    totalTokens: usage?.total_tokens ?? promptTokens + completionTokens,
  };
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/* Re-exported so callers can reuse the staging path guard without importing node:path. */
export function assertInsideStaging(stagingDir: string, relativePath: string): string {
  const target = resolve(stagingDir, normalizePosixPath(relativePath));
  const root = resolve(stagingDir);
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new Error(`Refusing to touch a path outside the staging directory: ${relativePath}`);
  }
  return target;
}

export type { IngestDiagnosticItem, IngestOutlinePlan, StrictValidationResult };
