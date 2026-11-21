import type * as slimdom from 'slimdom';

export interface XmlAttributeEntry {
  name: string;
  value: string;
  namespaceURI?: string | null;
}

export interface XmlDeclaration {
  raw: string;
  version: string;
  encoding?: string;
  standalone?: string;
}

export interface XmlDoctypeInfo {
  name: string;
  publicId: string;
  systemId: string;
  /** Exact raw declaration text (e.g., preserving quote style or internal subset). */
  raw?: string;
}

export interface XmlSourcePosition {
  line: number;
  column: number;
  start: number;
  end: number;
}

export interface XmlNodeSourceRange {
  open?: XmlSourcePosition;
  close?: XmlSourcePosition;
}

export interface XmlParseError {
  message: string;
  line: number;
  column: number;
  offset: number;
}

export interface ParsedXmlDocument {
  document: slimdom.Document;
  xmlDeclaration: XmlDeclaration | null;
  doctype: XmlDoctypeInfo | null;
}

export type XmlPrologItem =
  | { type: 'comment'; data: string }
  | { type: 'pi'; target: string; data: string }
  | { type: 'doctype'; info: XmlDoctypeInfo };

export interface SerializeXmlOptions {
  /** Indentation unit for structural block children. Defaults to two spaces. */
  indent?: string;
  /** Line ending sequence. Defaults to '\n'. */
  lineEnding?: '\n' | '\r\n';
  /** Whether to emit the XML declaration if present. Defaults to true. */
  includeXmlDeclaration?: boolean;
  /** Whether to append a trailing newline at EOF. Defaults to true. */
  trailingNewline?: boolean;
}
