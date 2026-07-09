# Osgood, Suci & Tannenbaum — "The Measurement of Meaning" (1957) — Research Findings

## Citation

Osgood, C. E., Suci, G. J., & Tannenbaum, P. H. (1957). *The Measurement of Meaning*. Urbana, IL: University of Illinois Press.

No primary text was available for this research pass (Internet Archive listings `measurementofmea0000char` / `measurementofmea00osgo` are controlled-digital-lending only). This report is built entirely from:

- The locally pre-fetched secondary summary: `research/tone-taxonomy-v2/sources/osgood-1957/secondary-summary-semantic-differential.md`, sourced from Wikipedia, "Semantic differential," https://en.wikipedia.org/wiki/Semantic_differential (fetched 2026-07-08).
- A live re-fetch of the same Wikipedia page during this research pass to recover additional scale-pair detail not captured in the locally saved excerpt (see Source Quality Note).
- Two targeted WebSearch queries to cross-check the claim above (see Conflicts/Cautions — one search surfaced a likely-erroneous AI-generated paraphrase, which is flagged below rather than relied upon).

Likely related primary source for the "additional dimensions" material found during the live re-fetch (not independently confirmed): Osgood, C. E., May, W. H., & Miron, M. S. (1975). *Cross-Cultural Universals of Affective Meaning*. Urbana, IL: University of Illinois Press.

## Scope & Relevance

This source is a **conceptual/structural** framework, not a word-level ratings lexicon — it has no numeric per-word data comparable to Warriner or NRC-VAD. Its contribution to `tone-taxonomy/v2` is establishing that three broad, cross-culturally replicated factors (Evaluation, Potency, Activity) organize connotative meaning, and that these map historically onto `valence`, `dominance`, and `arousal` respectively.

- **Directly informs:** `valence` (Evaluation), `arousal` (Activity), `dominance` (Potency) — the three foundational, cross-culturally validated dimensions the brief already earmarks as "directly supported by affective norm literature."
- **Indirectly complicates:** `warmth` and `beauty` — the fuller scale-pair list recovered in this pass shows Osgood's own studies grouped "warm–cold" and "beautiful–ugly" *into* the Evaluation factor rather than treating them as independent axes. This is evidence *against* warmth/beauty being orthogonal to valence in the classic EPA structure, not evidence for them.
- **Weakly, uncertainly touches:** `instability`, via a later-generation "Organization" (organized–disorganized) dimension found in Osgood-tradition cross-cultural extension work. This dimension is not part of the core 1957 three-factor result and its attribution to "Osgood 1957" specifically is uncertain (see Conflicts).
- **Silent on:** `tension`, `menace`, `nostalgia`, `intimacy`. Nothing in the available secondary material addresses suspense/pressure, threat, memory/sentimentality, or interpersonal closeness as semantic-differential factors. Any mapping attempted below for these is explicitly marked as low-confidence inference, not a source finding.

## Descriptor Findings

| Descriptor | Source Value/Rating | Suggested Dimension | Suggested Weight [-1,1] | Confidence [0,1] | Basis |
|---|---|---|---:|---:|---|
| `uplifting` | Positive pole of the Evaluation factor (canonical anchor "good") | `valence` | `0.85` | `0.55` | Evaluation, defined by "good–bad," is the classic ancestor of valence; "uplifting" is a modern paraphrase of the positive pole. |
| `melancholic` | Negative pole of the Evaluation factor | `valence` | `-0.85` | `0.55` | Same basis, negative ("bad") pole. |
| `energetic` | Positive pole of the Activity factor (canonical anchor "active") | `arousal` | `0.85` | `0.55` | Activity, defined by "active–passive," is the classic ancestor of arousal. |
| `subdued` | Negative pole of the Activity factor | `arousal` | `-0.85` | `0.55` | Same basis, negative ("passive") pole. |
| `commanding` | Positive pole of the Potency factor (canonical anchor "strong") | `dominance` | `0.85` | `0.55` | Potency, defined by "strong–weak," is the classic ancestor of dominance. |
| `delicate` | Negative pole of the Potency factor | `dominance` | `-0.70` | `0.50` | "Delicate" approximates the "weak"/"small" pole of Potency; a somewhat looser paraphrase than "commanding"≈"strong," so weight/confidence trimmed slightly. |
| `warm` | Loads on the Evaluation factor alongside "good–bad" | `valence` | `0.40` | `0.40` | Osgood's own scale set groups "warm–cold" with Evaluation, not as an independent factor — evidence warmth is not orthogonal to valence in this framework. |
| `warm` | No independent "warmth" factor exists in EPA | `warmth` | `0.60` | `0.25` | Retained only as a project-specific media dimension; not a research-validated axis from this source. |
| `cold` | Loads on the Evaluation factor (negative pole) | `valence` | `-0.40` | `0.40` | Same basis as `warm`, negative pole. |
| `cold` | No independent "warmth" factor exists in EPA | `warmth` | `-0.60` | `0.25` | Same caveat as `warm`. |
| `tense` | Ambiguous — not a confirmed EPA anchor pair | `arousal` | `0.25` | `0.20` | One low-quality secondary paraphrase claimed Activity's anchor pair was "tense–relaxed" rather than the well-documented "active–passive"; likely an error/confusion between axes. Not treated as a reliable EPA-anchored claim. |
| `relaxed` | Ambiguous — not a confirmed EPA anchor pair | `arousal` | `-0.25` | `0.20` | Same caveat as `tense`. |
| `threatening` | No dedicated EPA factor; danger concepts are sometimes theorized as low-Evaluation + high-Potency + high-Activity composites | `menace` | `0.50` | `0.25` | Inference built from the EPA structure, not a direct statement in the available summary; treat as a plausible but unverified hypothesis. |
| `safe` | Inverse composite of the above | `menace` | `-0.50` | `0.25` | Same caveat as `threatening`. |
| `unstable` | Possibly related to a later "Organization" (organized–disorganized) dimension from Osgood-tradition cross-cultural extension work | `instability` | `0.40` | `0.25` | Not part of the core 1957 three-factor (EPA) result; likely from later work (e.g., Osgood, May & Miron 1975). Attribution to "Osgood 1957" specifically is uncertain. |
| `stable` | Inverse of the above | `instability` | `-0.40` | `0.25` | Same caveat as `unstable`. |
| `beautiful` | Loads on the Evaluation factor (explicitly listed alongside "good–bad") | `valence` | `0.45` | `0.40` | "Beautiful–ugly" is named among Osgood's Evaluation-factor scales in the fuller source material recovered this pass. |
| `beautiful` | No independent "beauty" factor exists in EPA | `beauty` | `0.70` | `0.25` | Retained only as a project-specific media dimension; not a research-validated axis from this source. |
| `harsh` | Approximate negative pole ("ugly"-adjacent), but conflates texture/severity with aesthetic judgment | `valence` | `-0.30` | `0.30` | "Harsh" is not literally "ugly"; treated as an imperfect analogy to the Evaluation-factor negative pole. |
| `harsh` | No independent "beauty" factor exists in EPA | `beauty` | `-0.60` | `0.25` | Same caveat as `beautiful`. |
| `nostalgic` | No evidence found | `nostalgia` | `0` | `0` | Source silent — no bipolar scale in the available material addresses memory, retrospection, or sentimentality. |
| `unsentimental` | No evidence found | `nostalgia` | `0` | `0` | Source silent, same basis. |
| `intimate` | No evidence found | `intimacy` | `0` | `0` | Source silent — no bipolar scale in the available material addresses interpersonal closeness/proximity. |
| `distant` | No evidence found | `intimacy` | `0` | `0` | Source silent, same basis. |

## Candidate New/Renamed Descriptors

- **`powerful` / `weak`** — `add` (optional synonym pair for `dominance`). Osgood's canonical Potency anchor is literally "strong–weak"; `powerful`/`weak` are more literal matches than `commanding`/`delicate` and may be more consistent for OpenAI to apply, at the cost of being slightly more generic/less media-flavored. Keep `commanding`/`delicate` as the primary pair per the brief's media-language preference; consider `powerful`/`weak` only if OpenAI keyword consistency testing shows drift.
- **`active` / `passive`** — `add` (optional synonym pair for `arousal`). Literal canonical Activity anchors; `energetic`/`subdued` are already close paraphrases so this is low-priority.
- **`ugly`** — `add` (optional synonym alongside `harsh` for the `beauty` negative pole). Osgood's literal Evaluation-factor antonym for `beautiful` is "ugly," not "harsh." `harsh` mixes in texture/severity connotations (abrasive, rough) that `ugly` does not carry; the two are not fully interchangeable and OpenAI may need both depending on whether the asset's harshness is aesthetic or sonic/textural.
- **`organized` / `disorganized`** — `rename-candidate` for `instability`'s pair (currently `stable`/`unstable`). If the later Osgood-tradition "Organization" dimension is confirmed as genuinely part of the cross-cultural EPA-extension literature (not verified in this pass — see Conflicts), "organized–disorganized" would be the more literally research-anchored term. Low priority: `stable`/`unstable` are close synonyms and already read naturally for media tone.
- **`interesting` / `boring`** — not recommended as an addition to the current 10-dimension scheme, but noted for completeness: this later "Stimulation" dimension from the Osgood research tradition doesn't map cleanly onto any of the 10 existing tone axes (closest is a blend of `arousal` and engagement, which isn't modeled). Flagging only so a future dimension-set revision has the reference if needed.

## Conflicts / Cautions

1. **Warmth and beauty may not be orthogonal to valence under this framework.** Osgood's own scale-pair groupings (per the fuller Wikipedia material recovered in this pass) place "warm–cold" and "beautiful–ugly" inside the Evaluation factor, not as independent factors. If `tone-taxonomy/v2` wants `warmth` and `beauty` to behave as genuinely separate axes from `valence`, that design choice needs to be justified on media-practical grounds (as the brief already anticipates — "remaining dimensions are media-specific"), not on Osgood's cross-cultural universals, which argue the opposite.
2. **`tense`/`relaxed` placement is unreliable.** A WebSearch during this pass surfaced an AI-generated summary claiming Osgood's Activity factor was defined by "tense–relaxed" rather than the well-documented "active–passive." This conflicts with every other source consulted (including the directly re-fetched Wikipedia page) and is treated here as a likely confusion/hallucination in that particular secondary aggregator, not a genuine Osgood finding. The `tense`/`relaxed` mappings above are therefore low-confidence placeholders, not research-backed claims.
3. **`menace` and `instability` mappings are inference, not source content.** Nothing in the available material directly discusses threat/danger or chaos/disorder as semantic-differential factors. The composite reasoning offered above (menace ≈ low Evaluation + high Potency + high Activity; instability ≈ a later "Organization" dimension) is a reasonable extrapolation from the EPA structure but should be weighted accordingly — these rows exist so the gap is visible, not because they carry real evidentiary weight.
4. **`nostalgia` and `intimacy` are entirely unaddressed.** No amount of extrapolation from EPA structure produces a defensible signal here; these should be sourced from other papers in the review list (e.g., NRC-EmoLex, media-affect datasets) rather than Osgood.
5. **Word-specific weights are analogical, not measured.** The three core factors themselves are well-replicated across dozens of cultures, but Osgood never rated the specific modern V1 words (`uplifting`, `commanding`, etc.) — those are this report's paraphrase-level analogies to the canonical anchor pairs ("good–bad," "strong–weak," "active–passive"). Treat the confidence values above as reflecting analogy quality, not measurement precision.
6. **The "four additional dimensions" (Typicality-Reality, Complexity, Organization, Stimulation) almost certainly postdate the 1957 book.** They were recovered from a live Wikipedia fetch during this pass and are most plausibly attributable to later work in the same research program (e.g., Osgood, May & Miron 1975), which is outside the scope of the specific 1957 citation this report is assigned to. They are included above only as low-confidence, clearly-flagged supplementary context — verify against a primary citation before relying on them.

## Source Quality Note

This is a **secondary summary only** — no primary text access, per `sources/README.md`. Two tiers of trust apply:

- **Moderate-to-high trust:** the existence and rough cross-cultural robustness of the three-factor Evaluation/Potency/Activity structure itself. This is one of the most widely replicated findings in psycholinguistics and is consistently reported the same way across every secondary source consulted (Wikipedia, WebSearch aggregator summaries), so the core EPA-to-valence/dominance/arousal mapping in this report is reasonably reliable.
- **Low trust:** anything word-specific (exact weight values for `uplifting`, `commanding`, etc.), the extended scale-pair list ("warm–cold," "beautiful–ugly," "brave–cowardly," etc.) and the "four additional dimensions," none of which could be cross-checked against the primary 1957 text or a peer-reviewed secondary source in this pass. One WebSearch result also surfaced a likely-erroneous claim (see Conflicts #2), underscoring that not all secondary aggregation of this material is reliable. Recommend verifying the extended scale-pair list and any downstream V2 decisions that lean on it against a library copy of *The Measurement of Meaning* or Osgood, May & Miron (1975) before treating them as settled.
