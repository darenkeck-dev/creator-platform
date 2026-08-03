import { describe, expect, it } from "bun:test";

import type { AssetToneVectorValues } from "../src/asset-vector.js";
import {
  complementaryToneQueryVector,
  maskedToneQueryDistance,
  rankToneQueryCandidates,
  reviewWordsToToneQuery,
  toneQueryRetrievalVector,
} from "../src/tone-query.js";

describe("tone queries", () => {
  it("maps review words into a sparse versioned query", () => {
    const query = reviewWordsToToneQuery(["serene", "loving"]);

    expect(query).toEqual({
      values: {
        valence: 1,
        arousal: -0.75,
        warmth: 0.6,
        tension: -0.7,
        intimacy: 0.6,
      },
      dimensions: ["valence", "arousal", "warmth", "tension", "intimacy"],
      taxonomyVersion: "tone-taxonomy/v2",
    });
  });

  it("returns null when no words map to tone dimensions", () => {
    expect(reviewWordsToToneQuery(["not-a-tone-word"])).toBeNull();
  });

  it("zero-fills only the approximate retrieval vector", () => {
    const query = reviewWordsToToneQuery(["serene"]);
    expect(query).not.toBeNull();
    expect(toneQueryRetrievalVector(query!)).toEqual([0.65, -0.75, 0, 0, -0.7, 0, 0, 0, 0, 0]);
  });

  it("ranks by exact distance over requested dimensions only", () => {
    const query = reviewWordsToToneQuery(["serene"]);
    expect(query).not.toBeNull();
    const close: AssetToneVectorValues = [0.65, -0.75, 1, 1, -0.7, 1, 1, 1, 1, 1];
    const far: AssetToneVectorValues = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    expect(maskedToneQueryDistance(query!, close)).toBe(0);
    expect(
      rankToneQueryCandidates(query!, [
        { candidate: "far", predictedTone: far },
        { candidate: "close", predictedTone: close },
      ]).map(({ candidate }) => candidate)
    ).toEqual(["close", "far"]);
  });

  it("builds a clamped target-conditioned complementary query", () => {
    const query = reviewWordsToToneQuery(["serene"]);
    expect(query).not.toBeNull();
    const audio: AssetToneVectorValues = [1, -1, 1, 1, -1, 1, 1, 1, 1, 1];

    const complementary = complementaryToneQueryVector(query!, audio, 0.6, 0.4);
    expect(complementary[0]).toBeCloseTo(0.125);
    expect(complementary[1]).toBeCloseTo(-0.375);
    expect(complementary[4]).toBeCloseTo(-0.25);
    expect(complementary.filter((_, index) => ![0, 1, 4].includes(index))).toEqual([
      0, 0, 0, 0, 0, 0, 0,
    ]);
  });
});
