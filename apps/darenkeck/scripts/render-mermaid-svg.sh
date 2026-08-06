#!/usr/bin/env bash

set -euo pipefail

MERMAID_CLI_VERSION="11.16.0"
INPUT_PATH="${1:-}"
OUTPUT_PATH="${2:-}"

if [[ -z "${INPUT_PATH}" || -z "${OUTPUT_PATH}" ]]; then
  printf 'Usage: %s <input.mmd> <output.svg>\n' "$0" >&2
  exit 1
fi

if [[ ! -f "${INPUT_PATH}" || -L "${INPUT_PATH}" ]]; then
  printf 'Mermaid input must be a regular file: %s\n' "${INPUT_PATH}" >&2
  exit 1
fi

if [[ "${OUTPUT_PATH}" != *.svg ]]; then
  printf 'Mermaid output must use the .svg extension: %s\n' "${OUTPUT_PATH}" >&2
  exit 1
fi

OUTPUT_DIR="$(dirname "${OUTPUT_PATH}")"
OUTPUT_NAME="$(basename "${OUTPUT_PATH}")"
mkdir -p "${OUTPUT_DIR}"
TEMP_OUTPUT="${OUTPUT_DIR}/.${OUTPUT_NAME}.tmp.svg"

cleanup() {
  rm -f "${TEMP_OUTPUT}"
}
trap cleanup EXIT

bunx "@mermaid-js/mermaid-cli@${MERMAID_CLI_VERSION}" \
  --input "${INPUT_PATH}" \
  --output "${TEMP_OUTPUT}" \
  --theme neutral \
  --backgroundColor white \
  --quiet

if [[ ! -s "${TEMP_OUTPUT}" ]] || ! grep -q '<svg' "${TEMP_OUTPUT}"; then
  printf 'Mermaid CLI did not produce a valid SVG: %s\n' "${OUTPUT_PATH}" >&2
  exit 1
fi

mv "${TEMP_OUTPUT}" "${OUTPUT_PATH}"
printf 'Rendered %s -> %s with Mermaid CLI %s\n' \
  "${INPUT_PATH}" \
  "${OUTPUT_PATH}" \
  "${MERMAID_CLI_VERSION}"
