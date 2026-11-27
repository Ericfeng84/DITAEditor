# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# 1. Build the pnpm workspace (deterministic, no runtime Java needed here)
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate

# better-sqlite3 may need to compile when no prebuilt binary matches the image.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json turbo.json ./
COPY packages/dita-core/package.json packages/dita-core/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/site/package.json apps/site/
COPY apps/desktop/package.json apps/desktop/
RUN pnpm install --frozen-lockfile --filter @dita/core --filter @dita/web --filter @dita/api

COPY . .
ARG VITE_BASE=/
ENV VITE_BASE=${VITE_BASE}
# The marketing site is deployed separately (CDN): keep the workbench image lean.
RUN pnpm --filter @dita/core --filter @dita/web --filter @dita/api build

# ---------------------------------------------------------------------------
# 2. Java 21 runtime (DITA-OT 4.x supports LTS Java)
# ---------------------------------------------------------------------------
FROM eclipse-temurin:21-jre AS jre

# ---------------------------------------------------------------------------
# 3. Runtime: Node + Java 21 + DITA-OT 4.x + Noto CJK, single container
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

ARG DITA_OT_VERSION=4.2.1
ARG DITA_BASE_PATH=
# Phase 14: opt-in, lightweight Microsoft MarkItDown CLI (`markitdown[all]`) for
# Office / EPUB / CSV / HTML / text-PDF ingest. The default `false` keeps the image
# byte-for-byte as lean as before (no Python runtime, no extra dependencies).
ARG INSTALL_MARKITDOWN=false

ENV NODE_ENV=production \
    HOME=/home/node \
    PORT=3001 \
    DITA_BASE_PATH=${DITA_BASE_PATH} \
    DITA_OT_VERSION=${DITA_OT_VERSION} \
    DITA_OT_HOME=/opt/dita-ot \
    DITAEDITOR_PDF_PLUGIN_DIR=/app/dita-ot-plugins/com.ditaeditor.pdf-cjk \
    DITA_WORKSPACE_DIR=/data/workspace \
    DITA_IMPORTS_DIR=/data/workspaces \
    DITA_PUBLISH_DIR=/data/publishes \
    DITA_INGEST_DIR=/data/ingest \
    DITAEDITOR_NOTO_CJK_DIR=/usr/share/fonts/opentype/noto \
    DITA_PUBLISH_CONCURRENCY=1 \
    JAVA_HOME=/opt/java/openjdk
ENV PATH=$JAVA_HOME/bin:$PATH

# `fonts-noto-cjk*` ships CFF-outline TTC collections only. Adobe FOP 2.9 cannot embed a
# collection (it picks its TrueType parser from the file header), so @dita/api extracts the
# needed faces into standalone `.otf` files per publish job (`fop-font-config.ts`). The
# `-extra` package adds Thin/Light/Medium/Black weights; the planner keeps Regular + Bold.
#
# `fontconfig` is mandatory for PDF: headless Java reads `/etc/fonts/fonts.conf` to enumerate
# families, and Batik (SVG images inside PDF2) touches that path on first render. The slim base
# image ships no `/etc/fonts` at all, which surfaces as
# `java.lang.RuntimeException: Fontconfig head is null, check your fonts or fonts configuration`
# from `org.apache.batik.bridge.DefaultFontFamilyResolver.<clinit>`. `fc-cache -f` then records
# the Noto CJK faces in the font cache used by both Batik and FOP.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
        unzip \
        zip \
        ca-certificates \
        git \
        fontconfig \
        fonts-noto-cjk \
        fonts-noto-cjk-extra \
    && fc-cache -f \
    && rm -rf /var/lib/apt/lists/*

# Phase 14 (optional): MarkItDown CLI in an isolated venv at /opt/markitdown-venv.
# Kept in a single conditional layer so `INSTALL_MARKITDOWN=false` adds zero bytes and
# zero apt packages. `--no-cache-dir` keeps the layer small; apt lists are removed.
RUN if [ "$INSTALL_MARKITDOWN" = "true" ]; then \
        set -e; \
        apt-get update \
        && apt-get install -y --no-install-recommends python3 python3-venv \
        && rm -rf /var/lib/apt/lists/* \
        && python3 -m venv /opt/markitdown-venv \
        && /opt/markitdown-venv/bin/pip install --no-cache-dir --upgrade pip \
        && /opt/markitdown-venv/bin/pip install --no-cache-dir "markitdown[all]" \
        && /opt/markitdown-venv/bin/python -c "import markitdown" \
        && chmod -R a+rX /opt/markitdown-venv; \
    fi

# A non-existent PATH entry is harmless, so the lean default build is unaffected while
# `INSTALL_MARKITDOWN=true` exposes the `markitdown` CLI to `@dita/api` (spawned as `node`).
ENV PATH=/opt/markitdown-venv/bin:$PATH

COPY --from=jre /opt/java/openjdk /opt/java/openjdk

# DITA-OT official distribution. Override the ARG when building in a restricted network,
# or pre-download the zip and use `--build-arg DITA_OT_VERSION=...` with a mirror.
RUN curl -fsSL --retry 3 \
        "https://github.com/dita-ot/dita-ot/releases/download/${DITA_OT_VERSION}/dita-ot-${DITA_OT_VERSION}.zip" \
        -o /tmp/dita-ot.zip \
    && unzip -q /tmp/dita-ot.zip -d /opt \
    && mv "/opt/dita-ot-${DITA_OT_VERSION}" /opt/dita-ot \
    && rm -f /tmp/dita-ot.zip \
    && /opt/dita-ot/bin/dita --version

ENV PATH=/opt/dita-ot/bin:$PATH

WORKDIR /app
# The build stage contains built dist/ output, workspace symlinks and production dependencies.
COPY --from=build /app /app
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Install the pure-XML Noto CJK PDF plugin into DITA-OT.
RUN cd /app/dita-ot-plugins \
    && zip -qr /tmp/com.ditaeditor.pdf-cjk.zip com.ditaeditor.pdf-cjk \
    && dita install /tmp/com.ditaeditor.pdf-cjk.zip \
    && rm -f /tmp/com.ditaeditor.pdf-cjk.zip \
    && dita --version

# Prepare writable runtime directories and run as UID 1000 (`node`) so the same image works
# seamlessly on standard Docker hosts and non-root platforms such as Hugging Face Spaces.
RUN mkdir -p /data/workspace /data/workspaces /data/publishes /data/ingest /home/node/.fop /home/node/.cache /opt/dita-ot/temp \
    && chown -R node:node /data /home/node /opt/dita-ot/temp \
    && chmod -R g+rwX /data /home/node /opt/dita-ot/temp \
    && git config --system --add safe.directory '*'

VOLUME ["/data"]
EXPOSE 3001

USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT}/health" || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "/app/apps/api/dist/index.js"]
