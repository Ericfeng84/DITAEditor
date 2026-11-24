---
title: Getting started with Docker
description: "Run DITAEditor as a single container: ports, data volume, environment variables, first login, project import, and publish verification."
updated: '2026-11-24'
---

The same container serves the Fastify API, the built web app, SQLite, the local Git repository, and DITA-OT 4.2.1. No external database, cache, or queue is required.

## Requirements

- Docker 24+ (Compose optional)
- At least 2 GB of free disk (the DITA-OT distribution and Noto CJK fonts are large)
- Network access to GitHub Releases during the first build; see troubleshooting for restricted networks

<a id="docker"></a>

## Start with two commands

```bash
docker build -t ditaeditor:local .

docker run --rm -p 3001:3001 \
  -v ditaeditor-data:/data \
  --name ditaeditor \
  ditaeditor:local
```

Open <http://localhost:3001>. The health endpoint is `GET /health`.

On first boot the entrypoint copies `samples/demo-dita-project` into `/data/workspace` unless that directory is already non-empty. You get a complete DITA map, topics, `.ditaval` files, and image assets out of the box.

<a id="desktop"></a>

## Desktop app (macOS / Windows, no Docker)

If you would rather not keep Docker on every writer's machine, download an installer from [GitHub Releases](https://github.com/Ericfeng84/DITAEditor/releases/latest). The Electron main process embeds `@dita/api` on a random `127.0.0.1` port, so no Node.js, database or reverse proxy is required.

| Platform | Installer | Portable |
| --- | --- | --- |
| macOS (Apple Silicon `arm64`) | `DITAEditor-<version>-mac-arm64.dmg` | `DITAEditor-<version>-mac-arm64.zip` |
| Windows (`x64`) | `DITAEditor-<version>-win-x64.exe` (NSIS) | `DITAEditor-<version>-win-x64.zip` |

- Workspaces, SQLite, `git worktree` and publish output live in the per-user data directory; override it with `DITA_DESKTOP_DATA_DIR`.
- Ships the demo manual and the Noto CJK PDF font plugin, so Chinese PDF works out of the box. Local Git and DITA-OT 4.x are auto-detected; editing, maps, keys, conref, DITAVAL and AI keep working without them.
- Open-source builds are not code-signed: if Gatekeeper blocks the first launch on macOS, run `xattr -cr /Applications/DITAEditor.app`; on Windows choose More info → Run anyway in SmartScreen.
- The desktop app shares the same `@dita/core` kernel and SQLite schema as the web version, so workspaces move between them unchanged.

## Ports and volumes

| Item | Default | Notes |
| --- | --- | --- |
| Container port | `3001` | Controlled by `PORT`; serves both API and static web |
| Data volume | `/data` | Workspace, imports, SQLite, and publish output |
| Workspace | `/data/workspace` | `DITA_WORKSPACE_DIR` |
| Import area | `/data/workspaces` | `DITA_IMPORTS_DIR` |
| Publish output | `/data/publishes` | `DITA_PUBLISH_DIR` |

Removing the container does not delete the named volume. To reset completely, run `docker volume rm ditaeditor-data`.

## Key environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | HTTP port |
| `DITA_LOCK_TTL_HOURS` | see source | Check-out lock expiry in hours |
| `DITA_PUBLISH_CONCURRENCY` | `1` | Concurrent DITA-OT publish jobs |
| `DITA_OT_HOME` | `/opt/dita-ot` | DITA-OT installation |
| `DITA_CMD` | auto-detected | Explicit `dita` executable |
| `DITAEDITOR_PDF_PLUGIN_DIR` | bundled plugin | Noto CJK PDF plugin location |
| `DITAEDITOR_NOTO_CJK_DIR` | `/usr/share/fonts/opentype/noto` | CJK font directory |
| `DEEPSEEK_API_KEY` | empty | AI key fallback |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com/v1` | OpenAI-compatible endpoint |
| `DEEPSEEK_MODEL` | `deepseek-flash` | Default model |
| `AI_TIMEOUT_MS` | see source | Per-request model timeout |
| `AI_MAX_CONTEXT_CHARS` | see source | Maximum context characters sent to the model |

Database-stored AI settings take precedence over environment variables. `GET /api/ai/config` only returns a masked key.

## First run

1. Switch to the **Admin** identity in the header and confirm the UI flips between 中文 and EN instantly.
2. On the **manual workbench**, assign a topic from the built-in demo manual to a writer with a due date and note; then switch to that Writer and find it under "Assigned to me".
3. Open the manual's map and confirm the tree and keyspace load.
4. As **Writer**, check out a `.dita` topic, then try the same file from a second window to see the lock conflict.
5. Use **Open topic** on a task card to jump straight to the file, and mark it done to clear it from the queue.
6. Edit a sentence, switch to source, and confirm the diff is a single line.
7. Run **strict validation**, then publish HTML5 and PDF while watching the streamed log.

## Import your own project

Put a DITA project into the workspace volume, attach a local directory from the manual workbench, or upload a ZIP where your deployment allows it. Requirements:

- Maps and topics use standard DITA 1.3 DOCTYPEs or `<?xml-model?>`.
- Images and other resources use relative paths and travel with the project.
- If you rely on `keydef`, `conref`, or `.ditaval`, keep the directory layout identical to your repository.

## Verify publishing

- **Strict validation** runs with `--validate=yes --processing-mode=strict`; DTD/RNG errors return file, line, and column.
- **HTML5** output can be hosted statically.
- **PDF** loads the pure-XML Noto CJK font-mappings plugin through `--customization.dir`. If CJK glyphs are missing, confirm the font directory exists in the container and that the plugin installed successfully.

## Troubleshooting

**The DITA-OT download fails during build.** Pre-download the official zip into the build context, or point the build at an internal mirror and override the version/download URL. Runtime does not need internet access.

**PDF jobs stay queued.** Concurrency defaults to 1 and DITA-OT startup is heavy. Raise `DITA_PUBLISH_CONCURRENCY` only after checking memory.

**Images 404 after import.** Verify that resource paths are relative to the map/topic and that assets were uploaded with the project.

**A lock never releases.** Admin can force-unlock. The system first backs up the current file content as a patch, then releases the lock.

## Next steps

- Work on the source: [Local development](/en/docs/local-development)
- Connect a model: [AI setup and security boundaries](/en/docs/ai-setup)
- Understand the internals: [Architecture reference](/en/docs/architecture)
