/**
 * Phase 16 Stage 1 — glossary matching for prompt rendering and post-translation QA.
 *
 * Merge rules are scope aware (`manual` beats `global`), matching is longest-span-first and never
 * overlaps, and word boundaries are only enforced for Latin/Cyrillic/Greek terms — CJK has no
 * spaces, so a direct longest-substring match is the correct semantics there.
 */

import type { GlossaryEntryForMatch, GlossaryMatchHit } from './types.js';

type GlossaryScope = GlossaryEntryForMatch['scope'];

const SCOPE_PRIORITY: Record<GlossaryScope, number> = { global: 0, manual: 1 };

function normalizeKey(term: string, caseSensitive: boolean): string {
  const trimmed = term.trim();
  return caseSensitive ? trimmed : trimmed.toLowerCase();
}

/** Lowercased / trimmed identity used for dedupe and lookup. */
function dedupeKey(entry: GlossaryEntryForMatch): string {
  const caseSensitive = entry.caseSensitive === true;
  const base = normalizeKey(entry.sourceTerm, caseSensitive);
  return caseSensitive ? `cs\u0001${base}` : `ci\u0001${base}`;
}

/**
 * Merge glossary rows from every scope into one lookup table.
 *
 * Rows are keyed by `sourceTerm` (case-insensitively unless `caseSensitive` is set) and
 * `scope: 'manual'` always wins over `scope: 'global'`, so a project glossary can override a
 * company term without duplicating it.
 */
export function mergeGlossaryEntries(
  entries: GlossaryEntryForMatch[],
): GlossaryEntryForMatch[] {
  const merged = new Map<string, GlossaryEntryForMatch>();

  for (const entry of entries) {
    const sourceTerm = entry.sourceTerm.trim();
    if (sourceTerm.length === 0) continue;
    const normalized: GlossaryEntryForMatch = { ...entry, sourceTerm };
    const key = dedupeKey(normalized);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, normalized);
      continue;
    }
    const existingPriority = SCOPE_PRIORITY[existing.scope] ?? 0;
    const incomingPriority = SCOPE_PRIORITY[normalized.scope] ?? 0;
    if (incomingPriority >= existingPriority) merged.set(key, normalized);
    else merged.set(key, existing);
  }

  return Array.from(merged.values());
}

interface CandidateHit {
  entry: GlossaryEntryForMatch;
  matchedText: string;
  start: number;
  end: number;
}

const LATIN_LIKE = /[A-Za-z0-9\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]/;

function isAsciiWordChar(ch: string | undefined): boolean {
  if (!ch) return false;
  return /[A-Za-z0-9_]/.test(ch);
}

function isLatinBounded(term: string): boolean {
  const first = [...term][0];
  const last = [...term].at(-1);
  if (!first || !last) return false;
  return LATIN_LIKE.test(first) && LATIN_LIKE.test(last);
}

function isBoundaryChar(ch: string | undefined): boolean {
  return ch === undefined || !isAsciiWordChar(ch);
}

/**
 * Find glossary occurrences inside one text block.
 *
 * Longest match first with non-overlapping span selection; Latin-bounded terms additionally require
 * word boundaries so `"cat"` never matches inside `"concatenate"`.
 */
export function matchGlossaryTerms(
  text: string,
  entries: GlossaryEntryForMatch[],
): GlossaryMatchHit[] {
  if (!text || entries.length === 0) return [];

  const candidates: CandidateHit[] = [];

  for (const entry of entries) {
    const terms: string[] = [];
    if (entry.sourceTerm.trim().length > 0) terms.push(entry.sourceTerm);
    for (const synonym of entry.synonyms ?? []) {
      if (synonym.trim().length > 0) terms.push(synonym);
    }

    for (const rawTerm of terms) {
      const term = rawTerm.trim();
      if (term.length === 0) continue;
      const latinBounded = isLatinBounded(term);
      // Case folding can change string length (`İ`.toLowerCase() is two code units), which would
      // shift every reported index; in that rare case fall back to an exact-match scan.
      const folded =
        entry.caseSensitive !== true &&
        text.toLowerCase().length === text.length &&
        term.toLowerCase().length === term.length;
      const haystack = folded ? text.toLowerCase() : text;
      const needle = folded ? term.toLowerCase() : term;

      let from = haystack.indexOf(needle);
      while (from >= 0) {
        const start = from;
        const end = from + needle.length;
        const before = text.slice(Math.max(0, start - 1), start);
        const after = text.slice(end, end + 1);
        const ok = !latinBounded || (!isAsciiWordChar(before) && !isAsciiWordChar(after));
        if (ok) {
          candidates.push({ entry, matchedText: text.slice(start, end), start, end });
        }
        from = haystack.indexOf(needle, start + Math.max(1, needle.length));
      }
    }
  }

  if (candidates.length === 0) return [];

  candidates.sort((a, b) => {
    const lengthDiff = b.end - b.start - (a.end - a.start);
    if (lengthDiff !== 0) return lengthDiff;
    if (a.start !== b.start) return a.start - b.start;
    return SCOPE_PRIORITY[b.entry.scope] - SCOPE_PRIORITY[a.entry.scope];
  });

  const chosen: CandidateHit[] = [];
  const occupied: Array<[number, number]> = [];
  for (const candidate of candidates) {
    const overlaps = occupied.some(
      ([start, end]) => candidate.start < end && start < candidate.end,
    );
    if (overlaps) continue;
    occupied.push([candidate.start, candidate.end]);
    chosen.push(candidate);
  }

  chosen.sort((a, b) => a.start - b.start);
  return chosen.map((hit) => ({
    entry: hit.entry,
    matchedText: hit.matchedText,
    start: hit.start,
    end: hit.end,
  }));
}
