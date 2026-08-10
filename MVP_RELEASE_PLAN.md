# MVP Release Plan

## Objective

Release a public tone-driven audio/video experience on `darenkeck.com` that can:

1. Play a reliable initial catalog of public media.
2. Accept curator tone input for source audio and video assets.
3. Start from a combination close to a visitor's requested tone.
4. Continue automatically through a tone walk after each combination ends.

The MVP goal is to release tone selection and the tone walk as a reliable public experience. Public combination reviews and user-feedback collection are deferred to a later release; this MVP is not expected to be a complete recommendation, personalization, or model-training system.

## MVP User Journey

1. A visitor opens `darenkeck.com` and receives a playable combination.
2. The visitor can select tone keywords to request a new starting point.
3. The requested tone ignores the currently playing combination and searches globally for a close match.
4. The result is fuzzed among a small set of strong matches so the same request does not always return the same pair.
5. When playback completes without new tone input, the next pair is chosen from the current combination's nearest neighbors.
6. Neighbor steps must use both new audio and new video.
7. Playback and random selection remain available as fallbacks when tone search or walking fails.

## MVP Principles

- DynamoDB remains the source of truth for assets and curator reviews.
- A vector database stores derived, disposable asset search vectors.
- Only audio and video asset vectors are indexed; combinations are not prepopulated.
- Candidate combinations are generated dynamically from audio/video vector lookups.
- `{ ...scores, ...adjustedScores }` is the effective asset tone vector because curator adjustments are sparse by dimension.
- Algorithms, vectors, taxonomy mappings, and index records are versioned.
- The public experience must remain usable when vector search or traversal fails.

## Explicit Non-Goals

- User accounts or cross-device personalization.
- Anonymous public combination reviews or other public feedback capture.
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
- [x] Exclude the five most recent combinations plus three recent audio and video assets.
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
recent video exclusion count: 3
immediate audio repeat: prohibited
immediate video repeat: prohibited
initial source candidate cap per asset type: 100
source retrieval metric: Euclidean, no initial maximum-distance cutoff
walk ranking metric: squared Euclidean over predicted combo tone
initial combo predictor: combo-tone-predictor/v0
top-five sampling weight: 1 / (1 + squared Euclidean distance)
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

- [x] Define the canonical provider-neutral `asset-tone-vector/v1` record and sparse adjustment overlay in `packages/tone-core/src/asset-vector.ts`.
- [x] Validate the fixed ten-dimension order, score bounds, provenance constants, and strict record shape in tone-core tests.

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

- [x] Add a provider-neutral vector index interface in Media Manager.
- [x] Add a queue-backed worker for vector upsert/delete operations.
- [x] Upsert after extracted tone analysis completes.
- [x] Upsert after curator-adjusted scores change.
- [x] Upsert or remove when asset visibility/readiness changes.
- [x] Delete the vector when an asset is deleted.
- [x] Track vector index schema/version and latest sync state on the asset or job record.
- [x] Add a dry-run/apply reconciliation command.
- [x] Backfill the initial public audio/video corpus once.
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

The initial deployed search bounds complementary fan-out to the three nearest direct anchors per source type and requests up to 20 counterpart matches for each anchor.

### Fuzzing

- [x] Select from a small top-scoring pool rather than always choosing rank one.
- [x] Weight sampling toward lower-distance candidates.
- [x] Exclude recently played combinations.
- [ ] Keep results within a maximum acceptable query distance.
- [x] Support deterministic sampling in tests.

Important behavior:

- A new tone request is a global restart.
- The currently playing combination has zero influence on tone-request ranking.
- The selected result becomes the starting point for the subsequent walk.

## Phase 5: Dynamic Nearest-Neighbor Walk

When playback completes without new tone input, selection switches to walk mode.

Walk constraints:

- Audio and video must both change.
- The original tone query no longer affects ranking.
- The current combination is the only tonal anchor.
- Recent combinations, audio, and video are excluded.

### Candidate Generation

1. Query S3 Vectors around the current audio vector with an audio metadata filter.
2. Query S3 Vectors around the current video vector with a video metadata filter.
3. During the exact-baseline phase, request every eligible source under a hard cap of 100 per type.
4. Exclude the current audio and video plus three recent assets of each type.
5. Include only candidates where both audio and video change.
6. Exclude the current pair and five recent combinations.
7. Compute current and candidate combo tones on demand with `combo-tone-predictor/v0`.

S3 Vectors uses the index's Euclidean metric only to retrieve plausible source assets. It does not calculate or store combo tone. Do not apply an initial maximum-distance cutoff to source queries: a farther source can still form a nearby predicted combo with its counterpart.

Initial predictor:

```text
comboTone = clamp(0.60 * audioTone + 0.40 * videoTone)
```

Walk ranking:

```text
walkScore(candidate) = distance(
  predictedTone(currentCombo),
  predictedTone(candidateCombo)
)
```

Use exact squared Euclidean distance over all ten predicted combo-tone dimensions. A maximum predicted-combo step may be added after observed distance distributions are calibrated; it belongs after combo prediction, not in source retrieval.

- [x] Sample among the nearest valid candidates rather than always selecting rank one.
- [x] Prevent immediate audio and video repeats at the API level.
- [x] Maintain a short client/API recent-history list to prevent loops.
- [x] Add an escape path when all local candidates are excluded.
- [x] Fall back to a valid random public pair if vector lookup fails.

The backend fallback first honors all supplied history, then relaxes recent combo exclusions, then relaxes recent source history. It never relaxes the immediate current-audio or current-video exclusions.

No combo tone is persisted. The existing 50-dimensional relationship geometry in `tone-core` remains experimental and is not part of the initial production walk score.

## Phase 6: Public Selection API

Add one public selection boundary:

```text
POST /public/combos/select
```

Use an explicit `mode` discriminator rather than inferring behavior from field presence. Both `search` and `walk` are deployed through the same versioned endpoint.

Tone restart request:

```json
{
  "schemaVersion": "public-combo-selection-request/v1",
  "mode": "search",
  "keywords": ["serene", "warm", "intimate"],
  "history": {
    "recentComboIds": [],
    "recentAudioAssetIds": [],
    "recentVideoAssetIds": []
  }
}
```

Walk continuation request:

```json
{
  "schemaVersion": "public-combo-selection-request/v1",
  "mode": "walk",
  "current": {
    "audioAssetId": "...",
    "videoAssetId": "..."
  },
  "history": {
    "recentAudioAssetIds": ["..."],
    "recentVideoAssetIds": ["..."],
    "recentComboIds": ["..."]
  }
}
```

Behavior:

- `mode=search`: global tone search.
- `mode=walk`: predicted-combo-tone continuation from the current pair.
- `mode=random`: random public selection when added to this boundary.
- Initial rollout keeps initialization and operational fallback on `GET /public/combos/random`.

- [x] Validate all source assets are ready and public.
- [x] Use stable synthetic IDs: `public-<videoAssetId>-<audioAssetId>`.
- [x] Return selected pair, playback URLs, algorithm version, and selection mode.
- [x] Return requested/resolved mode, predictor version, exact distance, and explicit fallback reason.
- [x] Return the complete predicted combo tone when both selected sources have eligible vectors.
- [ ] Return optional matching keywords or concise selection explanation.
- [x] Add CORS for the intended public origin.
- [x] Add request throttling, payload limits, timeout handling, and metrics.
- [ ] Cache the eligible public asset catalog and invalidate it safely.
- [x] Keep the current random endpoint as an operational fallback.

## Post-MVP Release: Public Combination Reviews

Public review capture does not block the MVP launch and is not part of its acceptance checklist. A later release can add the following separate feedback boundary after tone selection and walking are operating publicly.

Add a separate unauthenticated write path, for example:

```text
POST /public/tone-reviews
```

Later-release rules:

- Accept only `targetType=combo`.
- Accept approved keywords, not client-derived scores.
- Derive review scores server-side from versioned keyword mappings.
- Require stable synthetic combo ID and both source asset IDs.
- Verify source assets are public and the pair matches the combo ID.
- Never apply combo reviews to source audio/video scores.
- Store reviews for analysis only at first; do not alter live retrieval until a separately validated learning release.
- Store taxonomy, query/retrieval algorithm, and combo-analysis versions.
- Store server-derived review-time audio/video tone snapshots and source fingerprints for future training provenance; do not store predicted combo tones.
- Avoid raw reviewer PII.
- Use a pseudonymous local session/submission ID for idempotency and basic deduplication.
- Add rate limits and basic abuse controls.
- Log submission success/failure metrics without reviewer PII.

Later-release exit criteria:

- Anonymous visitors can submit a valid combo review.
- Invalid/private/source-mismatched combinations are rejected.
- Duplicate client retries do not create duplicate evidence.
- Review failures do not interrupt playback.

## Phase 7: `darenkeck.com` Integration

- [x] Reuse the background `ComboPlayer` experience.
- [x] Add the adaptive tone keyword picker as the MVP query input.
- [x] Submit keyword input to the global tone-search mode.
- [x] On playback completion, request a walk continuation.
- [x] Reset walk state when new tone input is submitted.
- [x] Preserve recent combo/audio/video history across automatic transitions.
- [x] Preserve player, mute, tone selection, and walk state across homepage and `/dev` navigation.
- [x] Keep the existing top-of-screen busy indicator for selection waits.
- [x] Keep random playback available if tone search fails.
- [x] Ensure controls remain readable over varied video backgrounds.
- [x] Support keyboard input, focus visibility, and reduced-motion preferences.
- [x] Initially gate the explorer behind a mode, query parameter, or controlled rollout if needed.
- [ ] Promote it to the default homepage behavior only after smoke validation.

Free-text tone input is post-MVP unless it produces a deterministic, versioned `ToneQuery` in the same 10-dimensional space. The constrained keyword picker is the MVP input method.

Richer retry, no-result, fallback-notice, and playback-recovery UI is post-MVP hardening. The initial release keeps the existing busy indicator and random fallback rather than adding a new status surface.

## Phase 8: Playback And Browser Release Gate

- [ ] Validate Chrome, Safari, and Firefox desktop playback.
- [ ] Validate iOS Safari and Android Chrome playback.
- [ ] Validate muted start, unmute, pause, replay, and automatic next transitions.
- [ ] Validate interruption paths: app switch, screen lock, background/foreground, and native media controls.
- [ ] Validate long/short audio-video duration mismatches.
- [ ] Validate automatic transitions where both audio and video change.
- [ ] Confirm no immediate audio repeats through at least 20 automatic transitions.
- [ ] Resolve or explicitly accept the current end-state frame-jump issue.
- [ ] Verify public controls remain accessible on mobile viewport sizes.

The mobile focus-loss and native play/pause issues in `wiki/open-issues.md` are MVP risks because playback is the primary product behavior.

## Phase 9: Operations And Cost

- [x] Emit structured final-outcome logs for public search and walk requests.
- [x] Emit structured success/failure logs for asset vector convergence.
- [x] Document CloudWatch Logs Insights queries for selection and vector checks.
- [x] Document vector index rebuild and reconciliation commands.
- [x] Ensure the current public random path remains available during rollback.

Dashboards, new alarms, notification email, expanded cost controls, automated stale-index detection, and a fuller rollback system are post-MVP hardening. The MVP prepares consistent logs for that work without making new monitoring infrastructure a launch dependency.

## Release Acceptance Checklist

### Corpus

- [ ] At least 20 audio and 20 video assets are public and playback-ready.
- [ ] Every release asset has `tone-taxonomy/v2` analysis and curator input.
- [x] Every eligible asset has a current vector DB record.

### Search

- [x] Keyword input starts a new global search independent of the current combo.
- [ ] Results are close to requested dimensions under exact masked distance.
- [x] Repeated identical requests can produce controlled variation.
- [x] Complementary audio/video candidates are represented.
- [x] Search failure falls back to a playable random pair.

### Walk

- [x] Automatic next selection uses exact distance from the current predicted combo tone.
- [x] Every transition changes both audio and video.
- [x] Recent-history exclusions prevent obvious loops.
- [x] Walk failure falls back to a playable pair.

### Experience

- [ ] Homepage playback, tone selection, and automatic walk work on the target browser/device matrix.
- [x] Selection waits retain the existing top-of-screen busy indicator.
- [ ] Search and walk failures preserve playable random fallback behavior.
- [ ] Public controls are keyboard-accessible and readable over media.

### Operations

- [ ] Structured search, walk, fallback, and vector-sync logs are visible after production smoke traffic.
- [x] Index reconciliation and log-query procedures are documented.

## Recommended Implementation Order

1. Complete the 20/20 media corpus.
2. Complete one curator pass over every source asset.
3. [x] Select S3 Vectors and define `asset-tone-vector/v1`.
4. [x] Implement vector lifecycle synchronization, reconciliation, and the initial production backfill.
5. [x] Implement and deploy dynamic global tone search with complementary retrieval, exact masked reranking, and weighted top-five fuzzing.
6. [x] Implement and deploy dynamic neighbor walking with exact predicted-combo ranking, both-source change enforcement, bounded history, and random fallback.
7. [x] Add and deploy the unified `POST /public/combos/select` endpoint for explicit search and walk modes.
8. [x] Integrate tone selection and automatic walking into the persistent Darenkeck application. The source implementation and local route-continuity smoke are complete; publishing remains part of the release gate.
9. [ ] Complete the desktop/mobile browser and playback matrix, publish the integrated client, and verify the structured selection/vector-sync logs against production smoke traffic. Log emission and Logs Insights queries are complete in source.
10. Promote the validated tone selection and walk experience to the public homepage.

After the MVP release, implement the anonymous combo review endpoint, abuse controls, consent/privacy behavior, review operations, and public review UI as a separate release.

## Related Documents

- `TONE_REVIEW_PLAN.md`
- `apps/tone-embedding/VECTOR_DB_PREP_PLAN.md`
- `packages/tone-core/src/combo.ts`
- `wiki/architecture-map.md`
- `wiki/deploy-and-ops.md`
- `wiki/open-issues.md`
