# Tone Embedding

Python batch tool for generating versioned tone and semantic metadata for media assets. The primary V1 use is to run an audio pipeline or video pipeline from a manifest, then hand versioned JSONL/bundle artifacts back to Media Manager.

## Primary Outputs

- `asset-analysis/v1`: one JSONL row per asset.
- `tone-analysis-bundle/v1`: one `.tonebundle.tar.gz` per asset, containing `manifest.json` and `asset-analysis.jsonl` plus any bundle-relative embedding files.
- `combo-analysis/v1`: optional descriptive geometry over existing audio/video asset analysis rows.
- `tone-taxonomy/v1`: versioned descriptor vocabulary, dimension mapping, strength scale, and avoid/opposite rules used to interpret user/model keywords.

See `docs/media-manager-invocation.md` for the external invocation contract, schema versions, expected model output shapes, bundle artifacts, environment variables, and Media Manager ownership boundaries.

## Prerequisites

From this directory, install/check the local Python runner:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
uv --version
```

The app requires Python `3.11+`. Sync the local environment with the project installed non-editably so the `tone-embedding` console command works consistently:

```bash
uv sync --no-editable --extra openai
```

Use `uv run --no-editable ...` for CLI commands. This keeps local smoke runs aligned with production/job execution and avoids editable-install path issues after switching install modes.

For OpenAI-backed primary analysis, create `.env.local`:

```bash
OPENAI_API_KEY=sk-...
```

For local smoke examples, place sample files under ignored `examples/media/`:

```text
examples/media/audio-demo-00.mp3
examples/media/audio-demo-01.mp3
examples/media/video-demo-00.m4v
examples/media/video-demo-01.m4v
```

Optional system tools:

- `ffmpeg`: needed for `preprocess --execute` and some local media workflows.
- Docker: only needed for the older standalone Docker smoke scripts.

Useful first checks:

```bash
uv run --no-editable tone-embedding --help
uv run --no-editable --extra openai tone-embedding analyze audio --help
uv run --no-editable --extra openai tone-embedding analyze video --help
```

## Primary Audio Pipeline

Run the Python CLI directly from this directory:

```bash
uv run --no-editable --extra openai tone-embedding analyze audio \
  examples/media/audio-demo-00.mp3 \
  --asset-id audio-demo-00 \
  --out tests/output/audio-demo-00.analysis.json
```

The local smoke wrapper remains available:

```bash
./scripts/run-audio-analysis-test.sh
```

Default output:

```text
tests/output/asset-analysis-audio-all.jsonl
tests/output/bundles/<audioAssetId>.tonebundle.tar.gz
```

The primary audio pipeline uses OpenAI in two steps:

- `OPENAI_AUDIO_MODEL` (`gpt-audio` by default) listens to the audio and produces natural-language audible analysis.
- `OPENAI_AUDIO_STRUCTURE_MODEL` (`gpt-5` by default) converts that analysis into strict `audio-semantic-tone/v1` JSON and calibrated descriptor scores.

The output includes semantic fields such as `audioDescription`, `semanticSummary`, `mood`, `instrumentation`, `vocals`, and `audibleEvidence`, plus descriptor scores mapped into top-level `tone.value`.

Optional custom output path:

```bash
./scripts/run-audio-analysis-test.sh /tmp/asset-analysis-audio.jsonl
```

## Primary Video Pipeline

Run the Python CLI directly from this directory:

```bash
uv run --no-editable --extra openai tone-embedding analyze video \
  examples/media/video-demo-00.m4v \
  --asset-id video-demo-00 \
  --models primary \
  --out tests/output/video-demo-00.analysis.json
```

`--models primary` runs OpenAI video semantic/tone analysis only. DINOv2 remains available as an explicit optional embedding model later. The local smoke wrapper remains available:

```bash
./scripts/run-video-analysis-test.sh
```

Default output:

```text
tests/output/asset-analysis-video-all.jsonl
tests/output/bundles/<videoAssetId>.tonebundle.tar.gz
```

The primary video pipeline runs OpenAI video analysis for `video-semantic-tone/v1`: semantic scene description plus descriptor scores mapped into `tone.value`.

See `docs/video-analysis-pipeline.md` for the full video pipeline shape.

## Manifest Shape

```json
{
  "assets": [
    {
      "id": "audio-1",
      "type": "audio",
      "title": "Audio",
      "source": { "kind": "file", "path": "./media/audio-demo-00.mp3" }
    },
    {
      "id": "video-1",
      "type": "video",
      "title": "Video",
      "source": { "kind": "file", "path": "./media/video-demo-00.m4v" }
    }
  ]
}
```

Relative `file` paths are resolved relative to the manifest file. `--check-files` only checks `file` sources. S3 sources are designed for AWS execution contexts and can be staged by the preprocessing plan with `aws s3 cp` before `ffmpeg` runs.

Local sample media belongs in `examples/media/`. That directory is intentionally ignored.

## Production Invocation

Media Manager should stage original media to local files, invoke this CLI against those local paths, then upload the emitted analysis JSON and bundle artifacts. Production jobs should inject secrets and cache paths through environment variables; they should not rely on `.env.local`.

One-time environment setup in the job image or worker checkout:

```bash
uv sync --no-editable --extra openai
```

Analyze one audio asset:

```bash
uv run --no-editable --extra openai tone-embedding analyze audio \
  /work/input/original-audio.mp3 \
  --asset-id <assetId> \
  --out /work/output/asset-analysis.json
```

Analyze one video asset with the primary V1 video path:

```bash
uv run --no-editable --extra openai tone-embedding analyze video \
  /work/input/original-video.mp4 \
  --asset-id <assetId> \
  --models primary \
  --out /work/output/asset-analysis.json
```

Create the per-asset bundle:

```bash
uv run --no-editable tone-embedding bundle create \
  --analysis /work/output/asset-analysis.json \
  --asset-id <assetId> \
  --out /work/output/<assetId>.tonebundle.tar.gz
```

Expected handoff back to Media Manager:

- `/work/output/asset-analysis.json`
- `/work/output/<assetId>.tonebundle.tar.gz`
- Any embedding files referenced from the bundle manifest, when optional embedding models are run.

The OpenAI-only primary path is intended to be Lambda-friendly. DINOv2 remains available for a later container/Fargate/Batch path when local embedding generation is needed.

## Direct CLI

Common CLI usage from this directory:

```bash
uv run --no-editable tone-embedding manifest validate examples/manifest.example.json
uv run --no-editable tone-embedding manifest validate examples/manifest.example.json --check-files
uv run --no-editable --extra openai tone-embedding analyze audio examples/media/audio-demo-00.mp3 --asset-id audio-demo-00 --out tests/output/audio-demo-00.analysis.json
uv run --no-editable --extra openai tone-embedding analyze video examples/media/video-demo-00.m4v --asset-id video-demo-00 --models primary --out tests/output/video-demo-00.analysis.json
uv run --no-editable tone-embedding combo build --audio-analysis tests/output/audio-demo-00.analysis.json --video-analysis tests/output/video-demo-00.analysis.json --combo-id combo-demo-00 --out tests/output/combo-demo-00.analysis.json
uv run --no-editable tone-embedding neighbors query --combo-analysis tests/output/combo-demo-00.analysis.json --candidates tests/output/combo-analysis.jsonl --top-k 20
uv run --no-editable --extra openai tone-embedding extract examples/audio-manifest.example.json --out outputs/audio.jsonl --audio-model openai
uv run --no-editable --extra openai tone-embedding extract examples/video-manifest.example.json --out outputs/video.jsonl --video-model openai --video-frame-rate 1.0
uv run --no-editable --extra video tone-embedding extract examples/video-manifest.example.json --out outputs/video-embeddings.jsonl --video-model dinov2 --embedding-out-dir outputs/embeddings
uv run --no-editable tone-embedding bundle create --analysis outputs/video.jsonl --asset-id video-1 --out outputs/video-1.tonebundle.tar.gz
```

`analyze audio` and `analyze video` write a single JSON asset-analysis object for direct file workflows. `extract` remains the manifest/JSONL batch path.

## Environment

Local development can use `.env.local`:

```bash
OPENAI_API_KEY=sk-...
```

Useful overrides:

```bash
OPENAI_MODEL=gpt-5
OPENAI_AUDIO_MODEL=gpt-audio
OPENAI_AUDIO_STRUCTURE_MODEL=gpt-5
OPENAI_API_KEY_ENV=OPENAI_API_KEY
OPENAI_IMAGE_DETAIL=low
OPENAI_VIDEO_FRAME_RATE=1.0
OPENAI_VIDEO_MAX_FRAMES=24
```

Deployed jobs should inject secrets directly and use an IAM role for S3 access, not static AWS credentials.

## Dependency Extras

Dependencies are listed in `pyproject.toml` optional extras:

- `openai`: OpenAI audio/video primary path dependencies.
- `video`: local experimental video stack dependencies plus DINOv2 dependencies.
- `qwen-mps`: native macOS Qwen/MPS dependencies for the experimental Qwen path.
- `essentia`: Essentia/TensorFlow audio baseline dependency.

Use `uv` from this directory:

```bash
uv run --no-editable --extra openai tone-embedding --help
uv run --no-editable --extra video tone-embedding --help
uv run --no-editable --extra qwen-mps tone-embedding --help
```

## Combo Analysis

Combo analysis is not part of upload-time asset extraction. It references existing audio and video asset analysis rows and computes descriptive relationship geometry only: `deltaTone`, `absDeltaTone`, `interactionTone`, congruence, contrast, intensity, strongest matches/contrasts, and a nearest-neighbor vector.

```bash
uv run --no-editable tone-embedding combo analyze examples/manifest.example.json --analysis outputs/asset-analysis.jsonl --out outputs/combo-analysis.jsonl
```

No V1 combo output is a quality score or learned meaning. See `docs/combo-scoring-system.md`.

## Local Neighbor Lookup

`neighbors query` is a local development check for cosine similarity over `nearestNeighborVector`. Production lookup should use Media Manager plus a real vector database later. See `VECTOR_DB_PREP_PLAN.md` for the backend-agnostic prep plan.

## Experimental And Standalone Runs

These adapters remain available for comparison, local experiments, or baseline checks, but they are not part of the primary V1 audio/video pipelines.

### Essentia Audio Baseline

```bash
./scripts/setup-essentia-models.sh
./scripts/run-essentia-audio-test.sh
```

Essentia provides local coarse valence/arousal-style music mood scores. See `docs/audio-tone-extraction.md`.

### OpenCLIP Video Baseline

```bash
./scripts/run-openclip-video-test.sh
```

OpenCLIP is a prompt-pair frame scoring baseline. It has been weak/near-neutral on current demo clips. See `docs/video-tone-extraction.md`.

### SigLIP Video Baseline

```bash
./scripts/run-siglip-video-test.sh
```

SigLIP is a stronger local prompt-pair experiment than OpenCLIP, but it is not the primary V1 path.

### Qwen-VL Local Semantic Option

```bash
./scripts/run-qwen-vl-mps-test.sh
```

Qwen-VL emits natural-language scene/tone description only. It does not produce canonical tone values. The Docker CPU path remains available as a standalone correctness smoke test:

```bash
./scripts/run-qwen-vl-video-test.sh
```

### DINOv2 Standalone Embeddings

```bash
./scripts/run-dinov2-video-test.sh
```

DINOv2 emits visual embeddings only. See `docs/dinov2-video-embeddings.md`.

### OpenAI Model-Specific Smoke Scripts

The primary scripts above are preferred, but model-specific smoke scripts remain available:

```bash
./scripts/run-openai-audio-test.sh
./scripts/run-openai-video-test.sh
```

## Tone Words

Tone-producing exports include `tone.words` for developer verification only. These labels are deterministic summaries derived from the current tone vector, not end-user ratings or ground truth. See `docs/tone-terms.md`.

## Tone Taxonomy

The long-lived descriptor contract lives in `src/tone_embedding/taxonomies/tone-taxonomy.v1.json`. Current asset and combo outputs include `toneTaxonomyVersion` so future keyword/mapping changes can be migrated or recomputed explicitly.

## Schemas

Contract schema fixtures live in `schemas/`:

- `schemas/asset-analysis.v1.schema.json`
- `schemas/tone-taxonomy.v1.schema.json`

The test suite validates generated fixture rows and the packaged taxonomy against these schema contracts.

## Tests

```bash
uv run python -m unittest discover -s tests
```
