# Audio Tone Model Runbook

This document explains how the current tone app invokes the Essentia audio model, how TensorFlow is wired to the `.pb` files, and how an uploaded audio file becomes normalized tone metadata.

## Runtime Entry Point

For local verification, run the smoke-test script from the repo root:

```bash
./apps/tone-embedding/scripts/run-essentia-audio-test.sh
```

The script writes JSONL asset-tone output to `apps/tone-embedding/tests/output/asset-tones-essentia.jsonl` by default, defined in [`run-essentia-audio-test.sh:7`](apps/tone-embedding/scripts/run-essentia-audio-test.sh#L7).

The script checks for the two local audio demo files and the two required model `.pb` files before running Docker in [`run-essentia-audio-test.sh:31`](apps/tone-embedding/scripts/run-essentia-audio-test.sh#L31)-[`run-essentia-audio-test.sh:34`](apps/tone-embedding/scripts/run-essentia-audio-test.sh#L34).

## Model Files

The setup script downloads four Essentia artifacts into `apps/tone-embedding/models/`:

- `msd-musicnn-1.pb`: the MusiCNN embedding model, downloaded in [`setup-essentia-models.sh:98`](apps/tone-embedding/scripts/setup-essentia-models.sh#L98)-[`setup-essentia-models.sh:101`](apps/tone-embedding/scripts/setup-essentia-models.sh#L101).
- `msd-musicnn-1.json`: metadata for the embedding model, downloaded in [`setup-essentia-models.sh:103`](apps/tone-embedding/scripts/setup-essentia-models.sh#L103)-[`setup-essentia-models.sh:106`](apps/tone-embedding/scripts/setup-essentia-models.sh#L106).
- `deam-msd-musicnn-2.pb`: the DEAM valence/arousal classification head, downloaded in [`setup-essentia-models.sh:108`](apps/tone-embedding/scripts/setup-essentia-models.sh#L108)-[`setup-essentia-models.sh:111`](apps/tone-embedding/scripts/setup-essentia-models.sh#L111).
- `deam-msd-musicnn-2.json`: metadata for the DEAM head, downloaded in [`setup-essentia-models.sh:113`](apps/tone-embedding/scripts/setup-essentia-models.sh#L113)-[`setup-essentia-models.sh:116`](apps/tone-embedding/scripts/setup-essentia-models.sh#L116).

## TensorFlow and Docker Setup

The Docker test image starts from `python:3.11-slim` in [`Dockerfile.essentia-audio-test:1`](apps/tone-embedding/Dockerfile.essentia-audio-test#L1), then installs `essentia-tensorflow` in [`Dockerfile.essentia-audio-test:6`](apps/tone-embedding/Dockerfile.essentia-audio-test#L6)-[`Dockerfile.essentia-audio-test:7`](apps/tone-embedding/Dockerfile.essentia-audio-test#L7).

The smoke-test script builds this image only when missing or when forced with `REBUILD_ESSENTIA_AUDIO_TEST_IMAGE=1`, as shown in [`run-essentia-audio-test.sh:56`](apps/tone-embedding/scripts/run-essentia-audio-test.sh#L56)-[`run-essentia-audio-test.sh:61`](apps/tone-embedding/scripts/run-essentia-audio-test.sh#L61).

The repo is mounted into the container at `/work`, the output path is passed through `OUTPUT_PATH`, and the CLI is run inside the container in [`run-essentia-audio-test.sh:63`](apps/tone-embedding/scripts/run-essentia-audio-test.sh#L63)-[`run-essentia-audio-test.sh:78`](apps/tone-embedding/scripts/run-essentia-audio-test.sh#L78).

## CLI Invocation

The Docker script invokes the Python CLI like this:

```bash
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=apps/tone-embedding/src \
  python -m tone_embedding extract \
    apps/tone-embedding/examples/audio-manifest.example.json \
    --out "${OUTPUT_PATH}" \
    --audio-model essentia \
    --essentia-embedding-model apps/tone-embedding/models/msd-musicnn-1.pb \
    --essentia-valence-arousal-model apps/tone-embedding/models/deam-msd-musicnn-2.pb
```

Those exact arguments are wired in [`run-essentia-audio-test.sh:70`](apps/tone-embedding/scripts/run-essentia-audio-test.sh#L70)-[`run-essentia-audio-test.sh:76`](apps/tone-embedding/scripts/run-essentia-audio-test.sh#L76).

The CLI accepts `--audio-model essentia`, `--essentia-embedding-model`, `--essentia-valence-arousal-model`, and `--essentia-output-range` in [`cli.py:29`](apps/tone-embedding/src/tone_embedding/cli.py#L29)-[`cli.py:50`](apps/tone-embedding/src/tone_embedding/cli.py#L50).

When `extract` runs, the CLI loads the manifest, builds the audio model adapter with the provided model paths, generates asset tone rows, and writes JSONL in [`cli.py:72`](apps/tone-embedding/src/tone_embedding/cli.py#L72)-[`cli.py:86`](apps/tone-embedding/src/tone_embedding/cli.py#L86).

## Asset Row Generation

Default extraction is asset-first. `build_asset_tone_rows()` loops over each manifest asset and chooses the audio adapter for audio assets in [`export.py:19`](apps/tone-embedding/src/tone_embedding/export.py#L19)-[`export.py:31`](apps/tone-embedding/src/tone_embedding/export.py#L31).

Each output row includes:

- `assetId`
- `assetType`
- `source`
- `tone`
- `toneWords`
- `rawScores`
- `model`
- `createdAt`

Those fields are assembled in [`export.py:32`](apps/tone-embedding/src/tone_embedding/export.py#L32)-[`export.py:42`](apps/tone-embedding/src/tone_embedding/export.py#L42).

## Audio Loading

The Essentia adapter is implemented by `EssentiaAudioToneModel` in [`models.py:60`](apps/tone-embedding/src/tone_embedding/models.py#L60)-[`models.py:63`](apps/tone-embedding/src/tone_embedding/models.py#L63).

Before inference, it requires a local file source and verifies that both model paths exist in [`models.py:77`](apps/tone-embedding/src/tone_embedding/models.py#L77)-[`models.py:89`](apps/tone-embedding/src/tone_embedding/models.py#L89).

The adapter imports Essentia's TensorFlow-capable algorithms in [`models.py:91`](apps/tone-embedding/src/tone_embedding/models.py#L91)-[`models.py:96`](apps/tone-embedding/src/tone_embedding/models.py#L96):

- `MonoLoader` loads and resamples the audio file.
- `TensorflowPredictMusiCNN` runs the MusiCNN embedding graph.
- `TensorflowPredict2D` runs the DEAM valence/arousal graph.

The audio file path is passed into `MonoLoader`, resampled to `16000` Hz, and materialized into an audio array in [`models.py:98`](apps/tone-embedding/src/tone_embedding/models.py#L98).

## TensorFlow Graph Invocation

There are two TensorFlow graph calls.

First, the MusiCNN embedding predictor is loaded from `msd-musicnn-1.pb`. The graph filename and output node are configured in [`models.py:118`](apps/tone-embedding/src/tone_embedding/models.py#L118)-[`models.py:124`](apps/tone-embedding/src/tone_embedding/models.py#L124):

```python
constructor(
    graphFilename=str(self.embedding_model),
    output="model/dense/BiasAdd",
)
```

That predictor receives the loaded audio array and returns embeddings in [`models.py:100`](apps/tone-embedding/src/tone_embedding/models.py#L100)-[`models.py:101`](apps/tone-embedding/src/tone_embedding/models.py#L101).

Second, the DEAM valence/arousal predictor is loaded from `deam-msd-musicnn-2.pb`. Its TensorFlow input and output nodes are configured in [`models.py:126`](apps/tone-embedding/src/tone_embedding/models.py#L126)-[`models.py:133`](apps/tone-embedding/src/tone_embedding/models.py#L133):

```python
constructor(
    graphFilename=str(self.valence_arousal_model),
    input="model/Placeholder",
    output="model/Identity",
)
```

That predictor receives the MusiCNN embeddings and returns predictions in [`models.py:102`](apps/tone-embedding/src/tone_embedding/models.py#L102).

The predictor objects are cached on the adapter instance so multiple audio assets in one process do not reload the `.pb` graph files. The cache fields are initialized in [`models.py:74`](apps/tone-embedding/src/tone_embedding/models.py#L74)-[`models.py:75`](apps/tone-embedding/src/tone_embedding/models.py#L75), and the lazy cache methods are [`models.py:118`](apps/tone-embedding/src/tone_embedding/models.py#L118)-[`models.py:133`](apps/tone-embedding/src/tone_embedding/models.py#L133).

## Raw Scores to Tone Values

The DEAM predictor returns a row where the first two values are interpreted as valence and arousal. `read_valence_arousal_values()` reads those values in [`models.py:153`](apps/tone-embedding/src/tone_embedding/models.py#L153)-[`models.py:162`](apps/tone-embedding/src/tone_embedding/models.py#L162).

The default CLI range is `deam`, set in [`cli.py:45`](apps/tone-embedding/src/tone_embedding/cli.py#L45)-[`cli.py:49`](apps/tone-embedding/src/tone_embedding/cli.py#L49). In that mode, DEAM-style `1..9` values are normalized to `-1..1` with `(value - 5) / 4` in [`models.py:170`](apps/tone-embedding/src/tone_embedding/models.py#L170)-[`models.py:171`](apps/tone-embedding/src/tone_embedding/models.py#L171).

The normalized values are mapped into the app's tone vector in [`models.py:103`](apps/tone-embedding/src/tone_embedding/models.py#L103)-[`models.py:116`](apps/tone-embedding/src/tone_embedding/models.py#L116):

- `tone["valence"] = valence`
- `tone["arousal"] = arousal`
- `tone["warmth"] = valence`
- `tone["tension"] = arousal`
- `tone["menace"] = max(0.0, arousal - valence)`

The original model values are preserved as `rawScores` via `ToneExtraction.raw_scores` in [`models.py:113`](apps/tone-embedding/src/tone_embedding/models.py#L113)-[`models.py:116`](apps/tone-embedding/src/tone_embedding/models.py#L116).

## Tone Words

After numeric tone values are produced, `tone_to_words()` converts them into deterministic developer-facing labels. The quadrant mapping starts at [`tone.py:22`](apps/tone-embedding/src/tone_embedding/tone.py#L22), with the primary valence/arousal cases in [`tone.py:37`](apps/tone-embedding/src/tone_embedding/tone.py#L37)-[`tone.py:55`](apps/tone-embedding/src/tone_embedding/tone.py#L55).

For example, low valence and low arousal maps to `subdued`, `calm`, and `melancholic` in [`tone.py:37`](apps/tone-embedding/src/tone_embedding/tone.py#L37)-[`tone.py:40`](apps/tone-embedding/src/tone_embedding/tone.py#L40).

## Current Output Shape

A successful audio extraction row currently looks like this:

```json
{
  "assetId": "audio-demo-00",
  "assetType": "audio",
  "source": {
    "kind": "file",
    "path": "apps/tone-embedding/examples/media/audio-demo-00.mp3"
  },
  "tone": {
    "valence": -0.267608,
    "arousal": -0.30113,
    "warmth": -0.267608,
    "tension": -0.30113,
    "menace": 0.0
  },
  "toneWords": {
    "summary": "A subdued, calm, melancholic tone.",
    "primary": ["subdued", "calm", "melancholic"],
    "secondary": ["restrained", "introspective", "cool", "non-threatening"],
    "avoid": ["joyful", "energetic"]
  },
  "rawScores": {
    "valence": 3.92957,
    "arousal": 3.79548
  },
  "model": {
    "name": "essentia/music-tone",
    "version": "adapter-0.1.0",
    "license": "model-dependent-usually-cc-by-nc-sa-4.0"
  }
}
```

Combo congruence is intentionally not produced here. Upload-time extraction creates reusable tone metadata for one asset. Later combo evaluation should reference an audio asset tone row and a video asset tone row, then compute pairing-specific congruence separately.
