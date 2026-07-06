#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEFAULT_OUTPUT_PATH="${APP_DIR}/tests/output/asset-analysis-audio-all.jsonl"
HOST_OUTPUT_PATH="${1:-${DEFAULT_OUTPUT_PATH}}"
OPENAI_AUDIO_MODEL="${OPENAI_AUDIO_MODEL:-gpt-audio}"
OPENAI_API_KEY_ENV="${OPENAI_API_KEY_ENV:-OPENAI_API_KEY}"
BUNDLE_OUTPUT_DIR="${AUDIO_ANALYSIS_BUNDLE_DIR:-}"

log() {
  printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$1"
}

require_file() {
  local path="$1"
  local label="$2"

  if [[ ! -s "${path}" ]]; then
    printf 'Missing %s: %s\n' "${label}" "${path}" >&2
    exit 1
  fi
}

if ! command -v uv >/dev/null 2>&1; then
  printf 'uv is required for this runner. Install it with: curl -LsSf https://astral.sh/uv/install.sh | sh\n' >&2
  exit 1
fi

require_file "${APP_DIR}/examples/media/audio-demo-00.mp3" "sample audio 00"
require_file "${APP_DIR}/examples/media/audio-demo-01.mp3" "sample audio 01"

if [[ "${HOST_OUTPUT_PATH}" != /* ]]; then
  HOST_OUTPUT_PATH="$(pwd)/${HOST_OUTPUT_PATH}"
fi

HOST_OUTPUT_DIR="$(dirname "${HOST_OUTPUT_PATH}")"
if [[ -z "${BUNDLE_OUTPUT_DIR}" ]]; then
  BUNDLE_OUTPUT_DIR="${HOST_OUTPUT_DIR}/bundles"
fi

mkdir -p "${HOST_OUTPUT_DIR}"

log "Running primary audio analysis pipeline"
log "Output JSONL: ${HOST_OUTPUT_PATH}"
log "Bundle output dir: ${BUNDLE_OUTPUT_DIR}"
log "OpenAI audio model: ${OPENAI_AUDIO_MODEL}"

uv --directory "${APP_DIR}" run --extra openai tone-embedding extract \
    "${APP_DIR}/examples/audio-manifest.example.json" \
    --out "${HOST_OUTPUT_PATH}" \
    --audio-model openai \
    --openai-audio-model "${OPENAI_AUDIO_MODEL}" \
    --openai-api-key-env "${OPENAI_API_KEY_ENV}"

mkdir -p "${BUNDLE_OUTPUT_DIR}"
while IFS= read -r asset_id; do
  uv --directory "${APP_DIR}" run tone-embedding bundle create \
      --analysis "${HOST_OUTPUT_PATH}" \
      --asset-id "${asset_id}" \
      --out "${BUNDLE_OUTPUT_DIR}/${asset_id}.tonebundle.tar.gz"
done < <(python3 -c 'import json, sys; from pathlib import Path; [print(json.loads(line)["assetId"]) for line in Path(sys.argv[1]).read_text().splitlines()]' "${HOST_OUTPUT_PATH}")

log "Primary audio analysis complete"
log "Asset analysis JSONL available at ${HOST_OUTPUT_PATH}"
log "Bundles available at ${BUNDLE_OUTPUT_DIR}"
