import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import {
  CreateJobCommand,
  DescribeEndpointsCommand,
  MediaConvertClient,
  type JobSettings,
} from "@aws-sdk/client-mediaconvert";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { z } from "zod";
import { upgradeAssetItemSchemaVersion } from "../shared/asset-record-versioning";
import { appendAssetAuditLogEntry } from "../shared/asset-audit-log";

type SqsEvent = {
  Records?: Array<{
    body?: string;
  }>;
};

const EventBridgeS3ObjectCreatedEventSchema = z.object({
  source: z.string().optional(),
  "detail-type": z.string().optional(),
  detail: z
    .object({
      bucket: z
        .object({
          name: z.string().optional(),
        })
        .optional(),
      object: z
        .object({
          key: z.string().optional(),
          size: z.number().optional(),
        })
        .optional(),
    })
    .optional(),
});
type EventBridgeS3ObjectCreatedEvent = z.infer<typeof EventBridgeS3ObjectCreatedEventSchema>;

type AssetRecord = {
  id: string;
  type: "video" | "audio" | "image" | "folder";
  status: "draft" | "uploaded" | "processing" | "ready" | "error";
  original: {
    bucket: string;
    key: string;
    size: number;
    contentType: string;
  };
  processingProfile?: string;
};

const AssetRecordSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["video", "audio", "image", "folder"]),
  status: z.enum(["draft", "uploaded", "processing", "ready", "error"]),
  original: z.object({
    bucket: z.string().min(1),
    key: z.string().min(1),
    size: z.number().nonnegative(),
    contentType: z.string().min(1),
  }),
  processingProfile: z.string().min(1).optional(),
});

type ProcessingProfile = {
  profileId: ProcessingProfileId;
  mode: "mediaconvert" | "passthrough";
};

type ConversionState = "queued" | "processing" | "ready" | "error" | "passthrough_ready";
type ProcessingProfileId =
  | "video-standard-v1"
  | "audio-passthrough-v1"
  | "audio-transcode-hls-v1"
  | "image-passthrough-v1";
type VideoOrientation = "landscape" | "portrait";

const VIDEO_STANDARD_V1 = "video-standard-v1";
const AUDIO_PASSTHROUGH_V1 = "audio-passthrough-v1";
const AUDIO_TRANSCODE_HLS_V1 = "audio-transcode-hls-v1";
const IMAGE_PASSTHROUGH_V1 = "image-passthrough-v1";

const PROFILE_BY_ID: Record<ProcessingProfileId, ProcessingProfile> = {
  [VIDEO_STANDARD_V1]: { profileId: VIDEO_STANDARD_V1, mode: "mediaconvert" },
  [AUDIO_PASSTHROUGH_V1]: { profileId: AUDIO_PASSTHROUGH_V1, mode: "passthrough" },
  [AUDIO_TRANSCODE_HLS_V1]: { profileId: AUDIO_TRANSCODE_HLS_V1, mode: "mediaconvert" },
  [IMAGE_PASSTHROUGH_V1]: { profileId: IMAGE_PASSTHROUGH_V1, mode: "passthrough" },
};

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});
const s3 = new S3Client({});
const mediaConvertControl = new MediaConvertClient({});
let mediaConvertDataPlane: MediaConvertClient | null = null;

type LogContext = Record<string, unknown>;

function logInfo(message: string, context: LogContext = {}): void {
  console.log(
    JSON.stringify({
      level: "info",
      message,
      ...context,
    })
  );
}

function logWarn(message: string, context: LogContext = {}): void {
  console.warn(
    JSON.stringify({
      level: "warn",
      message,
      ...context,
    })
  );
}

function errorDetails(error: unknown): { errorName?: string; errorMessage: string } {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
    };
  }

  return {
    errorMessage: "Unknown error",
  };
}

function requiredEnv(
  name:
    | "ASSETS_TABLE_NAME"
    | "ASSETS_ORIGINALS_BUCKET_NAME"
    | "ASSETS_DERIVED_BUCKET_NAME"
    | "MEDIACONVERT_ROLE_ARN"
): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function decodeS3Key(rawKey: string): string {
  return decodeURIComponent(rawKey.replace(/\+/g, " "));
}

function extractAssetIdFromKey(key: string): string | null {
  const matched = key.match(/^incoming\/([^/]+)(?:$|\/)/);
  return matched?.[1] ?? null;
}

function parseEventBridgeMessage(body: string | undefined): EventBridgeS3ObjectCreatedEvent | null {
  if (!body) {
    logWarn("Skipping SQS record without body");
    return null;
  }

  try {
    const parsed = JSON.parse(body) as unknown;
    const validated = EventBridgeS3ObjectCreatedEventSchema.safeParse(parsed);
    if (!validated.success) {
      logWarn("Skipping SQS record with invalid EventBridge payload");
      return null;
    }

    return validated.data;
  } catch (error) {
    logWarn("Skipping SQS record with non-JSON body", errorDetails(error));
    return null;
  }
}

function fallbackProfileForAssetType(assetType: AssetRecord["type"]): ProcessingProfileId {
  if (assetType === "video") {
    return VIDEO_STANDARD_V1;
  }

  if (assetType === "audio") {
    return AUDIO_TRANSCODE_HLS_V1;
  }

  return IMAGE_PASSTHROUGH_V1;
}

function resolveProcessingProfile(asset: AssetRecord): ProcessingProfile {
  const profileId = asset.processingProfile ?? fallbackProfileForAssetType(asset.type);
  const parsedProfileId = z
    .enum([VIDEO_STANDARD_V1, AUDIO_PASSTHROUGH_V1, AUDIO_TRANSCODE_HLS_V1, IMAGE_PASSTHROUGH_V1])
    .safeParse(profileId);
  if (!parsedProfileId.success) {
    logWarn("Invalid processing profile on asset; defaulting to video profile", {
      assetId: asset.id,
      assetType: asset.type,
      providedProfile: asset.processingProfile,
      fallbackProfile: VIDEO_STANDARD_V1,
    });
    return PROFILE_BY_ID[VIDEO_STANDARD_V1];
  }

  logInfo("Resolved processing profile", {
    assetId: asset.id,
    assetType: asset.type,
    providedProfile: asset.processingProfile,
    resolvedProfile: parsedProfileId.data,
    mode: PROFILE_BY_ID[parsedProfileId.data].mode,
  });

  return PROFILE_BY_ID[parsedProfileId.data];
}

function auditCategoryForProfile(
  profileId: ProcessingProfileId
): "audio_conversion" | "media_conversion" {
  return profileId === AUDIO_TRANSCODE_HLS_V1 || profileId === AUDIO_PASSTHROUGH_V1
    ? "audio_conversion"
    : "media_conversion";
}

function mediaConvertJobSettings(
  assetId: string,
  originalsBucket: string,
  key: string,
  derivedBucket: string,
  contentType: string,
  orientation: VideoOrientation
): JobSettings {
  const destinationBase = `s3://${derivedBucket}/derived/${assetId}`;

  const input = {
    FileInput: `s3://${originalsBucket}/${key}`,
    AudioSelectors: {
      "Audio Selector 1": {
        DefaultSelection: "DEFAULT" as const,
      },
    },
    ...(contentType.startsWith("audio/") ? {} : { VideoSelector: {} }),
  };

  return {
    Inputs: [input],
    OutputGroups: [
      {
        Name: "HLS",
        OutputGroupSettings: {
          Type: "HLS_GROUP_SETTINGS",
          HlsGroupSettings: {
            Destination: `${destinationBase}/hls/`,
            SegmentLength: 6,
            MinSegmentLength: 0,
            ManifestDurationFormat: "INTEGER",
            OutputSelection: "MANIFESTS_AND_SEGMENTS",
            StreamInfResolution: "INCLUDE",
            ClientCache: "ENABLED",
          },
        },
        Outputs:
          orientation === "portrait"
            ? [
                {
                  NameModifier: "_1080p",
                  ContainerSettings: { Container: "M3U8" },
                  VideoDescription: {
                    Width: 1080,
                    Height: 1920,
                    CodecSettings: {
                      Codec: "H_264",
                      H264Settings: {
                        RateControlMode: "QVBR",
                        MaxBitrate: 6000000,
                        QvbrSettings: { QvbrQualityLevel: 7 },
                      },
                    },
                  },
                  AudioDescriptions: [
                    {
                      AudioSourceName: "Audio Selector 1",
                      CodecSettings: {
                        Codec: "AAC",
                        AacSettings: {
                          Bitrate: 128000,
                          CodingMode: "CODING_MODE_2_0",
                          SampleRate: 48000,
                        },
                      },
                    },
                  ],
                },
                {
                  NameModifier: "_720p",
                  ContainerSettings: { Container: "M3U8" },
                  VideoDescription: {
                    Width: 720,
                    Height: 1280,
                    CodecSettings: {
                      Codec: "H_264",
                      H264Settings: {
                        RateControlMode: "QVBR",
                        MaxBitrate: 3500000,
                        QvbrSettings: { QvbrQualityLevel: 7 },
                      },
                    },
                  },
                  AudioDescriptions: [
                    {
                      AudioSourceName: "Audio Selector 1",
                      CodecSettings: {
                        Codec: "AAC",
                        AacSettings: {
                          Bitrate: 128000,
                          CodingMode: "CODING_MODE_2_0",
                          SampleRate: 48000,
                        },
                      },
                    },
                  ],
                },
                {
                  NameModifier: "_540p",
                  ContainerSettings: { Container: "M3U8" },
                  VideoDescription: {
                    Width: 540,
                    Height: 960,
                    CodecSettings: {
                      Codec: "H_264",
                      H264Settings: {
                        RateControlMode: "QVBR",
                        MaxBitrate: 2000000,
                        QvbrSettings: { QvbrQualityLevel: 7 },
                      },
                    },
                  },
                  AudioDescriptions: [
                    {
                      AudioSourceName: "Audio Selector 1",
                      CodecSettings: {
                        Codec: "AAC",
                        AacSettings: {
                          Bitrate: 96000,
                          CodingMode: "CODING_MODE_2_0",
                          SampleRate: 48000,
                        },
                      },
                    },
                  ],
                },
              ]
            : [
                {
                  NameModifier: "_1080p",
                  ContainerSettings: { Container: "M3U8" },
                  VideoDescription: {
                    Width: 1920,
                    Height: 1080,
                    CodecSettings: {
                      Codec: "H_264",
                      H264Settings: {
                        RateControlMode: "QVBR",
                        MaxBitrate: 6000000,
                        QvbrSettings: { QvbrQualityLevel: 7 },
                      },
                    },
                  },
                  AudioDescriptions: [
                    {
                      AudioSourceName: "Audio Selector 1",
                      CodecSettings: {
                        Codec: "AAC",
                        AacSettings: {
                          Bitrate: 128000,
                          CodingMode: "CODING_MODE_2_0",
                          SampleRate: 48000,
                        },
                      },
                    },
                  ],
                },
                {
                  NameModifier: "_720p",
                  ContainerSettings: { Container: "M3U8" },
                  VideoDescription: {
                    Width: 1280,
                    Height: 720,
                    CodecSettings: {
                      Codec: "H_264",
                      H264Settings: {
                        RateControlMode: "QVBR",
                        MaxBitrate: 3500000,
                        QvbrSettings: { QvbrQualityLevel: 7 },
                      },
                    },
                  },
                  AudioDescriptions: [
                    {
                      AudioSourceName: "Audio Selector 1",
                      CodecSettings: {
                        Codec: "AAC",
                        AacSettings: {
                          Bitrate: 128000,
                          CodingMode: "CODING_MODE_2_0",
                          SampleRate: 48000,
                        },
                      },
                    },
                  ],
                },
                {
                  NameModifier: "_480p",
                  ContainerSettings: { Container: "M3U8" },
                  VideoDescription: {
                    Width: 854,
                    Height: 480,
                    CodecSettings: {
                      Codec: "H_264",
                      H264Settings: {
                        RateControlMode: "QVBR",
                        MaxBitrate: 2000000,
                        QvbrSettings: { QvbrQualityLevel: 7 },
                      },
                    },
                  },
                  AudioDescriptions: [
                    {
                      AudioSourceName: "Audio Selector 1",
                      CodecSettings: {
                        Codec: "AAC",
                        AacSettings: {
                          Bitrate: 96000,
                          CodingMode: "CODING_MODE_2_0",
                          SampleRate: 48000,
                        },
                      },
                    },
                  ],
                },
              ],
      },
      {
        Name: "Poster",
        OutputGroupSettings: {
          Type: "FILE_GROUP_SETTINGS",
          FileGroupSettings: {
            Destination: `${destinationBase}/thumbs/`,
          },
        },
        Outputs: [
          {
            NameModifier: "poster",
            ContainerSettings: { Container: "RAW" },
            VideoDescription: {
              CodecSettings: {
                Codec: "FRAME_CAPTURE",
                FrameCaptureSettings: {
                  FramerateNumerator: 1,
                  FramerateDenominator: 1,
                  MaxCaptures: 1,
                  Quality: 80,
                },
              },
            },
          },
        ],
      },
    ],
  };
}

function mediaConvertAudioHlsJobSettings(
  assetId: string,
  originalsBucket: string,
  key: string,
  derivedBucket: string
): JobSettings {
  const destinationBase = `s3://${derivedBucket}/derived/${assetId}`;

  return {
    Inputs: [
      {
        FileInput: `s3://${originalsBucket}/${key}`,
        AudioSelectors: {
          "Audio Selector 1": {
            DefaultSelection: "DEFAULT" as const,
          },
        },
      },
    ],
    OutputGroups: [
      {
        Name: "HLS",
        OutputGroupSettings: {
          Type: "HLS_GROUP_SETTINGS",
          HlsGroupSettings: {
            Destination: `${destinationBase}/hls/`,
            SegmentLength: 6,
            MinSegmentLength: 0,
            ManifestDurationFormat: "INTEGER",
            OutputSelection: "MANIFESTS_AND_SEGMENTS",
            ClientCache: "ENABLED",
          },
        },
        Outputs: [
          {
            NameModifier: "_audio",
            ContainerSettings: { Container: "M3U8" },
            AudioDescriptions: [
              {
                AudioSourceName: "Audio Selector 1",
                CodecSettings: {
                  Codec: "AAC",
                  AacSettings: {
                    Bitrate: 128000,
                    CodingMode: "CODING_MODE_2_0",
                    SampleRate: 48000,
                  },
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

function parsePositiveDimension(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return Math.trunc(parsed);
}

async function resolveVideoOrientation(bucketName: string, key: string): Promise<VideoOrientation> {
  try {
    const head = await s3.send(
      new HeadObjectCommand({
        Bucket: bucketName,
        Key: key,
      })
    );

    const width = parsePositiveDimension(head.Metadata?.["video-width"]);
    const height = parsePositiveDimension(head.Metadata?.["video-height"]);
    if (!width || !height) {
      logWarn("Video orientation metadata missing or invalid; defaulting to landscape", {
        bucketName,
        key,
        metadataWidth: head.Metadata?.["video-width"],
        metadataHeight: head.Metadata?.["video-height"],
      });
      return "landscape";
    }

    const orientation = height > width ? "portrait" : "landscape";
    logInfo("Resolved video orientation from object metadata", {
      bucketName,
      key,
      width,
      height,
      orientation,
    });

    return orientation;
  } catch (error) {
    logWarn("Failed to read object metadata for orientation; defaulting to landscape", {
      bucketName,
      key,
      ...errorDetails(error),
    });
    return "landscape";
  }
}

async function mediaConvertClient(): Promise<MediaConvertClient> {
  if (mediaConvertDataPlane) {
    logInfo("Using cached MediaConvert data-plane client");
    return mediaConvertDataPlane;
  }

  const described = await mediaConvertControl.send(new DescribeEndpointsCommand({ MaxResults: 1 }));
  const endpointUrl = described.Endpoints?.[0]?.Url;
  if (!endpointUrl) {
    throw new Error("MediaConvert endpoint could not be resolved");
  }

  logInfo("Resolved MediaConvert endpoint", { endpointUrl });

  mediaConvertDataPlane = new MediaConvertClient({ endpoint: endpointUrl });
  return mediaConvertDataPlane;
}

async function getAsset(tableName: string, assetId: string): Promise<AssetRecord | null> {
  const result = await db.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        pk: `ASSET#${assetId}`,
        sk: "META",
      },
    })
  );

  if (!result.Item) {
    return null;
  }

  const upgraded = await upgradeAssetItemSchemaVersion({
    db,
    tableName,
    item: result.Item,
  });
  const validated = AssetRecordSchema.safeParse(upgraded);
  if (!validated.success) {
    return null;
  }

  return validated.data;
}

type ConversionUpdate = {
  status: ConversionState;
  profile: ProcessingProfileId;
  jobId?: string;
  errorMessage?: string;
};

const ConversionUpdateSchema = z.object({
  status: z.enum(["queued", "processing", "ready", "error", "passthrough_ready"]),
  profile: z.enum([
    VIDEO_STANDARD_V1,
    AUDIO_PASSTHROUGH_V1,
    AUDIO_TRANSCODE_HLS_V1,
    IMAGE_PASSTHROUGH_V1,
  ]),
  jobId: z.string().min(1).optional(),
  errorMessage: z.string().min(1).optional(),
});

function buildConversionValue(conversion: ConversionUpdate, now: string): Record<string, unknown> {
  const validated = ConversionUpdateSchema.parse(conversion);

  return {
    status: validated.status,
    profile: validated.profile,
    updatedAt: now,
    ...(validated.jobId ? { jobId: validated.jobId } : {}),
    ...(validated.errorMessage ? { errorMessage: validated.errorMessage } : {}),
    ...(validated.status === "ready" || validated.status === "passthrough_ready"
      ? { completedAt: now }
      : {}),
  };
}

async function updateAssetStatus(
  tableName: string,
  assetId: string,
  bucketName: string,
  key: string,
  size: number,
  status: "processing" | "ready" | "error",
  conversion: ConversionUpdate
): Promise<void> {
  const now = new Date().toISOString();
  await db.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        pk: `ASSET#${assetId}`,
        sk: "META",
      },
      ConditionExpression:
        "attribute_exists(pk) AND attribute_exists(sk) AND #status <> :ready AND #status <> :error",
      UpdateExpression:
        "SET #status = :status, #updatedAt = :updatedAt, #original.#bucket = :bucket, #original.#key = :key, #original.#size = :size, #conversion = :conversion",
      ExpressionAttributeNames: {
        "#status": "status",
        "#updatedAt": "updatedAt",
        "#original": "original",
        "#bucket": "bucket",
        "#key": "key",
        "#size": "size",
        "#conversion": "conversion",
      },
      ExpressionAttributeValues: {
        ":status": status,
        ":updatedAt": now,
        ":bucket": bucketName,
        ":key": key,
        ":size": size,
        ":conversion": buildConversionValue(conversion, now),
        ":ready": "ready",
        ":error": "error",
      },
    })
  );
}

async function submitMediaConvertJob(
  assetId: string,
  bucketName: string,
  key: string,
  contentType: string,
  processingProfile: ProcessingProfileId
): Promise<string> {
  const derivedBucket = requiredEnv("ASSETS_DERIVED_BUCKET_NAME");
  const roleArn = requiredEnv("MEDIACONVERT_ROLE_ARN");
  const client = await mediaConvertClient();

  const isVideoProfile = processingProfile === VIDEO_STANDARD_V1;
  const orientation = isVideoProfile ? await resolveVideoOrientation(bucketName, key) : undefined;
  const settings =
    processingProfile === AUDIO_TRANSCODE_HLS_V1
      ? mediaConvertAudioHlsJobSettings(assetId, bucketName, key, derivedBucket)
      : mediaConvertJobSettings(
          assetId,
          bucketName,
          key,
          derivedBucket,
          contentType,
          orientation ?? "landscape"
        );
  const hlsOutputs = settings.OutputGroups?.[0]?.Outputs ?? [];
  const ladder = hlsOutputs.map((output) => ({
    nameModifier: output.NameModifier,
    width: output.VideoDescription?.Width,
    height: output.VideoDescription?.Height,
  }));

  logInfo("Submitting MediaConvert job", {
    assetId,
    sourceBucket: bucketName,
    sourceKey: key,
    contentType,
    processingProfile,
    orientation,
    outputLadder: ladder,
    destinationBucket: derivedBucket,
  });

  const result = await client.send(
    new CreateJobCommand({
      Role: roleArn,
      Settings: settings,
      UserMetadata: {
        assetId,
        processingProfile,
        ...(orientation ? { orientation } : {}),
        sourceBucket: bucketName,
        sourceKey: key,
      },
      StatusUpdateInterval: "SECONDS_60",
      AccelerationSettings: {
        Mode: "DISABLED",
      },
    })
  );

  const jobId = result.Job?.Id;
  if (!jobId) {
    throw new Error("MediaConvert did not return a job id");
  }

  logInfo("MediaConvert job submitted", {
    assetId,
    jobId,
    processingProfile,
    ...(orientation ? { orientation } : {}),
  });

  return jobId;
}

async function handleObjectCreated(event: EventBridgeS3ObjectCreatedEvent): Promise<void> {
  if (event.source !== "aws.s3" || event["detail-type"] !== "Object Created") {
    logInfo("Skipping non-object-created event", {
      source: event.source,
      detailType: event["detail-type"],
    });
    return;
  }

  const tableName = requiredEnv("ASSETS_TABLE_NAME");
  const originalsBucket = requiredEnv("ASSETS_ORIGINALS_BUCKET_NAME");

  const bucketName = event.detail?.bucket?.name;
  if (bucketName !== originalsBucket) {
    logInfo("Skipping object-created event from non-originals bucket", {
      eventBucket: bucketName,
      originalsBucket,
    });
    return;
  }

  const rawKey = event.detail?.object?.key;
  if (!rawKey) {
    logWarn("Skipping object-created event with missing key", { bucketName });
    return;
  }

  const key = decodeS3Key(rawKey);
  const assetId = extractAssetIdFromKey(key);
  if (!assetId) {
    logWarn("Skipping object-created key that does not map to asset id", {
      bucketName,
      key,
    });
    return;
  }

  const size = typeof event.detail?.object?.size === "number" ? event.detail.object.size : 0;
  logInfo("Processing object-created event", {
    assetId,
    bucketName,
    key,
    size,
  });

  const asset = await getAsset(tableName, assetId);
  if (!asset) {
    logWarn("Asset not found for uploaded object; skipping", {
      assetId,
      bucketName,
      key,
    });
    return;
  }

  const profile = resolveProcessingProfile(asset);

  if (profile.mode === "passthrough") {
    logInfo("Using passthrough processing profile", {
      assetId,
      profileId: profile.profileId,
      assetType: asset.type,
    });
    await updateAssetStatus(tableName, assetId, bucketName, key, size, "ready", {
      status: "passthrough_ready",
      profile: profile.profileId,
    });
    await appendAssetAuditLogEntry({
      db,
      tableName,
      assetId,
      category: auditCategoryForProfile(profile.profileId),
      source: "upload-trigger",
      code: "conversion.passthrough_ready",
      message: `${profile.profileId === AUDIO_PASSTHROUGH_V1 ? "Audio conversion" : "Media conversion"}: passthrough ready`,
      details: { profile: profile.profileId },
    });
    return;
  }

  try {
    await updateAssetStatus(tableName, assetId, bucketName, key, size, "processing", {
      status: "queued",
      profile: profile.profileId,
    });
    logInfo("Asset status updated to processing queued", {
      assetId,
      profileId: profile.profileId,
    });
    await appendAssetAuditLogEntry({
      db,
      tableName,
      assetId,
      category: auditCategoryForProfile(profile.profileId),
      source: "upload-trigger",
      code: "conversion.queued",
      message: `${profile.profileId === AUDIO_TRANSCODE_HLS_V1 ? "Audio conversion" : "Media conversion"}: processing queued`,
      details: { profile: profile.profileId },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
      logInfo("Skipping conversion because asset already terminal", {
        assetId,
        status: asset.status,
      });
      return;
    }

    throw error;
  }

  try {
    const jobId = await submitMediaConvertJob(
      assetId,
      bucketName,
      key,
      asset.original.contentType,
      profile.profileId
    );
    await updateAssetStatus(tableName, assetId, bucketName, key, size, "processing", {
      status: "processing",
      profile: profile.profileId,
      jobId,
    });
    await appendAssetAuditLogEntry({
      db,
      tableName,
      assetId,
      category: auditCategoryForProfile(profile.profileId),
      source: "upload-trigger",
      code: "conversion.job_submitted",
      message: `${profile.profileId === AUDIO_TRANSCODE_HLS_V1 ? "Audio conversion" : "Media conversion"}: MediaConvert job submitted`,
      details: { profile: profile.profileId, jobId },
    });
    logInfo("Asset status updated to processing with MediaConvert job", {
      assetId,
      jobId,
      profileId: profile.profileId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "MediaConvert job submission failed";
    await updateAssetStatus(tableName, assetId, bucketName, key, size, "error", {
      status: "error",
      profile: profile.profileId,
      errorMessage: message,
    });
    await appendAssetAuditLogEntry({
      db,
      tableName,
      assetId,
      category: auditCategoryForProfile(profile.profileId),
      level: "error",
      source: "upload-trigger",
      code: "conversion.submit_failed",
      message: `${profile.profileId === AUDIO_TRANSCODE_HLS_V1 ? "Audio conversion" : "Media conversion"}: submission failed`,
      details: { profile: profile.profileId },
    });
    logWarn("MediaConvert submission failed; asset marked error", {
      assetId,
      profileId: profile.profileId,
      ...errorDetails(error),
    });
    throw error;
  }
}

export async function handler(event: SqsEvent): Promise<{ ok: boolean; processed: number }> {
  let processed = 0;

  logInfo("Upload trigger batch received", {
    recordCount: event.Records?.length ?? 0,
  });

  for (const record of event.Records ?? []) {
    const parsed = parseEventBridgeMessage(record.body);
    if (!parsed) {
      continue;
    }

    await handleObjectCreated(parsed);
    processed += 1;
  }

  logInfo("Upload trigger batch completed", { processed });

  return { ok: true, processed };
}
