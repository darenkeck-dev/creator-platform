# Tone Taxonomy V2 — Research Synthesis Report

**Run date:** 2026-07-08
**Model:** Claude Sonnet 5 (`claude-sonnet-5`) — used for all 9 `tone-research-agent` runs and the `tone-taxonomy-synthesizer` run
**Methodology:** 9 sources (`research/tone-taxonomy-v2/sources/`) were each researched independently and in parallel by a dedicated `tone-research-agent` instance, writing one findings doc per source to `research/tone-taxonomy-v2/findings/`. A single `tone-taxonomy-synthesizer` pass then cross-referenced all 9 findings docs against the V1 taxonomy and brief to produce this report. Source-reliability weighting (see below) was based on data access level — primary full-data lexicon vs. secondary summary vs. paper-without-data — not publication recency; in this source set the two happen to correlate, since the oldest theory papers (Osgood 1957, Russell 1980, Mehrabian & Russell 1974) predate open lexicon/dataset distribution and so have no downloadable primary data.

**Source-reliability framing used throughout:** Warriner, NRC-VAD, ANEW, and NRC-EmoLex are primary, full-data lexicons and are weighted most heavily whenever they conflict with a secondary source. Mehrabian & Russell 1974 is represented only via Bakker et al. 2014, a secondary-but-strong re-analysis — reliable for construct-level claims, low-confidence for word-level numeric claims. Osgood 1957 and Russell 1980 have no primary text available (per `sources/README.md`) and are treated as conceptual/historical framing, downweighted whenever they conflict with a primary lexicon. DEAM is primary full data but purely numeric/structural (no lexical content). LIRIS-ACCEDE is a primary paper but its raw clip-level data was not obtainable (EULA-gated); every non-valence/arousal claim from it is feature-name inference, the weakest-confidence source in this synthesis.

## 1. Recommended Descriptor Set

All 20 active V1 descriptors are recommended to **keep** — no source provides strong enough, convergent evidence to justify outright removal. Several show weak or conflicting signal (flagged in Section 4) and get optional rename-consideration notes rather than a mandatory rename, since no replacement word is unambiguously better-attested across multiple sources. 11 new descriptors are recommended as **add**, chosen only where at least two independent sources corroborate. The 3 V1 system labels (`neutral`, `balanced`, `ambiguous`) are unaffected and should be kept as-is.

- **valence**: Positive: `uplifting` (keep), `joyful` (add). Negative: `melancholic` (keep), `sad` (add).
- **arousal**: Positive: `energetic` (keep), `exciting` (add). Negative: `subdued` (keep).
- **dominance**: Positive: `commanding` (keep). Negative: `delicate` (keep, weight downgraded), `fragile` (add).
- **warmth**: Positive: `warm` (keep), `cozy` (add). Negative: `cold` (keep).
- **tension**: Positive: `tense` (keep, arousal secondary downgraded), `suspenseful` (add). Negative: `relaxed` (keep), `peaceful` (add).
- **intimacy**: Positive: `intimate` (keep). Negative: `distant` (keep).
- **instability**: Positive: `unstable` (keep), `chaotic` (add). Negative: `stable` (keep).
- **nostalgia**: Positive: `nostalgic` (keep — project judgment). Negative: `unsentimental` (keep — project judgment).
- **beauty**: Positive: `beautiful` (keep), `gorgeous` (add). Negative: `harsh` (keep), `ugly` (add).
- **menace**: Positive: `threatening` (keep), `dangerous` (add). Negative: `safe` (keep).

## 2. Descriptor Mapping Table

| Descriptor | Status | Primary Dimension | Primary Weight | Secondary Mappings | Research Basis | Notes |
|---|---|---|---:|---|---|---|
| `uplifting` | keep | `valence` | `0.65` | `arousal:0.20` | ANEW proxy avg 0.62; Warriner direct 0.55; NRC-VAD direct 0.54; M&R/Osgood/Russell/DEAM/LIRIS all convergent | Strongly convergent across all 9 sources. |
| `joyful` | add | `valence` | `0.80` | — | ANEW exact match; Warriner direct 0.80 | Cleaner companion/alternative to `uplifting`. |
| `melancholic` | keep | `valence` | `-0.75` | `arousal:-0.30`, `nostalgia:0.30` | NRC-VAD direct -0.64; EmoLex clean sadness+negative flags; DEAM -0.80; Osgood/Russell/M&R -0.75 to -0.85 | `nostalgia` secondary is a **project-specific prior**, not research-backed (EmoLex flags this explicitly). Adjective form absent from ANEW/Warriner. |
| `sad` | add | `valence` | `-0.75` | — | Warriner direct -0.73; ANEW proxy avg -0.82 | Companion/alternative to `melancholic`. |
| `energetic` | keep | `arousal` | `0.75` | `valence:0.35` | DEAM 0.80; LIRIS 0.80; M&R 0.80; NRC-VAD 0.74; Osgood/Russell 0.80-0.85 | Warriner (0.35) and ANEW proxy (0.36) show a weaker signal — flagged disagreement, resolved via 6-source majority. |
| `exciting` | add | `arousal` | `0.65` | `valence:0.55` | M&R Fig.1 quadrant (literal word); Russell circumplex "excitement" 45° (literal named point) | Theoretical/qualitative sources only — moderate confidence. |
| `subdued` | keep | `arousal` | `-0.70` | `valence:-0.15` | ANEW direct -0.53; Warriner direct -0.55; M&R -0.75; DEAM -0.80; LIRIS -0.80; Osgood/Russell -0.75/-0.85 | NRC-VAD is a lone outlier (-0.08) — see Section 4.4. |
| `warm` | keep | `warmth` | `0.60` | `valence:0.30` | Indirect across all sources: ANEW proxy 0.57; NRC-VAD indirect 0.50; Warriner indirect 0.70 | Osgood finds warmth loads onto Evaluation/valence, not independent — Section 4.3. |
| `cozy` | add | `warmth` | `0.70` | `valence:0.55`, `arousal:-0.25` | Warriner 0.57/-0.36/0.42; NRC-VAD 0.82/-0.29/0.09 | Stronger, cleaner anchor than `warm`. |
| `cold` | keep | `warmth` | `-0.45` | `valence:-0.20` | ANEW -0.25; NRC-VAD -0.30; Warriner -0.55 | Three sources flag dilution by literal-temperature senses. |
| `tense` | keep | `tension` | `0.55` | `valence:-0.45` | Russell 0.80; M&R 0.70; ANEW 0.38; DEAM 0.45 | NRC-VAD (-0.12) and Warriner (0.08) — the two largest VAD lexicons — show near-zero arousal; EmoLex zero flags. Arousal secondary intentionally omitted. See Section 4.4. |
| `suspenseful` | add | `tension` | `0.65` | `arousal:0.55` | NRC-VAD arousal +0.67 | Single-source, addresses the `tense`/arousal gap. |
| `relaxed` | keep | `tension` | `-0.75` | `arousal:-0.70`, `valence:0.50` | Near-unanimous: ANEW -0.65, Warriner -0.65, NRC-VAD -0.80, M&R -0.70, Russell -0.80 | Best-evidenced descriptor pair in the taxonomy. |
| `peaceful` | add | `tension` | `-0.70` | `arousal:-0.75`, `valence:0.65` | ANEW, Warriner, NRC-VAD, EmoLex all convergent | 4 independent sources — strongest-evidenced addition. |
| `threatening` | keep | `menace` | `0.80` | `valence:-0.60`, `arousal:0.45` | EmoLex clean 4-flag cluster (conf 0.85); NRC-VAD indirect 0.80; Russell/M&R/Osgood/ANEW convergent | Absent from ANEW and Warriner (proxy only). |
| `dangerous` | add | `menace` | `0.85` | `valence:-0.65`, `dominance:-0.35` | Warriner -0.67/0.45/-0.61; NRC-VAD -0.96/0.88/0.32; EmoLex clean 2-flag cluster | Near-unanimous consensus; recommend as primary companion to `threatening`. |
| `safe` | keep | `menace` | `-0.75` | `valence:0.55`, `dominance:0.30` | Warriner direct -0.75; ANEW -0.52; NRC-VAD -0.75; EmoLex -0.75 | One of the cleanest, most reliable descriptors. |
| `unstable` | keep | `instability` | `0.60` | `dominance:-0.55`, `valence:-0.40` | NRC-VAD and Warriner: signal driven by negative dominance, not arousal (both near-zero); EmoLex 0.70 | Arousal secondary omitted — flat in both major lexicons. |
| `chaotic` | add | `instability` | `0.65` | `arousal:0.30` | NRC-VAD -0.77/0.69/-0.12; Warriner arousal 0.29; EmoLex anger+negative | Fills the energetic-disorder gap `unstable` lacks. |
| `stable` | keep | `instability` | `-0.55` | `dominance:0.35`, `arousal:-0.35` | NRC-VAD, Warriner, EmoLex convergent | Valence essentially flat in Warriner (0.05). |
| `beautiful` | keep | `beauty` | `0.75` | `valence:0.50` | ANEW 0.65, Warriner 0.80, NRC-VAD 0.75, EmoLex 0.65, M&R 0.55 | Osgood finds beauty loads onto Evaluation, not independent — Section 4.3. |
| `gorgeous` | add | `beauty` | `0.70` | `valence:0.60` | Warriner 0.64/-0.02/0.51; NRC-VAD 0.81/0.02/0.31; EmoLex joy+positive | Cleaner anchor than `beautiful`. |
| `harsh` | keep | `beauty` | `-0.55` | `valence:-0.35` | Convergent across ANEW, NRC-VAD, Warriner, EmoLex, M&R, Osgood, Russell | Conflates texture/severity with aesthetic ugliness (Osgood, ANEW). |
| `ugly` | add | `beauty` | `-0.60` | `valence:-0.30` | Osgood literal Evaluation-factor antonym; EmoLex disgust+negative | Addresses `harsh`'s conflation problem. |
| `nostalgic` | keep | `nostalgia` | `0.45` | — | Warriner weak indirect 0.42 is the only quantitative touchpoint | **Project judgment, not research-backed.** NRC-VAD conflicts (-0.084 valence, -0.63 dominance) with intended "warm bittersweet" sense. Highest-review-need descriptor. |
| `unsentimental` | keep | `nostalgia` | `-0.40` | — | Word absent from Warriner/EmoLex; NRC-VAD indirect -0.50 only touchpoint | **Project judgment, not research-backed.** Optional rename-consideration to `clinical`/`detached` (single-source, not adopted). |
| `intimate` | keep | `intimacy` | `0.60` | `valence:0.35` | ANEW 0.65; Warriner 0.70; NRC-VAD 0.45; EmoLex 0.55 | ANEW and Warriner both flag elevated arousal — possible romantic connotation; arousal secondary omitted, see Section 4.6. |
| `distant` | keep | `intimacy` | `-0.50` | `valence:-0.20` | NRC-VAD -0.55; ANEW proxy -0.46; Warriner -0.55 | Conflict: ANEW proxies import sadness (-0.46) vs. Warriner's near-neutral direct measurement (-0.07). Section 4.5. |
| `commanding` | keep | `dominance` | `0.70` | `valence:0.30` | NRC-VAD 0.85; M&R 0.80; Osgood 0.85; ANEW proxy 0.58 | Warriner outlier (-0.09); Warriner's own noun "command" scores 0.55, closer to consensus — likely adjective/noun norming artifact. Section 4.2. |
| `delicate` | keep | `dominance` | `-0.40` | — | NRC-VAD -0.27 (weak band); Warriner 0.01 (near-zero); M&R -0.55 flagged as conceptual mismatch | Most consistently-flagged weak signal in the dataset; weight downgraded substantially. See Section 4.2. |
| `fragile` | add | `dominance` | `-0.55` | `valence:-0.15` | NRC-VAD -0.75; Warriner -0.25; EmoLex fear+negative+sadness | Strongest multi-source addition; recommended replacement/companion for `delicate`. |

## 3. Dimension-Specific Notes

- **valence** — Research-backed. Strongest-grounded dimension across all 9 sources. Low review need.
- **arousal** — Research-backed, but word-level conflicts exist for `tense`, `subdued`, `unstable` in Warriner/NRC-VAD. Medium-high review need for those specific words.
- **dominance** — Research-backed in theory (Osgood Potency, M&R PAD), contested in practice. Bakker et al. state potency and PAD-dominance "are not comparable"; V1's wording straddles both. Warriner shows the weakest signal for this project's words. Highest review need among the three core VAD dimensions — decide object-potency vs. observer-control before finalizing.
- **warmth** — Hybrid/media-specific, valence-adjacent. No dedicated scale anywhere; Osgood's own groupings place warm-cold inside Evaluation. Medium-high review need.
- **tension** — Hybrid, VA-quadrant-derived. No dedicated construct; word-level arousal for `tense` contradicted by both major VAD lexicons. High review need.
- **intimacy** — Media-specific. No source measures proximity directly; `intimate`'s elevated-arousal reading (2 sources) needs confirmation against intended usage. Medium review need.
- **instability** — Hybrid, dominance-adjacent rather than arousal-adjacent as the name implies. Medium-high review need.
- **nostalgia** — Project-specific, essentially unsupported by any source; NRC-VAD's own reading conflicts with intended usage. Highest review need of all 10 dimensions.
- **beauty** — Hybrid, valence-adjacent (same Osgood caution as warmth). LIRIS gives a low-confidence video-specific proxy (colorfulness/hue). Medium-high review need.
- **menace** — Hybrid but best-supported of the media-specific dimensions; 7 sources independently converge on the same valence-negative/arousal-positive signature. Low-medium review need.

## 4. Conflicts And Ambiguities

1. **Dominance conflates potency and felt control** (Bakker et al./M&R explicit statement) — likely root cause of weak signal for `commanding`/`delicate`. Recommend the V2 dimension description commit to one reading.
2. **`commanding`/`delicate` weak-to-inconsistent dominance**: Warriner shows near-zero for both (outlier vs. NRC-VAD/M&R/Osgood which show `commanding` strong); NRC-VAD flags `delicate` itself as only "weak negative"; M&R flags `delicate`'s negative-dominance reading as a conceptual mismatch (submissive ≠ physically fragile). Resolved by modestly downweighting `commanding` and substantially downweighting `delicate`, recommending `fragile` as companion.
3. **Warmth and beauty may not be orthogonal to valence** — Osgood's scale groupings place warm-cold and beautiful-ugly inside the Evaluation factor. Treated as an accepted design tradeoff for a media-specific enrichment, not a disqualifying finding, reflected in moderate valence secondary weights.
4. **`tense`/`subdued` arousal signal conflicts**: NRC-VAD and Warriner (the two largest lexicons) both show near-zero arousal for `tense`; EmoLex shows zero flags; DEAM's structural data corroborate via quadrant rarity. Resolved by omitting/minimizing `tense`'s arousal secondary and adding `suspenseful`. For `subdued`, NRC-VAD is a lone outlier against 6 other convergent sources — resolved in favor of the majority.
5. **`distant`**: ANEW-proxy words (alone/lonely) import sadness (-0.46) vs. Warriner's direct near-neutral reading (-0.07, disengagement not sadness) — resolved in favor of Warriner's direct measurement, valence secondary downweighted.
6. **`intimate`** carries an unexpected arousal/activation connotation in two independent lexicons (ANEW, Warriner) — possibly romantic/sexual sense dominating ratings; flagged for human review, no arousal secondary assigned.
7. **`nostalgic`** conflicts with intended media-tagging usage — NRC-VAD's direct reading is near-neutral/slightly negative valence and strongly negative dominance, not the "warm bittersweet" sense intended; flagged explicitly as project judgment rather than averaged away.
8. **Culturally loaded / too-broad terms**: `cold` (diluted by literal-temperature/illness senses, 3 sources); `powerful` (EmoLex's own README recommends discarding — 7/10 emotion flags, too polysemous); `tense`/`harsh`/`safe` (multi-sense polysemy noted by NRC-VAD); ANEW's gender-split data shows some menace/intimacy words diverge by rater gender, a caution against treating any one VAD lexicon as culturally universal; LIRIS-ACCEDE's feature-inferred candidates (`vivid`, `kinetic`, `static`) were considered but not adopted — single-source, no lexical rating at all.

## 5. Proposed JSON Shape For `tone-taxonomy/v2`

```json
{
  "schemaVersion": "tone-taxonomy/v2",
  "toneDimensions": ["valence","arousal","dominance","warmth","tension","intimacy","instability","nostalgia","beauty","menace"],
  "descriptors": [
    {
      "descriptor": "melancholic",
      "label": "Melancholic",
      "description": "Sad, subdued, emotionally downcast, or wistful.",
      "status": "keep",
      "mappings": [
        { "dimension": "valence", "weight": -0.75, "confidence": 0.85, "basis": "NRC-VAD direct valence (-0.64); EmoLex clean sadness+negative; convergent with DEAM, Osgood, Russell, M&R." },
        { "dimension": "arousal", "weight": -0.30, "confidence": 0.55, "basis": "NRC-VAD direct arousal (-0.39); corroborated by M&R/Russell quadrant placement." },
        { "dimension": "nostalgia", "weight": 0.30, "confidence": 0.15, "basis": "Project-specific prior, not independently research-backed." }
      ],
      "sourceNotes": ["Research-derived prior for valence/arousal.", "Project-specific prior for nostalgia; flagged, not research-derived."]
    },
    {
      "descriptor": "fragile",
      "label": "Fragile",
      "description": "Vulnerable, breakable, low-force, easily overwhelmed.",
      "status": "add",
      "mappings": [
        { "dimension": "dominance", "weight": -0.55, "confidence": 0.55, "basis": "NRC-VAD (-0.75), Warriner (-0.25), EmoLex fear+negative+sadness -- three independent sources converge." },
        { "dimension": "valence", "weight": -0.15, "confidence": 0.30, "basis": "Warriner direct valence, weak-negative secondary." }
      ],
      "sourceNotes": ["Recommended replacement/companion for `delicate`, whose dominance signal is near-zero across NRC-VAD, Warriner, and M&R."]
    },
    {
      "descriptor": "delicate",
      "label": "Delicate",
      "description": "Light, fragile, subtle, low-force.",
      "status": "keep",
      "mappings": [
        { "dimension": "dominance", "weight": -0.40, "confidence": 0.35, "basis": "NRC-VAD (-0.27, weak band); Warriner (0.01, near-zero); M&R flags conceptual mismatch." }
      ],
      "sourceNotes": ["Weight substantially downgraded from V1's implicit strong-negative framing; see report Section 4.2."]
    }
  ]
}
```

Aggregation follows the brief: `dimensionContribution = descriptorStrengthValue * mappingWeight`, summed per dimension, clamped to `[-1, 1]`. Since several descriptors now carry 2-3 mappings, dampening by descriptor count (e.g., divide by `sqrt(n)` before clamping) is recommended so weak descriptors don't out-vote one strong, well-evidenced one.

## 6. Evaluation Recommendations

**Review set** (20-30 assets, audio + video): (1) high-confidence cases (`relaxed`, `safe`, `threatening`, `beautiful`, `energetic`) as a regression check; (2) flagged-conflict cases stress-testing Section 4 (`tense`/`subdued`, `commanding`/`delicate`, `nostalgic`, `cold`/`distant`, `intimate`); (3) multi-descriptor cases to validate new aggregation/dampening; (4) cases exercising the 11 new descriptors.

**Method**: run identical OpenAI descriptor output through both V1 and V2 mappings to isolate the mapping-layer change; have 2-3 blind human reviewers rate each asset on all 10 dimensions as a reference; compute per-dimension absolute error and vector cosine similarity for V1 vs. V2 against the human reference, broken out by dimension (not just aggregate) since `nostalgia`/`dominance`/`tension`/`warmth` are the highest-review-need dimensions and could hide a regression behind a flat aggregate score. Add a blind A/B summary-preference test if tone vectors feed downstream text, and a retrieval precision@k check against a human-curated "these assets should feel similar" set to test whether the richer multi-dimension weighting actually improves practical retrieval, not just research fidelity. Resolve the `dominance` potency-vs-control definitional ambiguity (Section 4.1) before running human ratings, since an undefined construct would confound reviewer agreement. Version all V2 output under `tone-taxonomy/v2` as a parallel stream; do not overwrite V1-tagged assets.
