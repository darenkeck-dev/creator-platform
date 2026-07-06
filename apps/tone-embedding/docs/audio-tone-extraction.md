# Audio Tone Extraction Test Run

This runbook verifies the Essentia audio adapter using the local sample audio files.

## Inputs

Required local files:

```text
apps/tone-embedding/examples/media/audio-demo-00.mp3
apps/tone-embedding/examples/media/audio-demo-01.mp3
apps/tone-embedding/models/msd-musicnn-1.pb
apps/tone-embedding/models/deam-msd-musicnn-2.pb
```

Set up model files with:

```bash
cd apps/tone-embedding
./scripts/setup-essentia-models.sh
```

## Docker Test

Start Docker Desktop first. Then run from the repo root:

```bash
./apps/tone-embedding/scripts/run-essentia-audio-test.sh
```

Optional custom output path:

```bash
./apps/tone-embedding/scripts/run-essentia-audio-test.sh apps/tone-embedding/tests/output/my-tone-output.jsonl
```

On first run, the script builds `tone-embedding-essentia-audio-test:local` from `Dockerfile.essentia-audio-test` with `essentia-tensorflow` preinstalled. Later runs reuse that image, run the extractor with `examples/audio-manifest.example.json`, write the generated asset-tone JSONL to `apps/tone-embedding/tests/output/asset-tones-essentia.jsonl` by default, and print it. `tests/output/` is git-ignored.

Within one extraction process, the Essentia graph predictors are loaded once and reused across audio assets. Running the script again still starts a new Python process, so a fresh process must load the graphs again.

Force a rebuild after Dockerfile/dependency changes:

```bash
REBUILD_ESSENTIA_AUDIO_TEST_IMAGE=1 ./apps/tone-embedding/scripts/run-essentia-audio-test.sh
```

Use a custom image tag:

```bash
ESSENTIA_AUDIO_TEST_IMAGE=my-essentia-test:local ./apps/tone-embedding/scripts/run-essentia-audio-test.sh
```

## Direct Command

Inside an environment where `essentia-tensorflow` is installed:

```bash
uv run --no-editable --extra essentia tone-embedding extract \
  examples/audio-manifest.example.json \
  --out tests/output/asset-tones-essentia.jsonl \
  --audio-model essentia \
  --essentia-embedding-model models/msd-musicnn-1.pb \
  --essentia-valence-arousal-model models/deam-msd-musicnn-2.pb
```

## Expected Output Shape

The JSONL file should contain one row per asset. The exact numbers depend on the model output, but the important fields are:

```json
{
  "assetId": "audio-demo-00",
  "assetType": "audio",
  "tone": {
    "value": {
      "valence": 0.0,
      "arousal": 0.0,
      "warmth": 0.0,
      "tension": 0.0,
      "menace": 0.0
    },
    "words": {
      "summary": "A neutral, balanced tone.",
      "primary": ["neutral", "balanced"],
      "secondary": ["ambiguous"],
      "avoid": []
    },
    "contributors": ["essentia/music-tone"]
  },
  "modelRuns": [
    {
      "kind": "tone",
      "rawScores": {
        "valence": 0.0,
        "arousal": 0.0
      },
      "parameters": {
        "embeddingModel": "apps/tone-embedding/models/msd-musicnn-1.pb",
        "valenceArousalModel": "apps/tone-embedding/models/deam-msd-musicnn-2.pb",
        "outputRange": "deam"
      },
      "model": {
        "name": "essentia/music-tone",
        "version": "adapter-0.1.0",
        "license": "model-dependent-usually-cc-by-nc-sa-4.0"
      }
    }
  ]
}
```

The tone-producing model run stores direct model output in `modelRuns[].rawScores`. Top-level `tone.value` stores normalized `-1..1` aggregate values. The default DEAM head uses `--essentia-output-range deam`, mapping DEAM-style `1..9` values into `-1..1`.

TensorFlow may print CUDA/GPU warnings in the Docker run. They are expected for CPU-only local execution and do not indicate failure if the JSONL is produced.

## Verified Local Output

The Docker test was run against `examples/media/audio-demo-00.mp3` and produced:

```json
{
  "tone": {
    "value": {
      "arousal": -0.30113,
      "beauty": 0.0,
      "dominance": 0.0,
      "instability": 0.0,
      "intimacy": 0.0,
      "menace": 0.0,
      "nostalgia": 0.0,
      "tension": -0.30113,
      "valence": -0.267608,
      "warmth": -0.267608
    },
    "words": {
      "summary": "A subdued, calm, melancholic tone.",
      "primary": ["subdued", "calm", "melancholic"],
      "secondary": ["restrained", "introspective", "cool", "non-threatening"],
      "avoid": ["joyful", "energetic"]
    },
    "contributors": ["essentia/music-tone"]
  },
  "modelRuns": [
    {
      "kind": "tone",
      "rawScores": {
        "arousal": 3.79548,
        "valence": 3.92957
      },
      "parameters": {
        "embeddingModel": "apps/tone-embedding/models/msd-musicnn-1.pb",
        "valenceArousalModel": "apps/tone-embedding/models/deam-msd-musicnn-2.pb",
        "outputRange": "deam"
      }
    }
  ]
}
```

## Timing Notes

Measured on a local M1 Mac using Docker `linux/amd64` containers:

- Former full script with temporary container dependency install: `227.09s` wall time.
- One-time local image build with `essentia-tensorflow` preinstalled: about `69s`.
- Repeat extraction using the prebuilt image: `159.77s` wall time.

These numbers include x86 emulation overhead on Apple Silicon and should be treated as conservative for AWS x86 CPU instances. For AWS, use a baked image with `essentia-tensorflow` and model artifacts already present; do not install Python dependencies at job runtime.

GPU is not automatically useful for this path. The current local run used CPU TensorFlow, and the model is small enough that GPU cost only makes sense after benchmarking a GPU-enabled image on large batches. Start with native x86 CPU Batch/ECS jobs, then compare GPU only if throughput is insufficient.
