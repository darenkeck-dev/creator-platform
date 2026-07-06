# DINOv2 Video Embedding Test Run

This runbook verifies the DINOv2 video adapter using the local sample video files.

## Inputs

Required local files:

```text
apps/tone-embedding/examples/media/video-demo-00.m4v
apps/tone-embedding/examples/media/video-demo-01.m4v
```

## Docker Test

Start Docker Desktop first. Then run from the repo root:

```bash
./apps/tone-embedding/scripts/run-dinov2-video-test.sh
```

Optional custom output path:

```bash
./apps/tone-embedding/scripts/run-dinov2-video-test.sh apps/tone-embedding/tests/output/my-dinov2-output.jsonl
```

On first run, the script builds `tone-embedding-dinov2-video-test:local` from `Dockerfile.dinov2-video-test` with CPU-only `torch`/`torchvision`, `transformers`, `numpy`, `pillow`, and `opencv-python-headless` preinstalled. Later runs reuse that image, run the extractor with `examples/video-manifest.example.json`, write JSONL to `apps/tone-embedding/tests/output/asset-tones-dinov2-video.jsonl`, and write `.npy` embeddings under `apps/tone-embedding/tests/output/embeddings/` by default.

The Dockerfile installs PyTorch from the CPU wheel index to avoid large CUDA/NVIDIA packages in local test images. If a previous build failed with `No space left on device` while installing `nvidia-*` packages, reclaim Docker Desktop space before retrying.

```bash
docker builder prune
```

Force a rebuild after Dockerfile/dependency changes:

```bash
REBUILD_DINOV2_VIDEO_TEST_IMAGE=1 ./apps/tone-embedding/scripts/run-dinov2-video-test.sh
```

Use a custom embedding directory. JSON output still uses bundle-relative paths like `embeddings/video-demo-00/dinov2.npy`:

```bash
DINOV2_EMBEDDING_DIR=/tmp/dinov2-embeddings ./apps/tone-embedding/scripts/run-dinov2-video-test.sh
```

## Direct Command

Inside an environment where the `video` optional dependencies are installed:

```bash
uv run --extra video tone-embedding extract \
  examples/video-manifest.example.json \
  --out tests/output/asset-tones-dinov2-video.jsonl \
  --video-model dinov2 \
  --embedding-out-dir tests/output/embeddings
```

Optional controls:

```bash
--dinov2-model facebook/dinov2-small
--video-frame-rate 1.0
--video-max-frames 12
```

## How It Works

The adapter samples frames directly from the video file, encodes each frame with DINOv2, normalizes the frame embeddings, averages them into one video embedding, writes that embedding to `.npy`, and emits embedding stats in the asset analysis row.

DINOv2 is not text-aligned, so it does not directly emit tone dimensions like `warmth` or `menace`. The current adapter stores the DINOv2 signal under `embeddings` and `modelRuns`; it does not emit top-level `tone`. This embedding is intended for clustering, similarity, and later calibration against human combo ratings.

## Expected Output Shape

The JSONL file should contain one row per video asset:

```json
{
  "assetId": "video-demo-00",
  "assetType": "video",
  "embeddings": {
    "dinov2": {
      "kind": "dinov2",
      "path": "embeddings/video-demo-00/dinov2.npy",
      "dimensions": 384,
      "model": "dinov2/frame-embedding"
    }
  },
  "modelRuns": [
    {
      "kind": "embedding",
      "embedding": {
        "kind": "dinov2",
        "path": "embeddings/video-demo-00/dinov2.npy",
        "dimensions": 384,
        "model": "dinov2/frame-embedding"
      },
      "rawScores": {
        "frameCount": 12.0,
        "embeddingDim": 384.0,
        "embeddingNorm": 1.0,
        "frameEmbeddingNormMean": 1.0,
        "frameEmbeddingNormStd": 0.0
      },
      "parameters": {
        "dinov2Model": "facebook/dinov2-small",
        "frameRate": 1.0,
        "maxFrames": 12,
        "embeddingDim": 384
      },
      "model": {
        "name": "dinov2/frame-embedding",
        "version": "adapter-0.1.0",
        "license": "model-dependent-apache-2.0-for-facebook-dinov2"
      }
    }
  ]
}
```

Exact values depend on the DINOv2 checkpoint and sampled frames.
