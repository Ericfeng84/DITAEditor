# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# 1. Build the pnpm workspace (deterministic, no runtime Java needed here)
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
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
RUN pnpm install --frozen-lockfile

COPY . .
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

ENV NODE_ENV=production \
    PORT=3001 \
    DITA_OT_VERSION=${DITA_OT_VERSION} \
    DITA_OT_HOME=/opt/dita-ot \
    DITAEDITOR_PDF_PLUGIN_DIR=/app/dita-ot-plugins/com.ditaeditor.pdf-cjk \
    DITA_WORKSPACE_DIR=/data/workspace \
    DITA_IMPORTS_DIR=/data/workspaces \
    DITA_PUBLISH_DIR=/data/publishes \
    DITAEDITOR_NOTO_CJK_DIR=/usr/share/fonts/opentype/noto \
    DITA_PUBLISH_CONCURRENCY=1 \
    JAVA_HOME=/opt/java/openjdk
ENV PATH=$JAVA_HOME/bin:$PATH

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
        unzip \
        zip \
        ca-certificates \
        git \
        fonts-noto-cjk \
        fonts-noto-cjk-extra \
    && rm -rf /var/lib/apt/lists/*

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

RUN mkdir -p /data/workspace /data/workspaces /data/publishes
VOLUME ["/data"]
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT}/health" || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "/app/apps/api/dist/index.js"]
