/// <reference types="bun-types" />

import { afterEach, describe, expect, it } from "bun:test";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { upgradeAssetItemSchemaVersion } from "../../lambda/shared/asset-record-versioning";

const originalSend = DynamoDBDocumentClient.prototype.send;

describe("asset record upgrade persistence", () => {
  afterEach(() => {
    DynamoDBDocumentClient.prototype.send = originalSend;
  });

  it("updates only schemaVersion with optimistic source conditions", async () => {
    const calls: UpdateCommand[] = [];
    DynamoDBDocumentClient.prototype.send = async function (command: unknown) {
      calls.push(command as UpdateCommand);
      return {};
    } as typeof DynamoDBDocumentClient.prototype.send;
    const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    const upgraded = await upgradeAssetItemSchemaVersion({
      db,
      tableName: "Assets",
      item: {
        pk: "ASSET#asset-1",
        sk: "META",
        updatedAt: "2026-01-01T00:00:00.000Z",
        visibility: "public",
        officialMusicLinkCount: 4,
        publishedMusicLinkCount: 2,
        officialMusicDeletionLock: true,
      },
    });

    expect(upgraded.schemaVersion).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input.UpdateExpression).toBe("SET schemaVersion = :upgradedVersion");
    expect(calls[0]?.input.ConditionExpression).toContain("attribute_not_exists(schemaVersion)");
    expect(calls[0]?.input.ConditionExpression).toContain("updatedAt = :originalUpdatedAt");
    expect(JSON.stringify(calls[0]?.input)).not.toContain("officialMusicLinkCount");
  });

  it("propagates an optimistic conflict instead of overwriting a concurrent mutation", async () => {
    DynamoDBDocumentClient.prototype.send = async function () {
      const error = new Error("stale source");
      error.name = "ConditionalCheckFailedException";
      throw error;
    } as typeof DynamoDBDocumentClient.prototype.send;
    const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
    await expect(
      upgradeAssetItemSchemaVersion({
        db,
        tableName: "Assets",
        item: {
          pk: "ASSET#asset-1",
          sk: "META",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      })
    ).rejects.toThrow("stale source");
  });
});
