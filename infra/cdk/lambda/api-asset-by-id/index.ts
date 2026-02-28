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
  AssetDetailResponseSchema,
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
};

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const UPLOAD_URL_EXPIRES_IN_SECONDS = 900;
const MULTIPART_PART_SIZE_BYTES = 32 * 1024 * 1024;

function response(statusCode: number, body: unknown): { statusCode: number; body: string } {
  return {
    statusCode,
    body: JSON.stringify(body),
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

  const asset = AssetRecordSchema.parse(result.Item);
  const payload = AssetDetailResponseSchema.parse({ asset });

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

  const currentAsset = AssetRecordSchema.parse(current.Item);

  const names: Record<string, string> = {
    "#updatedAt": "updatedAt",
  };
  const values: Record<string, unknown> = {
    ":updatedAt": now,
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

  if (updates.title !== undefined || updates.description !== undefined) {
    const nextTitle = updates.title ?? currentAsset.title;
    const nextDescription = updates.description ?? currentAsset.description;
    names["#searchText"] = "searchText";
    values[":searchText"] = [nextTitle, nextDescription].filter(Boolean).join(" ").trim();
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
      ConditionExpression: "attribute_exists(pk) AND attribute_exists(sk)",
      UpdateExpression: `SET ${setExpressions.join(", ")}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: "ALL_NEW",
    })
  );

  if (!result.Attributes) {
    return response(404, { message: "Asset not found" });
  }

  const asset = AssetRecordSchema.parse(result.Attributes);
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

  const currentAsset = AssetRecordSchema.parse(current.Item);
  if (currentAsset.ownerEmail !== ownerEmail) {
    return response(403, { message: "Forbidden" });
  }

  const contentType = parsedBody.data.contentType ?? currentAsset.original.contentType;
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: originalsBucketName,
      Key: currentAsset.original.key,
      ContentType: contentType,
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

  const asset = AssetRecordSchema.parse(updated.Attributes);
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

  const asset = AssetRecordSchema.parse(current.Item);
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

  const currentAsset = AssetRecordSchema.parse(current.Item);
  if (currentAsset.ownerEmail !== ownerEmail) {
    return response(403, { message: "Forbidden" });
  }

  const contentType = parsedBody.data.contentType ?? currentAsset.original.contentType;
  const created = await s3.send(
    new CreateMultipartUploadCommand({
      Bucket: originalsBucketName,
      Key: currentAsset.original.key,
      ContentType: contentType,
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

  const asset = AssetRecordSchema.parse(updated.Attributes);
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

  const asset = AssetRecordSchema.parse(current.Item);
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

  const asset = AssetRecordSchema.parse(current.Item);
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

  const asset = AssetRecordSchema.parse(current.Item);
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

  const currentAsset = AssetRecordSchema.parse(current.Item);
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

  const asset = AssetRecordSchema.parse(updated.Attributes);
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

  const asset = AssetRecordSchema.parse(current.Item);
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

    if (method === "GET") {
      return await getAsset(id);
    }

    if (method === "PATCH") {
      return await patchAsset(event, id);
    }

    if (method === "POST" && routeKey === "POST /assets/{id}/upload-url") {
      return await createUploadUrl(event, id);
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
