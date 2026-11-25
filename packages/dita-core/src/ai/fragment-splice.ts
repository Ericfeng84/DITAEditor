import { isChildAllowed } from '../model/dita-rules.js';
import { xmlToPmDoc } from '../prosemirror/converter.js';
import {
  checkXmlWellFormed,
  extractDoctype,
  extractXmlDeclaration,
  findRootElementStartOffset,
} from '../xml/parser.js';
import type { XmlDoctypeInfo } from '../xml/types.js';
import { coreT } from '../i18n/messages.js';
import type { UiLocale } from '../i18n/locale.js';
import type {
  AiFragmentExtraction,
  AiSpliceErrorCode,
  AiSpliceFailure,
  AiSpliceResult,
  AiVerificationReport,
} from './types.js';

/** DITA topic roots that must stay renderable in Visual (ProseMirror) mode. */
const DITA_TOPIC_ROOTS: ReadonlySet<string> = new Set([
  'concept',
  'task',
  'reference',
  'topic',
  'glossentry',
  'troubleshooting',
]);

const WRAPPER_PATTERN = /^\s*<(dita_patch|dita_document)\b[^>]*>([\s\S]*)<\/\1\s*>\s*$/;

/**
 * Strip what chat models habitually add around an XML patch: markdown code fences,
 * `<dita_patch>` / `<dita_document>` wrappers, and the XML declaration / DOCTYPE.
 * The candidate's own indentation is kept verbatim — whitespace inside `codeblock`/`pre`/
 * `xml:space="preserve"` is document content, never reformatted here.
 */
export interface NormalizeCandidateOptions {
  /**
   * A line-window patch replaces whole lines including their indentation, so the leading
   * whitespace of its first line is content rather than model noise: a global `trim()` would
   * shift the entire block one level left. Blank lines above the patch are still dropped.
   */
  keepLeadingIndent?: boolean;
}

export function normalizeCandidateXml(
  candidateXml: string,
  options: NormalizeCandidateOptions = {},
): string {
  const finish = options.keepLeadingIndent
    ? (text: string) =>
        text
          .replace(/^[ \t\r]*\n(?:[ \t\r]*\n)*/, '')
          .replace(/[ \t\r\n]+$/, '')
    : (text: string) => text.trim();
  let text = candidateXml;
  for (let pass = 0; pass < 3; pass += 1) {
    const before = text;
    text = finish(
      stripProlog(stripWrapperElement(stripCodeFence(text)), options.keepLeadingIndent),
    );
    if (text === before) break;
  }
  return finish(text);
}

/**
 * Splice a normalized candidate back into the original XML and verify the result.
 * Untouched regions are copied byte-for-byte (never reserialized), which keeps the XML
 * declaration, DOCTYPE, comments/PIs, attribute order, and indentation intact.
 */
export function spliceAndVerifyAiXml(
  originalXml: string,
  extraction: AiFragmentExtraction,
  candidateXml: string,
  locale: UiLocale = 'zh-CN',
): AiSpliceResult {
  const t = (key: Parameters<typeof coreT>[1], params?: Parameters<typeof coreT>[2]) =>
    coreT(locale, key, params);
  const normalized = normalizeCandidateXml(candidateXml, {
    keepLeadingIndent: extraction.mode === 'line-window',
  });
  if (normalized.length === 0) {
    return failure(
      'candidate-empty',
      t('ai.candidateEmpty'),
      null,
      failedVerification([t('ai.candidateEmptyWarning')]),
    );
  }

  const candidateParsed = checkXmlWellFormed(normalized);
  const candidateRootTag = candidateParsed.ok
    ? (candidateParsed.parsed.document.documentElement?.tagName ?? '')
    : (firstElementTagName(normalized) ?? '');
  // Only element mode replaces a single element node. Line-window and full-document patches may
  // legitimately be a sibling run / partial region; the patched document is the real gate there.
  const requiresSingleElement = extraction.mode === 'element';
  if (requiresSingleElement && (!candidateParsed.ok || candidateRootTag === '')) {
    const detail = candidateParsed.ok ? t('ai.candidateNoRoot') : candidateParsed.error.message;
    return failure(
      'candidate-malformed',
      t('ai.candidateMalformed', { detail }),
      null,
      failedVerification([t('ai.candidateMalformedWarning', { detail })]),
    );
  }

  if (
    extraction.mode !== 'element' &&
    extraction.mode !== 'line-window' &&
    extraction.mode !== 'full-document'
  ) {
    return failure(
      'invalid-target',
      t('ai.unsupportedTargetMode', { mode: String(extraction.mode) }),
      null,
      failedVerification([t('ai.unsupportedTargetMode', { mode: String(extraction.mode) })]),
    );
  }

  const { startOffset, endOffset } = extraction;
  if (
    !Number.isInteger(startOffset) ||
    !Number.isInteger(endOffset) ||
    startOffset < 0 ||
    endOffset < startOffset ||
    endOffset > originalXml.length
  ) {
    return failure(
      'invalid-target',
      t('ai.invalidRange', {
        start: String(startOffset),
        end: String(endOffset),
        length: String(originalXml.length),
      }),
      null,
      failedVerification([
        t('ai.invalidRangeWarning', { start: String(startOffset), end: String(endOffset) }),
      ]),
    );
  }
  if (extraction.originalXml.length > 0 && extraction.originalXml !== originalXml) {
    return failure(
      'invalid-target',
      t('ai.originalMismatch'),
      null,
      failedVerification([t('ai.originalMismatchWarning')]),
    );
  }

  const warnings: string[] = [];
  if (hasModelDecorations(candidateXml)) {
    warnings.push(t('ai.wrapperRemoved'));
  }

  let patchedXml: string;
  if (extraction.mode === 'full-document') {
    const rootStart = findRootElementStartOffset(originalXml);
    const prolog = rootStart > 0 ? originalXml.slice(0, rootStart) : '';
    patchedXml = prolog + normalized;
    if (prolog.length > 0) {
      warnings.push(t('ai.prologReused'));
    }
  } else {
    patchedXml = originalXml.slice(0, startOffset) + normalized + originalXml.slice(endOffset);
  }

  const wellFormedResult = checkXmlWellFormed(patchedXml);
  const originalDeclaration = extractXmlDeclaration(originalXml);
  const patchedDeclaration = extractXmlDeclaration(patchedXml);
  const preservedXmlDeclaration =
    (originalDeclaration?.raw ?? null) === (patchedDeclaration?.raw ?? null);
  const preservedDoctype =
    doctypeSignature(extractDoctype(originalXml)) === doctypeSignature(extractDoctype(patchedXml));
  const patchedRootTag = wellFormedResult.ok
    ? (wellFormedResult.parsed.document.documentElement?.tagName ?? '')
    : '';

  const structureWarnings: string[] = [];
  let structureValid = true;
  if (extraction.parentTag && !isChildAllowed(extraction.parentTag, candidateRootTag)) {
    structureValid = false;
    structureWarnings.push(
        t('ai.childNotAllowed', { child: candidateRootTag, parent: extraction.parentTag ?? '' }),
      );
  }
  if (wellFormedResult.ok && extraction.rootTagName && patchedRootTag !== extraction.rootTagName) {
    structureValid = false;
    structureWarnings.push(
      t('ai.rootChanged', {
        from: extraction.rootTagName ?? '',
        to: patchedRootTag || t('ai.none'),
      }),
    );
  }

  const pmRootTag = wellFormedResult.ok ? patchedRootTag : extraction.rootTagName;
  const pmWarnings: string[] = [];
  let prosemirrorCompatible = wellFormedResult.ok;
  if (wellFormedResult.ok && DITA_TOPIC_ROOTS.has(pmRootTag)) {
    try {
      xmlToPmDoc(patchedXml);
    } catch (err) {
      prosemirrorCompatible = false;
      pmWarnings.push(
        t('ai.visualConversionFailed', {
          message: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  }

  const verification: AiVerificationReport = {
    wellFormed: wellFormedResult.ok,
    prosemirrorCompatible,
    preservedDoctype,
    preservedXmlDeclaration,
    structureValid,
    warnings: [...warnings, ...structureWarnings, ...pmWarnings],
  };

  if (!wellFormedResult.ok) {
    verification.warnings.push(
      t('ai.patchedMalformedAt', {
        line: String(wellFormedResult.error.line),
        column: String(wellFormedResult.error.column),
        message: wellFormedResult.error.message,
      }),
    );
    return failure(
      'patched-malformed',
      t('ai.patchedMalformed', { message: wellFormedResult.error.message }),
      null,
      verification,
    );
  }

  if (!preservedXmlDeclaration) {
    return failure(
      'xml-declaration-changed',
      t('ai.declarationChanged', {
        from: originalDeclaration?.raw ?? t('ai.none'),
        to: patchedDeclaration?.raw ?? t('ai.none'),
      }),
      patchedXml,
      verification,
    );
  }

  if (!preservedDoctype) {
    return failure(
      'doctype-changed',
      t('ai.doctypeChanged', {
        from: originalDoctypeLabel(extractDoctype(originalXml), locale),
        to: originalDoctypeLabel(extractDoctype(patchedXml), locale),
      }),
      patchedXml,
      verification,
    );
  }

  if (!prosemirrorCompatible) {
    return failure(
      'prosemirror-incompatible',
      t('ai.visualIncompatible'),
      patchedXml,
      verification,
    );
  }

  if (!structureValid) {
    return failure(
      'structure-invalid',
      structureWarnings.length > 0 ? structureWarnings.join(' ') : t('ai.structureInvalid'),
      patchedXml,
      verification,
    );
  }

  return { ok: true, patchedXml, targetXml: normalized, verification };
}

function firstElementTagName(xml: string): string | null {
  const match = /<([A-Za-z_][\w.:-]*)/.exec(xml);
  return match?.[1] ?? null;
}

function stripCodeFence(text: string): string {
  const trimmed = text.trimStart();
  if (!trimmed.startsWith('```')) return text;

  let body = trimmed.slice(3);
  const newline = body.indexOf('\n');
  if (newline !== -1 && /^[A-Za-z0-9_+-]*[ \t]*\r?$/.test(body.slice(0, newline))) {
    body = body.slice(newline + 1);
  } else {
    const language = /^[A-Za-z0-9_+-]*[ \t]+/.exec(body);
    if (language) body = body.slice(language[0].length);
  }

  const closing = body.lastIndexOf('```');
  return closing === -1 ? body : body.slice(0, closing);
}

function stripWrapperElement(text: string): string {
  const match = WRAPPER_PATTERN.exec(text);
  return match ? match[2]! : text;
}

function stripProlog(text: string, keepLeadingIndent = false): string {
  // `trimStart()` here would delete the indentation that a line-window patch must reproduce.
  let body = text.replace(/^\uFEFF/, '');
  if (!keepLeadingIndent) body = body.trimStart();
  for (;;) {
    const declaration = extractXmlDeclaration(body);
    if (declaration) {
      body = body.slice(declaration.raw.length).trimStart();
      continue;
    }
    if (body.startsWith('<!DOCTYPE')) {
      const doctype = extractDoctype(body);
      if (doctype?.raw) {
        body = body.slice(doctype.raw.length).trimStart();
        continue;
      }
    }
    return body;
  }
}

function hasModelDecorations(candidateXml: string): boolean {
  const trimmed = candidateXml.trim();
  return (
    trimmed.startsWith('```') ||
    /^<(dita_patch|dita_document)\b/.test(trimmed) ||
    trimmed.startsWith('<?xml') ||
    trimmed.startsWith('<!DOCTYPE')
  );
}

function doctypeSignature(doctype: XmlDoctypeInfo | null): string | null {
  if (!doctype) return null;
  return doctype.raw ?? `${doctype.name}|${doctype.publicId}|${doctype.systemId}`;
}

function originalDoctypeLabel(
  doctype: XmlDoctypeInfo | null,
  locale: UiLocale = 'zh-CN',
): string {
  if (!doctype) return coreT(locale, 'ai.none');
  return doctype.raw ?? doctype.name;
}

function failedVerification(warnings: string[]): AiVerificationReport {
  return {
    wellFormed: false,
    prosemirrorCompatible: false,
    preservedDoctype: false,
    preservedXmlDeclaration: false,
    structureValid: false,
    warnings,
  };
}

function failure(
  errorCode: AiSpliceErrorCode,
  errorMessage: string,
  patchedXml: string | null,
  verification: AiVerificationReport,
): AiSpliceFailure {
  return { ok: false, errorCode, errorMessage, patchedXml, verification };
}
