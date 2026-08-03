/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";

import { reviewKeywordsToToneScores } from "../src/review-keywords.js";
import { REVIEW_WORDS } from "../src/review-word-picker.js";

describe("reviewKeywordsToToneScores", () => {
  it("maps review-picker aliases through the production taxonomy", () => {
    expect(reviewKeywordsToToneScores(["serene", "loving"])).toEqual({
      tension: -0.7,
      arousal: -0.75,
      valence: 1,
      intimacy: 0.6,
      warmth: 0.6,
    });
  });

  it("deduplicates canonical descriptors and returns only affected dimensions", () => {
    expect(reviewKeywordsToToneScores(["ominous", "sinister"])).toEqual({
      menace: 0.8,
      valence: -0.6,
      arousal: 0.45,
    });
  });

  it("ignores unsupported keywords", () => {
    expect(reviewKeywordsToToneScores(["not-a-review-keyword"])).toEqual({});
  });

  it("supports every keyword exposed by the review picker", () => {
    for (const { label: keyword } of REVIEW_WORDS) {
      expect(Object.keys(reviewKeywordsToToneScores([keyword])).length).toBeGreaterThan(0);
    }
  });
});
