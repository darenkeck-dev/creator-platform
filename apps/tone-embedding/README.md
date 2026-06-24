# Tone Embedding

Python app skeleton for generating audio/video tone data and combo training rows.

This is the first implementation slice from `TONE_EMBEDDING_APP_PLAN.md`. It intentionally keeps model extraction behind adapters so the app can run locally without downloading model weights.

## Current Capabilities

- Load a JSON media manifest with local file or S3 original sources.
- Validate audio, video, and combo references.
- Optionally verify local file sources exist.
- Build deterministic placeholder tone vectors for audio/video assets.
- Select an optional Essentia audio adapter for music valence/arousal extraction.
- Add deterministic dev-only tone descriptors for quick output verification.
- Compute combo congruence over shared tone dimensions.
- Export append-only JSONL training rows.
- Generate `ffmpeg` preprocessing commands and optionally execute them.

## Manifest Shape

```json
{
  "assets": [
    {
      "id": "audio-1",
      "type": "audio",
      "title": "Audio",
      "source": { "kind": "file", "path": "./media/audio-demo.mp3" }
    },
    {
      "id": "video-1",
      "type": "video",
      "title": "Video",
      "source": { "kind": "file", "path": "./media/video-demo.m4v" }
    }
  ],
  "combos": [
    { "id": "combo-1", "audioId": "audio-1", "videoId": "video-1" }
  ]
}
```

## Usage

From this directory:

```bash
PYTHONPATH=src python -m tone_embedding manifest validate examples/manifest.example.json
PYTHONPATH=src python -m tone_embedding manifest validate examples/manifest.example.json --check-files
PYTHONPATH=src python -m tone_embedding extract examples/manifest.example.json --out outputs/training.jsonl
PYTHONPATH=src python -m tone_embedding extract examples/manifest.example.json --out outputs/training.jsonl --audio-model essentia --essentia-embedding-model ./models/msd-musicnn-1.pb --essentia-valence-arousal-model ./models/deam-msd-musicnn-2.pb
PYTHONPATH=src python -m tone_embedding preprocess examples/manifest.example.json --out-dir outputs/preprocessed
PYTHONPATH=src python -m tone_embedding preprocess examples/manifest.example.json --out-dir outputs/preprocessed --execute
```

Relative `file` paths are resolved relative to the manifest file. `--check-files` only checks `file` sources. S3 sources are designed for AWS execution contexts and are staged by the preprocessing plan with `aws s3 cp` before `ffmpeg` runs.

Local sample media belongs in `examples/media/`. That directory is intentionally ignored so publishable branches do not include media files by default.

## Init Steps

From `apps/tone-embedding/`:

```bash
bash scripts/setup-essentia-models.sh
PYTHONPATH=src python -m tone_embedding manifest validate examples/manifest.example.json --check-files
PYTHONPATH=src python -m tone_embedding preprocess examples/manifest.example.json --out-dir outputs/preprocessed --execute
```

The setup script downloads Essentia model artifacts into `models/`. That directory is ignored by git.

## Essentia Audio Adapter

`--audio-model essentia` is optional and requires local Essentia model artifacts plus the `essentia-tensorflow` package. The app records the adapter/model metadata in exported rows, but model weights are not vendored in this repo.

Expected setup:

- Install `essentia-tensorflow` in the Python environment.
- Download the chosen Essentia music embedding model and valence/arousal head with `bash scripts/setup-essentia-models.sh`.
- Pass both paths with `--essentia-embedding-model` and `--essentia-valence-arousal-model`.
- Use `--essentia-output-range deam` for the default DEAM head, `unit` for heads that emit `0..1`, or `bipolar` for heads that already emit `-1..1`.

If the package or model file is missing, extraction fails with a setup error instead of silently falling back.

For the full Docker-based smoke test, see `docs/audio-tone-extraction.md`.

The Docker smoke test auto-builds and reuses a local `tone-embedding-essentia-audio-test:local` image so `essentia-tensorflow` is not installed on every run.

## Tone Words

Exports include `audioToneWords` and `videoToneWords` for developer verification only. These descriptors are deterministic labels derived from the current tone vector; they are not end-user ratings and should not be treated as ground truth for standalone audio or video.

## Tests

```bash
python -m unittest discover -s apps/tone-embedding/tests
```
