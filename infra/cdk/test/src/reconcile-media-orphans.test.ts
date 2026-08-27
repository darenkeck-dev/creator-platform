/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";
import { DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";

import {
  classifyInventory,
  parseArgs,
  parseDerivedAssetId,
  parseOriginalAssetId,
  reconcileMediaOrphans,
  type ReconcileMediaOrphansOptions,
  type StoredObject,
} from "../../src/reconcile-media-orphans";

const account = "123456789012";
const assetId = "11111111-1111-4111-8111-111111111111";
const orphanId = "22222222-2222-4222-8222-222222222222";
const trackId = "33333333-3333-4333-8333-333333333333";
const releaseId = "44444444-4444-4444-8444-444444444444";
const missingId = "55555555-5555-4555-8555-555555555555";
const invalidId = "66666666-6666-4666-8666-666666666666";
const now = new Date("2026-08-20T00:00:00.000Z");
const old = new Date("2026-08-01T00:00:00.000Z");

function options(overrides: Partial<ReconcileMediaOrphansOptions> = {}) {
  return {
    apply: false,
    confirmProduction: false,
    help: false,
    stage: "test",
    tableName: "Assets-test",
    originalsBucketName: "media-originals-test",
    derivedBucketName: "media-derived-test",
    olderThanDays: 7,
    ...overrides,
  } satisfies ReconcileMediaOrphansOptions;
}

function asset(overrides: Record<string, unknown> = {}) {
  return {
    pk: `ASSET#${assetId}`,
    sk: "META",
    id: assetId,
    schemaVersion: 1,
    ownerEmail: "owner@example.com",
    type: "audio",
    title: "Audio",
    description: "",
    status: "ready",
    visibility: "private",
    libraryVisibility: "listed",
    original: {
      bucket: "pending",
      key: `incoming/${assetId}/master.wav`,
      size: 10,
      contentType: "audio/wav",
    },
    tags: [],
    stream: { hlsMasterUrl: `https://media.example/derived/${assetId}/hls/master.m3u8` },
    createdAt: old.toISOString(),
    updatedAt: old.toISOString(),
    ...overrides,
  };
}

function stored(key: string, overrides: Partial<StoredObject> = {}): StoredObject {
  return { key, lastModified: old, etag: `"${key}"`, size: 10, ...overrides };
}

function tableDescription() {
  return { Table: { TableArn: `arn:aws:dynamodb:us-west-2:${account}:table/Assets-test` } };
}

describe("media orphan reconciliation", () => {
  it("defaults to dry run and guards apply resources and production", () => {
    expect(parseArgs([], {})).toMatchObject({
      apply: false,
      stage: "prod",
      tableName: "Assets",
      originalsBucketName: "media-originals-prod",
      derivedBucketName: "media-derived-prod",
      olderThanDays: 7,
    });
    expect(() => parseArgs(["--stage", "test", "--apply"], {})).toThrow("--expected-account");
    expect(() => parseArgs(["--apply", "--expected-account", account], {})).toThrow(
      "--confirm-production"
    );
    expect(() =>
      parseArgs(
        ["--stage", "test", "--apply", "--expected-account", account, "--table-name", "Other"],
        {}
      )
    ).toThrow("exactly match stage test");
    expect(
      parseArgs(["--stage", "test", "--apply", "--expected-account", account], {})
    ).toMatchObject({ apply: true, expectedAccount: account });
  });

  it("classifies exact-key storage drift and related metadata without deleting ambiguous keys", () => {
    const records = [
      asset(),
      { pk: `ASSET#${invalidId}`, sk: "META", id: invalidId },
      {
        pk: "MUSIC",
        sk: `TRACK#${trackId}`,
        schemaVersion: "music-track/v1",
        id: trackId,
        revision: 1,
        ownerEmail: "owner@example.com",
        title: "Missing asset",
        assetId: missingId,
        purchaseLinks: [],
        publicationStatus: "draft",
        standalonePublished: false,
        createdAt: old.toISOString(),
        updatedAt: old.toISOString(),
      },
      {
        pk: "MUSIC",
        sk: `RELEASE#${releaseId}`,
        schemaVersion: "music-release/v1",
        id: releaseId,
        revision: 1,
        ownerEmail: "owner@example.com",
        title: "Release",
        coverAssetId: missingId,
        trackIds: [missingId],
        purchaseLinks: [],
        publicationStatus: "draft",
        createdAt: old.toISOString(),
        updatedAt: old.toISOString(),
      },
    ];
    const inventory = classifyInventory(
      records,
      [
        stored(`incoming/${assetId}/master.wav`),
        stored(`incoming/${assetId}/old.wav`),
        stored(`incoming/${invalidId}/file.wav`),
        stored("incoming/not-a-uuid/file.wav"),
        stored(`incoming/${orphanId}`, { lastModified: now }),
        { key: `incoming/${missingId}/file.wav`, lastModified: old },
      ],
      [
        stored(`derived/${orphanId}/hls/segment.ts`),
        stored(`derived/${assetId}/hls/segment.ts`),
        stored("derived/unknown/file"),
      ],
      options(),
      now
    );

    expect(inventory.authoritativeAssets).toBe(2);
    expect(inventory.invalidAssetRecords).toHaveLength(1);
    expect(inventory.orphanOriginalObjects.map((object) => object.key)).toEqual([
      `incoming/${assetId}/old.wav`,
      `incoming/${orphanId}`,
      `incoming/${missingId}/file.wav`,
    ]);
    expect(inventory.orphanOriginalObjects.map((object) => object.eligibleForDeletion)).toEqual([
      true,
      false,
      false,
    ]);
    expect(inventory.orphanDerivedObjects.map((object) => object.key)).toEqual([
      `derived/${orphanId}/hls/segment.ts`,
    ]);
    expect(inventory.ambiguousOriginalKeys).toEqual([
      `incoming/${invalidId}/file.wav`,
      "incoming/not-a-uuid/file.wav",
    ]);
    expect(inventory.ambiguousDerivedKeys).toEqual(["derived/unknown/file"]);
    expect(inventory.missingDerivedObjects).toEqual([
      { assetId, key: `derived/${assetId}/hls/master.m3u8` },
    ]);
    expect(inventory.danglingMetadata.map((finding) => finding.type)).toEqual([
      "track_asset",
      "release_cover",
      "release_track",
    ]);
    expect(parseOriginalAssetId(`incoming/${assetId}/master.wav`)).toBe(assetId);
    expect(parseDerivedAssetId(`derived/${assetId}/hls/master.m3u8`)).toBe(assetId);
  });

  it("paginates DynamoDB and both S3 bucket listings", async () => {
    let scanPages = 0;
    const bucketPages = new Map<string, number>();
    const summary = await reconcileMediaOrphans(
      {
        dynamo: {
          async send(command: unknown) {
            expect(command).toBeInstanceOf(DescribeTableCommand);
            return tableDescription();
          },
        },
        db: {
          async send(command: unknown) {
            expect(command).toBeInstanceOf(ScanCommand);
            scanPages += 1;
            return scanPages === 1
              ? { Items: [asset()], LastEvaluatedKey: { pk: "next", sk: "next" } }
              : { Items: [] };
          },
        },
        s3: {
          async send(command: unknown) {
            expect(command).toBeInstanceOf(ListObjectsV2Command);
            const bucket = (command as ListObjectsV2Command).input.Bucket as string;
            const page = (bucketPages.get(bucket) ?? 0) + 1;
            bucketPages.set(bucket, page);
            return page === 1 ? { Contents: [], NextContinuationToken: "next" } : { Contents: [] };
          },
        },
      },
      options(),
      now
    );

    expect(summary.scannedRecords).toBe(1);
    expect(scanPages).toBe(2);
    expect(bucketPages).toEqual(
      new Map([
        ["media-originals-test", 2],
        ["media-derived-test", 2],
      ])
    );
  });

  it("applies only metadata-identical S3 findings after a second inventory", async () => {
    const originalKey = `incoming/${releaseId}/master.wav`;
    const derivedKey = `derived/${orphanId}/hls/segment.ts`;
    const replacedDerivedKey = `derived/${missingId}/hls/segment.ts`;
    const deleteCommands: DeleteObjectCommand[] = [];
    const listCalls = new Map<string, number>();
    const summary = await reconcileMediaOrphans(
      {
        dynamo: {
          async send() {
            return tableDescription();
          },
        },
        db: {
          async send(command: unknown) {
            if (command instanceof ScanCommand) return { Items: [] };
            if (command instanceof GetCommand) {
              return command.input.Key?.pk === `ASSET#${releaseId}`
                ? {
                    Item: asset({
                      id: releaseId,
                      original: {
                        bucket: "pending",
                        key: originalKey,
                        size: 10,
                        contentType: "audio/wav",
                      },
                    }),
                  }
                : {};
            }
            throw new Error("Unexpected DynamoDB command");
          },
        },
        s3: {
          async send(command: unknown) {
            if (command instanceof ListObjectsV2Command) {
              const bucket = command.input.Bucket as string;
              const call = (listCalls.get(bucket) ?? 0) + 1;
              listCalls.set(bucket, call);
              if (bucket === "media-originals-test") {
                return {
                  Contents: [
                    {
                      Key: originalKey,
                      LastModified: old,
                      ETag: '"original"',
                      Size: 10,
                    },
                  ],
                };
              }
              return {
                Contents: [
                  { Key: derivedKey, LastModified: old, ETag: '"derived"', Size: 10 },
                  {
                    Key: replacedDerivedKey,
                    LastModified: old,
                    ETag: '"replaced"',
                    Size: 10,
                  },
                ],
              };
            }
            if (command instanceof DeleteObjectCommand) {
              deleteCommands.push(command);
              if (command.input.Key === replacedDerivedKey) {
                const error = new Error("Object changed");
                Object.assign(error, { $metadata: { httpStatusCode: 412 } });
                throw error;
              }
              return {};
            }
            throw new Error("Unexpected S3 command");
          },
        },
      },
      options({ apply: true, expectedAccount: account }),
      now
    );

    expect(summary.actions).toEqual({
      originalObjectsDeleted: 0,
      derivedObjectsDeleted: 1,
      skippedAfterSafetyRecheck: 2,
    });
    expect(deleteCommands).toHaveLength(2);
    expect(deleteCommands[0].input).toMatchObject({
      Bucket: "media-derived-test",
      ExpectedBucketOwner: account,
      Key: derivedKey,
      IfMatch: '"derived"',
    });
  });

  it("rechecks apply guards for programmatic callers", async () => {
    const dependencies = {
      dynamo: {
        async send() {
          return tableDescription();
        },
      },
      db: {
        async send() {
          return { Items: [] };
        },
      },
      s3: {
        async send() {
          return { Contents: [] };
        },
      },
    };
    await expect(
      reconcileMediaOrphans(dependencies, options({ apply: true }), now)
    ).rejects.toThrow("--expected-account");
    await expect(
      reconcileMediaOrphans(
        dependencies,
        options({ apply: true, expectedAccount: account, tableName: "Other" }),
        now
      )
    ).rejects.toThrow("exactly match stage test");
  });

  it("checks the table account before scanning or deleting", async () => {
    let dataCalls = 0;
    await expect(
      reconcileMediaOrphans(
        {
          dynamo: {
            async send() {
              return {
                Table: { TableArn: "arn:aws:dynamodb:us-west-2:999999999999:table/Assets-test" },
              };
            },
          },
          db: {
            async send() {
              dataCalls += 1;
            },
          },
          s3: {
            async send() {
              dataCalls += 1;
            },
          },
        },
        options({ apply: true, expectedAccount: account }),
        now
      )
    ).rejects.toThrow("AWS account mismatch");
    expect(dataCalls).toBe(0);
  });
});
