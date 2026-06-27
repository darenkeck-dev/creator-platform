# Tone Embedding App Plan

## Intent

Create a separate app for generating audio/video tone data and combo embeddings. It can live in this monorepo initially, but should be structured so it can later be published as its own repository.

The app should support the V1-V3 direction from `raw_sources/tone_based_audio_video_explorer_v1_v3.md`:

- V1: predicted audio tone, predicted video tone, congruence, and component-tone similarity search.
- V2: learned combo affect from audio tone, video tone, congruence, and user feedback.
- V3: natural-language affect search over combo embeddings.

## Recommended Shape

Build this as a Python-first app. The useful model ecosystem for audio, video, and multimodal embeddings is Python-heavy, and a standalone Python project will be easier to publish independently later.

Suggested location while in this repo:

```text
apps/tone-embedding/
```

Suggested stack:

- Python 3.11+
- `uv` or `poetry`
- `torch`, `transformers`, `open_clip_torch`, `laion-clap`
- `essentia-tensorflow` for music mood and valence/arousal models
- `funasr` / `modelscope` for `emotion2vec`
- `ffmpeg`, `pyav`, `librosa`, `soundfile`
- `numpy`, `pandas`, `pyarrow`
- `duckdb` or `sqlite` for local metadata
- `faiss` or `hnswlib` for nearest-neighbor experiments
- `streamlit` for a quick labeling/review UI

## Tone Model

Use raw model embeddings and derived tone vectors as separate outputs.

Raw embeddings should preserve the model-native representation for future training. Derived tone vectors should normalize each model's output into the project tone space:

```ts
type ToneVector = {
  valence: number;
  arousal: number;
  dominance: number;
  warmth: number;
  tension: number;
  intimacy: number;
  instability: number;
  nostalgia: number;
  beauty: number;
  menace: number;
};
```

For V1, derive tone values through:

- Direct regressors where available, especially valence/arousal.
- Prompt-pair scoring where direct regressors are unavailable, such as `warm` vs `cold`, `safe` vs `threatening`, and `stable` vs `disorienting`.
- Time aggregation over audio chunks and sampled video frames, storing mean/std/min/max where useful.

## Open Source Model Candidates

No single open model is likely to reliably understand affective tone across music, speech, and video. Use an ensemble and keep the raw model outputs separate so later human feedback can calibrate the final `ToneVector`.

### Audio

- Essentia music models: best first choice for music tone. Includes mood classifiers and arousal/valence models from DEAM, emoMusic, and MuSe, plus mood labels like happy, sad, aggressive, and relaxed.
- LAION CLAP: useful for zero-shot prompt scoring against affective text labels, not just semantic labels.
- MERT: strong modern music representation backbone for downstream tone learning, but not a direct tone model.
- MuQ, MusicFM, and similar music representation models: useful for learned embeddings more than immediate tone scores.
- emotion2vec+: useful for speech emotion recognition, especially audio with voice. Less directly applicable to instrumental music.
- SpeechBrain `emotion-recognition-wav2vec2-IEMOCAP`: simple speech-emotion baseline with known limitations outside speech-like inputs.

Recommended audio stack:

- Essentia for direct music mood, valence, and arousal signals, using explicit embedding model and classifier/regression head artifacts.
- CLAP for affect prompt similarity, such as `warm nostalgic music` vs `cold threatening music`.
- MERT later as a learned embedding backbone once there is enough human-labeled combo data.

### Video

- OpenCLIP: best first choice for visual tone via sampled frames and affective prompt scoring.
- SigLIP / SigLIP2: often stronger than older CLIP-family models for image-text alignment; should be tested alongside or instead of OpenCLIP.
- DINOv2: strong visual embedding backbone for clustering/similarity, but not text-aligned and not directly a tone labeler. Initial adapter added under `apps/tone-embedding`.
- VideoMAE / TimeSformer: useful video feature extractors, but mostly action/scene-oriented unless fine-tuned.
- HSEmotion: useful only when visible faces are present; predicts facial emotion.
- ImageBind: useful for shared image/audio/text embedding experiments, but weights are non-commercial licensed.
- InternVideo: stronger video foundation model family, but heavier operationally; better as a later option.
- VLM captioning models such as Qwen2.5-VL, LLaVA, and Video-LLaVA: useful for generating affective scene descriptions that can be mapped into tone vectors.

Recommended video stack:

- SigLIP or OpenCLIP over sampled frames for affective prompt scoring.
- DINOv2 for visual clustering and similarity checks.
- A VLM caption pass for descriptions like `what mood or atmosphere does this scene convey?`.
- InternVideo or VideoMAE later if frame-level scoring misses temporal tone.

### Ensemble Strategy

The app should support multiple model outputs per asset and combo:

- Direct model scores, such as valence/arousal regressors.
- Prompt-pair similarities, such as warm/cold and safe/threatening.
- Embedding vectors for later supervised learning.
- Optional freeform affect captions.

The derived `ToneVector` should be treated as a calibrated aggregate, not as the raw output of any one model.

## Licensing Requirement

The app must record model license metadata per extraction run. Some useful models are open source but non-commercial or research-limited, including Essentia model weights and ImageBind. Training-data exports should remain auditable.

Store at minimum:

- model name
- source URL or package
- checkpoint/version
- license
- local model hash when practical
- extraction parameters

## App Modules

- Media ingest: read local files, URLs, or exported manifests from Media Manager.
- Preprocessing: normalize audio, resample, sample video frames/clips, and segment long media.
- Model adapters: one adapter per model family behind a consistent interface.
- Tone mapper: convert model-specific outputs into normalized tone dimensions.
- Combo generator: pair audio/video assets and compute audio tone, video tone, congruence, and interaction features.
- Embedding store: write JSONL/Parquet metadata plus `.npy` or `.safetensors` vectors.
- Training data exporter: emit reproducible rows for V2 training.
- Labeling/review UI: collect human tone tags/sliders and notes.
- Model registry: record model metadata, license, checkpoint, and parameters.
- Batch CLI: run repeatable extraction jobs.

## Initial Data Shape

Use append-only JSONL or Parquet for training/export records:

```json
{
  "comboId": "combo-123",
  "audioId": "audio-1",
  "videoId": "video-1",
  "audioTone": {},
  "videoTone": {},
  "congruence": 0.72,
  "comboEmbeddingPath": "embeddings/combo-123.npy",
  "models": {
    "audio": "essentia/deam-valence-arousal",
    "video": "open_clip/ViT-L-14"
  },
  "humanLabels": [],
  "createdAt": "..."
}
```

## First Implementation Slice

1. Create a standalone Python app skeleton.
2. Support local media manifest input.
3. Implement `ffmpeg` preprocessing.
4. Add audio tone extraction with Essentia as an optional adapter, with placeholder fallback when model files are not configured.
5. Add video tone extraction and embedding support.
6. Compute congruence over shared tone dimensions.
7. Export JSONL/Parquet training rows.
8. Add a small review UI for correcting tone labels.

This produces useful V1 training data without needing to solve learned combo affect first.

### Step 5 Detail: Video Tone Extraction and Embeddings

Current implementation status:

- Added OpenCLIP frame prompt scoring under `apps/tone-embedding` for interpretable video tone values.
- Added SigLIP frame prompt scoring under `apps/tone-embedding` as the stronger prompt-pair baseline.
- Added Qwen-VL scene-tone extraction under `apps/tone-embedding` for caption, tags, rationale, and semantic tone values.
- Added DINOv2 frame embedding extraction under `apps/tone-embedding` for video clustering/similarity features.
- Added separate smoke scripts for OpenCLIP, SigLIP, Qwen-VL, and DINOv2.
- Added a combined video analysis script that runs all video models and merges results by `assetId`.
- Updated asset output shape to distinguish tone-producing model runs from embedding-producing model runs.
- Added per-asset `.tonebundle.tar.gz` bundle output containing `manifest.json`, single-row `asset-analysis.jsonl`, and bundle-relative embedding files.
- DINOv2 embedding references are bundle-relative, such as `embeddings/<assetId>/dinov2.npy`; media workflows own upload/S3 placement.
- Added extraction parameters to `modelRuns[]` for reproducibility, including OpenCLIP checkpoint/settings, SigLIP checkpoint/settings, Qwen-VL checkpoint/generation settings, DINOv2 checkpoint/settings, frame sampling settings, prompt/prompt-pair versions, and embedding dimensions.
- Verified shell syntax for the Essentia, OpenCLIP, DINOv2, and combined video scripts; unit tests pass with 25 tests and 1 optional NumPy skip.
- Verified placeholder single-asset bundle create/inspect/extract preserves `modelRuns[].parameters` and contains exactly one asset row.
- Added OpenAI audio descriptor generation using the same descriptor-score schema as OpenAI video so audio/video tone vectors can support future combo delta tracking.
- Added V1 combo analysis that consumes asset analysis rows and computes relationship geometry only: `deltaTone`, `absDeltaTone`, `interactionTone`, descriptive congruence/contrast/intensity, strongest matches/contrasts, and a weighted nearest-neighbor vector. This intentionally avoids quality judgement or learned combo meaning until user evaluation data exists.

Remaining work before Step 5 is considered complete:

1. Validate the combined video bundle output end-to-end.
    - Run `./apps/tone-embedding/scripts/run-video-analysis-test.sh`.
    - Inspect the generated `.tonebundle.tar.gz`.
    - Confirm `asset-analysis.jsonl` contains OpenCLIP, SigLIP, Qwen-VL, and DINOv2 metadata for every video asset.
    - Confirm `.npy` files are present under `embeddings/<assetId>/dinov2.npy` inside the bundle.
2. Validate SigLIP and Qwen-VL output quality on representative local videos.
   - Treat OpenCLIP as a baseline/backstop, not the primary quality bet.
   - Prefer SigLIP for stable prompt-pair scores and Qwen-VL for scene semantics/rationale.
   - Record prompt and prompt-pair versions so score changes are auditable.
3. Update plan/docs to consistently use the asset-analysis/bundle model.
   - Older planning language still references direct combo/training rows in places.
   - Asset upload should produce asset analysis bundles; combo/congruence is a later layer.
4. Add richer bundle inspection/summarization.
   - `bundle inspect` currently returns bundle manifest metadata.
   - Add a summary view that reports per-asset tone contributors, embedding kinds, embedding dimensions, and missing expected model runs.
5. Validate OpenAI audio descriptor generation quality.
    - Review audio output shape against OpenAI video output shape and keep descriptor-score metadata aligned where appropriate.
    - Confirm the shared descriptor vocabulary produces useful audio/video combo delta tracking signals.
6. Validate V1 combo analysis on representative OpenAI audio/video outputs.
   - Confirm delta-heavy nearest-neighbor traversal groups pairings by relationship shape rather than asset/component similarity alone.
   - Keep `combo-analysis/v1` descriptive; reserve meaning and value judgement for later user-trained layers.

Step 5 acceptance criteria:

- Running the combined video analysis script produces one `.tonebundle.tar.gz` artifact per video asset.
- Each bundle contains `manifest.json`, single-row `asset-analysis.jsonl`, and that asset's referenced embedding files.
- JSONL embedding paths are bundle-relative and contain no absolute local/container paths or S3 keys.
- Each video asset has OpenCLIP, SigLIP, and Qwen-VL tone model runs plus a DINOv2 embedding model run.
- Model runs record enough parameters to reproduce the extraction. Current support includes OpenCLIP model/pretrained checkpoint/frame sampling/prompt-pair version, SigLIP checkpoint/frame sampling/prompt-pair version, Qwen-VL checkpoint/frame sampling/generation settings/prompt version, and DINOv2 checkpoint/frame sampling/embedding dimension.
- Unit tests cover bundle creation/inspection/extraction and the analysis output shape.
