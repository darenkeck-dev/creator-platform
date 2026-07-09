/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";

import { structuredDescriptorsToTone, toneToWords } from "../src/tone-vector.js";

describe("tone vector helpers", () => {
  it("maps structured descriptors into taxonomy dimensions", () => {
    const tone = structuredDescriptorsToTone([
      { descriptor: "uplifting", strengthLabel: "strong", dimension: "mood", strengthValue: 0.8 },
      { descriptor: "cold", strengthLabel: "medium" },
      { descriptor: "tense", strengthLabel: "weak" },
    ]);

    expect(tone.valence).toBeCloseTo(0.2975);
    expect(tone.arousal).toBeCloseTo(0.16);
    expect(tone.warmth).toBeCloseTo(-0.2475);
    expect(tone.tension).toBeCloseTo(0.1375);
  });

  it("sums weighted descriptor contributions and clamps final scores", () => {
    const tone = structuredDescriptorsToTone([
      { descriptor: "joyful", strengthLabel: "extreme" },
      { descriptor: "uplifting", strengthLabel: "extreme" },
      { descriptor: "peaceful", strengthLabel: "strong" },
    ]);

    expect(tone.valence).toBe(1);
    expect(tone.tension).toBeCloseTo(-0.595);
    expect(tone.arousal).toBeCloseTo(-0.4375);
  });

  it("supports v2 descriptors with multi-dimension mappings", () => {
    const tone = structuredDescriptorsToTone([
      { descriptor: "melancholic", strengthValue: 0.8 },
      { descriptor: "fragile", strengthValue: 0.7 },
    ]);

    expect(tone.valence).toBeCloseTo(-0.705);
    expect(tone.arousal).toBeCloseTo(-0.24);
    expect(tone.nostalgia).toBeCloseTo(0.24);
    expect(tone.dominance).toBeCloseTo(-0.385);
  });

  it("generates ranked tone words", () => {
    const words = toneToWords(
      structuredDescriptorsToTone([
        { descriptor: "threatening", strengthLabel: "strong" },
        { descriptor: "unstable", strengthLabel: "medium" },
        { descriptor: "beautiful", strengthLabel: "weak" },
      ])
    );

    expect(words.primary).toEqual(["dangerous", "melancholic", "energetic"]);
    expect(words.summary).toBe("A dangerous, melancholic, energetic tone.");
  });
});
