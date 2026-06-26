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
HOST_OUTPUT_FILE="$(basename "${HOST_OUTPUT_PATH}")"
OPENCLIP_OUTPUT_PATH="${HOST_OUTPUT_DIR}/${HOST_OUTPUT_FILE%.jsonl}.openclip.jsonl"
SIGLIP_OUTPUT_PATH="${HOST_OUTPUT_DIR}/${HOST_OUTPUT_FILE%.jsonl}.siglip.jsonl"
QWEN_VL_OUTPUT_PATH="${HOST_OUTPUT_DIR}/${HOST_OUTPUT_FILE%.jsonl}.qwen-vl.jsonl"
DINOV2_OUTPUT_PATH="${HOST_OUTPUT_DIR}/${HOST_OUTPUT_FILE%.jsonl}.dinov2.jsonl"
BUNDLE_OUTPUT_DIR="${VIDEO_ANALYSIS_BUNDLE_DIR:-${HOST_OUTPUT_DIR}/bundles}"
DINOV2_EMBEDDING_DIR="${DINOV2_EMBEDDING_DIR:-${HOST_OUTPUT_DIR}/embeddings}"

mkdir -p "${HOST_OUTPUT_DIR}"

log "Running all video analysis models"
log "Combined output JSONL: ${HOST_OUTPUT_PATH}"
log "OpenCLIP output JSONL: ${OPENCLIP_OUTPUT_PATH}"
log "SigLIP output JSONL: ${SIGLIP_OUTPUT_PATH}"
log "Qwen-VL output JSONL: ${QWEN_VL_OUTPUT_PATH}"
log "DINOv2 output JSONL: ${DINOV2_OUTPUT_PATH}"
log "DINOv2 embedding dir: ${DINOV2_EMBEDDING_DIR}"
log "Bundle output dir: ${BUNDLE_OUTPUT_DIR}"

"${SCRIPT_DIR}/run-openclip-video-test.sh" "${OPENCLIP_OUTPUT_PATH}"
"${SCRIPT_DIR}/run-siglip-video-test.sh" "${SIGLIP_OUTPUT_PATH}"
"${SCRIPT_DIR}/run-qwen-vl-video-test.sh" "${QWEN_VL_OUTPUT_PATH}"
DINOV2_EMBEDDING_DIR="${DINOV2_EMBEDDING_DIR}" "${SCRIPT_DIR}/run-dinov2-video-test.sh" "${DINOV2_OUTPUT_PATH}"

OPENCLIP_OUTPUT_PATH="${OPENCLIP_OUTPUT_PATH}" \
SIGLIP_OUTPUT_PATH="${SIGLIP_OUTPUT_PATH}" \
QWEN_VL_OUTPUT_PATH="${QWEN_VL_OUTPUT_PATH}" \
DINOV2_OUTPUT_PATH="${DINOV2_OUTPUT_PATH}" \
HOST_OUTPUT_PATH="${HOST_OUTPUT_PATH}" \
python3 - <<'PY'
import json
import os
from pathlib import Path


def read_rows(path: Path) -> dict[str, dict]:
    rows: dict[str, dict] = {}
    with path.open("r", encoding="utf-8") as file:
        for line in file:
            row = json.loads(line)
            rows[row["assetId"]] = row
    return rows


openclip_rows = read_rows(Path(os.environ["OPENCLIP_OUTPUT_PATH"]))
siglip_rows = read_rows(Path(os.environ["SIGLIP_OUTPUT_PATH"]))
qwen_vl_rows = read_rows(Path(os.environ["QWEN_VL_OUTPUT_PATH"]))
dinov2_rows = read_rows(Path(os.environ["DINOV2_OUTPUT_PATH"]))
output_path = Path(os.environ["HOST_OUTPUT_PATH"])
output_path.parent.mkdir(parents=True, exist_ok=True)

asset_ids = sorted(set(openclip_rows) | set(siglip_rows) | set(qwen_vl_rows) | set(dinov2_rows))
with output_path.open("w", encoding="utf-8") as file:
    for asset_id in asset_ids:
        openclip_row = openclip_rows.get(asset_id)
        siglip_row = siglip_rows.get(asset_id)
        qwen_vl_row = qwen_vl_rows.get(asset_id)
        embedding_row = dinov2_rows.get(asset_id)
        base = qwen_vl_row or siglip_row or openclip_row or embedding_row
        if base is None:
            continue

        combined = {
            "assetId": asset_id,
            "assetType": base["assetType"],
            "source": base["source"],
            "modelRuns": [],
            "createdAt": base["createdAt"],
        }
        for tone_row in (openclip_row, siglip_row, qwen_vl_row):
            if tone_row:
                if "tone" in tone_row:
                    combined["tone"] = tone_row["tone"]
                combined["modelRuns"].extend(tone_row.get("modelRuns", []))
        if embedding_row and "embeddings" in embedding_row:
            combined["embeddings"] = embedding_row["embeddings"]
            combined["modelRuns"].extend(embedding_row.get("modelRuns", []))

        file.write(json.dumps(combined, sort_keys=True) + "\n")

print(f"\nCombined JSONL:")
print(output_path.read_text())
PY

mkdir -p "${BUNDLE_OUTPUT_DIR}"
while IFS= read -r asset_id; do
  PYTHONDONTWRITEBYTECODE=1 PYTHONPATH="${APP_DIR}/src" \
    python3 -m tone_embedding bundle create \
      --analysis "${HOST_OUTPUT_PATH}" \
      --asset-id "${asset_id}" \
      --out "${BUNDLE_OUTPUT_DIR}/${asset_id}.tonebundle.tar.gz"
done < <(python3 -c 'import json, sys; from pathlib import Path; [print(json.loads(line)["assetId"]) for line in Path(sys.argv[1]).read_text().splitlines()]' "${HOST_OUTPUT_PATH}")

log "All video analysis models complete"
log "Combined JSONL available at ${HOST_OUTPUT_PATH}"
log "Bundles available at ${BUNDLE_OUTPUT_DIR}"
