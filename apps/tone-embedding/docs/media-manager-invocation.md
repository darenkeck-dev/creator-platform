# Media Manager Invocation Contract

This document defines the V1 boundary between Media Manager and the tone app. Media Manager is the external orchestrator. The tone app is a CLI tool that reads local staged media files or manifests, runs selected model adapters, and writes versioned analysis artifacts.

## V1 Scope

V1 goals:

- Validate each configured model path emits the expected metadata shape.
- Produce versioned, auditable asset analysis metadata.
- Produce optional `combo-analysis/v1` relationship geometry from existing asset rows.
- Keep input/output stable enough for Media Manager to invoke and manage jobs.

V1 does not include:

- Human review UI.
- Voting flows.
- User-trained combo meaning.
- Combo quality scoring.
- Media Manager storage updates inside the tone app.

Human review, voting, and learned meaning are expected to live in a separate app/workflow later.

## Input Manifest

Media Manager provides a JSON manifest with one or more assets. File paths may be local paths inside the job workspace or S3 sources that a preprocessing step can stage.

```json
{
  "assets": [
    {
      "id": "asset-audio-1",
      "type": "audio",
      "title": "Audio 1",
      "source": {
        "kind": "file",
        "path": "/work/input/audio-1.mp3"
      }
    },
    {
      "id": "asset-video-1",
      "type": "video",
      "title": "Video 1",
      "source": {
        "kind": "file",
        "path": "/work/input/video-1.mp4"
      }
    }
  ],
  "combos": [
    {
      "id": "combo-1",
      "audioId": "asset-audio-1",
      "videoId": "asset-video-1"
    }
  ]
}
```

`combos` is optional. Asset extraction ignores combo definitions. `combo analyze` uses them later.

## Production Setup

Install the project non-editably in the job image or worker checkout so the `tone-embedding` console command works without source-path environment variables:

```bash
uv sync --no-editable --extra openai
```

The `openai` extra includes the primary audio/video path dependencies and is the recommended Lambda-first dependency set.

Containerization remains the preferred future direction for local embedding models such as DINOv2, but the OpenAI-only primary path is intended to be evaluated in Lambda first.

## Single-Asset Analysis Commands

Media Manager should stage originals to local files, then invoke the CLI with explicit asset IDs and output paths.

Audio:

```bash
uv run --no-editable --extra openai tone-embedding analyze audio \
  /work/input/original-audio.mp3 \
  --asset-id asset-audio-1 \
  --out /work/output/asset-analysis.json
```

Video primary path:

```bash
uv run --no-editable --extra openai tone-embedding analyze video \
  /work/input/original-video.mp4 \
  --asset-id asset-video-1 \
  --models primary \
  --out /work/output/asset-analysis.json
```

`--models primary` runs OpenAI video semantic/tone analysis only. DINOv2 embeddings are available later by explicitly running `--models dinov2` or `--video-model dinov2` with the `video` extra.

## Manifest Asset Analysis Command

Media Manager invokes the tone app with explicit model choices and output paths:

```bash
uv run --no-editable --extra openai tone-embedding extract /work/manifest.json \
  --out /work/output/asset-analysis.jsonl \
  --audio-model openai \
  --video-model openai \
  --openai-api-key-env OPENAI_API_KEY
```

Local/open model variants use the same command shape with different adapters:

```bash
uv run --no-editable --extra video tone-embedding extract /work/manifest.json \
  --out /work/output/asset-analysis.jsonl \
  --audio-model essentia \
  --essentia-embedding-model /models/msd-musicnn-1.pb \
  --essentia-valence-arousal-model /models/deam-msd-musicnn-2.pb \
  --video-model siglip
```

Optional embedding-producing runs should set an embedding output directory and use the heavier `video` extra:

```bash
uv run --no-editable --extra video tone-embedding extract /work/manifest.json \
  --out /work/output/asset-analysis.jsonl \
  --video-model dinov2 \
  --embedding-out-dir /work/output/embeddings
```

## Asset Analysis Output

The output is JSONL with one asset row per line. Each row is versioned with `schemaVersion="asset-analysis/v1"`.

```ts
type AssetAnalysisV1 = {
  schemaVersion: "asset-analysis/v1";
  assetId: string;
  assetType: "audio" | "video";
  source: AssetSource;
  toneTaxonomyVersion: "tone-taxonomy/v1";
  tone?: {
    value: ToneVector;
    words: ToneWords;
    contributors: string[];
    taxonomyVersion: "tone-taxonomy/v1";
  };
  embeddings?: Record<string, {
    kind: string;
    path: string;
    model: string;
    dimensions?: number;
  }>;
  modelRuns: ModelRunAnalysis[];
  createdAt: string;
};
```

Every `modelRuns[]` entry records:

- `kind`: `tone`, `embedding`, or `semantic`.
- `model`: model name/version/license metadata.
- `parameters`: adapter parameters needed for reproducibility.
- model-specific output fields such as `tone`, `embedding`, `metadata`, and `rawScores`.

## Expected Model Shapes

Each model path should be validated by checking `modelRuns[].kind`, top-level `tone`/`embeddings`, and schema-specific metadata.

| Adapter | Expected kind | Top-level output | Notes |
|---|---|---|---|
| `placeholder` audio/video | `tone` | `tone.value` | Deterministic smoke path only. |
| `essentia` audio | `tone` | `tone.value` | Direct music valence/arousal plus derived dimensions. |
| `openai` audio | `tone` | `tone.value` | Primary V1 audio tone+semantic path; uses `audio-semantic-tone/v1` metadata with descriptor scores and audible scene meaning. |
| `openai` video | `tone` | `tone.value` | Primary V1 video tone+semantic path; uses `video-semantic-tone/v1` metadata with descriptor scores and scene meaning. |
| `openclip` video | `tone` | `tone.value` | Experimental prompt-pair frame scoring baseline; not part of the primary V1 run. |
| `siglip` video | `tone` | `tone.value` | Experimental prompt-pair frame scoring with `tanh-logit-delta`; not part of the primary V1 run. |
| `qwen-vl` video | `semantic` | no top-level `tone` by itself | Experimental local semantic description path; preserves natural-language scene/tone text. |
| `dinov2` video | `embedding` | `embeddings.dinov2` | Emits bundle-relative `.npy` path when `--embedding-out-dir` is set. |

Combined model evidence should be merged by `assetId` before bundle creation when multiple adapters are run for the same asset.

## Bundle Command

After asset analysis, Media Manager or the job wrapper can create one bundle per asset:

```bash
uv run --no-editable tone-embedding bundle create \
  --analysis /work/output/asset-analysis.jsonl \
  --asset-id asset-video-1 \
  --out /work/output/asset-video-1.tonebundle.tar.gz
```

Bundle manifests use `schema="tone-analysis-bundle/v1"` and include `analysisSchemas`, for example:

```json
{
  "schema": "tone-analysis-bundle/v1",
  "analysisPath": "asset-analysis.jsonl",
  "analysisSchemas": ["asset-analysis/v1"],
  "assetIds": ["asset-video-1"],
    "embeddings": []
  }
```

Embedding paths inside bundles must be bundle-relative when present. They must not be absolute paths or S3 keys.

## Combo Analysis Command

Combo analysis consumes the manifest and existing asset-analysis JSONL. It does not rerun model extraction.

```bash
uv run --no-editable tone-embedding combo analyze /work/manifest.json \
  --analysis /work/output/asset-analysis.jsonl \
  --out /work/output/combo-analysis.jsonl
```

The output rows use `schemaVersion="combo-analysis/v1"` and include descriptive geometry only: `deltaTone`, `absDeltaTone`, `interactionTone`, congruence, contrast, intensity, strongest matches/contrasts, and `nearestNeighborVector`.

## Environment Variables

Local development can use `.env.local`; deployed jobs should inject environment variables directly.

Required for OpenAI adapters:

```bash
OPENAI_API_KEY=...
```

Optional OpenAI config used by scripts or job wrappers:

```bash
OPENAI_MODEL=gpt-5
OPENAI_AUDIO_MODEL=gpt-audio
OPENAI_AUDIO_STRUCTURE_MODEL=gpt-5
OPENAI_API_KEY_ENV=OPENAI_API_KEY
OPENAI_IMAGE_DETAIL=low
OPENAI_VIDEO_FRAME_RATE=1.0
OPENAI_VIDEO_MAX_FRAMES=24
```

Optional Hugging Face config for Qwen/local model paths:

```bash
HF_TOKEN=...
HF_HOME=/work/cache/huggingface
TRANSFORMERS_CACHE=/work/cache/huggingface
```

AWS credentials should come from the job/task IAM role, not static environment variables.

## Media Manager Responsibilities

Media Manager should own:

- Job scheduling and retries.
- Staging original media into the job workspace or providing S3 sources.
- Injecting secrets and non-secret runtime config.
- Uploading `.tonebundle.tar.gz`, JSONL outputs, or derived embeddings to durable storage.
- Storing bundle S3 keys and schema versions on asset metadata.
- Running combo analysis only after both referenced asset analyses exist.

The tone app should own:

- Manifest validation.
- Model invocation.
- Stable versioned metadata output.
- Bundle creation/inspection/extraction.
- Descriptive combo geometry.
