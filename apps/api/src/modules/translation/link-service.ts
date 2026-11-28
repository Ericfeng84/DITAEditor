import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setRootXmlLang } from '@dita/core';
import { and, eq } from 'drizzle-orm';
import type { DitaDatabase } from '../../db/client.js';
import {
  translationFileStates,
  translationItems,
  translationJobs,
  translationLinks,
  type TranslationLinkRow,
} from '../../db/schema.js';
import type { ApiLocale } from '../../i18n/locale.js';
import { httpError } from '../errors.js';
import { validateBranchName, type GitManager } from '../git/git-manager.js';
import type { IdentityUser } from '../identity/identity-service.js';
import type { ManualView } from '../manuals/manual-registry-service.js';
import type { ManualRegistryService } from '../manuals/manual-registry-service.js';
import { classifyTranslationFileKind, isIgnoredTranslationPath } from './sync-service.js';
import type { IncrementalSyncService } from './sync-service.js';
import {
  countFileStatuses,
  isValidLangTag,
  normalizeLangTag,
  type CreateTranslationLinkInput,
  type TranslationFileCounts,
  type TranslationLinkView,
  type TranslationManualSummary,
  type UpdateTranslationLinkInput,
} from './types.js';

/** Reads one link row or raises the module's 404. Shared with `IncrementalSyncService`. */
export function readLinkRow(db: DitaDatabase, linkId: string): TranslationLinkRow {
  const row = db
    .select()
    .from(translationLinks)
    .where(eq(translationLinks.id, linkId))
    .limit(1)
    .get();
  if (!row) throw httpError(404, 'translation.linkNotFound', { id: linkId });
  return row;
}

function parseOptions(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // A corrupt options blob must never break the translation center.
  }
  return {};
}

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

/** Root map of the source manual: explicit default → root-level map → first map anywhere. */
function pickSkeletonMap(
  tree: ReadonlyArray<{ path: string }>,
  defaultRootMap: string | null | undefined,
): string | null {
  const paths = tree.map((entry) => entry.path);
  const declared = defaultRootMap?.trim();
  if (declared && paths.includes(declared)) return declared;
  const isKeyMap = (entry: string): boolean =>
    /(^|\/)(keys\.ditamap|[^/]*-keys\.ditamap)$/i.test(entry);
  const maps = paths
    .filter((entry) => entry.toLowerCase().endsWith('.ditamap'))
    .sort((a, b) => a.localeCompare(b));
  // A key-definition map is a supporting map: never let it become the target's root map.
  const preferred = maps.filter((entry) => !isKeyMap(entry));
  const candidates = preferred.length > 0 ? preferred : maps;
  return candidates.find((entry) => !entry.includes('/')) ?? candidates[0] ?? null;
}

/** Node identity inside the lineage graph: one manual at one branch. */
function familyNodeKey(manualId: string, branch: string): string {
  return `${manualId}\u0000${branch}`;
}

/**
 * Phase 16 — undirected breadth-first walk over the `(manualId, branch)` lineage graph.
 *
 * Every link row joins its two endpoints regardless of direction, so the returned set is the whole
 * connected language family: the root, every sibling branch and every descendant level. Pure
 * function: the lineage rules can be reasoned about without touching SQLite.
 *
 * Omitting `seedBranch` starts the walk from every `(seedManualId, branch)` occurrence in
 * `allRows`. Family-wide language uniqueness relies on that: a duplicate language must be caught
 * even when the clashing translation lives on another branch of the same manual.
 */
export function collectFamilyLinkRows(
  allRows: readonly TranslationLinkRow[],
  seedManualId: string,
  seedBranch?: string,
): TranslationLinkRow[] {
  const queue: string[] = [];
  if (seedBranch !== undefined) {
    queue.push(familyNodeKey(seedManualId, seedBranch));
  } else {
    for (const row of allRows) {
      if (row.sourceManualId === seedManualId) {
        queue.push(familyNodeKey(row.sourceManualId, row.sourceBranch));
      }
      if (row.targetManualId === seedManualId) {
        queue.push(familyNodeKey(row.targetManualId, row.targetBranch));
      }
    }
  }

  const visited = new Set<string>();
  while (queue.length > 0) {
    const node = queue.shift() as string;
    if (visited.has(node)) continue;
    visited.add(node);
    for (const row of allRows) {
      if (familyNodeKey(row.sourceManualId, row.sourceBranch) === node) {
        queue.push(familyNodeKey(row.targetManualId, row.targetBranch));
      } else if (familyNodeKey(row.targetManualId, row.targetBranch) === node) {
        queue.push(familyNodeKey(row.sourceManualId, row.sourceBranch));
      }
    }
  }

  return allRows.filter(
    (row) =>
      visited.has(familyNodeKey(row.sourceManualId, row.sourceBranch)) &&
      visited.has(familyNodeKey(row.targetManualId, row.targetBranch)),
  );
}

/**
 * Phase 16 (§Q3) — every normalized language code already occupied by the connected family: the
 * root language plus the `sourceLang` / `targetLang` of every link in it.
 *
 * `excludeLinkId` is for `updateLink()`: the edge being re-labelled must not count its own old
 * language, while the caller re-adds the source manual's language explicitly because that label
 * lives on the edge too.
 */
export function collectFamilyLanguages(
  allRows: readonly TranslationLinkRow[],
  seedManualId: string,
  seedBranch?: string,
  excludeLinkId?: string,
): Set<string> {
  const langs = new Set<string>();
  for (const row of collectFamilyLinkRows(allRows, seedManualId, seedBranch)) {
    if (excludeLinkId !== undefined && row.id === excludeLinkId) continue;
    for (const value of [row.sourceLang, row.targetLang]) {
      const normalized = normalizeLangTag(value);
      if (normalized) langs.add(normalized);
    }
  }
  return langs;
}

/** Deterministic lineage ordering: newest link first, id as the stable tie-breaker. */
function compareLinkRows(a: TranslationLinkRow, b: TranslationLinkRow): number {
  if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
  return a.id.localeCompare(b.id);
}

export interface TranslationLinkServiceOptions {
  db: DitaDatabase;
  git: GitManager;
  registry: ManualRegistryService;
  sync: IncrementalSyncService;
}

/**
 * Phase 16 Stage 2 — pairing a source manual with a target-language manual.
 *
 * Every operation is metadata-only: links and their per-file watermarks live in SQLite, and the
 * only files ever written are the ones of a *newly created* target manual (skeleton map + images,
 * committed as its initial baseline). Existing target manuals are never touched here.
 */
export class TranslationLinkService {
  private readonly db: DitaDatabase;
  private readonly git: GitManager;
  private readonly registry: ManualRegistryService;
  private readonly sync: IncrementalSyncService;

  constructor(options: TranslationLinkServiceOptions) {
    this.db = options.db;
    this.git = options.git;
    this.registry = options.registry;
    this.sync = options.sync;
  }

  // ------------------------------------------------------------------------------------------
  // Read paths
  // ------------------------------------------------------------------------------------------

  private async manualSummary(manualId: string): Promise<TranslationManualSummary | null> {
    try {
      const manual: ManualView = await this.registry.get(manualId);
      return {
        id: manual.id,
        name: manual.name,
        rootDir: manual.rootDir,
        exists: manual.exists,
        sourceLang: manual.sourceLang,
      };
    } catch {
      return null;
    }
  }

  private countFiles(linkId: string): TranslationFileCounts {
    const rows = this.db
      .select({ status: translationFileStates.status })
      .from(translationFileStates)
      .where(eq(translationFileStates.linkId, linkId))
      .all();
    return countFileStatuses(rows);
  }

  private async toView(row: TranslationLinkRow): Promise<TranslationLinkView> {
    const [sourceManual, targetManual] = await Promise.all([
      this.manualSummary(row.sourceManualId),
      this.manualSummary(row.targetManualId),
    ]);
    return {
      id: row.id,
      sourceManualId: row.sourceManualId,
      sourceBranch: row.sourceBranch,
      sourceLang: row.sourceLang,
      targetManualId: row.targetManualId,
      targetBranch: row.targetBranch,
      targetLang: row.targetLang,
      options: parseOptions(row.optionsJson),
      createdBy: row.createdBy,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
      sourceManual,
      targetManual,
      counts: this.countFiles(row.id),
    };
  }

  /**
   * Lists links, optionally narrowed to one manual (either side) and branch.
   *
   * Passing `manualId` returns the whole connected language family of that manual — whether the
   * entry point is the family root, an intermediate hub language or a leaf (§3.1 of the Phase 16
   * lineage plan). Passing `branch` alongside it keeps the walk inside that branch's graph, so
   * unrelated branches never leak into the translation center.
   */
  async listLinks(filter: { manualId?: string; branch?: string } = {}): Promise<TranslationLinkView[]> {
    const rows = this.db.select().from(translationLinks).all();
    const manualId = filter.manualId?.trim();
    const branch = filter.branch?.trim();

    let selected: TranslationLinkRow[];
    if (manualId) {
      selected = collectFamilyLinkRows(rows, manualId, branch || undefined);
    } else if (branch) {
      selected = rows.filter((row) => row.sourceBranch === branch || row.targetBranch === branch);
    } else {
      selected = rows;
    }

    return await Promise.all([...selected].sort(compareLinkRows).map((row) => this.toView(row)));
  }

  async getLink(linkId: string): Promise<TranslationLinkView> {
    return await this.toView(readLinkRow(this.db, linkId));
  }

  // ------------------------------------------------------------------------------------------
  // Mutations
  // ------------------------------------------------------------------------------------------

  private assertLangOrThrow(value: string): string {
    const normalized = normalizeLangTag(value);
    if (!normalized || !isValidLangTag(normalized)) {
      throw httpError(400, 'translation.invalidLang', { lang: value });
    }
    return normalized;
  }

  private assertWriter(user: IdentityUser): void {
    if (user.role === 'viewer') throw httpError(403, 'translation.viewerForbidden');
  }

  private assertBranch(branch: string): string {
    try {
      return validateBranchName(branch);
    } catch {
      throw httpError(400, 'translation.invalidBranch', { branch });
    }
  }

  /** Breadth-first search over the link graph; the returned path is what the 409 reports. */
  private findCyclePath(
    edges: Map<string, Set<string>>,
    from: string,
    to: string,
  ): string[] | null {
    const parents = new Map<string, string | null>([
      [from, null],
    ]);
    const queue: string[] = [from];
    while (queue.length > 0) {
      const node = queue.shift() as string;
      if (node === to) {
        const path: string[] = [node];
        let cursor = parents.get(node) ?? null;
        while (cursor) {
          path.unshift(cursor);
          cursor = parents.get(cursor) ?? null;
        }
        return path;
      }
      for (const next of edges.get(node) ?? []) {
        if (parents.has(next)) continue;
        parents.set(next, node);
        queue.push(next);
      }
    }
    return null;
  }

  /**
   * Creates a source→target link.
   *
   * Default mode materialises a **new** target manual containing only the skeleton: the root
   * `.ditamap` with `xml:lang` rewritten plus every image/binary asset. Topics are deliberately
   * deferred until a reviewed translation is checked in (§1.2 default #1), so the target manual
   * is a truthful translation of the source rather than a copy of it.
   */
  async createLink(
    input: CreateTranslationLinkInput,
    user: IdentityUser,
    locale: ApiLocale,
  ): Promise<TranslationLinkView> {
    this.assertWriter(user);

    const targetLang = this.assertLangOrThrow(input.targetLang);
    const sourceRow = await this.registry.requireRow(input.sourceManualId);
    const sourceLang =
      input.sourceLang !== undefined && input.sourceLang !== null && input.sourceLang.trim() !== ''
        ? this.assertLangOrThrow(input.sourceLang)
        : await this.registry.ensureSourceLang(sourceRow.id);
    if (!sourceLang) throw httpError(400, 'translation.sourceLangRequired');
    if (sourceLang !== sourceRow.sourceLang) {
      await this.registry.setSourceLang(sourceRow.id, sourceLang);
    }
    if (normalizeLangTag(sourceLang) === targetLang) {
      throw httpError(400, 'translation.sameLang', { lang: targetLang });
    }

    const sourceBranch = input.sourceBranch?.trim()
      ? this.assertBranch(input.sourceBranch)
      : await this.git.currentBranch(sourceRow.rootDir);

    const allRows = this.db.select().from(translationLinks).all();

    // Uniqueness on the source side: one target language per source branch.
    const sameSourceAndLang = allRows.find(
      (row) =>
        row.sourceManualId === sourceRow.id &&
        row.sourceBranch === sourceBranch &&
        row.targetLang === targetLang,
    );
    if (sameSourceAndLang) {
      throw httpError(409, 'translation.targetLangExists', { lang: targetLang });
    }

    // Phase 16 Q3: one language per edition across the whole family, including other branches of
    // the same manual. The source manual's own language is part of the occupancy set.
    const sourceFamilyLangs = collectFamilyLanguages(allRows, sourceRow.id);
    const sourceLangCode = normalizeLangTag(sourceLang);
    if (sourceLangCode) sourceFamilyLangs.add(sourceLangCode);
    if (sourceFamilyLangs.has(targetLang)) {
      throw httpError(409, 'translation.familyLangExists', { lang: targetLang });
    }

    const existingEdges = new Map<string, Set<string>>();
    for (const row of allRows) {
      const bucket = existingEdges.get(row.sourceManualId) ?? new Set<string>();
      bucket.add(row.targetManualId);
      existingEdges.set(row.sourceManualId, bucket);
    }

    let targetManualId: string;
    let targetBranch: string;

    if (input.targetManualId?.trim()) {
      const targetManual = await this.registry.requireRow(input.targetManualId.trim()).catch(() => {
        throw httpError(404, 'translation.manualNotFound', { id: input.targetManualId ?? '' });
      });
      if (targetManual.id === sourceRow.id) throw httpError(400, 'translation.selfLink');

      targetManualId = targetManual.id;
      targetBranch = input.targetBranch?.trim()
        ? this.assertBranch(input.targetBranch)
        : await this.git.currentBranch(targetManual.rootDir);

      const clash = allRows.find(
        (row) => row.targetManualId === targetManualId && row.targetBranch === targetBranch,
      );
      if (clash) throw httpError(409, 'translation.targetAlreadyLinked');

      // Binding a manual that already carries a family of its own: merging the two trees must not
      // produce the same language twice (e.g. attaching an `en-US` subtree that already contains
      // an `ar-SA` edition to a family that has one as well).
      const targetFamilyLangs = collectFamilyLanguages(allRows, targetManualId);
      const targetLangCode = normalizeLangTag(targetManual.sourceLang ?? targetLang);
      if (targetLangCode) targetFamilyLangs.add(targetLangCode);
      const overlap = [...targetFamilyLangs].filter((lang) => sourceFamilyLangs.has(lang));
      if (overlap.length > 0) {
        throw httpError(409, 'translation.familyLangExists', { lang: overlap[0] as string });
      }

      if (!targetManual.sourceLang) {
        await this.registry.setSourceLang(targetManual.id, targetLang);
      }
    } else if (input.createTargetManual === false) {
      throw httpError(400, 'translation.manualNotFound', { id: '' });
    } else {
      const created = await this.createTargetManual(sourceRow, targetLang, input, user, locale);
      targetManualId = created.manualId;
      targetBranch = created.branch;
    }

    const cycle = this.findCyclePath(existingEdges, targetManualId, sourceRow.id);
    if (cycle) {
      throw httpError(409, 'translation.cycleDetected', { path: cycle.join(' → ') });
    }

    const now = Date.now();
    const linkId = randomUUID();
    this.db
      .insert(translationLinks)
      .values({
        id: linkId,
        sourceManualId: sourceRow.id,
        sourceBranch,
        targetManualId,
        targetBranch,
        sourceLang,
        targetLang,
        optionsJson: JSON.stringify(input.options ?? {}),
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    // Populate `translation_file_states` immediately so the translation center opens with data.
    await this.sync.scanLink(linkId).catch(() => undefined);
    return await this.getLink(linkId);
  }

  /**
   * Creates the paired target manual: a blank workspace, the source root map with `xml:lang`
   * rewritten, every source image/binary asset, and one baseline commit.
   */
  private async createTargetManual(
    sourceRow: { id: string; name: string; rootDir: string; defaultRootMap: string | null },
    targetLang: string,
    input: CreateTranslationLinkInput,
    user: IdentityUser,
    locale: ApiLocale,
  ): Promise<{ manualId: string; branch: string }> {
    const name = input.targetManualName?.trim() || `${sourceRow.name} (${targetLang})`;
    const created = await this.registry.create(
      {
        mode: 'create',
        name,
        scaffold: 'blank',
        initGit: true,
        sourceLang: targetLang,
      },
      user,
      locale,
    );

    const sourceBranch = input.sourceBranch?.trim()
      ? this.assertBranch(input.sourceBranch)
      : await this.git.currentBranch(sourceRow.rootDir);
    const sourceWorkDir = this.git.isRepository(sourceRow.rootDir)
      ? await this.git.ensureWorktree(sourceRow.rootDir, sourceBranch, { createIfMissing: false })
      : sourceRow.rootDir;

    const tree = await this.git.listTreeFiles(sourceWorkDir, 'HEAD');
    const skeleton: Array<{ path: string; buffer: Buffer }> = [];

    const mapPath = pickSkeletonMap(tree, sourceRow.defaultRootMap);
    if (mapPath) {
      const xml = await this.git.fileAtRevision(sourceWorkDir, 'HEAD', mapPath);
      if (xml) {
        skeleton.push({
          path: mapPath,
          buffer: Buffer.from(setRootXmlLang(xml, targetLang), 'utf8'),
        });
      }
    }

    for (const entry of tree) {
      if (isIgnoredTranslationPath(entry.path)) continue;
      if (classifyTranslationFileKind(entry.path) !== 'asset') continue;
      const buffer = await this.git.fileBufferAtRevision(sourceWorkDir, 'HEAD', entry.path);
      if (buffer) skeleton.push({ path: entry.path, buffer });
    }

    for (const file of skeleton) {
      const destination = path.join(created.rootDir, file.path);
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, file.buffer);
    }

    if (skeleton.length > 0) {
      await this.git
        .commitExternalChanges(
          created.rootDir,
          `chore(translation): seed ${targetLang} skeleton of ${sourceRow.name}`,
          user,
        )
        .catch(() => undefined);
    }

    const branch = await this.git.currentBranch(created.rootDir);
    return { manualId: created.id, branch };
  }

  async updateLink(
    linkId: string,
    patch: UpdateTranslationLinkInput,
    user: IdentityUser,
  ): Promise<TranslationLinkView> {
    this.assertWriter(user);
    const row = readLinkRow(this.db, linkId);
    const updates: Partial<typeof translationLinks.$inferInsert> = { updatedAt: Date.now() };
    let rescan = false;

    if (patch.sourceBranch !== undefined) {
      const branch = this.assertBranch(patch.sourceBranch);
      if (branch !== row.sourceBranch) {
        updates.sourceBranch = branch;
        rescan = true;
      }
    }
    if (patch.targetBranch !== undefined) {
      const branch = this.assertBranch(patch.targetBranch);
      if (branch !== row.targetBranch) {
        const clash = this.db
          .select()
          .from(translationLinks)
          .all()
          .find(
            (candidate) =>
              candidate.id !== row.id &&
              candidate.targetManualId === row.targetManualId &&
              candidate.targetBranch === branch,
          );
        if (clash) throw httpError(409, 'translation.targetAlreadyLinked');
        updates.targetBranch = branch;
        rescan = true;
      }
    }
    const nextTargetBranch = updates.targetBranch ?? row.targetBranch;
    let relabelledTargetLang: string | null = null;

    if (patch.targetLang !== undefined) {
      const targetLang = this.assertLangOrThrow(patch.targetLang);
      if (targetLang === normalizeLangTag(row.sourceLang)) {
        throw httpError(400, 'translation.sameLang', { lang: targetLang });
      }
      if (targetLang !== row.targetLang) {
        const allRows = this.db.select().from(translationLinks).all();
        const clash = allRows.find(
          (candidate) =>
            candidate.id !== row.id &&
            candidate.sourceManualId === row.sourceManualId &&
            candidate.sourceBranch === (updates.sourceBranch ?? row.sourceBranch) &&
            candidate.targetLang === targetLang,
        );
        if (clash) throw httpError(409, 'translation.targetLangExists', { lang: targetLang });

        // Phase 16 Q3: the family may not end up with two editions of the same language.
        const familyLangs = collectFamilyLanguages(allRows, row.sourceManualId, undefined, row.id);
        const ownSourceLang = normalizeLangTag(row.sourceLang);
        if (ownSourceLang) familyLangs.add(ownSourceLang);
        if (familyLangs.has(targetLang)) {
          throw httpError(409, 'translation.familyLangExists', { lang: targetLang });
        }

        updates.targetLang = targetLang;
        relabelledTargetLang = targetLang;
        rescan = true;
      }
    }
    if (patch.options !== undefined) {
      updates.optionsJson = JSON.stringify(patch.options);
    }

    this.db.transaction((tx) => {
      tx.update(translationLinks).set(updates).where(eq(translationLinks.id, linkId)).run();
      if (!relabelledTargetLang) return;
      // The target manual is itself a source for its own children: relabel both sides in one
      // transaction so `sourceLang` never drifts away from what the manual actually contains.
      tx.update(translationLinks)
        .set({ sourceLang: relabelledTargetLang, updatedAt: Date.now() })
        .where(
          and(
            eq(translationLinks.sourceManualId, row.targetManualId),
            eq(translationLinks.sourceBranch, nextTargetBranch),
          ),
        )
        .run();
    });
    if (relabelledTargetLang) {
      await this.registry.setSourceLang(row.targetManualId, relabelledTargetLang).catch(() => undefined);
    }
    if (rescan) {
      await this.sync.scanLink(linkId).catch(() => undefined);
    }
    return await this.getLink(linkId);
  }

  /**
   * Removes the pairing and its translation metadata. Target manual files are never deleted:
   * unlinking a language must not destroy translated content.
   */
  async deleteLink(linkId: string, user: IdentityUser): Promise<{ deleted: boolean }> {
    this.assertWriter(user);
    readLinkRow(this.db, linkId);
    this.db.transaction((tx) => {
      tx.delete(translationItems).where(eq(translationItems.linkId, linkId)).run();
      tx.delete(translationJobs).where(eq(translationJobs.linkId, linkId)).run();
      tx.delete(translationFileStates).where(eq(translationFileStates.linkId, linkId)).run();
      tx.delete(translationLinks).where(eq(translationLinks.id, linkId)).run();
    });
    return { deleted: true };
  }
}
