# Phase 6 AI Assistance — Implementation Contract

Companion to `docs/phase6-ai-implementation-plan.md`. This file is the **single source of truth for
cross-package interfaces** while `@dita/core`, `@dita/api`, and `@dita/web` are implemented in
parallel. Additive fields are allowed; renames are not.

## 1. `@dita/core` — `src/ai/`

```ts
export type AiTargetMode = 'element' | 'line-window' | 'full-document';

export interface AiTargetSpec {
  mode: AiTargetMode;
  /** 0-based element-child-index path (same convention as DitaMapNode.elementPath). */
  elementPath?: readonly number[];
  line?: number;   // 1-based
  column?: number; // 1-based
  selectedText?: string;
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
  targetXml: string;
  verification: AiVerificationReport;
}
export interface AiSpliceFailure {
  ok: false;
  errorCode: AiSpliceErrorCode;
  errorMessage: string;
  patchedXml: string | null;
  verification: AiVerificationReport;
}
export type AiSpliceResult = AiSpliceSuccess | AiSpliceFailure;

export function extractTargetFragment(
  xml: string,
  target: AiTargetSpec,
  options?: { contextLines?: number; maxTargetChars?: number },
): AiFragmentExtraction;

export function spliceAndVerifyAiXml(
  originalXml: string,
  extraction: AiFragmentExtraction,
  candidateXml: string,
): AiSpliceResult;

/** Strip markdown fences/prolog from a model reply (line windows keep their first-line indent). */
export function normalizeCandidateXml(
  candidateXml: string,
  options?: { keepLeadingIndent?: boolean },
): string;

/** Widen a diagnostic line window to the innermost enclosing element (or the whole document). */
export function widenAiFixTarget(
  xml: string,
  target: AiTargetSpec,
  options?: { maxLines?: number },
): AiTargetSpec;

export function buildDitaConstraintSummary(rootTag: string | null, parentTag: string | null): string;
```

Rules:

- `extractTargetFragment` throws `Error` with a human-readable Chinese message for unusable targets
  (bad path, missing line for line-window when the XML is malformed, empty selection).
- `element` mode resolves the path over **element children only**, records `getNodeSourceRange`
  offsets (exact, including the closing tag), and never reserializes the document.
- `line-window` mode computes `startOffset` at the beginning of `lineStart` and `endOffset` at the end
  of `lineEnd`, clamped to `xml.length`.
- `full-document` mode returns `startOffset = 0`, `endOffset = xml.length`.
- `spliceAndVerifyAiXml` for element/line-window inserts the normalized candidate between
  `startOffset`/`endOffset`. For full-document it replaces the whole body but **reuses the original
  prolog verbatim** (XML declaration, DOCTYPE, comments/PIs before the root element).
- Verification always checks: patched XML well-formed (`checkXmlWellFormed`), raw
  `extractXmlDeclaration` / `extractDoctype` unchanged, root tag unchanged, and for DITA topic roots
  `xmlToPmDoc(patchedXml)` succeeds (`prosemirrorCompatible`). `structureValid` uses
  `isChildAllowed(parentTag, candidateRootTag)` when a parent tag exists, otherwise `true`.
- **A reported line is not always the cause**: validators point at the tag that tripped them (a
  DITA-OT strict message on `</step>` for a duplicated `<cmd>` two lines above). Diagnostic entry
  points (`handleAiFixXmlError`, `handleAiFixDiagnostic`, `handleAiFixStrictDiagnostic`) therefore go
  through `buildDiagnosticFixTarget` → `widenAiFixTarget`, which expands the window to the innermost
  element whose source range contains the reported line (falling back to `full-document` when that
  element is the root or wider than `DEFAULT_AI_FIX_WINDOW_MAX_LINES = 80`) and pads
  `AI_FIX_MALFORMED_CONTEXT_LINES = 12` lines when the XML cannot be parsed at all.
- A patch identical to the buffer is a **no-op, never a success**: the panel/dialog disable 应用 and
  show `ai.badge.noChange`, and `handleApplyAiProposal` refuses (a) a patch equal to the current
  buffer and (b) a stale proposal whose `originalXml` no longer matches it. Line-window patches are
  normalized with `keepLeadingIndent: true` so the replaced block keeps its indentation.
- No Node-only imports.

## 2. DB (`apps/api/src/db`)

`ai_settings` singleton (`id = 'default'`): `baseUrl`, `model`, `apiKey` (nullable), `temperature`
(default 0.2), `maxRetries` (default 2), `timeoutMs` (default 45000), `updatedBy`, `updatedAt`.

`ai_usage_logs`: `id`, `projectId`, `branch`, `userId`, `userDisplayName`, `taskType`
(`ask|authoring|optimize_tags|fix_error`), `subAction`, `filePath`, `model`, `status`
(`succeeded|failed|cancelled`), `retryCount`, `promptTokens`, `completionTokens`, `totalTokens`,
`durationMs`, `errorMessage`, `createdAt`. Never store document content.

## 3. REST contract

```ts
// GET /api/ai/config  (any identity)
interface AiPublicConfig {
  configured: boolean;
  baseUrl: string;
  model: string;
  hasApiKey: boolean;
  apiKeySource: 'db' | 'env' | 'none';
  maskedApiKey: string | null;
  temperature: number;
  maxRetries: number;
  timeoutMs: number;
  maxContextChars: number;
  canEdit: boolean;
}
// PUT /api/ai/config (admin) body { baseUrl?, model?, apiKey?: string | null, temperature?, maxRetries?, timeoutMs? }
// POST /api/ai/config/test (admin) body { baseUrl?, model?, apiKey? } -> { ok, latencyMs, model, message? }
// GET /api/ai/usage?days=30&limit=50 (admin) -> { days, totals, byDay, byTask, byUser, byModel, recent }

interface AiStreamRequest {
  projectPath: string;
  /** Current editor buffer (may contain unsaved edits). Falls back to the file on disk. */
  xml?: string;
  rootMapPath?: string;
  ditavalPath?: string;
  taskType: 'ask' | 'authoring' | 'optimize_tags' | 'fix_error';
  subAction?: 'optimize_tags' | 'fix_xml' | 'fix_diagnostic' | 'fix_strict';
  instruction: string;
  target: AiTargetSpec;
  context?: { diagnostics?: { source: string; message: string; line?: number; column?: number; code?: string }[] };
  history?: { role: 'user' | 'assistant'; content: string }[];
}
```

`POST /api/ai/stream` (all roles) responds `text/event-stream`:

| event      | payload                                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| `meta`     | `{ requestId, model, targetMode, targetTag: string \| null, contextBadges: string[] }`                            |
| `delta`    | `{ text }` — explanation text only, patch content filtered out                                                   |
| `retry`    | `{ attempt, maxRetries, reason }`                                                                                |
| `proposal` | `{ explanation, changesSummary: string[], originalXml, patchedXml, targetMode, targetTag, verification: { wellFormed, prosemirrorCompatible, preservedDoctype, retryCount, warnings[] }, canRevalidateStrict }` |
| `error`    | `{ message, code? }`                                                                                             |
| `done`     | `{ status: 'succeeded' \| 'failed' \| 'cancelled', usage: { promptTokens, completionTokens, totalTokens }, durationMs }` |

Frames are `event: <name>\ndata: <json>\n\n`. Client disconnect aborts the LangChain stream and the
usage row is stored as `cancelled`.

Model output protocol: `<explanation>…</explanation><dita_patch>…</dita_patch>`; `ask` omits the
patch. The server must never trust the patch blindly — it always runs
`extractTargetFragment` + `spliceAndVerifyAiXml` and retries at most `maxRetries` times with the
verification error appended to the conversation.

## 4. Web wiring

- `apps/web/src/ai/ai-api.ts` — REST + SSE client reusing the `parseEventFrame` pattern from
  `services/publish-api.ts` (fetch with `x-dita-user-id`, `accept: text/event-stream`, abort support).
- `apps/web/src/ai/ai-store.ts` — zustand store with at least: `panelOpen`, `tab`,
  `phase: 'idle' | 'streaming' | 'proposal' | 'error'`, `messages`/`deltaText`, `proposal`,
  `verification`, `config`, `usage`, `openPanel`, `closePanel`, `send`, `cancel`, `applyProposal`,
  `dismissProposal`, `loadConfig`, `saveConfig`, `testConfig`, `loadUsage`.
- `apps/web/src/ai/ai-target.ts` — pure helpers `buildVisualAiTarget(pmDoc, from, to)`,
  `buildSourceAiTarget(xml, cursorOffset, selectionText)` and `resolveScopeTarget(scope, candidates)`
  returning `AiTargetSpec`.
- Panel scope toggle (`AiTargetScope = 'fragment' | 'document'`): the panel defaults to
  `'document'` so one instruction can author or rewrite a **complete topic** (`{ mode: 'full-document' }`);
  entry points that carry an explicit selection (bubble toolbar, diagnostics, strict validation) force
  `'fragment'`. Fragment mode with no resolvable target degrades to `'full-document'`.
- `editor-store.applyAiPatchedXml(tabPath, patchedXml)` — one-shot application; Visual mode goes
  through a single ProseMirror transaction, Source mode through a single CodeMirror dispatch
  (single-step undo), and both update `baselineXml`-independent dirty state.
- Inspector tab id `'ai'` in `TopicInspector`; lock guard via
  `resolveFileEditability` (`admin|owned|memory` → apply, `unlocked` writer → checkout + apply,
  `viewer|locked-by-other` → preview only).
