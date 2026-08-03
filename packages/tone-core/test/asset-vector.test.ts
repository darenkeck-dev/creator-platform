import { describe, expect, it } from "bun:test";

import {
  ASSET_TONE_VECTOR_DIMENSIONS,
  ASSET_TONE_VECTOR_SCHEMA_VERSION,
  AssetToneVectorRecordSchema,
  assetToneVectorSourceFingerprint,
  assetToneVectorValues,
  buildAssetToneVectorRecord,
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
    expect(() => AssetToneVectorRecordSchema.parse({ ...record, provider: "example" })).toThrow();
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

  it("fingerprints only vector eligibility and canonical tone source fields", () => {
    const asset = {
      id: "audio-123",
      type: "audio",
      status: "ready",
      visibility: "public",
      updatedAt: "2026-08-02T12:00:00.000Z",
      toneAnalysis: {
        status: "ready",
        updatedAt: "2026-08-02T12:00:00.000Z",
        toneTaxonomyVersion: "tone-taxonomy/v2",
        scores: {
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
        adjustedScores: { warmth: 0.6, valence: 0.4 },
      },
    };
    const fingerprint = assetToneVectorSourceFingerprint(asset);

    expect(
      assetToneVectorSourceFingerprint({
        ...asset,
        updatedAt: "2026-08-02T13:00:00.000Z",
        toneAnalysis: {
          ...asset.toneAnalysis,
          updatedAt: "2026-08-02T13:00:00.000Z",
        },
      })
    ).toBe(fingerprint);
    expect(assetToneVectorSourceFingerprint({ ...asset, visibility: "private" })).not.toBe(
      fingerprint
    );
    expect(assetToneVectorSourceFingerprint({ ...asset, status: "processing" })).not.toBe(
      fingerprint
    );
    expect(
      assetToneVectorSourceFingerprint({
        ...asset,
        toneAnalysis: { ...asset.toneAnalysis, status: "processing" },
      })
    ).not.toBe(fingerprint);
    expect(
      assetToneVectorSourceFingerprint({
        ...asset,
        toneAnalysis: {
          ...asset.toneAnalysis,
          toneTaxonomyVersion: "tone-taxonomy/v1",
        },
      })
    ).not.toBe(fingerprint);
    expect(
      assetToneVectorSourceFingerprint({
        ...asset,
        toneAnalysis: {
          ...asset.toneAnalysis,
          scores: { ...asset.toneAnalysis.scores, menace: 0.8 },
        },
      })
    ).not.toBe(fingerprint);
    expect(
      assetToneVectorSourceFingerprint({
        ...asset,
        toneAnalysis: {
          ...asset.toneAnalysis,
          adjustedScores: { valence: 0.5, warmth: 0.6 },
        },
      })
    ).not.toBe(fingerprint);
  });

  it("fingerprints scores in canonical dimension order", () => {
    const input = {
      id: "video-123",
      type: "video",
      status: "ready",
      visibility: "public",
      toneAnalysis: {
        status: "ready",
        toneTaxonomyVersion: "tone-taxonomy/v2",
        scores: {
          menace: 0.9,
          beauty: 0.7,
          nostalgia: 0.5,
          instability: 0.3,
          intimacy: 0.1,
          tension: -0.1,
          warmth: -0.3,
          dominance: -0.5,
          arousal: -0.7,
          valence: -0.9,
        },
      },
    };

    expect(assetToneVectorSourceFingerprint(input)).toBe(
      assetToneVectorSourceFingerprint({
        ...input,
        toneAnalysis: {
          ...input.toneAnalysis,
          scores: Object.fromEntries(Object.entries(input.toneAnalysis.scores).reverse()),
        },
      })
    );
  });

  it("builds a versioned provider-neutral record", () => {
    const record = buildAssetToneVectorRecord({
      assetId: "video-123",
      assetType: "video",
      modelScores: {
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
      adjustedScores: { valence: 0.4, warmth: 0.6 },
      visibility: "public",
      assetStatus: "ready",
      toneStatus: "ready",
      updatedAt: "2026-07-30T12:00:00.000Z",
    });

    expect(record).toEqual({
      assetId: "video-123",
      assetType: "video",
      effectiveTone: [0.4, -0.7, -0.5, 0.6, -0.1, 0.1, 0.3, 0.5, 0.7, 0.9],
      vectorSchemaVersion: "asset-tone-vector/v1",
      taxonomyVersion: "tone-taxonomy/v2",
      adjustmentAlgorithm: "model-prior-mean/v1",
      visibility: "public",
      assetStatus: "ready",
      toneStatus: "ready",
      updatedAt: "2026-07-30T12:00:00.000Z",
    });
  });
});
