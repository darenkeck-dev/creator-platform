import type {
  PublicComboSelectionRequest,
  PublicComboSelectionResponse,
} from "@media-manager/contracts";

export type ComboExplorerHistory = {
  recentComboIds: string[];
  recentAudioAssetIds: string[];
};

export type ComboExplorerCurrent = Pick<
  PublicComboSelectionResponse,
  "comboId" | "videoAssetId" | "audioAssetId"
>;

export const EMPTY_COMBO_EXPLORER_HISTORY: ComboExplorerHistory = {
  recentComboIds: [],
  recentAudioAssetIds: [],
};

export function advanceComboExplorerHistory(
  history: ComboExplorerHistory,
  departing: ComboExplorerCurrent
): ComboExplorerHistory {
  return {
    recentComboIds: prependBounded(departing.comboId, history.recentComboIds, 5),
    recentAudioAssetIds: prependBounded(departing.audioAssetId, history.recentAudioAssetIds, 3),
  };
}

export function buildComboSearchRequest(keywords: string[]): PublicComboSelectionRequest {
  return {
    schemaVersion: "public-combo-selection-request/v1",
    mode: "search",
    keywords,
    history: EMPTY_COMBO_EXPLORER_HISTORY,
  };
}

export function buildComboWalkRequest(
  current: ComboExplorerCurrent,
  history: ComboExplorerHistory
): PublicComboSelectionRequest {
  return {
    schemaVersion: "public-combo-selection-request/v1",
    mode: "walk",
    current: {
      audioAssetId: current.audioAssetId,
      videoAssetId: current.videoAssetId,
    },
    history,
  };
}

function prependBounded(value: string, values: string[], limit: number): string[] {
  return [value, ...values.filter((entry) => entry !== value)].slice(0, limit);
}
