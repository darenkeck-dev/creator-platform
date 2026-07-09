/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";

import {
  buildComboAnalysis,
  comboNearestNeighborVector,
  computeComboFeatures,
} from "../src/combo.js";
import { emptyToneVector } from "../src/tone-vector.js";

describe("combo scoring", () => {
  it("builds weighted nearest-neighbor vectors", () => {
    const audioTone = { ...emptyToneVector(), valence: 0.5, tension: -0.5 };
    const videoTone = { ...emptyToneVector(), valence: 0.25, tension: 0.5 };
    const features = computeComboFeatures(audioTone, videoTone);

    expect(features.deltaTone.valence).toBe(-0.25);
    expect(features.absDeltaTone.tension).toBe(1);
    expect(comboNearestNeighborVector(features)).toHaveLength(50);
  });

  it("creates combo-analysis rows from asset-analysis rows", () => {
    const audioTone = { ...emptyToneVector(), valence: 0.5 };
    const videoTone = { ...emptyToneVector(), valence: 0.5 };
    const createdAt = "2026-07-07T00:00:00.000Z";
    const row = buildComboAnalysis({
      comboId: "combo-1",
      createdAt,
      audioAnalysis: {
        schemaVersion: "asset-analysis/v1",
        assetId: "audio-1",
        assetType: "audio",
        source: { kind: "file", path: "audio.mp3" },
        toneTaxonomyVersion: "tone-taxonomy/v1",
        tone: {
          value: audioTone,
          words: { summary: "A tone.", primary: [], secondary: [], avoid: [] },
          contributors: ["test"],
          taxonomyVersion: "tone-taxonomy/v1",
        },
        modelRuns: [],
        createdAt,
      },
      videoAnalysis: {
        schemaVersion: "asset-analysis/v1",
        assetId: "video-1",
        assetType: "video",
        source: { kind: "file", path: "video.mp4" },
        toneTaxonomyVersion: "tone-taxonomy/v1",
        tone: {
          value: videoTone,
          words: { summary: "A tone.", primary: [], secondary: [], avoid: [] },
          contributors: ["test"],
          taxonomyVersion: "tone-taxonomy/v1",
        },
        modelRuns: [],
        createdAt,
      },
    });

    expect(row.schemaVersion).toBe("combo-analysis/v1");
    expect(row.features.congruence).toBe(1);
  });
});
