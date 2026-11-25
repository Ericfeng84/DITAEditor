#!/usr/bin/env bash
# Build and deploy DITAEditor to GCP Cloud Run (trial / lowest-cost single-instance config)
# for subpath reverse-proxy hosting (e.g. https://www.cemplatformcvs.cloud/dita).
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
REGION="${GCP_REGION:-asia-northeast1}"
REPO="${GCP_AR_REPO:-ditaeditor}"
SERVICE="${GCP_SERVICE:-dita-editor}"
BASE_PATH="${DITA_BASE_PATH:-/dita}"
VITE_BASE="${BASE_PATH%/}/"

if [[ -z "${PROJECT_ID}" ]]; then
  echo "Error: GCP project is not set. Run 'gcloud config set project <PROJECT_ID>' or pass GCP_PROJECT_ID." >&2
  exit 1
fi

IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/app:latest"

echo "==> Project:  ${PROJECT_ID}"
echo "==> Region:   ${REGION}"
echo "==> Service:  ${SERVICE}"
echo "==> BasePath: ${BASE_PATH} (VITE_BASE=${VITE_BASE})"
echo "==> Image:    ${IMAGE}"

gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  --project="${PROJECT_ID}"

if ! gcloud artifacts repositories describe "${REPO}" \
  --location="${REGION}" \
  --project="${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud artifacts repositories create "${REPO}" \
    --repository-format=docker \
    --location="${REGION}" \
    --project="${PROJECT_ID}" \
    --description="DITAEditor container images"
fi

gcloud builds submit \
  --project="${PROJECT_ID}" \
  --config="deploy/gcp/cloudbuild.yaml" \
  --substitutions="_IMAGE=${IMAGE},_VITE_BASE=${VITE_BASE},_DITA_BASE_PATH=${BASE_PATH}" \
  .

ENV_VARS="DITA_PUBLISH_CONCURRENCY=1,DITA_BASE_PATH=${BASE_PATH}"
if [[ -n "${DEEPSEEK_API_KEY:-}" ]]; then
  ENV_VARS="${ENV_VARS},DEEPSEEK_API_KEY=${DEEPSEEK_API_KEY}"
fi

gcloud run deploy "${SERVICE}" \
  --project="${PROJECT_ID}" \
  --image="${IMAGE}" \
  --region="${REGION}" \
  --allow-unauthenticated \
  --port=8080 \
  --cpu=2 \
  --memory=2Gi \
  --min-instances=0 \
  --max-instances=1 \
  --concurrency=40 \
  --timeout=900 \
  --set-env-vars="${ENV_VARS}"

SERVICE_URL="$(gcloud run services describe "${SERVICE}" \
  --project="${PROJECT_ID}" \
  --region="${REGION}" \
  --format='value(status.url)')"

echo ""
echo "==> Cloud Run deployed successfully!"
echo "    Upstream URL: ${SERVICE_URL}"
echo "    Next: point Vercel rewrite ${BASE_PATH} -> ${SERVICE_URL}"
