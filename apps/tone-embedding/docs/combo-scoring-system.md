# Combo Scoring System

This document describes how the tone app analyzes an audio/video pair. The current V1 system is intentionally descriptive: it computes relationship geometry between already-analyzed assets. It does not decide whether a combo is good, bad, meaningful, or emotionally successful.

## Core Principle

Asset analysis answers:

- What does this audio feel like?
- What does this video feel like?

Combo analysis answers:

- How are those two tone vectors related?
- Which dimensions match?
- Which dimensions contrast?
- What vector can support similar-combo traversal?

Combo meaning should come later from user input. Until then, values like `happy + happy = happy` can be useful as obvious descriptive cases, but the system should not encode subjective judgement such as `works well`, `bad pairing`, or `bittersweet` as ground truth.

## V1 Inputs

V1 combo analysis consumes:

- A manifest containing `combos` with `audioId` and `videoId`.
- An asset-analysis JSONL file containing one row per asset.
- Each referenced asset row must contain `tone.value`.

The command is:

```bash
uv run --no-editable tone-embedding combo analyze examples/manifest.example.json --analysis outputs/asset-tones.jsonl --out outputs/combo-analysis.jsonl
```

Generate asset analysis first:

```bash
uv run --no-editable tone-embedding extract examples/manifest.example.json --out outputs/asset-tones.jsonl
```

## Tone Dimensions

V1 uses the shared tone vector dimensions:

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

Each dimension is normalized to `-1..1`. Missing dimensions are treated as `0.0` during combo feature computation.

## V1 Output Shape

Each combo row has this top-level shape:

```ts
type ComboAnalysisV1 = {
  schemaVersion: "combo-analysis/v1";
  comboId: string;
  audioAssetId: string;
  videoAssetId: string;
  audioTitle: string;
  videoTitle: string;
  features: ComboComputedFeaturesV1;
  nearestNeighborVector: number[];
  vectorLayout: ComboVectorLayout;
  sourceAnalyses: {
    audio: SourceAnalysisSummary;
    video: SourceAnalysisSummary;
  };
  createdAt: string;
};
```

The row intentionally does not include `fitScore`, `rating`, `predictedDescriptors`, or `comboMeaning`.

## V1 Feature Shape

```ts
type ComboComputedFeaturesV1 = {
  audioTone: ToneVector;
  videoTone: ToneVector;
  deltaTone: ToneVector;
  absDeltaTone: ToneVector;
  interactionTone: ToneVector;
  congruence: number;
  contrast: number;
  intensity: number;
  strongestMatches: string[];
  strongestContrasts: string[];
};
```

### `audioTone` and `videoTone`

These are normalized copies of each asset's `tone.value`.

### `deltaTone`

`deltaTone` preserves direction:

```text
deltaTone[dimension] = videoTone[dimension] - audioTone[dimension]
```

This is the main relationship signal. It distinguishes cases like:

- sad audio + warm/beautiful video
- warm audio + cold video
- tense audio + safe video

Those relationships can be more important for combo traversal than either component tone alone.

### `absDeltaTone`

`absDeltaTone` preserves mismatch magnitude without direction:

```text
absDeltaTone[dimension] = abs(deltaTone[dimension])
```

This helps find combos with similar contrast intensity even when the direction differs.

### `interactionTone`

`interactionTone` captures same-direction reinforcement or opposition:

```text
interactionTone[dimension] = audioTone[dimension] * videoTone[dimension]
```

Positive values usually mean the two assets point in the same direction for that dimension. Negative values usually mean they oppose each other.

### `congruence`

`congruence` is cosine similarity between `audioTone` and `videoTone`.

It is descriptive alignment, not quality. A highly congruent combo may be boring or powerful. A low-congruence combo may clash or may become interesting after user-trained meaning exists.

### `contrast`

`contrast` is the average absolute delta scaled to `0..1`:

```text
contrast = mean(absDeltaTone.values()) / 2
```

The division by `2` accounts for each dimension ranging from `-1` to `1`, where the largest possible difference is `2`.

### `intensity`

`intensity` is the average absolute component tone strength across both assets:

```text
intensity = mean(abs(audioTone) + abs(videoTone))
```

This describes how tonally strong the pair is overall, independent of whether the tones match.

### `strongestMatches`

`strongestMatches` lists dimensions where audio and video point in the same direction with meaningful strength and low delta.

Current rule:

- Same sign.
- Neither value is zero.
- `absDeltaTone[dimension] <= 0.25`.
- Average absolute strength is at least `0.25`.

### `strongestContrasts`

`strongestContrasts` lists dimensions with the largest mismatch.

Current rule:

- Include dimensions where `absDeltaTone[dimension] >= 0.5`.
- Sort descending by mismatch magnitude.
- Keep the top 5.

## Nearest-Neighbor Vector

V1 emits `nearestNeighborVector` for cosine-style traversal and clustering. The current layout is weighted toward relationship shape rather than component similarity alone.

```ts
const vectorBlocks = {
  audioTone: 0.15,
  videoTone: 0.15,
  deltaTone: 0.35,
  absDeltaTone: 0.25,
  interactionTone: 0.10,
};
```

The vector is built by concatenating each weighted block in this order:

1. `audioTone`
2. `videoTone`
3. `deltaTone`
4. `absDeltaTone`
5. `interactionTone`

Each block uses the shared dimension order from `TONE_DIMENSIONS`, so the vector has `5 * 10 = 50` values.

This makes searches favor combos with similar audio/video relationships. For example, a melancholic audio track over a warm nostalgic video can be near another pairing with similar contrast geometry even if the individual assets differ.

## What V1 Does Not Do

V1 does not compute:

- `fitScore`
- `quality`
- `worksWell`
- `predictedDescriptors`
- `comboMeaning`
- `bittersweet`, `uncanny`, `dreamlike`, or other learned affect labels

Those outputs require user feedback or a model trained from user feedback.

## Future V2: User-Trained Combo Meaning

V2 should marry computed geometry with user evaluations.

The training inputs should include:

- `audioTone`
- `videoTone`
- `deltaTone`
- `absDeltaTone`
- `interactionTone`
- `congruence`
- `contrast`
- `intensity`
- user-selected descriptors
- optional user quality/rating signals
- optional notes

The V2 model should learn outputs such as:

```ts
type ComboMeaningV2 = {
  schemaVersion: "combo-meaning/v2";
  comboAnalysisId: string;
  learnedEmbedding: number[];
  predictedDescriptors: Array<{
    descriptor: string;
    confidence: number;
  }>;
  trainedFrom: {
    userEvaluationCount: number;
    modelVersion: string;
  };
};
```

V2 can learn that certain geometry patterns often mean `bittersweet`, `uncanny`, `lonely`, `comforting`, or `dreamlike`, but those labels should come from observed user evaluations rather than V1 rules.

## User Input Shape

The user interface should collect lightweight evaluation data without exposing internal tone dimensions.

Recommended initial shape:

```ts
type UserComboEvaluation = {
  comboId: string;
  userId?: string;
  descriptors: string[];
  quality?: "bad" | "weak" | "good" | "great";
  intensity?: "too-low" | "right" | "too-high";
  notes?: string;
  createdAt: string;
};
```

Descriptor chips should represent combo meaning, not internal dimensions. Examples:

- `nostalgic`
- `bittersweet`
- `uncanny`
- `dreamlike`
- `calm`
- `tense`
- `lonely`
- `warm`
- `chaotic`
- `tender`

Quality should remain optional. Some workflows may only need semantic meaning, not value judgement.

## Evolution Path

1. V1: compute stable relationship geometry and nearest-neighbor vectors.
2. Collect user descriptors and optional ratings on real combos.
3. Analyze which V1 features correlate with user-provided meanings.
4. Train a learned combo embedding model from V1 features plus user labels.
5. Add natural-language combo retrieval over learned combo embeddings.

The important boundary is that V1 remains auditable math, while V2 becomes learned affect.
