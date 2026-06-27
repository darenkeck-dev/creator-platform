#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEFAULT_OUTPUT_PATH="${APP_DIR}/tests/output/asset-tones-qwen-vl-mps-video.jsonl"
HOST_OUTPUT_PATH="${1:-${DEFAULT_OUTPUT_PATH}}"
QWEN_MODEL="${QWEN_MODEL:-Qwen/Qwen2-VL-2B-Instruct}"
QWEN_MAX_NEW_TOKENS="${QWEN_MAX_NEW_TOKENS:-192}"
QWEN_VIDEO_FRAME_RATE="${QWEN_VIDEO_FRAME_RATE:-0.1}"
QWEN_VIDEO_MAX_FRAMES="${QWEN_VIDEO_MAX_FRAMES:-1}"
QWEN_TORCH_DTYPE="${QWEN_TORCH_DTYPE:-float16}"

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

require_file "${APP_DIR}/examples/media/video-demo-00.m4v" "sample video 00"
require_file "${APP_DIR}/examples/media/video-demo-01.m4v" "sample video 01"

if [[ "${HOST_OUTPUT_PATH}" != /* ]]; then
  HOST_OUTPUT_PATH="$(pwd)/${HOST_OUTPUT_PATH}"
fi

mkdir -p "$(dirname "${HOST_OUTPUT_PATH}")"

log "Running Qwen-VL video descriptor extraction with native macOS MPS"
log "Host output JSONL: ${HOST_OUTPUT_PATH}"
log "Qwen model: ${QWEN_MODEL}"
log "Torch dtype: ${QWEN_TORCH_DTYPE}"

if ! command -v uv >/dev/null 2>&1; then
  printf 'uv is required for this native MPS runner. Install it with: curl -LsSf https://astral.sh/uv/install.sh | sh\n' >&2
  exit 1
fi

UV_RUN=(uv --directory "${APP_DIR}" run --extra qwen-mps python)

PYTHONDONTWRITEBYTECODE=1 \
  "${UV_RUN[@]}" - <<'PY'
import torch

if not torch.backends.mps.is_available():
    raise SystemExit("torch MPS is not available in this Python environment")

print("torch:", torch.__version__)
print("mps available:", torch.backends.mps.is_available())
PY

PYTHONDONTWRITEBYTECODE=1 \
  "${UV_RUN[@]}" -m tone_embedding extract \
    "${APP_DIR}/examples/video-manifest.example.json" \
    --out "${HOST_OUTPUT_PATH}" \
    --video-model qwen-vl \
    --qwen-model "${QWEN_MODEL}" \
    --qwen-max-new-tokens "${QWEN_MAX_NEW_TOKENS}" \
    --qwen-torch-dtype "${QWEN_TORCH_DTYPE}" \
    --qwen-device-map mps \
    --video-frame-rate "${QWEN_VIDEO_FRAME_RATE}" \
    --video-max-frames "${QWEN_VIDEO_MAX_FRAMES}"

printf '\nGenerated JSONL:\n'
"${UV_RUN[@]}" -c 'from pathlib import Path; import sys; print(Path(sys.argv[1]).read_text())' "${HOST_OUTPUT_PATH}"

log "Qwen-VL MPS video descriptor extraction complete"
