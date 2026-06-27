#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEFAULT_OUTPUT_PATH="${APP_DIR}/tests/output/asset-tones-openai-audio.jsonl"
HOST_OUTPUT_PATH="${1:-${DEFAULT_OUTPUT_PATH}}"
OPENAI_AUDIO_MODEL="${OPENAI_AUDIO_MODEL:-gpt-audio}"
OPENAI_API_KEY_ENV="${OPENAI_API_KEY_ENV:-OPENAI_API_KEY}"

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

mkdir -p "$(dirname "${HOST_OUTPUT_PATH}")"

log "Running OpenAI audio tone extraction"
log "Host output JSONL: ${HOST_OUTPUT_PATH}"
log "OpenAI audio model: ${OPENAI_AUDIO_MODEL}"

PYTHONDONTWRITEBYTECODE=1 PYTHONPATH="${APP_DIR}/src" \
  uv --directory "${APP_DIR}" run --extra openai python -m tone_embedding extract \
    "${APP_DIR}/examples/audio-manifest.example.json" \
    --out "${HOST_OUTPUT_PATH}" \
    --audio-model openai \
    --openai-audio-model "${OPENAI_AUDIO_MODEL}" \
    --openai-api-key-env "${OPENAI_API_KEY_ENV}"

printf '\nGenerated JSONL:\n'
PYTHONPATH="${APP_DIR}/src" uv --directory "${APP_DIR}" run --extra openai python -c 'from pathlib import Path; import sys; print(Path(sys.argv[1]).read_text())' "${HOST_OUTPUT_PATH}"

log "OpenAI audio tone extraction complete"
