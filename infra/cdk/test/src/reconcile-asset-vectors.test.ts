/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";
import { ListVectorsCommand } from "@aws-sdk/client-s3vectors";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { assetToneVectorSourceFingerprint } from "@media-manager/tone-core";

import {
  classifyAsset,
  parseArgs,
  reconcileAssetVectors,
  type ReconcileOptions,
} from "../../src/reconcile-asset-vectors";

const scores = {
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
      scores,
    },
    ...overrides,
  };
}

function options(overrides: Partial<ReconcileOptions> = {}): ReconcileOptions {
  return {
    apply: false,
    force: false,
    help: false,
    stage: "test",
    tableName: "Assets-test",
    indexArn: "index-arn",
    ...overrides,
  };
}

function currentVectorSync(overrides: Record<string, unknown> = {}) {
  const item = asset(overrides);
  return {
    schemaVersion: "asset-vector-sync/v1",
    vectorSchemaVersion: "asset-tone-vector/v1",
    sourceFingerprint: assetToneVectorSourceFingerprint(item),
    status: "indexed",
  };
}

describe("asset vector reconciliation", () => {
  it("resolves stage, table, and queue arguments over environment defaults", () => {
    expect(
      parseArgs(
        [
          "--apply",
          "--force",
          "--stage=Test",
          "--table-name",
          "CustomAssets",
          "--index-arn",
          "index",
          "--queue-url",
          "queue",
        ],
        {
          APP_STAGE: "prod",
          ASSETS_TABLE_NAME: "Assets",
          VECTOR_SYNC_QUEUE_URL: "env-queue",
        }
      )
    ).toEqual({
      apply: true,
      force: true,
      help: false,
      stage: "test",
      tableName: "CustomAssets",
      indexArn: "index",
      queueUrl: "queue",
    });

    expect(parseArgs([], { APP_STAGE: "dev", ASSET_TONE_VECTOR_INDEX_ARN: "env-index" })).toEqual({
      apply: false,
      force: false,
      help: false,
      stage: "dev",
      tableName: "Assets-dev",
      indexArn: "env-index",
    });
    expect(() => parseArgs([], {})).toThrow(
      "--index-arn or ASSET_TONE_VECTOR_INDEX_ARN is required"
    );
    expect(() => parseArgs(["--apply", "--index-arn", "index"], {})).toThrow(
      "--apply requires --queue-url or VECTOR_SYNC_QUEUE_URL"
    );
  });

  it("classifies eligibility and only accepts matching persisted convergence state", () => {
    expect(classifyAsset(asset(), new Set())).toEqual({
      assetId: "audio-1",
      eligible: true,
      expectedStatus: "indexed",
      needsConvergence: true,
    });

    expect(
      classifyAsset(
        asset({
          vectorSync: currentVectorSync(),
        }),
        new Set(["audio-1"])
      )
    ).toMatchObject({ eligible: true, needsConvergence: false });

    expect(
      classifyAsset(
        asset({
          visibility: "private",
          vectorSync: currentVectorSync(),
        }),
        new Set(["audio-1"])
      )
    ).toEqual({
      assetId: "audio-1",
      eligible: false,
      expectedStatus: "deleted",
      needsConvergence: true,
    });
  });

  it.each([
    ["non-media", { type: "image" }],
    ["private", { visibility: "private" }],
    ["asset not ready", { status: "processing" }],
    ["tone not ready", { toneAnalysis: { ...asset().toneAnalysis, status: "processing" } }],
    [
      "old taxonomy",
      { toneAnalysis: { ...asset().toneAnalysis, toneTaxonomyVersion: "tone-taxonomy/v1" } },
    ],
    ["incomplete scores", { toneAnalysis: { ...asset().toneAnalysis, scores: { valence: 0 } } }],
  ])("classifies %s assets as ineligible", (_label, overrides) => {
    expect(classifyAsset(asset(overrides), new Set())).toMatchObject({
      eligible: false,
      expectedStatus: "deleted",
    });
  });

  it("applies asset schema defaults before fingerprint comparison", () => {
    const legacyAsset = asset({ visibility: undefined });
    const normalizedAsset = { ...legacyAsset, visibility: "private" };

    expect(
      classifyAsset(
        {
          ...legacyAsset,
          vectorSync: {
            schemaVersion: "asset-vector-sync/v1",
            vectorSchemaVersion: "asset-tone-vector/v1",
            sourceFingerprint: assetToneVectorSourceFingerprint(normalizedAsset),
            status: "deleted",
          },
        },
        new Set()
      )
    ).toMatchObject({ eligible: false, needsConvergence: false });
  });

  it("only reconciles malformed authoritative records when an indexed vector exists", () => {
    const malformed = { id: "invalid-asset", type: "video", status: "uploaded" };

    expect(classifyAsset(malformed, new Set())).toMatchObject({
      eligible: false,
      needsConvergence: false,
    });
    expect(classifyAsset(malformed, new Set(["invalid-asset"]))).toMatchObject({
      eligible: false,
      needsConvergence: true,
    });
  });

  it("lists all indexed keys before scanning META records and queues repairs and orphans", async () => {
    const calls: string[] = [];
    const vectorCalls: ListVectorsCommand[] = [];
    const dbCalls: ScanCommand[] = [];
    const queueCalls: SendMessageCommand[] = [];
    let page = 0;
    const summary = await reconcileAssetVectors(
      {
        vectors: {
          async send(command) {
            calls.push("vectors");
            vectorCalls.push(command as ListVectorsCommand);
            return vectorCalls.length === 1
              ? { vectors: [{ key: "audio-1" }], nextToken: "next" }
              : { vectors: [{ key: "private-1" }, { key: "orphan-1" }] };
          },
        },
        db: {
          async send(command) {
            calls.push("db");
            dbCalls.push(command as ScanCommand);
            page += 1;
            return page === 1
              ? { Items: [asset()], LastEvaluatedKey: { pk: "cursor", sk: "META" } }
              : {
                  Items: [
                    asset({
                      id: "private-1",
                      pk: "ASSET#private-1",
                      visibility: "private",
                      vectorSync: currentVectorSync({
                        id: "private-1",
                        pk: "ASSET#private-1",
                        visibility: "private",
                      }),
                    }),
                  ],
                };
          },
        },
        queue: {
          async send(command) {
            queueCalls.push(command as SendMessageCommand);
            return {};
          },
        },
      },
      options({ apply: true, queueUrl: "queue-url" })
    );

    expect(summary).toEqual({
      indexed: 3,
      scanned: 2,
      eligible: 1,
      ineligible: 1,
      current: 0,
      needsConvergence: 3,
      orphans: 1,
      queued: 3,
    });
    expect(calls).toEqual(["vectors", "vectors", "db", "db"]);
    expect(vectorCalls[0].input).toEqual({ indexArn: "index-arn", nextToken: undefined });
    expect(vectorCalls[1].input).toEqual({ indexArn: "index-arn", nextToken: "next" });
    expect(dbCalls).toHaveLength(2);
    expect(dbCalls[0].input.FilterExpression).toBe(
      "begins_with(pk, :assetPkPrefix) AND sk = :metaSk"
    );
    expect(dbCalls[1].input.ExclusiveStartKey).toEqual({ pk: "cursor", sk: "META" });
    expect(queueCalls.map((call) => call.input)).toEqual([
      { QueueUrl: "queue-url", MessageBody: '{"assetId":"audio-1"}' },
      { QueueUrl: "queue-url", MessageBody: '{"assetId":"private-1"}' },
      { QueueUrl: "queue-url", MessageBody: '{"assetId":"orphan-1"}' },
    ]);
  });

  it("uses canonical fingerprints, index presence, and force classification", () => {
    const item = asset({ vectorSync: currentVectorSync() });
    expect(classifyAsset(item, new Set(["audio-1"]))).toMatchObject({
      needsConvergence: false,
    });
    expect(classifyAsset(item, new Set())).toMatchObject({ needsConvergence: true });
    expect(classifyAsset(item, new Set(["audio-1"]), true)).toMatchObject({
      needsConvergence: true,
    });

    const titleOnlyChange = { ...item, title: "Renamed", updatedAt: "2026-08-02T00:00:00.000Z" };
    expect(classifyAsset(titleOnlyChange, new Set(["audio-1"]))).toMatchObject({
      needsConvergence: false,
    });
  });

  it("queues every authoritative asset and orphan in force apply mode", async () => {
    const privateAsset = asset({ id: "private-1", visibility: "private" });
    const queueCalls: SendMessageCommand[] = [];
    const summary = await reconcileAssetVectors(
      {
        vectors: {
          async send() {
            return { vectors: [{ key: "audio-1" }, { key: "orphan-1" }] };
          },
        },
        db: {
          async send() {
            return {
              Items: [
                asset({ vectorSync: currentVectorSync() }),
                {
                  ...privateAsset,
                  vectorSync: {
                    schemaVersion: "asset-vector-sync/v1",
                    vectorSchemaVersion: "asset-tone-vector/v1",
                    sourceFingerprint: assetToneVectorSourceFingerprint(privateAsset),
                    status: "deleted",
                  },
                },
              ],
            };
          },
        },
        queue: {
          async send(command) {
            queueCalls.push(command as SendMessageCommand);
            return {};
          },
        },
      },
      options({ apply: true, force: true, queueUrl: "queue-url" })
    );

    expect(summary).toMatchObject({
      scanned: 2,
      current: 0,
      needsConvergence: 3,
      orphans: 1,
      queued: 3,
    });
    expect(queueCalls.map((call) => call.input.MessageBody)).toEqual([
      '{"assetId":"audio-1"}',
      '{"assetId":"private-1"}',
      '{"assetId":"orphan-1"}',
    ]);
  });

  it("does not dispatch reconciliation during a dry run", async () => {
    let queueCalls = 0;
    const summary = await reconcileAssetVectors(
      {
        vectors: {
          async send() {
            return { vectors: [] };
          },
        },
        db: {
          async send() {
            return { Items: [asset()] };
          },
        },
        queue: {
          async send() {
            queueCalls += 1;
            return {};
          },
        },
      },
      options()
    );

    expect(summary.needsConvergence).toBe(1);
    expect(summary.queued).toBe(0);
    expect(queueCalls).toBe(0);
  });
});
