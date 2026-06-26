#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_DIR="$(cd "${APP_DIR}/../.." && pwd)"
DEFAULT_OUTPUT_PATH="${APP_DIR}/tests/output/asset-tones-siglip-video.jsonl"
HOST_OUTPUT_PATH="${1:-${DEFAULT_OUTPUT_PATH}}"
IMAGE_NAME="${SIGLIP_VIDEO_TEST_IMAGE:-tone-embedding-siglip-video-test:local}"
DOCKERFILE="${APP_DIR}/Dockerfile.siglip-video-test"

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

if ! docker info >/dev/null 2>&1; then
  printf 'Docker daemon is not running. Start Docker Desktop, then rerun this script.\n' >&2
  exit 1
fi

require_file "${APP_DIR}/examples/media/video-demo-00.m4v" "sample video 00"
require_file "${APP_DIR}/examples/media/video-demo-01.m4v" "sample video 01"

if [[ "${HOST_OUTPUT_PATH}" != /* ]]; then
  HOST_OUTPUT_PATH="$(pwd)/${HOST_OUTPUT_PATH}"
fi

HOST_OUTPUT_DIR="$(dirname "${HOST_OUTPUT_PATH}")"
HOST_OUTPUT_FILE="$(basename "${HOST_OUTPUT_PATH}")"
mkdir -p "${HOST_OUTPUT_DIR}"

DOCKER_VOLUME_ARGS=(-v "${REPO_DIR}:/work")
if [[ "${HOST_OUTPUT_PATH}" == "${REPO_DIR}/"* ]]; then
  CONTAINER_OUTPUT_PATH="/work/${HOST_OUTPUT_PATH#"${REPO_DIR}/"}"
else
  DOCKER_VOLUME_ARGS+=(-v "${HOST_OUTPUT_DIR}:/tone-output")
  CONTAINER_OUTPUT_PATH="/tone-output/${HOST_OUTPUT_FILE}"
fi

log "Running SigLIP video tone extraction in Docker"
log "Host output JSONL: ${HOST_OUTPUT_PATH}"
log "Docker image: ${IMAGE_NAME}"

if [[ "${REBUILD_SIGLIP_VIDEO_TEST_IMAGE:-0}" == "1" ]] || ! docker image inspect "${IMAGE_NAME}" >/dev/null 2>&1; then
  log "Building Docker image with SigLIP dependencies"
  docker build -f "${DOCKERFILE}" -t "${IMAGE_NAME}" "${APP_DIR}"
else
  log "Using existing Docker image"
fi

docker run --rm \
  "${DOCKER_VOLUME_ARGS[@]}" \
  -w /work \
  -e "OUTPUT_PATH=${CONTAINER_OUTPUT_PATH}" \
  "${IMAGE_NAME}" \
  bash -lc '
    set -euo pipefail
    PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=apps/tone-embedding/src \
      python -m tone_embedding extract \
        apps/tone-embedding/examples/video-manifest.example.json \
        --out "${OUTPUT_PATH}" \
        --video-model siglip
    python -c "import os; from pathlib import Path; path = Path(os.environ[\"OUTPUT_PATH\"]); print(\"\nGenerated JSONL:\"); print(path.read_text())"
  '

log "SigLIP video tone extraction complete"
log "Host JSONL available at ${HOST_OUTPUT_PATH}"
