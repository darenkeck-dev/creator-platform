/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";
import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

import { createHandler, type VectorSyncDependencies } from "../../lambda/vector-sync";

const completeScores = {
  valence: -0.9,
  arousal: -0.7,
  dominance: -0.5,
  warmth: -0.3,
  tension: -0.1,
  intimacy: 0.1,
  instability: 0.3,
  nostalgia: 0.5,
  beauty: 0.7,
  menace: 0.9,
};

function asset(overrides: Record<string, unknown> = {}) {
  return {
    pk: "ASSET#audio-1",
    sk: "META",
    id: "audio-1",
    schemaVersion: 1,
    ownerEmail: "owner@example.com",
    type: "audio",
    title: "Audio",
    description: "",
    status: "ready",
    visibility: "public",
    original: {
      bucket: "originals",
      key: "incoming/audio-1/original.mp3",
      size: 100,
      contentType: "audio/mpeg",
    },
    tags: [],
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T01:00:00.000Z",
    toneAnalysis: {
      status: "ready",
      profile: "openai-primary-v1",
      updatedAt: "2026-08-01T00:30:00.000Z",
      toneTaxonomyVersion: "tone-taxonomy/v2",
      scores: completeScores,
      adjustedScores: { valence: 0.4, warmth: 0.6 },
    },
    ...overrides,
  };
}

function makeHarness(items: Array<Record<string, unknown> | undefined>) {
  const dbCalls: unknown[] = [];
  const upserts: unknown[] = [];
  const deletes: string[] = [];
  let read = 0;

  const dependencies: VectorSyncDependencies = {
    tableName: "Assets-test",
    now: () => "2026-08-02T00:00:00.000Z",
    db: {
      async send(command) {
        dbCalls.push(command);
        if (command instanceof GetCommand) {
          return { Item: items[Math.min(read++, items.length - 1)] };
        }
        return {};
      },
    },
    vectorIndex: {
      async upsert(record) {
        upserts.push(record);
      },
      async delete(assetId) {
        deletes.push(assetId);
      },
    },
  };

  return { dependencies, dbCalls, upserts, deletes };
}

function event(assetId = "audio-1", messageId = "message-1") {
  return { Records: [{ messageId, body: JSON.stringify({ assetId }) }] };
}

function streamImage(item: Record<string, unknown>): Record<string, AttributeValue> {
  return Object.fromEntries(
    Object.entries(item)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, toAttributeValue(value)])
  );
}

function toAttributeValue(value: unknown): AttributeValue {
  if (typeof value === "string") return { S: value };
  if (typeof value === "number") return { N: String(value) };
  if (typeof value === "boolean") return { BOOL: value };
  if (value === null) return { NULL: true };
  if (Array.isArray(value)) return { L: value.map(toAttributeValue) };
  return { M: streamImage(value as Record<string, unknown>) };
}

function streamRecord(
  eventName: "INSERT" | "MODIFY" | "REMOVE",
  newImage?: Record<string, unknown>,
  oldImage?: Record<string, unknown>,
  pk = "ASSET#audio-1",
  sk = "META"
) {
  return {
    eventID: "stream-1",
    eventName,
    eventSource: "aws:dynamodb" as const,
    dynamodb: {
      Keys: streamImage({ pk, sk }),
      ...(newImage ? { NewImage: streamImage(newImage) } : {}),
      ...(oldImage ? { OldImage: streamImage(oldImage) } : {}),
    },
  };
}

describe("vector-sync lambda", () => {
  it("upserts one canonical vector with sparse adjustments and records current-safe state", async () => {
    const harness = makeHarness([asset()]);

    await expect(createHandler(harness.dependencies)(event())).resolves.toEqual({
      batchItemFailures: [],
    });

    expect(harness.upserts).toEqual([
      {
        assetId: "audio-1",
        assetType: "audio",
        effectiveTone: [0.4, -0.7, -0.5, 0.6, -0.1, 0.1, 0.3, 0.5, 0.7, 0.9],
        vectorSchemaVersion: "asset-tone-vector/v1",
        taxonomyVersion: "tone-taxonomy/v2",
        adjustmentAlgorithm: "model-prior-mean/v1",
        visibility: "public",
        assetStatus: "ready",
        toneStatus: "ready",
        updatedAt: "2026-08-01T01:00:00.000Z",
      },
    ]);
    expect(harness.deletes).toEqual([]);
    expect(harness.dbCalls[0]).toBeInstanceOf(GetCommand);
    expect((harness.dbCalls[0] as GetCommand).input).toMatchObject({
      TableName: "Assets-test",
      Key: { pk: "ASSET#audio-1", sk: "META" },
      ConsistentRead: true,
    });

    const update = harness.dbCalls[1] as UpdateCommand;
    expect(update).toBeInstanceOf(UpdateCommand);
    expect(update.input.ConditionExpression).toContain("updatedAt = :sourceUpdatedAt");
    expect(update.input.ConditionExpression).toContain("toneAnalysis = :toneAnalysis");
    expect(update.input.ExpressionAttributeValues?.[":vectorSync"]).toEqual({
      schemaVersion: "asset-vector-sync/v1",
      status: "indexed",
      vectorSchemaVersion: "asset-tone-vector/v1",
      sourceFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      sourceUpdatedAt: "2026-08-01T01:00:00.000Z",
      syncedAt: "2026-08-02T00:00:00.000Z",
    });
  });

  it.each([
    ["non-media", { type: "image" }],
    ["private", { visibility: "private" }],
    ["asset not ready", { status: "processing" }],
    ["tone not ready", { toneAnalysis: { ...asset().toneAnalysis, status: "processing" } }],
    [
      "taxonomy v1",
      { toneAnalysis: { ...asset().toneAnalysis, toneTaxonomyVersion: "tone-taxonomy/v1" } },
    ],
    [
      "incomplete model scores",
      { toneAnalysis: { ...asset().toneAnalysis, scores: { valence: 0.2 } } },
    ],
  ])("deletes the vector when the asset is %s", async (_label, overrides) => {
    const harness = makeHarness([asset(overrides)]);

    await expect(createHandler(harness.dependencies)(event())).resolves.toEqual({
      batchItemFailures: [],
    });

    expect(harness.upserts).toEqual([]);
    expect(harness.deletes).toEqual(["audio-1"]);
    expect(
      (harness.dbCalls[1] as UpdateCommand).input.ExpressionAttributeValues?.[":vectorSync"]
    ).toMatchObject({ status: "deleted" });
  });

  it("deletes an orphaned vector when the asset no longer exists", async () => {
    const harness = makeHarness([undefined]);

    await expect(createHandler(harness.dependencies)(event())).resolves.toEqual({
      batchItemFailures: [],
    });

    expect(harness.deletes).toEqual(["audio-1"]);
    expect(harness.dbCalls).toHaveLength(1);
  });

  it("converges a stream record when a vector source field changes", async () => {
    const current = asset({ visibility: "public" });
    const harness = makeHarness([current]);

    await expect(
      createHandler(harness.dependencies)({
        Records: [streamRecord("MODIFY", current, asset({ visibility: "private" }))],
      })
    ).resolves.toBeUndefined();

    expect(harness.upserts).toHaveLength(1);
    expect(harness.dbCalls).toHaveLength(2);
  });

  it("converges a stream removal to delete an orphaned vector", async () => {
    const harness = makeHarness([undefined]);

    await createHandler(harness.dependencies)({ Records: [streamRecord("REMOVE")] });

    expect(harness.deletes).toEqual(["audio-1"]);
    expect(harness.dbCalls).toHaveLength(1);
  });

  it("ignores non-asset stream records", async () => {
    const harness = makeHarness([asset()]);

    await createHandler(harness.dependencies)({
      Records: [streamRecord("INSERT", asset(), undefined, "JOB#job-1")],
    });

    expect(harness.dbCalls).toEqual([]);
    expect(harness.upserts).toEqual([]);
    expect(harness.deletes).toEqual([]);
  });

  it.each([
    [
      "vectorSync-only",
      {
        vectorSync: {
          schemaVersion: "asset-vector-sync/v1",
          status: "indexed",
          vectorSchemaVersion: "asset-tone-vector/v1",
          sourceFingerprint: "a".repeat(64),
          sourceUpdatedAt: "2026-08-01T01:00:00.000Z",
          syncedAt: "2026-08-02T00:00:00.000Z",
        },
      },
    ],
    ["unrelated metadata", { title: "Renamed", auditLog: [] }],
  ])("ignores a stream %s mutation", async (_label, changes) => {
    const harness = makeHarness([asset()]);

    await createHandler(harness.dependencies)({
      Records: [streamRecord("MODIFY", asset(changes), asset())],
    });

    expect(harness.dbCalls).toEqual([]);
    expect(harness.upserts).toEqual([]);
    expect(harness.deletes).toEqual([]);
  });

  it("returns only failed SQS records for partial batch retry", async () => {
    const harness = makeHarness([asset()]);

    const result = await createHandler(harness.dependencies)({
      Records: [
        { messageId: "bad", body: "not-json" },
        { messageId: "good", body: JSON.stringify({ assetId: "audio-1" }) },
      ],
    });

    expect(result).toEqual({ batchItemFailures: [{ itemIdentifier: "bad" }] });
    expect(harness.upserts).toHaveLength(1);
  });

  it("rereads and converges when the asset changes before the state update", async () => {
    const upserts: unknown[] = [];
    const deletes: string[] = [];
    let reads = 0;
    let updates = 0;
    const dependencies: VectorSyncDependencies = {
      tableName: "Assets-test",
      now: () => "2026-08-02T00:00:00.000Z",
      db: {
        async send(command) {
          if (command instanceof GetCommand) {
            reads += 1;
            return { Item: reads === 1 ? asset() : asset({ visibility: "private" }) };
          }
          if (command instanceof UpdateCommand && updates++ === 0) {
            const error = new Error("Asset changed");
            error.name = "ConditionalCheckFailedException";
            throw error;
          }
          return {};
        },
      },
      vectorIndex: {
        async upsert(record) {
          upserts.push(record);
        },
        async delete(assetId) {
          deletes.push(assetId);
        },
      },
    };

    await expect(createHandler(dependencies)(event())).resolves.toEqual({ batchItemFailures: [] });

    expect(reads).toBe(2);
    expect(upserts).toHaveLength(1);
    expect(deletes).toEqual(["audio-1"]);
  });
});
