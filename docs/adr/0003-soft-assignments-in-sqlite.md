---
status: accepted
---

# Store Topic Assignments in SQLite as soft guidance decoupled from XML and locks

Topic Assignments are stored exclusively in SQLite (never serialized into `.dita` `<prolog>` elements) and act as soft collaboration guidance rather than hard Check-out Locks or an approval workflow. Only `admin` and `writer` identities may assign or be assigned; at most one active (`pending` or `in_progress`) Assignment may exist per `(manual, branch, topicPath)`.

## Considered Options

- **Store assignment metadata in DITA `<prolog>` / processing instructions**: Keeps assignment data in Git history, but creates noisy XML diffs for every status change or reassignment and forces Check-out Locks just to delegate work.
- **Hard-bind Assignments to Check-out Locks and add an `in_review` approval gate**: Prevents any non-assignee from editing a delegated Topic, but conflicts with DITAEditor's lightweight team positioning and blocks urgent edits when an assignee is unavailable.

## Consequences

- Delegating, reassigning, or completing an Assignment produces zero XML churn and zero Git Diff.
- When an author opens or attempts to check out a Topic actively assigned to someone else, the UI surfaces a clear warning and confirmation rather than blocking them outright.
- File renames must update matching `topicPath` records in SQLite; deleted files leave Assignments intact with a "target file missing" indicator.
