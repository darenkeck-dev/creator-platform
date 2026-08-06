# Review Experience: Rough Thoughts

These notes describe the current authenticated curator-review experience and the likely direction for a future public review surface. Current behavior is intentionally keyword-first: reviewers describe what the media feels like without seeing or editing model-generated scores.

## What the User Sees and Does During a Review

The reviewer opens `/review` and chooses a target type: Combo, Audio, or Video. Combo mode begins with a random public audio/video pair; Audio and Video modes select from the authenticated owner's assets. The reviewer can play the media, choose words that describe its perceived tone, remove words that do not fit, submit after selecting at least three, or move to the next target.

The media should remain the visual focus. Review controls sit on or immediately around the player so the user can judge and label without repeatedly shifting attention to a separate form. After submission, the UI confirms that the review was saved and the current target's review history remains visible below.

## How Tone Keywords Are Presented and Selected

The picker presents five concrete leaf keywords at a time rather than exposing dimensions, scores, or the full taxonomy. A keyword is toggled with one click or tap. Selected words remain visible as removable chips, making the review read like a short description assembled by the reviewer.

The first five words are deterministically seeded by the target. After the reviewer selects a word, that latest choice becomes the anchor for the next suggestion round. The next control produces three nearby taxonomy terms and two broader exploration terms, balancing refinement with the chance to change direction.

## How a Large Vocabulary Remains Manageable

The current vocabulary contains 54 review words, but only five are presented at once. This progressive-disclosure model avoids a long searchable list, a dense emotion tree, or category decisions that the reviewer must understand before expressing a reaction.

The important mechanisms are:

- Small suggestion sets reduce scanning cost.
- Target-seeded starting words provide variety while remaining repeatable.
- The latest selection gives subsequent suggestions local context.
- Exploration words prevent the interaction from becoming trapped in one semantic region.
- Previously shown words are tracked so repeated suggestion rounds continue covering the vocabulary.
- Selected chips persist across rounds, so exploration does not erase the developing review.

For a public experience, I would keep this interaction bounded to a smaller practical selection cap than the current generic 24-word limit. Three to six strong words are likely more useful than a long, weakly considered list.

## How the Experience Differs Between Desktop and Mobile

On desktop, the combination can act as a large visual canvas. Suggestions fit in a centered row at the top, selected words and Submit sit at the lower left, and Next sits at the lower right. There is enough separation for these controls to remain visible without obscuring the main subject of the video.

On mobile, the same hierarchy should become more compact rather than adding different concepts. Suggestions may wrap or advance more often, selected chips should stack upward from the bottom safe area, and controls need full touch targets with enough spacing to avoid accidental playback changes. The media should remain edge-to-edge where possible, but labels must use readable contrast over unpredictable imagery.

Mobile also needs more defensive playback behavior. App switching, screen locking, focus loss, and native media controls can interrupt one track independently, so mobile validation should cover those transitions in addition to responsive layout.

## How Audio and Video Are Played Together

A combination uses separate HTML video and audio elements. The video supplies the visible image and is always muted; the audio element supplies the soundtrack. Both sources are preloaded and the combo does not report itself ready until both can play.

The background player treats the media as one experience. Clicking or keyboard-activating the video toggles the pair together, and a centered Play or Replay overlay appears when playback is paused or ended. Standalone Audio and Video reviews use the normal asset player rather than the combined background surface.

## How Synchronization and Playback Controls Work

One track is always the timeline authority:

- With audio enabled, audio is the master timeline and video follows it.
- With audio muted, video is the master timeline and audio playback is stopped.
- Unmuting aligns audio to the current video time and starts both tracks from the user gesture.

Play and pause operate on both elements. Seeking clamps the master time and maps the follower into its own duration; a shorter follower can loop while the master continues. Waiting, pause, end, and error signals update a shared playback phase so the UI presents one state rather than two competing media states. At the master timeline's end, both tracks stop and Replay restarts them from the beginning.

The current review surface intentionally keeps controls minimal. Detailed seek controls exist in the default player variant, while the full-screen review variant favors direct click-to-play/pause and an obvious replay overlay.

## What Is Stored When a Review Is Submitted

Each review is an append-only, target-centered DynamoDB record. It stores:

- Review ID and schema version.
- Target type and target ID.
- Selected keywords, trimmed and deduplicated.
- `reviewSource="curator"` for the authenticated workflow.
- Taxonomy version when available.
- Source video and audio asset IDs for combo reviews.
- Server-derived sparse tone scores for Audio and Video reviews.
- Created and updated timestamps.

The authenticated user's raw email is not copied into the review record or its keys. The current UI does not send free-form notes, model-score snapshots, or base-score snapshots. Combo reviews currently store keywords and source IDs only: they do not persist a predicted combo vector or review-time source-vector snapshots.

Audio and Video review keywords can update the target asset's materialized adjusted tone scores. Combo reviews do not modify either source asset and do not currently affect live retrieval.

## How Reviews May Support Future Personalization

The first value of review data is global calibration, not individual profiling. Aggregated Audio and Video reviews can improve effective source vectors, while Combo reviews can eventually provide sparse labels for training a better combination-tone predictor.

Reliable future Combo training requires the server to capture review-time source vectors, source fingerprints, taxonomy version, and derived labeled dimensions. Unselected dimensions must remain unknown rather than being treated as neutral.

Individual personalization would require a separate, explicit identity boundary because current reviews intentionally omit reviewer identity. Two reasonable future approaches are:

- Local-only preference state that adjusts ranking in the browser without creating an account-level profile.
- An opt-in pseudonymous server identifier, generated server-side, that supports a personal preference vector or reranker without putting raw identity into review records.

Personalization should remain a layer over the global predictor, not rewrite shared source tone. It should also include consent, deletion and retention rules, abuse controls, and a clear distinction between explicit review keywords and inferred behavior such as skips or playback duration. None of this is implemented today.

See also: [Tone Review Plan](../TONE_REVIEW_PLAN.md), [Tone Vector Dimensions](tone-vector-dimensions.md), and [Architecture Map](architecture-map.md).
