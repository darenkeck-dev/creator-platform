# Mehrabian & Russell — "An Approach to Environmental Psychology" (1974) PAD model -- Research Findings

## Citation

Primary (not directly accessed — Internet Archive lending-only):
Mehrabian, A., & Russell, J. A. (1974). *An Approach to Environmental Psychology*. Cambridge, MA: MIT Press.

Source actually read for this report (secondary re-analysis, open access, full text):
Bakker, I., van der Voordt, T., Vink, P., & de Boon, J. (2014). Pleasure, Arousal, Dominance: Mehrabian and Russell revisited. *Current Psychology*. DOI: 10.1007/s12144-014-9219-4.

Local copy: `research/tone-taxonomy-v2/sources/mehrabian-russell-1974/Bakker-2014-PAD-revisited.pdf`

Secondary figure embedded in Bakker et al. (their Fig. 1) is itself reproduced from: Russell, J. A., & Lanius, U. F. (1984). Adaptation level and the affective appraisal of environments. *Journal of Environmental Psychology*, 4(2), 119–135. This is PAD-adjacent circumplex work, not M&R 1974's own original 6-anchor-pair scale — flagged where relevant below.

## Scope & Relevance

This source directly informs 3 of the 10 tone dimensions:

- **valence** — direct hit. Corresponds to PAD's "Pleasure" dimension.
- **arousal** — direct hit. Corresponds to PAD's "Arousal" dimension.
- **dominance** — direct hit, but with an important caveat (see Conflicts section): PAD's "Dominance" is a *felt sense of control/restriction in the observer* (a conative/behavioral construct), historically the weakest and most contested of the three PAD axes (lowest explained variance, debated affective vs. cognitive vs. conative status). It is **not** the same construct as "power, scale, forcefulness" that V1's `dominance` dimension description implies (that is closer to Osgood's "Potency," which the paper explicitly says is *not* comparable to M&R's dominance).

The source is **silent** on the remaining 7 dimensions — it never operationalizes or discusses:

- **warmth** — no adjectives or discussion.
- **tension** — no dedicated construct; only indirectly reachable via the arousal+displeasure quadrant of the pleasure/arousal circumplex (Fig. 1, itself from Russell & Lanius 1984, not M&R's core scale).
- **intimacy** — no adjectives or discussion.
- **instability** — not part of PAD proper. The paper's own theoretical extension (order/variation, Figs. 2–3) discusses chaos vs. rigidity and dullness vs. overstimulation, but this is the *Bakker et al. authors'* 2012 speculative framework layered on top of PAD, not M&R's original construct, and it is not tied back to specific lexical items. Treat as tangential, not load-bearing.
- **nostalgia** — no adjectives or discussion.
- **beauty** — only reachable indirectly via the Fig. 1 circumplex (which includes "beautiful," "pretty," "pleasing" in the pleasant+arousing quadrant), again sourced from Russell & Lanius 1984 rather than M&R's core scale.
- **menace** — no dedicated construct; only reachable indirectly via "fear" as a low-dominance/submissiveness marker (Mehrabian 1996) and via "panicky, forceful, frenzied" in the arousal+displeasure quadrant.

Where I use the word "reaches" or "indirect" below, treat confidence as correspondingly lower — this source gives no numeric or lemma-level ratings (unlike Warriner/NRC); it gives qualitative pole-membership from a literature review of adjective lists used across dozens of PAD studies.

## Descriptor Findings

| Descriptor | Source Value/Rating | Suggested Dimension | Suggested Weight [-1,1] | Confidence [0,1] | Basis |
|---|---|---|---:|---:|---|
| `uplifting` | Positive pole of "Pleasure": aligns with M&R's own anchors happy/pleased/satisfied and Fig.1 pleasant+arousing quadrant ("exciting," "pleasant," "nice," "pleasing") | `valence` | 0.75 | 0.60 | Qualitative match to M&R's core pleasure anchors; word itself not literally rated by source. |
| `melancholic` | Negative pole of "Pleasure," low-arousal region: Fig.1 unpleasant+not-arousing quadrant ("dreary," "dull," "boring," "monotonous") | `valence` | -0.75 | 0.55 | Qualitative match; "melancholic" not a literal M&R anchor word, inferred from low-pleasure/low-arousal quadrant. |
| `melancholic` (secondary) | Same quadrant also carries low arousal | `arousal` | -0.35 | 0.45 | Fig.1 places dreary/dull/boring/monotonous at low-arousal end, consistent with V1's own secondary mapping intuition. |
| `energetic` | Positive pole of "Arousal": M&R's own anchors stimulated/excited/wide-awake; Mehrabian (1996) high end = "wakefulness, bodily tension, strenuous exercise, concentration" | `arousal` | 0.80 | 0.70 | Direct match to M&R's core arousal scale anchors, one of the strongest correspondences in this source. |
| `subdued` | Negative pole of "Arousal": M&R's own anchors relaxed/calm/sleepy; Mehrabian (1996) low end = "sleep, inactivity, boredom, relaxation" | `arousal` | -0.75 | 0.70 | Direct match to M&R's core arousal scale anchors. |
| `warm` | Not addressed | `warmth` | — | 0.00 | Source has no warmth/temperature construct at all. Silent. |
| `cold` | Not addressed | `warmth` | — | 0.00 | Silent, as above. |
| `tense` | Appears literally in Fig.1's arousing+unpleasant quadrant, alongside "panicky, forceful, frenzied, hectic, rushed, intense" | `tension` | 0.70 | 0.50 | `tense` is one of the few V1 words that appears verbatim in the source's reproduced circumplex figure (from Russell & Lanius 1984), giving above-average confidence despite tension not being a core PAD axis. |
| `tense` (secondary) | Same quadrant is high-arousal + low-pleasure | `arousal` | 0.55 | 0.55 | Direct quadrant placement. |
| `tense` (secondary) | Same quadrant is high-arousal + low-pleasure | `valence` | -0.45 | 0.55 | Direct quadrant placement. |
| `relaxed` | Literal low-arousal anchor word in M&R's own scale (stimulated–relaxed); Mehrabian (1996) treats "relaxation" as a marker that recurs across all three PAD dimensions | `tension` | -0.70 | 0.55 | `relaxed` is literally one of M&R's original 3 arousal-scale anchor words — direct textual hit. |
| `relaxed` (secondary) | Core M&R arousal anchor | `arousal` | -0.75 | 0.70 | Direct textual hit on M&R's original arousal scale. |
| `relaxed` (secondary) | Mehrabian (1996) lists "relaxation" among dominance-positive markers (power/boldness/relaxation vs. anxiety/fear/loneliness) | `dominance` | 0.25 | 0.30 | Weak, later (1996) reinterpretation, not the 1974 original; treat as low-confidence secondary signal. |
| `threatening` | Not a PAD term; nearest indirect anchors are "fear" as a low-dominance/submissiveness marker (Mehrabian 1996) and "panicky, forceful, frenzied" in the arousal+displeasure quadrant | `menace` | 0.55 | 0.35 | Indirect, composited from two different (and partly contradictory) parts of the source — see Conflicts. |
| `threatening` (secondary) | Same quadrant is high-arousal + low-pleasure | `arousal` | 0.40 | 0.40 | Fig.1 quadrant placement ("panicky," "forceful," "frenzied"). |
| `threatening` (secondary) | Same quadrant is high-arousal + low-pleasure | `valence` | -0.50 | 0.40 | Fig.1 quadrant placement. |
| `safe` | Nearest indirect anchors: "calm, restful, peaceful, serene, tranquil" (low-arousal+pleasant quadrant) and "power/boldness" pole of dominance (feeling secure/in control) | `menace` | -0.45 | 0.30 | Indirect and composited; source never uses the word "safe" or "threat." |
| `unstable` | Not part of PAD proper. Bakker et al.'s own supplementary order/variation model (Fig. 3, their 2012 framework, not M&R 1974) associates "too little order" with chaos/disharmony | `instability` | 0.30 | 0.20 | Tangential — this is the *2014 authors'* theoretical add-on, not M&R's PAD constructs, and is not tied to specific lexical items. Low confidence. |
| `stable` | Same order/variation model; well-balanced order+variation = "harmony" | `instability` | -0.30 | 0.20 | Same caveat as above. |
| `beautiful` | Appears literally in Fig.1's pleasant+arousing quadrant, alongside "pretty," "pleasing," "nice," "exciting" | `beauty` | 0.55 | 0.35 | Direct textual hit in the reproduced circumplex, but that figure is from Russell & Lanius 1984 (adjacent PAD literature), not M&R's own 1974 scale, and beauty/aesthetics is not a PAD construct — treat as suggestive, not core. |
| `beautiful` (secondary) | Same quadrant | `valence` | 0.40 | 0.40 | Quadrant placement (pleasant pole). |
| `harsh` | Not a literal Fig.1 term; nearest neighbors are "repulsive, unpleasant, uncomfortable, displeasing" (unpleasant+not-arousing) and "forceful, frenzied, tense" (unpleasant+arousing) | `beauty` | -0.40 | 0.30 | Indirect; "harsh" itself never appears in the source. |
| `nostalgic` | Not addressed | `nostalgia` | — | 0.00 | Silent. |
| `unsentimental` | Not addressed | `nostalgia` | — | 0.00 | Silent. |
| `intimate` | Not addressed | `intimacy` | — | 0.00 | Silent. No adjective set in the source touches proximity/privacy. |
| `distant` | Not addressed directly. Extremely weak, speculative link to "loneliness" as a low-dominance marker (Mehrabian 1996) | `intimacy` | -0.15 | 0.15 | Speculative; loneliness describes the felt-isolation of the *observer* under PAD's dominance axis, not the *environment's* intimacy/proximity quality. Flagged as weak/borderline-omit per brief's weight table. |
| `commanding` | Positive pole of "Dominance": M&R's own anchors controlling/influential/autonomous; Mehrabian (1996) adds power/boldness | `dominance` | 0.80 | 0.65 | Direct match to M&R's core dominance-scale anchor adjectives. |
| `delicate` | Negative pole would be M&R's own anchors submissive/controlled/influenced/awed/guided, or Mehrabian (1996) anxiety/infatuation/fear/loneliness — but these describe *emotional submissiveness*, not physical smallness/fragility, which is what V1 defines `delicate` as | `dominance` | -0.55 | 0.40 | Directional match only (both "low dominance") but conceptual mismatch in what the low pole means — see Conflicts. Confidence reduced accordingly. |

## Candidate New/Renamed Descriptors

- **`exciting`** (add, `valence`+`arousal`) — appears verbatim in Fig.1's pleasant+arousing quadrant alongside "stimulating," "sensational," "exhilarating." Distinct from `energetic` in that it carries a positive-valence connotation as well as high arousal, whereas `energetic`/`subdued` in V1 are pure-arousal descriptors. Useful because OpenAI commonly emits "exciting" for media and it currently has no clean V1 home. Suggested: valence +0.55, arousal +0.7, confidence 0.5.
- **`submissive`** (candidate rename/add for dominance-negative pole) — this is literally M&R's own antonym for "dominant" (controlling/influential/autonomous vs. submissive/controlled/influenced/awed/guided). It is a *closer* PAD match than V1's current `delicate`, which describes physical fragility rather than felt lack of control. Recommend adding as a second negative-dominance descriptor rather than replacing `delicate` outright, since `delicate` is more useful for describing visual/audio texture (a media-relevant sense V1 clearly wants) while `submissive` better captures the PAD psychological construct. Suggested: dominance -0.75, confidence 0.55.
- **`serene`/`tranquil`** (candidate add for `tension` negative pole, or as a synonym pool for `relaxed`) — appears in Fig.1's calm+pleasant quadrant alongside restful/peaceful/calm. Marginal value over existing `relaxed`; only worth adding if OpenAI needs more paraphrase coverage. Suggested: tension -0.5, arousal -0.5, confidence 0.4.
- **`dreary`/`monotonous`** (candidate add for `valence`/`arousal` low-low quadrant) — appears in Fig.1's unpleasant+not-arousing quadrant. Could sharpen the negative-valence+negative-arousal combination that `melancholic` currently has to carry alone. Suggested: valence -0.5, arousal -0.5, confidence 0.4.

No candidates surfaced for `warmth`, `intimacy`, `nostalgia`, `instability`, or `menace` — this source simply does not touch those constructs; any descriptor set for those dimensions must come from other sources or project judgment.

## Conflicts / Cautions

1. **V1's `dominance` dimension conflates two different constructs that this source explicitly says are NOT comparable.** V1 defines `dominance` as "power, scale, forcefulness, authority, or perceived control." Bakker et al. show that this blends (a) Osgood's **potency** factor (hard-soft, heavy-light, strong-weak — a property of the *stimulus/object*) with (b) M&R's **PAD dominance** (a feeling of control/restriction *in the observer*, conative, not necessarily tied to the object's scale or force). The paper states directly: "dominance and potency are not comparable." For a media tagging system, "commanding" (V1's positive dominance descriptor) most naturally reads as an object-property (potency-like: a huge, forceful shot) rather than an observer-feeling (PAD-like: "I feel in control watching this"). This is worth flagging for human review — the V2 `dominance` dimension should probably be redefined/scoped explicitly as one or the other, since the current wording invites both readings.

2. **Dominance is historically the weakest and most contested PAD axis.** The source reports dominance consistently shows low explained variance vs. pleasure/arousal, and its status (affective vs. cognitive vs. conative) has been debated for 40+ years (Russell 1980, Russell & Pratt 1980, Yani-de-Soriano & Foxall 2006, etc.). Confidence in any PAD-derived `dominance` weight should be capped lower than for `valence`/`arousal` weights, independent of word-level fit.

3. **Arousal is argued to be more cognitive than affective.** Bakker et al. conclude (based on M&R's own word choices — "stimulated," "excited," "wide awake" — and their citation trail through Berlyne/Thayer) that arousal functions more like a cognitive/attentional dimension than a pure affective one, despite M&R's original framing of it as a feeling state. This doesn't change the sign/weight of arousal-related descriptors but is a useful caveat for anyone interpreting `energetic`/`subdued` as purely about "felt energy" rather than also "mental alertness/attentiveness."

4. **`delicate` is a conceptual mismatch for PAD's low-dominance pole.** As noted in the table, PAD's submissive pole is about felt control/autonomy (submissive, awed, guided, fearful, lonely), not physical smallness or fragility. V1's `delicate` ("light, fragile, subtle, low-force") is closer to Osgood's potency-negative pole (soft, light, weak) than to M&R's dominance-negative pole. Treat the dominance weight suggested for `delicate` above as approximate/directional only.

5. **The Fig.1 circumplex adjectives ("beautiful," "tense," "exciting," etc.) are not M&R's own 1974 scale items** — they're reproduced from Russell & Lanius (1984), a related but distinct paper in the same research lineage. I've flagged each row that relies on Fig.1 rather than M&R's core 6-anchor-pair scale (happy-unhappy/pleased-annoyed/satisfied-unsatisfied for pleasure; stimulated-relaxed/excited-calm/wide awake-sleepy for arousal; controlling-controlled/influential-influenced/autonomous-guided for dominance) with correspondingly lower confidence.

6. **"Relaxed" is polysemous across the source's own timeline.** In M&R (1974) it's a low-arousal anchor. In Mehrabian (1996), "relaxation" is repurposed as a marker of *high pleasure and high dominance* as well. These aren't strictly contradictory (a relaxed state can be pleasant, low-arousal, and high-control simultaneously) but it does mean `relaxed` is not a arousal-only descriptor if you trust the later reinterpretation — I've included a low-confidence secondary dominance row for this reason, but it's optional and could reasonably be dropped.

7. **No word-level numeric ratings exist in this source.** Unlike Warriner/NRC/ANEW, Bakker et al. is a discursive literature review, not a rating study. All "weights" above are my qualitative estimates based on which circumplex quadrant/pole a word's near-synonyms fall into, not looked-up numbers. Treat this source as directional/theoretical grounding for `valence`/`arousal`/`dominance`, and cross-check final weights against the quantitative lexicons (Warriner, NRC-VAD) where those cover the same words.

## Source Quality Note

This is a **secondary re-analysis** (per `sources/README.md`), not the original 1974 M&R text (which is Internet-Archive lending-only and was not accessed). Bakker et al. (2014) is itself a peer-reviewed discursive literature review published in *Current Psychology* that directly quotes and tabulates M&R's original adjective lists (Tables 2–4) alongside adjectives from Mehrabian's 1996 follow-up and adjacent circumplex work (Russell & Lanius 1984), so it reliably reproduces the *content* of the original PAD adjective sets even though it is not the primary source document itself.

Confidence in this extraction: high for the general shape of the PAD constructs and their core anchor adjectives (these are quoted directly and repeatedly across the paper's tables); low-to-moderate for any specific numeric weight assigned to a V1 descriptor, since no descriptor in V1's list is quantitatively rated by this source — all weight/confidence values above are qualitative judgments made by inferring pole-membership from quoted adjective lists, not lookups against a rating scale. Where I had to reach past M&R's own core scale (into the Fig.1 circumplex or the theoretical order/variation extension) to find any evidence at all, I've flagged that explicitly and lowered confidence further.
