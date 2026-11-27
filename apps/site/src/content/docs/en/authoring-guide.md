---
title: Authoring guide
description: "The end-to-end authoring path, from check-out to publish: edit modes, structure guidance, reuse and filtering, validation, check-in, and HTML5/PDF publishing."
updated: '2026-11-28'
---

This page is the **author's** manual: the buttons you press in a normal day, the hints you will meet, and the rules behind each step. For deployment, AI keys and environment variables see [Getting started](/en/docs/getting-started) and [AI setup](/en/docs/ai-setup); for per-element content models and attributes see the [DITA 1.3 quick reference](/en/docs/dita-spec).

The same help center ships inside the workbench: click **Help** in the header, or press <kbd>?</kbd> outside an editor, to search workflows, the DITA reference and shortcuts without leaving the topic.

## The whole path

```text
open a manual → check out → edit (visual / split / source) → diagnostics → check in → publish
```

The key guarantee: **until you check in, every change lives in your personal draft overlay**. The shared branch worktree stays at `HEAD`, teammates never see half-finished work, and DITA-OT validation never sees someone else's drafts.

## Check-out and read-only topics

Topics you have not checked out open read-only, with a "file not checked out" hint. Checking out takes an exclusive lock on `(project, branch, file)`:

- Only one author can edit a file at a time; everyone else sees a read-only view on that branch.
- Locks and drafts have separate lifetimes: an idle lock can be released and taken by someone else.
- Check-out **never mutates DITA content** and never advances the branch.

## Three editing modes

| Mode | Use it for | Guarantee |
| --- | --- | --- |
| Visual | everyday writing and restructuring | native ProseMirror schema; inline elements are nodes, not marks, so empty elements and nesting order survive |
| Split | proofreading, confirming source and rendering agree | both panes share one document; scroll and selection follow each other |
| XML source | precise attributes, comments, processing instructions | CodeMirror 6; switching back to visual runs a well-formedness gate first |

Before switching to visual, `checkXmlWellFormed()` runs. Invalid XML **blocks the switch** and reports line, column, offset and message instead of pushing a half-parsed document into the visual editor.

Lossless round-trip is a hard constraint: XML declaration, DOCTYPE, comments, processing instructions, CDATA, namespaces and attribute order all survive; editing one text node changes exactly one line in the serialized XML, which keeps the Git diff minimal.

## Structure guidance

Ordered content models live in `@dita/core`'s `DITA_SEQUENCE_MODEL`, and the editor uses them to tell you what may be inserted at the cursor:

- `<conbody>`: body blocks (`<p>` etc.) first, then `<section>` / `<example>`.
- `<taskbody>`: `prereq? → context? → steps|steps-unordered? → result? → tasktroubleshooting? → example? → postreq?`.
- Violations produce a `child-out-of-order` diagnostic, **never a blocked keystroke**; unknown and specialized elements pass through untouched.

## Elements and tables

- The insert menu (<kbd>⌘/Ctrl</kbd> + <kbd>/</kbd>) lists only the legal children for the current context, grouped as structure / block / inline.
- CALS tables derive `colspan` / `rowspan` from `namest` / `nameend` / `morerows`, and keep `<colspec>` as explicit nodes, so comments and attribute order inside a table are preserved.
- Tables with multiple `<tgroup>` elements reject visual drag-resizing; restructure them in source.

## Reuse: conref and conkeyref

- `conref` points straight at a reusable fragment; `conkeyref` goes through a key, so moving content only changes the key definition.
- Targets are checked before insertion and resolved content is shown as a read-only projection; edits must go back to the source fragment or the next resolution overwrites them.
- Be careful with conditional attributes on referenced targets: `conref` takes the referenced element itself, so audience filters can behave unexpectedly.

## Conditional filtering (DITAVAL)

Filter the projection by `audience` / `platform` / `product` / `props` to get "one source, many deliverables". Filtering only affects the rendering and the publish projection — it **never deletes conditional attributes from the XML**.

## Cross references, keys and maps

- `<xref>` targets a topic or element `id`; define a key first for cross-manual links, then use `keyref`, so links survive reorganisation.
- The map is edited directly in the left navigation; adding or removing a `topicref` is a structural change that ships in the same commit as the topic edits.

## Outline and navigation

The outline filters by text, tag or `id`, supports drag reordering and <kbd>Alt</kbd> + <kbd>↑/↓</kbd>; an illegal drop location explains itself but never stops you from editing.

## Validation in three layers

1. **Live constraints**: content-model checks on the open document, shown as decorations and in the problems panel, without blocking input.
2. **Cross-file diagnostics**: the semantic index checks keys, conrefs, xrefs and map references and points at the exact file and line.
3. **Strict validation**: check-in runs OASIS DTD validation through DITA-OT on a materialization of *your drafts*; only a pass is committed.

Red errors block check-in; warnings can be checked in and fixed afterwards.

## Check-in, merge and history

- **Check-in**: the dialog lists your changed files and squashes the selected drafts into one commit, syncing topic assignments (`topic_assignments.topic_path`) at the same time.
- **Merge**: when someone pushed the same file, a three-way merge opens and you pick a side hunk by hunk; the shared worktree must never be left in a `MERGING` state.
- **History**: inspect commit diffs, restore a version, or revert a commit. Reverts are new commits — history is never rewritten.
- **Discard draft**: throws away uncommitted changes, irreversibly.

## Publishing

- **HTML5**: static themes (`dev-dark`, `editorial-paper`, `enterprise-manual`, `tech-docs`, plus `vanilla` with no post-processing) enhanced by a deterministic Node pass that injects styles and an offline search index; output opens over `file://`.
- **PDF**: four themes (`compact-guide`, `editorial-book`, `enterprise-spec`, `tech-manual`) injected through `--customization.dir` and an XML catalog for page size, fonts, headers and footers; Simplified Chinese defaults to Noto CJK.
- **Scope**: formal publishing uses a clean baseline (`HEAD` / Tag / Commit); pick "my drafts" to preview uncommitted work, which includes only your own drafts.
- **Troubleshooting**: read the end of the job log first. Font failures carry a hint (install `fonts-noto-cjk`, set `DITAEDITOR_NOTO_CJK_DIR`, or publish HTML5 instead).

## Collaboration and versioning model

Clean Git baseline plus a personal draft overlay: uncommitted edits, creates, deletes and image assets stay in your drafts; only check-in, merge and revert advance the shared branch `HEAD`. Branches are isolated with one `git worktree` each, so switching branches never overwrites another.

Topic delegation writes SQLite only — it does not lock files or touch XML; the assignment moves to "in progress" once the assignee checks out.

## Shortcuts

| Action | macOS | Windows / Linux |
| --- | --- | --- |
| Save current draft | <kbd>⌘</kbd> + <kbd>S</kbd> | <kbd>Ctrl</kbd> + <kbd>S</kbd> |
| Toggle left navigation | <kbd>⌘</kbd> + <kbd>\\</kbd> | <kbd>Ctrl</kbd> + <kbd>\\</kbd> |
| Toggle document outline | <kbd>⌘</kbd> + <kbd>⇧</kbd> + <kbd>O</kbd> | <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>O</kbd> |
| Open the help center | <kbd>?</kbd> | <kbd>?</kbd> |
| Bold / italic / underline | <kbd>⌘</kbd> + <kbd>B</kbd> / <kbd>I</kbd> / <kbd>U</kbd> | <kbd>Ctrl</kbd> + <kbd>B</kbd> / <kbd>I</kbd> / <kbd>U</kbd> |
| Toggle codeph | <kbd>⌘</kbd> + <kbd>E</kbd> | <kbd>Ctrl</kbd> + <kbd>E</kbd> |
| Insert cross reference | <kbd>⌘</kbd> + <kbd>K</kbd> | <kbd>Ctrl</kbd> + <kbd>K</kbd> |
| Insert menu | <kbd>⌘</kbd> + <kbd>/</kbd> | <kbd>Ctrl</kbd> + <kbd>/</kbd> |
| Leave a code block | <kbd>⇧</kbd> + <kbd>Enter</kbd> | <kbd>Shift</kbd> + <kbd>Enter</kbd> |

Global shortcuts stay out of the way while focus is in a text field, the source editor or a table cell.

## Frequently asked

**Why is my topic read-only?** Someone holds the lock, or you have not checked it out. Check the lock marker in the file tree and ask the holder to release it.

**Why can't I switch to visual?** The source is not well-formed. Fix the reported line and column, or format the XML first.

**Why is check-in disabled?** There are red errors, or no draft file is selected.

**Where did a teammate's change go?** Branches are isolated: switching branches shows that branch's baseline. Use the history panel for diffs and commits.
