#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEFAULT_OUTPUT_PATH="${APP_DIR}/tests/output/asset-analysis-video-all.jsonl"
HOST_OUTPUT_PATH="${1:-${DEFAULT_OUTPUT_PATH}}"

log() {
  printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$1"
}

if [[ "${HOST_OUTPUT_PATH}" != /* ]]; then
  HOST_OUTPUT_PATH="$(pwd)/${HOST_OUTPUT_PATH}"
fi

HOST_OUTPUT_DIR="$(dirname "${HOST_OUTPUT_PATH}")"
BUNDLE_OUTPUT_DIR="${VIDEO_ANALYSIS_BUNDLE_DIR:-${HOST_OUTPUT_DIR}/bundles}"

mkdir -p "${HOST_OUTPUT_DIR}"

log "Running primary OpenAI video analysis"
log "Output JSONL: ${HOST_OUTPUT_PATH}"
log "Bundle output dir: ${BUNDLE_OUTPUT_DIR}"

"${SCRIPT_DIR}/run-openai-video-test.sh" "${HOST_OUTPUT_PATH}"

mkdir -p "${BUNDLE_OUTPUT_DIR}"
while IFS= read -r asset_id; do
  uv --directory "${APP_DIR}" run tone-embedding bundle create \
    --analysis "${HOST_OUTPUT_PATH}" \
    --asset-id "${asset_id}" \
    --out "${BUNDLE_OUTPUT_DIR}/${asset_id}.tonebundle.tar.gz"
done < <(python3 -c 'import json, sys; from pathlib import Path; [print(json.loads(line)["assetId"]) for line in Path(sys.argv[1]).read_text().splitlines()]' "${HOST_OUTPUT_PATH}")

log "Primary OpenAI video analysis complete"
log "Asset analysis JSONL available at ${HOST_OUTPUT_PATH}"
log "Bundles available at ${BUNDLE_OUTPUT_DIR}"
