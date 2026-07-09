# Russell (1980), "A Circumplex Model of Affect" -- Research Findings

## Citation

Russell, J. A. (1980). A circumplex model of affect. *Journal of Personality and Social Psychology*, 39(6), 1161-1178.

- No freely-licensed full text was available to this agent. A candidate open PDF mirror (`http://pdodds.w3.uvm.edu/research/papers/others/1980/russell1980a.pdf`) was fetched but is a scanned copy with OCR quality too degraded to extract reliable quotes or the original word-list/angle table, and this environment cannot render the PDF to images (`pdftoppm`/poppler not installed) for visual reading. Findings below rely on:
  - `research/tone-taxonomy-v2/sources/russell-1980/secondary-summary-circumplex.md` (Wikipedia "Emotion classification", fetched 2026-07-08 by the source-prep step).
  - Posner, Russell, & Peterson (2005), "The circumplex model of affect: An integrative approach to affective neuroscience, cognitive development, and psychopathology," *Development and Psychopathology*, 17(3), 715-734 -- open-access review co-authored by Russell that restates the 1980 model's two axes, method, and quadrant structure. Fetched via WebFetch from PMC: https://pmc.ncbi.nlm.nih.gov/articles/PMC2367156/
  - General web search confirming the canonical 8-point circular layout (pleasure 0°, excitement 45°, arousal 90°, distress 135°, displeasure 180°, depression 225°, sleepiness 270°, relaxation 315°) attributed to the 1980 paper.

## Scope & Relevance

Russell (1980) is a **structural/theoretical** paper, not a word-rating lexicon. It proposes that affective experience is organized in a two-dimensional circular space defined by:

- **Valence** (pleasure-displeasure, horizontal axis)
- **Arousal** (activation-deactivation, vertical axis)

derived from multidimensional scaling / factor analysis of similarity judgments on emotion-denoting words and facial expressions, later replicated cross-culturally.

**Directly informs:** `valence`, `arousal`, and by combination, the *quadrant* character of affect (e.g., high-arousal + negative-valence ≈ fear/distress territory, which is directionally useful for `tension` and `menace`; low-arousal + positive-valence ≈ contentment/relaxation territory, directionally useful for `warmth`/`beauty`-adjacent calm states).

**Explicitly does not include a third axis.** The reviewed sources note the model treats valence and arousal as sufficient, with no dominance/potency dimension -- that addition comes from a separate line of work (Mehrabian & Russell's 1974 PAD model, a different source in this research set). This paper should **not** be cited as direct support for V1's `dominance` dimension.

**Silent (no evidence, direct or indirect) on:** `dominance`, `warmth`, `intimacy`, `instability`, `nostalgia`, `beauty`. These are media-specific or otherwise outside the two-axis core-affect model; any values below for these dimensions are the agent's own weak inference from the valence/arousal quadrant a descriptor would occupy, not something Russell measured, and are flagged as low-confidence accordingly.

Because this is a structural paper with no per-word numeric ratings, the "Source Value/Rating" column below reports the **qualitative circumplex quadrant/angle** a descriptor's associated affect state would occupy (per the 8-point layout: pleasure 0°, excitement 45°, arousal 90°, distress 135°, displeasure 180°, depression 225°, sleepiness 270°, relaxation 315°), not a measured score.

## Descriptor Findings

| Descriptor | Source Value/Rating | Suggested Dimension | Suggested Weight [-1,1] | Confidence [0,1] | Basis |
|---|---|---|---:|---:|---|
| `uplifting` | Near "pleasure" (0°) / "excitement" (45°) -- positive valence, neutral-to-high arousal | valence | 0.75 | 0.60 | Circumplex quadrant placement of positive-affect, activated states. |
| `uplifting` | as above | arousal | 0.25 | 0.35 | "Excitement" sector implies mild positive arousal association; weaker and context-dependent. |
| `melancholic` | Near "depression" (225°) -- negative valence, low arousal | valence | -0.75 | 0.60 | Depression sector is the canonical low-arousal negative-valence pole. |
| `melancholic` | as above | arousal | -0.30 | 0.40 | Depression sector implies low activation, but "melancholic" in media use can co-occur with tense/quiet music, so weaker confidence. |
| `energetic` | Near "arousal" (90°) -- high activation, roughly valence-neutral | arousal | 0.80 | 0.65 | Arousal is a named pole of the circle itself; strongest direct hit in the model. |
| `energetic` | as above | valence | 0.20 | 0.25 | Model places pure "arousal" near-neutral on valence; colloquial "energetic" skews mildly positive but this is outside Russell's data. |
| `subdued` | Near "sleepiness" (270°) -- low activation, roughly valence-neutral-to-negative | arousal | -0.75 | 0.60 | Sleepiness is the canonical low-arousal pole. |
| `subdued` | as above | valence | -0.15 | 0.25 | Sleepiness sits closer to displeasure than pleasure on the circle, but only mildly; weak signal. |
| `warm` | Not on the circle; nearest analog is "relaxation" (315°)/"pleasure" (0°) sector -- positive valence, low-moderate arousal | valence | 0.40 | 0.30 | Loose inference from the pleasant/calm quadrant; Russell does not measure interpersonal warmth. |
| `cold` | Russell silent -- no circumplex position corresponds to "emotional distance" specifically | -- | -- | -- | No basis; "cold" is an interpersonal/temperature metaphor outside core affect. |
| `tense` | Near "distress" (135°) -- negative valence, high arousal | tension | 0.80 | 0.55 | V1's primary mapping for this descriptor; distress sector is the direct circumplex analog of a tense state. |
| `tense` | as above | valence | -0.55 | 0.55 | Distress sector is squarely negative-valence. |
| `tense` | as above | arousal | 0.70 | 0.60 | Distress sector is squarely high-arousal; one of the model's cleanest quadrant fits. |
| `relaxed` | Near "relaxation" (315°) -- positive valence, low arousal | tension | -0.80 | 0.55 | Direct antonym mapping; "relaxation" is a named pole of the circle. |
| `relaxed` | as above | valence | 0.55 | 0.55 | Relaxation sector is mildly-to-moderately positive valence. |
| `relaxed` | as above | arousal | -0.75 | 0.65 | Relaxation sector is unambiguously low arousal; strong direct hit. |
| `threatening` | Near "distress"/"displeasure" (135-180°) -- negative valence, moderate-high arousal | menace | 0.70 | 0.45 | Menace is not a circumplex construct, but the fear/alarm affect it evokes sits in the same quadrant as distress. |
| `threatening` | as above | valence | -0.65 | 0.50 | Distress/displeasure quadrant is negative valence. |
| `threatening` | as above | arousal | 0.55 | 0.45 | Threat-related affect is typically activated, but Russell's data don't isolate "threat" as its own labeled point. |
| `safe` | Near "relaxation"/"pleasure" (0-315°) -- positive valence, low-moderate arousal | menace | -0.55 | 0.35 | Weak inverse inference; "safe" is not itself a circumplex-labeled state. |
| `safe` | as above | valence | 0.40 | 0.40 | Pleasant/calm quadrant. |
| `unstable` | Russell silent on instability/order as a construct; nearest loose analog is high-arousal negative-valence ("distress"/"arousal" sector) for the *feeling* of volatility | instability | 0.35 | 0.20 | Speculative; instability is a media-specific construct, not measured by the 2-axis model. |
| `unstable` | as above | arousal | 0.35 | 0.25 | Weak inference only. |
| `stable` | Russell silent; loose analog near "relaxation"/low-arousal sector | instability | -0.30 | 0.20 | Speculative, same caveat as `unstable`. |
| `beautiful` | Russell silent on aesthetic judgment; loose analog near "pleasure" (0°) | beauty | 0.35 | 0.20 | Weak inference from positive-valence quadrant; aesthetic beauty is a distinct construct from core affect. |
| `harsh` | Russell silent; loose analog near "displeasure" (180°) | beauty | -0.35 | 0.20 | Same caveat as `beautiful`. |
| `nostalgic` | Russell silent -- nostalgia is a complex/mixed-valence, low-to-moderate arousal state not represented by a single circumplex point | nostalgia | -- | -- | No usable basis; nostalgia's bittersweet, retrospective quality does not map cleanly onto a single valence-arousal point. |
| `unsentimental` | Russell silent | nostalgia | -- | -- | No basis. |
| `intimate` | Russell silent -- interpersonal closeness is outside the 2-axis core-affect model | intimacy | -- | -- | No basis. |
| `distant` | Russell silent | intimacy | -- | -- | No basis. |
| `commanding` | Russell silent -- dominance/potency explicitly excluded from this model (see Scope & Relevance) | dominance | -- | -- | No basis; do not cite this source for `dominance`. |
| `delicate` | Russell silent | dominance | -- | -- | No basis; see above. |

Blank/`--` weight and confidence cells indicate the source provides no usable evidence, not a zero rating.

## Candidate New/Renamed Descriptors

- **`excited`** (add) -- Fills the high-arousal + positive-valence quadrant (circumplex "excitement," 45°) that V1's axis-aligned pairs (`uplifting`/`melancholic` on valence, `energetic`/`subdued` on arousal) can only approximate by combining two separate descriptors. Direct evidence: valence ~+0.6, arousal ~+0.7, confidence 0.55. Useful for V2's multi-dimension weighting since OpenAI could emit one word instead of stacking two.
- **`alarmed`** or **`distressed`** (add) -- Fills the high-arousal + negative-valence quadrant (circumplex "distress," 135°), distinguishing acute fear/alarm from the calmer `tense` (pressure/suspense) and from `threatening` (external menace judgment). Direct evidence: valence ~-0.6, arousal ~+0.6, confidence 0.5. Would give `menace` and `tension` a cleaner internal-state descriptor separate from the source-of-threat framing `threatening`/`safe` currently carry.
- **`serene`** or **`content`** (add, optional) -- Fills low-arousal + positive-valence (circumplex "relaxation"/"pleasure" boundary) with a calmer, more settled register than `relaxed`, which V1 currently ties to the `tension` dimension rather than `valence`. Weak-to-moderate evidence only (valence ~+0.5, arousal ~-0.6, confidence 0.4); lower priority than the two above since `relaxed` + `warm` may already cover this territory.
- No renames are suggested from this source. Russell's paper does not provide grounds to rename any existing V1 descriptor -- it only supports adding descriptors that sit on the circle's diagonals rather than its axes.

## Conflicts / Cautions

- **`dominance` has no support from this source.** V1 and the brief group `valence`/`arousal`/`dominance` together as "directly supported by affective norm literature," but that framing conflates two different papers: Russell (1980) is explicitly a 2-axis model with dominance/potency left out; the third axis comes from Mehrabian & Russell's later PAD work. Findings for `commanding`/`delicate` should be sourced from the PAD/Mehrabian-Russell or Warriner/NRC agents, not this one.
- **Quadrant inference is not a rating.** Every row above outside `valence`/`arousal`/`tension` (and to a lesser extent `menace`) is this agent's own geometric inference about which circle sector a descriptor's associated feeling would fall in -- Russell never measured `beauty`, `nostalgia`, `intimacy`, `instability`, or `warmth`. These should be weighted as low-confidence, corroborating-only evidence, not primary support, in the final V2 mapping.
- **"Arousal" is overloaded.** The circle's vertical pole is itself labeled "arousal" in the original 8-term layout, which is also the name of a V1 tone dimension. Don't confuse the *labeled circumplex point* "arousal" (a specific high-activation, valence-neutral affect state near 90°) with the *dimension* `arousal` (the full vertical axis) when reading the table above.
- **Valence/arousal independence is approximate, not exact.** The model treats the axes as *near*-orthogonal (a circle, not a strict cross), meaning pure single-axis descriptors like `energetic`/`subdued` still carry a small residual valence tilt per the model's own geometry (see weak secondary valence rows above) -- this argues for the brief's "usually omit unless there is a specific reason" weak-weight bucket rather than zero.
- **Culturally loaded / ambiguous terms:** none flagged by this source specifically -- the circumplex is presented as cross-culturally replicated in the reviewed material, but that claim itself comes from later replication work (e.g., Posner/Russell/Peterson 2005), not the 1980 paper's original (largely Western/English-speaking) samples. Treat "cross-cultural" claims about the original 1980 study with mild caution.

## Source Quality Note

This is a **secondary-summary-only** extraction, per `sources/README.md`: no primary full text of Russell (1980) was accessible to either the source-prep step or this agent (paywalled on ResearchGate/Academia/Scribd; the one open PDF mirror found was an unreadable OCR scan, and this environment lacks the tooling to render it as images). Findings rest on:

1. A pre-fetched Wikipedia summary (`sources/russell-1980/secondary-summary-circumplex.md`), and
2. This agent's supplementary WebFetch of Posner, Russell, & Peterson (2005), an open-access, Russell-co-authored review that restates the 1980 model's structure and method with more precision than the Wikipedia page alone.

Confidence in the *core* claims (two axes, valence/arousal, circular/quadrant structure, no dominance axis) is high -- these are well-corroborated across both secondary sources and near-universal citation practice. Confidence in *specific descriptor placements* is moderate at best (0.4-0.65) for descriptors that map cleanly onto the named circle points (`tense`, `relaxed`, `energetic`, `subdued`, `uplifting`, `melancholic`) and low (0.2-0.3) or absent for everything else, since this paper simply does not contain a word-by-word rating table the way Warriner/ANEW/NRC do. Numeric weights above should be treated as directional/qualitative priors to be corroborated or overridden by the lexicon-based sources (Warriner, NRC-VAD, ANEW) rather than as precise values in their own right.
