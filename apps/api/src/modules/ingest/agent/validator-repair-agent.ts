/**
 * Validator / Repairer role.
 *
 * Layer 1 (`@dita/core`, no external process):
 *   well-formedness → DITA 1.3 content model → ProseMirror schema conversion → asset references.
 * Layer 2 (cross-file semantics + DITA-OT strict):
 *   `DitaSemanticIndex` diagnostics, then an actual `dita --validate` run against a temporary
 *   staging directory (injectable via `strictValidator`, so tests stay deterministic and fast).
 *
 * Both layers self-heal: a failing topic is handed back to the Repairer agent with exact
 * diagnostics, re-post-processed, re-validated, and — for Layer 2 — confirmed with one more
 * strict run. An unavailable DITA-OT degrades to `layer2.status = 'skipped'`, never a failure.
 */

import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve, sep } from 'node:path';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import {
  buildDitaConstraintSummary,
  buildKeysMapXml,
  buildMapXmlFromPlan,
  checkXmlStructure,
  checkXmlWellFormed,
  DITA_BLOCK_TAGS,
  DitaSemanticIndex,
  formatStructureIssue,
  getNodeSourceRange,
  keysMapPathFor,
  normalizePosixPath,
  resolveDitaHref,
  xmlToPmDoc,
  type ExtractedIngestAsset,
  type IngestDiagnosticItem,
  type IngestOutlinePlan,
  type IngestTopicValidationResult,
  type IngestValidationReport,
  type PlannedTopicNode,
  type SemanticDiagnostic,
} from '@dita/core';
import { detectDitaRuntime } from '../../dita-ot/dita-runtime.js';
import type { ResolvedAiConfig } from '../../ai/ai-settings-service.js';
import { validateStrict } from '../../validate/strict-validator.js';
import type { StrictDiagnostic, StrictValidationInput } from '../../validate/strict-validator.js';
import { postProcessGeneratedTopicXml, draftTopicWithAgent } from './writer-agent.js';
import {
  throwIfAborted,
  type DraftAndVerifyInput,
  type GeneratedTopicArtifact,
  type IngestAgentContext,
  type IngestAgentDeps,
  type Layer1ValidationResult,
  type RepairTopicInput,
  type RepairTopicResult,
  type StagingDirContext,
  type ValidateBatchInput,
  type ValidateBatchResult,
  type ValidateLayer1Input,
} from './types.js';

const DEFAULT_LAYER1_RETRIES = 2;
const DEFAULT_LAYER2_RETRIES = 2;
const DEFAULT_LANGUAGE = 'en';
const ELEMENT_NODE = 1;
const STAGING_PREFIX = 'dita-ingest-agent-';

/** Minimal structural view over slimdom nodes (nodeType checks, never `instanceof`). */
interface DomNodeLike {
  nodeType: number;
  localName?: string | null;
  /** slimdom stores children as an array-like; index it directly, there is no `.item()`. */
  childNodes: ArrayLike<DomNodeLike>;
  getAttribute?(name: string): string | null;
}

/**
 * Legal direct children of the modeled topic roots (OASIS DITA 1.3 topic.mod / concept.mod /
 * task.mod / reference.mod).
 */
const TOPIC_ROOT_ALLOWED_CHILDREN: Readonly<Record<string, ReadonlySet<string>>> = {
  concept: new Set(['title', 'titlealts', 'shortdesc', 'abstract', 'prolog', 'conbody', 'related-links', 'concept']),
  task: new Set(['title', 'titlealts', 'shortdesc', 'abstract', 'prolog', 'taskbody', 'related-links', 'task']),
  reference: new Set(['title', 'titlealts', 'shortdesc', 'abstract', 'prolog', 'refbody', 'related-links', 'reference']),
  topic: new Set(['title', 'titlealts', 'shortdesc', 'abstract', 'prolog', 'body', 'related-links', 'topic']),
};

/**
 * Standard DITA tags that are never legal directly under a topic root. Only *known* DITA elements
 * are flagged so specialized/custom containers keep flowing through losslessly (AGENTS.md §4.8).
 */
const TOPIC_ROOT_FLAGGED_CHILDREN: ReadonlySet<string> = new Set<string>([
  ...DITA_BLOCK_TAGS,
  'body',
  'conbody',
  'taskbody',
  'refbody',
  'section',
  'steps',
  'steps-unordered',
  'prereq',
  'context',
  'result',
  'postreq',
  'tasktroubleshooting',
  'properties',
  'refsyn',
  'example',
  'p',
  'ul',
  'ol',
  'table',
  'simpletable',
  'fig',
  'codeblock',
]);

/* ------------------------------------------------------------------------------------------ */
/* Layer 1                                                                                    */
/* ------------------------------------------------------------------------------------------ */

/**
 * Single-topic validation: well-formedness, DITA 1.3 content model, ProseMirror conversion
 * compatibility, and image-reference resolution.
 */
export function validateTopicLayer1(input: ValidateLayer1Input): Layer1ValidationResult {
  const issues: IngestDiagnosticItem[] = [];
  const wellFormed = checkXmlWellFormed(input.xml);
  if (!wellFormed.ok) {
    issues.push({
      source: 'structure',
      severity: 'error',
      code: 'xml-not-well-formed',
      message: wellFormed.error.message,
      path: input.node.filePath,
      line: wellFormed.error.line,
      column: wellFormed.error.column,
    });
    return { ok: false, issues, assetIssues: [] };
  }

  const structure = checkXmlStructure(input.xml, { taskModel: 'auto' });
  if (!structure.ok) {
    issues.push({
      source: 'structure',
      severity: 'error',
      code: 'xml-structure-parse-error',
      message: structure.error.message,
      path: input.node.filePath,
      line: structure.error.line,
      column: structure.error.column,
    });
  } else {
    for (const issue of structure.issues) {
      issues.push({
        source: 'structure',
        severity: issue.severity,
        code: issue.code,
        message: formatStructureIssue(issue, input.locale),
        path: input.node.filePath,
        line: issue.line,
        column: issue.column,
      });
    }
  }

  issues.push(
    ...collectTopicRootChildIssues(
      wellFormed.parsed.document.documentElement as unknown as DomNodeLike,
      input.node.filePath,
    ),
  );

  try {
    xmlToPmDoc(input.xml);
  } catch (error) {
    issues.push({
      source: 'prosemirror',
      severity: 'error',
      code: 'pm-conversion-failed',
      message: `Visual editor conversion failed: ${describeError(error)}`,
      path: input.node.filePath,
    });
  }

  const assetIssues = collectAssetIssues(input, wellFormed.parsed.document.documentElement as unknown as DomNodeLike);
  issues.push(...assetIssues);

  return {
    ok: !issues.some((issue) => issue.severity === 'error'),
    issues,
    assetIssues,
  };
}

/**
 * Direct-child guard for the modeled topic roots.
 *
 * `validateChildSequence` treats unknown tags transparently (so specializations stay lossless),
 * which means `<steps>` or `<section>` written directly under `<task>` used to pass Layer 1 and
 * only surface as an opaque DITA-OT content-model failure. This guard closes that gap while still
 * ignoring genuinely unknown/custom children (AGENTS.md §4.8: guide, never block).
 */
function collectTopicRootChildIssues(
  root: DomNodeLike | null,
  filePath: string,
): IngestDiagnosticItem[] {
  if (!root) return [];
  const rootTag = root.localName ?? '';
  const allowed = TOPIC_ROOT_ALLOWED_CHILDREN[rootTag];
  if (!allowed) return [];

  const issues: IngestDiagnosticItem[] = [];
  const children = root.childNodes;
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index];
    if (!child || child.nodeType !== ELEMENT_NODE) continue;
    const tag = child.localName ?? '';
    if (!tag || allowed.has(tag) || !TOPIC_ROOT_FLAGGED_CHILDREN.has(tag)) continue;
    const range = getNodeSourceRange(child as never);
    issues.push({
      source: 'structure',
      severity: 'error',
      code: 'invalid-topic-root-child',
      message: `<${tag}> is not allowed directly inside <${rootTag}>; it must be nested in the topic body (<${rootTag === 'task' ? 'taskbody' : rootTag === 'concept' ? 'conbody' : rootTag === 'reference' ? 'refbody' : 'body'}>).`,
      path: filePath,
      line: range.open?.line ?? 1,
      column: range.open?.column ?? 1,
    });
  }
  return issues;
}

function collectAssetIssues(input: ValidateLayer1Input, root: DomNodeLike): IngestDiagnosticItem[] {
  const issues: IngestDiagnosticItem[] = [];
  const available = new Set<string>();
  for (const path of input.availableAssetPaths ?? []) available.add(normalizePosixPath(path));
  for (const path of input.existingPaths ?? []) available.add(normalizePosixPath(path));

  const seen = new Set<string>();
  const visit = (node: DomNodeLike): void => {
    if (node.nodeType === ELEMENT_NODE && node.localName === 'image') {
      const href = node.getAttribute?.('href')?.trim() ?? '';
      if (href) checkHref(href);
    }
    const children = node.childNodes;
    for (let index = 0; index < children.length; index += 1) {
      const child = children[index];
      if (child) visit(child);
    }
  };

  const checkHref = (href: string): void => {
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu.test(href)) {
      // http(s)/ftp/mailto/data URIs are external by definition…
      if (/^asset:/iu.test(href)) {
        addIssue(href, 'asset-placeholder', `Image href "${href}" still uses an unresolved asset:// placeholder.`);
      }
      return;
    }
    if (href.startsWith('#')) return;
    const resolved = resolveDitaHref(input.node.filePath, href);
    if (resolved.isExternal) return;
    if (!resolved.targetPath) return;
    const target = normalizePosixPath(resolved.targetPath);
    if (resolved.escapesRoot) {
      addIssue(href, 'asset-escapes-root', `Image href "${href}" points outside the project workspace.`);
      return;
    }
    if (!available.has(target)) {
      addIssue(href, 'missing-asset', `Image href "${href}" does not resolve to an existing workspace asset (${target}).`);
    }
  };

  const addIssue = (href: string, code: string, message: string): void => {
    if (seen.has(href)) return;
    seen.add(href);
    issues.push({ source: 'asset', severity: 'error', code, message, path: input.node.filePath });
  };

  visit(root);
  return issues;
}

/* ------------------------------------------------------------------------------------------ */
/* Repair                                                                                     */
/* ------------------------------------------------------------------------------------------ */

/** Repairer role: rewrites the whole topic, fixing exactly the supplied diagnostics. */
export async function repairTopicWithAgent(
  input: RepairTopicInput,
  deps: IngestAgentDeps,
  ctx: IngestAgentContext,
): Promise<RepairTopicResult> {
  throwIfAborted(ctx.signal);
  const language = input.language || DEFAULT_LANGUAGE;
  const assetPathById = input.assetPathById ?? new Map<string, string>();
  const config = deps.settings.resolveConfig();
  if (!config.apiKey) {
    throw new Error('AI model is not configured (no API key); cannot repair topics.');
  }

  const diagnostics = input.issues
    .slice(0, 40)
    .map((issue) => `- [${issue.severity}] ${issue.code ?? issue.source}: ${issue.message}`)
    .join('\n');
  const layerHint =
    input.layer === 'layer2_strict'
      ? 'These come from DITA-OT strict validation plus cross-file semantics (links, keys, conrefs, IDs).'
      : 'These come from DITA 1.3 well-formedness, content-model, visual-editor and asset checks.';

  const messages: BaseMessage[] = [
    new SystemMessage(
      [
        'You are the Repair agent of a DITA 1.3 authoring workbench.',
        `Repair the ${input.node.type} topic <${input.node.topicId}> and return the COMPLETE corrected topic.`,
        'Wrap the topic in <dita_topic>...</dita_topic>. No prose, no markdown fences, no diff.',
        layerHint,
        'Fix every listed error and change nothing else: keep wording, ids, cross-references and',
        'formatting intact unless a diagnostic requires the change.',
        '',
        'Authoring rules:',
        buildDitaConstraintSummary(input.node.type, null, ctx.locale),
        '- Never leave an unresolved asset:// placeholder; only use hrefs proven to exist.',
        '- Keep the canonical OASIS DITA 1.3 DOCTYPE and root id.',
        `- Write prose in this language: ${language}.`,
      ].join('\n'),
    ),
    new HumanMessage(
      [
        `File: ${input.node.filePath}`,
        `Root id: ${input.node.topicId}`,
        `Repair attempt: ${input.attempt}`,
        '',
        'Diagnostics to fix:',
        diagnostics || '(none supplied)',
        '',
        'Current topic XML:',
        input.xml,
      ].join('\n'),
    ),
  ];

  const model = deps.modelFactory(config);
  const startedAt = Date.now();
  let message: AIMessage;
  try {
    message = await model.invoke(messages);
    throwIfAborted(ctx.signal);
  } catch (error) {
    recordRepairUsage(deps, ctx, input, config, {
      status: ctx.signal?.aborted ? 'cancelled' : 'failed',
      durationMs: Date.now() - startedAt,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      errorMessage: describeError(error),
    });
    throw error;
  }

  const usage = readUsage(message);
  const xml = postProcessGeneratedTopicXml(readMessageText(message), {
    node: input.node,
    language,
    assetPathById,
  });
  recordRepairUsage(deps, ctx, input, config, {
    status: 'succeeded',
    durationMs: Date.now() - startedAt,
    ...usage,
  });
  return { xml, warnings: [] };
}

/**
 * Layer 1 self-healing loop: draft → validate → repair (≤ `maxLayer1Retries`) → validate.
 * The returned artifact is always emitted (never thrown) so the batch can report per-topic state.
 */
export async function draftAndVerifyTopic(
  input: DraftAndVerifyInput,
  deps: IngestAgentDeps,
  ctx: IngestAgentContext,
): Promise<GeneratedTopicArtifact> {
  const maxRetries = input.maxLayer1Retries ?? DEFAULT_LAYER1_RETRIES;
  const availableAssetPaths = input.availableAssetPaths ?? new Set<string>();
  const callbacks = input.callbacks;

  throwIfAborted(ctx.signal);
  callbacks?.onTopicStatus?.({
    topicId: input.node.topicId,
    filePath: input.node.filePath,
    title: input.node.title,
    status: 'writing',
    attempts: 0,
  });

  const draft = await draftTopicWithAgent(input, deps, ctx);
  for (const warning of draft.warnings) callbacks?.onLog?.({ level: 'warn', message: warning });

  let xml = draft.xml;
  let repairAttempts = 0;
  let repaired = false;
  let result = validateTopicLayer1({
    node: input.node,
    xml,
    locale: ctx.locale,
    availableAssetPaths,
    ...(ctx.existingPaths ? { existingPaths: ctx.existingPaths } : {}),
  });

  while (!result.ok && repairAttempts < maxRetries) {
    throwIfAborted(ctx.signal);
    repairAttempts += 1;
    callbacks?.onTopicStatus?.({
      topicId: input.node.topicId,
      filePath: input.node.filePath,
      title: input.node.title,
      status: 'repairing',
      attempts: repairAttempts,
    });
    try {
      const repair = await repairTopicWithAgent(
        {
          node: input.node,
          xml,
          language: input.language,
          assetPathById: input.assetPathById ?? new Map<string, string>(),
          issues: result.issues,
          layer: 'layer1',
          attempt: repairAttempts,
          availableAssetPaths,
          ...(ctx.existingPaths ? { existingPaths: ctx.existingPaths } : {}),
          ...(callbacks ? { callbacks } : {}),
        },
        deps,
        ctx,
      );
      xml = repair.xml;
      repaired = true;
      result = validateTopicLayer1({
        node: input.node,
        xml,
        locale: ctx.locale,
        availableAssetPaths,
        ...(ctx.existingPaths ? { existingPaths: ctx.existingPaths } : {}),
      });
    } catch (error) {
      if (ctx.signal?.aborted) throw error;
      callbacks?.onLog?.({
        level: 'error',
        message: `Repair pass ${repairAttempts} for ${input.node.filePath} failed: ${describeError(error)}`,
      });
      break;
    }
  }

  callbacks?.onTopicStatus?.({
    topicId: input.node.topicId,
    filePath: input.node.filePath,
    title: input.node.title,
    status: result.ok ? 'done' : 'failed',
    attempts: repairAttempts,
    ...(result.ok ? {} : { error: firstErrorMessage(result.issues) }),
  });

  return {
    node: input.node,
    xml,
    repairAttempts,
    repaired,
    issues: result.issues,
    ok: result.ok,
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Layer 2                                                                                    */
/* ------------------------------------------------------------------------------------------ */

/**
 * Cross-file semantic check + DITA-OT strict validation with targeted repair.
 *
 * Layer 1 is re-verified on the current XML, semantic diagnostics are collected over generated
 * files only (a pre-existing baseline problem must not fail an import), then a temporary staging
 * project is validated with `dita --validate`. Failing topics are repaired and confirmed with one
 * more strict run. Without DITA-OT the report records `layer2.status = 'skipped'`.
 */
export async function validateAndRepairBatch(
  input: ValidateBatchInput,
  deps: IngestAgentDeps,
  ctx: IngestAgentContext,
): Promise<ValidateBatchResult> {
  const callbacks = input.callbacks;
  const language = input.language ?? input.plan.language ?? DEFAULT_LANGUAGE;
  const assetPathById = new Map<string, string>(input.assetPathById ?? []);
  const availableAssetPaths = new Set<string>();
  for (const path of input.assetPaths ?? []) availableAssetPaths.add(normalizePosixPath(path));
  for (const path of input.availableAssetPaths ?? []) availableAssetPaths.add(normalizePosixPath(path));
  for (const path of assetPathById.values()) availableAssetPaths.add(normalizePosixPath(path));

  const artifacts: GeneratedTopicArtifact[] = input.artifacts.map((artifact) => ({
    node: artifact.node,
    xml: artifact.xml,
    repairAttempts: artifact.repairAttempts,
    repaired: artifact.repaired,
    issues: [...artifact.issues],
    ok: artifact.ok,
  }));

  // ---- Layer 1 refresh ---------------------------------------------------------------------
  for (const artifact of artifacts) {
    const result = validateTopicLayer1({
      node: artifact.node,
      xml: artifact.xml,
      locale: ctx.locale,
      availableAssetPaths,
      ...(ctx.existingPaths ? { existingPaths: ctx.existingPaths } : {}),
    });
    artifact.issues = result.issues;
    artifact.ok = result.ok;
  }

  // ---- Semantic layer ----------------------------------------------------------------------
  const generatedFiles = buildGeneratedFiles(input, artifacts);
  const generatedPathSet = new Set(Object.keys(generatedFiles).map((path) => normalizePosixPath(path)));
  const index = input.baselineIndex
    ? input.baselineIndex.cloneWithOverlay(
        Object.entries(generatedFiles).map(([filePath, content]) => ({
          op: 'create' as const,
          filePath: normalizePosixPath(filePath),
          content,
        })),
      )
    : buildSemanticIndex(generatedFiles, ctx);
  const semanticItems = index
    .collectSemanticDiagnostics(input.plan.rootMapPath, { assetPaths: availableAssetPaths })
    .filter((diagnostic) => generatedPathSet.has(normalizePosixPath(diagnostic.filePath)))
    .map(toSemanticItem);
  attachIssuesByPath(artifacts, semanticItems);
  const layer1Issues = [...artifacts.flatMap((artifact) => artifact.issues)];
  const layer1Ok = !layer1Issues.some((issue) => issue.severity === 'error');

  // ---- DITA-OT strict layer ----------------------------------------------------------------
  /** Per-topic state before Layer 2, so only genuinely changed topics emit a final status. */
  const layer2Snapshot = new Map<string, { ok: boolean; attempts: number }>();
  for (const artifact of artifacts) {
    layer2Snapshot.set(normalizePosixPath(artifact.node.filePath), {
      ok: artifact.ok,
      attempts: artifact.repairAttempts,
    });
  }
  let layer2: IngestValidationReport['layer2'] = {
    status: 'skipped',
    issues: [],
    reason: 'DITA-OT strict validation was not run.',
  };
  /** Map / keys-map XML rewritten by Layer 2, returned so materialization reuses it. */
  let repairedFiles: Record<string, string> | undefined;
  const availability = await resolveStrictAvailability(deps, ctx);
  if (!availability.available) {
    layer2 = {
      status: 'skipped',
      issues: [],
      reason: availability.reason ?? 'DITA-OT runtime is not available.',
    };
    callbacks?.onLog?.({ level: 'warn', message: `Layer 2 skipped: ${layer2.reason}` });
  } else {
    const runStrict = deps.strictValidator ?? validateStrict;
    const stagingDir = mkdtempSync(resolve(tmpdir(), STAGING_PREFIX));
    try {
      const writeFile = (relativePath: string, content: string): void => {
        writeStagingFile(stagingDir, relativePath, content);
      };
      const writeAsset = (asset: ExtractedIngestAsset, relativePath: string): void => {
        writeStagingAsset(stagingDir, asset, relativePath);
      };
      if (input.prepareStagingDir) {
        const stagingContext: StagingDirContext = {
          workDir: stagingDir,
          rootMapPath: input.plan.rootMapPath,
          writeFile,
          writeAsset,
        };
        await input.prepareStagingDir(stagingContext);
      }
      // Generated files always win over any copied baseline file.
      for (const [relativePath, content] of Object.entries(generatedFiles)) writeFile(relativePath, content);
      for (const asset of input.assets ?? []) {
        const relativePath = assetPathById.get(asset.assetId);
        if (relativePath) writeAsset(asset, relativePath);
      }

      const targets = artifacts.map((artifact) => normalizePosixPath(artifact.node.filePath));
      callbacks?.onLayer2Start?.({ targets, rootMapPath: input.plan.rootMapPath });

      const strictInput = {
        workDir: stagingDir,
        paths: targets,
        rootMapPath: input.plan.rootMapPath,
        ...(deps.ditaRuntime ? { runtimeOptions: deps.ditaRuntime } : {}),
        ...(ctx.signal ? { signal: ctx.signal } : {}),
        locale: ctx.locale,
      };
      const repairOneTopic = async (
        artifact: GeneratedTopicArtifact,
        errors: readonly StrictDiagnostic[],
        attempt: number,
      ): Promise<boolean> => {
        const path = normalizePosixPath(artifact.node.filePath);
        const mapped = errors.map(toStrictItem);
        callbacks?.onLayer2Repair?.({
          topicId: artifact.node.topicId,
          filePath: path,
          attempt,
          issues: mapped,
        });
        callbacks?.onTopicStatus?.({
          topicId: artifact.node.topicId,
          filePath: path,
          title: artifact.node.title,
          status: 'repairing',
          attempts: attempt,
        });
        try {
          const repair = await repairTopicWithAgent(
            {
              node: artifact.node,
              xml: artifact.xml,
              language,
              assetPathById,
              issues: [...mapped, ...artifact.issues.filter((issue) => issue.severity === 'error')],
              layer: 'layer2_strict',
              attempt,
              availableAssetPaths,
              ...(ctx.existingPaths ? { existingPaths: ctx.existingPaths } : {}),
              ...(callbacks ? { callbacks } : {}),
            },
            deps,
            ctx,
          );
          const recheck = validateTopicLayer1({
            node: artifact.node,
            xml: repair.xml,
            locale: ctx.locale,
            availableAssetPaths,
            ...(ctx.existingPaths ? { existingPaths: ctx.existingPaths } : {}),
          });
          artifact.xml = repair.xml;
          artifact.repairAttempts += 1;
          artifact.repaired = true;
          artifact.issues = recheck.issues;
          artifact.ok = recheck.ok;
          writeFile(path, repair.xml);
          return true;
        } catch (error) {
          if (ctx.signal?.aborted) throw error;
          callbacks?.onLog?.({
            level: 'error',
            message: `Layer 2 repair for ${path} failed: ${describeError(error)}`,
          });
          return false;
        }
      };

      /**
       * Deterministic fallback used when the model cannot call tools.
       *
       * The budget is per topic — the old global round cap let a stubborn topic starve every other
       * failing topic (the real 20-topic import left topic #3 with `attempts: 0`). Multi-topic runs
       * scan with `lax` (one JVM call lists every broken file) and always confirm with `strict`.
       */
      const runDeterministicLayer2Repair = async (
        startOutcome: StrictRunOutcome,
      ): Promise<{ outcome: StrictRunOutcome; verified: boolean }> => {
        const maxPerTopic = Math.max(1, input.maxLayer2Retries ?? DEFAULT_LAYER2_RETRIES);
        const globalCap = Math.max(maxPerTopic, Math.min(30, artifacts.length * maxPerTopic));
        const attemptsByPath = new Map<string, number>();
        let outcome = startOutcome;

        for (let round = 1; round <= globalCap; round += 1) {
          throwIfAborted(ctx.signal);
          let scan = outcome;
          // Round 1 already has the caller's `lax` pre-scan merged into `outcome`; only re-scan
          // after a repair round, so the fallback does not pay a redundant JVM launch.
          if (artifacts.length > 1 && round > 1) {
            const lax = await safeRunStrict(runStrict, { ...strictInput, processingMode: 'lax' }, ctx);
            if (!lax.available) return { outcome: lax, verified: false };
            scan = lax.ok ? lax : mergeStrictRuns(outcome, lax);
          }

          const errorsByPath = groupStrictErrors(scan.diagnostics);
          let repairedAny = false;
          for (const artifact of artifacts) {
            const path = normalizePosixPath(artifact.node.filePath);
            const perTopicAttempts = attemptsByPath.get(path) ?? 0;
            if (perTopicAttempts >= maxPerTopic) continue;
            const errors = errorsByPath.get(path) ?? [];
            if (errors.length === 0) continue;
            attemptsByPath.set(path, perTopicAttempts + 1);
            if (await repairOneTopic(artifact, errors, perTopicAttempts + 1)) repairedAny = true;
          }
          if (!repairedAny) break;

          throwIfAborted(ctx.signal);
          outcome = await safeRunStrict(runStrict, { ...strictInput, processingMode: 'strict' }, ctx);
          if (!outcome.available) return { outcome, verified: false };
          if (outcome.ok) return { outcome, verified: true };
        }
        return { outcome, verified: outcome.ok };
      };

      let strictRun = await safeRunStrict(runStrict, strictInput, ctx);
      let strictVerified = strictRun.ok;

      if (!strictRun.available) {
        layer2 = {
          status: 'skipped',
          issues: [],
          reason: strictRun.message ?? 'DITA-OT runtime is not available.',
        };
      } else if (!strictRun.ok) {
        // 1. Pre-scan with `lax` so the agent (and the fallback loop) learns about every broken
        //    file, not only the one `strict` happened to abort on.
        if (artifacts.length > 1) {
          const lax = await safeRunStrict(runStrict, { ...strictInput, processingMode: 'lax' }, ctx);
          if (!lax.available) throwIfAborted(ctx.signal);
          if (lax.available && !lax.ok) strictRun = mergeStrictRuns(strictRun, lax);
        }

        // 2. Tool-using agent: batch-read + batch-write every broken file, then verify once.
        const { runDitaOtRepairAgent } = await import('./dita-ot-repair-agent.js');
        const agentResult = await runDitaOtRepairAgent(
          {
            plan: input.plan,
            artifacts,
            stagingDir,
            targets,
            rootMapPath: input.plan.rootMapPath,
            keysMapPath:
              input.plan.createKeysMap && input.plan.suggestedKeys.length > 0
                ? keysMapPathFor(input.plan.rootMapPath)
                : null,
            availableAssetPaths,
            assetPathById,
            language,
            initialBrokenCount: Math.max(1, groupStrictErrors(strictRun.diagnostics).size),
            initialDiagnostics: strictRun.diagnostics,
            ...(callbacks ? { callbacks } : {}),
          },
          deps,
          ctx,
        );

        if (agentResult.usedToolAgent) {
          if (Object.keys(agentResult.repairedFiles).length > 0) repairedFiles = agentResult.repairedFiles;
          strictVerified = agentResult.strictVerified;
          if (strictVerified) {
            // Keep the warning diagnostics the agent's own `strict` run produced (external-link
            // DOTJ076W etc.); only the error items are gone, so the report stays truthful.
            strictRun = {
              available: true,
              ok: true,
              diagnostics: [...(agentResult.lastStrict?.diagnostics ?? [])],
            };
          }
        } else {
          // 3. Deterministic fallback loop (model without tool support).
          const fallback = await runDeterministicLayer2Repair(strictRun);
          strictRun = fallback.outcome;
          strictVerified = fallback.verified;
        }

        // 4. Deterministic final gate: never trust an unverified repair pass.
        if (!strictVerified && strictRun.available) {
          throwIfAborted(ctx.signal);
          strictRun = await safeRunStrict(runStrict, { ...strictInput, processingMode: 'strict' }, ctx);
          strictVerified = strictRun.ok;
        }
      }

      if (!strictRun.available) {
        layer2 = {
          status: 'skipped',
          issues: [],
          reason: strictRun.message ?? 'DITA-OT runtime is not available.',
        };
      } else {
        const strictItems = strictRun.diagnostics.map(toStrictItem);
        // A repaired topic must not keep stale DITA-OT errors from an earlier run.
        for (const artifact of artifacts) {
          artifact.issues = artifact.issues.filter((issue) => issue.source !== 'dita-ot');
        }
        attachIssuesByPath(
          artifacts,
          strictItems,
          (artifact) =>
            strictItems.filter(
              (item) => normalizePosixPath(item.path ?? '') === normalizePosixPath(artifact.node.filePath),
            ),
        );
        layer2 = {
          status: strictRun.ok ? 'passed' : 'failed',
          issues: strictItems,
          ...(strictRun.ok ? {} : { reason: strictRun.message ?? 'DITA-OT strict validation reported errors.' }),
        };
      }
    } finally {
      rmSync(stagingDir, { recursive: true, force: true });
    }
  }

  for (const artifact of artifacts) {
    artifact.ok = !artifact.issues.some((issue) => issue.severity === 'error');
  }

  // Topics whose Layer 2 outcome (or attempt count) changed must reach the wizard: without this a
  // repaired-but-still-broken topic kept showing "written" while the import failed.
  for (const artifact of artifacts) {
    const before = layer2Snapshot.get(normalizePosixPath(artifact.node.filePath));
    const changed = !before || before.ok !== artifact.ok || before.attempts !== artifact.repairAttempts;
    if (!changed) continue;
    const error = artifact.ok ? undefined : firstErrorMessage(artifact.issues);
    callbacks?.onTopicStatus?.({
      topicId: artifact.node.topicId,
      filePath: artifact.node.filePath,
      title: artifact.node.title,
      status: artifact.ok ? 'done' : 'failed',
      attempts: artifact.repairAttempts,
      ...(error ? { error } : {}),
    });
  }

  const topics: IngestTopicValidationResult[] = artifacts.map((artifact) => ({
    topicId: artifact.node.topicId,
    filePath: artifact.node.filePath,
    title: artifact.node.title,
    ok: artifact.ok,
    issues: artifact.issues,
    repaired: artifact.repaired,
    attempts: artifact.repairAttempts,
  }));

  const validationReport: IngestValidationReport = {
    ok:
      artifacts.every((artifact) => artifact.ok) &&
      layer1Ok &&
      layer2.status !== 'failed',
    generatedAt: Date.now(),
    layer1: { ok: layer1Ok, issues: layer1Issues },
    layer2,
    topics,
    assetIssues: layer1Issues.filter((issue) => issue.source === 'asset'),
  };

  return {
    artifacts,
    validationReport,
    ...(repairedFiles ? { repairedFiles } : {}),
  };
}

/* ------------------------------------------------------------------------------------------ */
/* Layer 2 helpers                                                                            */
/* ------------------------------------------------------------------------------------------ */

function buildGeneratedFiles(
  input: ValidateBatchInput,
  artifacts: readonly GeneratedTopicArtifact[],
): Record<string, string> {
  const files: Record<string, string> = {};
  for (const [path, content] of Object.entries(input.baselineFiles ?? {})) {
    files[normalizePosixPath(path)] = content;
  }
  files[normalizePosixPath(input.plan.rootMapPath)] = buildMapXmlFromPlan(input.plan);
  if (input.plan.createKeysMap && input.plan.suggestedKeys.length > 0) {
    files[normalizePosixPath(keysMapPathFor(input.plan.rootMapPath))] = buildKeysMapXml(input.plan);
  }
  for (const artifact of artifacts) {
    files[normalizePosixPath(artifact.node.filePath)] = artifact.xml;
  }
  return files;
}

function buildSemanticIndex(files: Record<string, string>, ctx: IngestAgentContext): DitaSemanticIndex {
  const index = new DitaSemanticIndex();
  index.setUiLocale(ctx.locale);
  index.loadFiles(files);
  return index;
}

async function resolveStrictAvailability(
  deps: IngestAgentDeps,
  ctx: IngestAgentContext,
): Promise<{ available: boolean; reason?: string }> {
  if (deps.strictValidator) return { available: true };
  try {
    const info = await detectDitaRuntime(deps.ditaRuntime ?? {}, { locale: ctx.locale });
    if (info.available) return { available: true };
    return {
      available: false,
      reason: info.error ?? `DITA-OT runtime is not available (${info.command}).`,
    };
  } catch (error) {
    return { available: false, reason: describeError(error) };
  }
}

interface StrictRunOutcome {
  available: boolean;
  ok: boolean;
  diagnostics: StrictDiagnostic[];
  message?: string;
}

/** Union of two runs' diagnostics: `strict` fail-fast misses every file after the first error. */
function mergeStrictRuns(base: StrictRunOutcome, extra: StrictRunOutcome): StrictRunOutcome {
  const seen = new Set<string>();
  const diagnostics: StrictDiagnostic[] = [];
  for (const diagnostic of [...base.diagnostics, ...extra.diagnostics]) {
    const key = `${diagnostic.filePath}|${diagnostic.line ?? 0}|${diagnostic.column ?? 0}|${diagnostic.code ?? ''}|${diagnostic.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    diagnostics.push(diagnostic);
  }
  return {
    available: base.available && extra.available,
    ok: base.ok && extra.ok,
    diagnostics,
    ...(base.message ? { message: base.message } : {}),
  };
}

/** Runs strict validation, converting thrown errors into a failed (not thrown) outcome. */
async function safeRunStrict(
  run: (input: Parameters<typeof validateStrict>[0]) => Promise<Awaited<ReturnType<typeof validateStrict>>>,
  strictInput: Parameters<typeof validateStrict>[0],
  ctx: IngestAgentContext,
): Promise<StrictRunOutcome> {
  try {
    const result = await run(strictInput);
    throwIfAborted(ctx.signal);
    return {
      available: result.available,
      ok: result.ok,
      diagnostics: result.diagnostics,
      ...(result.message ? { message: result.message } : {}),
    };
  } catch (error) {
    if (ctx.signal?.aborted) throw error;
    return {
      available: true,
      ok: false,
      diagnostics: [],
      message: `DITA-OT strict validation failed to run: ${describeError(error)}`,
    };
  }
}

function groupStrictErrors(diagnostics: readonly StrictDiagnostic[]): Map<string, StrictDiagnostic[]> {
  const grouped = new Map<string, StrictDiagnostic[]>();
  for (const diagnostic of diagnostics) {
    if (diagnostic.severity !== 'error') continue;
    const key = normalizePosixPath(diagnostic.filePath || '');
    const bucket = grouped.get(key);
    if (bucket) bucket.push(diagnostic);
    else grouped.set(key, [diagnostic]);
  }
  return grouped;
}

function toStrictItem(diagnostic: StrictDiagnostic): IngestDiagnosticItem {
  return {
    source: 'dita-ot',
    severity: diagnostic.severity,
    code: diagnostic.code ?? 'dita-ot-error',
    message: diagnostic.message,
    path: normalizePosixPath(diagnostic.filePath || ''),
    line: diagnostic.line,
    column: diagnostic.column,
  };
}

function toSemanticItem(diagnostic: SemanticDiagnostic): IngestDiagnosticItem {
  return {
    source: 'semantic',
    severity: diagnostic.severity,
    code: diagnostic.source,
    message: diagnostic.message,
    path: normalizePosixPath(diagnostic.filePath),
    line: diagnostic.line,
    column: diagnostic.column,
  };
}

function attachIssuesByPath(
  artifacts: readonly GeneratedTopicArtifact[],
  items: readonly IngestDiagnosticItem[],
  pick?: (artifact: GeneratedTopicArtifact) => IngestDiagnosticItem[],
): void {
  for (const artifact of artifacts) {
    const path = normalizePosixPath(artifact.node.filePath);
    const extra = pick ? pick(artifact) : items.filter((item) => normalizePosixPath(item.path ?? '') === path);
    if (extra.length > 0) artifact.issues.push(...extra);
  }
}

/* ------------------------------------------------------------------------------------------ */
/* Staging helpers                                                                            */
/* ------------------------------------------------------------------------------------------ */

function stagingPath(workDir: string, relativePath: string): string {
  const target = resolve(workDir, normalizePosixPath(relativePath));
  const root = resolve(workDir);
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new Error(`Refusing to write outside the staging directory: ${relativePath}`);
  }
  return target;
}

function writeStagingFile(workDir: string, relativePath: string, content: string): void {
  const target = stagingPath(workDir, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content, 'utf8');
}

function writeStagingAsset(workDir: string, asset: ExtractedIngestAsset, relativePath: string): void {
  const target = stagingPath(workDir, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  if (asset.base64) {
    writeFileSync(target, Buffer.from(asset.base64, 'base64'));
    return;
  }
  if (asset.sourcePath && existsSync(asset.sourcePath)) {
    copyFileSync(asset.sourcePath, target);
  }
}

/* ------------------------------------------------------------------------------------------ */
/* Usage & misc                                                                               */
/* ------------------------------------------------------------------------------------------ */

function recordRepairUsage(
  deps: IngestAgentDeps,
  ctx: IngestAgentContext,
  input: RepairTopicInput,
  config: ResolvedAiConfig,
  outcome: {
    status: 'succeeded' | 'failed' | 'cancelled';
    durationMs: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
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
      subAction: input.layer,
      filePath: input.node.filePath,
      model: config.model,
      status: outcome.status,
      retryCount: input.attempt,
      promptTokens: outcome.promptTokens,
      completionTokens: outcome.completionTokens,
      totalTokens: outcome.totalTokens,
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
  return { promptTokens, completionTokens, totalTokens: usage?.total_tokens ?? promptTokens + completionTokens };
}

function readMessageText(message: BaseMessage): string {
  const content = message.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') return part.text;
        return '';
      })
      .join('');
  }
  return String(content ?? '');
}

function firstErrorMessage(issues: readonly IngestDiagnosticItem[]): string {
  return issues.find((issue) => issue.severity === 'error')?.message ?? 'Validation failed.';
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export type { IngestOutlinePlan, PlannedTopicNode };
