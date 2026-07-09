# Tone Keyword Mapping Research Brief

## Context

Media Manager currently uses `tone-taxonomy/v1` as a handcrafted mapping layer between OpenAI-produced tone keywords and numeric tone vectors. OpenAI should continue producing explainable descriptor keywords; the research task is to improve the keyword vocabulary and the deterministic keyword-to-score mapping.

Current flow:

```text
audio/video asset
  -> OpenAI semantic tone extraction
  -> supported descriptor keywords + strength values
  -> tone taxonomy mapping
  -> numeric tone vector
```

The mapping layer is intentionally versioned so future changes can be recomputed and compared against prior outputs.

## Research Goals

1. Refine the supported keyword set.
   - Improve coverage beyond the current one-positive/one-negative descriptor pair per dimension.
   - Prefer words that OpenAI can reliably use, humans can review, and research lexicons can partially anchor.
   - Keep media-relevant tone language, not just generic emotion labels.

2. Refine the keyword-to-value mapping.
   - Use research-backed affective norms as priors for `valence`, `arousal`, and `dominance`.
   - Preserve custom media dimensions where research VAD is insufficient.
   - Move from one keyword mapping to one dimension toward weighted multi-dimension mappings where appropriate.

## Current Dimensions

The current tone vector has these dimensions, each normalized to `[-1, 1]`:

| Dimension | Meaning |
|---|---|
| `valence` | Emotional positivity vs sadness, bleakness, or negativity. |
| `arousal` | Energy, stimulation, motion, or intensity. |
| `dominance` | Power, scale, forcefulness, authority, or perceived control. |
| `warmth` | Human warmth, softness, invitation, or emotional openness. |
| `tension` | Suspense, pressure, unease, or unresolved energy. |
| `intimacy` | Personal closeness, privacy, proximity, or emotional nearness. |
| `instability` | Chaos, volatility, disorientation, or lack of order. |
| `nostalgia` | Memory-like, wistful, retro, or sentimental feeling. |
| `beauty` | Aesthetic pleasantness, grace, polish, or attractiveness. |
| `menace` | Threat, danger, hostility, ominousness, or fear cue. |

The first three dimensions are directly supported by affective norm literature. The remaining dimensions are media-specific and should be informed by research where possible, but will likely require project-specific judgment.

## Current V1 Mapping Shape

Current `tone-taxonomy/v1` maps each descriptor to one dimension and one sign:

```json
{
  "descriptor": "melancholic",
  "dimension": "valence",
  "sign": -1
}
```

OpenAI may emit a descriptor with either a strength label or a numeric strength:

```json
{
  "descriptor": "melancholic",
  "strengthLabel": "strong",
  "strengthValue": 0.82,
  "evidence": "Slow, minor-key piano and subdued vocal texture."
}
```

V1 scoring:

```text
score = strengthValue * sign
```

If multiple descriptors affect the same dimension, V1 keeps the strongest absolute score. If no descriptor maps to a dimension, that dimension remains `0`.

## Target V2 Mapping Shape

The research should recommend a richer mapping where each descriptor can affect multiple dimensions with signed weights.

Recommended output shape:

```json
{
  "descriptor": "melancholic",
  "label": "Melancholic",
  "description": "Sad, subdued, emotionally downcast, or wistful.",
  "status": "candidate",
  "mappings": [
    {
      "dimension": "valence",
      "weight": -0.80,
      "confidence": 0.85,
      "basis": "VAD lexicons consistently rate related lemmas as low valence."
    },
    {
      "dimension": "arousal",
      "weight": -0.35,
      "confidence": 0.60,
      "basis": "Often lower energy, but context dependent."
    },
    {
      "dimension": "nostalgia",
      "weight": 0.35,
      "confidence": 0.50,
      "basis": "Useful media-specific association, not directly from VAD."
    }
  ],
  "sourceNotes": [
    "Research-derived prior for valence/arousal.",
    "Project-specific prior for nostalgia."
  ]
}
```

## Value Format Requirements

Each keyword mapping must produce signed numeric contributions to the tone vector.

### Dimension Values

Final tone vector values must remain normalized floats in `[-1, 1]`.

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

Interpretation:

| Value | Meaning |
|---:|---|
| `-1.0` | Strong negative pole for that dimension. |
| `-0.5` | Moderate negative pole. |
| `0.0` | Neutral, absent, ambiguous, or not detected. |
| `0.5` | Moderate positive pole. |
| `1.0` | Strong positive pole. |

Examples:

| Dimension | Negative | Positive |
|---|---|---|
| `valence` | sad, bleak, melancholic | joyful, hopeful, uplifting |
| `arousal` | quiet, still, subdued | energetic, intense, active |
| `dominance` | delicate, small, fragile | commanding, powerful, forceful |
| `warmth` | cold, sterile, detached | warm, inviting, soft |
| `tension` | relaxed, calm, settled | tense, suspenseful, uneasy |
| `intimacy` | distant, impersonal | intimate, close, private |
| `instability` | stable, ordered, grounded | unstable, chaotic, disorienting |
| `nostalgia` | unsentimental, clinical | nostalgic, wistful, retro |
| `beauty` | harsh, abrasive, ugly | beautiful, graceful, pleasing |
| `menace` | safe, non-threatening | threatening, ominous, dangerous |

### Descriptor Mapping Weights

Each descriptor-to-dimension mapping should use a signed `weight` in `[-1, 1]`.

```ts
type DescriptorMapping = {
  dimension: keyof ToneVector;
  weight: number; // -1 to 1
  confidence: number; // 0 to 1
  basis: string;
};
```

Interpretation:

| Weight Range | Meaning |
|---:|---|
| `-1.00` to `-0.75` | Strong negative contribution. |
| `-0.74` to `-0.40` | Moderate negative contribution. |
| `-0.39` to `-0.15` | Weak negative contribution. |
| `-0.14` to `0.14` | Usually omit unless there is a specific reason. |
| `0.15` to `0.39` | Weak positive contribution. |
| `0.40` to `0.74` | Moderate positive contribution. |
| `0.75` to `1.00` | Strong positive contribution. |

The final contribution from one OpenAI descriptor should be:

```text
dimensionContribution = descriptorStrengthValue * mappingWeight
```

Where `descriptorStrengthValue` is the model-provided strength in `[0, 1]`.

If OpenAI provides only a label, use the existing default scale unless research suggests a better one:

| Label | Default Strength |
|---|---:|
| `none` | `0.00` |
| `weak` | `0.25` |
| `medium` | `0.55` |
| `strong` | `0.85` |
| `extreme` | `1.00` |

### Aggregating Multiple Keywords

The research should recommend an aggregation strategy. The default proposal is:

1. Convert each descriptor to per-dimension contributions using `strengthValue * weight`.
2. Sum contributions per dimension.
3. Clamp each dimension to `[-1, 1]`.
4. Optionally apply dampening so many weak descriptors do not overwhelm one strong descriptor.

Example:

```json
{
  "descriptorScores": [
    { "descriptor": "melancholic", "strengthValue": 0.8 },
    { "descriptor": "subdued", "strengthValue": 0.7 }
  ],
  "computedTone": {
    "valence": -0.64,
    "arousal": -0.67,
    "dominance": 0,
    "warmth": 0,
    "tension": 0,
    "intimacy": 0,
    "instability": 0,
    "nostalgia": 0.28,
    "beauty": 0,
    "menace": 0
  }
}
```

In this example, `melancholic` contributes mostly negative valence and weak positive nostalgia; `subdued` contributes negative arousal.

## Papers And Resources To Review

### Core VAD / PAD Foundations

- Osgood, Suci, and Tannenbaum, **The Measurement of Meaning**.
  - Semantic differential framework: evaluation, potency, activity.
  - Useful conceptual ancestor for valence/evaluation, dominance/potency, arousal/activity.

- Russell, **A Circumplex Model of Affect**.
  - Defines affect in a valence-arousal space.
  - Useful for interpreting and visualizing `valence` and `arousal`.

- Mehrabian and Russell, **An Approach to Environmental Psychology**.
  - PAD model: pleasure, arousal, dominance.
  - Useful for grounding the three most standard affective dimensions.

### Affective Norm Lexicons

- Bradley and Lang, **Affective Norms for English Words (ANEW)**.
  - Human ratings for English words on valence, arousal, and dominance.
  - Smaller but canonical baseline.

- Warriner, Kuperman, and Brysbaert, **Norms of valence, arousal, and dominance for 13,915 English lemmas**.
  - Larger VAD lexicon; likely the most useful research source for descriptor priors.
  - Use to compare current descriptors like `melancholic`, `energetic`, `cold`, `safe`, `beautiful`, and candidate synonyms.

- Mohammad, **NRC Valence, Arousal, and Dominance Lexicon**.
  - Broad VAD lexicon with high practical coverage.
  - Useful for expanding candidate keywords and checking directionality.

- Mohammad and Turney, **NRC Emotion Lexicon / EmoLex**.
  - Maps words to emotion categories such as joy, sadness, fear, anger, trust, anticipation.
  - Useful for non-VAD dimensions like `menace`, `tension`, and `warmth`.

### Media Affect References

- DEAM Dataset / MediaEval Emotion in Music work.
  - Useful for music/audio valence-arousal conventions.
  - Helps compare whether audio descriptors like `subdued`, `tense`, and `uplifting` behave as expected.

- LIRIS-ACCEDE and related video affect datasets.
  - Useful for video valence-arousal conventions.
  - Helps calibrate visual terms like `beautiful`, `threatening`, `stable`, and `intimate`.

## Research Output Requested

Produce a markdown report with these sections:

1. **Recommended Descriptor Set**
   - Proposed keywords grouped by dimension and polarity.
   - Mark each keyword as `keep`, `rename`, `add`, or `remove` relative to V1.

2. **Descriptor Mapping Table**
   - One row per descriptor.
   - Include multi-dimension mappings.

Required table columns:

| Descriptor | Status | Primary Dimension | Primary Weight | Secondary Mappings | Research Basis | Notes |
|---|---|---|---:|---|---|---|

Example row:

| `melancholic` | keep | `valence` | `-0.80` | `arousal:-0.35`, `nostalgia:0.35` | Warriner/NRC low valence; project media prior for nostalgia | Keep; useful and OpenAI-friendly. |

3. **Dimension-Specific Notes**
   - Explain each dimension and whether it is research-backed, media-specific, or hybrid.
   - Identify dimensions that need human review most.

4. **Conflicts And Ambiguities**
   - Words where research VAD and media intuition disagree.
   - Words that are too broad, culturally loaded, or likely to be inconsistent.

5. **Proposed JSON Shape For `tone-taxonomy/v2`**
   - Include a small example JSON fragment using the target weighted mapping format.

6. **Evaluation Recommendations**
   - Suggest a small review set and comparison method for V1 vs V2.
   - Include how to judge whether new mappings improve summaries and retrieval.

## Constraints

- Do not require OpenAI to output raw numeric tone vectors directly.
- Keep OpenAI output keyword-based and explainable.
- Prefer descriptors that work for both audio and video unless a descriptor is explicitly modality-specific.
- Do not make the taxonomy too large; prefer a controlled vocabulary that OpenAI can use consistently.
- Keep numeric output deterministic and reproducible.
- Version all mapping changes as `tone-taxonomy/v2`; do not silently mutate V1 outputs.
