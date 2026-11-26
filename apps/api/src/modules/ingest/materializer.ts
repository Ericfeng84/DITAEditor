/**
 * Phase 14 Stage 3 — safe materialization of an approved ingest plan.
 *
 * Two modes, both obeying the Phase 10/13 invariants:
 *
 * - `materializeNewManual()` creates a brand-new manual folder under the imports root (never
 *   colliding with an existing folder), writes map + topics + assets, initializes Git *after* the
 *   files exist so `workDir` starts clean at `HEAD`, stamps the manual id marker and registers it.
 * - `materializeIntoExistingManual()` NEVER touches the shared `workDir`: every generated file is
 *   written as the caller's personal draft (text or binary) behind an exclusive `file_locks` row,
 *   so the shared branch working tree stays `git status --porcelain === ''`.
 */

import { randomUUID } from 'node:crypto';
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import {
  buildKeysMapXml,
  buildMapXmlFromPlan,
  flattenPlannedTopics,
  keysMapPathFor,
  mountTopicsIntoExistingMap,
  normalizePlanPaths,
  type ExtractedIngestAsset,
  type IngestJobResult,
  type IngestOutlinePlan,
} from '@dita/core';
import type { GeneratedTopicArtifact } from './agent/types.js';
import { apiT } from '../../i18n/messages.js';
import type { ApiLocale } from '../../i18n/locale.js';
import type { GitManager } from '../git/git-manager.js';
import type { IdentityUser } from '../identity/identity-service.js';
import { fileExistsInOverlay, readFileWithOverlay } from '../files/overlay-workspace.js';
import type { WorkspaceFileNode } from '../files/workspace-fs.js';
import type { DraftService } from '../locks/draft-service.js';
import type { LockService } from '../locks/lock-service.js';
import type { ManualSession } from '../manuals/manual-context-resolver.js';
import {
  writeManualIdMarker,
  type ManualRegistryService,
} from '../manuals/manual-registry-service.js';

export interface MaterializerDeps {
  git: GitManager;
  registry: ManualRegistryService;
  drafts: DraftService;
  locks: LockService;
  importsRootDir: string;
}

/** One extracted asset together with the exact workspace path it should occupy. */
export interface IngestAssetPlacement {
  asset: ExtractedIngestAsset;
  /** POSIX workspace-relative path (`images/img_001.png`). */
  filePath: string;
}

export interface MaterializationArtifactsInput {
  plan: IngestOutlinePlan;
  artifacts: readonly GeneratedTopicArtifact[];
  assets: readonly ExtractedIngestAsset[];
  /** Pre-resolved target paths; when omitted each asset goes to `images/<fileName>`. */
  assetPlacements?: readonly IngestAssetPlacement[];
  /** The job staging `assets/` directory holding the extracted binaries. */
  assetsDir: string;
}

export interface MaterializeNewManualInput extends MaterializationArtifactsInput {
  user: IdentityUser;
  locale: ApiLocale;
  sourceFilename: string;
  /**
   * Workspace-relative `path → XML` overrides for the generated map files. Layer 2 repairs the root
   * map / keys map in staging (a cross-file link fix lives there), and that repaired XML — not a
   * freshly rebuilt one — must be what lands on disk.
   */
  fileOverrides?: Record<string, string>;
}

export interface MaterializeExistingManualInput extends MaterializationArtifactsInput {
  session: ManualSession;
  user: IdentityUser;
  locale: ApiLocale;
  mountMapPath?: string | null;
  /** DITA `parentElementPath` (element index path) used when mounting into the map. */
  mountParentPath?: readonly number[] | null;
}

const MAX_DIR_STEM = 60;

function sanitizeStem(raw: string): string {
  const base = raw
    .trim()
    .replace(/[\\/]+/g, '-')
    .replace(/\.[A-Za-z0-9]{1,10}$/u, '')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^[.\-]+|[.\-]+$/g, '');
  return (base || 'ingest').slice(0, MAX_DIR_STEM);
}

function normalizePosix(raw: string): string {
  return raw.replace(/\\/g, '/').replace(/^\/+/, '');
}

/** Every asset gets a deterministic default placement; the materializer honors caller overrides. */
export function defaultAssetPlacements(
  assets: readonly ExtractedIngestAsset[],
): IngestAssetPlacement[] {
  return assets.map((asset) => ({
    asset,
    filePath: `images/${path.posix.basename(normalizePosix(asset.fileName))}`,
  }));
}

/** Baseline file paths plus the caller's own draft paths — used for collision-free planning. */
export async function collectExistingPaths(
  session: ManualSession,
  drafts: DraftService,
  projectId: string,
  branch: string,
  userId: string,
): Promise<Set<string>> {
  const existing = new Set<string>();
  const snapshot = await session.workspace.scanWorkspace();
  const visit = (nodes: readonly WorkspaceFileNode[]): void => {
    for (const node of nodes) {
      if (node.kind !== 'directory') existing.add(node.path);
      if (node.children) visit(node.children);
    }
  };
  visit(snapshot.files);
  for (const row of drafts.listUserDrafts(projectId, branch, userId)) {
    if (row.op === 'delete') continue;
    existing.add(row.filePath);
  }
  return existing;
}

function suffixPath(desired: string, index: number): string {
  const dir = path.posix.dirname(desired);
  const ext = path.posix.extname(desired);
  const stem = path.posix.basename(desired, ext);
  const next = `${stem}_${index}${ext}`;
  return dir && dir !== '.' ? `${dir}/${next}` : next;
}

/**
 * Finds a free path for a generated file: not present in baseline/overlay and not locked by a
 * different checkout. Generated imports therefore never collide with existing content.
 */
export async function resolveFreePathForExistingManual(
  session: ManualSession,
  drafts: DraftService,
  locks: LockService,
  options: {
    projectId: string;
    branch: string;
    userId: string;
    desiredPath: string;
  },
): Promise<string> {
  const scope = { projectId: options.projectId, branch: options.branch, userId: options.userId };
  let candidate = normalizePosix(options.desiredPath);
  for (let index = 2; index <= 999; index += 1) {
    const exists = (await fileExistsInOverlay(session.workspace, drafts, scope, candidate)).exists;
    const locked = locks.find(options.projectId, options.branch, candidate);
    if (!exists && !locked) return candidate;
    candidate = suffixPath(normalizePosix(options.desiredPath), index);
  }
  return candidate;
}

/** Resolves every asset's final workspace path (collision- and lock-free) for an existing manual. */
export async function resolveExistingManualAssetPlacements(
  input: Pick<
    MaterializeExistingManualInput,
    'assets' | 'session' | 'user' | 'plan'
  >,
  deps: Pick<MaterializerDeps, 'drafts' | 'locks'> & { projectId: string },
): Promise<IngestAssetPlacement[]> {
  const placements: IngestAssetPlacement[] = [];
  for (const placement of defaultAssetPlacements(input.assets)) {
    const filePath = await resolveFreePathForExistingManual(
      input.session,
      deps.drafts,
      deps.locks,
      {
        projectId: deps.projectId,
        branch: input.session.branch,
        userId: input.user.id,
        desiredPath: placement.filePath,
      },
    );
    placements.push({ asset: placement.asset, filePath });
  }
  return placements;
}

async function readAssetBytes(
  assetsDir: string,
  asset: ExtractedIngestAsset,
): Promise<Buffer> {
  const fileName = path.basename(normalizePosix(asset.fileName));
  const candidate = path.join(assetsDir, fileName);
  if (existsSync(candidate)) {
    return fs.readFile(candidate);
  }
  if (asset.base64) {
    return Buffer.from(asset.base64, 'base64');
  }
  if (asset.sourcePath && existsSync(asset.sourcePath)) {
    return fs.readFile(asset.sourcePath);
  }
  throw new Error(`Extracted asset is missing from the staging directory: ${fileName}`);
}

async function writeFileWithDirs(absPath: string, data: string | Uint8Array): Promise<void> {
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, data);
}

function resultTopics(plan: IngestOutlinePlan): IngestJobResult['topics'] {
  return flattenPlannedTopics(plan.topics).map((node) => ({
    topicId: node.topicId,
    filePath: node.filePath,
    title: node.title,
  }));
}

function resultAssets(placements: readonly IngestAssetPlacement[]): IngestJobResult['assets'] {
  return placements.map((placement) => ({
    assetId: placement.asset.assetId,
    fileName: placement.asset.fileName,
    filePath: placement.filePath,
  }));
}

/* ------------------------------------------------------------------------------------------ */
/* New manual                                                                                 */
/* ------------------------------------------------------------------------------------------ */

/**
 * Materializes a brand-new manual under `importsRootDir`.
 *
 * Files are written *before* `git.ensureInitialized()` so the initial commit contains the whole
 * generated manual and the shared branch starts clean at `HEAD`. Any failure removes the folder
 * again, leaving no orphan behind.
 */
export async function materializeNewManual(
  input: MaterializeNewManualInput,
  deps: MaterializerDeps,
): Promise<IngestJobResult> {
  const { plan, artifacts, assets, assetsDir, user, locale } = input;
  const placements = input.assetPlacements ?? defaultAssetPlacements(assets);

  await fs.mkdir(deps.importsRootDir, { recursive: true });
  const stem = sanitizeStem(plan.title || input.sourceFilename);
  let dirName = stem;
  let counter = 2;
  while (existsSync(path.join(deps.importsRootDir, dirName))) {
    dirName = `${stem}-${counter}`;
    counter += 1;
  }
  const rootDir = path.join(deps.importsRootDir, dirName);
  await fs.mkdir(rootDir, { recursive: true });

  try {
    await writeFileWithDirs(
      path.join(rootDir, plan.rootMapPath),
      input.fileOverrides?.[normalizePosix(plan.rootMapPath)] ?? buildMapXmlFromPlan(plan),
    );
    if (plan.createKeysMap && plan.suggestedKeys.length > 0) {
      const keysMapPath = keysMapPathFor(plan.rootMapPath);
      await writeFileWithDirs(
        path.join(rootDir, keysMapPath),
        input.fileOverrides?.[normalizePosix(keysMapPath)] ?? buildKeysMapXml(plan),
      );
    }
    for (const artifact of artifacts) {
      await writeFileWithDirs(path.join(rootDir, artifact.node.filePath), artifact.xml);
    }
    for (const placement of placements) {
      const buffer = await readAssetBytes(assetsDir, placement.asset);
      await writeFileWithDirs(path.join(rootDir, placement.filePath), buffer);
    }

    await deps.git.ensureInitialized(rootDir);

    const manualId = randomUUID();
    await writeManualIdMarker(rootDir, manualId);

    const view = await deps.registry.registerDirectory(rootDir, {
      name: plan.title,
      description: plan.summary ?? '',
      createdBy: user.id,
      locale,
      manualId,
    });
    if (view.defaultRootMap !== plan.rootMapPath && user.role !== 'viewer') {
      await deps.registry.update(view.id, { defaultRootMap: plan.rootMapPath }, user);
    }

    return {
      manualId: view.id,
      rootMapPath: plan.rootMapPath,
      topics: resultTopics(plan),
      assets: resultAssets(placements),
      commitHash: (await deps.git.headCommit(rootDir)) ?? undefined,
      warnings: [],
    };
  } catch (error) {
    await fs.rm(rootDir, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}

/* ------------------------------------------------------------------------------------------ */
/* Existing manual — draft-only, never touches the shared workDir                              */
/* ------------------------------------------------------------------------------------------ */

/**
 * Materializes generated topics/assets into the caller's Draft Overlay.
 *
 * Strict Phase 13 invariant: the shared branch `workDir` is only *read* (map XML, HEAD commit).
 * Every write becomes a `working_drafts` row guarded by an exclusive `file_locks` row.
 */
export async function materializeIntoExistingManual(
  input: MaterializeExistingManualInput,
  deps: MaterializerDeps,
): Promise<IngestJobResult> {
  const { plan, artifacts, assets, assetsDir, session, user, locale } = input;
  const projectId = deps.locks.ensureRepository(session.projectRootDir);
  const branch = session.branch;
  const workDir = session.workDir;
  const baseCommit = await deps.git.headCommit(workDir);

  const placements =
    input.assetPlacements ??
    (await resolveExistingManualAssetPlacements({ assets, session, user, plan }, { ...deps, projectId }));

  const scope = { projectId, branch, userId: user.id };
  const warnings: string[] = [];
  let draftCount = 0;

  const lockFile = async (filePath: string): Promise<void> => {
    await deps.locks.checkout({
      workDir,
      projectRootDir: session.projectRootDir,
      filePath,
      user,
      allowMissing: true,
    });
  };

  const resolvedPlacements: IngestAssetPlacement[] = [];
  for (const placement of placements) {
    const filePath = await resolveFreePathForExistingManual(session, deps.drafts, deps.locks, {
      projectId,
      branch,
      userId: user.id,
      desiredPath: placement.filePath,
    });
    await lockFile(filePath);
    const buffer = await readAssetBytes(assetsDir, placement.asset);
    deps.drafts.upsertBinaryDraft({
      projectId,
      branch,
      filePath,
      userId: user.id,
      op: 'create',
      buffer,
      ext: placement.asset.extension,
      baseCommit,
    });
    resolvedPlacements.push({ asset: placement.asset, filePath });
    draftCount += 1;
  }

  for (const artifact of artifacts) {
    const filePath = await resolveFreePathForExistingManual(session, deps.drafts, deps.locks, {
      projectId,
      branch,
      userId: user.id,
      desiredPath: artifact.node.filePath,
    });
    await lockFile(filePath);
    deps.drafts.upsertTextDraft({
      projectId,
      branch,
      filePath,
      userId: user.id,
      op: 'create',
      content: artifact.xml,
      baseCommit,
    });
    draftCount += 1;
  }

  let mountedMapPath: string | undefined;
  const requestedMapPath = input.mountMapPath ? normalizePosix(input.mountMapPath) : '';
  if (requestedMapPath) {
    const existingLock = deps.locks.find(projectId, branch, requestedMapPath);
    if (existingLock && existingLock.userId !== user.id) {
      // Never steal another user's checkout and never edit a map we do not own.
      warnings.push(
        apiT(locale, 'ingest.warn.mountMapLocked', {
          path: requestedMapPath,
          user: existingLock.userName || existingLock.userId,
        }),
      );
    } else {
      const map = await readFileWithOverlay(session.workspace, deps.drafts, scope, requestedMapPath);
      const mounted = mountTopicsIntoExistingMap(map.content, {
        mapPath: requestedMapPath,
        parentElementPath: input.mountParentPath ? [...input.mountParentPath] : null,
        topics: plan.topics,
      });
      await deps.locks.checkout({
        workDir,
        projectRootDir: session.projectRootDir,
        filePath: requestedMapPath,
        user,
      });
      const existingDraft = deps.drafts.getUserDraft(projectId, branch, user.id, requestedMapPath);
      deps.drafts.upsertTextDraft({
        projectId,
        branch,
        filePath: requestedMapPath,
        userId: user.id,
        op: existingDraft?.op ?? 'edit',
        content: mounted,
        baseCommit,
      });
      draftCount += 1;
      mountedMapPath = requestedMapPath;
    }
  }

  deps.drafts.bumpDraftRev(projectId, branch, user.id);

  return {
    manualId: session.manualId,
    ...(session.manual.defaultRootMap ? { rootMapPath: session.manual.defaultRootMap } : {}),
    ...(mountedMapPath ? { mountedMapPath } : {}),
    topics: resultTopics(plan),
    assets: resultAssets(resolvedPlacements),
    ...(baseCommit ? { commitHash: baseCommit } : {}),
    draftCount,
    warnings,
  };
}

/**
 * Re-normalizes a plan against an existing manual (baseline + caller drafts) so the Planner's
 * paths never overwrite content. Used before writing so writer hrefs and map refs stay stable.
 */
export async function normalizePlanForExistingManual(
  plan: IngestOutlinePlan,
  existingPaths: ReadonlySet<string>,
): Promise<IngestOutlinePlan> {
  return normalizePlanPaths(plan, {
    existingPaths,
    ...(plan.targetDir ? { targetDir: plan.targetDir } : {}),
  });
}
