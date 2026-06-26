# Video Analysis Pipeline Test Run

This runbook verifies the upload-style video analysis flow: run every configured video analysis model, merge their outputs into one asset analysis row per video, and package each asset's JSONL row plus embeddings into one tone bundle per asset.

## Run

From the repo root:

```bash
./apps/tone-embedding/scripts/run-video-analysis-test.sh
```

Optional custom combined output path:

```bash
./apps/tone-embedding/scripts/run-video-analysis-test.sh apps/tone-embedding/tests/output/my-video-analysis.jsonl
```

The script runs:

- `run-openclip-video-test.sh` to generate tone metadata.
- `run-siglip-video-test.sh` to generate stronger prompt-pair tone metadata.
- `run-qwen-vl-video-test.sh` to generate qualitative scene/tone descriptor metadata.
- `run-dinov2-video-test.sh` to generate DINOv2 embeddings.
- A merge step that combines model runs by `assetId`.

## Outputs

Default combined output:

```text
apps/tone-embedding/tests/output/asset-analysis-video-all.jsonl
```

Default bundle outputs:

```text
apps/tone-embedding/tests/output/bundles/video-demo-00.tonebundle.tar.gz
apps/tone-embedding/tests/output/bundles/video-demo-01.tonebundle.tar.gz
```

Intermediate outputs:

```text
apps/tone-embedding/tests/output/asset-analysis-video-all.openclip.jsonl
apps/tone-embedding/tests/output/asset-analysis-video-all.siglip.jsonl
apps/tone-embedding/tests/output/asset-analysis-video-all.qwen-vl.jsonl
apps/tone-embedding/tests/output/asset-analysis-video-all.dinov2.jsonl
apps/tone-embedding/tests/output/embeddings/<assetId>/dinov2.npy
```

## Combined Shape

Each combined row contains tone metadata from OpenCLIP and SigLIP, semantic descriptor metadata from Qwen-VL, and embedding metadata from DINOv2. SigLIP tone values are positive-vs-negative raw logit deltas transformed with `tanh(delta / 4.0)`. Qwen-VL output is preserved as raw semantic metadata and is not parsed directly into tone scores:

```json
{
  "assetId": "video-demo-00",
  "assetType": "video",
  "tone": {
    "value": {},
    "words": {},
    "contributors": ["qwen-vl/scene-tone"]
  },
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
      "kind": "tone",
      "model": { "name": "openclip/frame-tone" },
      "parameters": {
        "openclipModel": "ViT-B-32",
        "openclipPretrained": "laion2b_s34b_b79k",
        "frameRate": 1.0,
        "maxFrames": 12,
        "promptPairVersion": "video-affect-v1"
      }
    },
    {
      "kind": "tone",
      "model": { "name": "siglip/frame-tone" },
      "parameters": {
        "siglipModel": "google/siglip-base-patch16-224",
        "frameRate": 1.0,
        "maxFrames": 12,
        "promptPairVersion": "video-affect-v1",
        "scoreTransform": "tanh-logit-delta",
        "scoreTemperature": 4.0
      }
    },
    {
      "kind": "semantic",
      "model": { "name": "qwen-vl/scene-tone" },
      "parameters": {
        "qwenModel": "Qwen/Qwen2.5-VL-7B-Instruct",
        "frameRate": 0.5,
        "maxFrames": 6,
        "maxNewTokens": 512,
        "torchDtype": "auto",
        "deviceMap": "auto",
        "promptVersion": "video-tone-descriptors-v1"
      },
      "metadata": {
        "response": "- strong warmth:cold\n- medium instability:unstable\nRationale: The scene feels cool and unsettled.",
        "targetStructuredSchema": "tone-descriptors/v1"
      }
    },
    {
      "kind": "embedding",
      "model": { "name": "dinov2/frame-embedding" },
      "parameters": {
        "dinov2Model": "facebook/dinov2-small",
        "frameRate": 1.0,
        "maxFrames": 12,
        "embeddingDim": 384
      }
    }
  ]
}
```

This is the closest current local test to what video asset upload should produce: one asset analysis record with all model evidence attached.

## Bundle Shape

Each `.tonebundle.tar.gz` contains only one asset's analysis row and that asset's embedding files:

```text
manifest.json
asset-analysis.jsonl
embeddings/<assetId>/dinov2.npy
```

The media workflow can upload the asset's bundle file and store its S3 key on that asset's metadata. The tone app can later inspect or extract it:

```bash
PYTHONPATH=apps/tone-embedding/src python -m tone_embedding bundle inspect apps/tone-embedding/tests/output/bundles/video-demo-00.tonebundle.tar.gz
PYTHONPATH=apps/tone-embedding/src python -m tone_embedding bundle extract apps/tone-embedding/tests/output/bundles/video-demo-00.tonebundle.tar.gz --out-dir /tmp/tone-bundle
```
