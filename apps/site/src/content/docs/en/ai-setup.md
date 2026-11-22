---
title: AI setup and security boundaries
description: Configure an OpenAI-compatible model, understand the SSE protocol, role boundaries, and why AI never rewrites XML directly.
updated: '2026-11-22'
---

AI assistance is a Phase 6 capability with a deliberately narrow role: **the model proposes XML fragments; it never edits the document directly**. Whether the document changes is decided by server verification and human diff review.

## Configure a model

DITAEditor speaks the OpenAI-compatible Chat Completions protocol, so DeepSeek or a private gateway works out of the box.

Configure it in the UI as Admin:

1. Open AI settings while using the Admin identity.
2. Fill in `baseUrl`, `model`, `apiKey`, temperature, timeout, and max context characters.
3. Run "Test connection" and confirm the model responds.
4. Save. Database values take precedence over environment variables.

Environment variables are supported as a fallback:

```bash
export DEEPSEEK_API_KEY="sk-..."
export DEEPSEEK_BASE_URL="https://api.deepseek.com/v1"
export DEEPSEEK_MODEL="deepseek-flash"
export AI_TIMEOUT_MS="60000"
export AI_MAX_CONTEXT_CHARS="48000"
```

## Endpoints and roles

| Endpoint | Method | Role | Notes |
| --- | --- | --- | --- |
| `/api/ai/config` | GET | Any identified user | Returns only `maskedApiKey`, e.g. `sk-****9a2f` |
| `/api/ai/config` | PUT | Admin | Writes settings; the plaintext key is never returned |
| `/api/ai/config/test` | POST | Admin | Minimal request with the current settings |
| `/api/ai/usage` | GET | Admin | Calls, tokens, and latency |
| `/api/ai/stream` | POST | Writer / Admin | Streams candidates and verification over SSE |

Keys live only on the server. The browser never receives plaintext and never stores keys in localStorage.

## How a request flows

```text
Web AI panel
  ├─ POST /api/ai/stream  { mode, target?, instruction, documentXml }
  │     mode: full-document | line-window | element
  ├─ SSE: status → delta → candidate → verification → done | error
  ▼
@dita/core (server)
  normalizeCandidateXml(candidate)     strip fences, declarations, stray roots
  spliceAndVerifyAiXml(document, ...)  lossless splice + structural verification
  ▼
Web: AiDiffDialog → resolveAiApplyMode → applyAiPatchedXml
  apply | checkout-and-apply | preview-only
```

### Three target scopes

- **full-document (default)**: the whole topic. The patch must preserve the root element, XML declaration, and DOCTYPE; a root tag change returns `structure-invalid`.
- **line-window**: replace around a line range, with the spliced document as the authority.
- **element**: the candidate must be a single root fragment, used by the bubble toolbar, diagnostics, and strict-validation fixes.

A fragment request with no resolvable target degrades to full-document rather than guessing.

## Why diff review is mandatory

Even a plausible model response can:

- drop comments, PIs, or `xml:lang`;
- reorder attributes, creating meaningless Git diffs;
- introduce DTD-illegal children;
- silently change `keyref` or `conref` semantics.

The write path is therefore fixed: server splice and verification → client diff → explicit user choice. Visual applies stay a single ProseMirror transaction (`skipVisualReload: true`); source applies are a single CodeMirror replacement. `Cmd/Ctrl+Z` undoes the whole AI edit in one step.

## SSE and disconnects

- The server cancels the upstream request only on `'aborted'` or on a response `'close'` where `writableEnded` is false.
- Do not listen for `req.raw` `'close'`: it fires after the body is consumed and would kill healthy streams.
- The browser uses `fetch` + `ReadableStream` to parse SSE, because native `EventSource` cannot send identity headers.

Regression coverage: `apps/api/test/phase6-ai-sse-socket.test.ts`.

## Verification and retries

After producing a candidate, the server runs structural verification. On failure it retries once at most, feeding the reason back to the model. If verification still fails, the `verification` event reports it and no applicable patch is produced.

## Cost and privacy

- Every call is recorded in `ai_usage_logs` with tokens and latency; only Admin can read it.
- Only the target fragment and necessary topic context are sent, bounded by `AI_MAX_CONTEXT_CHARS`.
- For private deployments, point `baseUrl` at your own compatible gateway. No telemetry is sent to the DITAEditor project.

## Acceptance script

A live end-to-end check lives at `apps/api/scripts/e2e-ai-live.mts`. It reads the current settings, runs a full streaming request, and verifies that the candidate splices losslessly. Confirm your key and quota before running it.

## Next steps

- Full write path: [Feature tour](/en/docs/features)
- Deployment and volumes: [Getting started with Docker](/en/docs/getting-started)
