---
status: accepted
---

# Model multi-language manuals as paired independent manuals linked in SQLite

To support multi-language DITA localization without violating [ADR 0001](./0001-manual-as-independent-workspace.md) ("1 Manual = 1 independent workspace and Git repository") or [ADR 0004](./0004-baseline-and-draft-overlay.md) (clean per-branch worktrees with per-user Draft Overlays), each target language edition is modeled as its own independent Manual (with its own Git repository, branches, locks, and HTML5/PDF publish profile), linked to its source Manual via SQLite (`translation_links` and `translation_file_states`) using 1:1 relative file paths.

## Considered Options

- **Language subdirectories inside a single Manual repository (`zh-CN/`, `en-US/`, `ja-JP/`)**: Keeps all languages in one Git history and makes cross-language image sharing trivial, but retrofits existing root-level manuals awkwardly, entangles source authoring and localization commits/branches, and forces per-language publish profile overrides onto a single `manual_publish_profiles` row.
- **Per-language Git branches inside one repository**: Reuses existing worktree isolation, but breaks normal release/feature branching (`main`, `release/2.0`) and makes accidental cross-language merges easy.
- **Paired independent Manuals linked in SQLite (Selected)**: Preserves 1:1 relative paths (`topics/install.dita`, `images/arch.png`, `keys.ditamap`) across source and target languages so `href`, `keyref`, and `conref` resolve identically without path rewriting; gives every language its own Git history, lock scope, and HTML5/PDF theme profile (e.g., Noto CJK for `zh-CN`/`ja-JP` vs. Latin typography for `en-US`).

## Consequences

- `manuals` gains an optional `source_lang` (BCP 47) column, and `translation_links` enforces acyclic 1:N `source -> target_lang` relationships with unique `(source_manual_id, source_branch, target_lang)` and `(target_manual_id, target_branch)` constraints.
- `translation_file_states` tracks per-file baseline watermarks (`last_source_commit`, `last_source_blob_hash`, `last_source_translatable_hash`, `last_target_commit`) entirely in SQLite with zero XML or Git metadata pollution.
- Static binary assets (`images/*`) are synchronized across paired repositories on demand while respecting translator-replaced localized screenshots (`localized_asset_override` detection via blob hash comparison).
- Background AI translation queues never write directly to a target manual's shared `workDir` or steal locks; reviewed translations enter the target manual through Phase 13 `working_drafts` (individually or via batch-apply) and advance synchronization watermarks only upon atomic Check-in to Git `HEAD`.
- Translatable units cover both DITA topic/map text elements and `.ditamap`/`.bookmap` navigation attributes (`navtitle` on `<topichead>`/`<topicref>`/`<mapref>`/etc. and root `title`), updated in place via `setAttribute()` to preserve exact attribute ordering and lossless round-trip.
- In the Workbench Hub, linked target manuals are folded under their source manual's language-family card (base language first, click-to-select before opening via the card's primary Open button), while the Translation Center is entered directly from the editor's always-visible header button and provides direct "Open editor" jumps to each paired target manual.
