import { describe, expect, it } from "bun:test";

import { AssetRecordSchema, AssetVectorSyncStateSchema } from "../src/index.js";

const indexedState = {
  schemaVersion: "asset-vector-sync/v1",
  status: "indexed",
  vectorSchemaVersion: "asset-tone-vector/v1",
  sourceFingerprint: "a".repeat(64),
  sourceUpdatedAt: "2026-08-01T01:00:00.000Z",
  syncedAt: "2026-08-02T00:00:00.000Z",
} as const;

describe("asset vector sync state", () => {
  it.each(["indexed", "deleted"] as const)("accepts the worker %s state", (status) => {
    expect(AssetVectorSyncStateSchema.parse({ ...indexedState, status })).toEqual({
      ...indexedState,
      status,
    });
  });

  it.each([
    ["schema version", { schemaVersion: "asset-vector-sync/v2" }],
    ["status", { status: "failed" }],
    ["vector schema version", { vectorSchemaVersion: "provider-vector/v1" }],
    ["source fingerprint", { sourceFingerprint: "not-a-sha256" }],
    ["source datetime", { sourceUpdatedAt: "2026-08-01" }],
    ["sync datetime", { syncedAt: "not-a-date" }],
    ["provider field", { provider: "s3-vectors" }],
  ])("rejects an invalid %s", (_label, override) => {
    expect(AssetVectorSyncStateSchema.safeParse({ ...indexedState, ...override }).success).toBe(
      false
    );
  });

  it("accepts vector sync state on an asset record and keeps it optional", () => {
    const asset = {
      id: "audio-1",
      schemaVersion: 1,
      ownerEmail: "owner@example.com",
      type: "audio",
      title: "Audio",
      description: "",
      status: "ready",
      visibility: "public",
      original: {
        bucket: "media-originals-test",
        key: "incoming/audio-1.mp3",
        size: 1024,
        contentType: "audio/mpeg",
      },
      tags: [],
      createdAt: "2026-08-01T00:00:00.000Z",
      updatedAt: "2026-08-01T01:00:00.000Z",
    };

    expect(AssetRecordSchema.parse({ ...asset, vectorSync: indexedState }).vectorSync).toEqual(
      indexedState
    );
    expect(AssetRecordSchema.parse(asset).vectorSync).toBeUndefined();
  });
});
