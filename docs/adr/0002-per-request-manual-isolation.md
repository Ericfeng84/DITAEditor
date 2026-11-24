---
status: accepted
---

# Scope backend workspace and semantic index per request by Manual ID and branch

Backend routes resolve the target Manual and branch worktree per request via explicit `x-dita-manual-id` and optional `x-dita-branch` headers (backed by a cache of per-Manual/branch workspace instances and semantic indexers), rather than mutating a single server-global `activeRootDir`. Requests omitting these headers fall back to the default or last-active Manual and its primary branch for backward compatibility.

## Considered Options

- **Keep a single global `WorkspaceManager.activeRootDir`**: Zero route changes, but two authors (or two browser tabs) opening different Manuals or different branches of the same Manual clobber each other's active workspace, locks, and Git operations.
- **Prefix every existing route with `/api/manuals/:manualId/...`**: Clean REST URLs, but forces a large breaking rewrite across every existing API client, SSE endpoint, asset URL, and test suite.

## Consequences

- Concurrent authors can edit different Manuals — or different Git branches of the same Manual via independent `git worktree` directories — and jump across Manuals/branches from "My Assignments" without interfering with each other.
- Static asset URLs (e.g., workspace images) must also carry the Manual and branch context (`manualId` / `branch` query params) so `<image>` elements load from the right worktree.
- Per-`(manualId, branch)` semantic indexer caches should use bounded retention (LRU) to keep memory predictable when many Manuals or branches exist.
