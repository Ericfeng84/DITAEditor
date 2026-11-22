---
title: What is DITAEditor
description: An open-source workbench that puts standard DITA 1.3 XML back in the browser — lossless round-trip, single sourcing, local Git locks, and DITA-OT publishing.
updated: '2026-11-22'
---

DITAEditor is a lightweight, team-oriented web workbench for DITA 1.3 structured authoring. It does not invent a new document format and does not hide XML in a database: **standard DITA XML is the single source of truth**, and the browser is simply its first-class editing surface.

Three claims you can verify in minutes:

1. Visual editing and XML source are mirrors; `XML → ProseMirror → XML` is byte-identical.
2. Editing one character produces a one-line Git diff.
3. Publishing calls the standard DITA-OT 4.x CLI for HTML5 and PDF — there is no custom Java service code.

## Who it is for

- **Documentation engineers** who need DITA structure, keyref/conref reuse, and DITAVAL publishing without running a desktop CCMS.
- **Engineering teams** who want docs in the same repository, branch, and review flow as code.
- **Platform and ops teams** who want one container, one data volume, and no Redis, PostgreSQL, or message queue.
- **Early adopters of AI-assisted writing** who want model output treated as a proposal, never as an overwrite.

## Design principles

### Standard XML first

Every edit serializes back to DITA 1.3 XML. The XML declaration, DOCTYPE, comments, processing instructions, CDATA, namespaces, and attribute order survive unchanged. Unknown or specialized elements are not dropped; they pass through as `unknown_block` / `unknown_inline`.

### Structured, not heavy

Core DITA elements are modeled precisely: `task`, `concept`, `reference`, `topic`, `section`, `note`, `step`, CALS tables, and more. Inline elements are inline nodes rather than marks, so `<b><i>` nesting order, empty elements, and per-element attributes are never merged.

### Single sourcing

Root Map `keydef` entries are resolved into a keyspace with BFS. `conref` / `conkeyref` are expanded read-only in the editor, and `.ditaval` applies a three-state projection (include / exclude / flag) to the view without touching the XML underneath.

### Locks, not CRDT

Each `(project, branch, file_path)` permits exactly one exclusive check-out. Branches are isolated with `git worktree`, keeping real-time collaboration complexity out of structured XML.

## What is in the box

| Component | Responsibility |
| --- | --- |
| `@dita/core` | Isomorphic XML / CALS / keyspace / DITAVAL / ProseMirror kernel |
| `@dita/web` | React 19 workbench: visual editor, source, map tree, locks, publish, AI |
| `@dita/api` | Fastify + SQLite + simple-git: identity, locks, semantic index, DITA-OT |
| `dita-ot-plugins` | Pure-XML Noto CJK PDF font-mappings plugin |
| Single container | Node 22 + JRE 21 + DITA-OT 4.2.1 + Noto CJK |

## Explicit boundaries

- No real-time multi-user editing (no CRDT); concurrency is handled by exclusive locks.
- No built-in Git hosting integration; repositories are local and pushing is your CI's job.
- AI is not an autonomous author: it returns candidate XML that must pass server verification and human diff review.
- Unmodeled DITA elements round-trip losslessly but may not have a dedicated WYSIWYG control.

## Next steps

- Edit a real XML fragment in the browser: [open the playground](/en/playground).
- Deploy it: [Getting started with Docker](/en/docs/getting-started).
- Read the code: [Architecture reference](/en/docs/architecture).
