#!/bin/sh
set -eu

mkdir -p "${DITA_WORKSPACE_DIR}" "${DITA_IMPORTS_DIR}" "${DITA_PUBLISH_DIR}"

# Seed the writable volume with the curated demo project on first boot. Users can also mount
# their own DITA project at $DITA_WORKSPACE_DIR; an existing non-empty directory is never touched.
# Use `cp -R` (instead of `cp -a`) so non-root UID 1000 runtimes (e.g. Hugging Face Spaces)
# copy files owned by the active runtime user without failing to preserve root ownership.
if [ -z "$(ls -A "${DITA_WORKSPACE_DIR}" 2>/dev/null)" ]; then
  echo "Seeding demo DITA project into ${DITA_WORKSPACE_DIR}"
  cp -R /app/samples/demo-dita-project/. "${DITA_WORKSPACE_DIR}/"
fi

exec "$@"
