// @ts-expect-error -- Bun supplies this runtime module; the browser app does not include Bun types.
import { describe, expect, it } from "bun:test";

import {
  EMPTY_COMBO_EXPLORER_HISTORY,
  advanceComboExplorerHistory,
  buildComboSearchRequest,
  buildComboWalkRequest,
} from "@media-manager/shared";

describe("combo explorer state", () => {
  it("builds a combined tone-word search that resets history", () => {
    expect(buildComboSearchRequest(["serene", "loving"])).toEqual({
      schemaVersion: "public-combo-selection-request/v1",
      mode: "search",
      keywords: ["serene", "loving"],
      history: { recentComboIds: [], recentAudioAssetIds: [] },
    });
  });

  it("bounds and deduplicates departed combo history", () => {
    let history = EMPTY_COMBO_EXPLORER_HISTORY;
    for (let index = 0; index < 7; index += 1) {
      history = advanceComboExplorerHistory(history, {
        comboId: `combo-${index}`,
        audioAssetId: `audio-${index}`,
        videoAssetId: `video-${index}`,
      });
    }

    expect(history.recentComboIds).toEqual(["combo-6", "combo-5", "combo-4", "combo-3", "combo-2"]);
    expect(history.recentAudioAssetIds).toEqual(["audio-6", "audio-5", "audio-4"]);

    expect(
      advanceComboExplorerHistory(history, {
        comboId: "combo-4",
        audioAssetId: "audio-4",
        videoAssetId: "video-4",
      })
    ).toEqual({
      recentComboIds: ["combo-4", "combo-6", "combo-5", "combo-3", "combo-2"],
      recentAudioAssetIds: ["audio-4", "audio-6", "audio-5"],
    });
  });

  it("builds walk requests from the current pair and prior history", () => {
    expect(
      buildComboWalkRequest(
        { comboId: "combo-current", audioAssetId: "audio-current", videoAssetId: "video-current" },
        { recentComboIds: ["combo-old"], recentAudioAssetIds: ["audio-old"] }
      )
    ).toEqual({
      schemaVersion: "public-combo-selection-request/v1",
      mode: "walk",
      current: { audioAssetId: "audio-current", videoAssetId: "video-current" },
      history: { recentComboIds: ["combo-old"], recentAudioAssetIds: ["audio-old"] },
    });
  });
});
