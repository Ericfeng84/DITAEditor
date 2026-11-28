---
title: Paired translation and bilingual review
description: 'A target language is a real manual: pair or bind it, translate by Git diff, review segment by segment with live terminology checks, and only advance the target baseline on check-in.'
updated: '2026-11-28'
---

DITAEditor does not hide translations in a proprietary translation store, and it does not copy a special "translation-only" flavour of your XML. **Every target language is a real manual**: its own directory, Git repository, branches, locks, draft overlay and publish theme. Translation only pairs a source manual with a target manual file by file, then runs incremental sync, AI translation, bilingual review and check-in on that pair.

The benefits are verifiable: a translation opens in the normal editor, validates, diffs and publishes like any other topic; unlinking a pair never deletes the translated manual; and one language stalling cannot lock the source or the other languages.

## Language families and pairing

- A manual declares a **source language** (`manuals.source_lang`, for example `zh-CN`). Manuals without one remain editable but cannot act as a translation source.
- "Add target language" can **create a target manual** (directory skeleton, root map and Git repository) or **bind an existing manual**.
- Pairs live in SQLite (`translation_links`, with source/target manual, branch, languages and options); per-file watermarks live in `translation_file_states`.
- A target can itself become the source of the next target, forming a **language lineage** of arbitrary depth (`zh-CN → en-US → ar-SA`). When an upstream edition is not fully synced, the translation center shows a non-blocking warning rather than forbidding work.
- Pairing only records a mapping: target files are written when the first review is checked in, not when the pair is created.

## Scan, then translate only what changed

"Scan for source changes" on the Files tab:

1. Aligns source and target files by relative path and detects additions, deletions and renames (`git diff -M`).
2. Runs `git diff` per topic and map, and skips **metadata-only** changes that touch attributes, comments or formatting.
3. Aligns the current source `S1`, previous source `S0` and existing target `T0` in a **three-way segment match**:
   - `unchanged`: reuse `T0` without calling a model;
   - `modified` / `added`: only these segments need translation;
   - `protected`: `codeblock`, `pre`, `lines`, `screen`, `msgblock`, `conref` and `translate="no"` are carried over verbatim;
   - `deleted`: listed so the reviewer can confirm the removal.
4. If `S0` and `T0` match below 50%, the plan degrades to `full_with_reference`: translate the whole file but give the model the old translation as a reference instead of silently misaligning segments.

Matching tries `element_id`, structural path, content hash and tag LCS in that order. `navtitle` and map-root `title` attributes are translatable segments too; `keydef` maps are flagged "needs human review" because key definitions often drive global wording.

Images and assets are not sent to the model: SVGs and bitmaps can reuse the source file directly. If an image contains interface text, replace it with a localized version in the target editor; later source-image updates will not overwrite your local version.

## The AI translation queue

Jobs and items live in SQLite (`translation_jobs`, `translation_items`) and run in an in-process worker — no Redis, RabbitMQ or external task system.

- Each pair has its own job list and SSE progress; refreshing the page does not lose a job.
- Every file is translated into a temporary directory, then goes through deterministic QA. Failed items can be retried and jobs can be cancelled.
- Per-pair settings: reuse unchanged segments, strict QA gate, independent AI review, strict DITA-OT validation, target locale style. They only affect the translation flow, never DITA documents.
- The queue reports reused vs. newly translated segments, QA errors and warnings, the AI review verdict and the DITA-OT result.

Model configuration is shared with the normal AI assistant; see [AI setup and safety boundaries](/en/docs/ai-setup). A model is optional: the target is an ordinary manual, so manual translation or an external tool followed by a draft import works too.

## Bilingual review

AI output never lands in the target baseline directly; it becomes a **review proposal** first. The review workbench offers:

- Four views: **side by side**, **stacked**, **focus reading** and **XML diff**, with filters for changed or QA-problem segments.
- Every segment is editable: rich text keeps inline DITA tags, XML mode allows exact tag and attribute edits, and attribute segments edit as plain text.
- **Inline tag conservation**: if the translation lacks source tags such as `<b>`, `<xref>` or `<codeph>`, the missing tags are listed and can be inserted in one click. Attributes such as `id`, `href`, `keyref`, `conref`, `conkeyref`, `scope` and `format` must match the source.
- **Live QA**: glossary hits, forbidden renderings, DNT terms, placeholders (`{0}`, `{{name}}`, `%s`, `${name}`) and well-formedness issues appear immediately. Each segment can also be refined by AI on its own.
- **Independent AI review**: a separate review model can re-check every segment, auto-repair failures and re-run; the report classifies accuracy, omission, terminology, markup, style and QA violations.
- **Strict DITA-OT validation**: after a batch, the whole set is validated in a temporary directory and repairable errors are fixed automatically, without touching the shared workspace.

"Apply to target draft" writes the translation into the target manual's `working_drafts`, still visible only to you. "Check in baseline" is the step that advances the target branch's Git `HEAD`. If another user holds the target file lock, applying is rejected and the lock owner is shown.

## Glossaries

Glossaries are **global** or **manual-scoped**, matched by source language and merged automatically for AI translation and live QA.

- Each term supports synonyms, case sensitivity, part of speech, a context note, status (approved/draft/deprecated), translations for several target languages and **forbidden renderings**.
- Terms marked **DNT** must stay verbatim; using a forbidden rendering raises a QA error.
- Import and export use CSV, JSON or TBX-Basic. Imports run a dry run first, reporting new, updated and invalid rows before anything is written.

## Check-in and publish

- A target language has its own branches and check-out locks; translation check-in follows the same clean-baseline plus personal-draft rules as normal authoring.
- Each language chooses its own HTML5/PDF theme, brand colour and logo; right-to-left content such as Arabic follows the document's `dir` attributes in the browser and DITA-OT.
- When the source changes again, synced files return to "outdated" and only changed segments are re-translated; checked-in translations are never overwritten by a scan.
- Unlinking removes only the mapping. The target manual and its translations remain and can be re-bound later.

## Explicit boundaries

- Not real-time collaborative translation: there is no CRDT and no simultaneous editing of one segment; check-out locks and the draft overlay still govern collaboration.
- Not a full TMS: no quoting, vendor portal, translation-memory billing or deadline management. Segment reuse is a deterministic incremental mechanism, not a cross-project translation memory.
- AI is optional: without a model you can still pair manuals, scan, edit by hand, run QA, review and check in.
- Only check-in advances the target baseline; scanning, translating and reviewing never change the shared workspace silently.

## Try it now

[Open the hosted workbench](https://www.cemplatformcvs.cloud/dita) and add a target language from the "Translation" entry on a manual card, or read the [feature tour](/en/docs/features) for the rest of the pipeline on the same XML.
