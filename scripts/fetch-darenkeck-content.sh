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

validate_tracked_files() {
  local entry
  local metadata
  local mode
  local path

  while IFS= read -r -d '' entry; do
    metadata="${entry%%$'\t'*}"
    path="${entry#*$'\t'}"
    mode="${metadata%% *}"

    case "${mode}" in
      100644|100755) ;;
      *) fail "Content repository contains unsupported tracked file type at ${path} (mode ${mode})." ;;
    esac
  done < <(git -C "${SOURCE_DIR}" ls-files --stage -z -- content media diagrams)
}

validate_staged_tree() {
  local root="$1"
  local unsafe_path
  unsafe_path="$(find "${root}" ! -type d ! -type f -print -quit)"
  [[ -z "${unsafe_path}" ]] || fail "Staged content contains a non-regular file: ${unsafe_path}"
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
validate_tracked_files
[[ -f "${SOURCE_DIR}/content/resume.md" && ! -L "${SOURCE_DIR}/content/resume.md" ]] || fail "Content repository is missing required regular file: content/resume.md"
[[ -s "${SOURCE_DIR}/content/resume.md" ]] || fail "Content repository contains an empty file: content/resume.md"

CONTENT_COMMIT="$(git -C "${SOURCE_DIR}" rev-parse HEAD)"
[[ "${CONTENT_COMMIT}" =~ ^[0-9a-f]{40}$ ]] || fail "Unable to resolve the fetched content commit."

mkdir -p "${NEXT_GENERATED_DIR}" "${NEXT_PUBLIC_MEDIA_DIR}"
cp -R "${SOURCE_DIR}/content" "${NEXT_GENERATED_DIR}/content"
if [[ -d "${SOURCE_DIR}/diagrams" ]]; then
  cp -R "${SOURCE_DIR}/diagrams" "${NEXT_GENERATED_DIR}/diagrams"
fi
cp -R "${SOURCE_DIR}/media/." "${NEXT_PUBLIC_MEDIA_DIR}/"
printf '%s\n' "${CONTENT_COMMIT}" > "${NEXT_GENERATED_DIR}/REVISION"
validate_staged_tree "${NEXT_GENERATED_DIR}"
validate_staged_tree "${NEXT_PUBLIC_MEDIA_DIR}"

rm -rf "${GENERATED_DIR}" "${PUBLIC_MEDIA_DIR}"
mv "${NEXT_GENERATED_DIR}" "${GENERATED_DIR}"
mv "${NEXT_PUBLIC_MEDIA_DIR}" "${PUBLIC_MEDIA_DIR}"

printf 'Fetched darenkeck content commit %s.\n' "${CONTENT_COMMIT}"
