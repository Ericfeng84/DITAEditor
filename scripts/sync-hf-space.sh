#!/usr/bin/env bash
# Stage and push a clean, self-contained Docker build tree for Hugging Face Spaces.
#
# Usage:
#   # Dry-run locally to inspect staged files without pushing:
#   ./scripts/sync-hf-space.sh --dry-run
#
#   # Push to a Hugging Face Docker Space (uses HF_TOKEN if set, otherwise git credentials):
#   HF_SPACE_REPO="your-username/dita-editor" HF_TOKEN="hf_xxx" ./scripts/sync-hf-space.sh
#
# Environment variables:
#   HF_SPACE_REPO  Required (unless --dry-run): "<owner>/<space-name>"
#   HF_TOKEN       Optional: Hugging Face Write Access Token (required in CI)
#   HF_USERNAME    Optional: HF username for basic auth (defaults to owner of HF_SPACE_REPO)
#   HF_BRANCH      Optional: target branch on the Space repo (default: main)
#   HF_COMMIT_MSG  Optional: custom commit message

set -euo pipefail

DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=1
      ;;
    -h|--help)
      sed -n '2,18p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ "${DRY_RUN}" -eq 0 && -z "${HF_SPACE_REPO:-}" ]]; then
  echo "Error: HF_SPACE_REPO is required (example: HF_SPACE_REPO=your-name/dita-editor)." >&2
  exit 1
fi

HF_BRANCH="${HF_BRANCH:-main}"
SHORT_SHA="$(git -C "${REPO_ROOT}" rev-parse --short HEAD 2>/dev/null || echo "local")"
HF_COMMIT_MSG="${HF_COMMIT_MSG:-chore(deploy): sync DITAEditor (${SHORT_SHA}) to Hugging Face Space}"

STAGE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/ditaeditor-hf-stage.XXXXXX")"
cleanup() {
  rm -rf "${STAGE_DIR}"
}
trap cleanup EXIT

copy_tree() {
  local rel_path="$1"
  local src="${REPO_ROOT}/${rel_path}"
  local dst="${STAGE_DIR}/${rel_path}"
  if [[ ! -e "${src}" ]]; then
    echo "Error: missing required path: ${rel_path}" >&2
    exit 1
  fi
  mkdir -p "$(dirname "${dst}")"
  if [[ -d "${src}" ]]; then
    # Copy tracked-like source tree while excluding build/runtime/git artifacts.
    tar -C "${REPO_ROOT}" \
      --exclude='node_modules' \
      --exclude='dist' \
      --exclude='.git' \
      --exclude='.turbo' \
      --exclude='.DS_Store' \
      --exclude='coverage' \
      --exclude='*.log' \
      --exclude='*.sqlite' \
      --exclude='*.sqlite-shm' \
      --exclude='*.sqlite-wal' \
      -cf - "${rel_path}" | tar -C "${STAGE_DIR}" -xf -
  else
    cp "${src}" "${dst}"
  fi
}

echo "Staging Hugging Face Space bundle in ${STAGE_DIR}..."

# Root workspace manifests & Docker runtime files
ROOT_FILES=(
  "Dockerfile"
  "docker-entrypoint.sh"
  ".dockerignore"
  "LICENSE"
  "package.json"
  "pnpm-lock.yaml"
  "pnpm-workspace.yaml"
  "tsconfig.base.json"
  "turbo.json"
  "apps/site/package.json"
)
for file in "${ROOT_FILES[@]}"; do
  copy_tree "${file}"
done

# Workbench packages, DITA-OT CJK plugin, and curated demo project
SOURCE_DIRS=(
  "packages/dita-core"
  "apps/api"
  "apps/web"
  "dita-ot-plugins"
  "samples/demo-dita-project"
)
for dir in "${SOURCE_DIRS[@]}"; do
  copy_tree "${dir}"
done

# Space root README with Hugging Face Docker SDK YAML frontmatter
cp "${REPO_ROOT}/deploy/huggingface/README.md" "${STAGE_DIR}/README.md"

FILE_COUNT="$(find "${STAGE_DIR}" -type f | wc -l | tr -d ' ')"
STAGE_SIZE="$(du -sh "${STAGE_DIR}" | awk '{print $1}')"
echo "Staged ${FILE_COUNT} files (${STAGE_SIZE})."

if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo "Dry-run complete. Top-level staged entries:"
  ls -la "${STAGE_DIR}"
  exit 0
fi

# Initialize an isolated single-commit repo and force-push to the HF Space.
# Single-commit history keeps the Space repo tiny and avoids carrying unrelated docs/screenshots.
cd "${STAGE_DIR}"
git init -q -b "${HF_BRANCH}"
git config user.name "${GIT_AUTHOR_NAME:-DITAEditor Deploy Bot}"
git config user.email "${GIT_AUTHOR_EMAIL:-deploy@ditaeditor.local}"
git add -A
git commit -q -m "${HF_COMMIT_MSG}"

if [[ -n "${HF_TOKEN:-}" ]]; then
  HF_USER="${HF_USERNAME:-${HF_SPACE_REPO%%/*}}"
  REMOTE_URL="https://${HF_USER}:${HF_TOKEN}@huggingface.co/spaces/${HF_SPACE_REPO}"
else
  REMOTE_URL="https://huggingface.co/spaces/${HF_SPACE_REPO}"
fi

echo "Pushing to Hugging Face Space: https://huggingface.co/spaces/${HF_SPACE_REPO} (${HF_BRANCH})..."
git push --force "${REMOTE_URL}" "HEAD:${HF_BRANCH}"
echo "Done! Track build progress at: https://huggingface.co/spaces/${HF_SPACE_REPO}"
