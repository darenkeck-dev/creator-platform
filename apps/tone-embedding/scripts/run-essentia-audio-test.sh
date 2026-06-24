#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
REPO_DIR="$(cd "${APP_DIR}/../.." && pwd)"
OUTPUT_PATH="${1:-/tmp/tone-training-essentia.jsonl}"
IMAGE_NAME="${ESSENTIA_AUDIO_TEST_IMAGE:-tone-embedding-essentia-audio-test:local}"
DOCKERFILE="${APP_DIR}/Dockerfile.essentia-audio-test"

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

require_file "${APP_DIR}/examples/media/audio-demo.mp3" "sample audio"
require_file "${APP_DIR}/models/msd-musicnn-1.pb" "MusiCNN embedding model"
require_file "${APP_DIR}/models/deam-msd-musicnn-2.pb" "DEAM valence/arousal model"

log "Running Essentia audio tone extraction in Docker"
log "Output JSONL: ${OUTPUT_PATH}"
log "Docker image: ${IMAGE_NAME} (linux/amd64)"

if [[ "${REBUILD_ESSENTIA_AUDIO_TEST_IMAGE:-0}" == "1" ]] || ! docker image inspect "${IMAGE_NAME}" >/dev/null 2>&1; then
  log "Building Docker image with essentia-tensorflow preinstalled"
  docker build --platform linux/amd64 -f "${DOCKERFILE}" -t "${IMAGE_NAME}" "${APP_DIR}"
else
  log "Using existing Docker image"
fi

docker run --rm --platform linux/amd64 \
  -v "${REPO_DIR}:/work" \
  -w /work \
  "${IMAGE_NAME}" \
  bash -lc "
    set -euo pipefail
    PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=apps/tone-embedding/src \
      python -m tone_embedding extract \
        apps/tone-embedding/examples/manifest.example.json \
        --out '${OUTPUT_PATH}' \
        --audio-model essentia \
        --essentia-embedding-model apps/tone-embedding/models/msd-musicnn-1.pb \
        --essentia-valence-arousal-model apps/tone-embedding/models/deam-msd-musicnn-2.pb
    python - <<'PY'
from pathlib import Path
path = Path('${OUTPUT_PATH}')
print('\nGenerated JSONL:')
print(path.read_text())
PY
  "

log "Essentia audio tone extraction complete"
