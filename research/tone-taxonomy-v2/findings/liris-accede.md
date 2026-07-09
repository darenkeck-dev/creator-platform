# LIRIS-ACCEDE: A Video Database for Affective Content Analysis -- Research Findings

## Citation

Baveye, Y., Dellandréa, E., Chamaret, C., & Chen, L. (2015). "LIRIS-ACCEDE: A Video
Database for Affective Content Analysis." *IEEE Transactions on Affective Computing*.
Dataset and protocols: http://liris-accede.ec-lyon.fr/. Companion works cited within:
Baveye et al. (2013), "A large video data base for computational models of induced
emotion," ACII; Baveye et al. (2014), "A protocol for cross-validating large
crowdsourced data," CrowdMM.

Local copy used: `research/tone-taxonomy-v2/sources/liris-accede/Baveye-et-al-LIRIS-ACCEDE-2015.pdf`
(full original paper, primary source).

**Data-access limitation (per `sources/README.md`):** the actual 9,800 video excerpts
and their per-clip valence/arousal ranks/annotations are not available in this session
-- they require a signed EULA emailed to accede@liris.cnrs.fr from an institutional
address (free-email domains refused, up to 1 week turnaround). This report is therefore
built entirely from the paper's reported methodology, aggregate statistics, tables, and
figures (Tables 1-6, Figures 1-4), not from clip-level or word-level lookups. No
descriptor in this report could be checked against a specific video excerpt or an
explicit word-level rating -- LIRIS-ACCEDE is not a lexicon and does not rate words at
all; it ranks *video clips*.

## Scope & Relevance

LIRIS-ACCEDE directly and only measures **valence** and **arousal**, both operationalized
as *induced* (felt-by-viewer) emotion, ranked via crowdsourced pairwise comparison and
quicksort, for 9,800 8-12 second video excerpts from 160 Creative-Commons movies. This
is the paper's entire annotation scope.

- **Directly informs:** `valence`, `arousal` (as a video/film-specific 2D affect
  space, methodologically and via correlated production/perceptual features).
- **Deliberately not measured (explicit design choice):** `dominance`. The paper
  explicitly notes that comparable datasets it surveys -- DEAP, MAHNOB-HCI, EMDB --
  *did* collect dominance ratings using the same Self-Assessment Manikin (SAM,
  Bradley & Lang 1994) that LIRIS-ACCEDE's arousal-axis instructions reference, but
  LIRIS-ACCEDE's authors chose to restrict annotation to the 2D valence-arousal space
  "widely employed" in the literature. This is a stated limitation, not an oversight,
  and should be flagged for the brief's dominance dimension.
- **Never addressed, no data or discussion at all:** `warmth`, `tension`, `intimacy`,
  `instability`, `nostalgia`, `beauty`, `menace`. None of these constructs are named,
  annotated, or discussed anywhere in the paper. Any connection drawn below between
  LIRIS-ACCEDE's reported low-level feature correlates (color, motion, editing pace,
  composition, audio texture) and these media-specific dimensions is this analyst's
  *inference from feature semantics*, not a measured finding of the paper, and is
  flagged as low-confidence and speculative throughout.

Because LIRIS-ACCEDE annotates whole video clips rather than words, it cannot supply a
per-descriptor "rating" the way Warriner/NRC/ANEW can. Its useful contribution to this
project is instead: (1) validating valence-arousal as a workable 2D space specifically
for *video* content (not just text), (2) reporting which low-level audio/visual/editing
features best predict induced valence and arousal in film excerpts (Table 3), which can
sanity-check whether V1's `energetic`/`subdued` and, more speculatively, `beauty`-
adjacent language line up with what actually drives valence/arousal in video, and (3)
supplying an empirical noise ceiling (inter-annotator reliability, regression Pearson's
r ~0.22-0.31) that should temper confidence assigned to any video-derived descriptor
mapping.

## Descriptor Findings

| Descriptor | Source Value/Rating | Suggested Dimension | Suggested Weight [-1,1] | Confidence [0,1] | Basis |
|---|---|---|---:|---:|---|
| `uplifting` | Not a rated word; positive pole of the paper's induced-valence axis is directly analogous to V1's intent. | `valence` | 0.75 | 0.35 | Paper validates a positive/negative valence axis for video (crowdsourced "most positive emotion" comparisons, Sec. 4.2), but the concept is dataset-level, not lexical; no direct word check possible. |
| `melancholic` | Analogous to negative-valence pole; Fig. 4 shows relatively *few* clips fall in the low-arousal + negative-valence quadrant, i.e. "calm sadness" content is comparatively rare in this film corpus. | `valence` | -0.75 | 0.30 | Fig. 4 joint valence-arousal histogram; Sec. 4.3 discussion of quadrant sparsity. Weak secondary signal: if `melancholic` implies low arousal, that combination is under-represented in real film excerpts per this dataset -- a representativeness caution, not a validity objection. |
| `energetic` | Positive pole of induced arousal; best-performing predictive features are explicitly motion/energy-based. | `arousal` | 0.80 | 0.45 | Table 3: top arousal-predictive features are "global activity" (avg. motion-vector magnitude), scene-cut rate, audio wavelet-coefficient std. dev., power-spectrum slope -- all classic energy/motion correlates, directly consistent with V1's definition of `energetic`. |
| `subdued` | Negative pole of induced arousal; inverse of above (low motion, few cuts, flatter audio). | `arousal` | -0.80 | 0.45 | Same Table 3 feature set, inverse direction; also "audio flatness envelope" (a top-10 arousal feature) aligns with a "subdued" audio read. |
| `warm` | Not addressed. | `warmth` | -- | 0.0 | No warmth-related annotation, feature, or discussion anywhere in the paper. |
| `cold` | Not addressed. | `warmth` | -- | 0.0 | Same. |
| `tense` | Not directly measured as a separate axis. Speculative link: high-arousal + negative-valence content is well represented in the corpus (per Fig. 4, unlike the low-arousal/negative-valence corner) and would plausibly be labeled "tense" if categorized. | `tension` | 0.35 | 0.15 | Inference from Fig. 4 quadrant density only; the paper never names or annotates "tension." Flag as speculative. |
| `relaxed` | Same inference in reverse: low arousal + neutral/positive valence. | `tension` | -0.35 | 0.15 | Same caveat as above. |
| `threatening` | Not measured. Corpus does contain Horror (~9%) and Thriller (~7%) genre content by movie count (Fig. 1), so threatening material is present in the source movies, but no threat/menace-specific rating or feature was collected or reported. | `menace` | 0.25 | 0.10 | Fig. 1 genre distribution only establishes presence of genre content likely to contain threatening material; no valence/arousal-to-menace mapping is reported. Very weak, indirect. |
| `safe` | Not addressed. | `menace` | -- | 0.05 | No data. |
| `unstable` | Not measured as a construct. Weakly suggestive: "compositional balance" (Luo & Tang photo/video quality feature) is one of the 17 selected valence-predictive features (Table 3, #9), and editing pace (scene-cut rate, #2 arousal feature) is a top arousal predictor -- both could metaphorically relate to felt visual "instability," but the paper frames them purely as valence/arousal predictors, not as an instability axis. | `instability` | 0.20 | 0.10 | Table 3 feature list, semantic inference only -- not a measured instability rating. |
| `stable` | Inverse of above (compositional balance, low cut rate). | `instability` | -0.20 | 0.10 | Same caveat. |
| `beautiful` | Not measured as a labeled construct, but the single **best-performing feature for predicting induced valence** is "colorfulness" (Hasler & Süsstrunk 2003), followed by "hue count," with "compositional balance" and harmonious-color-template features also in the top-17 valence set. These are conventional aesthetic/production-quality proxies. | `beauty` (secondary: `valence`) | 0.45 | 0.30 | Sec. 5.2 / Table 3: colorfulness (#1), hue count (#2), compositional balance (#9), harmonization/orientation-of-harmonious-template features all selected among the 17 best valence-predictive features. Reasonable but inferential bridge from "what predicts positive induced valence in video" to "what reads as beautiful" -- the paper does not test aesthetic judgment directly. |
| `harsh` | Inverse inference: low colorfulness, poor color harmony/compositional balance correlating with lower induced valence. | `beauty` (secondary: `valence`) | -0.45 | 0.25 | Same feature set, inverse direction; slightly lower confidence since "harsh" implies more than just low color appeal (abrasiveness, discord) which the paper's features only partially capture. |
| `nostalgic` | Not addressed. | `nostalgia` | -- | 0.0 | No data; the paper's movie corpus spans many eras/styles (documentary to animation) but no period/nostalgia-related feature or annotation is reported. |
| `unsentimental` | Not addressed. | `nostalgia` | -- | 0.0 | Same. |
| `intimate` | Not addressed at all -- no shot-scale, proxemics, or interpersonal-closeness feature or annotation appears anywhere in the paper. | `intimacy` | -- | 0.0 | No data. Explicitly flagged in the brief as a term this source should help calibrate; it does not. |
| `distant` | Not addressed. | `intimacy` | -- | 0.0 | Same. |
| `commanding` | Not measured -- dominance was deliberately excluded from LIRIS-ACCEDE's protocol (see Scope & Relevance). | `dominance` | -- | 0.0 | Sec. 2.1 background discussion: contrasts LIRIS-ACCEDE's 2D (valence/arousal) protocol against DEAP/MAHNOB-HCI/EMDB's 3D (valence/arousal/dominance) protocols; LIRIS-ACCEDE explicitly omits dominance. |
| `delicate` | Not measured, same reason. | `dominance` | -- | 0.0 | Same. |

## Candidate New/Renamed Descriptors

All candidates below are **weak, feature-inferred suggestions**, not word-level findings
from a lexicon -- treat as lower-confidence than anything from Warriner/NRC/ANEW.

- `vivid` / `colorful` -- **add**, `beauty`/`valence` positive. Rationale: "colorfulness"
  and "hue count" are literally the #1 and #2 best-performing predictors of induced
  valence in this video dataset (Table 3). A descriptor keyed directly to color richness
  would track the strongest empirical video-valence signal in the paper more precisely
  than the more diffuse `beautiful`.
- `kinetic` / `frenetic` -- **add**, `arousal` positive (secondary `instability` weak
  positive). Rationale: "global activity" (motion magnitude) and scene-cut rate are the
  #1 and #2 arousal-predictive features; a descriptor naming edit pace/motion directly
  would be more OpenAI-legible from visual cues than `energetic` alone, which is
  audio/mood-oriented in V1's current description.
- `static` / `still` -- **add**, `arousal` negative. Inverse of the above; useful
  complement to `subdued` for video-specific low-motion, low-cut-rate content.
- Do **not** add a distinct "dominance-visual" descriptor pair from this source -- since
  LIRIS-ACCEDE deliberately excluded dominance, it offers no basis for refining
  `commanding`/`delicate`.

## Conflicts / Cautions

- **Induced vs. depicted/perceived emotion.** LIRIS-ACCEDE annotators rated what *they
  felt* watching the clip, not what emotion the clip's content depicts or a character
  feels (Sec. 6, citing Zentner et al. 2008 showing felt vs. perceived ratings differ
  significantly). Media Manager's tone taxonomy is closer to a "depicted/perceived tone"
  use case (tagging what an asset *is*, for retrieval), not "how a viewer will feel." Any
  weights drawn from this paper should be treated as directionally suggestive, not as a
  validated match to the taxonomy's actual use case.
- **Ranks are relative/ordinal, not absolute.** The 9,800 excerpts are only ranked
  relative to *each other* within this specific corpus (0-9799), not on an absolute
  valence/arousal scale. The paper's own Sec. 6 flags this as a limitation and reports a
  secondary controlled-SAM-rating validation study (SRCC = 0.751 arousal, 0.795 valence,
  n=46) to partially address it, but that absolute-scale sub-study's actual values were
  not reproduced in this paper (only the correlation coefficients) and were not
  independently available to this research pass.
- **Noisy ground truth.** Fleiss' kappa (0.179-0.190) and Krippendorff's alpha
  (0.180-0.191) are low; the paper argues this is a prevalence artifact of the
  forced-choice pairwise protocol and that Randolph's kappa (0.375-0.452, "fair" to
  "moderate" per Landis & Koch) is the fairer read, but even the paper's own best
  regression baseline only reaches Pearson's r ~ 0.22-0.31 against held-out data
  (Table 4). Video-derived valence/arousal signal is real but weak/noisy at the
  individual-clip level -- confidence values assigned to any V2 mapping justified by this
  source should stay conservative.
- **No word-level ground truth exists in this source.** Every mapping in the table above
  that isn't `valence`/`arousal` is this analyst's inference from feature *names*
  (colorfulness, compositional balance, global activity, etc.) rather than from any
  rating the paper assigned to the taxonomy's actual keywords. This is a materially
  different (weaker) kind of evidence than a lexicon lookup and should not be blended
  with Warriner/NRC/ANEW confidence scores without discounting.
- **Genre distribution is not a valence/arousal/menace lookup.** Fig. 1's genre
  percentages (Horror ~9%, Thriller ~7%, etc.) establish that threatening/violent content
  exists in the corpus; they say nothing about how that content ranked on valence or
  arousal, since Table 5's genre-level results report only regression MSE (model error),
  not average affect scores per genre.
- **Data-access gap.** Because raw clips/annotations were not obtainable in this session
  (EULA required, see Citation section), none of the above could be cross-checked
  against actual per-clip data, e.g. "do clips rated most-negative-valence actually get
  tagged 'threatening' by a human reviewer?" That validation step is unavailable here.

## Source Quality Note

This is a **primary paper, full text**, read directly from the source PDF (not a
secondary summary). However, its evidentiary value for this taxonomy project is
structurally limited relative to lexicon sources (Warriner, NRC, ANEW): LIRIS-ACCEDE is
a *video ranking dataset paper*, not a word-affect lexicon, so it contains zero
word-level ratings for any of V1's 20 descriptors. Everything reported here beyond the
`valence`/`arousal` axis validation is inference from the paper's reported top-performing
low-level features (Table 3) and aggregate structural findings (Figs. 1, 3, 4; Tables
1-6), explicitly marked with low confidence scores (mostly 0.0-0.35) to reflect that gap.
The one solid, directly-supported finding is that LIRIS-ACCEDE independently validates a
2D valence-arousal space as workable for ranking video excerpts by induced emotion
(consistent with Russell's circumplex model referenced elsewhere in the brief), while
explicitly declining to extend that to a third dominance axis -- both facts useful for
scoping the brief's `valence`/`arousal`/`dominance` treatment, but neither one moving the
needle on the media-specific dimensions (`warmth`, `tension`, `intimacy`, `instability`,
`nostalgia`, `beauty`, `menace`) beyond speculative feature-name inference.
