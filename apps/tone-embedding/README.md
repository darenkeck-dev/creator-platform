# Tone Embedding

Python app skeleton for generating tone metadata for individual audio/video assets.

This is the first implementation slice from `TONE_EMBEDDING_APP_PLAN.md`. It intentionally keeps model extraction behind adapters so the app can run locally without downloading model weights.

## Current Capabilities

- Load a JSON media manifest with local file or S3 original sources.
- Validate audio/video asset references.
- Optionally verify local file sources exist.
- Build deterministic placeholder tone vectors for audio/video assets.
- Select an optional Essentia audio adapter for music valence/arousal extraction.
- Select an optional OpenAI audio adapter for structured descriptor scores.
- Select an optional OpenCLIP video adapter for frame prompt scoring.
- Select an optional OpenAI video adapter for structured descriptor scores.
- Select an optional SigLIP video adapter for stronger frame prompt scoring.
- Select an optional Qwen-VL video adapter for scene caption/mood/tone extraction.
- Select an optional DINOv2 video adapter for visual embeddings.
- Add deterministic dev-only tone descriptors for quick output verification.
- Export append-only JSONL asset analysis rows.
- Generate `ffmpeg` preprocessing commands and optionally execute them.

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

## Usage

From this directory:

```bash
PYTHONPATH=src python -m tone_embedding manifest validate examples/manifest.example.json
PYTHONPATH=src python -m tone_embedding manifest validate examples/manifest.example.json --check-files
PYTHONPATH=src python -m tone_embedding extract examples/manifest.example.json --out outputs/asset-tones.jsonl
PYTHONPATH=src python -m tone_embedding extract examples/manifest.example.json --out outputs/asset-tones.jsonl --audio-model essentia --essentia-embedding-model ./models/msd-musicnn-1.pb --essentia-valence-arousal-model ./models/deam-msd-musicnn-2.pb
PYTHONPATH=src python -m tone_embedding extract examples/audio-manifest.example.json --out outputs/audio-tones-openai.jsonl --audio-model openai
PYTHONPATH=src python -m tone_embedding extract examples/video-manifest.example.json --out outputs/video-tones.jsonl --video-model openclip
PYTHONPATH=src python -m tone_embedding extract examples/video-manifest.example.json --out outputs/video-tones-openai.jsonl --video-model openai --video-frame-rate 1.0
PYTHONPATH=src python -m tone_embedding extract examples/video-manifest.example.json --out outputs/video-tones-siglip.jsonl --video-model siglip
PYTHONPATH=src python -m tone_embedding extract examples/video-manifest.example.json --out outputs/video-tones-qwen-vl.jsonl --video-model qwen-vl
PYTHONPATH=src python -m tone_embedding extract examples/video-manifest.example.json --out outputs/video-embeddings.jsonl --video-model dinov2 --embedding-out-dir outputs/embeddings/dinov2
PYTHONPATH=src python -m tone_embedding preprocess examples/manifest.example.json --out-dir outputs/preprocessed
PYTHONPATH=src python -m tone_embedding preprocess examples/manifest.example.json --out-dir outputs/preprocessed --execute
```

Relative `file` paths are resolved relative to the manifest file. `--check-files` only checks `file` sources. S3 sources are designed for AWS execution contexts and are staged by the preprocessing plan with `aws s3 cp` before `ffmpeg` runs.

Local sample media belongs in `examples/media/`. That directory is intentionally ignored so publishable branches do not include media files by default. The Essentia smoke-test manifest expects `audio-demo-00.mp3` and `audio-demo-01.mp3`.

## Dependency Extras

Dependencies are listed in `pyproject.toml` optional extras:

- `qwen-mps`: native macOS Qwen/MPS dependencies for `run-qwen-vl-mps-test.sh`.
- `openai`: OpenAI structured descriptor-score video adapter dependencies.
- `video`: full local video stack dependencies for OpenCLIP, SigLIP, Qwen-VL, and DINOv2.
- `essentia`: Essentia/TensorFlow audio adapter dependency.

Use uv from `apps/tone-embedding/`:

```bash
uv run --extra qwen-mps python -m tone_embedding --help
uv run --extra openai python -m tone_embedding --help
uv run --extra video python -m tone_embedding --help
```

## Init Steps

From `apps/tone-embedding/`:

```bash
./scripts/setup-essentia-models.sh
PYTHONPATH=src python -m tone_embedding manifest validate examples/manifest.example.json --check-files
PYTHONPATH=src python -m tone_embedding preprocess examples/manifest.example.json --out-dir outputs/preprocessed --execute
```

The setup script downloads Essentia model artifacts into `models/`. That directory is ignored by git.

## Essentia Audio Adapter

`--audio-model essentia` is optional and requires local Essentia model artifacts plus the `essentia-tensorflow` package. The app records the adapter/model metadata in exported rows, but model weights are not vendored in this repo.

Expected setup:

- Install `essentia-tensorflow` in the Python environment.
- Download the chosen Essentia music embedding model and valence/arousal head with `./scripts/setup-essentia-models.sh`.
- Pass both paths with `--essentia-embedding-model` and `--essentia-valence-arousal-model`.
- Use `--essentia-output-range deam` for the default DEAM head, `unit` for heads that emit `0..1`, or `bipolar` for heads that already emit `-1..1`.

If the package or model file is missing, extraction fails with a setup error instead of silently falling back.

For the full Docker-based smoke test, see `docs/audio-tone-extraction.md`.

The Docker smoke test auto-builds and reuses a local `tone-embedding-essentia-audio-test:local` image so `essentia-tensorflow` is not installed on every run.

Run it from the repo root:

```bash
./apps/tone-embedding/scripts/run-essentia-audio-test.sh
```

Optional custom output path:

```bash
./apps/tone-embedding/scripts/run-essentia-audio-test.sh /tmp/my-tone-output.jsonl
```

## OpenAI Audio Adapter

`--audio-model openai` sends audio to `gpt-audio` by default, asks for JSON matching the same descriptor-score schema used by OpenAI video, and maps those descriptors into the internal tone vector with `structured_descriptors_to_tone()`. `gpt-audio` supports audio input through Chat Completions but does not support strict structured outputs, so this path uses prompt-enforced JSON rather than `response_format=json_schema`. The request includes OpenAI's required audio chat shape: `modalities=["text", "audio"]`, an `audio` output config, and an `input_audio` content block; JSON is read from text content or the returned audio transcript. This keeps audio, video, and user ratings aligned around one descriptor vocabulary and prepares combo delta tracking across asset types.

Create `apps/tone-embedding/.env.local` with `OPENAI_API_KEY`, then run from the repo root:

```bash
./apps/tone-embedding/scripts/run-openai-audio-test.sh
```

Override the audio model with `OPENAI_AUDIO_MODEL` if needed.

## OpenCLIP Video Adapter

`--video-model openclip` is optional and requires `open_clip_torch`, `torch`, `pillow`, and `opencv-python-headless`. The adapter samples frames from the video file, scores each frame against affective prompt pairs, aggregates the frame scores, and emits a tone model run plus top-level aggregate tone.

For the full Docker-based smoke test, see `docs/video-tone-extraction.md`.

Run it from the repo root:

```bash
./apps/tone-embedding/scripts/run-openclip-video-test.sh
```

## OpenAI Video Adapter

`--video-model openai` samples frames at the requested frame rate, sends them to an OpenAI vision model, asks for structured descriptor scores, and maps those descriptors into the internal tone vector with `structured_descriptors_to_tone()`. Users and models can share the same descriptor vocabulary; internal dimensions remain implementation details.

The adapter defaults to `1` frame per second through the smoke script and uses descriptor-score schema `tone-descriptor-scores/v1`. It records the exact OpenAI model, API-key env var name, frame sampling settings, image detail mode, and schema version in `modelRuns[].parameters`.

Create `apps/tone-embedding/.env.local` with your API key:

```bash
OPENAI_API_KEY=sk-...
```

The CLI automatically loads `.env` and `.env.local` from `apps/tone-embedding/` and the current working directory when `python-dotenv` is installed through the `openai` or `video` extra.

Run it from the repo root:

```bash
./apps/tone-embedding/scripts/run-openai-video-test.sh
```

Override the model without changing the contract:

```bash
OPENAI_MODEL=gpt-5-mini ./apps/tone-embedding/scripts/run-openai-video-test.sh
```

## SigLIP Video Adapter

`--video-model siglip` uses the same affective prompt pairs as OpenCLIP but scores them with a SigLIP checkpoint. Prompt-pair tone values use positive-vs-negative raw logit deltas with a `tanh(delta / 4.0)` soft clamp, so the adapter preserves SigLIP's native ranking signal instead of subtracting compressed sigmoid probabilities or hard-clamping most extremes. It is intended as the stronger prompt-scoring path for visual affect dimensions while keeping scores interpretable and prompt-versioned.

Run it from the repo root:

```bash
./apps/tone-embedding/scripts/run-siglip-video-test.sh
```

## Qwen-VL Video Adapter

`--video-model qwen-vl` samples frames and asks Qwen-VL for qualitative tone descriptors. It does not parse Qwen output into scores. The intended chain is: Qwen freeform descriptor output -> a stronger structured-output text model -> deterministic descriptor-to-score conversion. The CLI default is `Qwen/Qwen2.5-VL-7B-Instruct`; the Docker smoke script defaults to `Qwen/Qwen2-VL-2B-Instruct`, 1 frame, 192 generated tokens, automatic dtype/device mapping, and a persistent Hugging Face cache under `tests/output/huggingface-cache` so local CPU runs are less likely to hang or be killed.

Run it from the repo root:

```bash
./apps/tone-embedding/scripts/run-qwen-vl-video-test.sh
```

On Apple Silicon, you can try native macOS MPS instead of Docker CPU. This uses `uv` and the `qwen-mps` optional dependency list in `pyproject.toml`, so no manual virtualenv setup is needed:

```bash
./apps/tone-embedding/scripts/run-qwen-vl-mps-test.sh
```

The MPS path runs outside Docker because Linux containers cannot use Apple Metal/MPS acceleration. It loads Qwen with `--qwen-device-map mps` and defaults to `float16`.

Equivalent direct command from `apps/tone-embedding/`:

```bash
uv run --extra qwen-mps python -m tone_embedding extract examples/video-manifest.example.json --out tests/output/asset-tones-qwen-vl-mps-video.jsonl --video-model qwen-vl --qwen-model Qwen/Qwen2-VL-2B-Instruct --qwen-device-map mps --qwen-torch-dtype float16 --video-max-frames 1 --qwen-max-new-tokens 192
```

Use the larger model when you have enough local capacity:

```bash
QWEN_MODEL=Qwen/Qwen2.5-VL-7B-Instruct QWEN_VIDEO_MAX_FRAMES=6 QWEN_MAX_NEW_TOKENS=512 ./apps/tone-embedding/scripts/run-qwen-vl-video-test.sh
```

## Full Video Analysis Test

Run every current video analysis model and merge the outputs into one asset analysis row per video. The combined row includes OpenCLIP, SigLIP, Qwen-VL, and DINOv2 model evidence:

```bash
./apps/tone-embedding/scripts/run-video-analysis-test.sh
```

This also writes one `.tonebundle.tar.gz` per asset containing `manifest.json`, a single-row `asset-analysis.jsonl`, and bundle-relative embedding files under `embeddings/<assetId>/`. See `docs/video-analysis-pipeline.md`.

## DINOv2 Video Adapter

`--video-model dinov2` is optional and requires `torch`, `torchvision`, `transformers`, `numpy`, `pillow`, and `opencv-python-headless`. The adapter samples frames from the video file, encodes them with DINOv2, writes an averaged `.npy` embedding, and emits an embedding model run for later clustering/similarity/calibration. Embedding references are bundle-relative, such as `embeddings/video-demo-00/dinov2.npy`. It does not emit top-level tone.

For the full Docker-based smoke test, see `docs/dinov2-video-embeddings.md`.

Run it from the repo root:

```bash
./apps/tone-embedding/scripts/run-dinov2-video-test.sh
```

## Tone Words

Tone-producing exports include tone words for developer verification only. These descriptors are deterministic labels derived from the current tone vector; they are not end-user ratings and should not be treated as ground truth.

See `docs/tone-terms.md` for dimension and descriptor definitions.

## Combo Analysis

Combo congruence is intentionally not part of upload-time asset extraction. Asset analysis rows should be attached to the individual uploaded asset; combo analysis references two asset analysis results and calculates relationship geometry separately.

V1 combo analysis is descriptive only. It does not produce `fitScore`, quality judgement, or learned combo meaning. It computes the shape of the audio/video relationship for traversal and later user-trained meaning:

- `deltaTone`: `videoTone - audioTone` per dimension.
- `absDeltaTone`: mismatch magnitude per dimension.
- `interactionTone`: `audioTone * videoTone` per dimension.
- `congruence`: cosine similarity over the component tone vectors.
- `nearestNeighborVector`: weighted blocks for cosine-style similar-combo traversal, currently biased toward `deltaTone` and `absDeltaTone`.

Generate asset analysis first, then combo analysis:

```bash
PYTHONPATH=src python -m tone_embedding extract examples/manifest.example.json --out outputs/asset-tones.jsonl
PYTHONPATH=src python -m tone_embedding combo analyze examples/manifest.example.json --analysis outputs/asset-tones.jsonl --out outputs/combo-analysis.jsonl
```

Future user evaluations should train combo meaning separately from this computed V1 geometry.

See `docs/combo-scoring-system.md` for the full V1 output shape, scoring definitions, nearest-neighbor vector layout, and V2 plan for user-input-driven combo meaning.

## Tests

```bash
python -m unittest discover -s apps/tone-embedding/tests
```
