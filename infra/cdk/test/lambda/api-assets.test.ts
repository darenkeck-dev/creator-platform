/// <reference types="bun-types" />

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { DynamoDBDocumentClient, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";

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
};

const originalTableName = process.env.ASSETS_TABLE_NAME;
const originalCreatedAtIndex = process.env.ASSETS_CREATED_AT_INDEX;
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
    },
  };
}

function parseBody(result: { statusCode: number; body: string }): unknown {
  return JSON.parse(result.body);
}

function stubSend(impl: (command: PutCommand | QueryCommand) => Promise<Record<string, unknown>>): {
  calls: Array<PutCommand | QueryCommand>;
} {
  const calls: Array<PutCommand | QueryCommand> = [];

  DynamoDBDocumentClient.prototype.send = async function (command: unknown) {
    if (!(command instanceof PutCommand) && !(command instanceof QueryCommand)) {
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
  });

  it("creates an asset on POST", async () => {
    const { calls } = stubSend(async (command) => {
      if (!(command instanceof PutCommand)) {
        throw new Error("Expected PutCommand");
      }

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
        tags: Array<{ facet?: string; value: string }>;
      };
    };
    expect(body.asset.title).toBe("Launch clip");
    expect(body.asset.type).toBe("video");
    expect(body.asset.status).toBe("draft");
    expect(body.asset.schemaVersion).toBe(1);
    expect(body.asset.ownerEmail).toBe("owner@example.com");
    expect(body.asset.tags).toHaveLength(1);
    expect((body.asset.tags[0] as { source?: string }).source).toBe("user");
    expect(calls).toHaveLength(1);
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

  it("lists assets on GET and filters invalid records", async () => {
    const { calls } = stubSend(async (command) => {
      if (!(command instanceof QueryCommand)) {
        throw new Error("Expected QueryCommand");
      }

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
