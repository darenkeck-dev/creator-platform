/// <reference types="bun-types" />

import { afterEach, describe, expect, it } from "bun:test";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getMusicAssetLinks } from "../../lambda/shared/music-asset-links";

const originalSend = DynamoDBDocumentClient.prototype.send;

describe("music asset reverse reads", () => {
  afterEach(() => {
    DynamoDBDocumentClient.prototype.send = originalSend;
  });

  it("paginates strongly and returns every bounded link", async () => {
    const calls: QueryCommand[] = [];
    DynamoDBDocumentClient.prototype.send = async function (command: unknown) {
      const query = command as QueryCommand;
      calls.push(query);
      return calls.length === 1
        ? {
            Items: [{ sk: "MUSIC_TRACK", publicationStatus: "draft" }],
            LastEvaluatedKey: { pk: "ASSET#audio-1", sk: "MUSIC_TRACK" },
          }
        : {
            Items: [
              {
                sk: "MUSIC_RELEASE#00000000-0000-4000-8000-000000000001",
                publicationStatus: "published",
              },
            ],
          };
    } as typeof DynamoDBDocumentClient.prototype.send;

    const links = await getMusicAssetLinks({
      db: DynamoDBDocumentClient.from(new DynamoDBClient({})),
      tableName: "Assets",
      assetId: "audio-1",
    });
    expect(links).toHaveLength(2);
    expect(calls).toHaveLength(2);
    expect(calls.every((call) => call.input.ConsistentRead === true)).toBe(true);
    expect(calls[1]?.input.ExclusiveStartKey).toBeDefined();
    expect(calls[1]?.input.Limit).toBe(89);
  });
});
