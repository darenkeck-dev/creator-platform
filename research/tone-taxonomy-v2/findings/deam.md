# DEAM Dataset / MediaEval Emotion in Music -- Research Findings

## Citation

Aljanaki, A., Yang, Y.-H., & Soleymani, M. (2017). *Developing a benchmark for
emotional analysis of music.* PLOS ONE, 12(3): e0173392.
https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0173392

Also known as the "MediaEval Database for Emotional Analysis in Music"
(DEAM), used for the MediaEval "Emotion in Music" task, 2013-2015.
Manual/codebook: https://cvml.unige.ch/databases/DEAM/manual.pdf

Local copy used for this analysis: `research/tone-taxonomy-v2/sources/deam/extracted/annotations/`
- `annotations averaged per song/song_level/static_annotations_averaged_songs_{1_2000,2000_2058}.csv`
  -- one row per song: `song_id, valence_mean, valence_std, arousal_mean, arousal_std` (n = 1,802 valid rows after removing empty/header artifacts, out of a nominal 2,058 song IDs).
- `annotations averaged per song/dynamic (per second annotations)/{valence,arousal}.csv` -- per-second (2 Hz) valence/arousal trajectories, averaged across raters, from 15s into each clip onward.
- `annotations per each rater/` -- same data, unaggregated, per individual rater.

License: CC BY-NC (per source README). Non-commercial research use.

## Scope & Relevance

DEAM directly and only informs **valence** and **arousal**. It is a
crowd-annotated (9-point, SAM-style, 1-9 scale, midpoint 5) rating of
~1,800 royalty-free music clips, reported as per-song means (and per-second
dynamic trajectories, not used quantitatively here beyond confirming the
format). There is **no lexical, genre, title, or keyword metadata** in the
files provided -- the dataset is exclusively `song_id -> (valence, arousal)`
numeric pairs. This means DEAM cannot directly rate any of the 20 V1
*words* the way a lexicon (Warriner, NRC-VAD) can; it can only be used to
validate the **structure of valence-arousal space in music** (ranges,
correlation, quadrant population) and, by extension, to sanity-check
descriptors that are themselves compound VA concepts (e.g. "tense" =
low valence + high arousal).

DEAM is **completely silent** on: `dominance`, `warmth`, `intimacy`,
`instability`, `nostalgia`, `beauty`, `menace`. It offers no direct
`tension` measurement either, but the valence/arousal quadrant structure
gives weak circumstantial evidence for how a tension-like construct behaves
in this space -- flagged below as indirect/inferential, not a DEAM-native
measurement.

Normalization convention used throughout this analysis: DEAM's raw 1-9
scale is mapped to the brief's `[-1, 1]` scale via `norm = (raw - 5) / 4`
(midpoint 5 -> 0, matching the same 1-9 convention used by Warriner et al.).

### Key structural findings (n = 1,802 songs, static/song-level means)

- Valence: mean 4.90 (norm -0.02), sd 1.17, range [1.6, 8.4] (norm [-0.85, 0.85]).
- Arousal: mean 4.85 (norm -0.04), sd 1.30, range [1.6, 8.2] (norm [-0.85, 0.80]).
- **Valence-arousal Pearson correlation: r = 0.59** (moderate positive).
  This is a notable finding: in this music corpus, valence and arousal are
  *not* orthogonal -- happier-rated music tends toward higher arousal, and
  sadder-rated music tends toward lower arousal, on average. This
  contradicts a naive assumption that all four VA quadrants are equally
  likely.
- Quadrant population (relative to midpoint 5): High-valence/High-arousal
  665 (36.9%), Low-valence/Low-arousal 685 (38.0%), High-valence/Low-arousal
  222 (12.3%), Low-valence/High-arousal 230 (12.8%). The "diagonal"
  quadrants (happy-energetic, sad-calm) dominate; the "off-diagonal"
  quadrants (happy-calm/content, sad-energetic/tense) are real but roughly
  a third as common.
- Bottom-quartile-valence songs (n=450) have mean arousal 3.89 (norm -0.28)
  vs. top-quartile-valence songs (n=451) mean arousal 5.85 (norm +0.21).
- Bottom-quartile-arousal songs (n=450) have mean valence 4.04 (norm -0.24)
  vs. top-quartile-arousal songs (n=451) mean valence 5.84 (norm +0.21).
  Notably, even the *most* subdued (lowest-arousal) songs only average a
  weakly negative valence (norm ~-0.24 to -0.43 at the extremes, e.g. song
  1016: v=3.3/a=1.9 -> norm v=-0.43), not a strongly negative one -- low
  arousal in music does not imply sadness.

## Descriptor Findings

| Descriptor | Source Value/Rating | Suggested Dimension | Suggested Weight [-1,1] | Confidence [0,1] | Basis |
|---|---|---|---:|---:|---|
| `uplifting` | Highest-valence songs average norm valence ~+0.7 to +0.85 (e.g. song 115: v=8.4 -> +0.85; song 960: v=7.7 -> +0.68) | `valence` | `0.80` | `0.55` | Song-level static means, top-valence extremes, DEAM n=1,802. Indirect (structural, not lexical) since DEAM has no word "uplifting" attached to songs. |
| `uplifting` | Top-valence songs' mean arousal is elevated (norm ~+0.21, quartile analysis) | `arousal` | `0.20` | `0.30` | Valence-arousal correlation r=0.59 in this corpus; weak secondary cross-link, context-dependent (e.g. song 25: v=7.9/a=4.7 shows a high-valence, near-neutral-arousal counterexample). |
| `melancholic` | Lowest-valence songs average norm valence ~-0.72 to -0.85 (e.g. song 488: v=1.6 -> -0.85; song 198: v=1.9 -> -0.78) | `valence` | `-0.80` | `0.55` | Song-level static means, bottom-valence extremes. Indirect/structural. |
| `melancholic` | Bottom-valence-quartile songs' mean arousal is reduced but only moderately (norm ~-0.28) | `arousal` | `-0.25` | `0.35` | Quartile analysis; weaker and noisier than the valence signal -- some low-valence songs are high-arousal (e.g. song 1334: v=3.8/a=7.8, which reads as "tense/agitated" rather than "melancholic"). Recommend keeping this secondary weight modest, consistent with the brief's own example (`melancholic` -> `arousal: -0.35`). |
| `energetic` | Highest-arousal songs average norm arousal ~+0.7 to +0.8 (e.g. song 2002: a=8.2 -> +0.8; song 343: a=8.1 -> +0.77) | `arousal` | `0.80` | `0.55` | Song-level static means, top-arousal extremes. Indirect/structural. |
| `energetic` | Top-arousal-quartile songs' mean valence is elevated but only weakly (norm ~+0.21) | `valence` | `0.20` | `0.30` | Correlation r=0.59; note a real counterexample exists (song 1334: a=7.8 but v=3.8, i.e. high-arousal + negative valence = "tense", not "uplifting") -- this cross-link should stay weak. |
| `subdued` | Lowest-arousal songs average norm arousal ~-0.75 to -0.85 (e.g. song 745: a=1.6 -> -0.85; song 1016: a=1.9 -> -0.78) | `arousal` | `-0.80` | `0.55` | Song-level static means, bottom-arousal extremes. Indirect/structural. |
| `subdued` | Bottom-arousal-quartile songs' mean valence is only weakly negative (norm ~-0.24), and individual extremes range from -0.43 to -0.10 -- i.e. not consistently sad | `valence` | `-0.15` | `0.25` | Quartile + extremes analysis. **Caution**: recommend a weak/omittable secondary valence weight only, not a moderate one -- low-arousal music in this corpus is closer to "calm/neutral" than "sad." Conflating `subdued` with negative valence risks over-coupling energy and mood. |
| `warm` | No data | -- | `0` | `0` | DEAM records only valence and arousal per song; no timbral, textural, or "warmth" judgment exists in this dataset. |
| `cold` | No data | -- | `0` | `0` | Same as `warm`. |
| `tense` | No direct "tension" measurement. Low-valence + high-arousal quadrant (the region a circumplex model would associate with "tense/agitated") is populated by 230/1,802 songs (12.8%) -- real but the least common quadrant. Example: song 1334, v=3.8/a=7.8 -> norm (-0.30, +0.70). | `tension` | n/a (DEAM cannot quantify this V1-specific dimension directly) | `0` | DEAM has no `tension` construct; only VA position is measurable. |
| `tense` | (secondary, via circumplex-position proxy) | `arousal` | `0.45` | `0.30` | Inferred from LVHA quadrant population and exemplar songs. Not a DEAM-native label -- treat as theory-informed proxy, low-moderate confidence. |
| `tense` | (secondary, via circumplex-position proxy) | `valence` | `-0.35` | `0.30` | Same basis. |
| `relaxed` | No direct "tension" measurement. High-valence + low-arousal quadrant (content/calm) is populated by 222/1,802 songs (12.3%). Example: song 631, v=7.6/a=3.1 -> norm (+0.65, -0.47). | `tension` | n/a | `0` | Same limitation as `tense`. |
| `relaxed` | (secondary, via circumplex-position proxy) | `arousal` | `-0.40` | `0.30` | Inferred from HVLA quadrant population and exemplars. |
| `relaxed` | (secondary, via circumplex-position proxy) | `valence` | `0.35` | `0.30` | Same basis. Note weaker exemplars exist too (song 25: v=7.9/a=4.7, near-neutral arousal, complicating a clean "relaxed = low arousal" reading). |
| `threatening` | No data | -- | `0` | `0` | DEAM offers no way to distinguish "menace/threat" from other negative-valence, high-arousal states (anger, excitement, tension all occupy similar VA space). Assigning `threatening` to the LVHA quadrant would overreach beyond what valence/arousal alone can support. |
| `safe` | No data | -- | `0` | `0` | Same reasoning as `threatening`. |
| `unstable` | No data | -- | `0` | `0` | No motion/order/chaos judgment in this dataset. |
| `stable` | No data | -- | `0` | `0` | Same as `unstable`. |
| `beautiful` | No data | -- | `0` | `0` | DEAM measures felt valence/arousal response, not aesthetic/craft judgment; the two are related in general affect research but not equivalent, and DEAM does not test aesthetic appraisal separately. |
| `harsh` | No data | -- | `0` | `0` | Same reasoning as `beautiful`; timbral harshness is not annotated. |
| `nostalgic` | No data | -- | `0` | `0` | No temporal/memory-association judgment in this dataset. |
| `unsentimental` | No data | -- | `0` | `0` | Same as `nostalgic`. |
| `intimate` | No data | -- | `0` | `0` | No proximity/closeness judgment in this dataset. |
| `distant` | No data | -- | `0` | `0` | Same as `intimate`. |
| `commanding` | No data | -- | `0` | `0` | DEAM does not collect a dominance/power rating (unlike Warriner or NRC-VAD, which include a "D" axis) -- only valence and arousal were annotated for this corpus. |
| `delicate` | No data | -- | `0` | `0` | Same as `commanding`. |

## Candidate New/Renamed Descriptors

DEAM's numeric-only, no-metadata format means it cannot suggest new
vocabulary the way a lexicon or a labeled-abstract source could. Its
contribution is structural validation rather than new candidate words:

- **No new descriptor proposed.** Instead, DEAM's data supports a
  *structural* distinction already implicit in V1's dimension layout: keep
  `energetic`/`subdued` as arousal-primary with at most a weak valence
  secondary (per findings above), and keep `tense`/`relaxed` as a separate
  compound construct requiring both valence and arousal evidence to fire
  confidently. Collapsing these into a single "energy" axis would be
  inconsistent with the observed quadrant structure (all four VA quadrants
  are populated, just unevenly).
- Consider (tag: **rename-consideration**, not a strong recommendation)
  whether `subdued` should be explicitly scoped to audio/pacing energy
  only (arousal), with documentation clarifying it is *not* a sadness cue,
  given how weak the valence association is in this data (norm ~-0.15 to
  -0.24 at best). This is a documentation/weighting caution more than a
  renaming need.

## Conflicts / Cautions

- **Valence and arousal are moderately correlated (r=0.59) in this music
  corpus**, not orthogonal. V1's structure implicitly treats `valence` and
  `arousal` as independent axes (separate descriptor pairs, separate
  dimensions). That is still the right mathematical design for the tone
  vector, but calibrators should expect real media to cluster along the
  happy-energetic / sad-calm diagonal more than the off-diagonal
  (sad-energetic="tense", happy-calm="relaxed/content") combinations. Rare
  does not mean invalid -- tense and relaxed content clearly exist in the
  data (12-13% of songs each) -- but scoring pipelines should not be
  surprised if independent descriptor firing is less common than the
  diagonal cases.
- **`subdued` is not a valence cue.** The most straightforward risk this
  source flags: an assumption that "low energy" implies "sad" is only
  weakly supported (bottom-arousal-quartile mean valence norm ~-0.24, and
  even the most extreme low-arousal songs don't fall below norm ~-0.43).
  Treat `subdued` as arousal-dominant with, at most, a weak valence
  secondary weight.
- **DEAM's music selection is royalty-free/Creative-Commons sourced (Free
  Music Archive and similar), not mainstream commercial or cinematic
  score music.** This is a domain-fit caution: Media Manager assets likely
  include film/video score conventions (e.g. suspense scoring, source
  music, sound design) that may not be well represented by DEAM's
  catalogue. Extrapolating DEAM's quadrant proportions to "how media tone
  behaves" generally should be done cautiously.
- **No dominance axis in this dataset.** Unlike Warriner or NRC-VAD, DEAM
  does not collect a Mehrabian/Russell-style dominance/power rating, so it
  cannot cross-validate `commanding`/`delicate` at all, despite dominance
  being one of the three "core" VAD dimensions the brief calls out.
- **Static (song-level) annotations are single time-collapsed judgments
  over often 45-second excerpts**; the dynamic per-second files (also
  present locally) would be needed to check within-song volatility
  (potentially relevant to `instability`), but per-second values alone
  still carry no lexical/label information and would only support
  volatility-of-VA-trajectory as a very indirect proxy for `instability` --
  not attempted here since it exceeds what a straightforward song-level
  analysis can responsibly claim without further methodological work
  (e.g., defining a volatility threshold).
- **Rater pool and cultural framing**: DEAM annotations come from
  crowd-sourced (student/MTurk-style) raters using a discrete 9-point SAM
  scale; per-song standard deviations in the raw CSV (not fully
  tabulated above) show meaningful inter-rater spread on many songs,
  especially in the low-arousal range, meaning individual song ratings
  carry more uncertainty than the aggregate corpus-level statistics do.

## Source Quality Note

**Primary, full data** -- these are the actual raw/averaged annotation CSVs
from the DEAM release (1,802 valid song rows recovered from the two
provided static-annotation files, plus full dynamic per-second and
per-rater files, all present locally and read directly for this analysis).
Confidence in the extracted numeric statistics themselves (means, ranges,
correlation, quadrant counts) is high -- computed directly from the raw
CSVs with no secondary interpretation layer.

Confidence in this source's *applicability to descriptor-level mapping* is
necessarily lower and clearly bounded: DEAM contains zero lexical, genre,
title, or textual metadata, so every descriptor-level finding above beyond
`valence`/`arousal` extremes is an inference from VA structure via
circumplex-model reasoning, not a direct DEAM measurement. This has been
flagged per-row in the Descriptor Findings table (confidence <= 0.55
throughout, and 0 for the 12 descriptors DEAM cannot speak to at all).
Cross-referencing DEAM's VA structure against a lexicon that also reports
arousal (Warriner, NRC-VAD) is recommended before finalizing weights, since
those sources can anchor the *words* while DEAM anchors the *space*.

Sources:
- [Developing a benchmark for emotional analysis of music (PLOS ONE)](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0173392)
- [DEAM: MediaEval Database for Emotional Analysis in Music (manual)](https://cvml.unige.ch/databases/DEAM/manual.pdf)
