import { isChildAllowed } from '../model/dita-rules.js';
import { xmlToPmDoc } from '../prosemirror/converter.js';
import {
  checkXmlWellFormed,
  extractDoctype,
  extractXmlDeclaration,
  findRootElementStartOffset,
} from '../xml/parser.js';
import type { XmlDoctypeInfo } from '../xml/types.js';
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
export function normalizeCandidateXml(candidateXml: string): string {
  let text = candidateXml;
  for (let pass = 0; pass < 3; pass += 1) {
    const before = text;
    text = stripProlog(stripWrapperElement(stripCodeFence(text))).trim();
    if (text === before) break;
  }
  return text.trim();
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
): AiSpliceResult {
  const normalized = normalizeCandidateXml(candidateXml);
  if (normalized.length === 0) {
    return failure(
      'candidate-empty',
      'AI 返回的候选片段为空。',
      null,
      failedVerification(['候选片段为空，请返回完整的 XML 片段。']),
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
    const detail = candidateParsed.ok ? '候选片段没有根元素。' : candidateParsed.error.message;
    return failure(
      'candidate-malformed',
      `候选片段不是良构的单个 XML 元素：${detail}`,
      null,
      failedVerification([`候选片段良构性校验失败：${detail}`]),
    );
  }

  if (
    extraction.mode !== 'element' &&
    extraction.mode !== 'line-window' &&
    extraction.mode !== 'full-document'
  ) {
    return failure(
      'invalid-target',
      `不支持的 AI 定位模式：${String(extraction.mode)}。`,
      null,
      failedVerification([`不支持的定位模式：${String(extraction.mode)}。`]),
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
      `无效的替换区间 [${String(startOffset)}, ${String(endOffset)})，原文长度为 ${originalXml.length}。`,
      null,
      failedVerification([`替换区间 [${String(startOffset)}, ${String(endOffset)}) 超出原文范围。`]),
    );
  }
  if (extraction.originalXml.length > 0 && extraction.originalXml !== originalXml) {
    return failure(
      'invalid-target',
      '提取结果与当前原文不一致，请重新定位目标片段后再回拼。',
      null,
      failedVerification(['提取时使用的原文与本次回拼的原文不一致（文件可能已被修改）。']),
    );
  }

  const warnings: string[] = [];
  if (hasModelDecorations(candidateXml)) {
    warnings.push('候选片段中的 Markdown 代码围栏 / 包装元素 / 序言已被移除。');
  }

  let patchedXml: string;
  if (extraction.mode === 'full-document') {
    const rootStart = findRootElementStartOffset(originalXml);
    const prolog = rootStart > 0 ? originalXml.slice(0, rootStart) : '';
    patchedXml = prolog + normalized;
    if (prolog.length > 0) {
      warnings.push('已逐字复用原始 XML 声明 / DOCTYPE / 序言。');
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
    structureWarnings.push(`<${candidateRootTag}> 不允许作为 <${extraction.parentTag}> 的子元素。`);
  }
  if (wellFormedResult.ok && extraction.rootTagName && patchedRootTag !== extraction.rootTagName) {
    structureValid = false;
    structureWarnings.push(
      `根元素被改动：<${extraction.rootTagName}> → <${patchedRootTag || '(无)'}>。`,
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
        `Visual 模式转换失败：${err instanceof Error ? err.message : String(err)}`,
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
      `回拼后 XML 非良构：第 ${wellFormedResult.error.line} 行第 ${wellFormedResult.error.column} 列 ${wellFormedResult.error.message}`,
    );
    return failure(
      'patched-malformed',
      `回拼后 XML 非良构：${wellFormedResult.error.message}`,
      null,
      verification,
    );
  }

  if (!preservedXmlDeclaration) {
    return failure(
      'xml-declaration-changed',
      `回拼后 XML 声明被改动：${originalDeclaration?.raw ?? '(无)'} → ${patchedDeclaration?.raw ?? '(无)'}。`,
      patchedXml,
      verification,
    );
  }

  if (!preservedDoctype) {
    return failure(
      'doctype-changed',
      `回拼后 DOCTYPE 被改动：${originalDoctypeLabel(extractDoctype(originalXml))} → ${originalDoctypeLabel(extractDoctype(patchedXml))}。`,
      patchedXml,
      verification,
    );
  }

  if (!prosemirrorCompatible) {
    return failure(
      'prosemirror-incompatible',
      '回拼后的文档无法在 Visual（ProseMirror）模式中无损渲染。',
      patchedXml,
      verification,
    );
  }

  if (!structureValid) {
    return failure(
      'structure-invalid',
      structureWarnings.length > 0 ? structureWarnings.join(' ') : '回拼后的文档结构不合法。',
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

function stripProlog(text: string): string {
  let body = text.replace(/^\uFEFF/, '').trimStart();
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

function originalDoctypeLabel(doctype: XmlDoctypeInfo | null): string {
  if (!doctype) return '(无)';
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
