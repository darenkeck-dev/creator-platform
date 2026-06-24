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
- DINOv2: strong visual embedding backbone for clustering/similarity, but not text-aligned and not directly a tone labeler.
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
5. Add video tone extraction with OpenCLIP frame prompt scoring.
6. Compute congruence over shared tone dimensions.
7. Export JSONL/Parquet training rows.
8. Add a small review UI for correcting tone labels.

This produces useful V1 training data without needing to solve learned combo affect first.
