#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
MODEL_DIR="${APP_DIR}/models"
FORCE=0
TOTAL_STEPS=4
COMPLETED=0

usage() {
  printf 'Usage: %s [--force]\n' "$(basename "$0")"
  printf '\nDownloads Essentia model artifacts into %s\n' "${MODEL_DIR}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --force)
      FORCE=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

mkdir -p "${MODEL_DIR}"

log() {
  printf '[%s] %s\n' "$(date '+%H:%M:%S')" "$1"
}

file_size() {
  local path="$1"

  if [[ ! -e "${path}" ]]; then
    printf '0 bytes'
    return
  fi

  if stat -f%z "${path}" >/dev/null 2>&1; then
    printf '%s bytes' "$(stat -f%z "${path}")"
    return
  fi

  if stat -c%s "${path}" >/dev/null 2>&1; then
    printf '%s bytes' "$(stat -c%s "${path}")"
    return
  fi

  printf 'unknown size'
}

download() {
  local label="$1"
  local url="$2"
  local output="$3"
  local step=$((COMPLETED + 1))

  if [[ -s "${output}" && "${FORCE}" -eq 0 ]]; then
    log "[${step}/${TOTAL_STEPS}] ${label}: already present ($(file_size "${output}"))"
    log "           ${output}"
    COMPLETED=$((COMPLETED + 1))
    return
  fi

  if [[ -e "${output}" && "${FORCE}" -eq 1 ]]; then
    log "[${step}/${TOTAL_STEPS}] ${label}: force re-download requested; replacing $(file_size "${output}")"
  else
    log "[${step}/${TOTAL_STEPS}] ${label}: starting download"
  fi

  log "           source: ${url}"
  log "           target: ${output}"
  log "           curl will retry transient failures up to 3 times"

  local partial="${output}.partial"
  rm -f "${partial}"
  curl -fL --retry 3 --connect-timeout 20 --max-time 300 --progress-bar "${url}" -o "${partial}"
  mv "${partial}" "${output}"

  if [[ ! -s "${output}" ]]; then
    printf 'Downloaded file is empty: %s\n' "${output}" >&2
    exit 1
  fi

  log "[${step}/${TOTAL_STEPS}] ${label}: complete ($(file_size "${output}"))"
  COMPLETED=$((COMPLETED + 1))
}

download \
  "MusiCNN embedding model" \
  "https://essentia.upf.edu/models/feature-extractors/musicnn/msd-musicnn-1.pb" \
  "${MODEL_DIR}/msd-musicnn-1.pb"

download \
  "MusiCNN embedding metadata" \
  "https://essentia.upf.edu/models/feature-extractors/musicnn/msd-musicnn-1.json" \
  "${MODEL_DIR}/msd-musicnn-1.json"

download \
  "DEAM valence/arousal model" \
  "https://essentia.upf.edu/models/classification-heads/deam/deam-msd-musicnn-2.pb" \
  "${MODEL_DIR}/deam-msd-musicnn-2.pb"

download \
  "DEAM valence/arousal metadata" \
  "https://essentia.upf.edu/models/classification-heads/deam/deam-msd-musicnn-2.json" \
  "${MODEL_DIR}/deam-msd-musicnn-2.json"

printf '\nEssentia model setup complete.\n'
printf 'Directory: %s\n' "${MODEL_DIR}"
printf '\nArtifacts:\n'
printf '  - msd-musicnn-1.pb (%s)\n' "$(file_size "${MODEL_DIR}/msd-musicnn-1.pb")"
printf '  - msd-musicnn-1.json (%s)\n' "$(file_size "${MODEL_DIR}/msd-musicnn-1.json")"
printf '  - deam-msd-musicnn-2.pb (%s)\n' "$(file_size "${MODEL_DIR}/deam-msd-musicnn-2.pb")"
printf '  - deam-msd-musicnn-2.json (%s)\n' "$(file_size "${MODEL_DIR}/deam-msd-musicnn-2.json")"
printf '\nThese files are ignored by git and should not be committed unless licensing is reviewed.\n'
