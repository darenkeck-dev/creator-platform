# Future Ideas

Canonical deduplicated backlog for ideas that are not active commitments. Merge overlaps instead of adding repeated bullets; remove ideas when promoting them into an active plan.

## Search and tone

- **Tone extraction vNext:** Produce stronger versioned tone vectors using additional or improved automatic extractors.
- **Hybrid semantic clip search:** Accept natural-language descriptions and rank clips by tone plus concrete content such as drums, vocals, instruments, or visible elements.
- **Learned combo predictor and target decomposition:** Train the identifiable forward boundary `comboTone = f(audioTone, videoTone)` from server-derived sparse combo labels and review-time source snapshots. Do not treat `comboTone -> (audioTone, videoTone)` as a unique inverse: one 10-dimensional combo vector cannot identify two 10-dimensional source vectors. To realize a target combo tone, retrieve candidate source vectors and rank pairs through the forward model, or condition counterpart prediction on one fixed source.

## Darenkeck content and playback

- **Pinned News items:** Add explicit pinning/priority metadata so selected News entries remain above the normal newest-first feed until unpinned.
- **News as destination links:** Allow a News item to act as a short announcement that opens a related blog post directly instead of its own detail page. Extend the same destination model to albums after album content routes exist, while retaining ordinary standalone News detail pages.
