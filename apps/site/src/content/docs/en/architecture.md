---
title: Architecture reference
description: Package boundaries, the isomorphic kernel, the lossless pipeline, lock and worktree concurrency, the paired translation pipeline, the DITA-OT chain, and the deployment view.
updated: '2026-11-28'
---

DITAEditor has one architectural goal: let standard DITA XML flow **losslessly** between the browser, the server, and publishing tools. Every module boundary serves that goal.

## System view

```text
Browser
  @dita/web (React 19)
    ProseMirror visual editor ─┐
    CodeMirror 6 source        ├─ @dita/core (isomorphic)
    Map tree / Keys / Publish  │
    Translation / Bilingual review ┘
              │ fetch /api · SSE
              ▼
Node
  @dita/api (Fastify)
    identity · locks · files · indexer · validate · publish · ai
    translation · glossary · static
    SQLite (Drizzle) · simple-git worktree · DITA-OT CLI
              │
              ▼
  DITA-OT 4.2.1 (JRE 21) + Noto CJK plugin
```

The frontend and backend depend on the same `@dita/core` package, so "what is well-formed", "how keys resolve", and "how CALS expands" have exactly one implementation.

## Package boundaries

### `@dita/core`

- `xml/`: `slimdom-sax-parser` position tracking, deterministic serialization, fontoxpath, DOM diff.
- `model/`: the DITA 1.3 element registry (block / inline / structural / whitespace-preserve).
- `cals/`: CALS ↔ `colspan`/`rowspan` occupancy grid conversion.
- `ai/`: target location, candidate normalization, lossless splice and verification.
- `translation/`: segment extraction, `S0 × S1 × T0` incremental alignment, glossary matching and QA (pure functions, browser-safe).
- `prosemirror/`: the native schema and slimdom ↔ PM Doc conversion.

Constraints: `src/` must not import Node built-ins, because it also runs in the browser. Do not use `instanceof slimdom.*` to detect nodes; multiple versions may coexist, so check `nodeType` constants.

### `@dita/web`

The manual workbench and assignment rail, topic editor, NodeViews, DITA-aware commands, DITA map tree, Keys panel, publish panel, AI panel, and diffs — plus the translation center (files / queue / manual glossary / settings), bilingual review and language lineage, all covered by `zh-CN` / `en` dictionaries. Every write operation ultimately produces the same XML string.

### `@dita/api`

- `identity`: local users and roles in SQLite.
- `manuals` / `assignments`: manual metadata and the pending / in-progress / done assignment state machine.
- `locks`: exclusive check-out locks and admin force-unlock.
- `files`: workspace CRUD and multipart assets.
- `indexer`: incremental semantic index (keyspace, conref).
- `validate` / `publish` / `dita-ot`: strict validation, async publish queue, CLI invocation.
- `ai`: LangChain `ChatOpenAI` factory, SSE, settings, and usage.
- `translation`: pairing and file watermarks, incremental scan, AI translation / independent review, strict QA, glossaries, proposal application and check-in. Jobs and queue live in SQLite and run on an in-process worker with SSE.
- `static`: serves the built web app in production.

### `@dita/site`

This website and `/playground`. The sandbox uses `@dita/core` directly in the browser with no backend, which also makes it a living test of isomorphism.

## The lossless pipeline

```text
parseXml(xml)
  → slimdom Document (declaration/DOCTYPE/comments/PIs/CDATA/attribute order preserved)
  → pmDocFromXml(document)
  → ProseMirror Doc
  → xmlFromPmDoc(doc)
  → serializeXml(document)
```

Guarantees:

1. Metadata is never dropped.
2. Attributes are written back in `rawAttrs` order.
3. Serialization is idempotent.
4. A single-point edit yields a single-line diff.
5. Unmodeled elements become `unknown_*` nodes and still serialize back.

## Editor data flow

```text
CodeMirror change ─┐
                   ├─ well-formed guard ─→ PM Doc ─→ transactions ─→ XML
ProseMirror tx   ──┘
```

- Source → visual: run `checkXmlWellFormed()` first; on failure, block and report the position.
- Visual → source: serialize, compare with the source, and replace with a minimal change when needed.
- AI apply: `applyAiPatchedXml` receives verified full XML and performs exactly one replacement per mode.

## Concurrency model

- Lock key: `(project, branch, file_path)`.
- Clean baseline: one `git worktree` per branch whose `workDir` always equals Git `HEAD`, avoiding checkout churn.
- Personal draft overlay: uncommitted edits, creates, deletes, renames and draft images live in SQLite `working_drafts`, visible only to the lock holder; diagnostics, strict validation, AI context and `my_drafts` previews read baseline plus your own drafts.
- Expiry: `DITA_LOCK_TTL_HOURS`, with renewals and expiry judged by `updatedAt`; expired locks can be reacquired.
- Force-unlock: back up the draft and the file as patches, then delete the lock record.
- Merges complete in an isolated synthetic commit: `git merge-tree` preflight, per-file conflict resolution, and a shared `workDir` that never lingers in a `MERGING` state.
- No CRDT. Conflicts are resolved at the lock layer, not by merging characters.

## Paired translation pipeline

```text
source branch S1 ─┐
source branch S0 ─┼─ three-way segment match ─→ plan (unchanged / modified / protected / deleted)
target T0 ────────┘                                    │
                                                       ├─ reuse T0, no model call
                                                       ├─ AI-translate changed segments
                                                       └─ deterministic QA + optional AI review + DITA-OT
                                                                  │
                                                                  ▼
                                                  target working_drafts (owner only)
                                                                  │ check-in
                                                                  ▼
                                                  target branch HEAD → independent publish
```

- Pairs live in `translation_links`, file watermarks in `translation_file_states`, and the queue in `translation_jobs` / `translation_items`.
- Translation context is always source branch `HEAD` plus target branch `HEAD`; other users' drafts are never read, and the target file lock is checked when applying.
- The model only returns candidate translations; the server enforces tag conservation, terminology, DNT, placeholders and well-formedness, and the review workbench adds human diffing and segment edits.
- Only check-in advances the target baseline; scanning, translating and reviewing never touch the shared `workDir`.

## Publishing chain

```text
POST /api/publish
  → queue (SQLite + concurrency limit)
  → dita --validate=yes --processing-mode=strict
  → dita -f html5 | pdf --customization.dir=<Noto CJK plugin>
  → artifact directory + SSE log + cancellation
```

The PDF plugin is pure-XML font mappings with no custom Java; fonts come from Noto CJK inside the container.

## Storage

| Data | Location |
| --- | --- |
| Workspace files | `DITA_WORKSPACE_DIR` |
| Identity / locks / AI settings / usage | SQLite (inside the data volume) |
| Manuals / assignments | SQLite; manuals point at directories in the workspace |
| Translation pairs / file watermarks / queue / glossaries | SQLite |
| Publish artifacts | `DITA_PUBLISH_DIR` |
| Git repository and worktrees | Local repository under the project directory |

## Testing strategy

- `@dita/core`: golden fixture round-trips, unknown-element passthrough, CALS grids, parsing, XPath, segment increments and QA.
- `@dita/api`: routes, locks, publish queue, AI SSE socket behavior, translation scan / queue / glossaries / review application.
- `@dita/web`: editor commands, semantic panels, diff application paths, translation center and bilingual review state machine.
- `@dita/site`: i18n key structure, routing helpers, sandbox preset round-trips.

## Further reading

- [Feature tour](/en/docs/features)
- [Local development](/en/docs/local-development)
- In the repository: `docs/architecture-and-plan.md` and `docs/adr/`
