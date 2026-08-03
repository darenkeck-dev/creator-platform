import { describe, expect, it } from "bun:test";

import type { AssetToneVectorRecord } from "../src/asset-vector.js";
import {
  AssetToneVectorQueryService,
  type AssetToneVectorIndex,
  type AssetToneVectorIndexQuery,
} from "../src/asset-vector-index.js";

const record: AssetToneVectorRecord = {
  assetId: "audio-123",
  assetType: "audio",
  effectiveTone: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  vectorSchemaVersion: "asset-tone-vector/v1",
  taxonomyVersion: "tone-taxonomy/v2",
  adjustmentAlgorithm: "model-prior-mean/v1",
  visibility: "public",
  assetStatus: "ready",
  toneStatus: "ready",
  updatedAt: "2026-08-02T12:00:00.000Z",
};

class MemoryAssetToneVectorIndex implements AssetToneVectorIndex {
  records = new Map<string, AssetToneVectorRecord>();
  lastQuery?: AssetToneVectorIndexQuery;

  async upsert(value: AssetToneVectorRecord): Promise<void> {
    this.records.set(value.assetId, value);
  }

  async delete(assetId: string): Promise<void> {
    this.records.delete(assetId);
  }

  async queryNearest(query: AssetToneVectorIndexQuery) {
    this.lastQuery = query;
    return [{ record, distance: 0.25 }];
  }
}

describe("asset tone vector index", () => {
  it("supports canonical record upsert and delete", async () => {
    const index = new MemoryAssetToneVectorIndex();

    await index.upsert(record);
    expect(index.records.get(record.assetId)).toBe(record);

    await index.delete(record.assetId);
    expect(index.records.has(record.assetId)).toBe(false);
  });

  it("queries with canonical dimension ordering", async () => {
    const index = new MemoryAssetToneVectorIndex();
    const service = new AssetToneVectorQueryService(index);

    const matches = await service.queryNearest({
      tone: {
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
      },
      assetType: "audio",
      limit: 5,
    });

    expect(index.lastQuery).toEqual({
      vector: [-0.9, -0.7, -0.5, -0.3, -0.1, 0.1, 0.3, 0.5, 0.7, 0.9],
      assetType: "audio",
      limit: 5,
    });
    expect(matches).toEqual([{ record, distance: 0.25 }]);
  });

  it("accepts query limits from 1 through 100", async () => {
    const index = new MemoryAssetToneVectorIndex();
    const service = new AssetToneVectorQueryService(index);
    const tone = {
      valence: 0,
      arousal: 0,
      dominance: 0,
      warmth: 0,
      tension: 0,
      intimacy: 0,
      instability: 0,
      nostalgia: 0,
      beauty: 0,
      menace: 0,
    };

    await service.queryNearest({ tone, assetType: "video", limit: 1 });
    expect(index.lastQuery?.limit).toBe(1);
    expect(index.lastQuery?.assetType).toBe("video");
    await service.queryNearest({ tone, assetType: "audio", limit: 100 });
    expect(index.lastQuery?.limit).toBe(100);
  });

  it("rejects invalid limits before querying the adapter", () => {
    const index = new MemoryAssetToneVectorIndex();
    const service = new AssetToneVectorQueryService(index);
    const tone = {
      valence: 0,
      arousal: 0,
      dominance: 0,
      warmth: 0,
      tension: 0,
      intimacy: 0,
      instability: 0,
      nostalgia: 0,
      beauty: 0,
      menace: 0,
    };

    for (const limit of [0, 1.5, 101]) {
      expect(() => service.queryNearest({ tone, assetType: "audio", limit })).toThrow();
      expect(index.lastQuery).toBeUndefined();
    }
  });
});
