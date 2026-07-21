# MVP Release Plan

## Objective

Release a public tone-driven audio/video experience on `darenkeck.com` that can:

1. Play a reliable initial catalog of public media.
2. Accept curator tone input for source audio and video assets.
3. Accept anonymous public keyword reviews for combinations.
4. Start from a combination close to a user's requested tone.
5. Continue automatically through a nearest-neighbor walk after each combination ends.

This is an MVP for collecting useful tone and combination data. It is not expected to be a complete recommendation, personalization, or model-training system.

## MVP User Journey

1. A visitor opens `darenkeck.com` and receives a playable combination.
2. The visitor can select tone keywords to request a new starting point.
3. The requested tone ignores the currently playing combination and searches globally for a close match.
4. The result is fuzzed among a small set of strong matches so the same request does not always return the same pair.
5. When playback completes without new tone input, the next pair is chosen from the current combination's nearest neighbors.
6. Neighbor steps must use new audio but may retain the same video.
7. The visitor can submit a keyword-only review of the current combination.
8. Playback and random selection remain available as fallbacks when search or review APIs fail.

## MVP Principles

- DynamoDB remains the source of truth for assets and reviews.
- A vector database stores derived, disposable asset search vectors.
- Only audio and video asset vectors are indexed; combinations are not prepopulated.
- Candidate combinations are generated dynamically from audio/video vector lookups.
- `{ ...scores, ...adjustedScores }` is the effective asset tone vector because curator adjustments are sparse by dimension.
- Public combination reviews never adjust source audio or video assets.
- Public reviews are collection-only during MVP and do not immediately alter retrieval.
- Algorithms, vectors, taxonomy mappings, and index records are versioned.
- The public experience must remain usable when review, vector search, or traversal fails.

## Explicit Non-Goals

- User accounts or cross-device personalization.
- Real-time retraining from public reviews.
- Public audio/video source reviews.
- Precomputed or persisted records for every possible combination.
- A combination vector index.
- Arbitrary free-text semantic interpretation unless it deterministically produces the same tone query contract.
- Automated taxonomy or keyword-weight updates.
- Advanced collaborative filtering, bandits, or long-term preference models.
- Exhaustive human review of every possible audio/video pair.

## Phase 0: Define Release Gates

- [ ] Agree on the MVP user journey and non-goals above.
- [x] Select S3 Vectors as the production vector database.
- [x] Launch on a controlled explorer route or gated mode before promoting to the homepage.
- [x] Exclude the five most recent combinations and three most recent audio assets.
- [x] Use distance-weighted sampling from the top five valid candidates for search and walk fuzzing.
- [x] Record the initial algorithm constants under `combo-selection/v1`.

Initial recommended constants:

```text
audio contribution to perceived combo tone: 0.60
video contribution to perceived combo tone: 0.40
initial search candidate sample pool: top 5
walk candidate sample pool: top 5
candidate sampling: distance weighted
recent combination exclusion count: 5
recent audio exclusion count: 3
immediate audio repeat: prohibited
same video on next step: allowed
public reviews affecting live retrieval: disabled
initial rollout: controlled explorer route or gated mode
```

## Phase 1: Prepare the Initial Media Set

Target corpus:

```text
20 public audio assets
20 public video assets
up to 400 implicit combinations
```

- [ ] Upload approximately 20 audio tracks.
- [ ] Upload approximately 20 video tracks.
- [ ] Confirm every asset is public and playback-ready.
- [ ] Confirm every asset has a successful `tone-taxonomy/v2` analysis.
- [ ] Normalize titles, descriptions, visibility, and useful metadata.
- [ ] Remove duplicate, low-quality, silent, broken, or unusable media.
- [ ] Verify content rights and public-use permission for every asset.
- [ ] Check audio loudness and problematic silence at clip boundaries.
- [ ] Check video starts, endings, aspect ratios, and browser rendering.
- [ ] Smoke-test representative short/long audio and video pairings.

Exit criteria:

- All 40 target assets play successfully through the public delivery path.
- Every target asset has a current effective tone vector.
- No known content-rights blocker remains.

## Phase 2: Curator Calibration Pass

- [ ] Submit at least one curator review for every initial audio asset.
- [ ] Submit at least one curator review for every initial video asset.
- [ ] Inspect unusually large extracted-to-adjusted deltas.
- [ ] Re-review obvious outliers or accidental keyword selections.
- [ ] Confirm all review-picker keywords map into supported taxonomy descriptors.
- [ ] Freeze the MVP taxonomy, keyword aliases, model weight, and curator weight.
- [ ] Verify reprocessing preserves raw extracted scores and rebuilds adjusted scores.

MVP weighting remains:

```text
extracted model vector weight = 1
each compatible curator review vector weight = 1
```

Exit criteria:

- Every initial source asset has curator input.
- The effective asset vectors are accepted as the MVP retrieval baseline.
- Any mapping change after this point requires vector reindexing before release.

## Phase 3: Asset Vector Database Foundation

### Backend Selection

The MVP backend is S3 Vectors. It provides:

- Low-dimensional vectors.
- Metadata filtering by asset type, visibility, readiness, and version.
- Upsert and delete by stable asset ID.
- Separate logical namespaces or an efficient `assetType` filter.
- Predictable MVP cost.
- Usage-based pricing without a provisioned cluster.
- IAM integration with the existing AWS deployment.

Use one vector bucket and one `asset-tone-v1` index with `assetType=audio|video` metadata filters. The index uses 10-dimensional `float32` vectors and Euclidean distance. DynamoDB remains authoritative, so the index is retained for operational safety but is always rebuildable.

### Indexed Record

```ts
type AssetToneVectorRecord = {
  assetId: string;
  assetType: "audio" | "video";
  effectiveTone: number[]; // canonical 10-dimension order
  vectorSchemaVersion: "asset-tone-vector/v1";
  taxonomyVersion: "tone-taxonomy/v2";
  adjustmentAlgorithm: "model-prior-mean/v1";
  visibility: "public" | "private";
  assetStatus: string;
  toneStatus: string;
  updatedAt: string;
};
```

The canonical vector dimension order must be versioned and validated:

```text
valence, arousal, dominance, warmth, tension,
intimacy, instability, nostalgia, beauty, menace
```

### Index Lifecycle

- [ ] Add a provider-neutral vector index interface in Media Manager.
- [ ] Add a queue-backed worker for vector upsert/delete operations.
- [ ] Upsert after extracted tone analysis completes.
- [ ] Upsert after curator-adjusted scores change.
- [ ] Upsert or remove when asset visibility/readiness changes.
- [ ] Delete the vector when an asset is deleted.
- [ ] Track vector index schema/version and latest sync state on the asset or job record.
- [ ] Add a dry-run/apply reconciliation command.
- [ ] Backfill the initial public audio/video corpus once.
- [ ] Verify backend search results against an exact local calculation on fixtures.

An asset backfill is required once. No combination-building or combination-indexing step is required.

Exit criteria:

- Every eligible public audio/video asset has exactly one current vector record.
- Stale, private, unsupported, and deleted assets cannot appear in public search.
- The entire vector index can be rebuilt from DynamoDB asset records.

## Phase 4: Dynamic Tone Selection

### Query Contract

Keyword input produces a partial tone query:

```ts
type ToneQuery = {
  values: Partial<Record<ToneDimension, number>>;
  dimensions: ToneDimension[];
  taxonomyVersion: "tone-taxonomy/v2";
};
```

Unspecified dimensions must not be treated as requested neutral values during exact reranking.

### Candidate Retrieval

1. Query the vector database for nearby public audio assets.
2. Query the vector database for nearby public video assets.
3. Generate candidate pairs only from returned assets.
4. Compute perceived combination tone on demand.
5. Rerank candidates using exact masked distance over requested dimensions.

Baseline perceived combination tone:

```text
comboTone = clamp(0.60 * audioTone + 0.40 * videoTone)
```

Masked exact distance:

```text
distance(query, combo) =
  sum over requested dimensions of
  dimensionWeight * (queryValue - comboValue)^2
```

### Complementary Retrieval

Directly querying both asset types with the same query can miss pairs whose components combine into the desired result. Include target-conditioned searches.

For each shortlisted audio vector:

```text
idealVideo = clamp((query - 0.60 * audio) / 0.40)
```

Query video vectors near `idealVideo`. Repeat symmetrically for shortlisted videos:

```text
idealAudio = clamp((query - 0.40 * video) / 0.60)
```

Union direct and complementary candidates, deduplicate pairs, then perform exact reranking.

### Fuzzing

- [ ] Select from a small top-scoring pool rather than always choosing rank one.
- [ ] Weight sampling toward lower-distance candidates.
- [ ] Exclude recently played combinations.
- [ ] Keep results within a maximum acceptable query distance.
- [ ] Support a deterministic seed in tests.

Important behavior:

- A new tone request is a global restart.
- The currently playing combination has zero influence on tone-request ranking.
- The selected result becomes the starting point for the subsequent walk.

## Phase 5: Dynamic Nearest-Neighbor Walk

When playback completes without new tone input, selection switches to walk mode.

Walk constraints:

- Audio must change.
- Video may remain the same.
- The original tone query no longer affects ranking.
- The current combination is the only tonal anchor.
- Recent combinations and recent audio are excluded.

### Candidate Generation

1. Query audio neighbors around the current audio vector, excluding current/recent audio.
2. Query video neighbors around the current video vector, including the current video.
3. Include same-video/new-audio candidates.
4. Include candidates where both audio and video change.
5. Compute combination relationship features only for this shortlist.

Use the existing relationship geometry from `packages/tone-core`:

- Audio tone.
- Video tone.
- Signed tone delta.
- Absolute tone delta.
- Interaction tone.

Walk ranking:

```text
walkScore(candidate) = distance(
  relationshipVector(currentCombo),
  relationshipVector(candidateCombo)
)
```

- [ ] Sample among the nearest valid candidates rather than always selecting rank one.
- [ ] Prevent immediate audio repeats at the API level.
- [ ] Maintain a short client/API recent-history list to prevent loops.
- [ ] Add an escape path when all local candidates are excluded.
- [ ] Fall back to a valid random public pair if vector lookup fails.

No combination relationship vector is persisted. It is computed only for current and shortlisted pairs.

## Phase 6: Public Selection API

Add one public selection boundary, for example:

```text
POST /public/combos/select
```

Tone restart request:

```json
{
  "keywords": ["serene", "warm", "intimate"],
  "recentComboIds": []
}
```

Walk continuation request:

```json
{
  "currentAudioAssetId": "...",
  "currentVideoAssetId": "...",
  "recentAudioAssetIds": ["..."],
  "recentComboIds": ["..."]
}
```

Behavior:

- `keywords` present: global tone search.
- Current asset IDs without keywords: nearest-neighbor walk.
- Neither present: random public fallback.

- [ ] Validate all source assets are ready and public.
- [ ] Use stable synthetic IDs: `public-<videoAssetId>-<audioAssetId>`.
- [ ] Return selected pair, playback URLs, algorithm version, and selection mode.
- [ ] Return optional matching keywords or concise selection explanation.
- [ ] Add CORS for the intended public origin.
- [ ] Add request throttling, payload limits, timeout handling, and metrics.
- [ ] Cache the eligible public asset catalog and invalidate it safely.
- [ ] Keep the current random endpoint as an operational fallback.

## Phase 7: Public Combination Reviews

Add a separate unauthenticated write path, for example:

```text
POST /public/tone-reviews
```

MVP rules:

- Accept only `targetType=combo`.
- Accept approved keywords, not client-derived scores.
- Derive review scores server-side from versioned keyword mappings.
- Require stable synthetic combo ID and both source asset IDs.
- Verify source assets are public and the pair matches the combo ID.
- Never apply combo reviews to source audio/video scores.
- Store reviews for analysis only; do not alter live retrieval during MVP.
- Store taxonomy, query/retrieval algorithm, and combo-analysis versions.
- Consider storing the base combo tone snapshot for historical comparison.
- Avoid raw reviewer PII.
- Use a pseudonymous local session/submission ID for idempotency and basic deduplication.
- Add rate limits and basic abuse controls.
- Log submission success/failure metrics without reviewer PII.

Exit criteria:

- Anonymous visitors can submit a valid combo review.
- Invalid/private/source-mismatched combinations are rejected.
- Duplicate client retries do not create duplicate evidence.
- Review failures do not interrupt playback.

## Phase 8: `darenkeck.com` Integration

- [ ] Reuse the background `ComboPlayer` experience.
- [ ] Add the adaptive tone keyword picker as the MVP query input.
- [ ] Submit keyword input to the global tone-search mode.
- [ ] On playback completion, request a walk continuation.
- [ ] Reset walk state when new tone input is submitted.
- [ ] Preserve recent combo/audio history across automatic transitions.
- [ ] Add public combo review submission to the current combination.
- [ ] Show clear loading, retry, and no-result states.
- [ ] Keep random playback available if tone search fails.
- [ ] Ensure controls remain readable over varied video backgrounds.
- [ ] Support keyboard input, focus visibility, and reduced-motion preferences.
- [ ] Initially gate the explorer behind a mode, query parameter, or controlled rollout if needed.
- [ ] Promote it to the default homepage behavior only after smoke validation.

Free-text tone input is post-MVP unless it produces a deterministic, versioned `ToneQuery` in the same 10-dimensional space. The constrained keyword picker is the MVP input method.

## Phase 9: Playback And Browser Release Gate

- [ ] Validate Chrome, Safari, and Firefox desktop playback.
- [ ] Validate iOS Safari and Android Chrome playback.
- [ ] Validate muted start, unmute, pause, replay, and automatic next transitions.
- [ ] Validate interruption paths: app switch, screen lock, background/foreground, and native media controls.
- [ ] Validate long/short audio-video duration mismatches.
- [ ] Validate same-video/new-audio transitions.
- [ ] Confirm no immediate audio repeats through at least 20 automatic transitions.
- [ ] Resolve or explicitly accept the current end-state frame-jump issue.
- [ ] Verify public controls remain accessible on mobile viewport sizes.

The mobile focus-loss and native play/pause issues in `wiki/open-issues.md` are MVP risks because playback is the primary product behavior.

## Phase 10: Operations, Privacy, And Cost

- [ ] Add API success/error/latency metrics for search, walk, and public review submission.
- [ ] Add vector index synchronization and stale-index metrics.
- [ ] Add alarms for elevated public API errors and queue/DLQ backlog.
- [ ] Add API and vector backend cost limits or alerts.
- [ ] Document vector index rebuild and reconciliation commands.
- [ ] Document review export, backup, and purge procedures.
- [ ] Add concise privacy copy for anonymous tone feedback.
- [ ] Confirm logs do not intentionally store raw reviewer PII.
- [ ] Document deploy order, smoke checks, and rollback procedure.
- [ ] Ensure the current public random path remains available during rollback.

## Release Acceptance Checklist

### Corpus

- [ ] At least 20 audio and 20 video assets are public and playback-ready.
- [ ] Every release asset has `tone-taxonomy/v2` analysis and curator input.
- [ ] Every eligible asset has a current vector DB record.

### Search

- [ ] Keyword input starts a new global search independent of the current combo.
- [ ] Results are close to requested dimensions under exact masked distance.
- [ ] Repeated identical requests can produce controlled variation.
- [ ] Complementary audio/video candidates are represented.
- [ ] Search failure falls back to a playable random pair.

### Walk

- [ ] Automatic next selection uses current combo relationship geometry only.
- [ ] Every transition changes audio.
- [ ] Same-video transitions are allowed.
- [ ] Recent-history exclusions prevent obvious loops.
- [ ] Walk failure falls back to a playable pair.

### Reviews

- [ ] Curator reviews affect only audio/video effective vectors.
- [ ] Public reviews affect only combo review data.
- [ ] Public submission is anonymous, idempotent, validated, and rate-limited.
- [ ] Public reviews do not change retrieval during MVP.

### Experience

- [ ] Homepage playback, tone selection, automatic walk, and combo review work on the target browser/device matrix.
- [ ] Loading and failure states recover without requiring a page reload.
- [ ] Public controls are keyboard-accessible and readable over media.

### Operations

- [ ] Search, walk, review, and vector sync metrics are visible.
- [ ] Index rebuild, review export, deployment, smoke test, and rollback procedures are documented.
- [ ] Public API and vector database costs have alerts or limits.

## Recommended Implementation Order

1. Complete the 20/20 media corpus.
2. Complete one curator pass over every source asset.
3. Select the vector backend and define `asset-tone-vector/v1`.
4. Implement vector lifecycle synchronization and initial asset backfill.
5. Implement dynamic global tone search with exact reranking and fuzzing.
6. Implement dynamic neighbor walking with new-audio enforcement.
7. Add the unified public combo selection endpoint.
8. Add the anonymous combo review endpoint and abuse controls.
9. Integrate search, walking, and review capture into `darenkeck.com`.
10. Complete browser, playback, privacy, observability, cost, and rollback gates.

## Related Documents

- `TONE_REVIEW_PLAN.md`
- `apps/tone-embedding/VECTOR_DB_PREP_PLAN.md`
- `packages/tone-core/src/combo.ts`
- `wiki/architecture-map.md`
- `wiki/deploy-and-ops.md`
- `wiki/open-issues.md`
