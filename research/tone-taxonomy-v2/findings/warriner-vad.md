# Warriner, Kuperman & Brysbaert (2013) — Research Findings

## Citation

Warriner, A. B., Kuperman, V., & Brysbaert, M. (2013). Norms of valence,
arousal, and dominance for 13,915 English lemmas. *Behavior Research
Methods*, 45(4), 1191–1207. https://doi.org/10.3758/s13428-012-0314-x

Data used: `research/tone-taxonomy-v2/sources/warriner-vad/Ratings_Warriner_et_al.csv`
(canonical host `crr.ugent.be` 404s; mirrored via JULIELab/XANEW on GitHub).
Primary, full raw-ratings CSV — 13,915 lemmas with mean/SD/N for
Valence (V), Arousal (A), Dominance (D), overall and broken out by
rater gender/age/education.

## Scope & Relevance

Warriner et al. is a 9-point-scale (1–9, midpoint 5) crowd-sourced VAD
lexicon extending Bradley & Lang's ANEW methodology to ~13,900 words. It
**directly and quantitatively informs**:

- `valence`
- `arousal`
- `dominance`

These are exactly the three axes the CSV measures per word (I normalize
each mean to `[-1, 1]` via `(mean - 5) / 4` throughout this report).

It is **silent by construction** on the other seven media-specific
dimensions (`warmth`, `tension`, `intimacy`, `instability`, `nostalgia`,
`beauty`, `menace`) — there is no warmth/tension/etc. rating scale in this
study. However, because V1 assigns each of its 20 descriptors to one of
these 10 dimensions, I can still look up each descriptor's raw VAD profile
and use it as **indirect, lower-confidence evidence** for the dimension
V1 assigned it to (e.g., does the word "warm" show a VAD profile
consistent with an inviting/open construct?). I've kept these two kinds
of evidence clearly separated below — VAD-axis rows are direct/primary
evidence; other-dimension rows are proxy/indirect evidence and are
flagged with lower confidence accordingly.

General caveat: per-word sample sizes in this lexicon are modest
(typically N≈18–50 raters per word, occasionally higher), so individual
word means carry real sampling noise. The lexicon's strength is breadth
(13,915 words), not per-word precision — treat single-word deltas of
less than ~0.15 (normalized) as likely noise.

## Descriptor Findings

Note: `melancholic`, `threatening`, and `unsentimental` — three of the 20
V1 descriptors — **do not appear in the Warriner lexicon at all** (verified
by exact-match lookup against all 13,915 lemmas). Where a close relative
word exists (`melancholy`, `threat`, `frightening`/`menacing`, `clinical`)
I report it as an explicit proxy and flag the substitution; this is a
real gap, not an oversight.

| Descriptor | Source Value/Rating (raw 1–9 → normalized) | Suggested Dimension | Suggested Weight [-1,1] | Confidence [0,1] | Basis |
|---|---|---|---:|---:|---|
| `uplifting` | V=6.95→0.49, A=4.70→-0.08, D=6.75→0.44 | valence | 0.55 | 0.75 | Direct VAD; moderate positive valence, N=19. |
| `uplifting` | (same word) | dominance | 0.35 | 0.45 | Secondary: moderate-positive dominance co-occurs with uplift; indirect for the dominance construct. |
| `melancholic` | **not in lexicon**; proxy `melancholy`: V=3.74→-0.32, A=4.13→-0.22, D=3.96→-0.26 | valence | -0.40 | 0.45 | Proxy lemma only (adjective form absent); weaker-than-expected negative valence for a word V1 treats as strongly negative. |
| `melancholic` | (proxy `melancholy`) | arousal | -0.25 | 0.35 | Secondary; weak negative arousal, low confidence (proxy word + small effect). |
| `energetic` | V=7.57→0.64, A=6.10→0.28, D=5.81→0.20 | arousal | 0.35 | 0.65 | Direct VAD, but arousal signal is only weak-moderate (0.28), notably softer than intuition. See Conflicts. |
| `energetic` | (same word) | valence | 0.55 | 0.55 | Secondary: strong positive valence co-occurs with "energetic." |
| `subdued` | V=3.58→-0.36, A=2.95→-0.51, D=4.57→-0.11 | arousal | -0.55 | 0.75 | Direct VAD; solid moderate-negative arousal match for the intended construct. |
| `subdued` | (same word) | valence | -0.35 | 0.5 | Secondary weak-moderate negative valence. |
| `warm` | V=7.50→0.63, A=3.35→-0.41, D=6.33→0.33 | warmth | 0.70 | 0.45 | Indirect: strong positive valence + moderate positive dominance + calm (low) arousal is a coherent "inviting/secure" profile, but warmth itself isn't a measured axis. |
| `warm` | (same word) | valence | 0.63 | 0.6 | Direct VAD, usable if "warm" is ever scored on valence directly. |
| `cold` | V=4.32→-0.17, A=3.55→-0.36, D=5.17→0.04 | warmth | -0.55 | 0.4 | Indirect proxy; valence is only weakly negative (-0.17), much weaker than intuition — likely diluted by literal-temperature senses in the norming task. See Conflicts. |
| `tense` | V=2.75→-0.56, A=5.32→0.08, D=4.72→-0.07 | tension | 0.65 | 0.5 | Indirect (tension not measured); strong negative valence carries the signal, but arousal is essentially neutral (0.08) — a real conflict with the "tense = high arousal" assumption. See Conflicts. |
| `tense` | (same word) | valence | -0.56 | 0.65 | Direct VAD, strong-moderate negative. |
| `relaxed` | V=7.25→0.56, A=2.49→-0.63, D=7.09→0.52 | tension | -0.65 | 0.6 | Indirect but coherent: high valence + low arousal + high dominance is a classic low-tension/at-ease profile. |
| `relaxed` | (same word) | arousal | -0.63 | 0.75 | Direct VAD, strong negative arousal — best-behaved of the arousal-dimension words. |
| `threatening` | **not in lexicon**; proxies `threat` (V=2.63→-0.59,A=6.57→0.39,D=3.60→-0.35), `frightening` (V=2.58→-0.61,A=4.73→-0.07,D=3.39→-0.40), `menacing` (V=3.14→-0.47,A=4.76→-0.06,D=4.15→-0.21) | menace | 0.75 | 0.5 | Composite of 3 proxy words, none an exact match: consistently strong negative valence + low dominance (target feels powerless); arousal signal inconsistent across proxies (threat=+0.39, others ≈0). |
| `safe` | V=7.70→0.68, A=3.14→-0.47, D=7.21→0.55 | menace | -0.75 | 0.65 | Direct word match; strong, internally consistent profile (safe = pleasant + calm + high control). Best-behaved menace-dimension word. |
| `safe` | (same word) | valence | 0.68 | 0.6 | Direct VAD, strong positive. |
| `unstable` | V=3.43→-0.39, A=5.05→0.01, D=3.75→-0.31 | instability | 0.55 | 0.45 | Indirect; negative valence + negative dominance carries the signal, but arousal is flat (0.01) — instability/chaos is not read as "exciting" by raters. See Conflicts. |
| `stable` | V=5.20→0.05, A=3.11→-0.47, D=6.33→0.33 | instability | -0.50 | 0.45 | Indirect; valence is essentially neutral (0.05) — low arousal + moderate-positive dominance (calm control) is the real signal, not positivity. |
| `beautiful` | V=7.61→0.65, A=5.71→0.18, D=6.17→0.29 | beauty | 0.80 | 0.55 | Indirect (beauty not measured); strong positive valence with mild positive arousal/dominance, coherent profile. |
| `beautiful` | (same word) | valence | 0.65 | 0.6 | Direct VAD. |
| `harsh` | V=3.44→-0.39, A=5.63→0.16, D=4.04→-0.24 | beauty | -0.60 | 0.5 | Indirect; moderate negative valence, mild positive arousal (harshness reads as somewhat activating/intense), weak negative dominance. |
| `nostalgic` | V=6.68→0.42, A=4.37→-0.16, D=5.05→0.01 | nostalgia | 0.55 | 0.5 | Indirect (nostalgia not measured, and VAD can't capture "pastness"); moderate positive valence is consistent with nostalgia's typically fond/bittersweet framing. |
| `unsentimental` | **not in lexicon**; loose proxy `clinical`: V=4.82→-0.05, A=4.10→-0.23, D=4.70→-0.08 | nostalgia | -0.25 | 0.2 | Word absent; "clinical" is a semantically imperfect stand-in (detached/precise, not exactly "unsentimental") and shows only a negligible valence signal. Treat as a real gap. |
| `intimate` | V=7.22→0.56, A=6.02→0.26, D=6.29→0.32 | intimacy | 0.70 | 0.55 | Indirect; strong positive valence plus a notable positive arousal component (intimacy reads as somewhat activating, not just calm), and positive dominance. |
| `distant` | V=4.74→-0.07, A=2.95→-0.51, D=3.56→-0.36 | intimacy | -0.55 | 0.5 | Indirect; valence is nearly neutral (-0.07) — the real signal is low arousal + low dominance (disengagement), not sadness. |
| `commanding` | V=4.57→-0.11, A=5.95→0.24, D=4.64→-0.09 | dominance | 0.35 | 0.3 | Direct VAD, but dominance itself is essentially neutral/slightly negative (-0.09) — a significant conflict with the intended "powerful, forceful" meaning. See Conflicts; confidence downgraded accordingly. |
| `delicate` | V=6.38→0.35, A=3.09→-0.48, D=5.04→0.01 | dominance | -0.35 | 0.3 | Direct VAD, but dominance is essentially neutral (0.01), not the expected strong-negative "fragile/low-force" signal. See Conflicts; confidence downgraded. |
| `delicate` | (same word) | valence | 0.35 | 0.5 | Secondary; delicate reads as mildly positive/aesthetic (graceful), not negative. |

### Candidate synonym lookups (supporting evidence, not full new rows above)

| Word | V (norm) | A (norm) | D (norm) | Relevance |
|---|---:|---:|---:|---|
| `command` (noun) | -0.20 | -0.09 | **0.55** | Much stronger dominance signal than adjective `commanding` (-0.09). Suggests the noun/verb form carries the "power" sense better than the adjective in this lexicon. |
| `fragile` | -0.08 | -0.49 | **-0.25** | Cleaner negative-dominance signal than `delicate` (0.01); better literal candidate for the dominance-negative pole. |
| `dangerous` | -0.67 | 0.45 | **-0.61** | Strongest, cleanest menace-dimension profile found (low valence, elevated arousal, strongly reduced dominance) — better anchor than `threatening` (absent from lexicon). |
| `chaotic` | -0.11 | **0.29** | -0.26 | Unlike `unstable` (arousal≈0), `chaotic` actually shows the positive-arousal signal intuition expects from disorder. Good candidate add for `instability`. |
| `cozy` | 0.57 | -0.36 | 0.42 | Strong, clean warmth-positive profile (high valence, calm, high dominance/security) — arguably better warmth anchor than `warm` itself. |
| `peaceful` | **0.75** | -0.16 | 0.46 | Highest valence of any tension-adjacent word checked; strong tension-negative candidate alongside `relaxed`. |
| `joyful` / `joy` | 0.80 | 0.13 | 0.51 | Very strong, clean valence-positive signal; stronger and cleaner than `uplifting` (0.49). Good candidate add/alternative for valence-positive descriptor. |
| `sad` | -0.73 | -0.38 | -0.29 | Cleanest, strongest valence-negative single word found — stronger than `melancholic`'s proxy (`melancholy` = -0.32). |
| `gorgeous` / `elegant` | 0.64 / 0.50 | -0.02 / -0.14 | 0.51 / 0.24 | Both clean beauty-positive candidates; `gorgeous` has the strongest dominance co-signal. |
| `menace` (noun) | -0.47 | -0.03 | -0.15 | Confirms the noun form exists in-lexicon (unlike `threatening`); moderate, not extreme, signal. |
| `vintage` / `retro` / `antique` | 0.42 / 0.15 / 0.38 | -0.16 / -0.25 / 0.00 | 0.08 / 0.19 / 0.20 | Mildly positive valence, low arousal; consistent with nostalgia's "fond memory" quality but, like `nostalgic` itself, this is VAD-proxy evidence only — none of these words measure "pastness." |

## Candidate New/Renamed Descriptors

- **add** `dangerous` (menace, positive pole) — cleaner/stronger VAD signal than any `threatening` proxy; `threatening` itself has no lexicon entry.
- **add** `cozy` (warmth, positive pole) — stronger, cleaner profile than `warm` alone; useful as a secondary/companion descriptor for warm-and-secure media (home videos, domestic scenes).
- **add** `chaotic` (instability, positive pole) — captures the positive-arousal component that `unstable` itself lacks in this lexicon; complements rather than replaces `unstable`.
- **add** `joyful` (valence, positive pole) — stronger, cleaner valence signal than `uplifting`; consider as a companion/alternative if OpenAI needs a more unambiguous "very positive" word.
- **rename** `melancholic` → consider `melancholy` or pair with `sad`/`gloomy` for the valence-negative pole — `melancholic` (adjective) has no lexicon entry at all; `melancholy` (noun/adjective) does but is only weakly-moderately negative (-0.32), weaker than V1's apparent intent. `sad` (-0.73) or `gloomy` (-0.46) are stronger, cleaner, better-attested alternatives if a stronger negative anchor is wanted.
- **rename/caution** `threatening` → has zero lexicon coverage; recommend `menacing` or `dangerous` as the OpenAI-facing word if VAD anchoring matters, or accept it as a media-specific/non-VAD term.
- **rename/caution** `unsentimental` → has zero lexicon coverage and no good synonym either; recommend treating this pole as project-specific judgment only (VAD lexicons generally don't encode "absence of sentimentality" well) or renaming to `clinical`/`detached` for at least partial lexical grounding.
- **add** `fragile` as an alternative/companion to `delicate` for the dominance-negative pole — shows an actual negative-dominance signal (-0.25) where `delicate` shows none (0.01).
- **caution, no rename recommended** `commanding` — dominance signal is flat/slightly negative in this lexicon (-0.09), not the strong positive expected. The noun `command` (0.55) is much better-behaved; consider testing whether OpenAI-generated descriptors skew toward the noun-like usage, or accept this as a case where project intuition should override the lexicon (see Conflicts).

## Conflicts / Cautions

- **`commanding` (dominance+) shows near-zero/slightly negative measured dominance (-0.09)**, directly conflicting with its V1 role as the strong-positive dominance anchor. The related noun `command` scores +0.55, suggesting the adjective form's connotations (as rated by crowdworkers) diverge from the noun's. This is the single biggest disagreement between V1's assumed mapping and the Warriner data — flag for human review before trusting `commanding`'s dominance weight.
- **`delicate` (dominance−) also shows near-zero dominance (0.01)**, not the expected strong-negative signal; its strongest signal is actually a mild *positive* valence (0.35, i.e., delicate reads as aesthetically pleasant, not weak/powerless). `fragile` is a better lexical anchor for the intended negative-dominance meaning.
- **`tense` and `unstable` both show flat/near-zero arousal** (0.08 and 0.01 respectively) in this lexicon, despite both being intuitively "high-arousal" words in the tension/instability dimensions. Their measured signal comes almost entirely from valence and dominance, not arousal. This suggests V1's implicit assumption that `tense`≈high-arousal and `unstable`≈high-arousal is not well supported by this lexicon; `chaotic` (arousal=0.29) is a better arousal-bearing companion for instability.
- **`energetic` itself is only weak-moderate on arousal (0.28)**, softer than expected for the descriptor meant to anchor high arousal. Its valence signal (0.64) is actually stronger than its arousal signal in this data.
- **`cold` and `melancholy` both show weaker-than-expected negative valence** (-0.17 and -0.32). `cold` in particular is likely diluted by literal-temperature word senses being rated alongside the emotional/metaphorical sense — a known ambiguity risk for words with strong literal meanings.
- **Three V1 descriptors have zero coverage in this lexicon**: `melancholic`, `threatening`, `unsentimental`. All findings for these rely on proxy words (different lemma forms or loose synonyms) and should be treated as lower-confidence than the other 17.
- General caution: Warriner et al. measures word-level VAD in isolation, out of any media context. A word like `intimate` scoring positive arousal (0.26) reflects lexical/emotional association, not necessarily how an "intimate" scene would score in a video/audio arousal sense — treat all non-valence/arousal/dominance dimension mappings, and even some VAD ones, as priors to validate against actual media review, not ground truth.

## Source Quality Note

Primary source: the full raw-ratings CSV (13,915 lemmas, mean/SD/N per V/A/D
axis, with demographic breakdowns) was read directly and queried by exact
lemma match for all 20 V1 descriptors plus ~50 candidate/synonym words. No
web search or secondary summary was needed to answer the assigned
questions — the CSV is self-describing and its methodology is well
documented in the published paper (crowd-sourced 1–9 Likert ratings via
Mechanical Turk, extending the ANEW norming procedure to a much larger
vocabulary; N≈18–50 raters per word overall, per Warriner et al. 2013).
Extraction confidence is high for direct VAD lookups on words present in
the lexicon; confidence is explicitly downgraded in the table above for
(a) proxy-word substitutions where the exact V1 descriptor is absent, and
(b) all mappings to the 7 non-VAD dimensions, since those are inherently
indirect inferences from this source rather than measurements it makes.
