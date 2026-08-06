# Tone Vector Dimensions

Tone vectors contain ten signed values in `[-1, 1]`. Negative and positive values represent opposite poles; `0` is neutral or unspecified. The canonical order below is used by `asset-tone-vector/v1` and `combo-tone-predictor/v0`.

| Name          | Description                                             | Negative / positive pole  | Detail                                                                         |
| ------------- | ------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------ |
| `valence`     | Emotional pleasantness or positivity.                   | melancholic / joyful      | Standard VAD axis with strong affective-norm support.                          |
| `arousal`     | Perceived activation, energy, or intensity.             | subdued / energetic       | Standard VAD axis with strong affective-norm support.                          |
| `dominance`   | Perceived potency, force, control, or scale.            | fragile / commanding      | Standard VAD axis; this project emphasizes potency and scale.                  |
| `warmth`      | Inviting, comforting, or emotionally warm character.    | cold / cozy               | Media-specific axis correlated with, but distinct from, valence.               |
| `tension`     | Suspense, strain, or unresolved pressure.               | peaceful / suspenseful    | Media-specific axis; may overlap arousal and negative valence.                 |
| `intimacy`    | Perceived closeness, tenderness, or personal proximity. | distant / intimate        | Media-specific axis; not simply positive valence.                              |
| `instability` | Disorder, unpredictability, or loss of equilibrium.     | stable / chaotic          | Media-specific axis that can vary independently from arousal.                  |
| `nostalgia`   | Past-oriented, wistful, or memory-evoking character.    | unsentimental / nostalgic | Project-specific axis with weaker external research support.                   |
| `beauty`      | Perceived aesthetic appeal, harmony, or elegance.       | ugly / beautiful          | Evaluative media axis related to, but separate from, valence.                  |
| `menace`      | Perceived threat, danger, or harmful intent.            | safe / dangerous          | Threat-specific media axis often associated with low valence and high arousal. |

Audio and video vectors use this same shape. A predicted combination tone is currently `0.60 * audio + 0.40 * video`, clamped per dimension to `[-1, 1]`.
