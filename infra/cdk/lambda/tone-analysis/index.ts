import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { createWriteStream } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { analyzeAudioFile, analyzeVideoFile, type AssetAnalysis } from "@media-manager/tone-core";
import { z } from "zod";
import { upgradeAssetItemSchemaVersion } from "../shared/asset-record-versioning";
import { appendAssetAuditLogEntry } from "../shared/asset-audit-log";

type SqsEvent = {
  Records?: Array<{
    body?: string;
  }>;
};

type AssetRecord = {
  id: string;
  type: "video" | "audio" | "image" | "folder";
  title?: string;
  original: {
    bucket: string;
    key: string;
    size: number;
    contentType: string;
  };
};

type ToneAnalysisState = "processing" | "ready" | "error" | "skipped";

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
        })
        .optional(),
    })
    .optional(),
});
type EventBridgeS3ObjectCreatedEvent = z.infer<typeof EventBridgeS3ObjectCreatedEventSchema>;

const AssetRecordSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["video", "audio", "image", "folder"]),
  title: z.string().min(1).optional(),
  original: z.object({
    bucket: z.string().min(1),
    key: z.string().min(1),
    size: z.number().nonnegative(),
    contentType: z.string().min(1),
  }),
});

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});
const s3 = new S3Client({});
const ssm = new SSMClient({});
let cachedOpenAiApiKey: string | null = null;

type LogContext = Record<string, unknown>;

function logInfo(message: string, context: LogContext = {}): void {
  console.log(JSON.stringify({ level: "info", message, ...context }));
}

function logWarn(message: string, context: LogContext = {}): void {
  console.warn(JSON.stringify({ level: "warn", message, ...context }));
}

function errorDetails(error: unknown): { errorName?: string; errorMessage: string } {
  if (error instanceof Error) {
    return { errorName: error.name, errorMessage: error.message };
  }
  return { errorMessage: "Unknown error" };
}

function requiredEnv(
  name:
    | "ASSETS_TABLE_NAME"
    | "ASSETS_ORIGINALS_BUCKET_NAME"
    | "ASSETS_DERIVED_BUCKET_NAME"
    | "OPENAI_API_KEY_PARAMETER_NAME"
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
    const validated = EventBridgeS3ObjectCreatedEventSchema.safeParse(JSON.parse(body));
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

async function getAsset(tableName: string, assetId: string): Promise<AssetRecord | null> {
  const result = await db.send(
    new GetCommand({
      TableName: tableName,
      Key: { pk: `ASSET#${assetId}`, sk: "META" },
    })
  );

  if (!result.Item) {
    return null;
  }

  const upgraded = await upgradeAssetItemSchemaVersion({ db, tableName, item: result.Item });
  const parsed = AssetRecordSchema.safeParse(upgraded);
  if (!parsed.success) {
    logWarn("Skipping asset with invalid record shape", { assetId });
    return null;
  }
  return parsed.data;
}

async function updateToneAnalysis(
  tableName: string,
  assetId: string,
  state: ToneAnalysisState,
  values: Record<string, unknown> = {}
): Promise<void> {
  const now = new Date().toISOString();
  await db.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { pk: `ASSET#${assetId}`, sk: "META" },
      UpdateExpression: "SET toneAnalysis = :toneAnalysis, updatedAt = :updatedAt",
      ConditionExpression: "attribute_exists(pk) AND attribute_exists(sk)",
      ExpressionAttributeValues: {
        ":toneAnalysis": {
          status: state,
          profile: "openai-primary-v1",
          updatedAt: now,
          ...(state === "ready" || state === "error" || state === "skipped"
            ? { completedAt: now }
            : {}),
          ...values,
        },
        ":updatedAt": now,
      },
    })
  );
}

async function getOpenAiApiKey(parameterName: string): Promise<string> {
  if (cachedOpenAiApiKey) {
    return cachedOpenAiApiKey;
  }

  const result = await ssm.send(
    new GetParameterCommand({
      Name: parameterName,
      WithDecryption: true,
    })
  );
  const value = result.Parameter?.Value;
  if (!value) {
    throw new Error(`SSM parameter did not contain a value: ${parameterName}`);
  }
  cachedOpenAiApiKey = value;
  return value;
}

async function downloadObject(bucket: string, key: string, outputPath: string): Promise<void> {
  const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!result.Body || typeof result.Body !== "object" || !("pipe" in result.Body)) {
    throw new Error("S3 object response body is not a readable stream");
  }
  await pipeline(result.Body as NodeJS.ReadableStream, createWriteStream(outputPath));
}

async function uploadFile(
  bucket: string,
  key: string,
  filePath: string,
  contentType: string
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: await readFile(filePath),
      ContentType: contentType,
    })
  );
}

async function analyzeAsset(
  asset: AssetRecord,
  sourceBucket: string,
  sourceKey: string
): Promise<Record<string, unknown>> {
  const derivedBucket = requiredEnv("ASSETS_DERIVED_BUCKET_NAME");
  const apiKey = await getOpenAiApiKey(requiredEnv("OPENAI_API_KEY_PARAMETER_NAME"));

  const workDir = join("/tmp", "tone-analysis", asset.id);
  await rm(workDir, { force: true, recursive: true });
  await mkdir(workDir, { recursive: true });

  const extension =
    extname(sourceKey) ||
    extname(basename(asset.original.key)) ||
    (asset.type === "audio" ? ".audio" : ".video");
  const inputPath = join(workDir, `original${extension}`);
  const analysisPath = join(workDir, "asset-analysis.json");

  await downloadObject(sourceBucket, sourceKey, inputPath);
  const analysis = await runToneCoreAnalysis(asset, inputPath, apiKey, workDir);
  await writeFile(analysisPath, `${JSON.stringify(analysis, null, 2)}\n`, "utf-8");

  const analysisKey = `derived/${asset.id}/tone/asset-analysis.json`;
  await uploadFile(derivedBucket, analysisKey, analysisPath, "application/json");

  return {
    analysisSchemaVersion: "asset-analysis/v1",
    toneTaxonomyVersion: analysis.toneTaxonomyVersion,
    analysisBucket: derivedBucket,
    analysisKey,
    modelRuns: modelRunsFromAnalysis(analysis),
    ...displayToneFromAnalysis(analysis),
  };
}

async function runToneCoreAnalysis(
  asset: AssetRecord,
  inputPath: string,
  apiKey: string,
  workDir: string
): Promise<AssetAnalysis> {
  if (asset.type === "audio") {
    return analyzeAudioFile({
      sourcePath: inputPath,
      assetId: asset.id,
      title: asset.title,
      apiKey,
      ffmpegPath: process.env.FFMPEG_PATH || "/opt/bin/ffmpeg",
      workDir: join(workDir, "audio"),
    });
  }

  if (asset.type === "video") {
    return analyzeVideoFile({
      sourcePath: inputPath,
      assetId: asset.id,
      title: asset.title,
      apiKey,
      ffmpegPath: process.env.FFMPEG_PATH || "/opt/bin/ffmpeg",
      workDir: join(workDir, "frames"),
      frameRate: 1,
      maxFrames: 12,
      imageDetail: "low",
    });
  }

  throw new Error(`Unsupported tone analysis asset type: ${asset.type}`);
}

function modelRunsFromAnalysis(analysis: AssetAnalysis): Array<Record<string, string>> | undefined {
  const runs = analysis.modelRuns.flatMap((run) => {
    if (!run.kind || !run.model?.name) {
      return [];
    }
    return [
      {
        kind: run.kind,
        modelName: run.model.name,
        modelVersion: run.model.version,
      },
    ];
  });
  return runs.length > 0 ? runs : undefined;
}

function stringMetadataValue(
  metadata: Record<string, unknown> | undefined,
  key: string
): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function displayToneFromAnalysis(analysis: AssetAnalysis): Record<string, unknown> {
  const words = analysis.tone?.words;
  const scores = analysis.tone?.value;
  const toneRun = analysis.modelRuns.find((run) => run.kind === "tone");
  const metadata = toneRun?.metadata;

  return {
    ...(words?.summary ? { summary: words.summary } : {}),
    ...(words?.primary ? { primaryWords: words.primary } : {}),
    ...(words?.secondary ? { secondaryWords: words.secondary } : {}),
    ...(words?.avoid ? { avoidWords: words.avoid } : {}),
    ...(scores ? { scores } : {}),
    ...(stringMetadataValue(metadata, "semanticSummary")
      ? { semanticSummary: stringMetadataValue(metadata, "semanticSummary") }
      : {}),
    ...(stringMetadataValue(metadata, "caption")
      ? { caption: stringMetadataValue(metadata, "caption") }
      : {}),
    ...(stringMetadataValue(metadata, "mood")
      ? { mood: stringMetadataValue(metadata, "mood") }
      : {}),
  };
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
    logWarn("Skipping object-created key that does not map to asset id", { bucketName, key });
    return;
  }

  const asset = await getAsset(tableName, assetId);
  if (!asset) {
    logWarn("Asset not found for tone analysis; skipping", { assetId, bucketName, key });
    return;
  }

  if (asset.type !== "audio" && asset.type !== "video") {
    await updateToneAnalysis(tableName, asset.id, "skipped", {
      errorMessage: `Tone analysis is not supported for ${asset.type} assets`,
    });
    await appendAssetAuditLogEntry({
      db,
      tableName,
      assetId: asset.id,
      category: "tone_analysis",
      level: "warn",
      source: "tone-analysis",
      code: "tone.skipped_unsupported_type",
      message: "Tonal analysis: unsupported asset type skipped",
      details: { assetType: asset.type },
    });
    logInfo("Tone analysis skipped for unsupported asset type", { assetId, assetType: asset.type });
    return;
  }

  await updateToneAnalysis(tableName, asset.id, "processing");
  await appendAssetAuditLogEntry({
    db,
    tableName,
    assetId: asset.id,
    category: "tone_analysis",
    source: "tone-analysis",
    code: asset.type === "video" ? "tone.video.started" : "tone.audio.started",
    message: `Tonal analysis: ${asset.type} analysis started`,
    details: { profile: "openai-primary-v1" },
  });
  try {
    const artifactInfo = await analyzeAsset(asset, bucketName, key);
    await updateToneAnalysis(tableName, asset.id, "ready", artifactInfo);
    await appendAssetAuditLogEntry({
      db,
      tableName,
      assetId: asset.id,
      category: "tone_analysis",
      source: "tone-analysis",
      code: "tone.ready",
      message: "Tonal analysis: analysis ready",
      details: { profile: "openai-primary-v1" },
    });
    logInfo("Tone analysis completed", { assetId, assetType: asset.type });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tone analysis failed";
    await updateToneAnalysis(tableName, asset.id, "error", { errorMessage: message });
    await appendAssetAuditLogEntry({
      db,
      tableName,
      assetId: asset.id,
      category: "tone_analysis",
      level: "error",
      source: "tone-analysis",
      code: "tone.failed",
      message: "Tonal analysis: failed",
      details: { profile: "openai-primary-v1" },
    });
    logWarn("Tone analysis failed", { assetId, ...errorDetails(error) });
    throw error;
  }
}

export async function handler(event: SqsEvent): Promise<{ ok: boolean; processed: number }> {
  let processed = 0;
  logInfo("Tone analysis batch received", { recordCount: event.Records?.length ?? 0 });

  for (const record of event.Records ?? []) {
    const parsed = parseEventBridgeMessage(record.body);
    if (!parsed) {
      continue;
    }
    await handleObjectCreated(parsed);
    processed += 1;
  }

  logInfo("Tone analysis batch completed", { processed });
  return { ok: true, processed };
}
