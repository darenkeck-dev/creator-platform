#!/usr/bin/env bash

set -euo pipefail

STAGE="${1:-}"
if [[ -z "${STAGE}" ]]; then
  echo "Usage: $0 <staging|prod>"
  exit 1
fi

case "${STAGE}" in
  staging)
    BUILD_CMD="build:darenkeck:staging"
    BUCKET_EXPORT="DARENKECK-SITE-BUCKET-NAME-STAGING"
    DIST_EXPORT="DARENKECK-SITE-CLOUDFRONT-DISTRIBUTION-ID-STAGING"
    ;;
  prod)
    BUILD_CMD="build:darenkeck:prod"
    BUCKET_EXPORT="DARENKECK-SITE-BUCKET-NAME"
    DIST_EXPORT="DARENKECK-SITE-CLOUDFRONT-DISTRIBUTION-ID"
    ;;
  *)
    echo "Invalid stage '${STAGE}'. Expected 'staging' or 'prod'."
    exit 1
    ;;
esac

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

if [[ -f "${ROOT_DIR}/.env" ]]; then
  set -a
  source "${ROOT_DIR}/.env"
  set +a
fi

resolve_export() {
  local export_name="$1"
  local value
  value="$(aws cloudformation list-exports --query "Exports[?Name=='${export_name}'].Value | [0]" --output text)"
  if [[ -z "${value}" || "${value}" == "None" ]]; then
    echo "Unable to resolve CloudFormation export '${export_name}'."
    exit 1
  fi
  echo "${value}"
}

BUCKET_NAME="$(resolve_export "${BUCKET_EXPORT}")"
DIST_ID="$(resolve_export "${DIST_EXPORT}")"

echo "Preparing darenkeck content, diagrams, and resume PDF..."
bun run content:darenkeck:prepare

echo "Building darenkeck for ${STAGE}..."
bun run "${BUILD_CMD}"

echo "Smoke-testing the production build..."
bun run --cwd apps/darenkeck check:production-build

echo "Uploading versioned assets to s3://${BUCKET_NAME}/assets ..."
aws s3 sync "apps/darenkeck/dist/assets" "s3://${BUCKET_NAME}/assets" --no-follow-symlinks --cache-control "public,max-age=31536000,immutable" --exclude ".DS_Store" --exclude "*/.DS_Store"

echo "Syncing site shell and content to s3://${BUCKET_NAME} ..."
aws s3 sync "apps/darenkeck/dist" "s3://${BUCKET_NAME}" --delete --no-follow-symlinks --cache-control "no-cache" --exclude "assets/*" --exclude ".DS_Store" --exclude "*/.DS_Store"

echo "Removing any existing .DS_Store objects from s3://${BUCKET_NAME} ..."
aws s3 rm "s3://${BUCKET_NAME}" --recursive --exclude "*" --include ".DS_Store" --include "*/.DS_Store"

echo "Creating CloudFront invalidation for ${DIST_ID} ..."
aws cloudfront create-invalidation --distribution-id "${DIST_ID}" --paths "/*"

echo "Deploy complete for ${STAGE}."
