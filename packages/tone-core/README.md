# @media-manager/tone-core

TypeScript-native tone analysis core for Media Manager Lambda workflows.

This package is the production-oriented Node path. The Python `apps/tone-embedding` CLI remains the experimental/reference implementation.

## Provides

- `asset-analysis/v1`, `combo-analysis/v1`, and tone taxonomy schemas.
- OpenAI audio and video analysis helpers.
- Video frame extraction through direct `ffmpeg` child process execution.
- Tone descriptor to vector mapping and tone word generation.
- Provider-neutral `asset-tone-vector/v1` record construction and validation.
- Provider-neutral asset vector index and nearest-neighbor query contracts.
- Combo feature/vector generation.
- Cosine similarity/distance and top-k nearest-neighbor helpers.

## Asset Tone Vector Contract

`AssetToneVectorRecord` is the canonical provider-neutral record passed to vector storage adapters. Storage-specific identifiers and response fields do not belong in this contract.

The vector always contains ten finite values in this versioned order:

```text
valence, arousal, dominance, warmth, tension,
intimacy, instability, nostalgia, beauty, menace
```

Each value is bounded to `[-1, 1]`. `buildAssetToneVectorRecord()` starts with the complete OpenAI model score vector and overlays only dimensions present in sparse `adjustedScores`. Missing model dimensions fail validation rather than defaulting to zero.

Every record includes:

- Stable asset ID and `audio` or `video` type.
- `asset-tone-vector/v1`, `tone-taxonomy/v2`, and `model-prior-mean/v1` provenance.
- Visibility, asset status, tone-analysis status, and source update timestamp.

The record schema is strict so provider-specific metadata cannot silently become part of the application contract. Synchronization code decides whether a record is eligible for upsert or must be removed; public search requires public, ready assets with ready tone analysis. DynamoDB remains authoritative, and no combination vectors are persisted.

Primary exports:

- `ASSET_TONE_VECTOR_DIMENSIONS`
- `AssetToneVectorValuesSchema`
- `AssetToneVectorRecordSchema`
- `assetToneVectorSourceFingerprint()`
- `effectiveAssetToneVectorValues()`
- `buildAssetToneVectorRecord()`

`assetToneVectorSourceFingerprint()` accepts an AssetRecord-compatible structural input and returns a SHA-256 revision derived only from asset eligibility and canonical tone-vector source fields. Metadata timestamps and other display or operational metadata do not affect it.

## Vector Index Contract

`AssetToneVectorIndex` is the storage-adapter boundary. Implementations upsert canonical `AssetToneVectorRecord` values, delete by asset ID, and return nearest matches as canonical records plus a distance. Provider configuration, index identifiers, and SDK request/response types stay in the adapter.

`AssetToneVectorQueryService` accepts a named `ToneVector`, required audio/video asset type, and integer result limit from 1 through 100. It validates them before invoking the adapter, converts dimensions to `ASSET_TONE_VECTOR_DIMENSIONS` order, and delegates typed filtering to the provider adapter:

```ts
const service = new AssetToneVectorQueryService(index);
const matches = await service.queryNearest({
  tone: {
    valence: 0.2,
    arousal: 0.4,
    dominance: 0.1,
    warmth: 0.6,
    tension: -0.2,
    intimacy: 0.3,
    instability: -0.4,
    nostalgia: 0.5,
    beauty: 0.7,
    menace: -0.6,
  },
  assetType: "audio",
  limit: 10,
});
```

## Combo Tone Prediction

`comboTonePredictorV0` computes a transient ten-dimensional combo tone as `clamp(0.60 * audio + 0.40 * video)`. `rankComboToneCandidates()` uses exact squared Euclidean distance, and `sampleNearestComboToneCandidate()` samples from the nearest five with weight `1 / (1 + distance)`. These values are computed on demand and are never persisted as combo vectors.

## Tone Word Selection

`review-word-picker.ts` owns the shared 54-word hierarchy and deterministic adaptive suggestion algorithm used by review and explorer interfaces. `reviewWordsToToneQuery()` maps selected words into a sparse taxonomy-v2 query; exact search distance uses only requested dimensions, while direct and target-conditioned source retrieval use complete approximate vectors.

## Local Smoke CLI

```bash
bun packages/tone-core/src/cli.ts analyze audio input.mp3 --asset-id audio-1 --out audio.analysis.json
bun packages/tone-core/src/cli.ts analyze video input.mp4 --asset-id video-1 --out video.analysis.json
```

Required environment:

- `OPENAI_API_KEY`
- `FFMPEG_PATH` if `ffmpeg` is not on `PATH`
- `OPENAI_AUDIO_STRUCTURE_MODEL` optional; defaults to `gpt-5`
