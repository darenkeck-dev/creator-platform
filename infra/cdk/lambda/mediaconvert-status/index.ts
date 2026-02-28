import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";

const MediaConvertEventSchema = z.object({
  source: z.string().optional(),
  "detail-type": z.string().optional(),
  detail: z
    .object({
      jobId: z.string().optional(),
      status: z.string().optional(),
      errorMessage: z.string().optional(),
      errorCode: z.number().optional(),
      userMetadata: z.record(z.string()).optional(),
      outputGroupDetails: z
        .array(
          z.object({
            outputDetails: z
              .array(
                z.object({
                  outputFilePaths: z.array(z.string()).optional(),
                  videoDetails: z
                    .object({
                      widthInPx: z.number().optional(),
                      heightInPx: z.number().optional(),
                      averageBitrate: z.number().optional(),
                    })
                    .optional(),
                  audioDetails: z
                    .array(
                      z.object({
                        bitrate: z.number().optional(),
                      })
                    )
                    .optional(),
                })
              )
              .optional(),
          })
        )
        .optional(),
    })
    .optional(),
});
type MediaConvertEvent = z.infer<typeof MediaConvertEventSchema>;

type StreamRendition = {
  type: "hls" | "audio" | "image";
  label: string;
  width?: number;
  height?: number;
  bitrateKbps?: number;
};

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});

function requiredEnv(name: "ASSETS_TABLE_NAME" | "ASSETS_DERIVED_BUCKET_NAME"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function optionalEnv(name: "CLOUDFRONT_DOMAIN"): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function normalizeStatus(
  mediaConvertStatus: string | undefined
): "processing" | "ready" | "error" | null {
  const normalized = (mediaConvertStatus ?? "").trim().toUpperCase();

  if (["SUBMITTED", "PROGRESSING", "STATUS_UPDATE", "INPUT_INFORMATION"].includes(normalized)) {
    return "processing";
  }

  if (normalized === "COMPLETE") {
    return "ready";
  }

  if (["ERROR", "CANCELED"].includes(normalized)) {
    return "error";
  }

  return null;
}

function flattenOutputPaths(event: MediaConvertEvent): string[] {
  const paths: string[] = [];

  for (const group of event.detail?.outputGroupDetails ?? []) {
    for (const output of group.outputDetails ?? []) {
      for (const outputPath of output.outputFilePaths ?? []) {
        if (outputPath) {
          paths.push(outputPath);
        }
      }
    }
  }

  return paths;
}

function extractAssetId(event: MediaConvertEvent, outputPaths: string[]): string | null {
  const metadata = event.detail?.userMetadata ?? {};
  const candidates = [metadata.assetId, metadata.assetID, metadata.AssetId, metadata.asset_id];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  for (const path of outputPaths) {
    const matched = path.match(/derived\/([^/]+)\//);
    if (matched?.[1]) {
      return matched[1];
    }
  }

  return null;
}

function toHttpsUrl(
  s3Uri: string,
  fallbackBucket: string,
  cloudFrontDomain?: string
): string | null {
  if (s3Uri.startsWith("https://")) {
    return s3Uri;
  }

  if (!s3Uri.startsWith("s3://")) {
    return null;
  }

  const withoutScheme = s3Uri.slice("s3://".length);
  const slashIndex = withoutScheme.indexOf("/");
  const bucket = slashIndex >= 0 ? withoutScheme.slice(0, slashIndex) : fallbackBucket;
  const key = slashIndex >= 0 ? withoutScheme.slice(slashIndex + 1) : "";
  const encodedKey = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  if (cloudFrontDomain) {
    return `https://${cloudFrontDomain}/${encodedKey}`;
  }

  return `https://${bucket}.s3.amazonaws.com/${encodedKey}`;
}

function fileLabel(path: string): string {
  const fileName = path.split("/").pop() ?? "output";
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
}

function inferRenditionType(path: string): StreamRendition["type"] | null {
  const lower = path.toLowerCase();
  if (lower.endsWith(".m3u8") || lower.includes("/hls/")) {
    return "hls";
  }

  if (/(\.aac|\.m4a|\.mp3|\.wav)$/.test(lower)) {
    return "audio";
  }

  if (/(\.jpg|\.jpeg|\.png|\.webp)$/.test(lower)) {
    return "image";
  }

  return null;
}

function buildStreamInfo(
  event: MediaConvertEvent,
  fallbackBucket: string,
  cloudFrontDomain?: string
): {
  hlsMasterUrl?: string;
  posterUrl?: string;
  renditions: StreamRendition[];
} {
  const paths = flattenOutputPaths(event);

  let hlsMasterUrl: string | undefined;
  let posterUrl: string | undefined;
  const renditions: StreamRendition[] = [];
  const seen = new Set<string>();

  for (const outputGroup of event.detail?.outputGroupDetails ?? []) {
    for (const detail of outputGroup.outputDetails ?? []) {
      const path = detail.outputFilePaths?.[0];
      if (!path) {
        continue;
      }

      const type = inferRenditionType(path);
      if (!type) {
        continue;
      }

      const label = fileLabel(path);
      const key = `${type}:${label}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      const bitrate = detail.videoDetails?.averageBitrate ?? detail.audioDetails?.[0]?.bitrate;
      renditions.push({
        type,
        label,
        width: detail.videoDetails?.widthInPx,
        height: detail.videoDetails?.heightInPx,
        bitrateKbps:
          typeof bitrate === "number" && bitrate > 0 ? Math.round(bitrate / 1000) : undefined,
      });
    }
  }

  const preferredHls = paths.find((path) => path.toLowerCase().endsWith("/master.m3u8"));
  const anyHls = preferredHls ?? paths.find((path) => path.toLowerCase().endsWith(".m3u8"));
  if (anyHls) {
    hlsMasterUrl = toHttpsUrl(anyHls, fallbackBucket, cloudFrontDomain) ?? undefined;
  }

  const anyPoster = paths.find((path) => /(\/thumbs\/.*\.(jpg|jpeg|png|webp))$/i.test(path));
  if (anyPoster) {
    posterUrl = toHttpsUrl(anyPoster, fallbackBucket, cloudFrontDomain) ?? undefined;
  }

  return { hlsMasterUrl, posterUrl, renditions };
}

type ConversionPayload = {
  status: "processing" | "ready" | "error";
  profile: string;
  jobId?: string;
  updatedAt: string;
  completedAt?: string;
  errorMessage?: string;
};

const ConversionPayloadSchema = z.object({
  status: z.enum(["processing", "ready", "error"]),
  profile: z.string().min(1),
  jobId: z.string().min(1).optional(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  errorMessage: z.string().min(1).optional(),
});

function buildConversionPayload(options: {
  status: ConversionPayload["status"];
  profile: string;
  jobId?: string;
  now: string;
  errorMessage?: string;
}): ConversionPayload {
  return ConversionPayloadSchema.parse({
    status: options.status,
    profile: options.profile,
    updatedAt: options.now,
    ...(options.jobId ? { jobId: options.jobId } : {}),
    ...(options.errorMessage ? { errorMessage: options.errorMessage } : {}),
    ...(options.status === "ready" ? { completedAt: options.now } : {}),
  });
}

export async function handler(event: MediaConvertEvent): Promise<{ ok: boolean; status: string }> {
  const parsedEvent = MediaConvertEventSchema.safeParse(event);
  if (!parsedEvent.success) {
    return { ok: true, status: "ignored" };
  }

  const safeEvent = parsedEvent.data;
  const status = normalizeStatus(safeEvent.detail?.status);
  if (!status) {
    return { ok: true, status: "ignored" };
  }

  const tableName = requiredEnv("ASSETS_TABLE_NAME");
  const derivedBucket = requiredEnv("ASSETS_DERIVED_BUCKET_NAME");
  const cloudFrontDomain = optionalEnv("CLOUDFRONT_DOMAIN");
  const outputPaths = flattenOutputPaths(safeEvent);
  const assetId = extractAssetId(safeEvent, outputPaths);
  if (!assetId) {
    return { ok: true, status: "ignored-no-asset-id" };
  }

  const now = new Date().toISOString();

  if (status === "ready") {
    const stream = buildStreamInfo(safeEvent, derivedBucket, cloudFrontDomain);
    const profile = safeEvent.detail?.userMetadata?.processingProfile ?? "video-standard-v1";
    const errorMessage = safeEvent.detail?.errorMessage;

    await db.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          pk: `ASSET#${assetId}`,
          sk: "META",
        },
        ConditionExpression: "attribute_exists(pk) AND attribute_exists(sk)",
        UpdateExpression:
          "SET #status = :status, #updatedAt = :updatedAt, #stream = :stream, #conversion = :conversion",
        ExpressionAttributeNames: {
          "#status": "status",
          "#updatedAt": "updatedAt",
          "#stream": "stream",
          "#conversion": "conversion",
        },
        ExpressionAttributeValues: {
          ":status": status,
          ":updatedAt": now,
          ":stream": stream,
          ":conversion": buildConversionPayload({
            status: "ready",
            profile,
            jobId: safeEvent.detail?.jobId,
            now,
            errorMessage,
          }),
        },
      })
    );

    return { ok: true, status };
  }

  const profile = safeEvent.detail?.userMetadata?.processingProfile ?? "video-standard-v1";
  const errorMessage =
    status === "error"
      ? (safeEvent.detail?.errorMessage ??
        (typeof safeEvent.detail?.errorCode === "number"
          ? `MediaConvert error code ${safeEvent.detail.errorCode}`
          : "MediaConvert job failed"))
      : undefined;

  await db.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        pk: `ASSET#${assetId}`,
        sk: "META",
      },
      ConditionExpression: "attribute_exists(pk) AND attribute_exists(sk)",
      UpdateExpression: "SET #status = :status, #updatedAt = :updatedAt, #conversion = :conversion",
      ExpressionAttributeNames: {
        "#status": "status",
        "#updatedAt": "updatedAt",
        "#conversion": "conversion",
      },
      ExpressionAttributeValues: {
        ":status": status,
        ":updatedAt": now,
        ":conversion": buildConversionPayload({
          status,
          profile,
          jobId: safeEvent.detail?.jobId,
          now,
          errorMessage,
        }),
      },
    })
  );

  return { ok: true, status };
}
