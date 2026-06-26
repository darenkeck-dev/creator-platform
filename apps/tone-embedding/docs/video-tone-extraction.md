# Video Tone Extraction Test Run

This runbook verifies the OpenCLIP video adapter using the local sample video files.

## Inputs

Required local files:

```text
apps/tone-embedding/examples/media/video-demo-00.m4v
apps/tone-embedding/examples/media/video-demo-01.m4v
```

## Docker Test

Start Docker Desktop first. Then run from the repo root:

```bash
./apps/tone-embedding/scripts/run-openclip-video-test.sh
```

Optional custom output path:

```bash
./apps/tone-embedding/scripts/run-openclip-video-test.sh apps/tone-embedding/tests/output/my-video-tone-output.jsonl
```

On first run, the script builds `tone-embedding-openclip-video-test:local` from `Dockerfile.openclip-video-test` with `open_clip_torch`, CPU-only `torch`, `pillow`, and `opencv-python-headless` preinstalled. Later runs reuse that image, run the extractor with `examples/video-manifest.example.json`, write the generated asset-tone JSONL to `apps/tone-embedding/tests/output/asset-tones-openclip-video.jsonl` by default, and print it. `tests/output/` is git-ignored.

The Dockerfile installs PyTorch from the CPU wheel index to avoid large CUDA/NVIDIA packages in local test images.

Force a rebuild after Dockerfile/dependency changes:

```bash
REBUILD_OPENCLIP_VIDEO_TEST_IMAGE=1 ./apps/tone-embedding/scripts/run-openclip-video-test.sh
```

Use a custom image tag:

```bash
OPENCLIP_VIDEO_TEST_IMAGE=my-openclip-test:local ./apps/tone-embedding/scripts/run-openclip-video-test.sh
```

## Direct Command

Inside an environment where the `video` optional dependencies are installed:

```bash
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=apps/tone-embedding/src \
python -m tone_embedding extract \
  apps/tone-embedding/examples/video-manifest.example.json \
  --out apps/tone-embedding/tests/output/asset-tones-openclip-video.jsonl \
  --video-model openclip
```

Optional controls:

```bash
--openclip-model ViT-B-32
--openclip-pretrained laion2b_s34b_b79k
--video-frame-rate 1.0
--video-max-frames 12
```

## How It Works

The adapter samples frames directly from the video file, encodes each frame with OpenCLIP, scores affective prompt pairs such as `warm inviting visual atmosphere` vs `cold distant visual atmosphere`, aggregates scores across frames, and emits a tone model run plus top-level aggregate tone.

## Expected Output Shape

The JSONL file should contain one row per video asset, currently `video-demo-00` and `video-demo-01`:

```json
{
  "assetId": "video-demo-00",
  "assetType": "video",
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
    "contributors": ["openclip/frame-tone"]
  },
  "modelRuns": [
    {
      "kind": "tone",
      "rawScores": {
        "valence.mean": 0.0,
        "valence.min": 0.0,
        "valence.max": 0.0,
        "valence.std": 0.0
      },
      "parameters": {
        "openclipModel": "ViT-B-32",
        "openclipPretrained": "laion2b_s34b_b79k",
        "frameRate": 1.0,
        "maxFrames": 12,
        "promptPairVersion": "video-affect-v1"
      },
      "model": {
        "name": "openclip/frame-tone",
        "version": "adapter-0.1.0",
        "license": "model-dependent"
      }
    }
  ]
}
```

Exact values depend on the OpenCLIP checkpoint and sampled frames.
