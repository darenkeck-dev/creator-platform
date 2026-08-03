import { describe, expect, it } from "bun:test";

import {
  COMBO_TONE_PREDICTOR_VERSION,
  comboTonePredictorV0,
  rankComboToneCandidates,
  sampleNearestComboToneCandidate,
  squaredEuclideanToneDistance,
} from "../src/combo-tone.js";
import type { AssetToneVectorValues } from "../src/asset-vector.js";

const zero: AssetToneVectorValues = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

describe("combo tone prediction", () => {
  it("predicts every dimension with the versioned 60/40 blend", () => {
    const audio: AssetToneVectorValues = [1, -1, 0.5, -0.5, 1, -1, 0.5, -0.5, 1, -1];
    const video: AssetToneVectorValues = [-1, 1, -0.5, 0.5, 1, -1, -0.5, 0.5, -1, 1];

    expect(comboTonePredictorV0.version).toBe(COMBO_TONE_PREDICTOR_VERSION);
    const predicted = comboTonePredictorV0.predict({ audioTone: audio, videoTone: video });
    const expected = [0.2, -0.2, 0.1, -0.1, 1, -1, 0.1, -0.1, 0.2, -0.2];
    predicted.forEach((value, index) => expect(value).toBeCloseTo(expected[index] as number));
  });

  it("computes exact squared Euclidean distance", () => {
    const right: AssetToneVectorValues = [1, -1, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(squaredEuclideanToneDistance(zero, zero)).toBe(0);
    expect(squaredEuclideanToneDistance(zero, right)).toBe(2);
  });

  it("ranks without mutating candidates", () => {
    const candidates = [
      { candidate: "far", predictedTone: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0] as AssetToneVectorValues },
      {
        candidate: "near",
        predictedTone: [0.25, 0, 0, 0, 0, 0, 0, 0, 0, 0] as AssetToneVectorValues,
      },
    ];

    expect(rankComboToneCandidates(zero, candidates).map(({ candidate }) => candidate)).toEqual([
      "near",
      "far",
    ]);
    expect(candidates.map(({ candidate }) => candidate)).toEqual(["far", "near"]);
  });

  it("samples only the nearest five with distance weighting", () => {
    const ranked = Array.from({ length: 6 }, (_, index) => ({
      candidate: index,
      predictedTone: zero,
      distance: index,
    }));

    expect(sampleNearestComboToneCandidate(ranked, () => 0)?.candidate).toBe(0);
    expect(sampleNearestComboToneCandidate(ranked, () => 0.4)?.candidate).toBe(0);
    expect(sampleNearestComboToneCandidate(ranked, () => 0.999999)?.candidate).toBe(4);
    expect(sampleNearestComboToneCandidate([], () => 0)).toBeNull();
  });
});
