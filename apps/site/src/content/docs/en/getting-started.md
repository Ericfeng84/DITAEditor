---
title: Getting started with Docker
description: "Run DITAEditor as a single container: ports, data volume, environment variables, first login, project import, and publish verification."
updated: '2026-11-22'
---

The same container serves the Fastify API, the built web app, SQLite, the local Git repository, and DITA-OT 4.2.1. No external database, cache, or queue is required.

## Requirements

- Docker 24+ (Compose optional)
- At least 2 GB of free disk (the DITA-OT distribution and Noto CJK fonts are large)
- Network access to GitHub Releases during the first build; see troubleshooting for restricted networks

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

1. Switch to the **Admin** identity in the header.
2. Open the demo project and its map; confirm the tree, keyspace, and topics load.
3. Switch to **Writer**, check out a `.dita` topic, and try to check out the same file from a second window to see the lock conflict.
4. Edit a sentence, switch to source, and confirm the diff is a single line.
5. Run **strict validation**, then publish HTML5 and PDF while watching the streamed log.

## Import your own project

Put a DITA project into the workspace volume, or upload a ZIP where your deployment allows it. Requirements:

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
