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
  - Validation & Publishing: Frontend real-time constraints + persistent **Java 21 Worker** (Xerces2 + Jing + DITA 1.3 XML Catalog + DITA-OT 4.x with Noto CJK fonts).

## 2. Repository Layout

```text
DITAEditor/
├── packages/
│   └── dita-core/          # @dita/core — shared isomorphic DITA XML & ProseMirror kernel
│       ├── src/
│       │   ├── xml/        # slimdom-sax-parser + position tracking, deterministic serializer, fontoxpath, DOM diff
│       │   ├── model/      # DITA 1.3 element registry (block/inline/structural/whitespace-preserve)
│       │   ├── cals/       # OASIS CALS table <-> colspan/rowspan & occupancy grid adapter
│       │   └── prosemirror/# Native ProseMirror Schema & lossless slimdom <-> PM Doc converter
│       └── test/
│           ├── fixtures/   # 10 complex DITA 1.3 golden round-trip fixtures
│           └── *.test.ts   # Vitest golden, passthrough, CALS, parser/XPath tests
├── apps/
│   ├── web/                # @dita/web — React 19 + TypeScript + Vite frontend workbench
│   └── api/                # @dita/api — Fastify + TypeScript + Zod backend API
├── services/               # (Phase 5) dita-worker — Java 21 + Javalin + Xerces2/Jing + DITA-OT 4.x
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
- [ ] **Phase 4**: PostgreSQL + Drizzle ORM, GitHub/GitLab/Gitee OAuth/PAT, branch-isolated `git worktree`, Check-out exclusive locks & PR/MR workflow.
- [ ] **Phase 5**: Persistent Java 21 Worker (Xerces2 + Jing + DITA 1.3 Catalog + DITA-OT 4.x + Noto CJK), BullMQ + SSE async publishing, Docker Compose deployment.
