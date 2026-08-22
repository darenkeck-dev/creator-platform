/// <reference types="bun-types" />

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

import { handler } from "../../lambda/mediaconvert-status";

const originalTableName = process.env.ASSETS_TABLE_NAME;
const originalDerivedBucketName = process.env.ASSETS_DERIVED_BUCKET_NAME;
const originalCloudFrontDomain = process.env.CLOUDFRONT_DOMAIN;
const originalVectorSyncQueueUrl = process.env.VECTOR_SYNC_QUEUE_URL;
const originalSend = DynamoDBDocumentClient.prototype.send;
const originalSqsSend = SQSClient.prototype.send;

function stubSend(impl: (command: GetCommand | UpdateCommand) => Promise<Record<string, unknown>>) {
  const calls: Array<GetCommand | UpdateCommand> = [];

  DynamoDBDocumentClient.prototype.send = async function (command: unknown) {
    if (!(command instanceof GetCommand) && !(command instanceof UpdateCommand)) {
      throw new Error("Unexpected command");
    }

    calls.push(command);
    return impl(command);
  } as typeof DynamoDBDocumentClient.prototype.send;

  return { calls };
}

function stubSqsSend() {
  const calls: SendMessageCommand[] = [];

  SQSClient.prototype.send = async function (command: unknown) {
    if (!(command instanceof SendMessageCommand)) {
      throw new Error("Unexpected SQS command");
    }

    calls.push(command);
    return {};
  } as typeof SQSClient.prototype.send;

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
    process.env.VECTOR_SYNC_QUEUE_URL =
      "https://sqs.us-west-2.amazonaws.com/123456789012/vector-sync";
    SQSClient.prototype.send = async function () {
      return {};
    } as typeof SQSClient.prototype.send;
  });

  afterEach(() => {
    DynamoDBDocumentClient.prototype.send = originalSend;
    SQSClient.prototype.send = originalSqsSend;

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

    if (originalVectorSyncQueueUrl === undefined) {
      delete process.env.VECTOR_SYNC_QUEUE_URL;
    } else {
      process.env.VECTOR_SYNC_QUEUE_URL = originalVectorSyncQueueUrl;
    }
  });

  it("maps PROGRESSING to processing status", async () => {
    const { calls } = stubSend(async () => ({}));
    const sqs = stubSqsSend();

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
    expect(calls.filter((command) => command instanceof UpdateCommand)).toHaveLength(2);
    expect(calls[0]?.input.ExpressionAttributeValues?.[":status"]).toBe("processing");
    expect(calls[0]?.input.ExpressionAttributeValues?.[":conversion"]).toMatchObject({
      status: "processing",
      profile: "video-standard-v1",
    });
    expect(hasUndefined(calls[0]?.input.ExpressionAttributeValues?.[":conversion"])).toBe(false);
    expect(sqs.calls).toHaveLength(1);
    expect(sqs.calls[0]?.input.MessageBody).toBe('{"assetId":"asset-101"}');
  });

  it("ignores late processing events after a terminal asset update", async () => {
    let firstUpdate = true;
    const { calls } = stubSend(async (command) => {
      if (command instanceof UpdateCommand && firstUpdate) {
        firstUpdate = false;
        const error = new Error("terminal state already committed");
        error.name = "ConditionalCheckFailedException";
        throw error;
      }
      return {};
    });

    const result = await handler({
      source: "aws.mediaconvert",
      "detail-type": "MediaConvert Job State Change",
      detail: {
        status: "PROGRESSING",
        userMetadata: { assetId: "asset-terminal" },
      },
    });

    expect(result).toEqual({ ok: true, status: "ignored-stale" });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input.ConditionExpression).toContain("#status <> :readyStatus");
  });

  it("maps COMPLETE to ready and stores stream metadata", async () => {
    const { calls } = stubSend(async () => ({}));
    const sqs = stubSqsSend();

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
    expect(calls.filter((command) => command instanceof UpdateCommand)).toHaveLength(2);
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
    expect(sqs.calls).toHaveLength(1);
    expect(sqs.calls[0]?.input.MessageBody).toBe('{"assetId":"asset-202"}');
  });

  it("maps ERROR to error status and enqueues vector sync", async () => {
    const { calls } = stubSend(async () => ({}));
    const sqs = stubSqsSend();

    const result = await handler({
      source: "aws.mediaconvert",
      "detail-type": "MediaConvert Job State Change",
      detail: {
        status: "ERROR",
        errorMessage: "Transcode failed",
        userMetadata: { assetId: "asset-error" },
      },
    });

    expect(result).toEqual({ ok: true, status: "error" });
    expect(calls[0]?.input.ExpressionAttributeValues?.[":status"]).toBe("error");
    expect(sqs.calls).toHaveLength(1);
    expect(sqs.calls[0]?.input.MessageBody).toBe('{"assetId":"asset-error"}');
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

  it("stores ready stream metadata for audio-only HLS jobs", async () => {
    const { calls } = stubSend(async () => ({}));

    const result = await handler({
      source: "aws.mediaconvert",
      "detail-type": "MediaConvert Job State Change",
      detail: {
        status: "COMPLETE",
        userMetadata: {
          assetId: "asset-audio-hls",
          processingProfile: "audio-transcode-hls-v1",
        },
        outputGroupDetails: [
          {
            playlistFilePaths: ["s3://media-derived-test/derived/asset-audio-hls/hls/master.m3u8"],
            outputDetails: [
              {
                outputFilePaths: [
                  "s3://media-derived-test/derived/asset-audio-hls/hls/master.m3u8",
                ],
                audioDetails: [{ bitrate: 128000 }],
              },
            ],
          },
        ],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.status).toBe("ready");
    expect(calls.filter((command) => command instanceof UpdateCommand)).toHaveLength(2);

    const stream = calls[0]?.input.ExpressionAttributeValues?.[":stream"] as {
      hlsMasterUrl?: string;
      renditions?: Array<{ type: string; bitrateKbps?: number }>;
    };
    expect(stream.hlsMasterUrl).toBe(
      "https://media-derived-test.s3.amazonaws.com/derived/asset-audio-hls/hls/master.m3u8"
    );
    expect(stream.renditions?.[0]).toMatchObject({
      type: "hls",
      bitrateKbps: 128,
    });

    expect(calls[0]?.input.ExpressionAttributeValues?.[":conversion"]).toMatchObject({
      status: "ready",
      profile: "audio-transcode-hls-v1",
    });
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
