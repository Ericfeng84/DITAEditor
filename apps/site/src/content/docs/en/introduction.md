---
title: What is DITAEditor
description: An open-source workbench that puts standard DITA 1.3 XML back in the browser — manuals and topic assignment, lossless round-trip, single sourcing, local Git locks, paired translation and bilingual review, DITA-OT publishing, and a bilingual UI.
updated: '2026-11-28'
---

DITAEditor is a lightweight, team-oriented web workbench for DITA 1.3 structured authoring. It does not invent a new document format and does not hide XML in a database: **standard DITA XML is the single source of truth**, and the browser is simply its first-class editing surface.

Three claims you can verify in minutes:

1. Visual editing and XML source are mirrors; `XML → ProseMirror → XML` is byte-identical.
2. Editing one character produces a one-line Git diff.
3. Publishing calls the standard DITA-OT 4.x CLI for HTML5 and PDF — there is no custom Java service code.
4. Every target language is a real manual: translated topics open, edit, validate and publish, and unlinking never deletes them.

Since Phase 10 the entry point is a **manual workbench**: a manual is a documentation product mounted from a local directory, and topics can be assigned to teammates with an owner, due date and note. The rail splits "assigned to me" from "delegated by me". Assignments live in SQLite and never rewrite XML; documents still flow through standard Git. Phase 16 brings target languages into the same chain: pair source and target manuals file by file, translate only the Git diff, then review and check in segment by segment. The workbench, CLI output and docs all ship in Chinese and English.

## Who it is for

- **Documentation engineers** who need DITA structure, keyref/conref reuse, and DITAVAL publishing without running a desktop CCMS.
- **Engineering teams** who want docs in the same repository, branch, and review flow as code.
- **Documentation leads** who need to distribute topics, track due dates, and avoid adding another cloud collaboration system.
- **Localization teams** who want translations to be standard DITA, synced segment by segment with terminology and markup preserved, and published independently.
- **Platform and ops teams** who want one container, one data volume, and no Redis, PostgreSQL, or message queue.
- **Early adopters of AI-assisted writing** who want model output treated as a proposal, never as an overwrite.

## Design principles

### Standard XML first

Every edit serializes back to DITA 1.3 XML. The XML declaration, DOCTYPE, comments, processing instructions, CDATA, namespaces, and attribute order survive unchanged. Unknown or specialized elements are not dropped; they pass through as `unknown_block` / `unknown_inline`.

### Structured, not heavy

Core DITA elements are modeled precisely: `task`, `concept`, `reference`, `topic`, `section`, `note`, `step`, CALS tables, and more. Inline elements are inline nodes rather than marks, so `<b><i>` nesting order, empty elements, and per-element attributes are never merged.

### Single sourcing

Root Map `keydef` entries are resolved into a keyspace with BFS. `conref` / `conkeyref` are expanded read-only in the editor, and `.ditaval` applies a three-state projection (include / exclude / flag) to the view without touching the XML underneath.

### Bilingual by default

The `zh-CN` and `en` dictionaries share one structure, and `en` is typed against `zh`, so a missing key fails the build. Switching applies instantly and persists; dates, durations, diagnostics and publishing artifacts follow the locale, and the site ships mirrored `/` and `/en` versions.

### Translation is not a sidecar

Every target language is an independent manual: same directory shape, Git repository, branches, locks and publish theme. The translation center only pairs manuals, computes increments, produces proposals and hosts review; reviewed output enters the target draft overlay and advances the target baseline on check-in. Translation is therefore not another database to keep in sync, and DITA markup is never flattened to plain text.

### Locks, not CRDT

Each `(project, branch, file_path)` permits exactly one exclusive check-out. Branches are isolated with `git worktree`, keeping real-time collaboration complexity out of structured XML.

## What is in the box

| Component | Responsibility |
| --- | --- |
| `@dita/core` | Isomorphic XML / CALS / keyspace / DITAVAL / ProseMirror / translation increment and QA kernel |
| `@dita/web` | React 19 workbench: manuals and tasks, visual editor, source, map tree, locks, paired translation and bilingual review, publish, AI |
| `@dita/api` | Fastify + SQLite + simple-git: identity, locks, semantic index, translation queue and glossaries, DITA-OT |
| `dita-ot-plugins` | Pure-XML Noto CJK PDF font-mappings plugin |
| Single container | Node 22 + JRE 21 + DITA-OT 4.2.1 + Noto CJK |

## Explicit boundaries

- No real-time multi-user editing (no CRDT); concurrency is handled by exclusive locks.
- Not a full TMS: no quoting, vendor portal or translation-memory billing; reuse is a deterministic segment-level increment.
- No built-in Git hosting integration; repositories are local and pushing is your CI's job.
- AI is not an autonomous author: it returns candidate XML that must pass server verification and human diff review.
- Unmodeled DITA elements round-trip losslessly but may not have a dedicated WYSIWYG control.

## Next steps

- Try the full workbench directly in your browser: [open the online workbench](https://www.cemplatformcvs.cloud/dita).
- Deploy it: [Getting started with Docker](/en/docs/getting-started).
- Read the code: [Architecture reference](/en/docs/architecture).
