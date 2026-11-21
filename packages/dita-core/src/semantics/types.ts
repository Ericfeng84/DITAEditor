import type { DitaProfilingAttrName } from '../ditaval/ditaval.js';

export interface KeyDefinition {
  key: string;
  qualifiedKey: string;
  keyscope?: string;
  sourceMapPath: string;
  elementPath: number[];
  tagName: string;
  line: number;
  column: number;
  href?: string;
  resolvedHref?: string;
  fragment?: string;
  format?: string;
  scope?: string;
  processingRole?: string;
  isExternal: boolean;
  inlineText?: string;
  inlineTextSource?: 'keyword' | 'linktext' | 'navtitle' | 'none';
  targetTitle?: string;
  /** Number of lower-priority duplicate definitions shadowed by this winning definition. */
  shadowedCount: number;
}

export interface KeyspaceMapCycle {
  fromMap: string;
  toMap: string;
  line: number;
  column: number;
}

export interface KeyspaceResult {
  rootMapPath: string;
  /** Winning key definitions indexed by `qualifiedKey` (First Definition Wins, BFS). */
  keys: Record<string, KeyDefinition>;
  /** All key definitions encountered in BFS traversal order (including shadowed definitions). */
  allDefinitions: KeyDefinition[];
  /** Distinct `keyscope` prefixes discovered during traversal. */
  scopes: string[];
  /** Distinct local topic paths referenced anywhere inside this Root Map tree. */
  referencedTopics: string[];
  /** Any `<mapref>` cycles encountered while expanding the Root Map tree. */
  mapCycles: KeyspaceMapCycle[];
}

export interface IndexedTopicElement {
  filePath: string;
  topicId: string;
  elementId: string;
  fragment: string;
  tagName: string;
  isTopicRoot: boolean;
  previewText: string;
  line: number;
  column: number;
  elementPath: number[];
  hasConref: boolean;
  conrefAttr?: 'conref' | 'conkeyref';
  conrefValue?: string;
}

export interface TopicIdIndexEntry {
  filePath: string;
  rootTag: string;
  rootTopicId?: string;
  title?: string;
  elements: IndexedTopicElement[];
  profilingValues: Record<DitaProfilingAttrName, string[]>;
  wellFormed: boolean;
}

export interface ResolvedKeyrefResult {
  keyref: string;
  keyName: string;
  elementId?: string;
  status: 'resolved' | 'unresolved';
  definition?: KeyDefinition;
  resolvedText?: string;
  targetFilePath?: string;
  targetFragment?: string;
  errorMessage?: string;
}

export type ConrefResolutionStatus =
  | 'resolved'
  | 'cycle'
  | 'missing-key'
  | 'missing-file'
  | 'missing-target'
  | 'incompatible-tag'
  | 'invalid-syntax'
  | 'malformed-target';

export interface ResolvedConrefResult {
  sourceFilePath: string;
  sourceTagName: string;
  attrName: 'conref' | 'conkeyref';
  rawValue: string;
  conrefend?: string;
  status: ConrefResolutionStatus;
  targetFilePath?: string;
  targetTopicId?: string;
  targetElementId?: string;
  targetTagName?: string;
  targetLine?: number;
  targetColumn?: number;
  resolvedXml?: string;
  resolvedText?: string;
  isInline?: boolean;
  cycleChain?: string[];
  errorMessage?: string;
}

export type SemanticDiagnosticSource =
  | 'xml'
  | 'map-ref'
  | 'asset-ref'
  | 'keyref'
  | 'conref'
  | 'conref-cycle'
  | 'ditaval';

export interface SemanticDiagnostic {
  id: string;
  filePath: string;
  line: number;
  column: number;
  severity: 'error' | 'warning';
  source: SemanticDiagnosticSource;
  message: string;
  targetHref?: string;
  resolvedPath?: string;
  keyName?: string;
  cycleChain?: string[];
}

export interface DocumentSemanticOverlay {
  filePath: string;
  rootMapPath: string | null;
  keyrefs: Record<string, ResolvedKeyrefResult>;
  conrefs: Record<string, ResolvedConrefResult>;
  diagnostics: SemanticDiagnostic[];
}

/**
 * Deterministic key used to index and look up conref overlays between `DitaSemanticIndex`
 * and Visual Editor / AttributesPanel consumers.
 */
export function makeConrefOverlayKey(
  sourceTagName: string,
  attrName: 'conref' | 'conkeyref',
  rawValue: string,
  conrefend?: string,
): string {
  return `${sourceTagName}::${attrName}::${rawValue}${conrefend ? `::${conrefend}` : ''}`;
}
