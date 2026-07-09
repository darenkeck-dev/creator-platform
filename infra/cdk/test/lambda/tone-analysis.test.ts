/// <reference types="bun-types" />

import { afterEach, describe, expect, it } from "bun:test";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

import { handler } from "../../lambda/tone-analysis";

const originalTableName = process.env.ASSETS_TABLE_NAME;
const originalOriginalsBucketName = process.env.ASSETS_ORIGINALS_BUCKET_NAME;
const originalDerivedBucketName = process.env.ASSETS_DERIVED_BUCKET_NAME;
const originalOpenAiParameterName = process.env.OPENAI_API_KEY_PARAMETER_NAME;
const originalDdbSend = DynamoDBDocumentClient.prototype.send;

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function makeObjectCreatedRecord(assetId: string) {
  return {
    body: JSON.stringify({
      source: "aws.s3",
      "detail-type": "Object Created",
      detail: {
        bucket: { name: "media-originals-test" },
        object: { key: `incoming/${assetId}/original.jpg` },
      },
    }),
  };
}

describe("tone-analysis lambda", () => {
  afterEach(() => {
    restoreEnv("ASSETS_TABLE_NAME", originalTableName);
    restoreEnv("ASSETS_ORIGINALS_BUCKET_NAME", originalOriginalsBucketName);
    restoreEnv("ASSETS_DERIVED_BUCKET_NAME", originalDerivedBucketName);
    restoreEnv("OPENAI_API_KEY_PARAMETER_NAME", originalOpenAiParameterName);
    DynamoDBDocumentClient.prototype.send = originalDdbSend;
  });

  it("uses the asset table composite key when reading and updating tone state", async () => {
    process.env.ASSETS_TABLE_NAME = "Assets-test";
    process.env.ASSETS_ORIGINALS_BUCKET_NAME = "media-originals-test";
    process.env.ASSETS_DERIVED_BUCKET_NAME = "media-derived-test";
    process.env.OPENAI_API_KEY_PARAMETER_NAME = "/media-manager/test/openai-api-key";

    const calls: Array<GetCommand | UpdateCommand> = [];
    DynamoDBDocumentClient.prototype.send = async function (command: unknown) {
      if (!(command instanceof GetCommand) && !(command instanceof UpdateCommand)) {
        throw new Error("Unexpected command");
      }

      calls.push(command);
      if (command instanceof GetCommand) {
        return {
          Item: {
            pk: "ASSET#asset-image-1",
            sk: "META",
            id: "asset-image-1",
            schemaVersion: 1,
            type: "image",
            title: "Image asset",
            original: {
              bucket: "media-originals-test",
              key: "incoming/asset-image-1/original.jpg",
              size: 1024,
              contentType: "image/jpeg",
            },
          },
        };
      }

      return {};
    } as typeof DynamoDBDocumentClient.prototype.send;

    await expect(handler({ Records: [makeObjectCreatedRecord("asset-image-1")] })).resolves.toEqual(
      {
        ok: true,
        processed: 1,
      }
    );

    expect(calls[0]?.input).toMatchObject({
      TableName: "Assets-test",
      Key: { pk: "ASSET#asset-image-1", sk: "META" },
    });
    const toneUpdate = calls.find(
      (command) =>
        command instanceof UpdateCommand &&
        command.input.ExpressionAttributeValues?.[":toneAnalysis"]
    );
    expect(toneUpdate?.input).toMatchObject({
      TableName: "Assets-test",
      Key: { pk: "ASSET#asset-image-1", sk: "META" },
      ConditionExpression: "attribute_exists(pk) AND attribute_exists(sk)",
    });
  });
});
