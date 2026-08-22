import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  AssetRecordSchema,
  JobRecordSchema,
  ProcessingProfileSchema,
  type AssetRecord,
  type JobRecord,
} from "@media-manager/contracts";
import { z } from "zod";
import { buildJobPreview, expandAssetTree, safeReadAsset } from "../shared/asset-job-tree";
import { enqueueVectorSyncMessage } from "../shared/vector-sync-message";
import { getMusicAssetLinks } from "../shared/music-asset-links";

type SqsEvent = {
  Records?: Array<{
    body: string;
  }>;
};

const JobMessageSchema = z.object({
  jobId: z.string().min(1),
});

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const s3 = new S3Client({});
const sqs = new SQSClient({});

function getRequiredEnv(
  name:
    | "ASSETS_TABLE_NAME"
    | "ASSETS_CONTAINER_INDEX"
    | "ASSETS_ORIGINALS_BUCKET_NAME"
    | "ASSETS_DERIVED_BUCKET_NAME"
    | "TONE_ANALYSIS_QUEUE_URL"
    | "UPLOAD_EVENTS_QUEUE_URL"
): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

async function fetchJob(tableName: string, jobId: string) {
  const result = await db.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        pk: `JOB#${jobId}`,
        sk: "META",
      },
    })
  );
  if (!result.Item) {
    throw new Error(`Job not found: ${jobId}`);
  }
  return JobRecordSchema.parse(result.Item);
}

async function fetchAssetById(tableName: string, id: string): Promise<AssetRecord | null> {
  const result = await db.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        pk: `ASSET#${id}`,
        sk: "META",
      },
    })
  );
  return result.Item ? await safeReadAsset(db, tableName, result.Item) : null;
}

async function updateJob(
  tableName: string,
  jobId: string,
  values: Record<string, unknown>
): Promise<void> {
  const names: Record<string, string> = { "#updatedAt": "updatedAt" };
  const expressionValues: Record<string, unknown> = { ":updatedAt": new Date().toISOString() };
  const sets = ["#updatedAt = :updatedAt"];
  const removes: string[] = [];

  for (const [key, value] of Object.entries(values)) {
    names[`#${key}`] = key;
    if (value === undefined) {
      removes.push(`#${key}`);
    } else {
      expressionValues[`:${key}`] = value;
      sets.push(`#${key} = :${key}`);
    }
  }

  const updateExpression = [`SET ${sets.join(", ")}`];
  if (removes.length > 0) {
    updateExpression.push(`REMOVE ${removes.join(", ")}`);
  }

  await db.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        pk: `JOB#${jobId}`,
        sk: "META",
      },
      UpdateExpression: updateExpression.join(" "),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: expressionValues,
    })
  );
}

async function deleteDerivedPrefix(bucketName: string, prefix: string): Promise<void> {
  let continuationToken: string | undefined;
  do {
    const listed = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    const objects = (listed.Contents ?? []).flatMap((object) =>
      object.Key ? [{ Key: object.Key }] : []
    );
    if (objects.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucketName,
          Delete: {
            Objects: objects,
            Quiet: true,
          },
        })
      );
    }
    continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (continuationToken);
}

async function deleteAssetRecords(tableName: string, assetId: string): Promise<void> {
  let lastEvaluatedKey: Record<string, unknown> | undefined;
  do {
    const page = await db.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: {
          ":pk": `ASSET#${assetId}`,
        },
        ProjectionExpression: "pk, sk",
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    for (const item of page.Items ?? []) {
      const pk = item.pk;
      const sk = item.sk;
      if (typeof pk === "string" && typeof sk === "string") {
        await db.send(
          new DeleteCommand({
            TableName: tableName,
            Key: { pk, sk },
          })
        );
      }
    }

    lastEvaluatedKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey);
}

async function deleteOneAsset(params: {
  tableName: string;
  originalsBucketName: string;
  derivedBucketName: string;
  asset: AssetRecord;
}): Promise<void> {
  const musicLinks = await getMusicAssetLinks({
    db,
    tableName: params.tableName,
    assetId: params.asset.id,
  });
  if (musicLinks.length > 0) {
    throw new Error("Asset is linked to the official music catalog");
  }

  await db.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: params.tableName,
            Key: { pk: `ASSET#${params.asset.id}`, sk: "META" },
            UpdateExpression: "SET officialMusicDeletionLock = :lock",
            ConditionExpression:
              "ownerEmail = :ownerEmail AND updatedAt = :updatedAt " +
              "AND attribute_not_exists(officialMusicDeletionLock) " +
              "AND (attribute_not_exists(officialMusicLinkCount) OR officialMusicLinkCount = :zero)",
            ExpressionAttributeValues: {
              ":ownerEmail": params.asset.ownerEmail,
              ":updatedAt": params.asset.updatedAt,
              ":zero": 0,
              ":lock": true,
            },
          },
        },
      ],
    })
  );

  try {
    if (params.asset.type !== "folder") {
      const originalBucket =
        params.asset.original.bucket === "pending"
          ? params.originalsBucketName
          : params.asset.original.bucket;
      try {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: originalBucket,
            Key: params.asset.original.key,
          })
        );
      } catch (error) {
        console.error("Original object delete failed", { assetId: params.asset.id, error });
      }

      await deleteDerivedPrefix(params.derivedBucketName, `derived/${params.asset.id}/`);
    }

    await deleteAssetRecords(params.tableName, params.asset.id);
    await enqueueVectorSyncMessage(params.asset.id, "jobs-worker:deleted");
  } catch (error) {
    try {
      await db.send(
        new UpdateCommand({
          TableName: params.tableName,
          Key: { pk: `ASSET#${params.asset.id}`, sk: "META" },
          UpdateExpression: "REMOVE officialMusicDeletionLock",
          ConditionExpression: "ownerEmail = :ownerEmail",
          ExpressionAttributeValues: { ":ownerEmail": params.asset.ownerEmail },
        })
      );
    } catch (unlockError) {
      console.error("Failed to clear asset deletion lock", {
        assetId: params.asset.id,
        unlockError,
      });
    }
    throw error;
  }
}

async function runDeleteAssets(jobId: string): Promise<void> {
  const tableName = getRequiredEnv("ASSETS_TABLE_NAME");
  const containerIndex = getRequiredEnv("ASSETS_CONTAINER_INDEX");
  const originalsBucketName = getRequiredEnv("ASSETS_ORIGINALS_BUCKET_NAME");
  const derivedBucketName = getRequiredEnv("ASSETS_DERIVED_BUCKET_NAME");
  const job = await fetchJob(tableName, jobId);

  if (job.status !== "queued") {
    return;
  }

  await updateJob(tableName, jobId, {
    status: "running",
    startedAt: new Date().toISOString(),
    message: "Preparing asset tree",
  });

  const roots: AssetRecord[] = [];
  for (const id of job.target.assetIds) {
    const asset = await fetchAssetById(tableName, id);
    if (asset && asset.ownerEmail === job.ownerEmail) {
      roots.push(asset);
    }
  }

  const expanded = await expandAssetTree({
    db,
    tableName,
    containerIndex,
    ownerEmail: job.ownerEmail,
    roots,
    includeDescendants: job.target.includeDescendants,
    maxItems: 5000,
  });
  const preview = buildJobPreview({
    type: job.type,
    target: job.target,
    ownerEmail: job.ownerEmail,
    roots: expanded.roots,
    items: expanded.items,
    truncated: expanded.truncated,
  });

  const items = [...preview.items].sort((a, b) => {
    const depthDelta = b.path.split(" / ").length - a.path.split(" / ").length;
    return depthDelta || b.path.localeCompare(a.path);
  });

  await updateJob(tableName, jobId, {
    preview,
    totalItems: items.length,
    completedItems: 0,
    failedItems: 0,
    skippedItems: 0,
    message: `Deleting ${items.length} items`,
  });

  const failures: Array<{ id: string; title?: string; message: string }> = [];
  let completedItems = 0;
  let skippedItems = 0;
  const retainedAncestors = new Set<string>();
  const itemById = new Map(items.map((item) => [item.id, item]));

  for (const item of items) {
    if (retainedAncestors.has(item.id)) {
      skippedItems += 1;
      await updateJob(tableName, jobId, {
        skippedItems,
        message: `Retaining ${item.title} because a descendant could not be deleted`,
      });
      continue;
    }
    await updateJob(tableName, jobId, {
      currentItemId: item.id,
      currentItemTitle: item.title,
      message: `Deleting ${item.title}`,
    });

    try {
      const asset = await fetchAssetById(tableName, item.id);
      if (asset && AssetRecordSchema.parse(asset).ownerEmail === job.ownerEmail) {
        await deleteOneAsset({ tableName, originalsBucketName, derivedBucketName, asset });
      }
      completedItems += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete item";
      failures.push({ id: item.id, title: item.title, message });
      let ancestorId = item.containerId;
      while (ancestorId) {
        retainedAncestors.add(ancestorId);
        ancestorId = itemById.get(ancestorId)?.containerId;
      }
      console.error("Bulk delete item failed", { jobId, itemId: item.id, error });
    }

    await updateJob(tableName, jobId, {
      completedItems,
      failedItems: failures.length,
      skippedItems,
      failures: failures.slice(0, 50),
    });
  }

  await updateJob(tableName, jobId, {
    status: failures.length > 0 ? "completed_with_errors" : "completed",
    skippedItems,
    finishedAt: new Date().toISOString(),
    currentItemId: undefined,
    currentItemTitle: undefined,
    message:
      failures.length > 0
        ? `Deleted ${completedItems} items; ${failures.length} failed`
        : `Deleted ${completedItems} items`,
    failures: failures.slice(0, 50),
  });
}

async function expandedPreviewForJob(tableName: string, job: JobRecord) {
  const containerIndex = getRequiredEnv("ASSETS_CONTAINER_INDEX");
  const roots: AssetRecord[] = [];
  for (const id of job.target.assetIds) {
    const asset = await fetchAssetById(tableName, id);
    if (asset && asset.ownerEmail === job.ownerEmail) {
      roots.push(asset);
    }
  }
  const expanded = await expandAssetTree({
    db,
    tableName,
    containerIndex,
    ownerEmail: job.ownerEmail,
    roots,
    includeDescendants: job.target.includeDescendants,
    maxItems: 5000,
  });
  return buildJobPreview({
    type: job.type,
    target: job.target,
    options: job.options,
    ownerEmail: job.ownerEmail,
    roots: expanded.roots,
    items: expanded.items,
    truncated: expanded.truncated,
  });
}

function objectCreatedMessage(asset: AssetRecord, originalsBucketName: string) {
  const bucketName = asset.original.bucket === "pending" ? originalsBucketName : asset.original.bucket;
  return {
    source: "aws.s3",
    "detail-type": "Object Created",
    detail: {
      bucket: { name: bucketName },
      object: { key: asset.original.key, size: asset.original.size },
    },
  };
}

async function runReprocessTone(jobId: string): Promise<void> {
  const tableName = getRequiredEnv("ASSETS_TABLE_NAME");
  const queueUrl = getRequiredEnv("TONE_ANALYSIS_QUEUE_URL");
  const originalsBucketName = getRequiredEnv("ASSETS_ORIGINALS_BUCKET_NAME");
  const job = await fetchJob(tableName, jobId);
  if (job.status !== "queued") return;

  await updateJob(tableName, jobId, {
    status: "running",
    startedAt: new Date().toISOString(),
    message: "Preparing tone reprocessing",
  });
  const preview = await expandedPreviewForJob(tableName, job);
  const processable = preview.items.filter((item) => item.actionStatus === "processable");
  const failures: Array<{ id: string; title?: string; message: string }> = [];
  let completedItems = 0;

  await updateJob(tableName, jobId, {
    preview,
    totalItems: processable.length,
    skippedItems: preview.summary.skippedItems ?? 0,
    message: `Queueing tone reprocessing for ${processable.length} assets`,
  });

  for (const item of processable) {
    await updateJob(tableName, jobId, { currentItemId: item.id, currentItemTitle: item.title, message: `Queueing tone for ${item.title}` });
    try {
      const asset = await fetchAssetById(tableName, item.id);
      if (!asset || asset.ownerEmail !== job.ownerEmail) throw new Error("Asset not found");
      await updateToneQueued(tableName, asset.id);
      await sqs.send(new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: JSON.stringify(objectCreatedMessage(asset, originalsBucketName)) }));
      completedItems += 1;
    } catch (error) {
      failures.push({ id: item.id, title: item.title, message: error instanceof Error ? error.message : "Failed to queue tone" });
    }
    await updateJob(tableName, jobId, { completedItems, failedItems: failures.length, failures: failures.slice(0, 50) });
  }

  await finishQueuedJob(tableName, jobId, failures, completedItems, "Queued tone reprocessing");
}

async function updateToneQueued(tableName: string, assetId: string): Promise<void> {
  const now = new Date().toISOString();
  await db.send(new UpdateCommand({
    TableName: tableName,
    Key: { pk: `ASSET#${assetId}`, sk: "META" },
    UpdateExpression: "SET toneAnalysis = :toneAnalysis, updatedAt = :updatedAt",
    ExpressionAttributeValues: {
      ":toneAnalysis": { status: "queued", profile: "openai-primary-v1", updatedAt: now },
      ":updatedAt": now,
    },
  }));
  await enqueueVectorSyncMessage(assetId, "jobs-worker:tone-queued");
}

async function runReprocessConversion(jobId: string): Promise<void> {
  const tableName = getRequiredEnv("ASSETS_TABLE_NAME");
  const queueUrl = getRequiredEnv("UPLOAD_EVENTS_QUEUE_URL");
  const job = await fetchJob(tableName, jobId);
  if (job.status !== "queued") return;
  const selectedProfile = job.options.processingProfile;
  const parsedProfile = selectedProfile ? ProcessingProfileSchema.parse(selectedProfile) : undefined;

  await updateJob(tableName, jobId, { status: "running", startedAt: new Date().toISOString(), message: "Preparing conversion reprocessing" });
  const preview = await expandedPreviewForJob(tableName, job);
  const processable = preview.items.filter((item) => item.actionStatus === "processable");
  const failures: Array<{ id: string; title?: string; message: string }> = [];
  let completedItems = 0;
  await updateJob(tableName, jobId, { preview, totalItems: processable.length, skippedItems: preview.summary.skippedItems ?? 0, message: `Queueing conversion for ${processable.length} assets` });

  for (const item of processable) {
    await updateJob(tableName, jobId, { currentItemId: item.id, currentItemTitle: item.title, message: `Queueing conversion for ${item.title}` });
    try {
      const asset = await fetchAssetById(tableName, item.id);
      if (!asset || asset.ownerEmail !== job.ownerEmail) throw new Error("Asset not found");
      await sqs.send(new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify({ kind: "reprocess_conversion", assetId: asset.id, processingProfile: parsedProfile }),
      }));
      completedItems += 1;
    } catch (error) {
      failures.push({ id: item.id, title: item.title, message: error instanceof Error ? error.message : "Failed to queue conversion" });
    }
    await updateJob(tableName, jobId, { completedItems, failedItems: failures.length, failures: failures.slice(0, 50) });
  }

  await finishQueuedJob(tableName, jobId, failures, completedItems, "Queued conversion reprocessing");
}

async function finishQueuedJob(tableName: string, jobId: string, failures: Array<{ id: string; title?: string; message: string }>, completedItems: number, label: string): Promise<void> {
  await updateJob(tableName, jobId, {
    status: failures.length > 0 ? "completed_with_errors" : "completed",
    finishedAt: new Date().toISOString(),
    currentItemId: undefined,
    currentItemTitle: undefined,
    message: failures.length > 0 ? `${label} for ${completedItems} assets; ${failures.length} failed` : `${label} for ${completedItems} assets`,
    failures: failures.slice(0, 50),
  });
}

async function processJob(jobId: string): Promise<void> {
  const tableName = getRequiredEnv("ASSETS_TABLE_NAME");
  try {
    const job = await fetchJob(tableName, jobId);
    if (job.type === "delete_assets") {
      await runDeleteAssets(jobId);
      return;
    }
    if (job.type === "reprocess_tone") {
      await runReprocessTone(jobId);
      return;
    }
    if (job.type === "reprocess_conversion") {
      await runReprocessConversion(jobId);
      return;
    }
    throw new Error(`Unsupported job type: ${job.type}`);
  } catch (error) {
    console.error("Job failed", { jobId, error });
    await updateJob(tableName, jobId, {
      status: "failed",
      finishedAt: new Date().toISOString(),
      message: error instanceof Error ? error.message : "Job failed",
    });
  }
}

export async function handler(event: SqsEvent): Promise<{ ok: true; processed: number }> {
  let processed = 0;
  for (const record of event.Records ?? []) {
    const parsed = JobMessageSchema.parse(JSON.parse(record.body));
    await processJob(parsed.jobId);
    processed += 1;
  }
  return { ok: true, processed };
}
