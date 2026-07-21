/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";

import { reviewKeywordsToToneScores } from "../src/review-keywords.js";

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
    const pickerKeywords = [
      "playful",
      "cheerful",
      "celebratory",
      "breezy",
      "carefree",
      "sunny",
      "beautiful",
      "magical",
      "radiant",
      "serene",
      "quiet",
      "relaxed",
      "comforting",
      "gentle",
      "grounded",
      "personal",
      "loving",
      "vulnerable",
      "wistful",
      "blue",
      "reflective",
      "grief",
      "heartbreak",
      "mourning",
      "nostalgic",
      "lonely",
      "yearning",
      "worried",
      "nervous",
      "uneasy",
      "foreboding",
      "doomed",
      "haunted",
      "enigmatic",
      "secretive",
      "suspenseful",
      "tense",
      "agitated",
      "abrasive",
      "hostile",
      "combative",
      "confrontational",
      "rebellious",
      "forceful",
      "resistant",
      "vast",
      "dominant",
      "majestic",
      "eerie",
      "surreal",
      "unstable",
      "ominous",
      "sinister",
      "bleak",
    ];

    for (const keyword of pickerKeywords) {
      expect(Object.keys(reviewKeywordsToToneScores([keyword])).length).toBeGreaterThan(0);
    }
  });
});
