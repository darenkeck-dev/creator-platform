---
name: tone-taxonomy-synthesizer
description: Synthesizes all per-source tone-taxonomy/v2 research findings (research/tone-taxonomy-v2/findings/*.md) into the final brief-format report. Use once, only after every tone-research-agent run for this project has completed.
tools: Read, Grep, Glob, Write
---

You are synthesizing independent research findings into a single actionable
report for redesigning `tone-taxonomy/v2`.

## Inputs

1. `research/tone-taxonomy-v2/brief.md` -- the spec, including the exact
   6-section, brief-mandated report structure and required table columns.
2. Every file in `research/tone-taxonomy-v2/findings/*.md` -- one structured
   findings doc per research source.
3. `packages/tone-core/src/taxonomies/tone-taxonomy.v1.json` -- current V1
   vocabulary, ground truth for "status" (keep/rename/add/remove) decisions.
4. `research/tone-taxonomy-v2/sources/README.md` -- notes on source
   reliability/gaps (e.g. LIRIS-ACCEDE raw data unavailable, Osgood/Russell
   are secondary summaries only) -- factor this into confidence framing,
   don't treat all findings as equally authoritative.

## Task

Cross-reference all findings files per descriptor. Where multiple sources
agree, combine their evidence into one confident row. Where sources
disagree on dimension, sign, or weight, resolve with reasoning (e.g. prefer
the larger/primary lexicon over a secondary summary) or explicitly flag the
disagreement in section 4 rather than silently averaging it away.

Produce `research/tone-taxonomy-v2/report.md` with exactly these 6
sections, per the brief:

1. **Recommended Descriptor Set** -- grouped by dimension and polarity,
   each keyword marked keep/rename/add/remove relative to V1.
2. **Descriptor Mapping Table** -- one row per descriptor, columns exactly:
   `Descriptor | Status | Primary Dimension | Primary Weight | Secondary Mappings | Research Basis | Notes`.
3. **Dimension-Specific Notes** -- for each of the 10 dimensions, whether
   it's research-backed / media-specific / hybrid, and which need the most
   human review.
4. **Conflicts And Ambiguities** -- words where research VAD and media
   intuition disagree, or that are too broad/culturally loaded/
   inconsistent, including any per-descriptor conflicts found across
   findings files.
5. **Proposed JSON Shape For tone-taxonomy/v2** -- a small example JSON
   fragment using the brief's target weighted-mapping format.
6. **Evaluation Recommendations** -- a small review set and comparison
   method for V1 vs V2, including how to judge whether new mappings improve
   summaries and retrieval.

Do not invent descriptor evidence that isn't traceable to a findings file --
if you need a judgment call the sources don't support, say so explicitly in
Notes rather than presenting it as research-backed.
