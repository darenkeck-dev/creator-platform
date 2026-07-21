/// <reference types="bun-types" />

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

import { handler } from "../../lambda/api-combos";

type HttpEvent = {
  requestContext?: {
    http?: { method?: string };
    routeKey?: string;
    authorizer?: { jwt?: { claims?: Record<string, string> } };
  };
  pathParameters?: { id?: string };
  queryStringParameters?: Record<string, string | undefined>;
  body?: string | null;
};

const originalTableName = process.env.ASSETS_TABLE_NAME;
const originalCreatedAtIndex = process.env.ASSETS_CREATED_AT_INDEX;
const originalOriginalsBucketName = process.env.ASSETS_ORIGINALS_BUCKET_NAME;
const originalSend = DynamoDBDocumentClient.prototype.send;
const originalMathRandom = Math.random;

function withOwner(event: HttpEvent): HttpEvent {
  return {
    ...event,
    requestContext: {
      ...(event.requestContext ?? {}),
      authorizer: { jwt: { claims: { email: "owner@example.com" } } },
    },
  };
}

function videoAsset(id: string) {
  return {
    id,
    schemaVersion: 1,
    ownerEmail: "owner@example.com",
    type: "video",
    title: "Video",
    description: "",
    status: "ready",
    original: { bucket: "b", key: `k/${id}`, size: 1, contentType: "video/mp4" },
    tags: [],
    origin: "uploaded",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function audioAsset(id: string) {
  return {
    ...videoAsset(id),
    type: "audio",
    original: { bucket: "b", key: `k/${id}`, size: 1, contentType: "audio/mpeg" },
  };
}

function comboItem(id: string, overrides?: Record<string, unknown>) {
  return {
    id,
    schemaVersion: 1,
    ownerEmail: "owner@example.com",
    videoAssetId: "video-1",
    audioAssetId: "audio-1",
    upvotes: 0,
    downvotes: 0,
    score: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function stubSend(
  impl: (
    command:
      | GetCommand
      | PutCommand
      | QueryCommand
      | UpdateCommand
      | DeleteCommand
      | ScanCommand
      | TransactWriteCommand
  ) => Promise<Record<string, unknown>>
) {
  DynamoDBDocumentClient.prototype.send = async function (command: unknown) {
    if (
      !(command instanceof GetCommand) &&
      !(command instanceof PutCommand) &&
      !(command instanceof QueryCommand) &&
      !(command instanceof UpdateCommand) &&
      !(command instanceof DeleteCommand) &&
      !(command instanceof ScanCommand) &&
      !(command instanceof TransactWriteCommand)
    ) {
      throw new Error("Unexpected command");
    }

    return impl(command);
  } as typeof DynamoDBDocumentClient.prototype.send;
}

describe("api-combos lambda", () => {
  beforeEach(() => {
    process.env.ASSETS_TABLE_NAME = "Assets";
    process.env.ASSETS_CREATED_AT_INDEX = "AssetByCreatedAt";
    process.env.ASSETS_ORIGINALS_BUCKET_NAME = "media-originals";
  });

  afterEach(() => {
    DynamoDBDocumentClient.prototype.send = originalSend;
    Math.random = originalMathRandom;
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

    if (originalOriginalsBucketName === undefined) {
      delete process.env.ASSETS_ORIGINALS_BUCKET_NAME;
    } else {
      process.env.ASSETS_ORIGINALS_BUCKET_NAME = originalOriginalsBucketName;
    }
  });

  it("creates combo for owner video+audio", async () => {
    stubSend(async (command) => {
      if (command instanceof GetCommand) {
        const key = command.input.Key as { pk: string };
        if (key.pk === "ASSET#video-1") {
          return { Item: videoAsset("video-1") };
        }
        if (key.pk === "ASSET#audio-1") {
          return { Item: audioAsset("audio-1") };
        }
      }

      if (command instanceof QueryCommand) {
        return { Items: [] };
      }

      if (command instanceof PutCommand) {
        const item = command.input.Item as Record<string, unknown>;
        expect(item.gsi1pk).toBe("COMBO#OWNER#owner@example.com");
        expect(item.videoAssetId).toBe("video-1");
        expect(item.audioAssetId).toBe("audio-1");
        return {};
      }

      throw new Error("Unexpected command sequence");
    });

    const result = await handler(
      withOwner({
        requestContext: { http: { method: "POST" }, routeKey: "POST /combos" },
        body: JSON.stringify({ videoAssetId: "video-1", audioAssetId: "audio-1" }),
      })
    );

    expect(result.statusCode).toBe(201);
    expect(result.body).toContain("video-1");
    expect(result.body).toContain("audio-1");
  });

  it("lists combos and resolves user vote", async () => {
    stubSend(async (command) => {
      if (command instanceof QueryCommand) {
        return { Items: [comboItem("combo-1")] };
      }

      if (command instanceof GetCommand) {
        return { Item: { value: "up" } };
      }

      throw new Error("Unexpected command sequence");
    });

    const result = await handler(
      withOwner({ requestContext: { http: { method: "GET" }, routeKey: "GET /combos" } })
    );

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('"userVote":"up"');
  });

  it("stores tone reviews for owned combos", async () => {
    stubSend(async (command) => {
      if (command instanceof GetCommand) {
        return { Item: comboItem("combo-1") };
      }

      if (command instanceof PutCommand) {
        const item = command.input.Item as Record<string, unknown>;
        expect(item.pk).toBe("TONE_REVIEW#combo#combo-1");
        expect(String(item.sk)).toStartWith("REVIEW#");
        expect(item.ownerEmail).toBeUndefined();
        expect(item.targetType).toBe("combo");
        expect(item.targetId).toBe("combo-1");
        expect(item.reviewSource).toBe("curator");
        expect(item.scores).toBeUndefined();
        expect(item.taxonomyVersion).toBe("tone-taxonomy/v2");
        expect(item.keywords).toEqual(["warm", "calm"]);
        return {};
      }

      throw new Error("Unexpected command sequence");
    });

    const result = await handler(
      withOwner({
        requestContext: { http: { method: "POST" }, routeKey: "POST /tone-reviews" },
        body: JSON.stringify({
          targetType: "combo",
          targetId: "combo-1",
          reviewSource: "curator",
          taxonomyVersion: "tone-taxonomy/v2",
          keywords: ["warm", "calm"],
          scores: { valence: 0.5 },
        }),
      })
    );

    expect(result.statusCode).toBe(201);
    expect(result.body).toContain('"targetType":"combo"');
  });

  it("materializes owned audio reviews and enforces curator provenance", async () => {
    const asset = {
      ...audioAsset("audio-1"),
      toneAnalysis: {
        status: "ready",
        profile: "openai-primary-v1",
        updatedAt: "2026-01-01T00:00:00.000Z",
        toneTaxonomyVersion: "tone-taxonomy/v2",
        scores: { valence: 0.6 },
      },
    };
    let storedReview: Record<string, unknown> | undefined;
    let adjustmentUpdate: UpdateCommand | undefined;

    stubSend(async (command) => {
      if (command instanceof GetCommand) {
        return { Item: asset };
      }
      if (command instanceof TransactWriteCommand) {
        storedReview = command.input.TransactItems?.find((item) => item.Put)?.Put?.Item as Record<
          string,
          unknown
        >;
        expect(
          command.input.TransactItems?.[0]?.ConditionCheck?.ExpressionAttributeValues
        ).toMatchObject({
          ":ready": "ready",
          ":scores": { valence: 0.6 },
          ":taxonomyVersion": "tone-taxonomy/v2",
        });
        return {};
      }
      if (command instanceof QueryCommand) {
        return { Items: storedReview ? [storedReview] : [] };
      }
      if (command instanceof UpdateCommand) {
        adjustmentUpdate = command;
        return {};
      }
      throw new Error("Unexpected command sequence");
    });

    const result = await handler(
      withOwner({
        requestContext: { http: { method: "POST" }, routeKey: "POST /tone-reviews" },
        body: JSON.stringify({
          targetType: "audio",
          targetId: "audio-1",
          reviewSource: "anonymous",
          taxonomyVersion: "tone-taxonomy/v1",
          keywords: ["calm"],
          scores: { valence: 0 },
        }),
      })
    );

    expect(result.statusCode).toBe(201);
    expect(storedReview?.reviewSource).toBe("curator");
    expect(storedReview?.taxonomyVersion).toBe("tone-taxonomy/v2");
    expect(storedReview?.scores).toEqual({ valence: 0.65, arousal: -0.75, tension: -0.7 });
    expect(adjustmentUpdate?.input.ExpressionAttributeValues?.[":adjustedScores"]).toEqual({
      valence: 0.625,
    });
  });

  it("rejects audio reviews without completed OpenAI scores", async () => {
    stubSend(async (command) => {
      if (command instanceof GetCommand) {
        return { Item: audioAsset("audio-1") };
      }
      throw new Error("Should not store a review without an OpenAI baseline");
    });

    const result = await handler(
      withOwner({
        requestContext: { http: { method: "POST" }, routeKey: "POST /tone-reviews" },
        body: JSON.stringify({
          targetType: "audio",
          targetId: "audio-1",
          keywords: ["calm"],
          scores: { valence: 0 },
        }),
      })
    );

    expect(result.statusCode).toBe(409);
  });

  it("lists combo tone reviews", async () => {
    stubSend(async (command) => {
      if (command instanceof QueryCommand) {
        expect(command.input.IndexName).toBe("AssetByCreatedAt");
        expect(command.input.ExpressionAttributeValues?.[":pk"]).toBe("TONE_REVIEW#curator");
        expect(command.input.ExpressionAttributeValues?.[":targetType"]).toBe("combo");
        return {
          Items: [
            {
              id: "tone_review_1",
              schemaVersion: 1,
              targetType: "combo",
              targetId: "combo-1",
              sourceVideoAssetId: "video-1",
              sourceAudioAssetId: "audio-1",
              reviewSource: "curator",
              keywords: ["warm"],
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        };
      }

      throw new Error("Unexpected command sequence");
    });

    const result = await handler(
      withOwner({
        requestContext: { http: { method: "GET" }, routeKey: "GET /tone-reviews" },
        queryStringParameters: { targetType: "combo", limit: "10" },
      })
    );

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('"targetId":"combo-1"');
  });

  it("lists tone reviews for a specific target", async () => {
    stubSend(async (command) => {
      if (command instanceof QueryCommand) {
        expect(command.input.IndexName).toBeUndefined();
        expect(command.input.KeyConditionExpression).toBe("pk = :pk");
        expect(command.input.ExpressionAttributeValues?.[":pk"]).toBe("TONE_REVIEW#video#video-1");
        return {
          Items: [
            {
              id: "tone_review_1",
              schemaVersion: 1,
              targetType: "video",
              targetId: "video-1",
              reviewSource: "curator",
              keywords: ["tense"],
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        };
      }

      throw new Error("Unexpected command sequence");
    });

    const result = await handler(
      withOwner({
        requestContext: { http: { method: "GET" }, routeKey: "GET /tone-reviews" },
        queryStringParameters: { targetType: "video", targetId: "video-1", limit: "10" },
      })
    );

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('"targetId":"video-1"');
  });

  it("keeps vote idempotent for repeated same action", async () => {
    stubSend(async (command) => {
      if (command instanceof GetCommand) {
        const key = command.input.Key as { sk: string };
        if (key.sk === "META") {
          return { Item: comboItem("combo-1") };
        }
        if (key.sk === "VOTE#owner@example.com") {
          return { Item: { value: "up" } };
        }
      }

      if (
        command instanceof UpdateCommand ||
        command instanceof PutCommand ||
        command instanceof DeleteCommand
      ) {
        throw new Error("Should not mutate for idempotent vote");
      }

      throw new Error("Unexpected command sequence");
    });

    const result = await handler(
      withOwner({
        requestContext: { http: { method: "POST" }, routeKey: "POST /combos/{id}/vote" },
        pathParameters: { id: "combo-1" },
        body: JSON.stringify({ action: "up" }),
      })
    );

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('"userVote":"up"');
  });

  it("applies vote transition deltas and persists new vote", async () => {
    let comboGetCount = 0;

    stubSend(async (command) => {
      if (command instanceof GetCommand) {
        const key = command.input.Key as { sk: string };
        if (key.sk === "META") {
          comboGetCount += 1;
          if (comboGetCount === 1) {
            return { Item: comboItem("combo-1", { upvotes: 1, downvotes: 0, score: 1 }) };
          }

          return { Item: comboItem("combo-1", { upvotes: 0, downvotes: 1, score: -1 }) };
        }
        if (key.sk === "VOTE#owner@example.com") {
          return { Item: { value: "up" } };
        }
      }

      if (command instanceof UpdateCommand) {
        const values = command.input.ExpressionAttributeValues as Record<string, number>;
        expect(values[":upDelta"]).toBe(-1);
        expect(values[":downDelta"]).toBe(1);
        expect(values[":scoreDelta"]).toBe(-2);
        return {};
      }

      if (command instanceof PutCommand) {
        const item = command.input.Item as Record<string, unknown>;
        expect(item.value).toBe("down");
        return {};
      }

      throw new Error("Unexpected command sequence");
    });

    const result = await handler(
      withOwner({
        requestContext: { http: { method: "POST" }, routeKey: "POST /combos/{id}/vote" },
        pathParameters: { id: "combo-1" },
        body: JSON.stringify({ action: "down" }),
      })
    );

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('"userVote":"down"');
    expect(result.body).toContain('"score":-1');
  });

  it("creates combo lazily when voting by asset pair", async () => {
    let comboMetaGets = 0;

    stubSend(async (command) => {
      if (command instanceof GetCommand) {
        const key = command.input.Key as { pk: string; sk: string };
        if (key.pk === "ASSET#video-1") {
          return { Item: videoAsset("video-1") };
        }
        if (key.pk === "ASSET#audio-1") {
          return { Item: audioAsset("audio-1") };
        }

        if (key.sk === "META" && key.pk.startsWith("COMBO#")) {
          comboMetaGets += 1;
          if (comboMetaGets === 1) {
            return {
              Item: comboItem("combo-created", {
                upvotes: 0,
                downvotes: 0,
                score: 0,
                pairKey: "owner@example.com#video:video-1#audio:audio-1",
              }),
            };
          }

          return {
            Item: comboItem("combo-created", {
              upvotes: 1,
              downvotes: 0,
              score: 1,
              pairKey: "owner@example.com#video:video-1#audio:audio-1",
            }),
          };
        }

        if (key.sk === "VOTE#owner@example.com") {
          return { Item: undefined };
        }
      }

      if (command instanceof QueryCommand) {
        return { Items: [] };
      }

      if (command instanceof PutCommand) {
        const item = command.input.Item as Record<string, unknown>;
        if (String(item.sk) === "META") {
          expect(item.pairKey).toBe("owner@example.com#video:video-1#audio:audio-1");
        }
        return {};
      }

      if (command instanceof UpdateCommand) {
        return {};
      }

      throw new Error("Unexpected command sequence");
    });

    const result = await handler(
      withOwner({
        requestContext: { http: { method: "POST" }, routeKey: "POST /combos/vote" },
        body: JSON.stringify({
          videoAssetId: "video-1",
          audioAssetId: "audio-1",
          action: "up",
        }),
      })
    );

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('"userVote":"up"');
    expect(result.body).toContain('"score":1');
  });

  it("returns random public combo from public assets", async () => {
    Math.random = () => 0;

    stubSend(async (command) => {
      if (command instanceof ScanCommand) {
        const attrs = command.input.ExpressionAttributeValues as Record<string, string>;
        if (attrs[":comboPrefix"] === "COMBO#") {
          return { Items: [] };
        }

        if (attrs[":type"] === "video") {
          return {
            Items: [
              {
                ...videoAsset("video-1"),
                visibility: "public",
                stream: { hlsMasterUrl: "https://cdn.example.com/video/master.m3u8" },
              },
            ],
          };
        }

        if (attrs[":type"] === "audio") {
          return {
            Items: [
              {
                ...audioAsset("audio-1"),
                visibility: "public",
                stream: { hlsMasterUrl: "https://cdn.example.com/audio/master.m3u8" },
              },
            ],
          };
        }
      }

      throw new Error("Unexpected command sequence");
    });

    const result = await handler({
      requestContext: { http: { method: "GET" }, routeKey: "GET /public/combos/random" },
    });

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('"source":"derived"');
    expect(result.body).toContain('"selection":"primary"');
    expect(result.body).toContain('"comboId":"public-video-1-audio-1"');
    expect(result.body).toContain('"videoSrc":"https://cdn.example.com/video/master.m3u8"');
    expect(result.body).toContain('"audioSrc":"https://cdn.example.com/audio/master.m3u8"');
  });

  it("filters out previous audio asset id for derived random combos", async () => {
    Math.random = () => 0;

    stubSend(async (command) => {
      if (command instanceof ScanCommand) {
        const attrs = command.input.ExpressionAttributeValues as Record<string, string>;
        if (attrs[":comboPrefix"] === "COMBO#") {
          return { Items: [] };
        }

        if (attrs[":type"] === "video") {
          return {
            Items: [
              {
                ...videoAsset("video-1"),
                visibility: "public",
                stream: { hlsMasterUrl: "https://cdn.example.com/video/master.m3u8" },
              },
            ],
          };
        }

        if (attrs[":type"] === "audio") {
          return {
            Items: [
              {
                ...audioAsset("audio-1"),
                visibility: "public",
                stream: { hlsMasterUrl: "https://cdn.example.com/audio/one.m3u8" },
              },
              {
                ...audioAsset("audio-2"),
                visibility: "public",
                stream: { hlsMasterUrl: "https://cdn.example.com/audio/two.m3u8" },
              },
            ],
          };
        }
      }

      throw new Error("Unexpected command sequence");
    });

    const result = await handler({
      requestContext: { http: { method: "GET" }, routeKey: "GET /public/combos/random" },
      queryStringParameters: { previousAudioAssetId: "audio-1" },
    });

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('"audioAssetId":"audio-2"');
  });

  it("filters out previous audio asset id for existing random combos", async () => {
    Math.random = () => 0.99;

    stubSend(async (command) => {
      if (command instanceof ScanCommand) {
        const attrs = command.input.ExpressionAttributeValues as Record<string, string>;
        if (attrs[":comboPrefix"] === "COMBO#") {
          return {
            Items: [
              comboItem("combo-existing-1", { videoAssetId: "video-1", audioAssetId: "audio-1" }),
              comboItem("combo-existing-2", { videoAssetId: "video-1", audioAssetId: "audio-2" }),
            ],
          };
        }

        return { Items: [] };
      }

      if (command instanceof GetCommand) {
        const key = command.input.Key as { pk: string };
        if (key.pk === "ASSET#video-1") {
          return {
            Item: {
              ...videoAsset("video-1"),
              visibility: "public",
              stream: { hlsMasterUrl: "https://cdn.example.com/video/master.m3u8" },
            },
          };
        }

        if (key.pk === "ASSET#audio-2") {
          return {
            Item: {
              ...audioAsset("audio-2"),
              visibility: "public",
              stream: { hlsMasterUrl: "https://cdn.example.com/audio/two.m3u8" },
            },
          };
        }
      }

      throw new Error("Unexpected command sequence");
    });

    const result = await handler({
      requestContext: { http: { method: "GET" }, routeKey: "GET /public/combos/random" },
      queryStringParameters: { previousAudioAssetId: "audio-1" },
    });

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('"comboId":"combo-existing-2"');
    expect(result.body).toContain('"audioAssetId":"audio-2"');
  });

  it("returns random public combo from existing combos", async () => {
    Math.random = () => 0.99;

    stubSend(async (command) => {
      if (command instanceof ScanCommand) {
        const attrs = command.input.ExpressionAttributeValues as Record<string, string>;
        if (attrs[":comboPrefix"] === "COMBO#") {
          return {
            Items: [
              comboItem("combo-existing", { videoAssetId: "video-1", audioAssetId: "audio-1" }),
            ],
          };
        }

        return { Items: [] };
      }

      if (command instanceof GetCommand) {
        const key = command.input.Key as { pk: string };
        if (key.pk === "ASSET#video-1") {
          return {
            Item: {
              ...videoAsset("video-1"),
              visibility: "public",
              stream: { hlsMasterUrl: "https://cdn.example.com/video/master.m3u8" },
            },
          };
        }

        if (key.pk === "ASSET#audio-1") {
          return {
            Item: {
              ...audioAsset("audio-1"),
              visibility: "public",
              stream: { hlsMasterUrl: "https://cdn.example.com/audio/master.m3u8" },
            },
          };
        }
      }

      throw new Error("Unexpected command sequence");
    });

    const result = await handler({
      requestContext: { http: { method: "GET" }, routeKey: "GET /public/combos/random" },
    });

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('"source":"existing"');
    expect(result.body).toContain('"selection":"primary"');
    expect(result.body).toContain('"comboId":"combo-existing"');
    expect(result.body).toContain('"videoAssetId":"video-1"');
    expect(result.body).toContain('"audioAssetId":"audio-1"');
  });

  it("falls back to existing combo when derived source has no candidates", async () => {
    Math.random = () => 0;

    stubSend(async (command) => {
      if (command instanceof ScanCommand) {
        const attrs = command.input.ExpressionAttributeValues as Record<string, string>;
        if (attrs[":type"] === "video" || attrs[":type"] === "audio") {
          return { Items: [] };
        }

        if (attrs[":comboPrefix"] === "COMBO#") {
          return {
            Items: [
              comboItem("combo-fallback", { videoAssetId: "video-1", audioAssetId: "audio-1" }),
            ],
          };
        }
      }

      if (command instanceof GetCommand) {
        const key = command.input.Key as { pk: string };
        if (key.pk === "ASSET#video-1") {
          return {
            Item: {
              ...videoAsset("video-1"),
              visibility: "public",
              stream: { hlsMasterUrl: "https://cdn.example.com/video/master.m3u8" },
            },
          };
        }

        if (key.pk === "ASSET#audio-1") {
          return {
            Item: {
              ...audioAsset("audio-1"),
              visibility: "public",
              stream: { hlsMasterUrl: "https://cdn.example.com/audio/master.m3u8" },
            },
          };
        }
      }

      throw new Error("Unexpected command sequence");
    });

    const result = await handler({
      requestContext: { http: { method: "GET" }, routeKey: "GET /public/combos/random" },
    });

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('"source":"existing"');
    expect(result.body).toContain('"selection":"fallback"');
    expect(result.body).toContain('"comboId":"combo-fallback"');
  });

  it("falls back to derived pair when existing combo source has no valid candidates", async () => {
    Math.random = () => 0.99;

    stubSend(async (command) => {
      if (command instanceof ScanCommand) {
        const attrs = command.input.ExpressionAttributeValues as Record<string, string>;
        if (attrs[":comboPrefix"] === "COMBO#") {
          return {
            Items: [
              comboItem("combo-invalid", { videoAssetId: "video-1", audioAssetId: "audio-1" }),
            ],
          };
        }

        if (attrs[":type"] === "video") {
          return {
            Items: [
              {
                ...videoAsset("video-2"),
                visibility: "public",
                stream: { hlsMasterUrl: "https://cdn.example.com/video/derived.m3u8" },
              },
            ],
          };
        }

        if (attrs[":type"] === "audio") {
          return {
            Items: [
              {
                ...audioAsset("audio-2"),
                visibility: "public",
                stream: { hlsMasterUrl: "https://cdn.example.com/audio/derived.m3u8" },
              },
            ],
          };
        }
      }

      if (command instanceof GetCommand) {
        const key = command.input.Key as { pk: string };
        if (key.pk === "ASSET#video-1") {
          return { Item: { ...videoAsset("video-1"), visibility: "private" } };
        }

        if (key.pk === "ASSET#audio-1") {
          return { Item: { ...audioAsset("audio-1"), visibility: "private" } };
        }
      }

      throw new Error("Unexpected command sequence");
    });

    const result = await handler({
      requestContext: { http: { method: "GET" }, routeKey: "GET /public/combos/random" },
    });

    expect(result.statusCode).toBe(200);
    expect(result.body).toContain('"source":"derived"');
    expect(result.body).toContain('"selection":"fallback"');
    expect(result.body).toContain('"comboId":"public-video-2-audio-2"');
  });

  it("returns 404 when neither existing nor derived sources have valid candidates", async () => {
    Math.random = () => 0;

    stubSend(async (command) => {
      if (command instanceof ScanCommand) {
        return { Items: [] };
      }

      throw new Error("Unexpected command sequence");
    });

    const result = await handler({
      requestContext: { http: { method: "GET" }, routeKey: "GET /public/combos/random" },
    });

    expect(result.statusCode).toBe(404);
    expect(result.body).toContain('"message":"No valid public combo found"');
  });
});
