# Tone Review Plan

## Goal

Collect human tone feedback without turning review records into user-identity records. Reviews should help improve the global tone taxonomy now, and support local personalization later.

## Layered Model

1. **Base mapping**
   - Versioned global keyword-to-tone-vector mapping, e.g. `tone-taxonomy/v2`.
   - Deterministic and shared across all users.
   - Model-generated keywords use this mapping by default.

2. **Human calibration reviews**
   - Append-only reviews attached to a target: `audio`, `video`, or `combo`.
   - Used to tune the base mapping and evaluate model-vs-human tone gaps.
   - Reviews should not store raw email or user PII.
   - Store enough context to compare against the active taxonomy/model output at review time.
   - Audio/video curator keywords are deterministically mapped through the versioned tone taxonomy, then combined with the untouched OpenAI score vector using `model-prior-mean/v1`: OpenAI has weight one and each curator review's derived vector has weight one.
   - Combo reviews remain combo evaluation data and never adjust either source asset.

3. **Personalization layer**
   - User-specific preference deltas live locally first, likely `localStorage`.
   - Future personalized scoring can combine:
     - base mapping
     - global calibration deltas
     - local user preference deltas
   - Cookies are only needed if server-side personalization or cross-request access is required.

## Review Record Direction

Reviews are target-centered and append-only:

```ts
{
  id: "tone_review_...",
  targetType: "audio" | "video" | "combo",
  targetId: "...",
  reviewSource: "curator" | "anonymous" | "authenticated",
  reviewerId?: "...", // optional pseudonymous/session hash, never raw email
  taxonomyVersion?: "tone-taxonomy/v2",
  keywords: ["warm", "intimate"],
  scores: { warmth: 0.7, intimacy: 0.6 }, // derived server-side from keywords
  modelScoresSnapshot?: { ... },
  baseScoresSnapshot?: { ... },
  notes?: "...",
  createdAt: "...",
  updatedAt: "..."
}
```

DynamoDB key shape:

```txt
pk = TONE_REVIEW#<targetType>#<targetId>
sk = REVIEW#<createdAt>#<reviewId>
```

This allows many reviews for one asset or combo without putting reviewer identity into keys.

## Privacy Rules

- Do not store raw email on review records.
- Do not put reviewer identity in `pk` or `sk`.
- Use `reviewSource` for coarse provenance.
- Use optional `reviewerId` only when dedupe, abuse controls, or personalization needs it.
- If `reviewerId` is derived from an authenticated user, use a salted hash outside DynamoDB item keys.

## Personalization Later

Initial local profile shape can be simple:

```ts
{
  taxonomyVersion: "tone-taxonomy/v2",
  keywordDeltas: {
    warm: { warmth: 0.1, intimacy: 0.05 }
  },
  dimensionOffsets: {
    arousal: -0.1
  }
}
```

Final scoring direction:

```txt
finalVector = baseKeywordMapping + globalCalibrationDelta + localUserPreferenceDelta
```

Keep server-side review capture focused on improving the shared base mapping until account-level personalization is explicitly needed.

## Materialized Asset Adjustment

- `toneAnalysis.scores` remains the original OpenAI output.
- `toneAnalysis.adjustedScores` stores the current audio/video OpenAI-plus-curator vector.
- `toneAnalysis.scoreAdjustment` records the algorithm version, curator sums/counts by dimension, and computation timestamps.
- Review submission and OpenAI reprocessing rebuild the materialized adjustment from append-only curator reviews.
- Effective asset scoring overlays sparse curator adjustments on model scores: `{ ...scores, ...adjustedScores }`.
- Reviews are submitted only from the dedicated Review page using keywords; detail pages do not contain review controls.
- The API ignores client score input and derives audio/video review scores from keyword aliases mapped into `tone-taxonomy/v2` descriptors.
- Asset detail score bars show the OpenAI segment, a contrasting adjustment segment, and a marker at the original OpenAI endpoint.
