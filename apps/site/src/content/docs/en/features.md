---
title: Feature tour
description: Dual-mode editing, lossless round-trip, CALS tables, keyspaces and conref, DITAVAL projection, map trees, check-out locks, DITA-OT publishing, and AI review.
updated: '2026-11-24'
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

`conref` / `conkeyref` / `conrefend` expand read-only in the editor; the underlying XML is untouched. The resolver performs DFS cycle detection and specialization checks, reporting cycles explicitly.

### DITAVAL projection

A `.ditaval` file is parsed into rules and evaluated against profiling attributes, producing `include` / `exclude` / `flag`. The view can show everything, dim exclusions, or hide them; publishing always uses the original XML.

## Maps and bookmaps

- A `react-arborist` tree supports `topicref`, `mapref`, `chapter`, `appendix`, and more.
- Paths use POSIX semantics for cross-platform consistency.
- The tree shares a multi-tab workbench with topic editing, so state is not lost.

## Collaboration and versioning

- **Exclusive check-out locks** keyed by `(project, branch, file_path)`; expiry is controlled by `DITA_LOCK_TTL_HOURS`.
- **Admin force-unlock** backs up current content as a patch before releasing the lock.
- **Branch isolation**: one `git worktree` per branch, so switching branches never pollutes the working tree.
- **Version diff**: CodeMirror MergeView with line statistics.

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

[Open the offline workbench](../../../workbench/) to browse the demo map tree, edit topics, and test single sourcing. For model configuration, read [AI setup and security boundaries](/en/docs/ai-setup).
