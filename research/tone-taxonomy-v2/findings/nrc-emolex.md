# Mohammad & Turney — "NRC Emotion Lexicon" (EmoLex) -- Research Findings

## Citation

- Saif M. Mohammad and Peter D. Turney. "Crowdsourcing a Word-Emotion Association Lexicon." *Computational Intelligence*, 29(3): 436-465, 2013. Wiley Blackwell.
- Saif Mohammad and Peter Turney. "Emotions Evoked by Common Words and Phrases: Using Mechanical Turk to Create an Emotion Lexicon." NAACL-HLT 2010 Workshop on Computational Approaches to Analysis and Generation of Emotion in Text. https://aclanthology.org/W10-0204
- Homepage: http://saifmohammad.com/WebPages/NRC-Emotion-Lexicon.htm
- Companion ethics papers (included in source folder): Mohammad, "Practical and Ethical Considerations in the Effective use of Emotion and Sentiment Lexicons," arXiv:2011.03492 (2020); Mohammad, "Ethics Sheet for Automatic Emotion Recognition and Sentiment Analysis," *Computational Linguistics* 48(2), 2022.
- Data used: `NRC-Emotion-Lexicon-Wordlevel-v0.92.txt` (14,182 unigrams x 8 emotions + 2 sentiment polarities, binary association flags), local copy at `research/tone-taxonomy-v2/sources/nrc-emolex/extracted/NRC-Emotion-Lexicon/`.
- License: free for non-commercial research/educational use; no redistribution; cite on use (see README §IX).

## Scope & Relevance

EmoLex is a **categorical, binary-association** lexicon: for each word it records whether crowd annotators associated the word with each of 8 discrete emotions (anger, anticipation, disgust, fear, joy, sadness, surprise, trust) and 2 sentiment polarities (positive, negative). It is **not** a VAD/continuous-rating lexicon (that role is filled by the separately-assigned Warriner and NRC-VAD sources) and it has **no arousal or dominance axis at all**.

Mapping emotion categories to the 10 tone dimensions:

- **valence** — directly and strongly supported via the `positive`/`negative` sentiment flags, and indirectly via `joy`/`sadness`.
- **warmth** — indirectly supported via the `joy` + `trust` cluster (positive, prosocial, affiliative words tend to carry both).
- **tension** — indirectly supported via `fear` + `anger` + `anticipation` (suspense-adjacent), though EmoLex conflates "tense/uneasy" with general negative-activation emotion rather than isolating pressurized suspense specifically.
- **menace** — directly and strongly supported via `fear` + `anger` + `disgust` (this is the dimension EmoLex is best suited for besides valence).
- **instability** — indirectly supported via `surprise` (unexpectedness/disorientation) combined with `fear`/`negative`.
- **beauty** — indirectly and weakly supported via `disgust` (aesthetic revulsion) on the negative pole and `joy`/`positive` on the positive pole; EmoLex was not designed to capture aesthetic judgment specifically.
- **dominance** — **not directly measured.** Words like "commanding," "powerful," "dominant" get whatever emotion associations crowd workers attached to them (often mixed/noisy — see Conflicts section), not a potency/control axis.
- **arousal** — **not directly measured.** EmoLex has no energy/activation dimension; "positive"/"negative" sentiment is not a proxy for high/low arousal (e.g., both "calm" and "excited" can be positive).
- **intimacy** — **largely silent.** Proximity/closeness words (intimate, distant, private, close) mostly carry zero or only incidental emotion associations in this lexicon; only "intimate" itself has a usable signal (anticipation, joy, positive, trust).
- **nostalgia** — **essentially silent.** "nostalgia," "nostalgic," "unsentimental" are either absent or carry no flagged associations; EmoLex has no memory/retrospection category.

Where a word is entirely absent from the 14,182-term vocabulary, or present but with all 10 flags at `0`, that is stated explicitly below — these are genuine "no data" cases, not zero-valence judgments.

## Descriptor Findings

| Descriptor | Source Value/Rating | Suggested Dimension | Suggested Weight [-1,1] | Confidence [0,1] | Basis |
|---|---|---|---:|---:|---|
| `uplifting` | Word absent from lexicon. Morphological variant `uplift` present: `anticipation, joy, positive, trust` | valence | 0.70 | 0.45 | Proxy via lemma `uplift`, not exact form; joy+positive+trust cluster is a strong valence-positive signature but EmoLex has no entry for the adjective itself. |
| `melancholic` | Present: `negative, sadness` | valence | -0.75 | 0.75 | Clean two-flag negative/sadness signature, no positive-side flags — clear negative valence evidence. |
| `melancholic` (secondary) | — | nostalgia | +0.10 | 0.15 | EmoLex has no nostalgia/memory category; any nostalgia link is a project inference, not source-supported. Flagged as source-silent. |
| `energetic` | Present: `positive` only (no arousal category exists in EmoLex) | arousal | +0.20 | 0.20 | Weak, indirect: only sentiment polarity is flagged, not energy/activation. Compare `excited` (`anticipation, joy, positive, surprise, trust`), a better arousal-adjacent proxy but still categorical, not continuous. Treat EmoLex as largely silent on arousal. |
| `subdued` | Present in lexicon; **all 10 flags = 0** | arousal | 0.00 | 0.10 | No associations recorded at all — EmoLex is silent on this word; do not treat the zero as "neutral valence," treat it as no data. |
| `warm` | Word absent from lexicon | warmth | — | 0.00 | No entry. Proxies available: `loving` (`joy, positive, trust`), `tender` (`joy, positive, trust`), `friendly` (`anticipation, joy, positive, trust`) all show a consistent joy+trust+positive signature that supports warmth as a construct, but not the literal word "warm." |
| `cold` | Present: `negative` only | warmth | -0.35 | 0.35 | Weak — only generic negative sentiment, no fear/disgust/anger specificity. Compare `unfriendly` (`anger, disgust, fear, negative, sadness`) and `hostile` (`anger, disgust, fear, negative`), both much stronger negative-warmth proxies. |
| `tense` | Present in lexicon; **all 10 flags = 0** | tension | 0.00 | 0.10 | No associations recorded — silent. Noun form `tension` present but only flags `anger` (single flag, weak). |
| `relaxed` | Present in lexicon; **all 10 flags = 0** | tension | 0.00 | 0.10 | No associations recorded — silent. `calm` (`positive`) and `peaceful` (`anticipation, joy, positive, surprise, trust`) are usable proxies for the negative pole of tension. |
| `threatening` | Present: `anger, disgust, fear, negative` | menace | +0.90 | 0.85 | Four-flag cluster including fear and disgust — one of the strongest, cleanest signals in this lexicon for any V1 descriptor. |
| `safe` | Present: `joy, positive, trust` | menace | -0.75 | 0.75 | Clean joy+positive+trust cluster with no negative-emotion flags — strong evidence for the menace-negative pole. |
| `unstable` | Present: `fear, negative, surprise` | instability | +0.70 | 0.65 | Fear+surprise combination plausibly captures both threat and unpredictability; still categorical rather than a direct "disorder" measure. |
| `stable` | Present: `positive, trust` | instability | -0.60 | 0.55 | Positive+trust is a reasonable proxy for groundedness/order but is indirect (no explicit "orderliness" category exists). |
| `beautiful` | Present: `joy, positive` | beauty | +0.65 | 0.55 | Joy+positive supports the pleasant/aesthetic pole but is indistinguishable from generic positive affect — EmoLex cannot isolate aesthetic judgment from emotional valence. |
| `harsh` | Word absent from lexicon. Noun `harshness` present: `anger, fear, negative` | beauty | -0.55 | 0.35 | Proxy via `harshness`, not the adjective itself. Anger+fear+negative supports an unpleasant/abrasive reading consistent with V1's beauty-negative pole. |
| `nostalgic` | Word absent from lexicon | nostalgia | — | 0.00 | No entry, and no related form (`nostalgia` present but zero flags) — EmoLex has no memory/retrospection emotion category. Fully silent. |
| `unsentimental` | Word absent from lexicon | nostalgia | — | 0.00 | No entry. Related form `sentimental` present but only flags `positive` — weak and arguably orthogonal to nostalgia (sentimentality vs. wistfulness are not the same construct). Silent. |
| `intimate` | Present: `anticipation, joy, positive, trust` | intimacy | +0.55 | 0.50 | Four-flag positive/prosocial cluster is plausible for closeness, but EmoLex has no true proximity/privacy category — this is the affective halo of intimacy, not intimacy itself. |
| `distant` | Present in lexicon; **all 10 flags = 0** | intimacy | 0.00 | 0.10 | No associations recorded — silent. Related terms `impersonal`, `detached`, `remote`, `private`, `close` are all present but also carry zero flags; EmoLex essentially does not encode this dimension. |
| `commanding` | Present: `positive, trust` | dominance | +0.25 | 0.20 | Weak and indirect — EmoLex has no potency/control axis, so "commanding" only surfaces generic positive/trust affect, not a power reading. See Conflicts: `dominant` and `powerful` get noisier, sometimes contradictory flags. |
| `delicate` | Word absent from lexicon | dominance | — | 0.00 | No entry. Noun `delicacy` present but zero flags. Proxy `fragile` present: `fear, negative, sadness` — but this evidences vulnerability/threat more than low-force/low-scale, so it is a poor substitute for "delicate" on the dominance axis specifically. |

## Candidate New/Renamed Descriptors

EmoLex's binary, crowd-sourced associations surface several words with cleaner, denser flag clusters than the current V1 descriptors — useful either as additions or as better-attested synonyms:

- **`menacing`** (add, menace+) — `anger, fear, negative` (3 flags). Slightly cleaner than `threatening` for pure menace without the disgust component; consider as a synonym pair.
- **`dangerous`** (add, menace+) — `fear, negative` (2 flags, very clean, no noise). Simpler and more media-relevant than `threatening` for danger-cue tagging (e.g. hazard, weapon, environment).
- **`hostile`** (add, menace+/warmth-) — `anger, disgust, fear, negative` (4 flags). Strong dual-dimension candidate: hostility reads as both cold (warmth-) and threatening (menace+).
- **`ominous`** / **`sinister`** (add, menace+) — `ominous`: `anticipation, fear, negative`; `sinister`: `anger, disgust, fear, negative`. Both add anticipatory dread not captured by `threatening` alone — useful for suspense-adjacent menace.
- **`chaotic`** (add, instability+) — `anger, negative` (2 flags). More media-natural than the currently-silent `unstable` word choice is already covered; keep as synonym.
- **`turbulent`** / **`erratic`** (add, instability+) — `turbulent`: `fear, negative`; `erratic`: `negative, surprise`. `erratic`'s surprise flag is a good unpredictability signal.
- **`orderly`** / **`balanced`** (add, instability-) — both `positive` only (1 flag each). Weak but clean; `balanced` may double as a beauty/compositional term for video.
- **`gorgeous`** / **`elegant`** (add, beauty+) — both `joy, positive` — same signature as `beautiful`, useful lexical variety for OpenAI to draw on.
- **`ugly`** / **`grotesque`** (add, beauty-) — `ugly`: `disgust, negative`; `grotesque`: `disgust, negative`. Since `harsh` has no direct entry, these are stronger-attested candidates for the beauty-negative pole and should be considered as a rename/addition.
- **`uplift`** (rename consideration) — the verb/noun lemma `uplift` (`anticipation, joy, positive, trust`) has data where the adjective `uplifting` does not; if OpenAI output is normalized/lemmatized before lookup, this closes a coverage gap.
- **`loving`** / **`friendly`** / **`tender`** (add, warmth+) — consistent `joy, positive, trust` (friendly also `anticipation`) cluster; `warm` itself has zero EmoLex coverage, so these are better-attested stand-ins.
- **`unfriendly`** (add, warmth-) — `anger, disgust, fear, negative, sadness` (5 flags, the densest negative cluster found for any warmth-candidate word). Much stronger evidence than `cold` (1 flag) for the warmth-negative pole.
- **`anxious`** / **`nervous`** (add, tension+) — both `anticipation, fear, negative`. Since `tense` itself carries zero EmoLex flags, these are meaningfully better-attested substitutes or additions.
- **`peaceful`** / **`tranquil`** (add, tension-) — `peaceful`: `anticipation, joy, positive, surprise, trust`; `tranquil`: `joy, positive`. Both stronger than the flag-less `relaxed`.
- **`fragile`** (add, menace+/dominance-, dual-mapped) — `fear, negative, sadness`. Suggest as an addition rather than a `delicate` replacement, since it carries more vulnerability/threat connotation than pure low-force/low-scale.

## Conflicts / Cautions

- **No arousal or dominance axis exists in EmoLex.** Any weight assigned above to `arousal` or `dominance` from this source is indirect/proxy reasoning through sentiment polarity, not a direct measurement. These two dimensions should be anchored primarily on the Warriner and NRC-VAD sources; treat EmoLex findings for `energetic`, `subdued`, `commanding`, `delicate` as low-confidence supplementary evidence only.
- **`dominant` gets `fear, negative`** rather than a "powerful/positive" reading — i.e., crowd annotators associated the word "dominant" with negative, fear-adjacent connotations (likely reflecting interpersonal/power-abuse framing) rather than a neutral potency sense. This directly conflicts with V1's assumption that `commanding` (dominance-positive pole) should read as favorable/strong; media use of "dominant"/"commanding" (e.g., describing a strong visual composition or a powerful score) is a different sense than the one crowd workers rated. Flag for human review before using `dominant` as a dominance-positive keyword.
- **`powerful` is maximally mixed**: `anger, anticipation, disgust, fear, joy, positive, trust` — 7 of 10 possible flags, spanning both positive and negative emotions. This is a textbook example of a word too polysemous/context-dependent for a single-descriptor mapping; EmoLex's own README (§V.2) recommends discarding highly ambiguous terms. Do not use `powerful` as a clean single-dimension keyword without qualification.
- **`serene` flags `negative, trust`** — an unexpected negative flag on a word intuitively near-synonymous with `calm`/`tranquil` (which are clean positive words). This looks like crowd-annotation noise or a rare negative sense (e.g., "serene" used ironically/archaically); do not treat it as reliable evidence and prefer `calm`/`tranquil`/`peaceful` instead.
- **Zero-flag words are common and easy to misread as "neutral."** `subdued`, `tense`, `relaxed`, `distant`, `warmth`(absent)/`warm`(absent), `command`, `delicacy`, `intimacy`, `impersonal`, `detached`, `remote`, `close`, `private`, `tiny`, `sentiment` all either have no lexicon entry or carry all-zero flags. This is a **coverage gap**, not a valence-neutral judgment, and should not silently produce weight `0` mappings; the findings table above flags each such case with confidence `~0.10` or `0.00`.
- **Categorical vs. continuous mismatch:** EmoLex's binary flags cannot express "how much" fear or joy a word carries, only whether annotators associated it at all (majority vote in original crowd task). When combined with the continuous Warriner/NRC-VAD sources, EmoLex should be used to determine *which* dimensions a word plausibly touches and *directional* sign, while VAD lexicons should set magnitude.
- **Identity-term redaction:** per the README (§X), ~25 identity-group-related terms were deliberately removed from this release for ethical reasons. None of the V1 descriptors or candidates above appear affected, but this is worth noting if the descriptor vocabulary is later expanded with demographic or group-referencing language.

## Source Quality Note

This is a **primary, full-data source**: the complete word-level v0.92 release (14,182 unigrams x 8 emotions + 2 sentiments, binary association flags from crowdsourced annotation), plus the original methodology papers (Mohammad & Turney 2010, 2013) and two companion ethics papers, all present locally in `research/tone-taxonomy-v2/sources/nrc-emolex/extracted/NRC-Emotion-Lexicon/`. All descriptor lookups in this report were performed directly against the word-level lexicon file (`NRC-Emotion-Lexicon-Wordlevel-v0.92.txt`) via exact-match queries; no web search was required or used, since the local data fully answered the lookup task. Confidence in the extraction itself (i.e., that the reported flags are accurate) is high (~0.95); confidence in the *dimension-mapping interpretation* is necessarily lower and is stated per-row, since EmoLex's 8-emotion categorical scheme requires an interpretive bridge to the project's 10 continuous tone dimensions that the source itself does not provide.
