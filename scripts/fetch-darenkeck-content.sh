#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTENT_REPO="${DARENKECK_CONTENT_REPO:-git@github.com:darenkeck-dev/darenkeck-content.git}"
CONTENT_REF="${DARENKECK_CONTENT_REF:-main}"
GENERATED_DIR="${ROOT_DIR}/apps/darenkeck/.generated-content"
PUBLIC_MEDIA_DIR="${ROOT_DIR}/apps/darenkeck/public/media"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/darenkeck-content.XXXXXX")"
NEXT_GENERATED_DIR="${GENERATED_DIR}.next.$$"
NEXT_PUBLIC_MEDIA_DIR="${PUBLIC_MEDIA_DIR}.next.$$"

cleanup() {
  rm -rf "${WORK_DIR}" "${NEXT_GENERATED_DIR}" "${NEXT_PUBLIC_MEDIA_DIR}"
}
trap cleanup EXIT

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

printf 'Fetching darenkeck content from %s at %s...\n' "${CONTENT_REPO}" "${CONTENT_REF}"
git clone --quiet --depth 1 --no-checkout "${CONTENT_REPO}" "${WORK_DIR}/repo"

if [[ "${CONTENT_REF}" == "main" ]]; then
  git -C "${WORK_DIR}/repo" checkout --quiet --detach origin/main
else
  git -C "${WORK_DIR}/repo" fetch --quiet --depth 1 origin "${CONTENT_REF}"
  git -C "${WORK_DIR}/repo" checkout --quiet --detach FETCH_HEAD
fi

SOURCE_DIR="${WORK_DIR}/repo"
[[ -d "${SOURCE_DIR}/content" ]] || fail "Content repository is missing required directory: content/"
[[ -d "${SOURCE_DIR}/media" ]] || fail "Content repository is missing required directory: media/"
[[ -s "${SOURCE_DIR}/content/resume.md" ]] || fail "Content repository is missing required non-empty file: content/resume.md"

CONTENT_COMMIT="$(git -C "${SOURCE_DIR}" rev-parse HEAD)"
[[ "${CONTENT_COMMIT}" =~ ^[0-9a-f]{40}$ ]] || fail "Unable to resolve the fetched content commit."

mkdir -p "${NEXT_GENERATED_DIR}" "${NEXT_PUBLIC_MEDIA_DIR}"
cp -R "${SOURCE_DIR}/content" "${NEXT_GENERATED_DIR}/content"
cp -R "${SOURCE_DIR}/media/." "${NEXT_PUBLIC_MEDIA_DIR}/"
printf '%s\n' "${CONTENT_COMMIT}" > "${NEXT_GENERATED_DIR}/REVISION"

rm -rf "${GENERATED_DIR}" "${PUBLIC_MEDIA_DIR}"
mv "${NEXT_GENERATED_DIR}" "${GENERATED_DIR}"
mv "${NEXT_PUBLIC_MEDIA_DIR}" "${PUBLIC_MEDIA_DIR}"

printf 'Fetched darenkeck content commit %s.\n' "${CONTENT_COMMIT}"
