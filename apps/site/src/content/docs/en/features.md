---
title: Feature tour
description: Manual workbench and task assignment, dual-mode editing, document outline and reordering, lossless round-trip, CALS tables, keyspaces and conref, DITAVAL projection, map trees, check-out locks, DITA-OT publishing, and AI review.
updated: '2026-11-26'
---

DITAEditor's features follow one chain: **distribute → edit → semantics → organization → collaboration → publish → AI assistance**. Every link operates on the same standard DITA XML, and both the UI and the docs ship in Chinese and English.

## Manual workbench and topic assignment

The workbench opens on the **manual list**. Each card shows the manual's topic and map counts, active branch, mounted directory and how many tasks are waiting for you, with actions to attach a local folder, create a manual, archive or restore it.

The **My assignments** rail has two views: work assigned to me, and work I delegated.

- A task binds `(manual, branch, topic, assignee, due date, note)` and moves between pending, in progress and done.
- Overdue tasks turn red and disappear from the queue as soon as they are completed.
- Assigning, reassigning and completing touch SQLite only — no DITA XML is rewritten and no extra Git commit is created.

Manuals and tasks make "who writes which topic, and by when" visible while the documents stay standard XML in your repository.

## Dual-mode editing

- **Visual mode**: a native ProseMirror schema. DITA elements are nodes, not marks, so empty elements, nesting order, and per-element attributes survive.
- **Source mode**: CodeMirror 6 with XML syntax, well-formedness diagnostics, and `@dita/core`-driven completion.
- **Switch guard**: `checkXmlWellFormed()` runs before entering visual mode. On failure the switch is blocked with line, column, offset, and message.
- **Structure guidance**: `DITA_SEQUENCE_MODEL` centralises child ordering and cardinality for genuinely ordered containers; the editor hints instead of blocking, and `conref` / `conkeyref` elements skip required-child checks.

Mixed content is never wrapped in synthetic `<p>` tags: bare text inside `<li>`, `<dd>`, or `<entry>` maps to `xml_text_block` and unwraps on serialization.

## Document outline and structural reordering

A collapsible outline (`DocumentOutlinePanel`) sits beside the editor with two densities — structure skeleton and all blocks — plus instant filtering by text, tag or ID.

- **Bidirectional locating**: clicking an outline entry jumps to the matching block in the visual, split or source view, and the entry highlights as the caret moves.
- **Drag to reorder**: every move is checked against `DITA_SEQUENCE_MODEL`; cross-container moves (a paragraph into another `section`, a list item into another list) are allowed only where the content model permits, and illegal targets explain why.
- **Keyboard and undo**: `Alt+↑/↓` matches dragging; a reorder lands as a single ProseMirror transaction and one undo reverts it.
- **Safety bounds**: read-only roles, files checked out by someone else, and multi-`tgroup` tables stay undraggable; a rejected drag always explains itself instead of blocking the document.
- **Shortcut and layout**: `Cmd/Ctrl+Shift+O` toggles the panel; its width is draggable and remembered (240px default, 180px minimum).

## Lossless round-trip and minimal diffs

The pipeline is `XML → slimdom → ProseMirror Doc → slimdom → XML`. The following must survive byte for byte:

- the XML declaration and `<!DOCTYPE>` (including PUBLIC/SYSTEM and internal subsets);
- comments, processing instructions (`<?xml-model?>`, review markers), and CDATA;
- namespaces plus `xml:*` and `ditaarch:*` attributes;
- attribute order (each node stores `rawAttrs: XmlAttributeEntry[]`).

Serialization is deterministic: `roundTrip(roundTrip(xml)) === roundTrip(xml)`. Editing one text node changes exactly one line.

## OASIS CALS tables

- `<colspec>` stays an explicit child of `cals_tgroup`, so comments and PIs are not moved.
- `namest` / `nameend` / `morerows` become `colspan` / `rowspan` and an occupancy grid, while the original attributes are retained.
- When multiple `tgroup` elements are detected, the UI avoids destructive visual edits and guides you back to source.

## Single sourcing

### Keyspace

Starting from the root map, `keydef` entries (including `keyscope`) are resolved with BFS into a `key → href/text/shortdesc` map. The **Keys** panel supports search, navigation, and inserting `keyref`.

### Conref

`conref` / `conkeyref` / `conrefend` expand read-only in the editor; the underlying XML is untouched. The resolver performs DFS cycle detection and specialization checks, reporting cycles explicitly. Authors can also create `processing-role="resource-only"` warehouse topics with auto-registered `<keydef>` entries, assign semantic IDs in place, extract existing blocks to a warehouse from the block handle or attribute inspector, and jump straight to reuse insertion from the `/` slash menu, `+` block inserters, or the toolbar.

### DITAVAL projection

A `.ditaval` file is parsed into rules and evaluated against profiling attributes, producing `include` / `exclude` / `flag`. The view can show everything, dim exclusions, or hide them; publishing always uses the original XML.

## DITA maps

- A `react-arborist` tree supports `topicref`, `mapref`, `topichead`, `topicgroup`, `keydef` and `<reltable>`.
- Paths use POSIX semantics for cross-platform consistency.
- The tree shares a multi-tab workbench with topic editing, so state is not lost.

## Collaboration and versioning

- **Clean baseline plus a personal draft overlay**: each branch `workDir` stays exactly at Git `HEAD`; uncommitted edits, creates, deletes, renames and draft images live in SQLite `working_drafts` and are visible only to the lock holder. Two authors editing the same map on one branch never pollute each other’s validation, AI context or publish snapshot.
- **Exclusive check-out locks** keyed by `(project, branch, file_path)`; expiry is controlled by `DITA_LOCK_TTL_HOURS` and renewals are judged by `updatedAt`.
- **Explicit target views**: diagnostics, strict DITA-OT validation (defaults to `my_drafts`) and AI context read the baseline plus your own drafts; formal publishing defaults to the clean baseline (`HEAD` / `Tag` / `Commit` snapshot), with an optional preview limited to your drafts.
- **Merges and rollbacks**: `git merge-tree` preflights, isolated merge commits, per-file conflict resolution in MergeView, tags, single-file restore (draft or commit mode) and commit revert, with protected branches refusing deletion.
- **Version audit**: `version_audit_logs` records check-out, handoff, cancel, force-unlock, check-in, branch and tag operations, merges, reverts and publishes — SQLite only, never XML or Git metadata.
- **Admin force-unlock** backs up the draft and current content as patches before releasing the lock.

## Publishing and strict validation

- Strict validation: `dita --validate=yes --processing-mode=strict`, returning DTD/RNG issues with positions.
- Outputs: HTML5 and PDF, the latter using the pure-XML Noto CJK font-mappings plugin.
- Async queue: SQLite plus an in-process concurrency limit, streamed SSE logs, cancellation, and artifact retention.
- Single container: Node 22 + JRE 21 + DITA-OT 4.2.1 + Noto CJK.

## AI assistance

AI only proposes fragments:

1. The client sends a target scope (the whole topic by default) plus context.
2. The server calls an OpenAI-compatible model and asks for XML.
3. The candidate goes through `normalizeCandidateXml`.
4. `spliceAndVerifyAiXml` performs a lossless splice and verification.
5. The client reviews a diff and chooses apply, check out then apply, or preview only.
6. Applying is a single ProseMirror transaction (or one CodeMirror replacement), so `Cmd/Ctrl+Z` undoes the entire AI edit.

## Bilingual UI

- The `zh-CN` and `en` dictionaries share one structure: `en` is typed against `zh`, so a missing key fails `pnpm -r typecheck`.
- The locale preference persists in local storage and applies instantly without a reload; dates, durations and relative times are formatted with `Intl`.
- The marketing site, docs and workbench follow the same convention, with fully mirrored `/` and `/en` content.
- Publishing is locale-aware too: PDF titles, font mappings and build logs follow the interface language.

## Try it now

[Open the online workbench](https://www.cemplatformcvs.cloud/dita) to browse the demo map tree, edit topics, test single sourcing, and validate or publish directly. For model configuration, read [AI setup and security boundaries](/en/docs/ai-setup).
