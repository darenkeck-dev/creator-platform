/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";

import {
  REVIEW_WORDS,
  buildAdaptiveReviewWordOptions,
  initialReviewWordOptions,
} from "../src/review-word-picker.js";

const labels = (words: Array<{ label: string }>) => words.map((word) => word.label);

describe("review word picker", () => {
  it("exposes the 54 review leaves in taxonomy order", () => {
    expect(REVIEW_WORDS).toHaveLength(54);
    expect(labels(REVIEW_WORDS.slice(0, 5))).toEqual([
      "playful",
      "cheerful",
      "celebratory",
      "breezy",
      "carefree",
    ]);
    expect(labels(REVIEW_WORDS.slice(-5))).toEqual([
      "surreal",
      "unstable",
      "ominous",
      "sinister",
      "bleak",
    ]);
  });

  it("preserves deterministic target-seeded initial suggestions", () => {
    expect(labels(initialReviewWordOptions("combo:test-combo"))).toEqual([
      "worried",
      "loving",
      "grounded",
      "foreboding",
      "abrasive",
    ]);
    expect(labels(initialReviewWordOptions("audio:test-audio"))).toEqual([
      "sunny",
      "worried",
      "forceful",
      "confrontational",
      "dominant",
    ]);
  });

  it("preserves any-other-root adaptive exploration", () => {
    expect(
      labels(
        buildAdaptiveReviewWordOptions({
          seed: "combo:test-combo",
          selectedWords: ["playful"],
          shownWords: labels(initialReviewWordOptions("combo:test-combo")),
          anchorWord: "playful",
          round: 1,
          explorationMode: "any-other-root",
        })
      )
    ).toEqual(["secretive", "celebratory", "cheerful", "carefree", "agitated"]);
  });

  it("preserves distinct-other-roots adaptive exploration", () => {
    const options = buildAdaptiveReviewWordOptions({
      seed: "combo:test-combo",
      selectedWords: ["playful"],
      shownWords: labels(initialReviewWordOptions("combo:test-combo")),
      anchorWord: "playful",
      round: 1,
      explorationMode: "distinct-other-roots",
    });

    expect(labels(options)).toEqual(["cheerful", "haunted", "celebratory", "carefree", "dominant"]);
    const explorationRoots = options
      .filter((word) => word.rootLabel !== "Positive")
      .map((word) => word.rootLabel);
    expect(new Set(explorationRoots).size).toBe(explorationRoots.length);
  });
});
