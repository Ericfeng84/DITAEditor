---
status: accepted
---

# Keep branch worktrees clean at HEAD and isolate uncommitted edits in a per-user Draft Overlay

Instead of writing unsaved/uncommitted edits directly into the shared per-branch `git worktree` directory, each branch's `workDir` remains clean at Git `HEAD` (the shared **Baseline**), while all uncommitted changes (`edit`, `create`, `delete`, `rename`, and draft binary assets) live in a per-user **Draft Overlay** backed by SQLite `working_drafts` (and an out-of-repo draft asset folder) guarded by `file_locks`. Check-in atomically materializes selected drafts into `workDir`, commits to Git, clears the drafts and locks, and refreshes the shared baseline semantic index.

## Considered Options

- **Keep shared mutable branch worktrees (Phase 4/10 As-Is)**: Simple direct disk I/O, but uncommitted half-finished edits from one author immediately break other authors' semantic diagnostics, DITA-OT strict validation, and publish snapshots on the same branch; deleting or renaming tracked files also deadlocks lock-gated check-in.
- **Per-Topic / per-Map independent object versioning (traditional CCMS)**: Cleanly isolates per-file drafts, but requires a custom Baseline manifest engine, version dependency resolution, and directory assembly for DITA-OT, breaking native Git interoperability and multiplying maintenance complexity.
- **Per-user worktree per branch**: Isolates drafts at the filesystem level, but duplicates full manual trees (including heavy media assets) per user × branch and forces constant cross-worktree merges for routine single-topic edits.

## Consequences

- Multiple authors editing different Topics of the same Map on the same branch still share **one** physical `git worktree` with zero cross-contamination across diagnostics, DITA-OT strict validation (`HEAD` + caller's own drafts), AI context, and publishing (clean `Baseline`/`Tag`/`Commit` by default, optional `my_drafts` preview).
- Deleting, renaming, and cancelling check-outs become transactional SQLite operations with zero risk of lock/Git deadlocks or ownerless dirty files; `topic_assignments.topic_path` syncs on Check-in rather than during draft rename so other users never see broken links against Baseline.
- Workspace asset URLs (`GET /api/assets`) must include `userId` alongside `manualId` and `branch` (extending ADR 0002) so draft images render for their author while remaining hidden from others until check-in.
- For desktop/local workflows where external editors modify `workDir` directly on disk, the API detects external `git status` dirtiness and prompts the user to commit or discard it without silently mixing external changes into draft check-ins.
