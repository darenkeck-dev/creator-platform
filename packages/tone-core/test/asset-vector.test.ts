import { describe, expect, it } from "bun:test";

import {
  ASSET_TONE_VECTOR_DIMENSIONS,
  ASSET_TONE_VECTOR_SCHEMA_VERSION,
  AssetToneVectorRecordSchema,
  assetToneVectorValues,
  effectiveAssetToneVectorValues,
} from "../src/asset-vector.js";

describe("asset tone vector", () => {
  it("uses the canonical ten-dimension order", () => {
    const values = assetToneVectorValues({
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
    });

    expect(ASSET_TONE_VECTOR_DIMENSIONS).toEqual([
      "valence",
      "arousal",
      "dominance",
      "warmth",
      "tension",
      "intimacy",
      "instability",
      "nostalgia",
      "beauty",
      "menace",
    ]);
    expect(values).toEqual([-0.9, -0.7, -0.5, -0.3, -0.1, 0.1, 0.3, 0.5, 0.7, 0.9]);
  });

  it("validates index records", () => {
    const record = AssetToneVectorRecordSchema.parse({
      assetId: "audio-123",
      assetType: "audio",
      effectiveTone: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      vectorSchemaVersion: ASSET_TONE_VECTOR_SCHEMA_VERSION,
      taxonomyVersion: "tone-taxonomy/v2",
      adjustmentAlgorithm: "model-prior-mean/v1",
      visibility: "public",
      assetStatus: "ready",
      toneStatus: "ready",
      updatedAt: "2026-07-21T12:00:00.000Z",
    });

    expect(record.effectiveTone).toHaveLength(10);
    expect(() => AssetToneVectorRecordSchema.parse({ ...record, effectiveTone: [0, 0] })).toThrow();
    expect(() =>
      AssetToneVectorRecordSchema.parse({
        ...record,
        effectiveTone: [2, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      })
    ).toThrow();
  });

  it("overlays sparse curator adjustments on model scores", () => {
    const values = effectiveAssetToneVectorValues(
      {
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
      { valence: 0.4, warmth: 0.6 }
    );

    expect(values).toEqual([0.4, -0.7, -0.5, 0.6, -0.1, 0.1, 0.3, 0.5, 0.7, 0.9]);
  });
});
