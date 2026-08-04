// @ts-expect-error -- Bun supplies this runtime module; the browser app does not include Bun types.
import { describe, expect, it } from "bun:test";

import { advanceJourney, journeyForKeywords, requestForJourney } from "../src/lib/combo-journey";

const current = {
  comboId: "combo-current",
  videoAssetId: "video-current",
  audioAssetId: "audio-current",
};

describe("combo journey", () => {
  it("uses a fully random journey when no keywords are selected", () => {
    const journey = journeyForKeywords([]);
    expect(journey).toEqual({ mode: "random" });
    expect(requestForJourney(journey, current)).toBeNull();
    expect(advanceJourney(journey, current)).toBe(journey);
  });

  it("normalizes keywords and starts a search", () => {
    const journey = journeyForKeywords([" serene ", "loving", "serene", ""]);
    expect(requestForJourney(journey, current)).toEqual({
      schemaVersion: "public-combo-selection-request/v1",
      mode: "search",
      keywords: ["serene", "loving"],
      history: { recentComboIds: [], recentAudioAssetIds: [] },
    });
  });

  it("turns a completed search into bounded nearby walks", () => {
    let journey = advanceJourney(journeyForKeywords(["serene"]), current);
    expect(journey).toEqual({
      mode: "walk",
      history: { recentComboIds: [], recentAudioAssetIds: [] },
    });

    journey = advanceJourney(journey, current);
    expect(requestForJourney(journey, current)).toEqual({
      schemaVersion: "public-combo-selection-request/v1",
      mode: "walk",
      current: { videoAssetId: "video-current", audioAssetId: "audio-current" },
      history: {
        recentComboIds: ["combo-current"],
        recentAudioAssetIds: ["audio-current"],
      },
    });
  });
});
