# AGENTS.md

Guidance for AI coding agents working in the **DITAEditor** repository.

## 1. Project Overview

**DITAEditor** is a team-oriented lightweight Web DITA 1.3 structured authoring workbench.

- **Architecture & Roadmap Baseline**: See `docs/architecture-and-plan.md` for full design decisions, system architecture, and phased vertical slices (Phase 0–5).
- **Core Product Decisions**:
  - Dual-mode editing: Visual structured WYSIWYG (**ProseMirror**) + XML source (**CodeMirror 6**).
  - **Standard DITA XML is the single source of truth** (100% lossless round-trip, deterministic formatting, minimal Git Diff).
  - Core DITA 1.3 elements are finely modeled; unknown/specialized elements pass through losslessly via `unknown_block` / `unknown_inline`.
  - Concurrency model: **Check-out exclusive file lock** per `(project, branch, file_path)` with branch-isolated `git worktree` (no CRDT real-time co-editing).
  - License: **MIT** ([LICENSE](LICENSE)); UI screenshots live in `docs/pic/` (Chinese UI) and `docs/pic/en/` (English UI, used by `README.en.md`); both are referenced from `README.md` / `README.en.md`.
  - Validation & Publishing: Frontend real-time constraints + TS semantic indexer + **DITA-OT 4.x CLI** invoked from `@dita/api` (built-in OASIS DITA 1.3 DTD/RNG validation & HTML5/PDF publishing with pure-XML Noto CJK font-mappings plugin; zero custom Java service code).

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
│       │   └── prosemirror/# Native ProseMirror Schema & lossless slimdom <-> PM Doc converter
│       └── test/
│           ├── fixtures/   # 10 complex DITA 1.3 golden round-trip fixtures
│           └── *.test.ts   # Vitest golden, passthrough, CALS, parser/XPath tests
├── apps/
│   ├── web/                # @dita/web — React 19 + TypeScript + Vite frontend workbench
│   ├── api/                # @dita/api — Fastify + Zod API, SQLite/Drizzle identities & locks, simple-git
│   │   └── src/modules/{git,identity,locks,files,indexer,validate,publish,dita-ot,static}/
│   └── site/               # @dita/site — Astro 5 + React 19 islands + Tailwind 4 marketing site,
│       │                   #   browser DITA sandbox (/playground) and bilingual docs (/docs, /en/docs)
│       ├── src/{pages,layouts,components,lib,data,i18n,styles}/
│       └── src/content/docs/{zh,en}/  # 6 mirrored docs each (Content Collections)
├── dita-ot-plugins/        # Pure-XML DITA-OT 4.x Noto CJK PDF font-mappings plugin
├── Dockerfile              # Single container: Node + JRE 21 + DITA-OT 4.2.1 + Noto CJK
├── docs/                   # Architecture baseline, ADRs, and contracts
└── graphify-out/           # Persistent codebase knowledge graph (graph.json, GRAPH_REPORT.md, graph.html)
```

## 3. Build, Typecheck & Test Commands

Package manager is **pnpm** (`packageManager: pnpm@11.5.2`). Note `pnpm-workspace.yaml` declares `allowBuilds: { esbuild: true }`.

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
```

Always run `pnpm -r build && pnpm -r typecheck && pnpm -r test` after code changes before finishing a task.

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

### 4.6 Golden Regression Tests
- Any change to `packages/dita-core/src/{xml,model,cals,prosemirror}` MUST keep all tests in `packages/dita-core/test/` green, including all 10 fixtures in `packages/dita-core/test/fixtures/`.
- When fixing any XML parsing, serialization, CALS, or ProseMirror mapping bug, add a focused regression test (and fixture if structural).

### 4.6.1 Static Site Invariants (`apps/site`, Phase 7)

- **`@dita/site` is a separate deployable**: it must never be added to the `Dockerfile` build stage (the workbench image
  stays lean) and may only depend on `@dita/core` — never import from `apps/web/src` or `apps/api/src`.
- **Bilingual parity is enforced by tests**: `apps/site/test/i18n.test.ts` and `routes.test.ts` require identical
  dictionary keys and identical doc slugs across `src/i18n/{zh,en}.ts` and `src/content/docs/{zh,en}/`. Add a doc or a
  dictionary key on both sides in the same commit.
- **Every internal link goes through an i18n path helper** (`homePath`, `localePath`, `docsPath`, `docsIndexPath`,
  `playgroundPath`, `switchLocalePath`, `assetUrl`) with `SITE.base`, so `SITE_BASE=/DITAEditor/` sub-path deploys keep
  working. Never hardcode `/docs/...` or `/images/...` in Astro/React components.
- **Keep the first paint light**: ProseMirror / CodeMirror / `@dita/core` may only be imported inside hydrated islands
  (`client:visible` / `client:only`), never from an Astro layout or the home page shell. `apps/site/astro.config.ts`
  keeps `browserStreamStubPlugin()` (slimdom's unused `node:stream`) and the `vendor-*` manual chunks intact.
- **Tailwind 4 is CSS-first**: design tokens live in `@theme` at the top of `src/styles/global.css`; component classes are
  hand-written there. Do not introduce a `tailwind.config.js` or utility-class soup in markup.
- **Sandbox must stay truthful**: `/playground` runs the real `@dita/core` round-trip; never replace diagnostics, CALS or
  DITAVAL behaviour with mock data. Presets live in `src/data/playground-presets.ts` and are covered by
  `apps/site/test/presets-roundtrip.test.ts`.

### 4.7 AI Assistance Boundaries (Phase 6)
- **AI never mutates XML directly**: every model reply flows through `normalizeCandidateXml` → `spliceAndVerifyAiXml`.
  The patched document (not the raw candidate) is the authority for `line-window` / `full-document` spells; only
  `element` mode requires a single-root candidate. Preserve `<?xml?>`, `<!DOCTYPE>`, comments and PIs unchanged.
- **No LangChain in `@dita/core` or `@dita/web`**: `@langchain/core` + `@langchain/openai` belong to `apps/api` only;
  the web app talks to `/api/ai/stream` over `fetch` + SSE (native `EventSource` cannot send the identity header).
- **API keys stay server-side**: `GET /api/ai/config` returns `maskedApiKey` only; DB value wins over env fallback;
  config writes and `GET /api/ai/usage` require the `admin` role.
- **Default target scope is the whole topic**: the AI panel sends `{ mode: 'full-document' }` unless the user picks
  `片段` or an entry point (bubble toolbar, diagnostics, strict validation) carries an explicit target; a fragment
  request without a resolvable target degrades to `full-document`. Full-document patches must keep the root element,
  XML declaration and DOCTYPE untouched (server returns `structure-invalid` on a root-tag change).
- **Diff confirmation and locks are mandatory**: proposals reach the buffer only through `AiDiffDialog` +
  `resolveAiApplyMode` (`apply` / `checkout-and-apply` / `preview-only`). Visual applies must stay a single
  ProseMirror transaction (pass `{ skipVisualReload: true }` to `applyAiPatchedXml`), source applies a single
  CodeMirror replacement, so `Cmd/Ctrl+Z` undoes the whole AI edit in one step.
- **SSE disconnect detection**: never abort on `req.raw` `'close'` (fires after body consumption); use `'aborted'`
  plus response `'close'` guarded by `writableEnded`. `apps/api/test/phase6-ai-sse-socket.test.ts` guards this.

### 4.8 DITA 1.3 Ordered Content Models (Phase 9)
- **`isChildAllowed()` answers membership only.** Sequence (`(title), (shortdesc)?, (body)?`) and cardinality
  (`(dt)+, (dd)+`) live in `packages/dita-core/src/model/dita-structure.ts` (`DITA_SEQUENCE_MODEL`,
  `validateChildSequence`, `getInsertionSlot`, `getInsertableTagsBySequence`, `isSequenceTag`). Do not add new
  ordering special cases inside `apps/web/src/editor/visual/commands.ts` — extend the model instead.
- **Only ordered containers are modelled.** `body` / `conbody` / `refbody` / `section` prose / `li` / `entry` are
  unordered `choice` lists; adding a sequence model for them would fabricate false errors.
- **Guide, never block.** No `filterTransaction`, no throwing from insert commands for structure reasons: unknown /
  specialized elements must stay lossless and skeletons are legitimately invalid mid-authoring. Violations surface as
  inline decorations (`apps/web/src/editor/visual/structure-decorations.ts`), CodeMirror lint diagnostics
  (`apps/web/src/editor/source/xml-linter.ts`) and ProblemsPanel entries (`source: 'structure'`).
- **One message source.** Localized texts live in `@dita/core` i18n (`structure.outOfOrder`,
  `structure.missingRequiredChild`, `structure.childCardinality`, `structure.slotExclusive`) and are formatted via
  `formatStructureIssue()` in `packages/dita-core/src/model/dita-structure.ts` (web wraps it with current locale in
  `apps/web/src/editor/structure-messages.ts`). Never hardcode these strings in components.
- **Reused content is exempt.** Elements carrying `conref` / `conkeyref` skip `missing-required-child`, because their
  local children come from another file.
- Regressions to keep green: `packages/dita-core/test/dita-structure.test.ts` (incl. a zero-false-positive sweep over
  all fixtures + demo project + templates) and `apps/web/test/structure-diagnostics.test.ts`.

## 5. TypeScript & Code Style

- Strict ESM across all packages (`"type": "module"`). Use explicit `.js` extensions on relative TypeScript imports in `packages/dita-core/src/` and `apps/api/src/`.
- Follow `tsconfig.base.json` (`strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`). Do not disable strict checks or use `any` unless bridging untyped third-party internals with a narrow local interface.
- Keep modules focused and cohesive: XML parsing/serialization in `xml/`, element taxonomy in `model/`, CALS grid logic in `cals/`, ProseMirror schema/bridge in `prosemirror/`.

## 6. Knowledge Graph Workflow (`graphify`)

This repository maintains a persistent knowledge graph at `graphify-out/`:

- For codebase or architecture questions when `graphify-out/graph.json` exists, query the graph first via `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` before broad raw greps.
- Read `graphify-out/GRAPH_REPORT.md` for high-level architecture orientation when targeted queries are insufficient.
- After modifying code files in a session, run `graphify update .` (AST-only, zero API cost) to keep `graphify-out/` current.

## 7. Implementation Roadmap Status

- [x] **Phase 0**: Monorepo foundation, `@dita/core` (`slimdom` + `slimdom-sax-parser` + `fontoxpath` + ProseMirror Schema + CALS adapter), and 10 golden round-trip fixtures (21/21 Vitest tests passing).
- [x] **Phase 1**: Dual-mode Topic Editor MVP (ProseMirror visual editing + NodeViews + DITA-aware commands/keymap + CALS & simpletable editing + context-aware `/` insert menu + attributes inspector + clickable breadcrumb bar + CodeMirror 6 XML source with `@dita/core`-driven completion/lint & guarded Source ↔ Visual switching; 49/49 Vitest tests passing across `@dita/core` & `@dita/web`).
- [x] **Phase 2**: Visual Map/Bookmap tree (`react-arborist`), lossless `@dita/core` Map/Bookmap DOM engine & POSIX path utilities, multi-tab workbench, Fastify local workspace/file CRUD/multipart asset APIs & diagnostics, curated demo project (`samples/demo-dita-project/`), and 85/85 Vitest tests passing across `@dita/core` (39), `@dita/api` (2), & `@dita/web` (44).
- [x] **Phase 3**: Root Map semantic engine (`keydef/keyref` BFS + `keyscope`, `conref/conkeyref`/`conrefend` with DFS cycle detection & specialization checks, `.ditaval` parser/evaluator & live filtering/flagging across Map Tree + Visual Editor without mutating XML, incremental Fastify `/api/semantics/*` indexer, `Keys` panel, Insert Keyref/Conref dialogs, profiling attribute editor, CodeMirror 6 semantic autocomplete; 107/107 Vitest tests passing across `@dita/core` (54), `@dita/api` (4), & `@dita/web` (49)).
- [x] **Phase 4**: SQLite + Drizzle ORM (`better-sqlite3`) identity/role switcher (Admin/Writer/Viewer), local Git workspace (`simple-git` + branch-isolated `git worktree`, no external GitHub/GitLab/Gitee dependency), Check-out exclusive locks with admin force-unlock patch backups, commit history & CodeMirror 6 MergeView visual version Diff (126/126 Vitest tests passing across `@dita/core` 54, `@dita/api` 7, `@dita/web` 65).
- [x] **Phase 5**: DITA-OT 4.x CLI runner in `@dita/api` (built-in DITA 1.3 DTD/RNG strict validation with `--validate=yes --processing-mode=strict` + HTML5/PDF publishing, zero custom Java code), pure-XML Noto CJK PDF font-mappings plugin loaded via `--customization.dir`, zero-Redis SQLite + in-process concurrency-limited async publish queue with SSE log streaming and cancellation/retention, web publish/strict-validation UI, and single-container `Dockerfile` (Node 22 + JRE 21 + DITA-OT 4.2.1 + Noto CJK); 132/132 Vitest tests passing across `@dita/core` 54, `@dita/api` 13, `@dita/web` 65.
- [x] **Phase 6**: LangChain.js AI assistance — `@dita/core` lossless fragment locator/splice (`src/ai/`), LangChain `ChatOpenAI` factory + SSE `/api/ai/stream` with verification-retry loop, SQLite `ai_settings`/`ai_usage_logs` with admin-only config & usage, web AI panel/settings/diff with Check-out-aware apply, and real-endpoint acceptance via `apps/api/scripts/e2e-ai-live.mts` (201 Vitest tests total: core 81, api 28, web 92).
- [x] **Phase 7**: Standalone `@dita/site` static site (Astro 5 + React 19 islands + Tailwind 4 CSS-first tokens, zh `/` + en `/en/`), bilingual home (workbench showcase, CCMS/Markdown comparison, live `client:visible` mini round-trip sandbox), six mirrored docs with Pagefind search (`Cmd/Ctrl+K`) and in-page TOC, backend-free `/playground` running the real `@dita/core` (4 presets, visual/split/source, DITAVAL tri-state projection, line diff), SEO (sitemap + hreflang + per-locale OG images, 404, robots), GitHub Pages workflow, and `Dockerfile` kept site-free (231 Vitest tests: core 81, api 28, web 92, site 30).
- [x] **Phase 8**: Fully bilingual zh-CN/en stack — `@dita/core` i18n kernel (`UiLocale`/`normalizeLocale`/`formatMessage`/`coreT`) with bilingual element vocabulary (110+ elements/attributes), English topic/map templates and localized semantic/AI diagnostics; `@dita/web` strongly typed catalogue (1028 mirrored keys, `MessageKey` derived from `zh-CN.ts`) with a lossless hot switch (ProseMirror decoration locale meta transaction, `:root[lang="en"]` CSS labels, no view recreation); `@dita/api` request-locale resolution (`x-dita-locale` → `Accept-Language` → `zh-CN`) with localized `HttpError`s, publish logs, DITA-OT failures and AI prompts; guarded by i18n parity, hardcoded-CJK scan and API locale tests (246 Vitest tests: core 81, api 36, web 99, site 30).
- [x] **Phase 9**: DITA 1.3 ordered content-model enforcement — `@dita/core` `model/dita-structure.ts` (`DITA_SEQUENCE_MODEL` with `required`/`optional`/`zeroOrMore`/`oneOrMore` slots, single-occurrence exclusive choices vs repeating mixed choices, `validateChildSequence`, range-aware `getInsertionSlot`, `getInsertableTagsBySequence`, `formatStructureIssue`), `xml/structure-check.ts` (localized line/column issues, `checkXmlStructure`) and `prosemirror/structure.ts` (`validatePmStructure`); `@dita/web` auto-slots out-of-order inserts while preserving in-place insertion inside repeating lists/steps, prunes filled/exclusive slots from the `/` menu, between-block `+` inserters and CodeMirror XML completion, paints invalid children with hover explanations, lints the source editor in a single parse (re-running on locale switch) and merges everything into ProblemsPanel (`source: 'structure'`) in both locales — never blocking transactions so unknown/specialized elements stay lossless (280 Vitest tests: core 103, api 36, web 111, site 30).
