/// <reference types="bun-types" />

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import {
  CreateJobCommand,
  DescribeEndpointsCommand,
  MediaConvertClient,
} from "@aws-sdk/client-mediaconvert";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

import { handler } from "../../lambda/upload-trigger";

const originalTableName = process.env.ASSETS_TABLE_NAME;
const originalOriginalsBucketName = process.env.ASSETS_ORIGINALS_BUCKET_NAME;
const originalDerivedBucketName = process.env.ASSETS_DERIVED_BUCKET_NAME;
const originalMediaConvertRole = process.env.MEDIACONVERT_ROLE_ARN;
const originalDdbSend = DynamoDBDocumentClient.prototype.send;
const originalMcSend = MediaConvertClient.prototype.send;
const originalS3Send = S3Client.prototype.send;

function stubDdbSend(
  impl: (command: GetCommand | UpdateCommand) => Promise<Record<string, unknown>>
) {
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

function stubMediaConvertSend(
  impl: (command: DescribeEndpointsCommand | CreateJobCommand) => Promise<Record<string, unknown>>
) {
  const calls: Array<DescribeEndpointsCommand | CreateJobCommand> = [];

  MediaConvertClient.prototype.send = async function (command: unknown) {
    if (!(command instanceof DescribeEndpointsCommand) && !(command instanceof CreateJobCommand)) {
      throw new Error("Unexpected MediaConvert command");
    }

    calls.push(command);
    return impl(command);
  } as typeof MediaConvertClient.prototype.send;

  return { calls };
}

function stubS3Send(impl: (command: HeadObjectCommand) => Promise<Record<string, unknown>>) {
  const calls: HeadObjectCommand[] = [];

  S3Client.prototype.send = async function (command: unknown) {
    if (!(command instanceof HeadObjectCommand)) {
      throw new Error("Unexpected S3 command");
    }

    calls.push(command);
    return impl(command);
  } as typeof S3Client.prototype.send;

  return { calls };
}

describe("upload-trigger lambda", () => {
  beforeEach(() => {
    process.env.ASSETS_TABLE_NAME = "Assets";
    process.env.ASSETS_ORIGINALS_BUCKET_NAME = "media-originals-test";
    process.env.ASSETS_DERIVED_BUCKET_NAME = "media-derived-test";
    process.env.MEDIACONVERT_ROLE_ARN = "arn:aws:iam::123456789012:role/MediaConvertServiceRole";
  });

  afterEach(() => {
    DynamoDBDocumentClient.prototype.send = originalDdbSend;
    MediaConvertClient.prototype.send = originalMcSend;
    S3Client.prototype.send = originalS3Send;

    if (originalTableName === undefined) {
      delete process.env.ASSETS_TABLE_NAME;
    } else {
      process.env.ASSETS_TABLE_NAME = originalTableName;
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

    if (originalMediaConvertRole === undefined) {
      delete process.env.MEDIACONVERT_ROLE_ARN;
    } else {
      process.env.MEDIACONVERT_ROLE_ARN = originalMediaConvertRole;
    }
  });

  it("marks video upload as processing and submits MediaConvert job", async () => {
    const ddb = stubDdbSend(async (command) => {
      if (command instanceof GetCommand) {
        return {
          Item: {
            id: "asset-123",
            type: "video",
            status: "uploaded",
            original: {
              bucket: "pending",
              key: "incoming/asset-123",
              size: 0,
              contentType: "video/mp4",
            },
            processingProfile: "video-standard-v1",
          },
        };
      }

      return {};
    });

    const mc = stubMediaConvertSend(async (command) => {
      if (command instanceof DescribeEndpointsCommand) {
        return {
          Endpoints: [{ Url: "https://abcd.mediaconvert.us-west-2.amazonaws.com" }],
        };
      }

      return { Job: { Id: "job-1" } };
    });
    const s3 = stubS3Send(async () => ({
      Metadata: {
        "video-width": "1920",
        "video-height": "1080",
      },
    }));

    const result = await handler({
      Records: [
        {
          body: JSON.stringify({
            source: "aws.s3",
            "detail-type": "Object Created",
            detail: {
              bucket: { name: "media-originals-test" },
              object: { key: "incoming/asset-123", size: 2048 },
            },
          }),
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.processed).toBe(1);
    expect(ddb.calls.some((command) => command instanceof GetCommand)).toBe(true);
    const updateCalls = ddb.calls.filter((command) => command instanceof UpdateCommand);
    expect(updateCalls.length).toBeGreaterThanOrEqual(2);
    for (const updateCall of updateCalls) {
      expect(hasUndefined(updateCall.input.ExpressionAttributeValues)).toBe(false);
    }

    const queuedCall = updateCalls[0] as UpdateCommand | undefined;
    expect(queuedCall?.input.ExpressionAttributeValues?.[":conversion"]).toMatchObject({
      status: "queued",
      profile: "video-standard-v1",
    });

    const processingCall = updateCalls[1] as UpdateCommand | undefined;
    expect(processingCall?.input.ExpressionAttributeValues?.[":conversion"]).toMatchObject({
      status: "processing",
      profile: "video-standard-v1",
      jobId: "job-1",
    });

    expect(mc.calls.some((command) => command instanceof DescribeEndpointsCommand)).toBe(true);
    expect(mc.calls.some((command) => command instanceof CreateJobCommand)).toBe(true);
    expect(s3.calls).toHaveLength(1);
    const createJobCall = mc.calls.find((command) => command instanceof CreateJobCommand) as
      | CreateJobCommand
      | undefined;
    expect(createJobCall?.input.UserMetadata).toMatchObject({
      assetId: "asset-123",
      processingProfile: "video-standard-v1",
      orientation: "landscape",
    });
    expect(
      createJobCall?.input.Settings?.OutputGroups?.[0]?.Outputs?.[0]?.VideoDescription
    ).toMatchObject({
      Width: 1920,
      Height: 1080,
    });
  });

  it("uses portrait ladder when video metadata indicates portrait", async () => {
    stubDdbSend(async (command) => {
      if (command instanceof GetCommand) {
        return {
          Item: {
            id: "asset-p1",
            type: "video",
            status: "uploaded",
            original: {
              bucket: "pending",
              key: "incoming/asset-p1",
              size: 0,
              contentType: "video/mp4",
            },
            processingProfile: "video-standard-v1",
          },
        };
      }

      return {};
    });

    const mc = stubMediaConvertSend(async (command) => {
      if (command instanceof DescribeEndpointsCommand) {
        return {
          Endpoints: [{ Url: "https://abcd.mediaconvert.us-west-2.amazonaws.com" }],
        };
      }

      return { Job: { Id: "job-portrait" } };
    });
    stubS3Send(async () => ({
      Metadata: {
        "video-width": "1080",
        "video-height": "1920",
      },
    }));

    const result = await handler({
      Records: [
        {
          body: JSON.stringify({
            source: "aws.s3",
            "detail-type": "Object Created",
            detail: {
              bucket: { name: "media-originals-test" },
              object: { key: "incoming/asset-p1", size: 1024 },
            },
          }),
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.processed).toBe(1);
    const createJobCall = mc.calls.find((command) => command instanceof CreateJobCommand) as
      | CreateJobCommand
      | undefined;
    expect(createJobCall?.input.UserMetadata).toMatchObject({
      orientation: "portrait",
    });
    expect(
      createJobCall?.input.Settings?.OutputGroups?.[0]?.Outputs?.[0]?.VideoDescription
    ).toMatchObject({
      Width: 1080,
      Height: 1920,
    });
  });

  it("marks passthrough audio asset as ready without MediaConvert", async () => {
    const ddb = stubDdbSend(async (command) => {
      if (command instanceof GetCommand) {
        return {
          Item: {
            id: "asset-a1",
            type: "audio",
            status: "uploaded",
            original: {
              bucket: "pending",
              key: "incoming/asset-a1",
              size: 0,
              contentType: "audio/mpeg",
            },
            processingProfile: "audio-passthrough-v1",
          },
        };
      }

      return {};
    });

    const mc = stubMediaConvertSend(async () => ({}));

    const result = await handler({
      Records: [
        {
          body: JSON.stringify({
            source: "aws.s3",
            "detail-type": "Object Created",
            detail: {
              bucket: { name: "media-originals-test" },
              object: { key: "incoming/asset-a1", size: 1024 },
            },
          }),
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.processed).toBe(1);
    const updateCalls = ddb.calls.filter((command) => command instanceof UpdateCommand);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]?.input.ExpressionAttributeValues?.[":conversion"]).toMatchObject({
      status: "passthrough_ready",
      profile: "audio-passthrough-v1",
    });
    expect(hasUndefined(updateCalls[0]?.input.ExpressionAttributeValues)).toBe(false);
    expect(mc.calls).toHaveLength(0);
  });

  it("submits MediaConvert for audio transcode profile", async () => {
    const ddb = stubDdbSend(async (command) => {
      if (command instanceof GetCommand) {
        return {
          Item: {
            id: "asset-a2",
            type: "audio",
            status: "uploaded",
            original: {
              bucket: "pending",
              key: "incoming/asset-a2",
              size: 0,
              contentType: "audio/mpeg",
            },
            processingProfile: "audio-transcode-hls-v1",
          },
        };
      }

      return {};
    });

    const mc = stubMediaConvertSend(async (command) => {
      if (command instanceof DescribeEndpointsCommand) {
        return {
          Endpoints: [{ Url: "https://abcd.mediaconvert.us-west-2.amazonaws.com" }],
        };
      }

      return { Job: { Id: "job-audio-1" } };
    });
    const s3 = stubS3Send(async () => ({}));

    const result = await handler({
      Records: [
        {
          body: JSON.stringify({
            source: "aws.s3",
            "detail-type": "Object Created",
            detail: {
              bucket: { name: "media-originals-test" },
              object: { key: "incoming/asset-a2", size: 1024 },
            },
          }),
        },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.processed).toBe(1);

    const updateCalls = ddb.calls.filter((command) => command instanceof UpdateCommand);
    expect(updateCalls.length).toBeGreaterThanOrEqual(2);
    expect(updateCalls[0]?.input.ExpressionAttributeValues?.[":conversion"]).toMatchObject({
      status: "queued",
      profile: "audio-transcode-hls-v1",
    });
    expect(updateCalls[1]?.input.ExpressionAttributeValues?.[":conversion"]).toMatchObject({
      status: "processing",
      profile: "audio-transcode-hls-v1",
      jobId: "job-audio-1",
    });

    expect(mc.calls.some((command) => command instanceof CreateJobCommand)).toBe(true);
    const createJobCall = mc.calls.find((command) => command instanceof CreateJobCommand) as
      | CreateJobCommand
      | undefined;
    expect(createJobCall?.input.UserMetadata).toMatchObject({
      assetId: "asset-a2",
      processingProfile: "audio-transcode-hls-v1",
    });
    expect(createJobCall?.input.UserMetadata?.orientation).toBeUndefined();
    expect(createJobCall?.input.Settings?.OutputGroups?.[0]?.Outputs?.[0]?.VideoDescription).toBe(
      undefined
    );
    expect(
      createJobCall?.input.Settings?.OutputGroups?.[0]?.Outputs?.[0]?.AudioDescriptions?.[0]
        ?.CodecSettings
    ).toMatchObject({
      Codec: "AAC",
    });
    expect(s3.calls).toHaveLength(0);
  });
});
