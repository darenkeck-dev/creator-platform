/// <reference types="bun-types" />

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { BatchGetCommand, DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { handler } from "../../lambda/api-public-music";

const trackId = "00000000-0000-4000-8000-000000000001";
const badTrackId = "00000000-0000-4000-8000-000000000002";
const releaseId = "00000000-0000-4000-8000-000000000003";
const badReleaseId = "00000000-0000-4000-8000-000000000004";
const now = "2026-08-20T12:00:00.000Z";
const originalSend = DynamoDBDocumentClient.prototype.send;
const savedEnv = { ...process.env };

function track(id: string, assetId: string) {
  return {
    pk: "MUSIC",
    sk: `TRACK#${id}`,
    schemaVersion: "music-track/v1",
    id,
    revision: 1,
    ownerEmail: "owner@example.com",
    title: id === trackId ? "Available" : "Unavailable",
    assetId,
    purchaseLinks: [{ label: "Buy", url: "https://example.com/buy" }],
    publicationStatus: "published",
    standalonePublished: false,
    createdAt: now,
    updatedAt: now,
  };
}

function release(id: string, selectedTrackId: string) {
  return {
    pk: "MUSIC",
    sk: `RELEASE#${id}`,
    schemaVersion: "music-release/v1",
    id,
    revision: 1,
    ownerEmail: "owner@example.com",
    title: "Release",
    releaseDate: "2026-08-20",
    type: "single",
    coverAssetId: "cover-1",
    coverAlt: "Cover art",
    trackIds: [selectedTrackId],
    purchaseLinks: [{ label: "Buy", url: "https://example.com/release" }],
    publicationStatus: "published",
    createdAt: now,
    updatedAt: now,
  };
}

function asset(id: string, type: "audio" | "image", visibility: "public" | "private") {
  return {
    id,
    schemaVersion: 1,
    ownerEmail: "owner@example.com",
    type,
    title: id,
    description: "",
    status: "ready",
    visibility,
    original: {
      bucket: "originals",
      key: `incoming/${id}`,
      size: 1,
      contentType: type === "audio" ? "audio/mpeg" : "image/jpeg",
    },
    tags: [],
    stream: type === "audio" ? { hlsMasterUrl: `https://cdn.example.com/${id}.m3u8` } : undefined,
    createdAt: now,
    updatedAt: now,
  };
}

describe("api-public-music lambda", () => {
  beforeEach(() => {
    process.env.ASSETS_TABLE_NAME = "Assets";
    process.env.ASSETS_ORIGINALS_BUCKET_NAME = "originals";
    process.env.AWS_REGION = "us-west-2";
    process.env.AWS_ACCESS_KEY_ID = "test";
    process.env.AWS_SECRET_ACCESS_KEY = "test";
  });

  afterEach(() => {
    DynamoDBDocumentClient.prototype.send = originalSend;
    for (const name of [
      "ASSETS_TABLE_NAME",
      "ASSETS_ORIGINALS_BUCKET_NAME",
      "AWS_REGION",
      "AWS_ACCESS_KEY_ID",
      "AWS_SECRET_ACCESS_KEY",
    ]) {
      if (savedEnv[name] === undefined) delete process.env[name];
      else process.env[name] = savedEnv[name];
    }
  });

  it("resolves authoritative HLS and signed cover while omitting unavailable catalog entries", async () => {
    const calls: unknown[] = [];
    DynamoDBDocumentClient.prototype.send = async function (command: unknown) {
      calls.push(command);
      if (command instanceof QueryCommand) {
        expect(command.input.ConsistentRead).toBe(true);
        expect(command.input.Limit).toBe(200);
        return {
          Items: [
            track(trackId, "audio-1"),
            track(badTrackId, "audio-2"),
            release(releaseId, trackId),
            release(badReleaseId, badTrackId),
          ],
        };
      }
      if (command instanceof BatchGetCommand) {
        expect(command.input.RequestItems?.Assets?.ConsistentRead).toBe(true);
        return {
          Responses: {
            Assets: [
              asset("audio-1", "audio", "public"),
              asset("audio-2", "audio", "private"),
              asset("cover-1", "image", "public"),
            ],
          },
        };
      }
      return {};
    } as typeof DynamoDBDocumentClient.prototype.send;

    const result = await handler();
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.tracks).toHaveLength(1);
    expect(body.tracks[0].audioUrl).toBe("https://cdn.example.com/audio-1.m3u8");
    expect(body.releases).toHaveLength(1);
    expect(body.releases[0].coverUrl).toContain("X-Amz-Signature");
    expect(body.releases[0].coverUrl).toContain("X-Amz-Expires=900");
    expect(result.headers?.["cache-control"]).toBe("public, max-age=300");
    expect(calls.filter((call) => call instanceof BatchGetCommand)).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain("ownerEmail");
    expect(JSON.stringify(body)).not.toContain("assetId");
    expect(JSON.stringify(body)).not.toContain("publicationStatus");
  });

  it("fails closed when the bounded catalog query has more than 200 records", async () => {
    DynamoDBDocumentClient.prototype.send = async function (command: unknown) {
      if (command instanceof QueryCommand) {
        return {
          Items: Array.from({ length: 200 }, () => track(trackId, "audio-1")),
          LastEvaluatedKey: { pk: "MUSIC", sk: "TRACK#next" },
        };
      }
      throw new Error("Asset reads must not run after the record cap");
    } as typeof DynamoDBDocumentClient.prototype.send;
    const result = await handler();
    expect(result.statusCode).toBe(500);
    expect(result.body).toContain("read limit exceeded");
  });
});
