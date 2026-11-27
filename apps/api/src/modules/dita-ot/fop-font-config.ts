/**
 * Builds the `<fonts>` block of FOP's `fop.xconf` from the Noto CJK fonts installed on the
 * publishing machine.
 *
 * Two constraints shape this module (see `font-collections.ts` for the FOP internals):
 * - `sub-font` must reproduce a face's full name exactly, and that name differs per weight
 *   (`Noto Sans CJK SC` vs `Noto Sans CJK SC Bold`) and per Noto CJK build.
 * - FOP 2.9 only embeds a `*.ttc` collection through its TrueType parser, which rejects CFF
 *   outlines (`'loca' table not found`). Debian ships Noto CJK exclusively as CFF collections,
 *   so a registered face must first be materialised as a standalone `.otf`/`.ttf` file.
 *
 * The job-local `fonts/` directory therefore receives one extracted face per registered
 * triplet. Extraction results are cached by source path + size + mtime in a temp cache and
 * hard-linked into the job, so repeated publishes stay cheap.
 */
import { createHash, randomUUID } from 'node:crypto';
import { copyFile, link, mkdir, readdir, rename, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  extractFontFace,
  fontExtensionForVersion,
  readFontFaces,
  type FontFaceInfo,
} from './font-collections.js';

/** Logical DITA-OT font families used by `cfg/fo/font-mappings.xml` (keep the two in sync). */
const BASE_FAMILIES = ['Noto Sans CJK', 'Noto Serif CJK', 'Noto Sans Mono CJK'] as const;
/** Regions referenced by the bundled `font-mappings.xml` char-sets. */
const REGIONS = ['SC', 'JP', 'KR'] as const;
const VARIANTS: ReadonlyArray<{ style: FontStyle; weight: FontWeight }> = [
  { style: 'normal', weight: 'normal' },
  { style: 'normal', weight: 'bold' },
  { style: 'italic', weight: 'normal' },
  { style: 'italic', weight: 'bold' },
];
const NOTO_CJK_NAME_PATTERN = /cjk/i;
const NOTO_NAME_PATTERN = /noto/i;
const FONT_FILE_PATTERN = /\.(ttc|otc|otf|ttf)$/i;
const MAX_FONT_FILES = 32;

export type FontStyle = 'normal' | 'italic';
export type FontWeight = 'normal' | 'bold';

export interface DiscoveredFontFile {
  /** File name relative to the FOP `font-base` directory. */
  file: string;
  faces: FontFaceInfo[];
}

/** One face that should be registered with FOP, before materialisation. */
export interface PlannedFopFont {
  sourceFile: string;
  /** Full name of the face inside the source file (FOP's `sub-font`). */
  faceName: string;
  fontFamily: string;
  style: FontStyle;
  weight: FontWeight;
  sfntVersion: number;
}

/** One `<font>` registration in the generated configuration. */
export interface FopFontEntry {
  /** File name relative to the generated `<font-base>` directory. */
  file: string;
  family: string;
  style: FontStyle;
  weight: FontWeight;
  /** `sub-font` value; only needed while the face still lives inside a collection. */
  subFont: string | null;
}

/** Reads the faces of every Noto CJK font file in `fontDir` (worst case: an empty list). */
export async function discoverNotoCjkFontFiles(fontDir: string): Promise<DiscoveredFontFile[]> {
  let names: string[];
  try {
    names = await readdir(fontDir);
  } catch {
    return [];
  }
  const fontFiles = names.filter((name) => FONT_FILE_PATTERN.test(name)).sort();
  const notoCjkFiles = fontFiles.filter((name) => NOTO_CJK_NAME_PATTERN.test(name));
  const pool = selectFontFiles(
    notoCjkFiles.length > 0 ? notoCjkFiles : fontFiles.filter((name) => NOTO_NAME_PATTERN.test(name)),
  ).slice(0, MAX_FONT_FILES);
  const discovered = await Promise.all(
    pool.map(async (file) => ({ file, faces: await readFontFaces(join(fontDir, file)) })),
  );
  return discovered.filter((entry) => entry.faces.length > 0);
}

/**
 * Keeps the canonical Regular/Bold pair when `fonts-noto-cjk-extra` also installs
 * Thin/Light/Medium/Black weights, so the bold triplet never resolves to a Black face and the
 * normal triplet never resolves to a Light one.
 */
function selectFontFiles(names: readonly string[]): string[] {
  const hasRegular = names.some((name) => /regular/i.test(name));
  const hasBold = names.some((name) => /bold/i.test(name));
  if (!hasRegular || !hasBold) return [...names];
  const preferred = names.filter((name) => /(regular|bold)/i.test(name));
  return preferred.length > 0 ? preferred : [...names];
}

/** Chooses one face per logical family/style/weight combination. */
export function planNotoFopFonts(files: readonly DiscoveredFontFile[]): PlannedFopFont[] {
  const faces = files.flatMap((file) =>
    file.faces.map((info) => ({
      sourceFile: file.file,
      info,
      style: faceStyle(info),
      weight: faceWeight(info),
    })),
  );
  const planned: PlannedFopFont[] = [];
  const seen = new Set<string>();
  for (const base of BASE_FAMILIES) {
    for (const region of REGIONS) {
      const family = `${base} ${region}`;
      const familyFaces = faces.filter((candidate) => matchesFamily(candidate.info.names, family));
      if (familyFaces.length === 0) continue;
      for (const variant of VARIANTS) {
        const chosen = pickFace(familyFaces, variant);
        if (!chosen) continue;
        const key = `${family}\u0000${variant.style}\u0000${variant.weight}`;
        if (seen.has(key)) continue;
        seen.add(key);
        planned.push({
          sourceFile: chosen.sourceFile,
          faceName: chosen.info.names.fullName,
          fontFamily: family,
          style: variant.style,
          weight: variant.weight,
          sfntVersion: chosen.info.sfntVersion,
        });
      }
    }
  }
  return planned;
}

export interface MaterializeOptions {
  fontDir: string;
  /** Directory that becomes the generated `<font-base>`. */
  targetDir: string;
  files: readonly DiscoveredFontFile[];
  plan: readonly PlannedFopFont[];
  /** Override for the extracted-face cache (defaults to `<tmp>/ditaeditor-fonts`). */
  cacheDir?: string;
}

/**
 * Writes every planned face as a standalone font file into `targetDir` and returns the
 * `<font>` entries pointing at them. Faces that cannot be extracted are skipped, so a partial
 * font set still publishes instead of failing outright.
 */
export async function materializeNotoFopFonts(
  options: MaterializeOptions,
): Promise<FopFontEntry[]> {
  const { fontDir, targetDir, plan } = options;
  if (plan.length === 0) return [];
  await mkdir(targetDir, { recursive: true });
  const cacheDir = options.cacheDir ?? join(tmpdir(), 'ditaeditor-fonts');
  const filesBySource = new Map(options.files.map((entry) => [entry.file, entry]));
  const cache = new Map<string, string | null>();
  const entries: FopFontEntry[] = [];
  for (const item of plan) {
    const source = filesBySource.get(item.sourceFile);
    if (!source) continue;
    const key = `${item.sourceFile}\u0000${item.faceName}`;
    let fileName = cache.get(key);
    if (fileName === undefined) {
      fileName = await materializeFace({ fontDir, targetDir, cacheDir, source, item });
      cache.set(key, fileName);
    }
    if (!fileName) continue;
    entries.push({
      file: fileName,
      family: item.fontFamily,
      style: item.style,
      weight: item.weight,
      subFont: null,
    });
  }
  return entries;
}

async function materializeFace(options: {
  fontDir: string;
  targetDir: string;
  cacheDir: string;
  source: DiscoveredFontFile;
  item: PlannedFopFont;
}): Promise<string | null> {
  const { fontDir, targetDir, cacheDir, source, item } = options;
  const extension = fontExtensionForVersion(item.sfntVersion);
  const fileName = `${slug(item.faceName)}${extension}`;
  const targetPath = join(targetDir, fileName);
  const sourcePath = join(fontDir, source.file);
  const cached = join(cacheDir, `${await cacheKey(sourcePath, item.faceName)}${extension}`);
  try {
    await stat(cached);
  } catch {
    try {
      await mkdir(cacheDir, { recursive: true });
      const temporary = `${cached}.${randomUUID()}.tmp`;
      const extracted = await extractFontFace(sourcePath, item.faceName, temporary);
      if (!extracted) {
        await rm(temporary, { force: true });
        return null;
      }
      await rename(temporary, cached);
    } catch {
      return null;
    }
  }
  try {
    await rm(targetPath, { force: true });
    await link(cached, targetPath);
  } catch {
    try {
      await copyFile(cached, targetPath);
    } catch {
      return null;
    }
  }
  return fileName;
}

async function cacheKey(sourcePath: string, faceName: string): Promise<string> {
  const info = await stat(sourcePath).catch(() => null);
  const fingerprint = `${sourcePath}\u0000${info?.size ?? 0}\u0000${info?.mtimeMs ?? 0}\u0000${faceName}`;
  return createHash('sha1').update(fingerprint).digest('hex');
}

/** Renders the `<fonts>` element, or an empty string when nothing was registered. */
export function renderFopFontsSection(entries: readonly FopFontEntry[]): string {
  if (entries.length === 0) return '';
  const lines = ['      <fonts>'];
  for (const entry of entries) {
    const subFont = entry.subFont ? ` sub-font="${escapeXml(entry.subFont)}"` : '';
    lines.push(`        <font embed-url="${escapeXml(entry.file)}" kerning="yes"${subFont}>`);
    lines.push(
      `          <font-triplet name="${escapeXml(entry.family)}" style="${entry.style}" weight="${entry.weight}"/>`,
    );
    lines.push('        </font>');
  }
  lines.push('      </fonts>');
  return lines.join('\n');
}

/** Rewrites the `font-base` element so a job-local configuration points at the generated fonts. */
export function applyFontBase(fopXml: string, fontDir: string): string {
  const spans = commentSpans(fopXml);
  const open = findOutside(fopXml, '<font-base>', spans);
  const close = open < 0 ? -1 : findOutside(fopXml, '</font-base>', spans, open);
  if (open < 0 || close < 0) return fopXml;
  const start = open + '<font-base>'.length;
  return `${fopXml.slice(0, start)}${escapeXml(fontDir)}${fopXml.slice(close)}`;
}

/**
 * Replaces the bundled font table with the generated registrations. Falls back to the XML
 * unchanged when no font was materialised, so a missing/unreadable font directory still
 * publishes with the documented defaults.
 */
export function applyFopFontEntries(
  fopXml: string,
  entries: readonly FopFontEntry[],
): string {
  const section = renderFopFontsSection(entries);
  if (!section) return fopXml;
  // Only real elements are rewritten: matching inside a comment would swallow the comment
  // terminator and hand FOP an unparsable configuration (`xml parse error`).
  const spans = commentSpans(fopXml);
  const open = findOutside(fopXml, '<fonts>', spans);
  const close = open < 0 ? -1 : findOutside(fopXml, '</fonts>', spans, open);
  if (open >= 0 && close > open) {
    return `${fopXml.slice(0, open)}${section}${fopXml.slice(close + '</fonts>'.length)}`;
  }
  const renderer = findOutside(fopXml, '</renderer>', spans);
  if (renderer < 0) return fopXml;
  return `${fopXml.slice(0, renderer)}${section}\n    ${fopXml.slice(renderer)}`;
}

interface TextSpan {
  start: number;
  end: number;
}

/** Byte spans of every XML comment, so element lookups can skip commented-out markup. */
function commentSpans(xml: string): TextSpan[] {
  const spans: TextSpan[] = [];
  const pattern = /<!--[\s\S]*?-->/g;
  let match = pattern.exec(xml);
  while (match) {
    spans.push({ start: match.index, end: match.index + match[0].length });
    match = pattern.exec(xml);
  }
  return spans;
}

function findOutside(xml: string, needle: string, spans: readonly TextSpan[], from = 0): number {
  let index = xml.indexOf(needle, from);
  while (index >= 0) {
    if (!spans.some((span) => index >= span.start && index < span.end)) return index;
    index = xml.indexOf(needle, index + needle.length);
  }
  return -1;
}

function matchesFamily(names: FontFaceInfo['names'], family: string): boolean {
  if (names.familyName === family) return true;
  if (names.fullName === family) return true;
  return names.fullName.startsWith(`${family} `);
}

function faceWeight(face: FontFaceInfo): FontWeight {
  return /bold|black|semibold|demibold|heavy|extrabold|ultra/i.test(face.names.subFamilyName)
    ? 'bold'
    : 'normal';
}

function faceStyle(face: FontFaceInfo): FontStyle {
  return /italic|oblique/i.test(face.names.subFamilyName) ? 'italic' : 'normal';
}

interface CandidateFace {
  sourceFile: string;
  info: FontFaceInfo;
  style: FontStyle;
  weight: FontWeight;
}

/**
 * Prefers an exact style/weight match, then the same weight in another style (FOP renders
 * synthetic italics only by substitution), and finally any face of the family. Returning a
 * face is always better than leaving the triplet unregistered: an unregistered CJK family makes
 * FOP fall back to a Latin-only font, which drops glyphs instead of styling text.
 */
function pickFace(
  candidates: readonly CandidateFace[],
  variant: { style: FontStyle; weight: FontWeight },
): CandidateFace | undefined {
  const score = (candidate: CandidateFace): number => {
    let value = 0;
    if (candidate.weight === variant.weight) value += 4;
    if (candidate.style === variant.style) value += 2;
    if (candidate.style === 'normal') value += 1;
    const canonical = variant.weight === 'bold' ? 'bold' : 'regular';
    if (candidate.info.names.subFamilyName.toLowerCase() === canonical) value += 8;
    return value;
  };
  return [...candidates].sort((left, right) => score(right) - score(left))[0];
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
