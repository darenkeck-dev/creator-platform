# Asset Upload and Processing Flow

This diagram follows an uploaded media asset from metadata creation through playback, tone analysis, and vector-search eligibility. DynamoDB is authoritative; S3 media and S3 Vectors are derived from that record.

```mermaid
flowchart TD
  User[Media Manager user] --> Create[POST /assets]
  Create --> Draft[(DynamoDB asset<br/>status: draft)]

  Draft --> Sign[Request signed upload<br/>single or multipart]
  Sign --> Upload[Browser uploads directly<br/>to Originals S3]
  Upload --> Confirm[POST upload-complete<br/>or multipart complete]
  Confirm --> Uploaded[(DynamoDB asset<br/>status: uploaded)]

  Upload --> ObjectEvent[S3 Object Created event]
  ObjectEvent --> EventBridge[EventBridge<br/>originals object-created rule]

  EventBridge --> ConversionQueue[SQS conversion queue]
  EventBridge --> ToneQueue[SQS tone-analysis queue]

  subgraph Conversion[Playback conversion branch]
    ConversionQueue --> UploadTrigger[upload-trigger Lambda]
    UploadTrigger --> Profile{Processing profile}
    Profile -->|Video or audio HLS| SubmitMC[Submit MediaConvert job]
    SubmitMC --> MC[MediaConvert]
    MC --> DerivedMedia[(Derived S3<br/>HLS, poster, renditions)]
    MC --> MCEvent[MediaConvert state event]
    MCEvent --> StatusLambda[mediaconvert-status Lambda]
    StatusLambda --> PlaybackReady[(DynamoDB asset<br/>status: ready or error<br/>stream metadata)]
    Profile -->|Passthrough| Passthrough[(DynamoDB asset<br/>status: ready)]
  end

  subgraph Tone[Tone-analysis branch]
    ToneQueue --> ToneWorker[tone-analysis Lambda]
    ToneWorker --> MediaType{Media type}
    MediaType -->|Audio| Normalize[ffmpeg normalize to MP3]
    MediaType -->|Video| Frames[ffmpeg sample frames]
    MediaType -->|Unsupported| ToneSkipped[(toneAnalysis: skipped)]
    Normalize --> OpenAI[OpenAI tone analysis]
    Frames --> OpenAI
    OpenAI --> PersistTone[Tone worker persists result]
    PersistTone --> ToneArtifact[(Derived S3<br/>asset-analysis.json)]
    PersistTone --> ToneReady[(DynamoDB asset<br/>toneAnalysis: ready or error)]
  end

  PlaybackReady --> SyncQueue[SQS vector-sync queue]
  Passthrough --> SyncQueue
  ToneReady --> SyncQueue
  ToneSkipped --> SyncQueue
  Uploaded --> SyncQueue

  subgraph Vector[Vector convergence]
    SyncQueue --> VectorWorker[vector-sync Lambda]
    VectorWorker --> Reread[Re-read authoritative asset]
    Reread --> Eligible{Public + ready + audio/video<br/>+ taxonomy-v2 tone ready?}
    Eligible -->|Yes| Upsert[(Upsert S3 Vector)]
    Eligible -->|No| Delete[(Delete stale vector)]
    Upsert --> SyncState[(Update vectorSync state)]
    Delete --> SyncState
  end

  Draft -. DynamoDB Stream .-> VectorWorker

  PlaybackReady --> Playback[Playback APIs can return HLS]
  Upsert --> Search[Tone search and walking can retrieve asset]
```

## Dependency Summary

| Result              | Required completed steps                                                                                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Original stored     | Asset metadata exists and the browser upload to Originals S3 succeeds.                                                                                                                        |
| Upload confirmed    | The API verifies the S3 object and records its size/content type. This confirmation may race with async processing, so it does not overwrite a later `processing`, `ready`, or `error` state. |
| Playable asset      | The conversion branch reaches `ready` and writes stream metadata, or a valid passthrough profile reaches `ready`. Tone analysis is not required for playback.                                 |
| Tone-enriched asset | The independent tone worker completes OpenAI analysis and stores `toneAnalysis` metadata plus `derived/<assetId>/tone/asset-analysis.json`. Conversion does not need to be finished first.    |
| Searchable vector   | The authoritative asset is audio/video, public, playback-ready, and has complete ready `tone-taxonomy/v2` scores.                                                                             |

## Failure Boundaries

- Conversion and tone analysis use separate SQS queues and DLQs. A tone backlog or failure does not block conversion or playback.
- A conversion failure sets the top-level asset status to `error`; a tone failure changes only `toneAnalysis.status`.
- Workers append bounded lifecycle entries to `asset.auditLog` for upload, conversion, MediaConvert, and tone-analysis events.
- Vector messages contain only `assetId`. The vector worker always rereads DynamoDB, making retries and out-of-order messages converge safely.
- S3 Vectors contains only derived search records. Reconciliation can rebuild it from DynamoDB without re-uploading media.

## Primary Components

| Layer            | Components                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------- |
| API              | `api-assets`, `api-asset-by-id`                                                          |
| Event routing    | Originals S3, EventBridge object-created rule                                            |
| Conversion       | `media-manager-upload-events` SQS, `upload-trigger`, MediaConvert, `mediaconvert-status` |
| Tone analysis    | `media-manager-tone-analysis` SQS, `tone-analysis`, ffmpeg Lambda layer, OpenAI          |
| Persistence      | Assets DynamoDB table, Originals S3, Derived S3                                          |
| Vector lifecycle | Assets DynamoDB Stream, vector-sync SQS, `vector-sync`, S3 Vectors `asset-tone-v1`       |

See also: [Architecture Map](architecture-map.md), [Deploy and Ops](deploy-and-ops.md), and [Tone Vector Dimensions](tone-vector-dimensions.md).
