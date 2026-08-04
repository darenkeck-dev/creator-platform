import type { PublicComboSelectionRequest } from "@media-manager/contracts";
import {
  EMPTY_COMBO_EXPLORER_HISTORY,
  advanceComboExplorerHistory,
  buildComboSearchRequest,
  buildComboWalkRequest,
  type ComboExplorerCurrent,
  type ComboExplorerHistory,
} from "@media-manager/shared";

export type ComboJourney =
  | { mode: "random" }
  | { mode: "search"; keywords: string[] }
  | { mode: "walk"; history: ComboExplorerHistory };

export function journeyForKeywords(keywords: string[]): ComboJourney {
  const normalized = [...new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean))];
  return normalized.length > 0 ? { mode: "search", keywords: normalized } : { mode: "random" };
}

export function requestForJourney(
  journey: ComboJourney,
  current: ComboExplorerCurrent | null
): PublicComboSelectionRequest | null {
  if (journey.mode === "random") {
    return null;
  }
  if (journey.mode === "search") {
    return buildComboSearchRequest(journey.keywords);
  }
  return current ? buildComboWalkRequest(current, journey.history) : null;
}

export function advanceJourney(
  journey: ComboJourney,
  departing: ComboExplorerCurrent | null
): ComboJourney {
  if (journey.mode === "search") {
    return { mode: "walk", history: EMPTY_COMBO_EXPLORER_HISTORY };
  }
  if (journey.mode === "walk" && departing) {
    return {
      mode: "walk",
      history: advanceComboExplorerHistory(journey.history, departing),
    };
  }
  return journey;
}
