/// <reference types="bun-types" />

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

import { handler } from "../../lambda/mediaconvert-status";

const originalTableName = process.env.ASSETS_TABLE_NAME;
const originalDerivedBucketName = process.env.ASSETS_DERIVED_BUCKET_NAME;
const originalCloudFrontDomain = process.env.CLOUDFRONT_DOMAIN;
const originalSend = DynamoDBDocumentClient.prototype.send;

function stubSend(impl: (command: UpdateCommand) => Promise<Record<string, unknown>>) {
  const calls: UpdateCommand[] = [];

  DynamoDBDocumentClient.prototype.send = async function (command: unknown) {
    if (!(command instanceof UpdateCommand)) {
      throw new Error("Unexpected command");
    }

    calls.push(command);
    return impl(command);
  } as typeof DynamoDBDocumentClient.prototype.send;

  return { calls };
}

function hasUndefined(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }

  if (Array.isArray(value)) {
    return value.some((item) => hasUndefined(item));
  }

  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) => hasUndefined(item));
  }

  return false;
}

describe("mediaconvert-status lambda", () => {
  beforeEach(() => {
    process.env.ASSETS_TABLE_NAME = "Assets";
    process.env.ASSETS_DERIVED_BUCKET_NAME = "media-derived-test";
  });

  afterEach(() => {
    DynamoDBDocumentClient.prototype.send = originalSend;

    if (originalTableName === undefined) {
      delete process.env.ASSETS_TABLE_NAME;
    } else {
      process.env.ASSETS_TABLE_NAME = originalTableName;
    }

    if (originalDerivedBucketName === undefined) {
      delete process.env.ASSETS_DERIVED_BUCKET_NAME;
    } else {
      process.env.ASSETS_DERIVED_BUCKET_NAME = originalDerivedBucketName;
    }

    if (originalCloudFrontDomain === undefined) {
      delete process.env.CLOUDFRONT_DOMAIN;
    } else {
      process.env.CLOUDFRONT_DOMAIN = originalCloudFrontDomain;
    }
  });

  it("maps PROGRESSING to processing status", async () => {
    const { calls } = stubSend(async () => ({}));

    const result = await handler({
      source: "aws.mediaconvert",
      "detail-type": "MediaConvert Job State Change",
      detail: {
        status: "PROGRESSING",
        userMetadata: { assetId: "asset-101" },
      },
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("processing");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input.ExpressionAttributeValues?.[":status"]).toBe("processing");
    expect(calls[0]?.input.ExpressionAttributeValues?.[":conversion"]).toMatchObject({
      status: "processing",
      profile: "video-standard-v1",
    });
    expect(hasUndefined(calls[0]?.input.ExpressionAttributeValues?.[":conversion"])).toBe(false);
  });

  it("maps COMPLETE to ready and stores stream metadata", async () => {
    const { calls } = stubSend(async () => ({}));

    const result = await handler({
      source: "aws.mediaconvert",
      "detail-type": "MediaConvert Job State Change",
      detail: {
        status: "COMPLETE",
        userMetadata: { assetId: "asset-202" },
        outputGroupDetails: [
          {
            playlistFilePaths: ["s3://media-derived-test/derived/asset-202/hls/master.m3u8"],
            outputDetails: [
              {
                outputFilePaths: ["s3://media-derived-test/derived/asset-202/hls/master.m3u8"],
                videoDetails: { widthInPx: 1920, heightInPx: 1080, averageBitrate: 5000000 },
              },
              {
                outputFilePaths: ["s3://media-derived-test/derived/asset-202/thumbs/poster.jpg"],
              },
            ],
          },
        ],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("ready");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input.ExpressionAttributeValues?.[":status"]).toBe("ready");

    const stream = calls[0]?.input.ExpressionAttributeValues?.[":stream"] as {
      hlsMasterUrl?: string;
      posterUrl?: string;
      renditions?: Array<{ type: string; label: string }>;
    };
    expect(stream.hlsMasterUrl).toBe(
      "https://media-derived-test.s3.amazonaws.com/derived/asset-202/hls/master.m3u8"
    );
    expect(stream.posterUrl).toBe(
      "https://media-derived-test.s3.amazonaws.com/derived/asset-202/thumbs/poster.jpg"
    );
    expect(stream.renditions?.[0]?.type).toBe("hls");
    expect(calls[0]?.input.ExpressionAttributeValues?.[":conversion"]).toMatchObject({
      status: "ready",
      profile: "video-standard-v1",
    });
    expect(hasUndefined(calls[0]?.input.ExpressionAttributeValues?.[":conversion"])).toBe(false);
  });

  it("uses CloudFront URLs when domain is configured", async () => {
    process.env.CLOUDFRONT_DOMAIN = "d111111abcdef8.cloudfront.net";
    const { calls } = stubSend(async () => ({}));

    const result = await handler({
      source: "aws.mediaconvert",
      "detail-type": "MediaConvert Job State Change",
      detail: {
        status: "COMPLETE",
        userMetadata: { assetId: "asset-cf" },
        outputGroupDetails: [
          {
            playlistFilePaths: ["s3://media-derived-test/derived/asset-cf/hls/master.m3u8"],
            outputDetails: [
              {
                outputFilePaths: ["s3://media-derived-test/derived/asset-cf/hls/master.m3u8"],
              },
            ],
          },
        ],
      },
    });

    expect(result.ok).toBe(true);
    const stream = calls[0]?.input.ExpressionAttributeValues?.[":stream"] as {
      hlsMasterUrl?: string;
    };
    expect(stream.hlsMasterUrl).toBe(
      "https://d111111abcdef8.cloudfront.net/derived/asset-cf/hls/master.m3u8"
    );
  });

  it("prefers non-variant HLS manifest when master filename differs", async () => {
    const { calls } = stubSend(async () => ({}));

    const result = await handler({
      source: "aws.mediaconvert",
      "detail-type": "MediaConvert Job State Change",
      detail: {
        status: "COMPLETE",
        userMetadata: { assetId: "asset-nonstandard-master" },
        outputGroupDetails: [
          {
            playlistFilePaths: [
              "s3://media-derived-test/derived/asset-nonstandard-master/hls/asset-nonstandard-master.m3u8",
            ],
            outputDetails: [
              {
                outputFilePaths: [
                  "s3://media-derived-test/derived/asset-nonstandard-master/hls/asset-nonstandard-master_1080p.m3u8",
                ],
              },
              {
                outputFilePaths: [
                  "s3://media-derived-test/derived/asset-nonstandard-master/hls/asset-nonstandard-master.m3u8",
                ],
              },
              {
                outputFilePaths: [
                  "s3://media-derived-test/derived/asset-nonstandard-master/hls/asset-nonstandard-master_720p.m3u8",
                ],
              },
            ],
          },
        ],
      },
    });

    expect(result.ok).toBe(true);
    const stream = calls[0]?.input.ExpressionAttributeValues?.[":stream"] as {
      hlsMasterUrl?: string;
    };
    expect(stream.hlsMasterUrl).toBe(
      "https://media-derived-test.s3.amazonaws.com/derived/asset-nonstandard-master/hls/asset-nonstandard-master.m3u8"
    );
  });

  it("throws when COMPLETE event is missing master playlistFilePaths", async () => {
    stubSend(async () => ({}));

    await expect(
      handler({
        source: "aws.mediaconvert",
        "detail-type": "MediaConvert Job State Change",
        detail: {
          status: "COMPLETE",
          userMetadata: { assetId: "asset-missing-master" },
          outputGroupDetails: [
            {
              outputDetails: [
                {
                  outputFilePaths: [
                    "s3://media-derived-test/derived/asset-missing-master/hls/asset-missing-master_1080p.m3u8",
                  ],
                },
              ],
            },
          ],
        },
      })
    ).rejects.toThrow("Missing HLS master manifest in MediaConvert playlistFilePaths");
  });

  it("ignores events without resolvable asset id", async () => {
    const { calls } = stubSend(async () => ({}));

    const result = await handler({
      source: "aws.mediaconvert",
      "detail-type": "MediaConvert Job State Change",
      detail: {
        status: "COMPLETE",
      },
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("ignored-no-asset-id");
    expect(calls).toHaveLength(0);
  });
});
