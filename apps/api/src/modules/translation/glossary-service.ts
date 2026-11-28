import { randomUUID } from 'node:crypto';
import {
  mergeGlossaryEntries,
  previewGlossaryImport,
  serializeGlossaryCsv,
  serializeGlossaryJson,
  serializeGlossaryTbx,
  type GlossaryEntryForMatch,
  type GlossaryExchangeRow,
} from '@dita/core';
import { and, eq } from 'drizzle-orm';
import type { DitaDatabase } from '../../db/client.js';
import {
  glossaries,
  glossaryTerms,
  glossaryTranslations,
  type GlossaryRow,
  type GlossaryTermRow,
  type GlossaryTranslationRow,
} from '../../db/schema.js';
import { httpError } from '../errors.js';
import type { IdentityUser } from '../identity/identity-service.js';
import {
  isValidLangTag,
  langTagsMatch,
  normalizeLangTag,
  type CreateGlossaryInput,
  type CreateGlossaryTermInput,
  type EffectiveGlossaryResult,
  type GlossaryExportResult,
  type GlossaryImportInput,
  type GlossaryImportResult,
  type GlossaryScope,
  type GlossaryTermFilter,
  type GlossaryTermStatus,
  type GlossaryTermView,
  type GlossaryTranslationInput,
  type GlossaryTranslationView,
  type GlossaryView,
  type UpdateGlossaryInput,
  type UpdateGlossaryTermInput,
} from './types.js';

const TERM_STATUSES: ReadonlySet<string> = new Set(['approved', 'draft', 'deprecated']);
const EXPORT_META: Record<'csv' | 'json' | 'tbx', { contentType: string; extension: string }> = {
  csv: { contentType: 'text/csv; charset=utf-8', extension: 'csv' },
  json: { contentType: 'application/json; charset=utf-8', extension: 'json' },
  tbx: { contentType: 'application/xml; charset=utf-8', extension: 'tbx' },
};

function parseStringArray(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === 'string');
  } catch {
    return [];
  }
}

function stringArrayJson(values: ReadonlyArray<string> | undefined): string {
  if (!values) return '[]';
  const cleaned = values.map((value) => value.trim()).filter((value) => value.length > 0);
  return JSON.stringify(cleaned);
}

function toIso(ms: number): string {
  return new Date(ms).toISOString();
}

function safeFilename(name: string, extension: string): string {
  const base = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-').trim() || 'glossary';
  return `${base}.${extension}`;
}

export interface GlossaryServiceOptions {
  db: DitaDatabase;
}

/**
 * Phase 16 Stage 2 — glossary (terminology) storage and exchange.
 *
 * Glossaries are translation metadata, so they live only in SQLite: importing or editing terms
 * never rewrites DITA XML, maps, or Git history.
 */
export class GlossaryService {
  private readonly db: DitaDatabase;

  constructor(options: GlossaryServiceOptions) {
    this.db = options.db;
  }

  // ------------------------------------------------------------------------------------------
  // Glossary containers
  // ------------------------------------------------------------------------------------------

  private countTerms(glossaryId: string): number {
    return this.db
      .select({ id: glossaryTerms.id })
      .from(glossaryTerms)
      .where(eq(glossaryTerms.glossaryId, glossaryId))
      .all().length;
  }

  private toGlossaryView(row: GlossaryRow): GlossaryView {
    return {
      id: row.id,
      scope: row.scope,
      manualId: row.manualId ?? null,
      name: row.name,
      description: row.description,
      sourceLang: row.sourceLang,
      enabled: row.enabled !== 0,
      createdBy: row.createdBy,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
      termCount: this.countTerms(row.id),
    };
  }

  private readGlossaryRow(glossaryId: string): GlossaryRow {
    const row = this.db.select().from(glossaries).where(eq(glossaries.id, glossaryId)).limit(1).get();
    if (!row) throw httpError(404, 'glossary.notFound', { id: glossaryId });
    return row;
  }

  private readTermRow(termId: string): GlossaryTermRow {
    const row = this.db.select().from(glossaryTerms).where(eq(glossaryTerms.id, termId)).limit(1).get();
    if (!row) throw httpError(404, 'glossary.termNotFound', { id: termId });
    return row;
  }

  private assertWriter(user: IdentityUser): void {
    if (user.role === 'viewer') throw httpError(403, 'glossary.viewerForbidden');
  }

  private assertLang(value: string): string {
    const normalized = normalizeLangTag(value);
    if (!normalized || !isValidLangTag(normalized)) {
      throw httpError(400, 'translation.invalidLang', { lang: value });
    }
    return normalized;
  }

  listGlossaries(
    filter: { scope?: GlossaryScope; manualId?: string; sourceLang?: string } = {},
  ): GlossaryView[] {
    const rows = this.db.select().from(glossaries).all();
    const manualId = filter.manualId?.trim();
    const sourceLang = filter.sourceLang?.trim();
    return rows
      .filter((row) => (filter.scope ? row.scope === filter.scope : true))
      .filter((row) => {
        if (!manualId) return true;
        // A manual's translation center needs the global glossaries plus its own.
        return row.scope === 'global' || row.manualId === manualId;
      })
      .filter((row) => (sourceLang ? langTagsMatch(row.sourceLang, sourceLang) : true))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((row) => this.toGlossaryView(row));
  }

  getGlossary(glossaryId: string): GlossaryView {
    return this.toGlossaryView(this.readGlossaryRow(glossaryId));
  }

  createGlossary(input: CreateGlossaryInput, user: IdentityUser): GlossaryView {
    this.assertWriter(user);
    const name = input.name?.trim();
    if (!name) throw httpError(400, 'glossary.nameRequired');
    const sourceLang = this.assertLang(input.sourceLang?.trim() ?? '');
    const scope: GlossaryScope = input.scope ?? 'global';
    if (scope === 'manual' && !input.manualId?.trim()) {
      throw httpError(400, 'glossary.manualRequired');
    }
    const now = Date.now();
    const id = randomUUID();
    this.db
      .insert(glossaries)
      .values({
        id,
        scope,
        manualId: scope === 'manual' ? (input.manualId?.trim() ?? null) : null,
        name,
        description: input.description?.trim() ?? '',
        sourceLang,
        enabled: input.enabled === false ? 0 : 1,
        createdBy: user.id,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    return this.getGlossary(id);
  }

  updateGlossary(glossaryId: string, patch: UpdateGlossaryInput, user: IdentityUser): GlossaryView {
    this.assertWriter(user);
    this.readGlossaryRow(glossaryId);
    const updates: Partial<typeof glossaries.$inferInsert> = { updatedAt: Date.now() };
    if (patch.name !== undefined) {
      const name = patch.name.trim();
      if (!name) throw httpError(400, 'glossary.nameRequired');
      updates.name = name;
    }
    if (patch.description !== undefined) updates.description = patch.description.trim();
    if (patch.sourceLang !== undefined) updates.sourceLang = this.assertLang(patch.sourceLang);
    if (patch.enabled !== undefined) updates.enabled = patch.enabled ? 1 : 0;
    this.db.update(glossaries).set(updates).where(eq(glossaries.id, glossaryId)).run();
    return this.getGlossary(glossaryId);
  }

  deleteGlossary(glossaryId: string, user: IdentityUser): { deleted: boolean } {
    this.assertWriter(user);
    this.readGlossaryRow(glossaryId);
    this.db.transaction((tx) => {
      const termIds = tx
        .select({ id: glossaryTerms.id })
        .from(glossaryTerms)
        .where(eq(glossaryTerms.glossaryId, glossaryId))
        .all()
        .map((row) => row.id);
      for (const termId of termIds) {
        tx.delete(glossaryTranslations).where(eq(glossaryTranslations.termId, termId)).run();
      }
      tx.delete(glossaryTerms).where(eq(glossaryTerms.glossaryId, glossaryId)).run();
      tx.delete(glossaries).where(eq(glossaries.id, glossaryId)).run();
    });
    return { deleted: true };
  }

  // ------------------------------------------------------------------------------------------
  // Terms & translations
  // ------------------------------------------------------------------------------------------

  private translationViews(termId: string): GlossaryTranslationView[] {
    return this.db
      .select()
      .from(glossaryTranslations)
      .where(eq(glossaryTranslations.termId, termId))
      .all()
      .sort((a, b) => a.targetLang.localeCompare(b.targetLang))
      .map((row: GlossaryTranslationRow) => ({
        id: row.id,
        termId: row.termId,
        targetLang: row.targetLang,
        targetTerm: row.targetTerm,
        forbiddenTargets: parseStringArray(row.forbiddenTargetsJson),
        notes: row.notes ?? null,
        updatedAt: toIso(row.updatedAt),
      }));
  }

  private toTermView(row: GlossaryTermRow): GlossaryTermView {
    return {
      id: row.id,
      glossaryId: row.glossaryId,
      sourceTerm: row.sourceTerm,
      synonyms: parseStringArray(row.synonymsJson),
      caseSensitive: row.caseSensitive !== 0,
      doNotTranslate: row.doNotTranslate !== 0,
      partOfSpeech: row.partOfSpeech ?? null,
      contextNote: row.contextNote ?? null,
      status: row.status,
      createdAt: toIso(row.createdAt),
      updatedAt: toIso(row.updatedAt),
      translations: this.translationViews(row.id),
    };
  }

  private normalizeStatus(value: string | undefined): GlossaryTermStatus {
    if (!value) return 'approved';
    if (!TERM_STATUSES.has(value)) {
      throw httpError(400, 'glossary.invalidFormat', { format: `status:${value}` });
    }
    return value as GlossaryTermStatus;
  }

  /** Writes (or replaces) every translation row of one term. */
  private writeTranslations(
    termId: string,
    translations: ReadonlyArray<GlossaryTranslationInput>,
    replace: boolean,
  ): number {
    if (replace) {
      this.db.delete(glossaryTranslations).where(eq(glossaryTranslations.termId, termId)).run();
    }
    let written = 0;
    const now = Date.now();
    for (const translation of translations) {
      const targetLang = this.assertLang(translation.targetLang);
      if (!translation.targetTerm?.trim()) {
        throw httpError(400, 'glossary.translationTargetRequired');
      }
      const existing = this.db
        .select()
        .from(glossaryTranslations)
        .where(
          and(
            eq(glossaryTranslations.termId, termId),
            eq(glossaryTranslations.targetLang, targetLang),
          ),
        )
        .limit(1)
        .get();
      const values = {
        targetTerm: translation.targetTerm.trim(),
        forbiddenTargetsJson: stringArrayJson(translation.forbiddenTargets),
        notes: translation.notes?.trim() || null,
        updatedAt: now,
      };
      if (existing) {
        this.db
          .update(glossaryTranslations)
          .set(values)
          .where(eq(glossaryTranslations.id, existing.id))
          .run();
      } else {
        this.db
          .insert(glossaryTranslations)
          .values({ id: randomUUID(), termId, targetLang, ...values })
          .run();
      }
      written += 1;
    }
    return written;
  }

  listTerms(glossaryId: string, filter: GlossaryTermFilter = {}): GlossaryTermView[] {
    this.readGlossaryRow(glossaryId);
    const search = filter.search?.trim().toLowerCase();
    const statuses = filter.status
      ? Array.isArray(filter.status)
        ? filter.status
        : [filter.status]
      : null;
    const targetLang = filter.targetLang?.trim() ? normalizeLangTag(filter.targetLang) : null;

    return this.db
      .select()
      .from(glossaryTerms)
      .where(eq(glossaryTerms.glossaryId, glossaryId))
      .all()
      .filter((row) => (statuses ? statuses.includes(row.status) : true))
      .filter((row) => {
        if (!search) return true;
        if (row.sourceTerm.toLowerCase().includes(search)) return true;
        return parseStringArray(row.synonymsJson).some((synonym) =>
          synonym.toLowerCase().includes(search),
        );
      })
      .filter((row) => {
        if (!targetLang) return true;
        return this.translationViews(row.id).some((entry) => entry.targetLang === targetLang);
      })
      .sort((a, b) => a.sourceTerm.localeCompare(b.sourceTerm))
      .map((row) => this.toTermView(row));
  }

  getTerm(termId: string): GlossaryTermView {
    return this.toTermView(this.readTermRow(termId));
  }

  createTerm(
    glossaryId: string,
    input: CreateGlossaryTermInput,
    user: IdentityUser,
  ): GlossaryTermView {
    this.assertWriter(user);
    this.readGlossaryRow(glossaryId);
    const sourceTerm = input.sourceTerm?.trim();
    if (!sourceTerm) throw httpError(400, 'glossary.sourceTermRequired');

    const duplicate = this.db
      .select()
      .from(glossaryTerms)
      .where(
        and(eq(glossaryTerms.glossaryId, glossaryId), eq(glossaryTerms.sourceTerm, sourceTerm)),
      )
      .limit(1)
      .get();
    if (duplicate) throw httpError(409, 'glossary.duplicateTerm', { term: sourceTerm });

    const now = Date.now();
    const id = randomUUID();
    this.db
      .insert(glossaryTerms)
      .values({
        id,
        glossaryId,
        sourceTerm,
        synonymsJson: stringArrayJson(input.synonyms),
        caseSensitive: input.caseSensitive ? 1 : 0,
        doNotTranslate: input.doNotTranslate ? 1 : 0,
        partOfSpeech: input.partOfSpeech?.trim() || null,
        contextNote: input.contextNote?.trim() || null,
        status: this.normalizeStatus(input.status),
        createdAt: now,
        updatedAt: now,
      })
      .run();
    if (input.translations?.length) {
      this.writeTranslations(id, input.translations, false);
    }
    return this.getTerm(id);
  }

  updateTerm(termId: string, patch: UpdateGlossaryTermInput, user: IdentityUser): GlossaryTermView {
    this.assertWriter(user);
    this.readTermRow(termId);
    const updates: Partial<typeof glossaryTerms.$inferInsert> = { updatedAt: Date.now() };
    if (patch.sourceTerm !== undefined) {
      const sourceTerm = patch.sourceTerm.trim();
      if (!sourceTerm) throw httpError(400, 'glossary.sourceTermRequired');
      updates.sourceTerm = sourceTerm;
    }
    if (patch.synonyms !== undefined) updates.synonymsJson = stringArrayJson(patch.synonyms);
    if (patch.caseSensitive !== undefined) updates.caseSensitive = patch.caseSensitive ? 1 : 0;
    if (patch.doNotTranslate !== undefined) updates.doNotTranslate = patch.doNotTranslate ? 1 : 0;
    if (patch.partOfSpeech !== undefined) updates.partOfSpeech = patch.partOfSpeech?.trim() || null;
    if (patch.contextNote !== undefined) updates.contextNote = patch.contextNote?.trim() || null;
    if (patch.status !== undefined) updates.status = this.normalizeStatus(patch.status);
    this.db.update(glossaryTerms).set(updates).where(eq(glossaryTerms.id, termId)).run();
    if (patch.translations?.length || patch.replaceTranslations) {
      this.writeTranslations(termId, patch.translations ?? [], patch.replaceTranslations === true);
    }
    return this.getTerm(termId);
  }

  deleteTerm(termId: string, user: IdentityUser): { deleted: boolean } {
    this.assertWriter(user);
    this.readTermRow(termId);
    this.db.transaction((tx) => {
      tx.delete(glossaryTranslations).where(eq(glossaryTranslations.termId, termId)).run();
      tx.delete(glossaryTerms).where(eq(glossaryTerms.id, termId)).run();
    });
    return { deleted: true };
  }

  // ------------------------------------------------------------------------------------------
  // Effective glossary (editor + QA input)
  // ------------------------------------------------------------------------------------------

  /**
   * Merges every enabled global glossary with the manual-scoped glossaries whose source language
   * matches, and keeps only translations for `targetLang`. `mergeGlossaryEntries()` applies the
   * `manual > global` precedence, so a manual can override a company-wide term.
   */
  resolveEffectiveGlossary(query: {
    manualId?: string | null;
    sourceLang?: string | null;
    targetLang: string;
  }): EffectiveGlossaryResult {
    const targetLang = this.assertLang(query.targetLang);
    const manualId = query.manualId?.trim() || null;
    const sourceLang = query.sourceLang?.trim() || null;

    const containers = this.db
      .select()
      .from(glossaries)
      .all()
      .filter((row) => row.enabled !== 0)
      .filter((row) => {
        if (row.scope === 'global') return true;
        return manualId !== null && row.manualId === manualId;
      })
      .filter((row) => (sourceLang ? langTagsMatch(row.sourceLang, sourceLang) : true));

    const entries: GlossaryEntryForMatch[] = [];
    for (const container of containers) {
      const terms = this.db
        .select()
        .from(glossaryTerms)
        .where(eq(glossaryTerms.glossaryId, container.id))
        .all()
        .filter((term) => term.status !== 'deprecated');
      for (const term of terms) {
        const translations = this.db
          .select()
          .from(glossaryTranslations)
          .where(
            and(
              eq(glossaryTranslations.termId, term.id),
              eq(glossaryTranslations.targetLang, targetLang),
            ),
          )
          .all();
        const translation = translations[0];
        if (!translation && term.doNotTranslate === 0) continue;
        entries.push({
          termId: term.id,
          glossaryId: container.id,
          scope: container.scope,
          sourceTerm: term.sourceTerm,
          synonyms: parseStringArray(term.synonymsJson),
          // A do-not-translate term keeps its source form in the target language.
          targetTerm: translation?.targetTerm ?? term.sourceTerm,
          forbiddenTargets: translation ? parseStringArray(translation.forbiddenTargetsJson) : [],
          caseSensitive: term.caseSensitive !== 0,
          doNotTranslate: term.doNotTranslate !== 0,
          contextNote: term.contextNote ?? undefined,
          partOfSpeech: term.partOfSpeech ?? undefined,
        });
      }
    }

    const merged = mergeGlossaryEntries(entries);
    return {
      manualId,
      sourceLang,
      targetLang,
      entries: merged.map((entry) => ({
        termId: entry.termId,
        glossaryId: entry.glossaryId,
        scope: entry.scope,
        sourceTerm: entry.sourceTerm,
        synonyms: entry.synonyms ?? [],
        targetTerm: entry.targetTerm,
        forbiddenTargets: entry.forbiddenTargets ?? [],
        caseSensitive: entry.caseSensitive,
        doNotTranslate: entry.doNotTranslate,
        ...(entry.contextNote ? { contextNote: entry.contextNote } : {}),
        ...(entry.partOfSpeech ? { partOfSpeech: entry.partOfSpeech } : {}),
      })),
    };
  }

  // ------------------------------------------------------------------------------------------
  // Import / export
  // ------------------------------------------------------------------------------------------

  private existingSourceTerms(glossaryId: string): Set<string> {
    return new Set(
      this.db
        .select({ sourceTerm: glossaryTerms.sourceTerm })
        .from(glossaryTerms)
        .where(eq(glossaryTerms.glossaryId, glossaryId))
        .all()
        .map((row) => row.sourceTerm),
    );
  }

  importGlossary(
    glossaryId: string,
    input: GlossaryImportInput,
    user: IdentityUser,
  ): GlossaryImportResult {
    this.assertWriter(user);
    this.readGlossaryRow(glossaryId);
    const forcedLang = input.targetLang?.trim() ? this.assertLang(input.targetLang) : null;

    if (!EXPORT_META[input.format]) {
      throw httpError(400, 'glossary.invalidFormat', { format: String(input.format) });
    }

    let preview;
    try {
      preview = previewGlossaryImport(input.format, input.content, this.existingSourceTerms(glossaryId));
    } catch (error) {
      throw httpError(400, 'glossary.importFailed', {
        message: error instanceof Error ? error.message : String(error),
      });
    }

    const existingLower = new Set(
      [...this.existingSourceTerms(glossaryId)].map((term) => term.trim().toLowerCase()),
    );

    const result: GlossaryImportResult = {
      dryRun: input.dryRun !== false,
      stats: {
        total: preview.stats.total,
        newCount: preview.stats.newCount,
        updateCount: preview.stats.updateCount,
        invalidCount: preview.stats.invalidCount,
        writtenTerms: 0,
        writtenTranslations: 0,
      },
      errors: preview.errors,
      preview: preview.rows.map((row) => ({
        sourceTerm: row.sourceTerm,
        targetLang: forcedLang ?? row.targetLang ?? null,
        targetTerm: row.targetTerm ?? null,
        action: existingLower.has(row.sourceTerm.trim().toLowerCase()) ? 'update' : 'create',
      })),
    };

    if (input.dryRun !== false) return result;

    this.db.transaction((tx) => {
      const now = Date.now();
      const seen = new Map<string, string>();
      for (const row of preview.rows) {
        const sourceTerm = row.sourceTerm.trim();
        const existing = tx
          .select()
          .from(glossaryTerms)
          .where(
            and(eq(glossaryTerms.glossaryId, glossaryId), eq(glossaryTerms.sourceTerm, sourceTerm)),
          )
          .limit(1)
          .get();
        let termId = seen.get(sourceTerm.toLowerCase()) ?? existing?.id;
        const termValues = {
          synonymsJson: stringArrayJson(row.synonyms),
          caseSensitive: row.caseSensitive ? 1 : 0,
          doNotTranslate: row.doNotTranslate ? 1 : 0,
          partOfSpeech: row.partOfSpeech?.trim() || null,
          contextNote: row.contextNote?.trim() || null,
          status: this.normalizeStatus(row.status),
          updatedAt: now,
        };
        if (termId) {
          tx.update(glossaryTerms).set(termValues).where(eq(glossaryTerms.id, termId)).run();
        } else {
          termId = randomUUID();
          tx.insert(glossaryTerms)
            .values({ id: termId, glossaryId, sourceTerm, createdAt: now, ...termValues })
            .run();
          result.stats.writtenTerms += 1;
        }
        seen.set(sourceTerm.toLowerCase(), termId);

        const targetLang = forcedLang ?? (row.targetLang ? this.assertLang(row.targetLang) : null);
        const targetTerm = row.targetTerm?.trim();
        if (!targetLang || !targetTerm) continue;
        const existingTranslation = tx
          .select()
          .from(glossaryTranslations)
          .where(
            and(
              eq(glossaryTranslations.termId, termId),
              eq(glossaryTranslations.targetLang, targetLang),
            ),
          )
          .limit(1)
          .get();
        const translationValues = {
          targetTerm,
          forbiddenTargetsJson: stringArrayJson(row.forbiddenTargets),
          updatedAt: now,
        };
        if (existingTranslation) {
          tx.update(glossaryTranslations)
            .set(translationValues)
            .where(eq(glossaryTranslations.id, existingTranslation.id))
            .run();
        } else {
          tx.insert(glossaryTranslations)
            .values({ id: randomUUID(), termId, targetLang, ...translationValues })
            .run();
        }
        result.stats.writtenTranslations += 1;
      }
    });

    return result;
  }

  exportGlossary(
    glossaryId: string,
    input: { format: 'csv' | 'json' | 'tbx'; targetLang?: string },
  ): GlossaryExportResult {
    const glossary = this.readGlossaryRow(glossaryId);
    const meta = EXPORT_META[input.format];
    if (!meta) throw httpError(400, 'glossary.invalidFormat', { format: String(input.format) });
    const targetLang = input.targetLang?.trim() ? normalizeLangTag(input.targetLang) : null;

    const rows: GlossaryExchangeRow[] = [];
    for (const term of this.db
      .select()
      .from(glossaryTerms)
      .where(eq(glossaryTerms.glossaryId, glossaryId))
      .all()
      .sort((a, b) => a.sourceTerm.localeCompare(b.sourceTerm))) {
      const base = {
        sourceTerm: term.sourceTerm,
        synonyms: parseStringArray(term.synonymsJson),
        doNotTranslate: term.doNotTranslate !== 0,
        caseSensitive: term.caseSensitive !== 0,
        status: term.status,
        ...(term.contextNote ? { contextNote: term.contextNote } : {}),
        ...(term.partOfSpeech ? { partOfSpeech: term.partOfSpeech } : {}),
      };
      const translations = this.db
        .select()
        .from(glossaryTranslations)
        .where(eq(glossaryTranslations.termId, term.id))
        .all()
        .filter((row) => (targetLang ? row.targetLang === targetLang : true));

      if (translations.length === 0) {
        // Terms without a translation for the requested language must still round-trip.
        rows.push({ ...base, synonyms: base.synonyms.length > 0 ? base.synonyms : undefined });
        continue;
      }
      for (const translation of translations) {
        rows.push({
          ...base,
          synonyms: base.synonyms.length > 0 ? base.synonyms : undefined,
          targetLang: translation.targetLang,
          targetTerm: translation.targetTerm,
          forbiddenTargets:
            parseStringArray(translation.forbiddenTargetsJson).length > 0
              ? parseStringArray(translation.forbiddenTargetsJson)
              : undefined,
        });
      }
    }

    let content: string;
    if (input.format === 'csv') content = serializeGlossaryCsv(rows);
    else if (input.format === 'json') content = serializeGlossaryJson(rows);
    else content = serializeGlossaryTbx(rows, glossary.sourceLang);

    return {
      content,
      contentType: meta.contentType,
      filename: safeFilename(glossary.name, meta.extension),
    };
  }
}
