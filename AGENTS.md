# AGENTS.md

Guidance for AI coding agents working in the **DITAEditor** repository.

## 1. Project Overview

**DITAEditor** is a team-oriented lightweight Web DITA 1.3 structured authoring workbench.

- **Architecture & Roadmap Baseline**: See `docs/architecture-and-plan.md` for full design decisions, system architecture, and phased vertical slices (Phase 0–14 implemented; Phase 13 spec in `docs/phase13-versioning-overlay-plan.md`, Phase 14 spec in `docs/phase14-docling-agent-plan.md`).
- **DITA 1.3 Specification Reference**: [OASIS DITA Version 1.3 Part 2: Technical Content Edition](https://docs.oasis-open.org/dita/dita/v1.3/dita-v1.3-part2-tech-content.html) — authoritative reference for DITA 1.3 element content models, attributes, and semantics.
- **Local DITA 1.3 Element References**: See [`docs/dita/`](docs/dita/) (`dita_concept.md`, `dita_reference.md`, `dita_task.md`) for local DITA topic type references.
- **Core Product Decisions**:
  - Dual-mode editing: Visual structured WYSIWYG (**ProseMirror**) + XML source (**CodeMirror 6**).
  - **Standard DITA XML is the single source of truth** (100% lossless round-trip, deterministic formatting, minimal Git Diff).
  - Core DITA 1.3 elements are finely modeled; unknown/specialized elements pass through losslessly via `unknown_block` / `unknown_inline`.
  - Concurrency model: **Check-out exclusive file lock** per `(project, branch, file_path)` with branch-isolated `git worktree` (no CRDT real-time co-editing).
  - License: **MIT** ([LICENSE](LICENSE)); UI screenshots live in `docs/pic/` (Chinese UI) and `docs/pic/en/` (English UI, used by `README.en.md`); both are referenced from `README.md` / `README.en.md`.
  - Validation & Publishing: Frontend real-time constraints + TS semantic indexer + **DITA-OT 4.x CLI** invoked from `@dita/api` (built-in OASIS DITA 1.3 DTD/RNG validation & HTML5/PDF publishing with pure-XML Noto CJK font-mappings plugin; zero custom Java service code); HTML5 output is then post-processed by a deterministic Node enhancer that injects one of the static themes in `dita-ot-plugins/html5-themes/`).

## 2. Repository Layout

```text
DITAEditor/
├── packages/
│   └── dita-core/          # @dita/core — shared isomorphic DITA XML & ProseMirror kernel
│       ├── src/
│       │   ├── xml/        # slimdom-sax-parser + position tracking, deterministic serializer, fontoxpath, DOM diff
│       │   ├── model/      # DITA 1.3 element registry (block/inline/structural/whitespace-preserve)
│       │   ├── cals/       # OASIS CALS table <-> colspan/rowspan & occupancy grid adapter
│       │   ├── ai/         # AI target-fragment locator, candidate normalizer, lossless splice+verify
│       │   ├── ingest/     # Markdown outline slicing, data-URI image extraction, plan/map builder (Phase 14)
│       │   └── prosemirror/# Native ProseMirror Schema & lossless slimdom <-> PM Doc converter
│       └── test/
│           ├── fixtures/   # 10 complex DITA 1.3 golden round-trip fixtures
│           └── *.test.ts   # Vitest golden, passthrough, CALS, parser/XPath tests
├── apps/
│   ├── web/                # @dita/web — React 19 + TypeScript + Vite frontend workbench
│   ├── api/                # @dita/api — Fastify + Zod API, SQLite/Drizzle identities & locks, simple-git
│   │   └── src/modules/{git,identity,locks,files,indexer,validate,publish,dita-ot,ai,ingest,static}/
│   └── site/               # @dita/site — Astro 5 + React 19 islands + Tailwind 4 marketing site,
│       │                   #   browser DITA sandbox (/playground) and bilingual docs (/docs, /en/docs)
│       ├── src/{pages,layouts,components,lib,data,i18n,styles}/
│       └── src/content/docs/{zh,en}/  # 6 mirrored docs each (Content Collections)
├── dita-ot-plugins/        # DITA-OT 4.x plugins and static HTML5 publish themes
│   ├── com.ditaeditor.pdf-cjk/  # Pure-XML Noto CJK PDF font-mappings plugin
│   └── html5-themes/      # shared/theme-base.css + theme-runtime.js + 4 theme CSS (Phase 12)
├── Dockerfile              # Single container: Node + JRE 21 + DITA-OT 4.2.1 + Noto CJK (opt-in INSTALL_MARKITDOWN)
├── docker-compose.yml      # Full stack: ditaeditor + docling-serve sidecar (Phase 14)
├── docs/                   # Architecture baseline, ADRs, and contracts
└── graphify-out/           # Persistent codebase knowledge graph (graph.json, GRAPH_REPORT.md, graph.html)
```

## 3. Build, Typecheck & Test Commands

Package manager is **pnpm** (`packageManager: pnpm@11.5.2`). Note `pnpm-workspace.yaml` declares `allowBuilds` for `esbuild`, `better-sqlite3`, `electron` and `sharp` (and explicitly disables `electron-winstaller`).

```bash
# Workspace-wide build, typecheck, and tests (works in sandboxed environments too)
pnpm -r build
pnpm -r typecheck
pnpm -r test

# Turborepo shortcuts (uses root scripts)
pnpm build
pnpm typecheck
pnpm test

# Focused package commands
pnpm --filter @dita/core test
pnpm --filter @dita/core test:watch
pnpm --filter @dita/web dev
pnpm --filter @dita/api dev
pnpm --filter @dita/site dev      # http://localhost:4321 (static site + sandbox + docs)
pnpm --filter @dita/site build    # astro build + Pagefind index over dist/
pnpm --filter @dita/desktop dev   # Electron shell + in-process @dita/api (self-heals the Electron binary first)
```

Always run `pnpm -r build && pnpm -r typecheck && pnpm -r test` after code changes before finishing a task.

### 3.1 Desktop (`@dita/desktop`) runtime gotchas

- **Never trust `electron`'s postinstall**: electron 35's `install.js` unpacks the cached zip with `extract-zip@2`, which on some environments (reproduced on macOS arm64 + Node 24.16.0) stalls on the second zip entry and — with nothing keeping the event loop alive — exits `0` after writing only `dist/LICENSES.chromium.html` with no `path.txt`. The visible symptom is `Error: Electron failed to install correctly, please delete node_modules/electron and try installing again`. Do **not** just re-run `node install.js` (it silently half-installs again).
- **`apps/desktop/scripts/ensure-electron.mjs` is the repair path**: it validates `path.txt` + `dist/<exe>` (~60 ms) and, when broken, re-extracts the checksum-verified cached archive with the OS `unzip` / PowerShell `Expand-Archive`, falling back to a child-process `extract-zip` behind a 5-minute timeout. It is wired into `dev` (always) and `postinstall` (only when pnpm actually installs the workspace project — pnpm 11 skips lifecycle scripts on a no-op `pnpm install`).
- **`better-sqlite3` must stay a direct dependency of `apps/desktop`**: `scripts/build.mjs` marks it `external`, and pnpm's isolated layout means `apps/api/node_modules/better-sqlite3` is invisible to `apps/desktop/dist/main.mjs`; removing it resurfaces `ERR_MODULE_NOT_FOUND` only in the dev path (packaging works because `scripts/stage.mjs` runs its own `npm install`).

## 4. Non-Negotiable Engineering Invariants

### 4.1 Lossless XML Round-Trip & Minimal Git Diff
- **Never drop XML metadata**: XML declaration (`<?xml ...?>`), `<!DOCTYPE ...>` (including exact PUBLIC/SYSTEM/internal subset), comments (`<!-- ... -->`), processing instructions (`<?...?>`, e.g. `<?xml-model?>`, `<?oxy_comment_start?>`), CDATA sections (`<![CDATA[...]]>`), and XML namespaces (`xml:*`, `xmlns:*`, `ditaarch:*`) MUST survive `XML → slimdom → ProseMirror Doc → slimdom → XML` untouched.
- **Preserve exact attribute order**: Every modeled and unknown ProseMirror node stores `rawAttrs: XmlAttributeEntry[]` in original document order. Do not convert `rawAttrs` into an unordered JS object when serializing back to XML.
- **Deterministic formatting**: `serializeXml()` must remain idempotent (`roundTrip(roundTrip(xml)) === roundTrip(xml)`). Editing a single text node in ProseMirror must only change that single line in the serialized XML.

### 4.2 ProseMirror Schema Rules (`@dita/core`)
- **Use inline nodes, NOT ProseMirror Marks, for DITA inline elements**: Tags such as `<b>`, `<i>`, `<keyword>`, `<ph>`, `<xref>`, `<codeph>` are modeled as inline ProseMirror nodes (`inline: true, content: 'inline*'`) so empty elements (`<keyword keyref="prod_name"/>`), exact nesting order (`<b><i>` vs `<i><b>`), and per-element `rawAttrs` never get dropped, reordered, or merged.
- **Use `xml_text_block` for mixed content**: Never synthesize `<p>` tags around bare text inside `<li>`, `<dd>`, `<note>`, `<entry>`, `<section>`, etc. Use `xml_text_block` (which unwraps on XML serialization). When `<p>` itself contains block children (`<ul>`, `<codeblock>`, etc.), map it to `dita_p_block` so it serializes back to `<p>` losslessly.
- **Preserve unknown/specialized elements**: Unmodeled DITA 1.3 or custom elements must map to `unknown_block`, `unknown_pre_block`, `unknown_inline`, or `unknown_inline_block` with exact `tagName`, `namespaceURI`, and `rawAttrs`.
- **Preserve whitespace verbatim** inside `codeblock`, `pre`, `lines`, `screen`, `msgblock`, and any element with `xml:space="preserve"`.

### 4.3 Source ↔ Visual Transition Safety
- Always run `checkXmlWellFormed()` before converting Source XML into ProseMirror `Doc`. If XML is malformed, **block switching to Visual mode** and report `{ line, column, offset, message }` in the source editor.

### 4.4 OASIS CALS Table Fidelity
- Keep `<colspec>` as explicit `cals_colspec` child nodes inside `cals_tgroup` so interleaved comments/PIs and exact attribute order survive round-trip.
- Compute `colspan`/`rowspan` from `namest`/`nameend`/`morerows` via `packages/dita-core/src/cals/cals-table.ts` while retaining original CALS attributes in `rawAttrs`.
- Use `hasMultipleTgroups()` to detect multi-`tgroup` tables and avoid destructive visual edits on them.

### 4.5 Isomorphic `@dita/core` & Runtime Gotchas
- **No Node-only imports in `packages/dita-core/src/`**: `@dita/core` runs in both `apps/web` (browser) and `apps/api` (Node). Do not import `node:fs`, `node:path`, `node:child_process`, etc. in `src/` (test files under `test/` may use Node built-ins).
- **Vite browser stub for `slimdom-sax-parser`**: `apps/web/vite.config.ts` includes `browserStreamStubPlugin()` to stub `slimdom-sax-parser`'s unused `stream` import. Keep this intact when modifying Vite config.
- **Avoid `instanceof slimdom.*` checks**: `slimdom-sax-parser@1.5.3` bundles `slimdom@3` internally while `@dita/core` constructs serialized output documents with `slimdom@4`. Always inspect `node.nodeType` constants (`1` Element, `3` Text, `4` CDATA, `7` PI, `8` Comment, `9` Document, `10` DocumentType) instead of `instanceof`.

### 4.6 Static Site (`@dita/site`)
- **Keep deployables isolated**: `@dita/site` must stay out of `Dockerfile` and only depend on `@dita/core` (never import from `apps/web/src` or `apps/api/src`).
- **Sub-path & light first paint**: Route internal links/assets through the i18n path helpers (`SITE.base`-aware), and only import `@dita/core`/ProseMirror/CodeMirror inside hydrated islands (`client:visible` / `client:only`).
- **Truthful sandbox**: `/playground` must run real `@dita/core` round-trips, never mocked diagnostics/CALS/DITAVAL.

### 4.7 AI Assistance (`Phase 6`)
- **Never mutate XML directly**: All AI replies must pass `normalizeCandidateXml` → `spliceAndVerifyAiXml`, preserving `<?xml?>`, `<!DOCTYPE>`, comments, PIs, and (in `full-document` mode) the root element.
- **Server-only LLM & keys**: Keep `@langchain/*` in `@dita/api` only (web uses `fetch` + SSE for `/api/ai/stream`) and never expose raw API keys to the client.
- **Diff, lock & single-step undo**: Apply proposals only via `AiDiffDialog` + `resolveAiApplyMode` as a single ProseMirror transaction / CodeMirror replacement.

### 4.8 DITA 1.3 Ordered Content Models (`Phase 9`)
- **Centralize sequence rules**: Put ordering/cardinality rules in `packages/dita-core/src/model/dita-structure.ts` (`DITA_SEQUENCE_MODEL`), not in `isChildAllowed()` or `apps/web/src/editor/visual/commands.ts`, and only model genuinely ordered containers.
- **Guide, never block**: Never use `filterTransaction` or throw on structure violations; unknown/specialized elements stay lossless, and `conref`/`conkeyref` elements skip `missing-required-child`.
- **Single message source**: Format structure diagnostics via `@dita/core`'s `formatStructureIssue()`.

### 4.9 HTML5 Publish Themes (`Phase 12`)
- **Static assets, not a DITA-OT plugin**: every theme lives in `dita-ot-plugins/html5-themes/` (`shared/theme-base.css` + `shared/theme-runtime.js` + one `theme.css` per theme) and is copied at publish time; never require `dita install` or Java/XSLT customization.
- **Relative paths only**: `theme-enhancer.ts` must compute `relRoot` per output depth (`./`, `../`, …) and never emit root-absolute `/` URLs, so ZIPs opened over `file://` and `/preview/*` both work.
- **`vanilla` is untouched**: skip enhancement entirely for the vanilla theme so existing customer post-processing keeps working.
- **Config never touches documents**: theme choice/branding persist in SQLite `manual_publish_profiles` plus a snapshot in `publish_jobs.options_json`; no XML, map or Git changes.
- **Escape and validate**: brand text is HTML-escaped, accents must match `#RRGGBB`, logo/CSS paths go through `resolveSafeWorkspacePath()` with extension/size allowlists.
- **Offline search must stay script-based** (`_ditaeditor/search-index.js` → `window.__DITA_SEARCH_INDEX__`) because `fetch()` fails under `file://`.

### 4.10 Versioning: Clean Baseline + Personal Draft Overlay (`Phase 13`)
- **Keep shared branch `workDir` clean at `HEAD`**: Uncommitted edits, creates, deletes, renames, and draft binary assets live in the per-user Draft Overlay (`working_drafts` in SQLite + out-of-repo draft asset storage) guarded by `file_locks`; only atomic check-in / merge / revert advances `workDir` and Git `HEAD`.
- **Strict read/write boundaries**: Read-only `GET` requests must never implicitly create Git branches or worktrees (`ensureWorktree(..., { createIfMissing: false })`) and must never mutate process-global default branch state.
- **Explicit target views for core operations**: Check-in commits the caller's selected drafts against `HEAD`; cross-file diagnostics, strict DITA-OT validation (default `my_drafts` temp materialization), and AI context read `User Overlay` (`Baseline` + caller's own drafts via isomorphic `DitaSemanticIndex.cloneWithOverlay()`); formal Publish defaults to clean `Baseline` (`HEAD` / `Tag` / `Commit` via `git archive`) and resolves HTML5 theme logo/CSS from the build `snapshotDir`, while optional `my_drafts` preview includes only the requester's own drafts.
- **Cross-module consistency**: Workspace asset URLs (`GET /api/assets`) carry `userId` alongside `manualId` and `branch` so draft images render only for their owner; `topic_assignments.topic_path` syncs on Check-in (not during draft rename); merge conflict resolution must never leave a shared `workDir` in `MERGING` state.

### 4.11 Document Ingest & Tool-Using DITA-OT Repair Agent (`Phase 14`)
- **Dual-parser isolation & lean base image**: Keep `Dockerfile` free of Python dependencies by default (`ARG INSTALL_MARKITDOWN=false`); Docling runs as an optional `docling-serve` sidecar (`docker-compose.yml`) or local CLI, and `.md`/`.txt` always pass through directly.
- **Staging sandbox & deterministic final gate**: The Layer 2 tool-using repair agent (`apps/api/src/modules/ingest/agent/dita-ot-repair-agent.ts`) must only read/write generated files inside the temporary `stagingDir` (never touch shared `workDir` or unrelated baseline files), enforce bounded step/DITA-OT-call budgets plus a no-progress circuit breaker, fall back to a per-topic retry loop when `model.bindTools` is unavailable, and ALWAYS pass an outer deterministic `validateStrict(..., { processingMode: 'strict' })` gate before declaring Layer 2 passed.
- **Idempotent XML hygiene & Phase 13 obedience**: `postProcessGeneratedTopicXml()` must stay idempotent and use `node.nodeType` checks (never `instanceof slimdom.*`) when normalizing `id`, `xml:lang`, relative asset hrefs, and external `<xref>`/`<link>` `scope="external"` / `format` attributes; existing-manual imports must materialize exclusively into the caller's Phase 13 `working_drafts` + `file_locks` without touching shared `workDir` or stealing another user's map lock.

### 4.12 PDF Font Embedding (FOP 2.9 + Noto CJK)
- **Never register a `ttc`/`otc` collection in `fop.xconf`**: Adobe FOP 2.9's `OFFontLoader.read()` selects `OTFFile` only for a literal `OTTO` header, so every collection (header `ttcf`) goes through `TTFFile` and fails with `'loca' table not found` on CFF outlines. Debian's `fonts-noto-cjk` ships only such collections. `@dita/api` must keep generating the job-local config: `discoverNotoCjkFontFiles()` → `planNotoFopFonts()` → `materializeNotoFopFonts()` (extract each face to a standalone `.otf` under `<job>/fonts`, cached by source path + size + mtime and hard-linked) → `applyFontBase()` + `applyFopFontEntries()` in `apps/api/src/modules/publish/publish-service.ts`.
- **`sub-font` equals the face full name (name table ID 4) exactly** — and that name carries the weight (`NotoSansCJK-Bold.ttc` reports `Noto Sans CJK SC Bold`). Never hard-code family names; derive them from the font's `name` table (`apps/api/src/modules/dita-ot/font-collections.ts`).
- **Keep the three places in sync**: the logical families/char-sets in `dita-ot-plugins/com.ditaeditor.pdf-cjk/cfg/fo/font-mappings.xml`, `BASE_FAMILIES` / `REGIONS` in `apps/api/src/modules/dita-ot/fop-font-config.ts`, and the fallback table in `dita-ot-plugins/com.ditaeditor.pdf-cjk/fop.xconf` (bundled fallback = single-face Google OTFs).
- **Fail informatively**: `withFontHint()` prefixes `publish.fontError` when the build log matches a FOP font failure, so users see the fix (install `fonts-noto-cjk`, set `DITAEDITOR_NOTO_CJK_DIR`, or publish HTML5) instead of a bare `[PDFX013F]` line.
- **Comment-aware rewrites, validated output**: `applyFontBase()` / `applyFopFontEntries()` locate elements outside XML comment spans (a `<fonts>` mention in a comment previously swallowed the `-->` and FOP reported `ConfigurationException: xml parse error`), and `prepareFopConfig()` refuses to write a config that fails `checkXmlWellFormed()`. Keep long explanations in `dita-ot-plugins/com.ditaeditor.pdf-cjk/README.md` rather than in `fop.xconf` comments.

## 5. TypeScript & Code Style

- Strict ESM across all packages (`"type": "module"`). Use explicit `.js` extensions on relative TypeScript imports in `packages/dita-core/src/` and `apps/api/src/`.
- Follow `tsconfig.base.json` (`strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`). Do not disable strict checks or use `any` unless bridging untyped third-party internals with a narrow local interface.
- Keep modules focused and cohesive: XML parsing/serialization in `xml/`, element taxonomy in `model/`, CALS grid logic in `cals/`, ProseMirror schema/bridge in `prosemirror/`.

## 6. Knowledge Graph Workflow (`graphify`)

This repository maintains a persistent knowledge graph at `graphify-out/`:

- For codebase or architecture questions when `graphify-out/graph.json` exists, query the graph first via `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` before broad raw greps.
- Read `graphify-out/GRAPH_REPORT.md` for high-level architecture orientation when targeted queries are insufficient.
- After modifying code files in a session, run `graphify update .` (AST-only, zero API cost) to keep `graphify-out/` current.
