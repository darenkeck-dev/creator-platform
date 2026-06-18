# Tone-Based Audio/Video Combination Explorer

## Project Summary

A system that randomly combines audio and video assets and presents them as a single experience.

The primary goal is **not semantic understanding** ("subway + jazz"), but **affective understanding** ("lonely", "warm", "uneasy", "nostalgic", "dreamlike").

Users can explore generated combinations, provide reactions, and eventually search for combinations by describing a feeling.

---

## Core Philosophy

Traditional multimodal embeddings focus on:

- What is present in the media
- Objects, scenes, instruments, speech, etc.

This project focuses on:

- Emotional tone
- Atmosphere
- Mood
- Affective response
- Psychological associations

Example:

### Combo A

- Dark rainy subway
- Fisheye lens
- Quiet discordant jazz

Possible feel:

- Lonely
- Uneasy
- Noir
- Liminal

### Combo B

- Sunny subway platform
- Family waiting for train
- Warm saxophone

Possible feel:

- Safe
- Nostalgic
- Comfortable
- Human

Although both are semantically "subway + jazz", they should be distant in tone space.

---

## High-Level Architecture

### Phase 1: Predicted Tone

Generate embeddings without user input.

Pipeline:

```text
audio -> audio affect model -> audio tone vector

video -> video affect model -> video tone vector

audio tone + video tone + interaction features
    -> combo tone vector
```

Potential dimensions:

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

Initial vectors are entirely model-generated.

---

## Embedding Strategy

Avoid making CLIP/CLAP embeddings the primary search space.

Instead:

```text
semantic embeddings
    = metadata

tone embeddings
    = primary retrieval system
```

Semantic embeddings may still be stored for:

- Filtering
- Analytics
- Future recommendation systems

---

## User Feedback

User feedback is sparse and used for calibration.

Users may provide:

- Tone sliders
- Tags
- Freeform descriptions

Example sliders:

- Warm ↔ Cold
- Calm ↔ Intense
- Safe ↔ Threatening
- Familiar ↔ Alien
- Stable ↔ Disorienting
- Joyful ↔ Sad

Feedback modifies confidence in model predictions.

Conceptually:

```text
predicted tone = prior

user feedback = posterior correction
```

---

## Scaling Strategy

Expected:

- Very large number of generated combinations
- Very small percentage receiving feedback

Approach:

1. Generate tone embeddings for all combinations.
2. Cluster tone space.
3. Collect feedback on representative combinations.
4. Propagate corrections to nearby regions.
5. Gradually improve affective mapping.

Do not require feedback for every combination.

---

## Search / Retrieval

Long-term goal:

```text
user text
    -> tone vector
    -> nearest neighbor search
    -> matching combinations
```

Example query:

> lonely but beautiful, like walking home after rain

Produces a tone vector and retrieves nearby combinations.

---

## Future Personalization

Separate:

```text
global tone space
```

from

```text
individual taste space
```

Example:

Two users search for:

> nostalgic

Each may receive different results based on historical preferences.

---

## Data Model

```ts
type Combo = {
  id: string;

  audioId: string;
  videoId: string;

  predictedTone: ToneVector;

  userTone?: ToneVector;

  tags: string[];

  voteCount: number;

  finalToneEmbedding: number[];
};
```

---

## Potential Models

Audio:

- emotion2vec
- Music2Emotion / music2emo
- DEAM-based emotion models

Video:

- LIRIS-ACCEDE-derived models
- Video emotion recognition models
- Valence/arousal prediction models

---

## Guiding Principle

The system is attempting to model:

> What does this combination feel like?

not:

> What is contained in this combination?
