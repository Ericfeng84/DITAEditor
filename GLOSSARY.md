# DITAEditor

A team-oriented lightweight Web DITA 1.3 structured authoring workbench centered on Manuals, lossless DITA XML editing, Check-out Locks, and lightweight Topic Assignments.

## Language

### Authoring & Content

**Manual (手册)**:
An independent DITA documentation unit backed by its own workspace directory and Git repository, containing one or more Root Maps, Topics, and publishing history.
_Avoid_: Project, Workspace (in product and domain language; use *Workspace Directory* only when referring to the physical path on disk)

**Root Map**:
A top-level `.ditamap` or `.bookmap` inside a Manual that defines the navigation hierarchy, keyspace, and publishing entry point.
_Avoid_: Master Map, Main TOC

**Topic**:
A standalone `.dita` authoring file representing a single subject, typed as `concept`, `task`, `reference`, or generic `topic`.
_Avoid_: Page, Article, Document

**Task (DITA Task)**:
A Topic of the OASIS DITA 1.3 `<task>` information type describing procedural steps.
_Avoid_: Assignment, Todo, Work Item

### Workbench & Collaboration

**Workbench Hub (手册编辑工作台)**:
The landing view shown when entering the system, listing Manuals and the current author's Assignments.
_Avoid_: Dashboard, Home Page, Portal

**Assignment (编辑任务)**:
A lightweight delegated work item binding an **Assignee** to a specific Topic within a Manual and branch, tracking progress (`pending`, `in_progress`, `done`, `cancelled`) as soft guidance without an approval gate. At most one active (`pending` or `in_progress`) Assignment exists per Topic on a given branch.
_Avoid_: Task, Ticket, Review, Workflow

**Assigner (委派人)**:
The `admin` or `writer` who delegates a Topic editing Assignment to an Assignee.
_Avoid_: Creator, Manager

**Assignee (受托人)**:
The `admin` or `writer` currently responsible for completing an Assignment; read-only `viewer` identities cannot be Assignees.
_Avoid_: Owner, Reviewer

**Check-out Lock (检出独占锁)**:
An exclusive pessimistic lock held by one author on a single file within a Manual and branch until checked in, released, or force-unlocked.
_Avoid_: Assignment Lock, Edit Reservation
