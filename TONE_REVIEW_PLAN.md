# Tone Review Plan

## Purpose And Status

Tone reviews capture target-centered human descriptions without making review records user-identity records.

The authenticated curator workflow is deployed for `audio`, `video`, and `combo` targets. Reviews are append-only DynamoDB records submitted from the dedicated Media Manager Review page. Anonymous public submission, review export, and learned combo-tone prediction are not implemented.

## Invariants

- Review input is keyword-only and starts blank.
- Reviews attach to one `audio`, `video`, or `combo` target.
- The authenticated endpoint persists `reviewSource="curator"` regardless of the submitted value.
- The authenticated user's raw email is not copied onto the review record or included in its keys.
- Audio/video review scores are derived server-side; client-provided scores are ignored.
- Audio/video reviews may adjust only their target asset.
- Combo reviews never adjust either source asset.
- DynamoDB remains authoritative for reviews and effective asset tone.
- Only effective source asset vectors are persisted in the vector index.
- Combo vectors are not precomputed, persisted, or indexed. Future combo-tone prediction will compute only the candidate outputs needed at request time.

## Current Review UI

The dedicated `/review` route owns review capture. Asset detail pages and the Review/Combos screens show review history but do not contain additional review forms.

Current capture behavior:

- The page supports Combo, Audio, and Video targets.
- Combo mode defaults to a random public playable pair.
- Audio/video modes can select from the authenticated owner's asset pool.
- Each target starts with no selected keywords.
- Five keyword options are shown at a time.
- Initial options are deterministically seeded by the target.
- After a selection, the latest keyword anchors the next option set.
- Subsequent sets mix nearby taxonomy terms with exploration terms.
- Selected keywords remain visible and removable.
- The current UI requires at least three selected keywords before submission.
- Combo capture uses the shared `ComboToneReviewPlayer`; audio/video capture remains app-local.

The server does not yet enforce every UI rule. In particular, combo keyword support and minimum keyword count still rely partly on the client and should be enforced before adding a public write endpoint.

## Submission Boundary

Both current review routes require an authenticated JWT.

For audio/video targets, the API verifies:

- The target exists.
- The authenticated user owns it.
- Its type matches the submitted target type.
- Tone analysis is ready and has model scores plus a taxonomy version.
- At least one submitted keyword maps to a supported tone dimension.

For combo targets, the API verifies ownership of an existing combo or ownership and media types for the source audio/video assets of a synthetic combo. Combo source readiness, stable synthetic target identity, source-ID consistency for saved combos, idempotency, and duplicate-submission protection remain follow-ups.

## Trusted And Legacy Fields

The current shared input contract accepts more fields than the Review UI sends. The persistence boundary behaves as follows:

| Field | Current behavior |
| --- | --- |
| `targetType`, `targetId` | Validated and persisted |
| `sourceVideoAssetId`, `sourceAudioAssetId` | Persisted when supplied; the current UI supplies them for combo reviews |
| `keywords` | Trimmed, deduplicated, and persisted |
| `reviewSource` | Ignored from the client; persisted as `curator` |
| `scores` | Ignored from the client |
| `taxonomyVersion` | Taken from the target asset for audio/video; accepted from combo input when supplied |
| `reviewerId` | Legacy optional caller field; current UI does not send it |
| `modelScoresSnapshot`, `baseScoresSnapshot` | Legacy optional caller fields; current UI does not send them and they are not trusted training snapshots |
| `notes` | Optional caller text; current UI does not use it |

Future contracts should separate client input from server-derived stored fields rather than exposing legacy persistence fields on the write request.

## Stored Review Record

Reviews use this target-centered shape:

```ts
type ToneReviewRecord = {
  id: string;
  schemaVersion: number;
  targetType: "audio" | "video" | "combo";
  targetId: string;
  sourceVideoAssetId?: string;
  sourceAudioAssetId?: string;
  reviewSource: "curator";
  taxonomyVersion?: "tone-taxonomy/v1" | "tone-taxonomy/v2";
  keywords: string[];
  scores?: Partial<ToneVector>; // Server-derived for audio/video only.
  reviewerId?: string; // Legacy caller field; not trusted provenance.
  modelScoresSnapshot?: Partial<ToneVector>; // Legacy caller field; not trusted.
  baseScoresSnapshot?: Partial<ToneVector>; // Legacy caller field; not trusted.
  notes?: string;
  createdAt: string;
  updatedAt: string;
};
```

DynamoDB keys:

```text
pk = TONE_REVIEW#<targetType>#<targetId>
sk = REVIEW#<createdAt>#<reviewId>
```

The curator GSI supports global curator-review listing without putting reviewer identity into keys.

## Audio And Video Materialization

`toneAnalysis.scores` remains the untouched OpenAI model output. Curator input is materialized separately:

- Keywords are mapped through the production tone taxonomy into sparse dimension scores.
- OpenAI contributes one vote to every model dimension.
- Each taxonomy-compatible curator review contributes one vote only to dimensions produced by its keywords.
- Per-dimension sums and counts are independent.
- `toneAnalysis.adjustedScores` stores dimensions with curator input.
- `toneAnalysis.scoreAdjustment` stores `tone-score-adjustment/v1` provenance and timestamps.
- Effective asset tone overlays sparse adjustments on model scores: `{ ...scores, ...adjustedScores }`.

The materializer uses `model-prior-mean/v1`. Review submission attempts materialization immediately, and tone reanalysis rebuilds it after replacing model scores. Submission currently returns success even if immediate materialization fails; another review, reanalysis, or repair operation is then required.

New production analysis and vector indexing use `tone-taxonomy/v2`. The contract still accepts v1 history, while keyword derivation uses the current production mapping. Before using historical reviews for training or calibration, derivation must become version-addressable or review capture must be enforced as v2-only.

## Asset Vector Convergence

After an audio/video adjustment changes:

1. The API sends `{ assetId }` to the vector synchronization queue.
2. The Assets DynamoDB Stream provides a second durable mutation path.
3. The worker rereads the authoritative asset.
4. An eligible public, ready, taxonomy-v2 audio/video asset is upserted with its effective tone.
5. Private, unsupported, incomplete, or non-ready assets have any stale vector deleted.

Combo reviews do not trigger source-vector changes.

## Combo Reviews And Tone Prediction

Current combo reviews store human keywords and source asset IDs. They do not derive a combo score vector, snapshot review-time source vectors, or feed live retrieval.

The intended predictor boundary is:

```ts
interface ComboTonePredictor {
  readonly version: string;

  predict(input: {
    audioTone: ToneVector;
    videoTone: ToneVector;
  }): ToneVector;
}
```

Initial deterministic predictor:

```text
combo-tone-predictor/v0
comboTone = clamp(0.60 * audioTone + 0.40 * videoTone)
```

The predictor always consumes the current effective audio and video vectors and computes output only for candidate pairs under consideration.

Once enough compatible combo review data exists, a learned predictor may replace the deterministic implementation behind the same interface. The preferred first learned form is a regularized residual over `v0`, with derived delta and interaction features computed internally from the two inputs.

Reliable training rows will require server-derived data not currently captured:

```ts
type ComboToneTrainingReview = {
  reviewId: string;
  comboId: string;
  audioAssetId: string;
  videoAssetId: string;
  audioToneSnapshot: ToneVector;
  videoToneSnapshot: ToneVector;
  audioSourceFingerprint: string;
  videoSourceFingerprint: string;
  assetVectorSchemaVersion: "asset-tone-vector/v1";
  taxonomyVersion: "tone-taxonomy/v2";
  labelScores: Partial<Record<ToneDimension, number>>;
  labelDimensions: ToneDimension[];
  createdAt: string;
};
```

Requirements for that future capture path:

- Source snapshots and fingerprints are generated server-side at review time.
- Combo keywords are mapped through the recorded taxonomy version into sparse tone labels.
- Sparse label scores are training evidence for explicitly labeled dimensions, not persisted predicted combo vectors.
- Unlabeled dimensions are excluded from loss rather than interpreted as neutral values.
- Existing source IDs remain part of every row for audit and replay.
- Predictor and training schema versions are explicit.
- Historical keyword-only reviews may be remapped when provenance is sufficient, but they cannot reconstruct exact review-time effective source vectors.

The existing 50-dimensional combo relationship geometry in `tone-core` remains experimental descriptive geometry. It is not the persisted representation or the production combo-tone predictor contract.

## Listing And Navigation

- `GET /tone-reviews?targetType=<type>&targetId=<id>` queries one target partition.
- Global curator listing uses the curator GSI.
- `/review` shows reviews for the current target.
- `/combos` lists combo review records and links back to their review target.
- Cursor fields exist, but current Review and Combos screens do not provide complete pagination controls.
- Listing is authenticated, but target/global owner scoping should be tightened before reviews span multiple owners or become publicly writable.

## Privacy

- Do not automatically persist authenticated email on review records.
- Do not put reviewer identity in DynamoDB keys.
- Do not trust caller-provided IDs or snapshots as model provenance.
- Do not place raw identity into `reviewerId`.
- Free-form text must be treated as potentially containing personal information.
- A future pseudonymous identifier must be server-derived with a salted one-way transform.
- Public submission requires separate consent copy, abuse controls, rate limiting, and retention policy.
- API access logs contain operational request metadata and are governed separately from review-record privacy.

## Operations

The current purge command is dry-run first:

```text
bun run --cwd infra/cdk purge:tone-reviews
bun run --cwd infra/cdk purge:tone-reviews -- --apply --confirm-production
```

It reports aggregate counts, clears materialized audio/video adjustments for affected targets, and deletes review records. DynamoDB point-in-time recovery protects the table generally, but there is no review-specific export, restore, or consistency-repair command.

Required operational follow-ups:

- Add a versioned review export format.
- Add review-specific backup and restore instructions.
- Make purge/rebuild behavior safe under partial failure and concurrent submissions.
- Add adjustment reconciliation from append-only reviews.
- Audit review/list access policy before public launch.

## Next Steps

1. Separate write-input and stored-review contracts.
2. Enforce taxonomy-versioned keyword derivation.
3. Harden combo target/source validation and idempotency.
4. Add server-derived sparse combo labels and effective source snapshots.
5. Implement and test `combo-tone-predictor/v0` without persisting combo vectors.
6. Add review export and adjustment reconciliation.
7. Add the separate anonymous public submission boundary only after privacy and abuse controls are complete.
