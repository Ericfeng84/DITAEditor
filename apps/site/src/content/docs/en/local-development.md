---
title: Local development
description: "Run DITAEditor from source: pnpm workspace, two dev servers, the test matrix, demo project, and optional local DITA-OT."
updated: '2026-11-22'
---

The repository is a pnpm workspace containing the shared kernel `@dita/core`, the web app `@dita/web`, the API `@dita/api`, and this site `@dita/site`.

## Requirements

- Node.js 22 (`>=20` may work, but CI and containers use 22)
- pnpm 11.5.2 (`corepack enable`; pinned by `packageManager`)
- Optional: JRE 21 and DITA-OT 4.x for real validation and publishing
- Optional: Python 3, make, and g++ so `better-sqlite3` can compile when no prebuilt binary matches

## Install and run

```bash
corepack enable
pnpm install

# Terminal A: API (http://localhost:3001)
pnpm --filter @dita/api dev

# Terminal B: web (http://localhost:5173, proxies /api)
pnpm --filter @dita/web dev
```

To work on the marketing site and the browser sandbox only:

```bash
pnpm --filter @dita/site dev
```

## Repository tour

```text
packages/dita-core/   XML parse/serialize, DITA registry, CALS, AI splice, ProseMirror
apps/api/src/modules/ git / identity / locks / files / indexer / validate / publish / dita-ot / ai / static
apps/web/src/         Topic editor, map tree, keys panel, publish UI, AI panel
apps/site/            Static site, /playground sandbox, docs collection (this page)
samples/demo-dita-project/  Curated demo project
```

## Quality gates

After any code change, run from the repository root:

```bash
pnpm -r build
pnpm -r typecheck
pnpm -r test
```

Focused commands:

```bash
pnpm --filter @dita/core test
pnpm --filter @dita/web test
pnpm --filter @dita/api test
pnpm --filter @dita/site test
```

Golden fixtures for `@dita/core` live in `packages/dita-core/test/fixtures/`. Any change to parsing, serialization, CALS, or ProseMirror mapping must keep those fixtures byte-identical through a round-trip.

## Environment variables

The most useful ones in development:

```bash
export DITA_WORKSPACE_DIR="$PWD/samples/demo-dita-project"
export DITA_OT_HOME="/path/to/dita-ot"
export DITA_PUBLISH_DIR="$PWD/.tmp/publishes"
export PORT=3001
```

AI variables are documented in [AI setup and security boundaries](/en/docs/ai-setup). Never commit real keys.

## Database and identities

On startup the API creates the SQLite database in the data directory and runs Drizzle migrations. A fresh database provides switchable local identities (Admin / Writer / Viewer). Deleting the database resets identities and locks; Git repositories and publish output are not removed.

## Debugging notes

- **Round-trip problems**: write a minimal fixture in `@dita/core` first, then fix `xml/` or `prosemirror/`. Do not patch the UI around it.
- **CALS anomalies**: check `namest` / `nameend` / `morerows` pairing with `colspec`, and confirm the table has a single `tgroup`.
- **Lock conflicts**: the key is `(project, branch, file_path)`. Switching branches must not reuse stale locks.
- **Publish failures**: run strict validation first, then check `DITA_OT_HOME`, the Java version, and plugin installation logs.
- **AI SSE disconnects**: the server cancels only on `'aborted'` or a response `'close'` that is not `writableEnded`. Do not listen for `req.raw` `'close'`.

## Before committing

1. `pnpm -r build && pnpm -r typecheck && pnpm -r test` is green.
2. Changes to XML/CALS/PM logic ship with a focused regression test.
3. Site content changes keep both Chinese and English Markdown files with matching structure.
4. If `graphify-out/` is maintained, run `graphify update .`.

## Next steps

- Feature overview: [Feature tour](/en/docs/features)
- Deploy to a server: [Getting started with Docker](/en/docs/getting-started)
