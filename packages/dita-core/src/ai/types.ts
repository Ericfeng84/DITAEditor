/**
 * Phase 6 AI assistance — fragment targeting, extraction, and lossless splicing contracts.
 * Binding interface: docs/phase6-ai-contract.md §1.
 */

export type AiTargetMode = 'element' | 'line-window' | 'full-document';

export interface AiTargetSpec {
  mode: AiTargetMode;
  /** 0-based element-child-index path ([] = root element, [0] = first element child). */
  elementPath?: readonly number[];
  /** 1-based start line of a line-window target. Defaults to 1. */
  line?: number;
  /** 1-based column hint (informational only; not used for offset computation). */
  column?: number;
  /** 1-based end line of a multi-line line-window target. Defaults to `line`. */
  lineEnd?: number;
  selectedText?: string;
}

export interface AiExtractOptions {
  /** Radius of the read-only context window in complete lines. Defaults to 25. */
  contextLines?: number;
  /** Hard character cap for `contextXml`. Defaults to 4000. */
  maxContextChars?: number;
  /** Cap that only flips `truncated`; the replace range itself is never truncated. Defaults to 12000. */
  maxTargetChars?: number;
}

export interface AiFragmentExtraction {
  mode: AiTargetMode;
  originalXml: string;
  rootTagName: string;
  targetTag: string | null;
  parentTag: string | null;
  /** Exact source slice of the target element (element/line-window) or the whole document. */
  targetXml: string;
  startOffset: number;
  endOffset: number;
  lineStart: number;
  lineEnd: number;
  /** ±N lines around the target with the target in place, used only as prompt context. */
  contextXml: string;
  selectedText?: string;
  truncated: boolean;
}

export interface AiVerificationReport {
  wellFormed: boolean;
  prosemirrorCompatible: boolean;
  preservedDoctype: boolean;
  preservedXmlDeclaration: boolean;
  structureValid: boolean;
  warnings: string[];
}

export type AiSpliceErrorCode =
  | 'invalid-target'
  | 'candidate-malformed'
  | 'candidate-empty'
  | 'patched-malformed'
  | 'doctype-changed'
  | 'xml-declaration-changed'
  | 'prosemirror-incompatible'
  | 'structure-invalid';

export interface AiSpliceSuccess {
  ok: true;
  patchedXml: string;
  /** Normalized candidate XML that now occupies the target range. */
  targetXml: string;
  verification: AiVerificationReport;
}

export interface AiSpliceFailure {
  ok: false;
  errorCode: AiSpliceErrorCode;
  errorMessage: string;
  /** Patched document kept for retry feedback; `null` when it was not well-formed. */
  patchedXml: string | null;
  verification: AiVerificationReport;
}

export type AiSpliceResult = AiSpliceSuccess | AiSpliceFailure;
