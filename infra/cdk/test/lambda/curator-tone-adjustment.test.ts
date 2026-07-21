/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

import { materializeCuratorToneAdjustment } from "../../lambda/shared/curator-tone-adjustment";

describe("curator tone adjustment materializer", () => {
  it("paginates and materializes matching curator reviews without replacing model scores", async () => {
    const updates: UpdateCommand[] = [];
    let queryCount = 0;
    const db = {
      send: async (command: unknown) => {
        if (command instanceof GetCommand) {
          return {
            Item: {
              id: "audio-1",
              type: "audio",
              toneAnalysis: {
                toneTaxonomyVersion: "tone-taxonomy/v2",
                scores: { valence: 0.6, warmth: -0.3 },
              },
            },
          };
        }
        if (command instanceof QueryCommand) {
          queryCount += 1;
          return queryCount === 1
            ? {
                Items: [review("review-1", { valence: 0, warmth: 0.3 })],
                LastEvaluatedKey: { pk: "next" },
              }
            : {
                Items: [
                  review("review-2", { valence: -0.3, warmth: 0.6 }),
                  review("review-ignored", { valence: -1 }, { reviewSource: "anonymous" }),
                ],
              };
        }
        if (command instanceof UpdateCommand) {
          updates.push(command);
          return {};
        }
        throw new Error("Unexpected command");
      },
    } as unknown as DynamoDBDocumentClient;

    const result = await materializeCuratorToneAdjustment({
      db,
      tableName: "Assets",
      assetId: "audio-1",
    });

    expect(queryCount).toBe(2);
    expect(result.adjustedScores).toEqual({ valence: 0.1, warmth: 0.2 });
    expect(updates).toHaveLength(1);
    expect(updates[0]?.input.UpdateExpression).not.toContain("toneAnalysis =");
    expect(updates[0]?.input.ExpressionAttributeValues?.[":scoreAdjustment"]).toMatchObject({
      curatorReviewCount: 2,
      latestReviewAt: "2026-07-10T00:00:02.000Z",
    });
  });

  it("removes stale adjusted fields when there are no matching reviews", async () => {
    let update: UpdateCommand | undefined;
    const db = {
      send: async (command: unknown) => {
        if (command instanceof GetCommand) {
          return {
            Item: {
              id: "video-1",
              type: "video",
              toneAnalysis: {
                toneTaxonomyVersion: "tone-taxonomy/v2",
                scores: { menace: 0.4 },
              },
            },
          };
        }
        if (command instanceof QueryCommand) {
          return { Items: [] };
        }
        if (command instanceof UpdateCommand) {
          update = command;
          return {};
        }
        throw new Error("Unexpected command");
      },
    } as unknown as DynamoDBDocumentClient;

    expect(
      await materializeCuratorToneAdjustment({ db, tableName: "Assets", assetId: "video-1" })
    ).toEqual({});
    expect(update?.input.UpdateExpression).toBe(
      "REMOVE toneAnalysis.adjustedScores, toneAnalysis.scoreAdjustment"
    );
  });

  it("retries when another materializer updates the asset concurrently", async () => {
    let updateAttempts = 0;
    const db = {
      send: async (command: unknown) => {
        if (command instanceof GetCommand) {
          return {
            Item: {
              id: "audio-1",
              type: "audio",
              toneAnalysis: {
                toneTaxonomyVersion: "tone-taxonomy/v2",
                scores: { valence: 0.6 },
              },
            },
          };
        }
        if (command instanceof QueryCommand) {
          expect(command.input.ConsistentRead).toBe(true);
          return { Items: [review("review-1", { valence: 0 })] };
        }
        if (command instanceof UpdateCommand) {
          updateAttempts += 1;
          if (updateAttempts === 1) {
            throw new ConditionalCheckFailedException({
              $metadata: {},
              message: "concurrent update",
            });
          }
          return {};
        }
        throw new Error("Unexpected command");
      },
    } as unknown as DynamoDBDocumentClient;

    const result = await materializeCuratorToneAdjustment({
      db,
      tableName: "Assets",
      assetId: "audio-1",
    });

    expect(updateAttempts).toBe(2);
    expect(result.adjustedScores).toEqual({ valence: 0.3 });
  });
});

function review(
  id: string,
  scores: Record<string, number>,
  overrides: Record<string, unknown> = {}
) {
  const sequence = id === "review-1" ? "1" : "2";
  return {
    id,
    schemaVersion: 1,
    targetType: "audio",
    targetId: "audio-1",
    reviewSource: "curator",
    taxonomyVersion: "tone-taxonomy/v2",
    keywords: [],
    scores,
    createdAt: `2026-07-10T00:00:0${sequence}.000Z`,
    updatedAt: `2026-07-10T00:00:0${sequence}.000Z`,
    ...overrides,
  };
}
