import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
  QueryCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  HeadObjectCommand,
  type HeadObjectCommandOutput,
  type CompletedPart,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  AssetDeleteResponseSchema,
  AssetChildrenResponseSchema,
  AssetDetailResponseSchema,
  AssetLineageResponseSchema,
  MoveAssetInputSchema,
  MoveAssetResponseSchema,
  AssetPlaybackUrlResponseSchema,
  AssetRecordSchema,
  AssetUploadUrlInputSchema,
  AssetUploadUrlResponseSchema,
  MultipartAbortInputSchema,
  MultipartAbortResponseSchema,
  MultipartCompleteInputSchema,
  MultipartInitInputSchema,
  MultipartInitResponseSchema,
  MultipartSignInputSchema,
  MultipartSignResponseSchema,
  UpdateAssetInputSchema,
} from "@media-manager/contracts";
import { z } from "zod";
import {
  readAssetRecordWithUpgrade,
  safeReadAssetRecordWithUpgrade,
} from "../shared/asset-record-versioning";
import { appendAssetAuditLogEntry } from "../shared/asset-audit-log";
import { enqueueVectorSyncMessage } from "../shared/vector-sync-message";

type HttpEvent = {
  requestContext?: {
    http?: {
      method?: string;
    };
    routeKey?: string;
    authorizer?: {
      jwt?: {
        claims?: Record<string, string>;
      };
    };
  };
  pathParameters?: {
    id?: string;
  };
  body?: string | null;
  queryStringParameters?: Record<string, string | undefined>;
};

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const UPLOAD_URL_EXPIRES_IN_SECONDS = 900;
const MULTIPART_PART_SIZE_BYTES = 32 * 1024 * 1024;

function buildSearchText(input: {
  title: string;
  description: string;
  tags: Array<{ facet?: string; value: string }>;
  type: string;
  origin?: string;
  generationProvider?: string;
  generationModel?: string;
  generationWorkflowId?: string;
  processingProfile?: string;
  originalContentType?: string;
}): string {
  const tagTerms = input.tags.flatMap((tag) => [tag.facet, tag.value]);
  return [
    input.title,
    input.description,
    ...tagTerms,
    input.type,
    input.origin,
    input.generationProvider,
    input.generationModel,
    input.generationWorkflowId,
    input.processingProfile,
    input.originalContentType,
  ]
    .filter((term): term is string => typeof term === "string" && term.trim().length > 0)
    .map((term) => term.trim().toLowerCase())
    .join(" ");
}

function response(statusCode: number, body: unknown): { statusCode: number; body: string } {
  return {
    statusCode,
    body: JSON.stringify(body),
  };
}

function buildUploadObjectMetadata(videoMetadata?: {
  width: number;
  height: number;
}): Record<string, string> | undefined {
  if (!videoMetadata) {
    return undefined;
  }

  return {
    "video-width": String(videoMetadata.width),
    "video-height": String(videoMetadata.height),
  };
}

function getTableName(): string {
  const tableName = process.env.ASSETS_TABLE_NAME;
  if (!tableName) {
    throw new Error("Missing environment variable: ASSETS_TABLE_NAME");
  }

  return tableName;
}

function getOriginalsBucketName(): string {
  const bucketName = process.env.ASSETS_ORIGINALS_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("Missing environment variable: ASSETS_ORIGINALS_BUCKET_NAME");
  }

  return bucketName;
}

function getDerivedBucketName(): string {
  const bucketName = process.env.ASSETS_DERIVED_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("Missing environment variable: ASSETS_DERIVED_BUCKET_NAME");
  }

  return bucketName;
}

function getContainerIndex(): string {
  const indexName = process.env.ASSETS_CONTAINER_INDEX;
  if (!indexName) {
    throw new Error("Missing environment variable: ASSETS_CONTAINER_INDEX");
  }

  return indexName;
}

function toContainerIndexPk(containerId?: string): string {
  return `CONTAINER#${containerId ?? "ROOT"}`;
}

function getOwnerEmail(event: HttpEvent): string {
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  const parsed = z.string().email().safeParse(claims?.email);
  if (!parsed.success) {
    throw new Error("Unauthorized: missing email claim");
  }

  return parsed.data;
}

function parseAssetId(event: HttpEvent): string {
  const parsed = z.string().min(1).safeParse(event.pathParameters?.id);
  if (!parsed.success) {
    throw new Error("Invalid asset id");
  }

  return parsed.data;
}

function parseBody(body: string | null | undefined): unknown {
  if (!body) {
    return {};
  }

  return JSON.parse(body);
}

async function readAssetOrThrow(
  tableName: string,
  item: unknown
): Promise<z.infer<typeof AssetRecordSchema>> {
  return await readAssetRecordWithUpgrade({
    db,
    tableName,
    item,
  });
}

async function safeReadAsset(
  tableName: string,
  item: unknown
): Promise<z.infer<typeof AssetRecordSchema> | null> {
  return await safeReadAssetRecordWithUpgrade({
    db,
    tableName,
    item,
  });
}

function folderOperationNotAllowedResponse(): { statusCode: number; body: string } {
  return response(400, { message: "Folders do not support upload or playback operations" });
}

async function fetchAssetById(
  tableName: string,
  id: string
): Promise<z.infer<typeof AssetRecordSchema> | null> {
  const result = await db.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        pk: `ASSET#${id}`,
        sk: "META",
      },
    })
  );

  if (!result.Item) {
    return null;
  }

  return await readAssetOrThrow(tableName, result.Item);
}

async function resolveDepthAndRoot(
  tableName: string,
  assetId: string,
  nextContainerId: string | null,
  ownerEmail: string
): Promise<
  | { ok: true; containerId?: string; parentId?: string; rootId: string; depth: number }
  | { ok: false; statusCode: number; body: string }
> {
  if (!nextContainerId) {
    return {
      ok: true,
      rootId: assetId,
      depth: 0,
    };
  }

  if (nextContainerId === assetId) {
    return {
      ok: false,
      statusCode: 400,
      body: JSON.stringify({ message: "Invalid move: asset cannot be its own container" }),
    };
  }

  const container = await fetchAssetById(tableName, nextContainerId);
  if (!container) {
    return {
      ok: false,
      statusCode: 400,
      body: JSON.stringify({ message: "Invalid containerId: referenced asset not found" }),
    };
  }

  if (container.ownerEmail !== ownerEmail) {
    return {
      ok: false,
      statusCode: 403,
      body: JSON.stringify({ message: "Forbidden: container belongs to another owner" }),
    };
  }

  let cursor: z.infer<typeof AssetRecordSchema> | null = container;
  while (cursor?.containerId) {
    if (cursor.containerId === assetId) {
      return {
        ok: false,
        statusCode: 400,
        body: JSON.stringify({ message: "Invalid move: cycle detected" }),
      };
    }

    cursor = await fetchAssetById(tableName, cursor.containerId);
  }

  return {
    ok: true,
    containerId: container.id,
    parentId: container.id,
    rootId: container.rootId ?? container.id,
    depth: (container.depth ?? 0) + 1,
  };
}

async function getAsset(id: string): Promise<{ statusCode: number; body: string }> {
  const tableName = getTableName();

  const result = await db.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        pk: `ASSET#${id}`,
        sk: "META",
      },
    })
  );

  if (!result.Item) {
    return response(404, { message: "Asset not found" });
  }

  const asset = await readAssetOrThrow(tableName, result.Item);
  const payload = AssetDetailResponseSchema.parse({ asset });

  return response(200, payload);
}

async function getAssetChildren(
  event: HttpEvent,
  id: string
): Promise<{ statusCode: number; body: string }> {
  const tableName = getTableName();
  const containerIndex = getContainerIndex();
  const ownerEmail = getOwnerEmail(event);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(event.queryStringParameters?.limit ?? "50", 10) || 50)
  );

  const parent = await fetchAssetById(tableName, id);
  if (!parent) {
    return response(404, { message: "Asset not found" });
  }

  if (parent.ownerEmail !== ownerEmail) {
    return response(403, { message: "Forbidden" });
  }

  const result = await db.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: containerIndex,
      KeyConditionExpression: "gsi2pk = :containerPk",
      FilterExpression: "ownerEmail = :ownerEmail",
      ExpressionAttributeValues: {
        ":containerPk": toContainerIndexPk(id),
        ":ownerEmail": ownerEmail,
      },
      ScanIndexForward: false,
      Limit: limit,
    })
  );

  const children = (
    await Promise.all(
      (result.Items ?? []).map(async (item) => await safeReadAsset(tableName, item))
    )
  )
    .filter((asset): asset is z.infer<typeof AssetRecordSchema> => asset !== null)
    .filter((asset) => asset.containerId === id);
  const payload = AssetChildrenResponseSchema.parse({
    parentId: id,
    assets: children,
  });

  return response(200, payload);
}

async function getAssetLineage(
  event: HttpEvent,
  id: string
): Promise<{ statusCode: number; body: string }> {
  const tableName = getTableName();
  const ownerEmail = getOwnerEmail(event);
  const asset = await fetchAssetById(tableName, id);

  if (!asset) {
    return response(404, { message: "Asset not found" });
  }

  if (asset.ownerEmail !== ownerEmail) {
    return response(403, { message: "Forbidden" });
  }

  const sources: Array<z.infer<typeof AssetRecordSchema>> = [];
  for (const sourceId of asset.sourceAssetIds ?? []) {
    const source = await fetchAssetById(tableName, sourceId);
    if (source && source.ownerEmail === ownerEmail) {
      sources.push(source);
    }
  }

  const payload = AssetLineageResponseSchema.parse({
    asset,
    sources,
  });
  return response(200, payload);
}

async function moveAsset(
  event: HttpEvent,
  id: string
): Promise<{ statusCode: number; body: string }> {
  const tableName = getTableName();
  const ownerEmail = getOwnerEmail(event);
  const parsedBody = MoveAssetInputSchema.safeParse(parseBody(event.body));
  if (!parsedBody.success) {
    return response(400, { message: "Invalid request body", issues: parsedBody.error.issues });
  }

  const currentAsset = await fetchAssetById(tableName, id);
  if (!currentAsset) {
    return response(404, { message: "Asset not found" });
  }

  if (currentAsset.ownerEmail !== ownerEmail) {
    return response(403, { message: "Forbidden" });
  }

  const requestedContainerId = parsedBody.data.containerId ?? parsedBody.data.parentId ?? null;
  const resolved = await resolveDepthAndRoot(tableName, id, requestedContainerId, ownerEmail);
  if (!resolved.ok) {
    return {
      statusCode: resolved.statusCode,
      body: resolved.body,
    };
  }

  const now = new Date().toISOString();
  const removeExpressions: string[] = [];
  const names: Record<string, string> = {
    "#updatedAt": "updatedAt",
    "#containerId": "containerId",
    "#parentId": "parentId",
    "#rootId": "rootId",
    "#depth": "depth",
    "#gsi2pk": "gsi2pk",
    "#gsi2sk": "gsi2sk",
  };
  const values: Record<string, unknown> = {
    ":updatedAt": now,
    ":rootId": resolved.rootId,
    ":depth": resolved.depth,
    ":gsi2pk": toContainerIndexPk(resolved.containerId),
    ":gsi2sk": `${currentAsset.createdAt}#${id}`,
  };

  const setExpressions: string[] = [
    "#updatedAt = :updatedAt",
    "#rootId = :rootId",
    "#depth = :depth",
    "#gsi2pk = :gsi2pk",
    "#gsi2sk = :gsi2sk",
  ];
  if (resolved.containerId) {
    values[":containerId"] = resolved.containerId;
    setExpressions.push("#containerId = :containerId");
  } else {
    removeExpressions.push("#containerId");
  }

  if (resolved.parentId) {
    values[":parentId"] = resolved.parentId;
    setExpressions.push("#parentId = :parentId");
  } else {
    removeExpressions.push("#parentId");
  }

  const updateExpression =
    removeExpressions.length > 0
      ? `SET ${setExpressions.join(", ")} REMOVE ${removeExpressions.join(", ")}`
      : `SET ${setExpressions.join(", ")}`;

  const updateResult = await db.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        pk: `ASSET#${id}`,
        sk: "META",
      },
      ConditionExpression: "attribute_exists(pk) AND attribute_exists(sk)",
      UpdateExpression: updateExpression,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: "ALL_NEW",
    })
  );

  if (!updateResult.Attributes) {
    return response(404, { message: "Asset not found" });
  }

  const asset = await readAssetOrThrow(tableName, updateResult.Attributes);
  const payload = MoveAssetResponseSchema.parse({ asset });
  return response(200, payload);
}

async function patchAsset(
  event: HttpEvent,
  id: string
): Promise<{ statusCode: number; body: string }> {
  const tableName = getTableName();
  const parsedBody = UpdateAssetInputSchema.safeParse(parseBody(event.body));

  if (!parsedBody.success) {
    return response(400, { message: "Invalid request body", issues: parsedBody.error.issues });
  }

  const updates = parsedBody.data;
  const ownerEmail = getOwnerEmail(event);
  const now = new Date().toISOString();

  const current = await db.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        pk: `ASSET#${id}`,
        sk: "META",
      },
    })
  );

  if (!current.Item) {
    return response(404, { message: "Asset not found" });
  }

  const currentAsset = await readAssetOrThrow(tableName, current.Item);
  if (currentAsset.ownerEmail !== ownerEmail) {
    return response(403, { message: "Forbidden" });
  }

  const names: Record<string, string> = {
    "#updatedAt": "updatedAt",
  };
  const values: Record<string, unknown> = {
    ":updatedAt": now,
    ":ownerEmail": ownerEmail,
  };
  const setExpressions: string[] = ["#updatedAt = :updatedAt"];

  if (updates.title !== undefined) {
    names["#title"] = "title";
    values[":title"] = updates.title;
    setExpressions.push("#title = :title");
  }

  if (updates.description !== undefined) {
    names["#description"] = "description";
    values[":description"] = updates.description;
    setExpressions.push("#description = :description");
  }

  if (updates.visibility !== undefined) {
    names["#visibility"] = "visibility";
    values[":visibility"] = updates.visibility;
    setExpressions.push("#visibility = :visibility");
  }

  if (
    updates.title !== undefined ||
    updates.description !== undefined ||
    updates.tags !== undefined
  ) {
    const nextTitle = updates.title ?? currentAsset.title;
    const nextDescription = updates.description ?? currentAsset.description;
    const nextTags = updates.tags ?? currentAsset.tags;
    names["#searchText"] = "searchText";
    values[":searchText"] = buildSearchText({
      title: nextTitle,
      description: nextDescription,
      tags: nextTags,
      type: currentAsset.type,
      origin: currentAsset.origin,
      generationProvider: currentAsset.generation?.provider,
      generationModel: currentAsset.generation?.model,
      generationWorkflowId: currentAsset.generation?.workflowId,
      processingProfile: currentAsset.processingProfile,
      originalContentType: currentAsset.original.contentType,
    });
    setExpressions.push("#searchText = :searchText");
  }

  if (updates.tags !== undefined) {
    names["#tags"] = "tags";
    values[":tags"] = updates.tags.map((tag) => ({ ...tag, source: "user" as const }));
    setExpressions.push("#tags = :tags");
  }

  const result = await db.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        pk: `ASSET#${id}`,
        sk: "META",
      },
      ConditionExpression:
        "attribute_exists(pk) AND attribute_exists(sk) AND ownerEmail = :ownerEmail",
      UpdateExpression: `SET ${setExpressions.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: "ALL_NEW",
    })
  );

  if (!result.Attributes) {
    return response(404, { message: "Asset not found" });
  }

  const asset = await readAssetOrThrow(tableName, result.Attributes);
  if (updates.visibility !== undefined && updates.visibility !== currentAsset.visibility) {
    await enqueueVectorSyncMessage(id, "api-asset-by-id:visibility");
  }
  const payload = AssetDetailResponseSchema.parse({ asset });
  return response(200, payload);
}

async function createUploadUrl(
  event: HttpEvent,
  id: string
): Promise<{ statusCode: number; body: string }> {
  const tableName = getTableName();
  const originalsBucketName = getOriginalsBucketName();
  const ownerEmail = getOwnerEmail(event);
  const parsedBody = AssetUploadUrlInputSchema.safeParse(parseBody(event.body));

  if (!parsedBody.success) {
    return response(400, { message: "Invalid request body", issues: parsedBody.error.issues });
  }

  const current = await db.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        pk: `ASSET#${id}`,
        sk: "META",
      },
    })
  );

  if (!current.Item) {
    return response(404, { message: "Asset not found" });
  }

  const currentAsset = await readAssetOrThrow(tableName, current.Item);
  if (currentAsset.type === "folder") {
    return folderOperationNotAllowedResponse();
  }
  if (currentAsset.ownerEmail !== ownerEmail) {
    return response(403, { message: "Forbidden" });
  }

  const contentType = parsedBody.data.contentType ?? currentAsset.original.contentType;
  const objectMetadata = buildUploadObjectMetadata(parsedBody.data.videoMetadata);
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: originalsBucketName,
      Key: currentAsset.original.key,
      ContentType: contentType,
      Metadata: objectMetadata,
    }),
    { expiresIn: UPLOAD_URL_EXPIRES_IN_SECONDS }
  );

  const now = new Date().toISOString();
  const updated = await db.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        pk: `ASSET#${id}`,
        sk: "META",
      },
      ConditionExpression: "attribute_exists(pk) AND attribute_exists(sk)",
      UpdateExpression:
        "SET #status = :status, #updatedAt = :updatedAt, #original.#contentType = :contentType, #original.#bucket = :bucket",
      ExpressionAttributeNames: {
        "#status": "status",
        "#updatedAt": "updatedAt",
        "#original": "original",
        "#contentType": "contentType",
        "#bucket": "bucket",
      },
      ExpressionAttributeValues: {
        ":status": "draft",
        ":updatedAt": now,
        ":contentType": contentType,
        ":bucket": originalsBucketName,
      },
      ReturnValues: "ALL_NEW",
    })
  );

  if (!updated.Attributes) {
    return response(404, { message: "Asset not found" });
  }

  if (currentAsset.status !== "draft") {
    await enqueueVectorSyncMessage(id, "api-asset-by-id:upload-draft");
  }

  await appendAssetAuditLogEntry({
    db,
    tableName,
    assetId: id,
    category: "upload",
    source: "api-asset-by-id",
    code: "upload.url_created",
    message: "Upload: upload URL created",
    details: { contentType },
  });

  const asset = await readAssetOrThrow(tableName, updated.Attributes);
  const payload = AssetUploadUrlResponseSchema.parse({
    uploadUrl,
    key: asset.original.key,
    expiresIn: UPLOAD_URL_EXPIRES_IN_SECONDS,
    asset,
  });

  return response(200, payload);
}

async function getPlaybackUrl(
  event: HttpEvent,
  id: string
): Promise<{ statusCode: number; body: string }> {
  const tableName = getTableName();
  const ownerEmail = getOwnerEmail(event);
  const originalsBucketName = getOriginalsBucketName();

  const current = await db.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        pk: `ASSET#${id}`,
        sk: "META",
      },
    })
  );

  if (!current.Item) {
    return response(404, { message: "Asset not found" });
  }

  const asset = await readAssetOrThrow(tableName, current.Item);
  if (asset.type === "folder") {
    return folderOperationNotAllowedResponse();
  }
  if (asset.ownerEmail !== ownerEmail) {
    return response(403, { message: "Forbidden" });
  }

  const bucketName =
    asset.original.bucket === "pending" ? originalsBucketName : asset.original.bucket;
  const playbackUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucketName,
      Key: asset.original.key,
      ResponseContentType: asset.original.contentType,
    }),
    { expiresIn: UPLOAD_URL_EXPIRES_IN_SECONDS }
  );

  const payload = AssetPlaybackUrlResponseSchema.parse({
    playbackUrl,
    contentType: asset.original.contentType,
    expiresIn: UPLOAD_URL_EXPIRES_IN_SECONDS,
    id: asset.id,
  });
  return response(200, payload);
}

async function initMultipartUpload(
  event: HttpEvent,
  id: string
): Promise<{ statusCode: number; body: string }> {
  const tableName = getTableName();
  const originalsBucketName = getOriginalsBucketName();
  const ownerEmail = getOwnerEmail(event);
  const parsedBody = MultipartInitInputSchema.safeParse(parseBody(event.body));

  if (!parsedBody.success) {
    return response(400, { message: "Invalid request body", issues: parsedBody.error.issues });
  }

  const current = await db.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        pk: `ASSET#${id}`,
        sk: "META",
      },
    })
  );

  if (!current.Item) {
    return response(404, { message: "Asset not found" });
  }

  const currentAsset = await readAssetOrThrow(tableName, current.Item);
  if (currentAsset.type === "folder") {
    return folderOperationNotAllowedResponse();
  }
  if (currentAsset.ownerEmail !== ownerEmail) {
    return response(403, { message: "Forbidden" });
  }

  const contentType = parsedBody.data.contentType ?? currentAsset.original.contentType;
  const objectMetadata = buildUploadObjectMetadata(parsedBody.data.videoMetadata);
  const created = await s3.send(
    new CreateMultipartUploadCommand({
      Bucket: originalsBucketName,
      Key: currentAsset.original.key,
      ContentType: contentType,
      Metadata: objectMetadata,
    })
  );

  if (!created.UploadId) {
    throw new Error("Failed to create multipart upload");
  }

  const now = new Date().toISOString();
  const updated = await db.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        pk: `ASSET#${id}`,
        sk: "META",
      },
      ConditionExpression: "attribute_exists(pk) AND attribute_exists(sk)",
      UpdateExpression:
        "SET #status = :status, #updatedAt = :updatedAt, #original.#contentType = :contentType, #original.#bucket = :bucket",
      ExpressionAttributeNames: {
        "#status": "status",
        "#updatedAt": "updatedAt",
        "#original": "original",
        "#contentType": "contentType",
        "#bucket": "bucket",
      },
      ExpressionAttributeValues: {
        ":status": "draft",
        ":updatedAt": now,
        ":contentType": contentType,
        ":bucket": originalsBucketName,
      },
      ReturnValues: "ALL_NEW",
    })
  );

  if (!updated.Attributes) {
    return response(404, { message: "Asset not found" });
  }

  if (currentAsset.status !== "draft") {
    await enqueueVectorSyncMessage(id, "api-asset-by-id:multipart-draft");
  }

  await appendAssetAuditLogEntry({
    db,
    tableName,
    assetId: id,
    category: "upload",
    source: "api-asset-by-id",
    code: "upload.multipart_initialized",
    message: "Upload: multipart upload initialized",
    details: { contentType },
  });

  const asset = await readAssetOrThrow(tableName, updated.Attributes);
  const payload = MultipartInitResponseSchema.parse({
    uploadId: created.UploadId,
    key: asset.original.key,
    partSize: MULTIPART_PART_SIZE_BYTES,
    expiresIn: UPLOAD_URL_EXPIRES_IN_SECONDS,
    asset,
  });

  return response(200, payload);
}

async function signMultipartPart(
  event: HttpEvent,
  id: string
): Promise<{ statusCode: number; body: string }> {
  const tableName = getTableName();
  const originalsBucketName = getOriginalsBucketName();
  const ownerEmail = getOwnerEmail(event);
  const parsedBody = MultipartSignInputSchema.safeParse(parseBody(event.body));

  if (!parsedBody.success) {
    return response(400, { message: "Invalid request body", issues: parsedBody.error.issues });
  }

  const current = await db.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        pk: `ASSET#${id}`,
        sk: "META",
      },
    })
  );

  if (!current.Item) {
    return response(404, { message: "Asset not found" });
  }

  const asset = await readAssetOrThrow(tableName, current.Item);
  if (asset.type === "folder") {
    return folderOperationNotAllowedResponse();
  }
  if (asset.ownerEmail !== ownerEmail) {
    return response(403, { message: "Forbidden" });
  }

  const uploadUrl = await getSignedUrl(
    s3,
    new UploadPartCommand({
      Bucket: originalsBucketName,
      Key: asset.original.key,
      UploadId: parsedBody.data.uploadId,
      PartNumber: parsedBody.data.partNumber,
    }),
    { expiresIn: UPLOAD_URL_EXPIRES_IN_SECONDS }
  );

  const payload = MultipartSignResponseSchema.parse({
    uploadId: parsedBody.data.uploadId,
    partNumber: parsedBody.data.partNumber,
    uploadUrl,
    expiresIn: UPLOAD_URL_EXPIRES_IN_SECONDS,
  });
  return response(200, payload);
}

async function completeMultipartUpload(
  event: HttpEvent,
  id: string
): Promise<{ statusCode: number; body: string }> {
  const tableName = getTableName();
  const originalsBucketName = getOriginalsBucketName();
  const ownerEmail = getOwnerEmail(event);
  const parsedBody = MultipartCompleteInputSchema.safeParse(parseBody(event.body));

  if (!parsedBody.success) {
    return response(400, { message: "Invalid request body", issues: parsedBody.error.issues });
  }

  const current = await db.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        pk: `ASSET#${id}`,
        sk: "META",
      },
    })
  );

  if (!current.Item) {
    return response(404, { message: "Asset not found" });
  }

  const asset = await readAssetOrThrow(tableName, current.Item);
  if (asset.type === "folder") {
    return folderOperationNotAllowedResponse();
  }
  if (asset.ownerEmail !== ownerEmail) {
    return response(403, { message: "Forbidden" });
  }

  const completedParts: CompletedPart[] = [...parsedBody.data.parts]
    .sort((a, b) => a.partNumber - b.partNumber)
    .map((part) => ({ PartNumber: part.partNumber, ETag: part.etag }));

  await s3.send(
    new CompleteMultipartUploadCommand({
      Bucket: originalsBucketName,
      Key: asset.original.key,
      UploadId: parsedBody.data.uploadId,
      MultipartUpload: {
        Parts: completedParts,
      },
    })
  );

  return await confirmUpload(event, id);
}

async function abortMultipartUpload(
  event: HttpEvent,
  id: string
): Promise<{ statusCode: number; body: string }> {
  const tableName = getTableName();
  const originalsBucketName = getOriginalsBucketName();
  const ownerEmail = getOwnerEmail(event);
  const parsedBody = MultipartAbortInputSchema.safeParse(parseBody(event.body));

  if (!parsedBody.success) {
    return response(400, { message: "Invalid request body", issues: parsedBody.error.issues });
  }

  const current = await db.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        pk: `ASSET#${id}`,
        sk: "META",
      },
    })
  );

  if (!current.Item) {
    return response(404, { message: "Asset not found" });
  }

  const asset = await readAssetOrThrow(tableName, current.Item);
  if (asset.type === "folder") {
    return folderOperationNotAllowedResponse();
  }
  if (asset.ownerEmail !== ownerEmail) {
    return response(403, { message: "Forbidden" });
  }

  await s3.send(
    new AbortMultipartUploadCommand({
      Bucket: originalsBucketName,
      Key: asset.original.key,
      UploadId: parsedBody.data.uploadId,
    })
  );

  const payload = MultipartAbortResponseSchema.parse({
    aborted: true as const,
    uploadId: parsedBody.data.uploadId,
    id,
  });
  return response(200, payload);
}

function isS3NotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === "NotFound" ||
    error.name === "NoSuchKey" ||
    error.name === "NoSuchBucket" ||
    error.name === "NotFoundException"
  );
}

async function confirmUpload(
  event: HttpEvent,
  id: string
): Promise<{ statusCode: number; body: string }> {
  const tableName = getTableName();
  const ownerEmail = getOwnerEmail(event);
  const originalsBucketName = getOriginalsBucketName();

  const current = await db.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        pk: `ASSET#${id}`,
        sk: "META",
      },
    })
  );

  if (!current.Item) {
    return response(404, { message: "Asset not found" });
  }

  const currentAsset = await readAssetOrThrow(tableName, current.Item);
  if (currentAsset.type === "folder") {
    return folderOperationNotAllowedResponse();
  }
  if (currentAsset.ownerEmail !== ownerEmail) {
    return response(403, { message: "Forbidden" });
  }

  const bucketName =
    currentAsset.original.bucket === "pending" ? originalsBucketName : currentAsset.original.bucket;

  let headOutput: HeadObjectCommandOutput;
  try {
    headOutput = await s3.send(
      new HeadObjectCommand({
        Bucket: bucketName,
        Key: currentAsset.original.key,
      })
    );
  } catch (error) {
    if (isS3NotFoundError(error)) {
      return response(409, { message: "Upload not found in S3 yet" });
    }

    throw error;
  }

  const now = new Date().toISOString();
  const size =
    typeof headOutput.ContentLength === "number"
      ? headOutput.ContentLength
      : currentAsset.original.size;
  const contentType = headOutput.ContentType ?? currentAsset.original.contentType;
  const nextStatus =
    currentAsset.status === "processing" ||
    currentAsset.status === "ready" ||
    currentAsset.status === "error"
      ? currentAsset.status
      : "uploaded";

  const updated = await db.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        pk: `ASSET#${id}`,
        sk: "META",
      },
      ConditionExpression: "attribute_exists(pk) AND attribute_exists(sk)",
      UpdateExpression:
        "SET #status = :status, #updatedAt = :updatedAt, #original.#bucket = :bucket, #original.#size = :size, #original.#contentType = :contentType",
      ExpressionAttributeNames: {
        "#status": "status",
        "#updatedAt": "updatedAt",
        "#original": "original",
        "#bucket": "bucket",
        "#size": "size",
        "#contentType": "contentType",
      },
      ExpressionAttributeValues: {
        ":status": nextStatus,
        ":updatedAt": now,
        ":bucket": bucketName,
        ":size": size,
        ":contentType": contentType,
      },
      ReturnValues: "ALL_NEW",
    })
  );

  if (!updated.Attributes) {
    return response(404, { message: "Asset not found" });
  }

  if (nextStatus !== currentAsset.status) {
    await enqueueVectorSyncMessage(id, "api-asset-by-id:upload-complete");
  }

  await appendAssetAuditLogEntry({
    db,
    tableName,
    assetId: id,
    category: "upload",
    source: "api-asset-by-id",
    code: "upload.original_uploaded",
    message: "Upload: original file uploaded",
    details: {
      contentType,
      size,
    },
  });

  const asset = await readAssetOrThrow(tableName, updated.Attributes);
  const payload = AssetDetailResponseSchema.parse({ asset });
  return response(200, payload);
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

async function deleteAsset(
  event: HttpEvent,
  id: string
): Promise<{ statusCode: number; body: string }> {
  const tableName = getTableName();
  const ownerEmail = getOwnerEmail(event);
  const originalsBucketName = getOriginalsBucketName();
  const derivedBucketName = getDerivedBucketName();

  const current = await db.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        pk: `ASSET#${id}`,
        sk: "META",
      },
    })
  );

  if (!current.Item) {
    return response(404, { message: "Asset not found" });
  }

  const asset = await readAssetOrThrow(tableName, current.Item);
  if (asset.ownerEmail !== ownerEmail) {
    return response(403, { message: "Forbidden" });
  }

  const originalBucket =
    asset.original.bucket === "pending" ? originalsBucketName : asset.original.bucket;
  await s3.send(
    new DeleteObjectCommand({
      Bucket: originalBucket,
      Key: asset.original.key,
    })
  );

  await deleteDerivedPrefix(derivedBucketName, `derived/${id}/`);

  let lastEvaluatedKey: Record<string, unknown> | undefined;
  do {
    const page = await db.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: {
          ":pk": `ASSET#${id}`,
        },
        ProjectionExpression: "pk, sk",
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    for (const item of page.Items ?? []) {
      const pk = item.pk;
      const sk = item.sk;
      if (typeof pk !== "string" || typeof sk !== "string") {
        continue;
      }

      await db.send(
        new DeleteCommand({
          TableName: tableName,
          Key: { pk, sk },
        })
      );
    }

    lastEvaluatedKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey);

  await enqueueVectorSyncMessage(id, "api-asset-by-id:deleted");

  const payload = AssetDeleteResponseSchema.parse({ id, deleted: true as const });
  return response(200, payload);
}

export async function handler(event: HttpEvent): Promise<{ statusCode: number; body: string }> {
  try {
    const method = event.requestContext?.http?.method;
    const routeKey = event.requestContext?.routeKey;
    const id = parseAssetId(event);

    if (method === "GET" && routeKey === "GET /assets/{id}/playback-url") {
      return await getPlaybackUrl(event, id);
    }

    if (method === "GET" && routeKey === "GET /assets/{id}/children") {
      return await getAssetChildren(event, id);
    }

    if (method === "GET" && routeKey === "GET /assets/{id}/lineage") {
      return await getAssetLineage(event, id);
    }

    if (method === "GET") {
      return await getAsset(id);
    }

    if (method === "PATCH") {
      return await patchAsset(event, id);
    }

    if (method === "POST" && routeKey === "POST /assets/{id}/upload-url") {
      return await createUploadUrl(event, id);
    }

    if (method === "POST" && routeKey === "POST /assets/{id}/move") {
      return await moveAsset(event, id);
    }

    if (method === "POST" && routeKey === "POST /assets/{id}/multipart/init") {
      return await initMultipartUpload(event, id);
    }

    if (method === "POST" && routeKey === "POST /assets/{id}/multipart/sign") {
      return await signMultipartPart(event, id);
    }

    if (method === "POST" && routeKey === "POST /assets/{id}/multipart/complete") {
      return await completeMultipartUpload(event, id);
    }

    if (method === "POST" && routeKey === "POST /assets/{id}/multipart/abort") {
      return await abortMultipartUpload(event, id);
    }

    if (method === "POST" && routeKey === "POST /assets/{id}/upload-complete") {
      return await confirmUpload(event, id);
    }

    if (method === "DELETE") {
      return await deleteAsset(event, id);
    }

    return response(405, { message: "Method not allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return response(500, { message });
  }
}
