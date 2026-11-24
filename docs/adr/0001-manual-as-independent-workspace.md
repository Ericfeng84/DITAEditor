---
status: accepted
---

# Model each Manual as an independent workspace and Git repository

We model each **Manual** as a 1:1 independent DITA workspace directory with its own Git repository, branches, locks, and publishing history, rather than a Root Map inside a single shared repository. This aligns cleanly with existing Git worktree isolation, `file_locks` scoping, folder import, and starter scaffolding while preventing cross-manual directory clutter.

## Considered Options

- **1 Manual = 1 Root Map inside a shared repository**: Enables direct relative-path Topic/Key/Conref reuse across manuals, but entangles branching, history, locks, and deletion across unrelated deliverables.
- **Project → Manual two-level hierarchy**: Adds an extra organizational layer unnecessary for a lightweight small-team workbench.

## Consequences

- Cross-manual Topic reuse is intentionally out of scope for now; shared content lives within the same Manual's repository (which may still contain multiple Root Maps).
- Existing workspace management (`WorkspaceDialog`, `workspaces.json`) consolidates into a SQLite-backed Manual registry.
