# Video Analysis Pipeline Test Run

This runbook verifies the upload-style video analysis flow: run the primary V1 OpenAI video analysis, produce one asset analysis row per video, and package each asset's JSONL row into one tone bundle per asset.

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

- `run-openai-video-test.sh` to generate structured tone values plus semantic scene metadata.

The primary pipeline intentionally does not run DINOv2, OpenCLIP, SigLIP, or Qwen-VL. Those adapters remain available as standalone experimental/local comparison paths, and DINOv2 can be added later as an explicit embedding pass outside the Lambda-first path.

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
apps/tone-embedding/tests/output/asset-analysis-video-all.openai.jsonl
```

## Combined Shape

Each row contains semantic+tone metadata from OpenAI. OpenAI `descriptorScores` are mapped into the top-level tone vector, while OpenAI semantic fields explain what is visible and why the scene feels that way:

```json
{
  "assetId": "video-demo-00",
  "assetType": "video",
  "schemaVersion": "asset-analysis/v1",
  "tone": {
    "value": {},
    "words": {},
    "contributors": ["openai/video-tone-descriptors"]
  },
  "modelRuns": [
    {
      "kind": "tone",
      "model": { "name": "openai/video-tone-descriptors" },
      "parameters": {
        "frameRate": 1.0,
        "maxFrames": 24,
        "openaiModel": "gpt-5",
        "schemaVersion": "video-semantic-tone/v1"
      },
      "metadata": {
        "sceneDescription": "Natural-language scene description.",
        "semanticSummary": "Short human-readable meaning summary.",
        "descriptorScores": [],
        "targetStructuredSchema": "video-semantic-tone/v1"
      }
    }
  ]
}
```

This is the current Lambda-first target for video asset upload: one asset analysis record with OpenAI semantic/tone evidence attached.

## Bundle Shape

Each `.tonebundle.tar.gz` contains only one asset's analysis row. Optional embedding files are included only when an embedding model was explicitly run:

```text
manifest.json
asset-analysis.jsonl
```

The media workflow can upload the asset's bundle file and store its S3 key on that asset's metadata. The tone app can later inspect or extract it:

```bash
uv run --no-editable tone-embedding bundle inspect tests/output/bundles/video-demo-00.tonebundle.tar.gz
uv run --no-editable tone-embedding bundle extract tests/output/bundles/video-demo-00.tonebundle.tar.gz --out-dir /tmp/tone-bundle
```
