# Tone-Based Audio/Video Combination Explorer (V1–V3)

## Vision

Create a system that randomly combines audio and video assets and organizes those combinations by emotional tone rather than semantic content.

Core question:

> What does this combination feel like?

Examples:

- lonely
- nostalgic
- dreamlike
- liminal
- comforting
- uncanny
- bittersweet

---

# Release V1 — Predicted Tone Space

## Goal

Useful with zero user input.

## Architecture

audio -> audio affect model -> audioTone

video -> video affect model -> videoTone

## Tone Dimensions

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

## Congruence

Compute alignment between audio and video tone vectors.

Examples:

- sad music + sad imagery → high congruence
- happy music + sad imagery → low congruence

## Limitation

V1 knows:

- audio tone
- video tone
- congruence

V1 does NOT know the emotional meaning of the pairing itself.

## Deliverables

- Audio tone extraction
- Video tone extraction
- Congruence scoring
- Tone-based exploration
- Similarity search on component tone

---

# Release V2 — Learned Combo Affect

## Goal

Learn the emotional effect of pairings.

## Training Inputs

- audioTone
- videoTone
- congruence
- user feedback

## Output

ComboEmbedding

Examples:

- sad audio + warm imagery + medium incongruence → bittersweet
- threatening audio + innocent imagery + high incongruence → uncanny

## Result

The first true combo embedding.

(audioTone, videoTone, congruence)
    -> learned affect space
    -> ComboEmbedding

## Deliverables

- User voting/tagging
- Learned affect model
- Combo embeddings
- Emotional clustering
- Similar-feeling combo retrieval

---

# Release V3 — Text-to-Affect Retrieval

## Goal

Search combinations using natural language.

## Query Flow

user text
    -> affect vector
    -> combo embedding search
    -> matching combinations

Examples:

- lonely but beautiful
- dreamlike and slightly unsettling
- warm memories of childhood
- rainy city at night

## Deliverables

- Natural language search
- Emotional discovery
- Prompt-driven exploration
- Curated affective playlists

---

# Core Data Model

```ts
type Combo = {
  id: string;

  audioId: string;
  videoId: string;

  audioTone: ToneVector;
  videoTone: ToneVector;

  congruence: number;

  comboEmbedding?: number[];

  userTags: string[];
  voteCount: number;
};
```
