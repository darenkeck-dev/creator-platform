/// <reference types="bun-types" />

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";

import { handler } from "../../lambda/api-assets";

type HttpEvent = {
  requestContext?: {
    http?: { method?: string };
    authorizer?: {
      jwt?: {
        claims?: Record<string, string>;
      };
    };
  };
  body?: string | null;
  queryStringParameters?: Record<string, string>;
};

const originalTableName = process.env.ASSETS_TABLE_NAME;
const originalCreatedAtIndex = process.env.ASSETS_CREATED_AT_INDEX;
const originalContainerIndex = process.env.ASSETS_CONTAINER_INDEX;
const originalSend = DynamoDBDocumentClient.prototype.send;

function createPostEvent(body: unknown): HttpEvent {
  return {
    requestContext: {
      http: { method: "POST" },
      authorizer: { jwt: { claims: { email: "owner@example.com" } } },
    },
    body: JSON.stringify(body),
  };
}

function createGetEvent(): HttpEvent {
  return {
    requestContext: {
      http: { method: "GET" },
      authorizer: { jwt: { claims: { email: "owner@example.com" } } },
    },
  };
}

function createGetEventWithQuery(query: Record<string, string>): HttpEvent {
  return {
    requestContext: {
      http: { method: "GET" },
      authorizer: { jwt: { claims: { email: "owner@example.com" } } },
    },
    queryStringParameters: query,
  };
}

function parseBody(result: { statusCode: number; body: string }): unknown {
  return JSON.parse(result.body);
}

function stubSend(
  impl: (command: PutCommand | QueryCommand | GetCommand) => Promise<Record<string, unknown>>
): {
  calls: Array<PutCommand | QueryCommand | GetCommand>;
} {
  const calls: Array<PutCommand | QueryCommand | GetCommand> = [];

  DynamoDBDocumentClient.prototype.send = async function (command: unknown) {
    if (
      !(command instanceof PutCommand) &&
      !(command instanceof QueryCommand) &&
      !(command instanceof GetCommand)
    ) {
      throw new Error("Unexpected command");
    }

    calls.push(command);
    return impl(command);
  } as typeof DynamoDBDocumentClient.prototype.send;

  return { calls };
}

describe("api-assets lambda", () => {
  beforeEach(() => {
    process.env.ASSETS_TABLE_NAME = "Assets";
    process.env.ASSETS_CREATED_AT_INDEX = "AssetByCreatedAt";
    process.env.ASSETS_CONTAINER_INDEX = "AssetByContainer";
  });

  afterEach(() => {
    DynamoDBDocumentClient.prototype.send = originalSend;

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
  });

  it("creates an asset on POST", async () => {
    const { calls } = stubSend(async (command) => {
      if (!(command instanceof PutCommand)) {
        throw new Error("Expected PutCommand");
      }

      const item = command.input.Item as Record<string, unknown>;
      expect(item.gsi2pk).toBe("CONTAINER#ROOT");
      expect(typeof item.gsi2sk).toBe("string");

      return {};
    });

    const result = await handler(
      createPostEvent({
        type: "video",
        title: "Launch clip",
        description: "Promo",
        tags: [{ facet: "campaign", value: "launch", weight: "strong" }],
      })
    );

    expect(result.statusCode).toBe(201);
    const body = parseBody(result) as {
      asset: {
        title: string;
        type: string;
        status: string;
        schemaVersion: number;
        ownerEmail: string;
        searchText?: string;
        tags: Array<{ facet?: string; value: string }>;
      };
    };
    expect(body.asset.title).toBe("Launch clip");
    expect(body.asset.type).toBe("video");
    expect((body.asset as { origin?: string }).origin).toBe("uploaded");
    expect(body.asset.status).toBe("draft");
    expect(body.asset.schemaVersion).toBe(1);
    expect(body.asset.ownerEmail).toBe("owner@example.com");
    expect(body.asset.tags).toHaveLength(1);
    expect((body.asset.tags[0] as { source?: string }).source).toBe("user");
    expect(body.asset.searchText).toContain("launch clip");
    expect(body.asset.searchText).toContain("promo");
    expect(body.asset.searchText).toContain("campaign");
    expect(body.asset.searchText).toContain("launch");
    expect(body.asset.searchText).toContain("video");
    expect(body.asset.searchText).toContain("uploaded");
    expect(body.asset.searchText).toContain("video-standard-v1");
    expect(calls).toHaveLength(1);
  });

  it("creates folders as first-class assets on POST", async () => {
    stubSend(async (command) => {
      if (!(command instanceof PutCommand)) {
        throw new Error("Expected PutCommand");
      }

      const item = command.input.Item as Record<string, unknown>;
      expect(item.type).toBe("folder");
      expect(item.status).toBe("ready");
      expect(item.processingProfile).toBe("folder-meta-v1");
      expect(item.gsi2pk).toBe("CONTAINER#ROOT");
      return {};
    });

    const result = await handler(
      createPostEvent({
        type: "folder",
        title: "Campaign Folder",
        description: "container",
      })
    );

    expect(result.statusCode).toBe(201);
    const body = parseBody(result) as { asset: { type: string; status: string } };
    expect(body.asset.type).toBe("folder");
    expect(body.asset.status).toBe("ready");
    expect((body.asset as { origin?: string }).origin).toBe("manual");
  });

  it("creates generated assets with provenance metadata", async () => {
    const result = await handler(
      createPostEvent({
        type: "video",
        title: "AI clip",
        origin: "generated",
        generation: {
          provider: "openai",
          model: "sora-v1",
          workflowId: "wf-gen-1",
          promptHash: "hash-1",
          seed: 42,
          createdBy: "owner@example.com",
        },
      })
    );

    expect(result.statusCode).toBe(201);
    const body = parseBody(result) as {
      asset: {
        origin?: string;
        generation?: { provider: string; model: string; workflowId: string };
        searchText?: string;
      };
    };
    expect(body.asset.origin).toBe("generated");
    expect(body.asset.generation?.provider).toBe("openai");
    expect(body.asset.searchText).toContain("generated");
    expect(body.asset.searchText).toContain("sora-v1");
  });

  it("rejects generation metadata for uploaded origin", async () => {
    const result = await handler(
      createPostEvent({
        type: "video",
        title: "Upload clip",
        origin: "uploaded",
        generation: {
          provider: "openai",
          model: "sora-v1",
          workflowId: "wf-gen-2",
          promptHash: "hash-2",
          createdBy: "owner@example.com",
        },
      })
    );

    expect(result.statusCode).toBe(400);
    expect(result.body).toContain("generation metadata is only allowed");
  });

  it("returns 400 for invalid POST body", async () => {
    const result = await handler(createPostEvent({ type: "video" }));

    expect(result.statusCode).toBe(400);
    expect(result.body).toContain("Invalid request body");
  });

  it("returns 400 for invalid tag facet", async () => {
    const result = await handler(
      createPostEvent({
        type: "video",
        title: "Launch clip",
        tags: [{ facet: "custom", value: "x" }],
      })
    );

    expect(result.statusCode).toBe(400);
    expect(result.body).toContain("Invalid request body");
  });

  it("returns 400 for invalid tag weight", async () => {
    const result = await handler(
      createPostEvent({
        type: "video",
        title: "Launch clip",
        tags: [{ facet: "campaign", value: "x", weight: "custom" }],
      })
    );

    expect(result.statusCode).toBe(400);
    expect(result.body).toContain("Invalid request body");
  });

  it("returns 400 when create references unknown container", async () => {
    stubSend(async (command) => {
      if (!(command instanceof GetCommand)) {
        throw new Error("Expected GetCommand");
      }

      return { Item: undefined };
    });

    const result = await handler(
      createPostEvent({
        type: "video",
        title: "Nested",
        containerId: "missing-container",
      })
    );

    expect(result.statusCode).toBe(400);
    expect(result.body).toContain("Invalid containerId");
  });

  it("lists assets on GET and filters invalid records", async () => {
    const { calls } = stubSend(async (command) => {
      if (!(command instanceof QueryCommand)) {
        throw new Error("Expected QueryCommand");
      }

      expect(command.input.IndexName).toBe("AssetByContainer");
      expect(
        (command.input.ExpressionAttributeValues as Record<string, unknown>)[":partitionKey"]
      ).toBe("CONTAINER#ROOT");
      expect(command.input.FilterExpression).toBe("ownerEmail = :ownerEmail");
      expect(
        (command.input.ExpressionAttributeValues as Record<string, unknown>)[":ownerEmail"]
      ).toBe("owner@example.com");

      return {
        Items: [
          {
            id: "asset-1",
            schemaVersion: 1,
            ownerEmail: "owner@example.com",
            type: "video",
            title: "Valid",
            description: "ok",
            status: "uploaded",
            original: {
              bucket: "b",
              key: "k",
              size: 1,
              contentType: "video/mp4",
            },
            tags: [],
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            stream: {
              hlsMasterUrl: "https://cdn.example.com/derived/asset-1/hls/master.m3u8",
            },
          },
          {
            id: "asset-2",
            ownerEmail: "owner@example.com",
            type: "audio",
          },
        ],
      };
    });

    const result = await handler(createGetEvent());
    expect(result.statusCode).toBe(200);
    const body = parseBody(result) as {
      assets: Array<{ id: string; stream?: { hlsMasterUrl?: string } }>;
    };
    expect(body.assets).toHaveLength(1);
    expect(body.assets[0]?.id).toBe("asset-1");
    expect(body.assets[0]?.stream?.hlsMasterUrl).toBe(
      "https://cdn.example.com/derived/asset-1/hls/master.m3u8"
    );
    expect(calls).toHaveLength(1);
  });

  it("filters assets by type and facet on GET", async () => {
    stubSend(async (command) => {
      if (!(command instanceof QueryCommand)) {
        throw new Error("Expected QueryCommand");
      }

      return {
        Items: [
          {
            id: "asset-video-1",
            schemaVersion: 1,
            ownerEmail: "owner@example.com",
            type: "video",
            title: "Campaign video",
            description: "desc",
            status: "ready",
            original: { bucket: "b", key: "k1", size: 1, contentType: "video/mp4" },
            tags: [{ facet: "campaign", value: "spring" }],
            createdAt: "2026-01-03T00:00:00.000Z",
            updatedAt: "2026-01-03T00:00:00.000Z",
          },
          {
            id: "asset-audio-1",
            schemaVersion: 1,
            ownerEmail: "owner@example.com",
            type: "audio",
            title: "Audio",
            description: "desc",
            status: "ready",
            original: { bucket: "b", key: "k2", size: 1, contentType: "audio/mpeg" },
            tags: [{ facet: "campaign", value: "spring" }],
            createdAt: "2026-01-02T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
          {
            id: "asset-video-2",
            schemaVersion: 1,
            ownerEmail: "owner@example.com",
            type: "video",
            title: "Other",
            description: "desc",
            status: "ready",
            original: { bucket: "b", key: "k3", size: 1, contentType: "video/mp4" },
            tags: [{ facet: "genre", value: "doc" }],
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ],
      };
    });

    const result = await handler(createGetEventWithQuery({ type: "video", facet: "campaign" }));
    expect(result.statusCode).toBe(200);
    const body = parseBody(result) as { assets: Array<{ id: string }> };
    expect(body.assets).toHaveLength(1);
    expect(body.assets[0]?.id).toBe("asset-video-1");
  });

  it("filters assets by origin on GET", async () => {
    stubSend(async (command) => {
      if (!(command instanceof QueryCommand)) {
        throw new Error("Expected QueryCommand");
      }

      return {
        Items: [
          {
            id: "asset-uploaded-1",
            schemaVersion: 1,
            ownerEmail: "owner@example.com",
            type: "video",
            title: "Uploaded",
            description: "desc",
            status: "ready",
            original: { bucket: "b", key: "k1", size: 1, contentType: "video/mp4" },
            tags: [],
            origin: "uploaded",
            createdAt: "2026-01-03T00:00:00.000Z",
            updatedAt: "2026-01-03T00:00:00.000Z",
          },
          {
            id: "asset-generated-1",
            schemaVersion: 1,
            ownerEmail: "owner@example.com",
            type: "video",
            title: "Generated",
            description: "desc",
            status: "ready",
            original: { bucket: "b", key: "k2", size: 1, contentType: "video/mp4" },
            tags: [],
            origin: "generated",
            generation: {
              provider: "openai",
              model: "sora-v1",
              workflowId: "wf-gen-3",
              promptHash: "hash-3",
              createdBy: "owner@example.com",
            },
            createdAt: "2026-01-02T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        ],
      };
    });

    const result = await handler(createGetEventWithQuery({ origin: "generated" }));
    expect(result.statusCode).toBe(200);
    const body = parseBody(result) as { assets: Array<{ id: string }> };
    expect(body.assets).toHaveLength(1);
    expect(body.assets[0]?.id).toBe("asset-generated-1");
  });

  it("filters assets by containerId on GET", async () => {
    stubSend(async (command) => {
      if (!(command instanceof QueryCommand)) {
        throw new Error("Expected QueryCommand");
      }

      expect(command.input.IndexName).toBe("AssetByContainer");

      return {
        Items: [
          {
            ...{
              id: "asset-child",
              schemaVersion: 1,
              ownerEmail: "owner@example.com",
              type: "video",
              title: "Child",
              description: "desc",
              status: "ready",
              original: { bucket: "b", key: "k2", size: 1, contentType: "video/mp4" },
              tags: [],
              createdAt: "2026-01-02T00:00:00.000Z",
              updatedAt: "2026-01-02T00:00:00.000Z",
              containerId: "folder-1",
              parentId: "folder-1",
              rootId: "folder-1",
              depth: 1,
            },
          },
        ],
      };
    });

    const result = await handler(createGetEventWithQuery({ containerId: "folder-1" }));

    expect(result.statusCode).toBe(200);
    const body = parseBody(result) as { assets: Array<{ id: string }> };
    expect(body.assets).toHaveLength(1);
    expect(body.assets[0]?.id).toBe("asset-child");
  });

  it("returns 400 for invalid GET query filters", async () => {
    const result = await handler(createGetEventWithQuery({ type: "document" }));

    expect(result.statusCode).toBe(400);
    expect(result.body).toContain("Invalid query parameters");
  });

  it("returns 500 when owner email claim is missing", async () => {
    const result = await handler({ requestContext: { http: { method: "POST" } }, body: "{}" });

    expect(result.statusCode).toBe(500);
    expect(result.body).toContain("Unauthorized: missing email claim");
  });

  it("returns 405 for unsupported method", async () => {
    const result = await handler({ requestContext: { http: { method: "DELETE" } } });

    expect(result.statusCode).toBe(405);
  });
});
