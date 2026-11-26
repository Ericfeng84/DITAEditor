/**
 * Phase 14 Stage 1 — isomorphic Markdown utilities for the ingest kernel.
 *
 * Responsibilities:
 * - lift `data:image/...;base64,...` payloads out of Markdown/HTML into `asset://` placeholders;
 * - parse ATX/Setext headings into deterministic `MarkdownSection` records (fence-aware);
 * - build a token-budgeted outline digest for the Planner agent;
 * - slice exact line ranges per topic for the Writer agent.
 *
 * Zero `node:*` imports: this module runs in the browser and in Node alike.
 */

import type { ExtractedDataUriImage, MarkdownSection } from './types.js';

const SUPPORTED_IMAGE_SUBTYPES = '(?:png|jpe?g|gif|webp|svg\\+xml)';

/** Markdown `![alt](data:image/...;base64,...)` — lazy body stops at the first `)`. */
const MD_DATA_URI_SOURCE =
  '!\\[([^\\]]*)\\]\\(\\s*(data:image\\/(' +
  SUPPORTED_IMAGE_SUBTYPES +
  ');base64,([\\s\\S]*?))\\s*(?:(?:"[^"]*"|\'[^\']*\')\\s*)?\\)';

/** HTML `<img ... src="data:image/...;base64,..." ...>` — replaces only the attribute value. */
const HTML_DATA_URI_SOURCE =
  '(<img\\b[^>]*?\\bsrc\\s*=\\s*)(["\'])(data:image\\/(' +
  SUPPORTED_IMAGE_SUBTYPES +
  ');base64,([\\s\\S]*?))\\2';

const MIME_EXTENSION: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

const ASSET_REFERENCE_REGEX = /asset:\/\/(img_\d+\.[A-Za-z0-9]+)/g;

function normalizeBase64(raw: string): string {
  return raw.replace(/\s+/g, '');
}

function decodedByteLength(base64: string): number {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function formatAssetId(index: number): string {
  return `img_${String(index).padStart(3, '0')}`;
}

/**
 * Highest existing `img_NNN` index in the document, so newly extracted images never collide
 * with assets that a previous/extract pass already placed.
 */
function nextAssetIndex(markdown: string): number {
  let max = 0;
  const regex = new RegExp(ASSET_REFERENCE_REGEX.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(markdown)) !== null) {
    const digits = /^img_(\d+)/.exec(match[1] ?? '');
    if (!digits) continue;
    const value = Number.parseInt(digits[1] ?? '', 10);
    if (Number.isFinite(value) && value > max) max = value;
  }
  return max + 1;
}

/**
 * Extract every supported `data:image/*;base64` payload from Markdown or HTML `<img>` markup,
 * save it as `img_NNN.<ext>`, and rewrite the reference to the lightweight `asset://` scheme.
 * Alt text is preserved in Markdown; HTML keeps the surrounding tag and attributes untouched.
 */
export function extractDataUriImages(markdown: string): {
  markdown: string;
  images: ExtractedDataUriImage[];
} {
  const images: ExtractedDataUriImage[] = [];
  let counter = nextAssetIndex(markdown);
  let cursor = 0;
  let output = '';

  const mdRegex = new RegExp(MD_DATA_URI_SOURCE, 'gi');
  const htmlRegex = new RegExp(HTML_DATA_URI_SOURCE, 'gi');

  const register = (
    subtype: string,
    payload: string,
    alt: string,
  ): { assetId: string; fileName: string; extension: string; mimeType: string } | null => {
    const mimeType = `image/${subtype.toLowerCase()}`;
    const extension = MIME_EXTENSION[mimeType];
    if (!extension) return null;
    const base64 = normalizeBase64(payload);
    if (!base64) return null;
    const assetId = formatAssetId(counter);
    counter += 1;
    const fileName = `${assetId}.${extension}`;
    images.push({
      assetId,
      fileName,
      extension,
      mimeType,
      alt,
      base64,
      byteLength: decodedByteLength(base64),
    });
    return { assetId, fileName, extension, mimeType };
  };

  for (;;) {
    mdRegex.lastIndex = cursor;
    htmlRegex.lastIndex = cursor;
    const mdMatch = mdRegex.exec(markdown);
    const htmlMatch = htmlRegex.exec(markdown);

    const useHtml =
      htmlMatch !== null && (mdMatch === null || htmlMatch.index < mdMatch.index);
    const match = useHtml ? htmlMatch : mdMatch;
    if (!match) break;

    if (useHtml) {
      const prefix = match[1] ?? '';
      const quote = match[2] ?? '"';
      const subtype = match[4] ?? '';
      const payload = match[5] ?? '';
      const altMatch = /\balt\s*=\s*(["'])([\s\S]*?)\1/i.exec(match[0]);
      const asset = register(subtype, payload, altMatch?.[2] ?? '');
      if (!asset) {
        // Unsupported/unusable payload: leave it verbatim and keep scanning after this match.
        output += markdown.slice(cursor, match.index + match[0].length);
        cursor = match.index + match[0].length;
        continue;
      }
      output += markdown.slice(cursor, match.index);
      output += `${prefix}${quote}asset://${asset.fileName}${quote}`;
      cursor = match.index + match[0].length;
      continue;
    }

    const alt = match[1] ?? '';
    const subtype = match[3] ?? '';
    const payload = match[4] ?? '';
    const asset = register(subtype, payload, alt);
    if (!asset) {
      output += markdown.slice(cursor, match.index + match[0].length);
      cursor = match.index + match[0].length;
      continue;
    }
    output += markdown.slice(cursor, match.index);
    output += `![${alt}](asset://${asset.fileName})`;
    cursor = match.index + match[0].length;
  }

  output += markdown.slice(cursor);
  return { markdown: output, images };
}

/* ------------------------------------------------------------------------------------------ */
/* Outline parsing                                                                            */
/* ------------------------------------------------------------------------------------------ */

interface LineIndex {
  lines: string[];
  /** Character offset where each 0-based line starts. */
  starts: number[];
}

function buildLineIndex(markdown: string): LineIndex {
  const lines = markdown.split('\n');
  const starts: number[] = new Array(lines.length);
  let offset = 0;
  for (let i = 0; i < lines.length; i += 1) {
    starts[i] = offset;
    offset += (lines[i] ?? '').length + 1;
  }
  return { lines, starts };
}

function sectionSlice(markdown: string, index: LineIndex, startLine: number, endLine: number): string {
  const startOffset = index.starts[startLine - 1] ?? 0;
  const endOffset =
    endLine < index.lines.length ? (index.starts[endLine] ?? markdown.length) : markdown.length;
  return markdown.slice(startOffset, Math.max(startOffset, endOffset));
}

const ATX_HEADING_REGEX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/;
const ATX_CLOSING_HASHES_REGEX = /[ \t]+#+[ \t]*$/;
const SETEXT_UNDERLINE_REGEX = /^ {0,3}(=+|-+)[ \t]*$/;
const FENCE_REGEX = /^ {0,3}(`{3,}|~{3,})(.*)$/;
const TABLE_SEPARATOR_REGEX = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/;

interface HeadingHit {
  /** 0-based line of the heading text (ATX line, or the line above a Setext underline). */
  line: number;
  /** 0-based line that closes the heading block (Setext underline), else same as `line`. */
  blockEnd: number;
  level: number;
  text: string;
}

function scanHeadings(lines: readonly string[]): HeadingHit[] {
  const hits: HeadingHit[] = [];
  let fenceChar: string | null = null;
  let fenceLength = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';

    const fence = FENCE_REGEX.exec(line);
    if (fence) {
      const marker = fence[1] ?? '';
      if (fenceChar === null) {
        fenceChar = marker[0] ?? '`';
        fenceLength = marker.length;
      } else if (marker[0] === fenceChar && marker.length >= fenceLength) {
        fenceChar = null;
        fenceLength = 0;
      }
      continue;
    }
    if (fenceChar !== null) continue;

    const atx = ATX_HEADING_REGEX.exec(line);
    if (atx) {
      const hashes = atx[1] ?? '#';
      const rawText = (atx[2] ?? '').replace(ATX_CLOSING_HASHES_REGEX, '').trim();
      hits.push({ line: i, blockEnd: i, level: hashes.length, text: rawText });
      continue;
    }

    const underline = SETEXT_UNDERLINE_REGEX.exec(line);
    if (!underline || i === 0) continue;
    const previous = (lines[i - 1] ?? '').trim();
    if (!previous) continue;
    if (ATX_HEADING_REGEX.test(lines[i - 1] ?? '')) continue;
    if (SETEXT_UNDERLINE_REGEX.test(lines[i - 1] ?? '')) continue;
    if (hits.length > 0 && hits[hits.length - 1]!.line === i - 1) continue;
    const level = (underline[1] ?? '').startsWith('=') ? 1 : 2;
    hits.push({ line: i - 1, blockEnd: i, level, text: previous });
  }

  return hits;
}

function collectImageAssetIds(text: string): string[] {
  const ids: string[] = [];
  const regex = new RegExp(ASSET_REFERENCE_REGEX.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const id = match[1];
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

function sectionHasTable(text: string): boolean {
  return text.split('\n').some((line) => TABLE_SEPARATOR_REGEX.test(line));
}

function sectionHasCode(text: string): boolean {
  // A closed (or still open) fenced block inside the section counts as code.
  return /^ {0,3}(`{3,}|~{3,})/m.test(text);
}

function makeSection(
  markdown: string,
  index: LineIndex,
  id: string,
  level: number,
  heading: string,
  startLine: number,
  endLine: number,
): MarkdownSection {
  const text = sectionSlice(markdown, index, startLine, endLine);
  return {
    id,
    level,
    heading,
    startLine,
    endLine,
    charCount: text.length,
    hasTable: sectionHasTable(text),
    hasCode: sectionHasCode(text),
    imageAssetIds: collectImageAssetIds(text),
  };
}

/**
 * Parse a Markdown document into heading sections.
 *
 * - ATX (`# Heading`) and Setext (`Heading` + `===` / `---`) headings are both supported.
 * - Fenced code blocks (triple backtick / triple tilde) are skipped entirely, so a `#` inside a
 *   shell snippet never becomes a section.
 * - Leading preamble text before the first heading becomes a level-0 section.
 * - A document without headings yields one level-1 section covering the whole document.
 */
export function parseMarkdownOutline(markdown: string): MarkdownSection[] {
  const index = buildLineIndex(markdown);
  const hits = scanHeadings(index.lines);
  const sections: MarkdownSection[] = [];

  if (hits.length === 0) {
    return [
      makeSection(markdown, index, 'sec_001', 1, '', 1, Math.max(1, index.lines.length)),
    ];
  }

  let counter = 1;
  const firstHeadingLine = hits[0]!.line + 1;
  if (firstHeadingLine > 1) {
    const preamble = sectionSlice(markdown, index, 1, firstHeadingLine - 1);
    if (preamble.trim().length > 0) {
      sections.push(
        makeSection(markdown, index, `sec_${String(counter).padStart(3, '0')}`, 0, '', 1, firstHeadingLine - 1),
      );
      counter += 1;
    }
  }

  for (let i = 0; i < hits.length; i += 1) {
    const hit = hits[i]!;
    const next = hits[i + 1];
    const startLine = hit.line + 1;
    const endLine = next ? next.line : index.lines.length;
    sections.push(
      makeSection(
        markdown,
        index,
        `sec_${String(counter).padStart(3, '0')}`,
        hit.level,
        hit.text,
        startLine,
        Math.max(startLine, endLine),
      ),
    );
    counter += 1;
  }

  return sections;
}

/* ------------------------------------------------------------------------------------------ */
/* Planner digest + topic slicing                                                             */
/* ------------------------------------------------------------------------------------------ */

function excerptForSection(
  markdown: string,
  index: LineIndex,
  section: MarkdownSection,
  maxChars: number,
): string {
  const text = sectionSlice(markdown, index, section.startLine, section.endLine);
  const lines = text.split('\n');
  // Drop the heading line + Setext underline so the excerpt is real body copy.
  const skipHeading = section.heading ? 1 : 0;
  const skipUnderline =
    skipHeading === 1 && lines.length > 1 && SETEXT_UNDERLINE_REGEX.test(lines[1] ?? '') ? 1 : 0;
  const bodyLines = lines.slice(skipHeading + skipUnderline);
  const body = bodyLines
    .join(' ')
    .replace(/```[\s\S]*?```/g, ' [code] ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' [image] ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!body) return '';
  if (body.length <= maxChars) return body;
  return `${body.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

/**
 * Build a compact outline digest (tree + short excerpts) for the Planner agent.
 * Output never exceeds `maxChars`; truncation happens on a line boundary when possible.
 */
export function buildPlannerOutlineDigest(
  markdown: string,
  sections: MarkdownSection[],
  maxChars = 14000,
): string {
  const index = buildLineIndex(markdown);
  const lineCount = index.lines.length;
  const imageCount = sections.reduce((total, section) => total + section.imageAssetIds.length, 0);
  const header = [
    `Document: ${markdown.length} chars, ${lineCount} lines, ${sections.length} sections, ${imageCount} image references.`,
    'Outline (id, level, heading, size, features):',
  ].join('\n');

  const lines: string[] = [header];
  let length = header.length;

  for (const section of sections) {
    const indent = '  '.repeat(Math.max(0, Math.min(section.level, 6)));
    const features: string[] = [];
    if (section.hasTable) features.push('table');
    if (section.hasCode) features.push('code');
    if (section.imageAssetIds.length > 0) {
      features.push(`images: ${section.imageAssetIds.join(', ')}`);
    }
    const featureText = features.length > 0 ? ` [${features.join('; ')}]` : '';
    const label = section.heading || '(document introduction)';
    const entry = `${indent}- ${section.id} (h${section.level}) ${label} — ${section.charCount} chars${featureText}`;
    const excerpt = excerptForSection(markdown, index, section, 200);
    const excerptLine = excerpt ? `${indent}  > ${excerpt}` : '';

    const addition = `\n${entry}${excerptLine ? `\n${excerptLine}` : ''}`;
    if (length + addition.length > maxChars) {
      if (length + 1 <= maxChars) lines.push('… (outline truncated)');
      break;
    }
    lines.push(`${entry}${excerptLine ? `\n${excerptLine}` : ''}`);
    length += addition.length;
  }

  const text = lines.join('\n');
  return text.length <= maxChars ? text : text.slice(0, maxChars);
}

function truncateText(
  text: string,
  maxChars: number,
): { markdown: string; truncated: boolean } {
  if (text.length <= maxChars) return { markdown: text, truncated: false };
  const slice = text.slice(0, maxChars);
  const lastNewline = slice.lastIndexOf('\n');
  const cut = lastNewline > Math.floor(maxChars * 0.6) ? slice.slice(0, lastNewline) : slice;
  return { markdown: cut, truncated: true };
}

/**
 * Slice exact line ranges for the requested sections so the Writer agent never receives the
 * whole document. Empty `sectionIds` falls back to the full Markdown.
 */
export function sliceMarkdownForTopic(
  markdown: string,
  sections: MarkdownSection[],
  sectionIds: string[],
  maxChars = 18000,
): { markdown: string; truncated: boolean } {
  if (sectionIds.length === 0) {
    return truncateText(markdown, maxChars);
  }

  const wanted = new Set(sectionIds);
  const selected = sections.filter((section) => wanted.has(section.id));
  if (selected.length === 0) {
    return truncateText(markdown, maxChars);
  }

  const index = buildLineIndex(markdown);
  const parts = selected.map((section) =>
    sectionSlice(markdown, index, section.startLine, section.endLine).replace(/\n+$/, ''),
  );
  return truncateText(parts.join('\n\n'), maxChars);
}
