import type * as slimdom from 'slimdom';
import { sync as parseSlimdomSync } from 'slimdom-sax-parser';
import type {
  ParsedXmlDocument,
  XmlDeclaration,
  XmlDoctypeInfo,
  XmlNodeSourceRange,
  XmlParseError,
  XmlSourcePosition,
} from './types.js';

const XML_DECL_REGEX = /^\uFEFF?(<\?xml\s+([\s\S]*?)\?>)/;
const DOCTYPE_REGEX =
  /<!DOCTYPE\s+([^\s[>]+)(?:\s+(PUBLIC)\s+(?:"([^"]*)"|'([^']*)')\s+(?:"([^"]*)"|'([^']*)')|\s+(SYSTEM)\s+(?:"([^"]*)"|'([^']*)'))?(?:\s*\[([\s\S]*?)\])?\s*>/;

export class DitaXmlParseError extends Error {
  readonly line: number;
  readonly column: number;
  readonly offset: number;

  constructor(error: XmlParseError) {
    super(error.message);
    this.name = 'DitaXmlParseError';
    this.line = error.line;
    this.column = error.column;
    this.offset = error.offset;
  }

  toParseError(): XmlParseError {
    return {
      message: this.message,
      line: this.line,
      column: this.column,
      offset: this.offset,
    };
  }
}

export function extractXmlDeclaration(xml: string): XmlDeclaration | null {
  const match = XML_DECL_REGEX.exec(xml);
  if (!match) return null;

  const raw = match[1]!;
  const body = match[2] ?? '';

  const versionMatch = /\bversion\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(body);
  const encodingMatch = /\bencoding\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(body);
  const standaloneMatch = /\bstandalone\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(body);

  return {
    raw,
    version: versionMatch?.[1] ?? versionMatch?.[2] ?? '1.0',
    encoding: encodingMatch?.[1] ?? encodingMatch?.[2],
    standalone: standaloneMatch?.[1] ?? standaloneMatch?.[2],
  };
}

export function extractDoctype(xml: string): XmlDoctypeInfo | null {
  // Only inspect prolog before root element start tag to avoid matching inside CDATA/comments
  const rootStart = findRootElementStartOffset(xml);
  const prolog = rootStart >= 0 ? xml.slice(0, rootStart) : xml;
  const match = DOCTYPE_REGEX.exec(prolog);
  if (!match) return null;

  const raw = match[0];
  const name = match[1]!;
  const isPublic = match[2] === 'PUBLIC';
  const isSystem = match[7] === 'SYSTEM';

  let publicId = '';
  let systemId = '';

  if (isPublic) {
    publicId = match[3] ?? match[4] ?? '';
    systemId = match[5] ?? match[6] ?? '';
  } else if (isSystem) {
    systemId = match[8] ?? match[9] ?? '';
  }

  return {
    name,
    publicId,
    systemId,
    raw,
  };
}

function findRootElementStartOffset(xml: string): number {
  let i = 0;
  if (xml.charCodeAt(0) === 0xfeff) i = 1;

  while (i < xml.length) {
    const ch = xml[i];
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      i++;
      continue;
    }
    if (xml.startsWith('<!--', i)) {
      const end = xml.indexOf('-->', i + 4);
      if (end === -1) return -1;
      i = end + 3;
      continue;
    }
    if (xml.startsWith('<?', i)) {
      const end = xml.indexOf('?>', i + 2);
      if (end === -1) return -1;
      i = end + 2;
      continue;
    }
    if (xml.startsWith('<!DOCTYPE', i)) {
      let depth = 0;
      let inQuote: string | null = null;
      let j = i + 9;
      while (j < xml.length) {
        const c = xml[j]!;
        if (inQuote) {
          if (c === inQuote) inQuote = null;
        } else if (c === '"' || c === "'") {
          inQuote = c;
        } else if (c === '[') {
          depth++;
        } else if (c === ']') {
          depth = Math.max(0, depth - 1);
        } else if (c === '>' && depth === 0) {
          i = j + 1;
          break;
        }
        j++;
      }
      if (j >= xml.length) return -1;
      continue;
    }
    if (ch === '<') {
      return i;
    }
    return -1;
  }

  return -1;
}

function parseSaxesError(err: unknown, xml: string): XmlParseError {
  const rawMessage = err instanceof Error ? err.message : String(err);
  // saxes formats errors like: "12:5: unexpected close tag."
  const locMatch = /^(\d+):(\d+):\s*([\s\S]+)$/.exec(rawMessage);
  if (locMatch) {
    const line = Number(locMatch[1]);
    const column = Number(locMatch[2]);
    const message = locMatch[3]!.trim();
    const offset = lineColumnToOffset(xml, line, column);
    return { message, line, column, offset };
  }
  return {
    message: rawMessage,
    line: 1,
    column: 1,
    offset: 0,
  };
}

function lineColumnToOffset(text: string, line: number, column: number): number {
  let currentLine = 1;
  let idx = 0;
  while (currentLine < line && idx < text.length) {
    const nl = text.indexOf('\n', idx);
    if (nl === -1) return text.length;
    idx = nl + 1;
    currentLine++;
  }
  return Math.min(text.length, idx + Math.max(0, column - 1));
}

export interface ParseXmlOptions {
  /** Track source line/column/offset positions on DOM nodes. Defaults to true. */
  position?: boolean;
  /** Additional XML entities to recognize beyond XML predefined entities. */
  additionalEntities?: Record<string, string>;
}

/**
 * Parse a DITA XML string into a slimdom Document while preserving XML declaration,
 * DOCTYPE metadata, comments, processing instructions, CDATA, and node source positions.
 */
export function parseXml(xml: string, options: ParseXmlOptions = {}): ParsedXmlDocument {
  const xmlDeclaration = extractXmlDeclaration(xml);
  const extractedDoctype = extractDoctype(xml);

  try {
    const doc = parseSlimdomSync(xml, {
      position: options.position ?? true,
      xmlns: true,
      additionalEntities: options.additionalEntities,
    }) as unknown as slimdom.Document;

    if (!doc.documentElement) {
      throw new DitaXmlParseError({
        message: 'XML document has no root element.',
        line: 1,
        column: 1,
        offset: 0,
      });
    }

    let doctype: XmlDoctypeInfo | null = extractedDoctype;
    if (!doctype && doc.doctype) {
      doctype = {
        name: doc.doctype.name,
        publicId: doc.doctype.publicId,
        systemId: doc.doctype.systemId,
      };
    }

    return {
      document: doc,
      xmlDeclaration,
      doctype,
    };
  } catch (err) {
    if (err instanceof DitaXmlParseError) {
      throw err;
    }
    throw new DitaXmlParseError(parseSaxesError(err, xml));
  }
}

export type XmlWellFormedResult =
  | { ok: true; parsed: ParsedXmlDocument }
  | { ok: false; error: XmlParseError };

/**
 * Check XML well-formedness without throwing. Used to guard Source -> Visual transitions.
 */
export function checkXmlWellFormed(
  xml: string,
  options: ParseXmlOptions = {},
): XmlWellFormedResult {
  try {
    const parsed = parseXml(xml, options);
    return { ok: true, parsed };
  } catch (err) {
    if (err instanceof DitaXmlParseError) {
      return { ok: false, error: err.toParseError() };
    }
    return { ok: false, error: parseSaxesError(err, xml) };
  }
}

interface PositionTrackedSlimdomNode {
  position?: XmlSourcePosition;
  closePosition?: XmlSourcePosition;
}

/**
 * Retrieve source position range attached by slimdom-sax-parser to a parsed DOM node.
 */
export function getNodeSourceRange(node: slimdom.Node): XmlNodeSourceRange {
  const tracked = node as unknown as PositionTrackedSlimdomNode;
  return {
    open: tracked.position,
    close: tracked.closePosition,
  };
}
