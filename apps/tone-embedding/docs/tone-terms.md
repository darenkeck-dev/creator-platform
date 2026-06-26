# Tone Terms Guide

This guide defines the dev-facing tone terms emitted by `tone_to_words()`. These labels are quick inspection aids for model output, not final user-facing copy or ground-truth ratings.

## Output Groups

- `primary`: strongest descriptors in the tone vector.
- `secondary`: additional meaningful descriptors below the top three.
- `avoid`: opposite or mismatched pairing targets to avoid when searching for compatible media.
- `summary`: short sentence built from the first three `primary` descriptors.

## Dimensions

| Dimension | Low / Negative | High / Positive | Meaning |
|---|---|---|---|
| `valence` | `melancholic` | `uplifting` | Emotional positivity vs sadness/bleakness. |
| `arousal` | `subdued` | `energetic` | Activity level, motion, intensity, or stimulation. |
| `warmth` | `cold` | `warm` | Human warmth, softness, inviting quality, or emotional temperature. |
| `tension` | `relaxed` | `tense` | Suspense, pressure, unease, or unresolved energy. |
| `menace` | `safe` | `threatening` | Perceived danger, hostility, or ominousness. |
| `instability` | `stable` | `unstable` | Visual/orderly stability vs chaotic, disorienting, volatile energy. |
| `beauty` | `harsh` | `beautiful` | Aesthetic pleasantness vs rough, unpleasant, or abrasive visual quality. |
| `nostalgia` | `unsentimental` | `nostalgic` | Memory-like, sentimental, retro, or wistful feeling. |
| `intimacy` | `distant` | `intimate` | Personal closeness, human scale, privacy, or emotional proximity. |
| `dominance` | `delicate` | `commanding` | Visual power, forcefulness, authority, or scale. |

## Descriptor Notes

| Term | Short Descriptor |
|---|---|
| `uplifting` | Positive, hopeful, emotionally bright. |
| `melancholic` | Sad, subdued, emotionally downcast. |
| `energetic` | Active, stimulating, high-motion or high-intensity. |
| `subdued` | Quiet, restrained, low-energy. |
| `warm` | Inviting, soft, emotionally open. |
| `cold` | Distant, cool, emotionally removed. |
| `tense` | Pressurized, suspenseful, uneasy. |
| `relaxed` | Calm, low-pressure, settled. |
| `threatening` | Ominous, dangerous, hostile, or intimidating. |
| `safe` | Comforting, non-threatening, protected. |
| `unstable` | Chaotic, volatile, disorienting, unbalanced. |
| `stable` | Ordered, grounded, visually settled. |
| `beautiful` | Aesthetically pleasing, graceful, visually attractive. |
| `harsh` | Abrasive, unpleasant, rough, visually severe. |
| `nostalgic` | Wistful, memory-like, retro, sentimental. |
| `unsentimental` | Clinical, present-tense, emotionally dry. |
| `intimate` | Close, personal, private, emotionally near. |
| `distant` | Impersonal, detached, emotionally far. |
| `commanding` | Powerful, dominant, forceful, large-scale. |
| `delicate` | Light, fragile, subtle, low-force. |
| `neutral` | No strong tone dimensions crossed the descriptor threshold. |
| `balanced` | No single affective direction dominates. |
| `ambiguous` | Model scores are too weak or mixed to label confidently. |

## Reading Examples

`A unstable, harsh, cold tone.`

The strongest model signals are disorder/volatility, abrasive aesthetics, and low warmth. This might pair poorly with music intended to feel polished, warm, or orderly.

`A unsentimental, unstable, cold tone.`

The clip feels clinical or non-nostalgic, visually unstable, and emotionally cold. It may still have positive `valence`, but the strongest non-valence signals dominate the dev summary.

`A neutral, balanced tone.`

No descriptor exceeded the current threshold. Treat this as low-confidence tone wording, not proof that the asset has no mood.

## Current Thresholds

- Most dimensions emit a descriptor when `abs(score) >= 0.25`.
- `menace` emits a descriptor when `abs(score) >= 0.20`.
- Descriptors are ranked by absolute score magnitude.
- The top three become `primary`; later descriptors become `secondary`.

## Structured Descriptor Conversion

Qwen-VL currently emits freeform descriptor text only. A later structured-output model should convert that text into stable records like:

```json
[
  { "strength": "strong", "dimension": "warmth", "descriptor": "cold" },
  { "strength": "medium", "dimension": "instability", "descriptor": "unstable" },
  { "strength": "weak", "dimension": "menace", "descriptor": "threatening" }
]
```

`structured_descriptors_to_tone()` maps those records into scores deterministically:

| Strength | Magnitude |
|---|---:|
| `none` | `0.0` |
| `weak` | `0.25` |
| `medium` | `0.55` |
| `strong` | `0.85` |
| `extreme` | `1.0` |

Descriptor words determine the dimension and sign. For example, `cold` maps to negative `warmth`, while `unstable` maps to positive `instability`.

## Caveats

- These terms are for developer verification and pipeline debugging.
- They are generated from numeric model output and can reflect model/prompt bias.
- Qwen-VL `caption`, `tags`, and `rationale` should become the better source for rich semantic descriptions.
- End-user language should be calibrated separately from this dev mapper.
