# NRC Valence, Arousal, and Dominance Lexicon (v2.1) -- Research Findings

## Citation

Saif M. Mohammad. **"NRC VAD Lexicon v2: Norms for Valence, Arousal, and Dominance for over 55k English Terms."** arXiv preprint arXiv:2503.23547, 2025. https://arxiv.org/abs/2503.23547

Saif M. Mohammad. **"Obtaining Reliable Human Ratings of Valence, Arousal, and Dominance for 20,000 English Words."** Proceedings of ACL 2018, Melbourne, Australia. (Describes v1 methodology: best-worst scaling annotation.)

Homepage: http://saifmohammad.com/WebPages/nrc-vad.html

Local files used: `research/tone-taxonomy-v2/sources/nrc-vad/extracted/NRC-VAD-Lexicon-v2.1/NRC-VAD-Lexicon-v2.1.txt` (main 55k-term file), `README.txt`, and the `MWE/` directory for multi-word expressions. Non-commercial research license; no redistribution of raw data (cite on use).

## Scope & Relevance

NRC VAD **directly and quantitatively measures exactly three of the brief's ten dimensions**: `valence`, `arousal`, and `dominance`. Every term has a real-valued score in `[-1, 1]` for each axis, derived from large-scale human annotation (best-worst scaling in v1, Likert rating for the v2 additions), across ~55,000 unigrams and multi-word expressions.

For the other seven dimensions -- `warmth`, `tension`, `intimacy`, `instability`, `nostalgia`, `beauty`, `menace` -- **this source has no direct construct or scale**. NRC VAD was not designed to measure social warmth, aesthetic beauty, suspense, closeness, chaos, sentimentality, or threat as standalone psychological constructs. Any use of NRC VAD for those seven dimensions is necessarily **indirect**: reading the V/A/D triple of the specific English word that happens to be a V1 descriptor (e.g. "beautiful," "menacing") as circumstantial evidence, since word choice itself carries connotation. This is a materially weaker form of evidence than the direct axis lookups and is flagged with lower confidence throughout.

Note: the README references a companion lexicon, "Words of Warmth" (Fiske-style warmth/competence/sociability/trust norms), which would be the correct primary source for the `warmth` dimension -- but it is listed as "to be made available soon" and was **not included** in this download. So `warmth` remains fully unsupported by primary data in this source folder.

## Descriptor Findings

Raw scores below are exact lookups from `NRC-VAD-Lexicon-v2.1.txt` (columns: valence, arousal, dominance, each `[-1, 1]`). Where a V1 descriptor's assigned dimension is one of valence/arousal/dominance, the NRC score is used directly as basis for weight (high confidence). Where the assigned dimension is media-specific, the NRC triple is used only as indirect, low-confidence circumstantial evidence, and the strongest true NRC signal for that word (usually valence) is reported as a secondary mapping.

| Descriptor | Source Value/Rating (V/A/D) | Suggested Dimension | Suggested Weight [-1,1] | Confidence [0,1] | Basis |
|---|---|---:|---:|---:|---|
| `uplifting` | 0.542 / 0.096 / 0.210 | valence | 0.54 | 0.85 | Direct NRC valence lookup. Arousal (0.10) and dominance (0.21) fall below/near the brief's omit threshold -- no meaningful secondary mapping. |
| `melancholic` | -0.638 / -0.388 / -0.446 | valence | -0.64 | 0.85 | Direct NRC valence lookup. |
| `melancholic` (secondary) | same | arousal | -0.39 | 0.55 | Direct NRC arousal axis, moderate-negative; supports V1's "sad → also low-energy" intuition. |
| `energetic` | 0.694 / 0.736 / 0.804 | arousal | 0.74 | 0.85 | Direct NRC arousal lookup. |
| `energetic` (secondary) | same | valence | 0.69 | 0.65 | Direct NRC valence axis, strong-positive as well. |
| `energetic` (secondary) | same | dominance | 0.80 | 0.6 | Direct NRC dominance axis, strong-positive; "energetic" also reads as forceful/capable. |
| `subdued` | -0.528 / -0.074 / -0.554 | arousal | -0.08 | 0.3 | **Conflict**: direct NRC arousal score is near-zero (-0.074), inside the brief's "usually omit" band, not the strong negative-arousal signal V1 assumes for its arousal-negative descriptor. |
| `subdued` (secondary, stronger signal) | same | valence | -0.53 | 0.7 | Direct NRC valence axis is the strongest and most reliable signal for this word (moderate-strong negative). |
| `subdued` (secondary) | same | dominance | -0.55 | 0.6 | Direct NRC dominance axis, moderate-strong negative -- "subdued" reads more as suppressed/powerless than as literally low-energy. |
| `warm` | 0.520 / -0.376 / 0.170 | warmth (indirect) | 0.50 | 0.4 | No direct NRC "warmth" construct; using the word's own valence as circumstantial proxy for V1's warmth-positive pole. |
| `warm` (secondary, direct) | same | valence | 0.52 | 0.8 | Direct NRC valence axis, strong-positive. |
| `warm` (secondary, direct) | same | arousal | -0.38 | 0.55 | Direct NRC arousal axis, moderate-negative -- notable: "warm" reads as calming, not energizing. |
| `cold` | -0.292 / 0.076 / -0.214 | warmth (indirect) | -0.30 | 0.3 | Indirect proxy via valence; see cautions below -- signal is weak and likely diluted by literal-temperature/illness senses of "cold." |
| `cold` (secondary, direct) | same | valence | -0.29 | 0.6 | Direct NRC valence axis, only mildly negative -- weaker than most other V1 negative-pole words. |
| `tense` | -0.208 / -0.122 / 0.310 | tension (indirect) | -0.30 | 0.2 | **Conflict**: no direct NRC "tension/suspense" construct, and the closest proxy (arousal) is near-zero, contradicting the intuitive high-arousal reading of "tense." Weight/confidence kept low pending human review. |
| `tense` (secondary, direct) | same | arousal | -0.12 | 0.3 | Direct NRC arousal axis; falls in the brief's "omit" band -- flagged, not a usable arousal signal for "tense" as-is. |
| `relaxed` | 0.730 / -0.910 / -0.189 | tension (indirect) | -0.80 | 0.5 | No direct NRC "tension" construct; but the word's own arousal score is an unusually strong, unambiguous calm signal, making "relaxed" a good indirect proxy for tension's negative pole. |
| `relaxed` (secondary, direct) | same | arousal | -0.91 | 0.85 | Direct NRC arousal axis, one of the strongest low-arousal scores in the lexicon subset checked. |
| `relaxed` (secondary, direct) | same | valence | 0.73 | 0.75 | Direct NRC valence axis, strong-positive. |
| `threatening` | -0.858 / 0.750 / 0.304 | menace (indirect) | 0.80 | 0.45 | No direct NRC "menace/threat" construct; strong negative valence + strong positive arousal used as circumstantial proxy. |
| `threatening` (secondary, direct) | same | valence | -0.86 | 0.85 | Direct NRC valence axis, strong-negative. |
| `threatening` (secondary, direct) | same | arousal | 0.75 | 0.8 | Direct NRC arousal axis, strong-positive. |
| `threatening` (secondary, direct) | same | dominance | 0.30 | 0.5 | Direct NRC dominance axis, weak-positive -- notable: threat is associated with the threatener having power/control, not with powerlessness. |
| `safe` | 0.796 / -0.388 / 0.518 | menace (indirect) | -0.75 | 0.45 | Indirect proxy (inverse of threat framing) via valence/dominance combination; no direct NRC menace construct. |
| `safe` (secondary, direct) | same | valence | 0.80 | 0.85 | Direct NRC valence axis, strong-positive. |
| `safe` (secondary, direct) | same | dominance | 0.52 | 0.6 | Direct NRC dominance axis, moderate-positive -- safety correlates with a sense of control/security, not passivity. |
| `unstable` | -0.666 / 0.174 / -0.700 | instability (indirect) | 0.70 | 0.45 | No direct NRC "instability" construct; strong negative dominance used as circumstantial proxy (loss of control ≈ instability). |
| `unstable` (secondary, direct) | same | dominance | -0.70 | 0.7 | Direct NRC dominance axis, strong-negative -- the strongest and most relevant signal for this word. |
| `unstable` (secondary, direct) | same | valence | -0.67 | 0.65 | Direct NRC valence axis, moderate-strong negative. |
| `stable` | 0.450 / -0.592 / 0.470 | instability (indirect) | -0.55 | 0.45 | Indirect proxy via dominance/arousal combination. |
| `stable` (secondary, direct) | same | dominance | 0.47 | 0.6 | Direct NRC dominance axis, moderate-positive. |
| `stable` (secondary, direct) | same | arousal | -0.59 | 0.55 | Direct NRC arousal axis, moderate-strong negative. |
| `beautiful` | 0.750 / 0.228 / 0.296 | beauty (indirect) | 0.75 | 0.4 | No direct NRC "aesthetic beauty" construct; valence used as circumstantial proxy. |
| `beautiful` (secondary, direct) | same | valence | 0.75 | 0.8 | Direct NRC valence axis, strong-positive -- but note valence and beauty are conceptually distinct (a beautiful sad scene is still low-valence). |
| `harsh` | -0.500 / 0.300 / 0.246 | beauty (indirect) | -0.55 | 0.4 | Indirect proxy via valence. |
| `harsh` (secondary, direct) | same | valence | -0.50 | 0.7 | Direct NRC valence axis, moderate-negative. |
| `nostalgic` | -0.084 / -0.298 / -0.632 | nostalgia (indirect) | 0.45 | 0.2 | **Conflict**: no direct NRC nostalgia construct, and the word's own valence is near-neutral/slightly negative (not the warm, bittersweet-positive read media taggers usually intend). Weight kept low-confidence, project judgment dominates. |
| `nostalgic` (secondary, direct) | same | dominance | -0.63 | 0.5 | Direct NRC dominance axis, strongly negative -- "nostalgic" reads as a low-agency, wistful-longing state. |
| `unsentimental` | -0.333 / -0.667 / 0.500 | nostalgia (indirect) | -0.50 | 0.3 | Indirect proxy via valence/dominance combination. |
| `unsentimental` (secondary, direct) | same | dominance | 0.50 | 0.5 | Direct NRC dominance axis, moderate-positive -- reads as clinical self-control rather than pure negativity. |
| `intimate` | 0.448 / 0.196 / -0.214 | intimacy (indirect) | 0.45 | 0.35 | No direct NRC "closeness/proximity" construct; valence used as circumstantial proxy. |
| `intimate` (secondary, direct) | same | valence | 0.45 | 0.7 | Direct NRC valence axis, moderate-positive. |
| `distant` | -0.542 / -0.352 / -0.462 | intimacy (indirect) | -0.55 | 0.35 | Indirect proxy via valence. |
| `distant` (secondary, direct) | same | valence | -0.54 | 0.7 | Direct NRC valence axis, moderate-strong negative. |
| `commanding` | 0.124 / 0.328 / 0.850 | dominance | 0.85 | 0.85 | Direct NRC dominance lookup, one of the strongest positive-dominance scores checked. |
| `commanding` (secondary, direct) | same | arousal | 0.33 | 0.5 | Direct NRC arousal axis, weak-positive. |
| `delicate` | 0.166 / -0.412 / -0.268 | dominance | -0.27 | 0.6 | Direct NRC dominance lookup, but only weak-negative (falls in the brief's "weak negative" band, not a strong pole -- see cautions). |
| `delicate` (secondary, direct) | same | arousal | -0.41 | 0.55 | Direct NRC arousal axis, moderate-negative -- fits "delicate = low-energy, gentle." |

## Candidate New/Renamed Descriptors

All values are exact NRC lexicon lookups (V/A/D):

| Term | V/A/D | Rationale | Tag |
|---|---|---|---|
| `menacing` | -0.916 / 0.760 / 0.286 | Stronger negative-valence, high-arousal signal than `threatening` (-0.858/0.750/0.304); near-identical dominance. Good synonym/rotation for `menace` positive pole, or add alongside `threatening` for variety. | add |
| `chaotic` | -0.770 / 0.694 / -0.116 | Stronger, more polar negative-valence and higher-arousal signal than `unstable` (-0.666/0.174/-0.700) for the `instability` positive pole; dominance is much closer to neutral than `unstable`'s, meaning it isolates the "disorder/energy" sense rather than the "loss-of-control" sense. Could add as a second instability descriptor to give OpenAI two flavors (chaotic=high-energy disorder vs unstable=loss-of-control disorder). | add |
| `disoriented` | -0.546 / 0.286 / -0.546 | Directly matches V1's own `instability` description text ("disorienting"); currently no V1 descriptor actually uses this word. Dominance nearly matches `unstable`'s. | add |
| `welcoming` / `cozy` | 0.810/0.054/0.272 ; 0.820/-0.288/0.090 | Both far stronger positive-valence signals than `warm` (0.520/-0.376/0.170) for the `warmth` positive pole, and less polysemous than "warm" (which also means literal temperature). `cozy` additionally has very low arousal, useful for calm/intimate media contexts. | add or rename candidate for `warm` |
| `eerie` / `foreboding` | -0.470/0.542/-0.116 ; -0.122/0.412/0.272 | Softer menace-adjacent terms than `threatening`/`menacing` -- useful for ambient dread vs. overt danger; media tone tagging often needs this gradation (e.g. horror atmosphere without literal threat). | add |
| `serene` / `peaceful` | 0.604/-0.736/-0.260 ; 0.734/-0.892/0.149 | Both stronger, more unambiguous low-arousal calm signals than `relaxed` (0.730/-0.910/-0.189) is already the strongest of the three on arousal, but `peaceful` carries a positive-dominance connotation (secure calm) vs `relaxed`'s negative-dominance (passive calm) -- worth distinguishing for `tension` negative pole nuance. | add |
| `dangerous` | -0.960 / 0.882 / 0.316 | Near-ceiling negative-valence and positive-arousal; the single most polar menace-adjacent term found. Strong candidate as the canonical `menace` positive-pole anchor if the taxonomy wants maximum signal separation. | add |
| `fragile` | -0.396 / -0.674 / -0.748 | Much stronger negative-dominance signal (-0.748) than `delicate` (-0.268) for the `dominance` negative pole -- see Conflicts below; `delicate`'s dominance score is only "weak negative" per the brief's own weight bands. | add or rename candidate for `delicate` |
| `graceful` / `pleasing` | 0.812/0.020/0.310 ; 0.834/-0.102/0.576 | Both stronger, cleaner positive-valence signals than `beautiful` (0.750/0.228/0.296) for the `beauty` positive pole; `pleasing` has notably high dominance (0.576), differentiating "impressive/masterful" beauty from "delicate" beauty. | add |
| `orderly` | 0.688 / -0.520 / 0.322 | Stronger positive-dominance and lower-arousal signal than `stable` (0.450/-0.592/0.470 dominance) — wait, `stable`'s dominance (0.470) is actually close; `orderly` differs mainly on valence (0.688 vs 0.450), giving a cleaner positive-valence anchor for the `instability` negative pole. | add |
| `wistful` | -0.354 / -0.098 / -0.376 | Closer to V1's `nostalgia` description text ("wistful") than `nostalgic` itself, and shares `nostalgic`'s low-arousal, negative-dominance profile, so it doesn't resolve the valence conflict noted below -- but is a reasonable synonym rotation. | add |

## Conflicts / Cautions

1. **`tense` has near-zero NRC arousal (-0.122)**, landing in the brief's "usually omit" band, directly contradicting the common intuition (and V1's assumption) that "tense" = high arousal. NRC has no direct suspense/tension construct, so this may reflect that lexical "tense" annotators associate more with anxious stillness/dread (freeze response) than kinetic energy. **Recommend human review** before assigning any arousal weight to `tense`; consider `suspenseful` (-0.222/0.667/0.167) instead, which has a much stronger, more intuitive positive-arousal signal.

2. **`subdued` has near-zero NRC arousal (-0.074)**, also in the "omit" band, despite being V1's low-arousal descriptor. Its strongest real signal is valence (-0.528) and dominance (-0.554), suggesting "subdued" in this lexicon reads more as "suppressed/muted" (valence+power) than "low-energy" per se.

3. **`nostalgic` has near-neutral, slightly negative NRC valence (-0.084)** and strongly negative dominance (-0.632). This conflicts with the typical media-tagging use of "nostalgic" as a warm, bittersweet-positive quality. The NRC rating likely reflects the wistful-longing/loss-of-agency sense of the word rather than the sentimental-comfort sense. Treat any nostalgia-dimension weight as **project judgment**, not NRC-derived, per the brief's own framing of `nostalgia` as media-specific.

4. **`cold` is a weak, possibly diluted signal (valence -0.292)** compared to `distant` (-0.542) or `frigid` (-0.562) for a similar "emotionally removed" concept. "Cold" is highly polysemous (literal temperature, illness ["a cold"], unfriendliness), which plausibly pulls its aggregate valence toward neutral. Consider whether `cold` needs a stronger companion term for the warmth-negative pole.

5. **`delicate`'s NRC dominance score (-0.268) is only "weak negative"** per the brief's own weight-range table, not the strong pole one would expect as `commanding`'s (0.850) opposite. `fragile` (-0.748) is a much stronger, cleaner negative-dominance anchor and should be considered as a replacement or addition.

6. **`intimate` and `distant` both show negative NRC dominance** (-0.214 and -0.462 respectively), so the dominance axis does not cleanly discriminate the `intimacy` dimension's poles the way it does for e.g. `commanding`/`delicate`. This confirms the brief's framing of `intimacy` as media-specific rather than NRC-derivable -- do not lean on dominance as a proxy for intimacy.

7. **`safe` and `threatening` both show positive NRC dominance** (0.518 and 0.304). This is a genuinely useful finding, not just noise: threat is associated with the threatening party having power, and safety is associated with a sense of security/control -- but it means dominance cannot be used to *separate* "safe" from "threatening" the way valence and arousal do; only valence/arousal cleanly discriminate `menace`.

8. **Culturally loaded / polysemous terms**: `cold`, `tense`, `harsh`, and `safe` all carry multiple senses (literal temperature/illness, grammatical tense, physical texture, safety-from-harm vs. financial "safe") that plausibly add noise to their single aggregate V/A/D scores. NRC's methodology (best-worst scaling / Likert on isolated lemmas, no sense disambiguation) cannot separate these senses. Per the README's own guidance (§VI.5), consider inspecting high-frequency ambiguous terms manually before finalizing weights.

9. The NRC README documents removal of ~200 identity/slur/taboo terms for ethical reasons (§X); none of the current V1 descriptors or candidates above were affected, but this is worth noting for any future expansion into more emotionally loaded vocabulary.

## Source Quality Note

**Primary, full data.** This is the actual raw lexicon (v2.1, released March 2025, ~55,000 English terms), not a summary or secondary citation -- every value quoted above is an exact tab-delimited lookup from `NRC-VAD-Lexicon-v2.1.txt` (verified via direct grep against the source file, anchored on exact term match). The lexicon was built via large-scale human annotation (best-worst scaling for the original ~20k terms in v1/ACL2018, Likert rating for the ~35k terms added in v2/2025), with the authors reporting higher inter-annotator reliability than prior VAD lexicons (ANEW, Warriner et al.) in the associated papers.

Confidence in the extraction itself is high (single unambiguous file format, no parsing ambiguity). Confidence in the *applicability* of the data varies sharply by dimension: very high for `valence`/`arousal`/`dominance` (this is exactly what the lexicon measures, at scale, with reliability data behind it), but low-to-moderate for the seven media-specific dimensions (`warmth`, `tension`, `intimacy`, `instability`, `nostalgia`, `beauty`, `menace`), where this source can only offer indirect, circumstantial evidence via a single word's own V/A/D triple -- not a validated measurement of the construct itself. The companion "Words of Warmth" lexicon (which would directly address `warmth`) is referenced but not included in this download and was not available for this research pass.
