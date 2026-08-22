/// <reference types="bun-types" />

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

import { handler } from "../../lambda/api-asset-by-id";

type HttpEvent = {
  requestContext?: {
    http?: { method?: string };
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

const originalTableName = process.env.ASSETS_TABLE_NAME;
const originalCreatedAtIndex = process.env.ASSETS_CREATED_AT_INDEX;
const originalContainerIndex = process.env.ASSETS_CONTAINER_INDEX;
const originalOriginalsBucketName = process.env.ASSETS_ORIGINALS_BUCKET_NAME;
const originalDerivedBucketName = process.env.ASSETS_DERIVED_BUCKET_NAME;
const originalVectorSyncQueueUrl = process.env.VECTOR_SYNC_QUEUE_URL;
const originalAwsRegion = process.env.AWS_REGION;
const originalAwsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
const originalAwsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const originalDdbSend = DynamoDBDocumentClient.prototype.send;
const originalS3Send = S3Client.prototype.send;
const originalSqsSend = SQSClient.prototype.send;

function parseBody(result: { statusCode: number; body: string }): unknown {
  return JSON.parse(result.body);
}

function withOwnerClaims(event: HttpEvent, email = "owner@example.com"): HttpEvent {
  return {
    ...event,
    requestContext: {
      ...event.requestContext,
      authorizer: {
        jwt: {
          claims: {
            email,
          },
        },
      },
    },
  };
}

function validAsset(id: string) {
  return {
    id,
    schemaVersion: 1,
    ownerEmail: "owner@example.com",
    type: "video",
    title: "Title",
    description: "Desc",
    status: "draft",
    original: {
      bucket: "media-originals-test",
      key: `incoming/${id}`,
      size: 42,
      contentType: "video/mp4",
    },
    tags: [],
    origin: "uploaded",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function stubDdbSend(
  impl: (
    command: GetCommand | UpdateCommand | QueryCommand | DeleteCommand | TransactWriteCommand
  ) => Promise<Record<string, unknown>>
): {
  calls: Array<GetCommand | UpdateCommand | QueryCommand | DeleteCommand | TransactWriteCommand>;
} {
  const calls: Array<
    GetCommand | UpdateCommand | QueryCommand | DeleteCommand | TransactWriteCommand
  > = [];

  DynamoDBDocumentClient.prototype.send = async function (command: unknown) {
    if (
      !(command instanceof GetCommand) &&
      !(command instanceof UpdateCommand) &&
      !(command instanceof QueryCommand) &&
      !(command instanceof DeleteCommand) &&
      !(command instanceof TransactWriteCommand)
    ) {
      throw new Error("Unexpected command");
    }

    calls.push(command);
    return impl(command);
  } as typeof DynamoDBDocumentClient.prototype.send;

  return { calls };
}

function stubS3Send(
  impl: (
    command:
      | HeadObjectCommand
      | DeleteObjectCommand
      | ListObjectsV2Command
      | DeleteObjectsCommand
      | CreateMultipartUploadCommand
      | CompleteMultipartUploadCommand
      | AbortMultipartUploadCommand
  ) => Promise<Record<string, unknown>>
): {
  calls: Array<
    | HeadObjectCommand
    | DeleteObjectCommand
    | ListObjectsV2Command
    | DeleteObjectsCommand
    | CreateMultipartUploadCommand
    | CompleteMultipartUploadCommand
    | AbortMultipartUploadCommand
  >;
} {
  const calls: Array<
    | HeadObjectCommand
    | DeleteObjectCommand
    | ListObjectsV2Command
    | DeleteObjectsCommand
    | CreateMultipartUploadCommand
    | CompleteMultipartUploadCommand
    | AbortMultipartUploadCommand
  > = [];

  S3Client.prototype.send = async function (command: unknown) {
    if (
      !(command instanceof HeadObjectCommand) &&
      !(command instanceof DeleteObjectCommand) &&
      !(command instanceof ListObjectsV2Command) &&
      !(command instanceof DeleteObjectsCommand) &&
      !(command instanceof CreateMultipartUploadCommand) &&
      !(command instanceof CompleteMultipartUploadCommand) &&
      !(command instanceof AbortMultipartUploadCommand)
    ) {
      throw new Error("Unexpected S3 command");
    }

    calls.push(command);
    return impl(command);
  } as typeof S3Client.prototype.send;

  return { calls };
}

describe("api-asset-by-id lambda", () => {
  beforeEach(() => {
    process.env.ASSETS_TABLE_NAME = "Assets";
    process.env.ASSETS_CREATED_AT_INDEX = "AssetByCreatedAt";
    process.env.ASSETS_CONTAINER_INDEX = "AssetByContainer";
    process.env.ASSETS_ORIGINALS_BUCKET_NAME = "media-originals-test";
    process.env.ASSETS_DERIVED_BUCKET_NAME = "media-derived-test";
    process.env.VECTOR_SYNC_QUEUE_URL = "https://sqs.us-west-2.amazonaws.com/123/vector-sync";
    process.env.AWS_REGION = "us-west-2";
    process.env.AWS_ACCESS_KEY_ID = "test-access-key";
    process.env.AWS_SECRET_ACCESS_KEY = "test-secret-key";
    SQSClient.prototype.send = async function () {
      return {};
    } as typeof SQSClient.prototype.send;
  });

  afterEach(() => {
    DynamoDBDocumentClient.prototype.send = originalDdbSend;
    S3Client.prototype.send = originalS3Send;
    SQSClient.prototype.send = originalSqsSend;

    if (originalTableName === undefined) {
      delete process.env.ASSETS_TABLE_NAME;
    } else {
      process.env.ASSETS_TABLE_NAME = originalTableName;
    }

    if (originalCreatedAtIndex === undefined) {
      delete process.env.ASSETS_CREATED_AT_INDEX;
    } else {
      process.env.ASSETS_CREATED_AT_INDEX = originalCreatedAtIndex;
    }

    if (originalContainerIndex === undefined) {
      delete process.env.ASSETS_CONTAINER_INDEX;
    } else {
      process.env.ASSETS_CONTAINER_INDEX = originalContainerIndex;
    }

    if (originalOriginalsBucketName === undefined) {
      delete process.env.ASSETS_ORIGINALS_BUCKET_NAME;
    } else {
      process.env.ASSETS_ORIGINALS_BUCKET_NAME = originalOriginalsBucketName;
    }

    if (originalDerivedBucketName === undefined) {
      delete process.env.ASSETS_DERIVED_BUCKET_NAME;
    } else {
      process.env.ASSETS_DERIVED_BUCKET_NAME = originalDerivedBucketName;
    }

    if (originalVectorSyncQueueUrl === undefined) {
      delete process.env.VECTOR_SYNC_QUEUE_URL;
    } else {
      process.env.VECTOR_SYNC_QUEUE_URL = originalVectorSyncQueueUrl;
    }

    if (originalAwsRegion === undefined) {
      delete process.env.AWS_REGION;
    } else {
      process.env.AWS_REGION = originalAwsRegion;
    }

    if (originalAwsAccessKeyId === undefined) {
      delete process.env.AWS_ACCESS_KEY_ID;
    } else {
      process.env.AWS_ACCESS_KEY_ID = originalAwsAccessKeyId;
    }

    if (originalAwsSecretAccessKey === undefined) {
      delete process.env.AWS_SECRET_ACCESS_KEY;
    } else {
      process.env.AWS_SECRET_ACCESS_KEY = originalAwsSecretAccessKey;
    }
  });

  it("returns asset for GET /assets/{id}", async () => {
    const { calls } = stubDdbSend(async (command) => {
      if (!(command instanceof GetCommand)) {
        throw new Error("Expected GetCommand");
      }

      return { Item: validAsset("asset-1") };
    });

    const result = await handler({
      requestContext: { http: { method: "GET" } },
      pathParameters: { id: "asset-1" },
    });

    expect(result.statusCode).toBe(200);
    const body = parseBody(result) as { asset: { id: string } };
    expect(body.asset.id).toBe("asset-1");
    expect(calls).toHaveLength(1);
  });

  it("includes stream info for GET /assets/{id}", async () => {
    stubDdbSend(async (command) => {
      if (!(command instanceof GetCommand)) {
        throw new Error("Expected GetCommand");
      }

      return {
        Item: {
          ...validAsset("asset-stream-1"),
          status: "ready",
          stream: {
            hlsMasterUrl: "https://cdn.example.com/derived/asset-stream-1/hls/master.m3u8",
            posterUrl: "https://cdn.example.com/derived/asset-stream-1/thumbs/poster.jpg",
          },
        },
      };
    });

    const result = await handler({
      requestContext: { http: { method: "GET" } },
      pathParameters: { id: "asset-stream-1" },
    });

    expect(result.statusCode).toBe(200);
    const body = parseBody(result) as {
      asset: {
        stream?: {
          hlsMasterUrl?: string;
        };
      };
    };
    expect(body.asset.stream?.hlsMasterUrl).toBe(
      "https://cdn.example.com/derived/asset-stream-1/hls/master.m3u8"
    );
  });

  it("returns direct children for GET /assets/{id}/children", async () => {
    stubDdbSend(async (command) => {
      if (command instanceof GetCommand) {
        return { Item: validAsset("parent-1") };
      }

      if (!(command instanceof QueryCommand)) {
        throw new Error("Expected QueryCommand");
      }

      expect(command.input.IndexName).toBe("AssetByContainer");
      expect(command.input.KeyConditionExpression).toContain("gsi2pk");

      return {
        Items: [
          {
            ...validAsset("child-1"),
            containerId: "parent-1",
            parentId: "parent-1",
            rootId: "parent-1",
            depth: 1,
          },
          {
            ...validAsset("other-1"),
            containerId: "other-parent",
          },
        ],
      };
    });

    const result = await handler(
      withOwnerClaims({
        requestContext: {
          http: { method: "GET" },
          routeKey: "GET /assets/{id}/children",
        },
        pathParameters: { id: "parent-1" },
      })
    );

    expect(result.statusCode).toBe(200);
    const body = parseBody(result) as { parentId: string; assets: Array<{ id: string }> };
    expect(body.parentId).toBe("parent-1");
    expect(body.assets).toHaveLength(1);
    expect(body.assets[0]?.id).toBe("child-1");
  });

  it("returns lineage sources for GET /assets/{id}/lineage", async () => {
    stubDdbSend(async (command) => {
      if (!(command instanceof GetCommand)) {
        throw new Error("Expected GetCommand");
      }

      const key = command.input.Key as { pk: string };
      if (key.pk === "ASSET#lineage-asset") {
        return {
          Item: {
            ...validAsset("lineage-asset"),
            sourceAssetIds: ["source-1", "source-2"],
          },
        };
      }

      if (key.pk === "ASSET#source-1") {
        return { Item: validAsset("source-1") };
      }

      if (key.pk === "ASSET#source-2") {
        return { Item: validAsset("source-2") };
      }

      return { Item: null };
    });

    const result = await handler(
      withOwnerClaims({
        requestContext: {
          http: { method: "GET" },
          routeKey: "GET /assets/{id}/lineage",
        },
        pathParameters: { id: "lineage-asset" },
      })
    );

    expect(result.statusCode).toBe(200);
    const body = parseBody(result) as { sources: Array<{ id: string }> };
    expect(body.sources.map((source) => source.id)).toEqual(["source-1", "source-2"]);
  });

  it("moves an asset to a container on POST /assets/{id}/move", async () => {
    stubDdbSend(async (command) => {
      if (command instanceof GetCommand) {
        const key = command.input.Key as { pk: string };
        if (key.pk === "ASSET#asset-move") {
          return { Item: validAsset("asset-move") };
        }

        if (key.pk === "ASSET#container-1") {
          return {
            Item: {
              ...validAsset("container-1"),
              rootId: "root-1",
              depth: 2,
            },
          };
        }

        return { Item: null };
      }

      if (!(command instanceof UpdateCommand)) {
        throw new Error("Expected UpdateCommand");
      }

      const values = command.input.ExpressionAttributeValues as Record<string, unknown>;
      expect(values[":containerId"]).toBe("container-1");
      expect(values[":rootId"]).toBe("root-1");
      expect(values[":depth"]).toBe(3);
      expect(values[":gsi2pk"]).toBe("CONTAINER#container-1");
      expect(typeof values[":gsi2sk"]).toBe("string");

      return {
        Attributes: {
          ...validAsset("asset-move"),
          containerId: "container-1",
          parentId: "container-1",
          rootId: "root-1",
          depth: 3,
        },
      };
    });

    const result = await handler(
      withOwnerClaims({
        requestContext: {
          http: { method: "POST" },
          routeKey: "POST /assets/{id}/move",
        },
        pathParameters: { id: "asset-move" },
        body: JSON.stringify({ containerId: "container-1" }),
      })
    );

    expect(result.statusCode).toBe(200);
    const body = parseBody(result) as { asset: { containerId?: string; depth?: number } };
    expect(body.asset.containerId).toBe("container-1");
    expect(body.asset.depth).toBe(3);
  });

  it("rejects move that creates a cycle", async () => {
    stubDdbSend(async (command) => {
      if (!(command instanceof GetCommand)) {
        throw new Error("Expected GetCommand");
      }

      const key = command.input.Key as { pk: string };
      if (key.pk === "ASSET#asset-cycle") {
        return { Item: validAsset("asset-cycle") };
      }

      if (key.pk === "ASSET#container-cycle") {
        return {
          Item: {
            ...validAsset("container-cycle"),
            containerId: "asset-cycle",
          },
        };
      }

      return { Item: null };
    });

    const result = await handler(
      withOwnerClaims({
        requestContext: {
          http: { method: "POST" },
          routeKey: "POST /assets/{id}/move",
        },
        pathParameters: { id: "asset-cycle" },
        body: JSON.stringify({ containerId: "container-cycle" }),
      })
    );

    expect(result.statusCode).toBe(400);
    expect(result.body).toContain("cycle detected");
  });

  it("patches asset fields on PATCH /assets/{id}", async () => {
    const { calls } = stubDdbSend(async (command) => {
      if (command instanceof GetCommand) {
        return { Item: validAsset("asset-9") };
      }

      if (!(command instanceof UpdateCommand)) {
        throw new Error("Expected UpdateCommand");
      }

      const values = command.input.ExpressionAttributeValues as Record<string, unknown>;
      expect(values[":searchText"]).toBe("updated desc campaign launch video uploaded video/mp4");

      return {
        Attributes: {
          ...validAsset("asset-9"),
          title: "Updated",
          searchText: "updated desc campaign launch video uploaded video/mp4",
          tags: [{ facet: "campaign", value: "launch", weight: "strong", source: "user" }],
        },
      };
    });

    const result = await handler(
      withOwnerClaims({
        requestContext: { http: { method: "PATCH" } },
        pathParameters: { id: "asset-9" },
        body: JSON.stringify({
          title: "Updated",
          tags: [{ facet: "campaign", value: "launch" }],
        }),
      })
    );

    expect(result.statusCode).toBe(200);
    const body = parseBody(result) as { asset: { title: string } };
    expect(body.asset.title).toBe("Updated");
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it("enqueues visibility changes but not metadata-only patches", async () => {
    const queueCalls: SendMessageCommand[] = [];
    SQSClient.prototype.send = async function (command: unknown) {
      queueCalls.push(command as SendMessageCommand);
      return {};
    } as typeof SQSClient.prototype.send;
    stubDdbSend(async (command) => {
      if (command instanceof GetCommand) {
        return { Item: { ...validAsset("asset-visible"), visibility: "private" } };
      }
      if (!(command instanceof UpdateCommand)) {
        throw new Error("Expected UpdateCommand");
      }
      return {
        Attributes: { ...validAsset("asset-visible"), visibility: "public" },
      };
    });

    const visibilityResult = await handler(
      withOwnerClaims({
        requestContext: { http: { method: "PATCH" } },
        pathParameters: { id: "asset-visible" },
        body: JSON.stringify({ visibility: "public" }),
      })
    );

    expect(visibilityResult.statusCode).toBe(200);
    expect(queueCalls.map((call) => call.input.MessageBody)).toEqual([
      '{"assetId":"asset-visible"}',
    ]);

    queueCalls.length = 0;
    const metadataResult = await handler(
      withOwnerClaims({
        requestContext: { http: { method: "PATCH" } },
        pathParameters: { id: "asset-visible" },
        body: JSON.stringify({ title: "Metadata only" }),
      })
    );

    expect(metadataResult.statusCode).toBe(200);
    expect(queueCalls).toHaveLength(0);
  });

  it("rejects patches for assets owned by another user", async () => {
    const { calls } = stubDdbSend(async (command) => {
      if (command instanceof GetCommand) {
        return { Item: { ...validAsset("asset-other"), ownerEmail: "other@example.com" } };
      }
      throw new Error("Update must not run for another owner's asset");
    });

    const result = await handler(
      withOwnerClaims({
        requestContext: { http: { method: "PATCH" } },
        pathParameters: { id: "asset-other" },
        body: JSON.stringify({ visibility: "public" }),
      })
    );

    expect(result.statusCode).toBe(403);
    expect(calls).toHaveLength(1);
  });

  it("blocks making a published music asset private", async () => {
    const { calls } = stubDdbSend(async (command) => {
      if (command instanceof GetCommand) {
        return { Item: { ...validAsset("music-audio"), type: "audio", visibility: "public" } };
      }
      if (command instanceof QueryCommand) {
        return { Items: [{ sk: "MUSIC_TRACK", publicationStatus: "published" }] };
      }

      throw new Error("Update must not run");
    });

    const result = await handler(
      withOwnerClaims({
        requestContext: { http: { method: "PATCH" } },
        pathParameters: { id: "music-audio" },
        body: JSON.stringify({ visibility: "private" }),
      })
    );
    expect(result.statusCode).toBe(409);
    expect(calls.some((command) => command instanceof UpdateCommand)).toBe(false);
  });

  it("makes privacy changes transactional with draft reverse-state checks", async () => {
    let getCount = 0;
    const { calls } = stubDdbSend(async (command) => {
      if (command instanceof GetCommand) {
        getCount += 1;
        return {
          Item: {
            ...validAsset("draft-music-audio"),
            type: "audio",
            visibility: getCount === 1 ? "public" : "private",
          },
        };
      }
      if (command instanceof QueryCommand)
        return { Items: [{ sk: "MUSIC_TRACK", publicationStatus: "draft" }] };
      if (command instanceof TransactWriteCommand) return {};
      throw new Error("Unexpected command");
    });

    const result = await handler(
      withOwnerClaims({
        requestContext: { http: { method: "PATCH" } },
        pathParameters: { id: "draft-music-audio" },
        body: JSON.stringify({ visibility: "private" }),
      })
    );
    expect(result.statusCode).toBe(200);
    const transaction = calls.find(
      (command) => command instanceof TransactWriteCommand
    ) as TransactWriteCommand;
    expect(transaction.input.TransactItems?.[0]?.Update?.ConditionExpression).toContain(
      "publishedMusicLinkCount"
    );
    expect(transaction.input.TransactItems?.[1]?.ConditionCheck?.ConditionExpression).toContain(
      "publicationStatus <> :published"
    );
  });

  it("returns pre-signed URL for POST /assets/{id}/upload-url without marking uploaded", async () => {
    const { calls } = stubDdbSend(async (command) => {
      if (command instanceof GetCommand) {
        return { Item: validAsset("asset-5") };
      }

      if (!(command instanceof UpdateCommand)) {
        throw new Error("Expected UpdateCommand");
      }

      if (command.input.ExpressionAttributeValues?.[":auditLog"]) {
        return {};
      }

      expect(command.input.ExpressionAttributeValues?.[":status"]).toBe("draft");
      return {
        Attributes: {
          ...validAsset("asset-5"),
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      };
    });

    const result = await handler(
      withOwnerClaims({
        requestContext: {
          http: { method: "POST" },
          routeKey: "POST /assets/{id}/upload-url",
        },
        pathParameters: { id: "asset-5" },
        body: JSON.stringify({ contentType: "video/mp4" }),
      })
    );

    expect(result.statusCode).toBe(200);
    const body = parseBody(result) as { uploadUrl: string; expiresIn: number };
    expect(body.uploadUrl).toContain("media-originals-test");
    expect(body.expiresIn).toBe(900);
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it("includes video dimension metadata in signed upload URL", async () => {
    stubDdbSend(async (command) => {
      if (command instanceof GetCommand) {
        return { Item: validAsset("asset-upload-meta-1") };
      }

      if (!(command instanceof UpdateCommand)) {
        throw new Error("Expected UpdateCommand");
      }

      return {
        Attributes: {
          ...validAsset("asset-upload-meta-1"),
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      };
    });

    const result = await handler(
      withOwnerClaims({
        requestContext: {
          http: { method: "POST" },
          routeKey: "POST /assets/{id}/upload-url",
        },
        pathParameters: { id: "asset-upload-meta-1" },
        body: JSON.stringify({
          contentType: "video/mp4",
          videoMetadata: {
            width: 1080,
            height: 1920,
          },
        }),
      })
    );

    expect(result.statusCode).toBe(200);
    const body = parseBody(result) as { uploadUrl: string };
    expect(body.uploadUrl).toContain("x-amz-meta-video-width=1080");
    expect(body.uploadUrl).toContain("x-amz-meta-video-height=1920");
  });

  it("rejects upload-url request for folder assets", async () => {
    stubDdbSend(async (command) => {
      if (!(command instanceof GetCommand)) {
        throw new Error("Expected GetCommand");
      }

      return {
        Item: {
          ...validAsset("folder-1"),
          type: "folder",
          status: "ready",
          processingProfile: "folder-meta-v1",
        },
      };
    });

    const result = await handler(
      withOwnerClaims({
        requestContext: {
          http: { method: "POST" },
          routeKey: "POST /assets/{id}/upload-url",
        },
        pathParameters: { id: "folder-1" },
        body: JSON.stringify({ contentType: "application/octet-stream" }),
      })
    );

    expect(result.statusCode).toBe(400);
    expect(result.body).toContain("Folders do not support upload or playback operations");
  });

  it("returns pre-signed playback URL for GET /assets/{id}/playback-url", async () => {
    const { calls } = stubDdbSend(async (command) => {
      if (!(command instanceof GetCommand)) {
        throw new Error("Expected GetCommand");
      }

      return { Item: validAsset("asset-playback-1") };
    });

    const result = await handler(
      withOwnerClaims({
        requestContext: {
          http: { method: "GET" },
          routeKey: "GET /assets/{id}/playback-url",
        },
        pathParameters: { id: "asset-playback-1" },
      })
    );

    expect(result.statusCode).toBe(200);
    const body = parseBody(result) as {
      playbackUrl: string;
      contentType: string;
      id: string;
    };
    expect(body.playbackUrl).toContain("X-Amz-Signature");
    expect(body.contentType).toBe("video/mp4");
    expect(body.id).toBe("asset-playback-1");
    expect(calls).toHaveLength(1);
  });

  it("initializes multipart upload and returns upload id", async () => {
    const s3 = stubS3Send(async (command) => {
      if (!(command instanceof CreateMultipartUploadCommand)) {
        throw new Error("Expected CreateMultipartUploadCommand");
      }

      return { UploadId: "upload-123" };
    });

    const ddb = stubDdbSend(async (command) => {
      if (command instanceof GetCommand) {
        return { Item: validAsset("asset-mp-1") };
      }

      if (!(command instanceof UpdateCommand)) {
        throw new Error("Expected UpdateCommand");
      }

      return {
        Attributes: {
          ...validAsset("asset-mp-1"),
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      };
    });

    const result = await handler(
      withOwnerClaims({
        requestContext: {
          http: { method: "POST" },
          routeKey: "POST /assets/{id}/multipart/init",
        },
        pathParameters: { id: "asset-mp-1" },
        body: JSON.stringify({ contentType: "video/mp4" }),
      })
    );

    expect(result.statusCode).toBe(200);
    const body = parseBody(result) as { uploadId: string; partSize: number };
    expect(body.uploadId).toBe("upload-123");
    expect(body.partSize).toBe(32 * 1024 * 1024);
    expect(ddb.calls.length).toBeGreaterThanOrEqual(2);
    expect(s3.calls).toHaveLength(1);
  });

  it("sets video dimension metadata on multipart init", async () => {
    const s3 = stubS3Send(async (command) => {
      if (!(command instanceof CreateMultipartUploadCommand)) {
        throw new Error("Expected CreateMultipartUploadCommand");
      }

      expect(command.input.Metadata).toMatchObject({
        "video-width": "720",
        "video-height": "1280",
      });

      return { UploadId: "upload-metadata-1" };
    });

    stubDdbSend(async (command) => {
      if (command instanceof GetCommand) {
        return { Item: validAsset("asset-mp-meta-1") };
      }

      if (!(command instanceof UpdateCommand)) {
        throw new Error("Expected UpdateCommand");
      }

      return {
        Attributes: {
          ...validAsset("asset-mp-meta-1"),
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      };
    });

    const result = await handler(
      withOwnerClaims({
        requestContext: {
          http: { method: "POST" },
          routeKey: "POST /assets/{id}/multipart/init",
        },
        pathParameters: { id: "asset-mp-meta-1" },
        body: JSON.stringify({
          contentType: "video/mp4",
          videoMetadata: {
            width: 720,
            height: 1280,
          },
        }),
      })
    );

    expect(result.statusCode).toBe(200);
    expect(s3.calls).toHaveLength(1);
  });

  it("signs multipart part URL", async () => {
    const { calls } = stubDdbSend(async (command) => {
      if (!(command instanceof GetCommand)) {
        throw new Error("Expected GetCommand");
      }

      return { Item: validAsset("asset-mp-2") };
    });

    const result = await handler(
      withOwnerClaims({
        requestContext: {
          http: { method: "POST" },
          routeKey: "POST /assets/{id}/multipart/sign",
        },
        pathParameters: { id: "asset-mp-2" },
        body: JSON.stringify({ uploadId: "upload-xyz", partNumber: 1 }),
      })
    );

    expect(result.statusCode).toBe(200);
    const body = parseBody(result) as { uploadUrl: string; partNumber: number };
    expect(body.uploadUrl).toContain("X-Amz-Signature");
    expect(body.partNumber).toBe(1);
    expect(calls).toHaveLength(1);
  });

  it("completes multipart upload and marks uploaded", async () => {
    const s3 = stubS3Send(async (command) => {
      if (command instanceof CompleteMultipartUploadCommand) {
        return {};
      }

      if (command instanceof HeadObjectCommand) {
        return {
          ContentLength: 123456789,
          ContentType: "video/mp4",
        };
      }

      throw new Error("Unexpected S3 command");
    });

    const ddb = stubDdbSend(async (command) => {
      if (command instanceof GetCommand) {
        return { Item: validAsset("asset-mp-3") };
      }

      if (!(command instanceof UpdateCommand)) {
        throw new Error("Expected UpdateCommand");
      }

      return {
        Attributes: {
          ...validAsset("asset-mp-3"),
          status: "uploaded",
          original: {
            ...validAsset("asset-mp-3").original,
            size: 123456789,
            contentType: "video/mp4",
          },
        },
      };
    });

    const result = await handler(
      withOwnerClaims({
        requestContext: {
          http: { method: "POST" },
          routeKey: "POST /assets/{id}/multipart/complete",
        },
        pathParameters: { id: "asset-mp-3" },
        body: JSON.stringify({
          uploadId: "upload-final",
          parts: [
            { partNumber: 1, etag: "etag-1" },
            { partNumber: 2, etag: "etag-2" },
          ],
        }),
      })
    );

    expect(result.statusCode).toBe(200);
    const body = parseBody(result) as { asset: { status: string } };
    expect(body.asset.status).toBe("uploaded");
    expect(ddb.calls.length).toBeGreaterThanOrEqual(2);
    expect(s3.calls.some((command) => command instanceof CompleteMultipartUploadCommand)).toBe(
      true
    );
  });

  it("aborts multipart upload", async () => {
    const s3 = stubS3Send(async (command) => {
      if (!(command instanceof AbortMultipartUploadCommand)) {
        throw new Error("Expected AbortMultipartUploadCommand");
      }

      return {};
    });

    const ddb = stubDdbSend(async (command) => {
      if (!(command instanceof GetCommand)) {
        throw new Error("Expected GetCommand");
      }

      return { Item: validAsset("asset-mp-4") };
    });

    const result = await handler(
      withOwnerClaims({
        requestContext: {
          http: { method: "POST" },
          routeKey: "POST /assets/{id}/multipart/abort",
        },
        pathParameters: { id: "asset-mp-4" },
        body: JSON.stringify({ uploadId: "upload-abort" }),
      })
    );

    expect(result.statusCode).toBe(200);
    const body = parseBody(result) as { aborted: boolean; uploadId: string };
    expect(body.aborted).toBe(true);
    expect(body.uploadId).toBe("upload-abort");
    expect(ddb.calls).toHaveLength(1);
    expect(s3.calls).toHaveLength(1);
  });

  it("confirms upload and marks asset uploaded", async () => {
    stubS3Send(async (command) => {
      if (!(command instanceof HeadObjectCommand)) {
        throw new Error("Expected HeadObjectCommand");
      }

      return {
        ContentLength: 6000000,
        ContentType: "audio/mpeg",
      };
    });

    const { calls } = stubDdbSend(async (command) => {
      if (command instanceof GetCommand) {
        return { Item: validAsset("asset-6") };
      }

      if (!(command instanceof UpdateCommand)) {
        throw new Error("Expected UpdateCommand");
      }

      if (command.input.ExpressionAttributeValues?.[":auditLog"]) {
        return {};
      }

      expect(command.input.ExpressionAttributeValues?.[":status"]).toBe("uploaded");
      expect(command.input.ExpressionAttributeValues?.[":size"]).toBe(6000000);
      return {
        Attributes: {
          ...validAsset("asset-6"),
          status: "uploaded",
          original: {
            ...validAsset("asset-6").original,
            size: 6000000,
            contentType: "audio/mpeg",
          },
        },
      };
    });

    const result = await handler(
      withOwnerClaims({
        requestContext: {
          http: { method: "POST" },
          routeKey: "POST /assets/{id}/upload-complete",
        },
        pathParameters: { id: "asset-6" },
        body: "{}",
      })
    );

    expect(result.statusCode).toBe(200);
    const body = parseBody(result) as { asset: { status: string } };
    expect(body.asset.status).toBe("uploaded");
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it("deletes asset metadata and S3 objects for owner", async () => {
    const operations: string[] = [];
    const queueCalls: SendMessageCommand[] = [];
    SQSClient.prototype.send = async function (command: unknown) {
      operations.push("enqueue");
      queueCalls.push(command as SendMessageCommand);
      return {};
    } as typeof SQSClient.prototype.send;
    const s3 = stubS3Send(async (command) => {
      if (command instanceof DeleteObjectCommand) {
        return {};
      }

      if (command instanceof ListObjectsV2Command) {
        return {
          Contents: [{ Key: "derived/asset-7/hls/master.m3u8" }],
          IsTruncated: false,
        };
      }

      if (command instanceof DeleteObjectsCommand) {
        return {};
      }

      throw new Error("Unexpected S3 command");
    });

    const ddb = stubDdbSend(async (command) => {
      if (command instanceof GetCommand) {
        return { Item: validAsset("asset-7") };
      }

      if (command instanceof QueryCommand) {
        return {
          Items: [
            { pk: "ASSET#asset-7", sk: "META" },
            { pk: "ASSET#asset-7", sk: "TAG#campaign#launch" },
          ],
        };
      }

      if (command instanceof TransactWriteCommand) {
        operations.push("delete-metadata-transaction");
        return {};
      }

      if (command instanceof DeleteCommand) {
        operations.push("delete-record");
        return {};
      }

      throw new Error("Unexpected DDB command");
    });

    const result = await handler(
      withOwnerClaims({
        requestContext: { http: { method: "DELETE" } },
        pathParameters: { id: "asset-7" },
      })
    );

    expect(result.statusCode).toBe(200);
    const body = parseBody(result) as { id: string; deleted: boolean };
    expect(body.id).toBe("asset-7");
    expect(body.deleted).toBe(true);
    expect(ddb.calls.some((command) => command instanceof DeleteCommand)).toBe(true);
    expect(s3.calls.some((command) => command instanceof DeleteObjectCommand)).toBe(true);
    expect(queueCalls[0]?.input.MessageBody).toBe('{"assetId":"asset-7"}');
    expect(operations.at(-1)).toBe("enqueue");
  });

  it("returns 403 when deleting non-owner asset", async () => {
    stubDdbSend(async (command) => {
      if (!(command instanceof GetCommand)) {
        throw new Error("Expected GetCommand");
      }

      return {
        Item: {
          ...validAsset("asset-8"),
          ownerEmail: "someone-else@example.com",
        },
      };
    });

    const result = await handler(
      withOwnerClaims({
        requestContext: { http: { method: "DELETE" } },
        pathParameters: { id: "asset-8" },
      })
    );

    expect(result.statusCode).toBe(403);
  });

  it("blocks direct deletion before storage mutation when music links exist", async () => {
    const s3 = stubS3Send(async () => {
      throw new Error("S3 must not run");
    });
    stubDdbSend(async (command) => {
      if (command instanceof GetCommand) return { Item: validAsset("linked-asset") };
      if (command instanceof QueryCommand) {
        return {
          Items: [
            {
              sk: "MUSIC_RELEASE#00000000-0000-4000-8000-000000000001",
              publicationStatus: "draft",
            },
          ],
        };
      }
      throw new Error("Delete must not run");
    });

    const result = await handler(
      withOwnerClaims({
        requestContext: { http: { method: "DELETE" } },
        pathParameters: { id: "linked-asset" },
      })
    );
    expect(result.statusCode).toBe(409);
    expect(s3.calls).toHaveLength(0);
  });
});
