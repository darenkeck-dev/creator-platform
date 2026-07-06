#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEFAULT_OUTPUT_PATH="${APP_DIR}/tests/output/asset-tones-openai-video.jsonl"
HOST_OUTPUT_PATH="${1:-${DEFAULT_OUTPUT_PATH}}"
OPENAI_MODEL="${OPENAI_MODEL:-gpt-5}"
OPENAI_API_KEY_ENV="${OPENAI_API_KEY_ENV:-OPENAI_API_KEY}"
OPENAI_IMAGE_DETAIL="${OPENAI_IMAGE_DETAIL:-low}"
OPENAI_VIDEO_FRAME_RATE="${OPENAI_VIDEO_FRAME_RATE:-1.0}"
OPENAI_VIDEO_MAX_FRAMES="${OPENAI_VIDEO_MAX_FRAMES:-24}"

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

require_file "${APP_DIR}/examples/media/video-demo-00.m4v" "sample video 00"
require_file "${APP_DIR}/examples/media/video-demo-01.m4v" "sample video 01"

if [[ "${HOST_OUTPUT_PATH}" != /* ]]; then
  HOST_OUTPUT_PATH="$(pwd)/${HOST_OUTPUT_PATH}"
fi

mkdir -p "$(dirname "${HOST_OUTPUT_PATH}")"

log "Running OpenAI video tone extraction"
log "Host output JSONL: ${HOST_OUTPUT_PATH}"
log "OpenAI model: ${OPENAI_MODEL}"
log "Frame rate: ${OPENAI_VIDEO_FRAME_RATE}"
log "Max frames: ${OPENAI_VIDEO_MAX_FRAMES}"

uv --directory "${APP_DIR}" run --extra openai tone-embedding extract \
    "${APP_DIR}/examples/video-manifest.example.json" \
    --out "${HOST_OUTPUT_PATH}" \
    --video-model openai \
    --openai-model "${OPENAI_MODEL}" \
    --openai-api-key-env "${OPENAI_API_KEY_ENV}" \
    --openai-image-detail "${OPENAI_IMAGE_DETAIL}" \
    --video-frame-rate "${OPENAI_VIDEO_FRAME_RATE}" \
    --video-max-frames "${OPENAI_VIDEO_MAX_FRAMES}"

printf '\nGenerated JSONL:\n'
uv --directory "${APP_DIR}" run --extra openai python -c 'from pathlib import Path; import sys; print(Path(sys.argv[1]).read_text())' "${HOST_OUTPUT_PATH}"

log "OpenAI video tone extraction complete"
