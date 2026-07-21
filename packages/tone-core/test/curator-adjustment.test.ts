/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";

import { combineModelAndCuratorScores } from "../src/curator-adjustment.js";

describe("combineModelAndCuratorScores", () => {
  it("returns no adjustments without curator scores", () => {
    expect(combineModelAndCuratorScores({ valence: 0.6 }, [])).toEqual({
      adjustedScores: {},
      curatorReviewCount: 0,
      dimensions: {},
    });
  });

  it("treats the model and each curator review as one vote", () => {
    expect(
      combineModelAndCuratorScores({ valence: 0.6, warmth: -0.3 }, [
        { valence: 0, warmth: 0.3 },
        { valence: -0.3, warmth: 0.6 },
      ])
    ).toEqual({
      adjustedScores: { valence: 0.1, warmth: 0.2 },
      curatorReviewCount: 2,
      dimensions: {
        valence: { curatorScoreSum: -0.3, curatorReviewCount: 2 },
        warmth: { curatorScoreSum: 0.9, curatorReviewCount: 2 },
      },
    });
  });

  it("keeps explicit zeroes and counts dimensions independently", () => {
    expect(
      combineModelAndCuratorScores({ arousal: 0.8, menace: -0.6 }, [
        { arousal: 0 },
        { arousal: -0.4, menace: 0 },
      ])
    ).toEqual({
      adjustedScores: { arousal: 0.133333, menace: -0.3 },
      curatorReviewCount: 2,
      dimensions: {
        arousal: { curatorScoreSum: -0.4, curatorReviewCount: 2 },
        menace: { curatorScoreSum: 0, curatorReviewCount: 1 },
      },
    });
  });

  it("ignores reviewed dimensions missing from the model", () => {
    expect(combineModelAndCuratorScores({ valence: 0.5 }, [{ warmth: 1 }])).toEqual({
      adjustedScores: {},
      curatorReviewCount: 1,
      dimensions: {},
    });
  });
});
