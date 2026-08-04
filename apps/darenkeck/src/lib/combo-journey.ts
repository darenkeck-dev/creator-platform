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
  | { mode: "search"; keywords: string[]; history: ComboExplorerHistory }
  | { mode: "walk"; history: ComboExplorerHistory };

export function journeyForKeywords(
  keywords: string[],
  previousJourney: ComboJourney = { mode: "random" },
  departing: ComboExplorerCurrent | null = null
): ComboJourney {
  const normalized = [...new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean))];
  if (normalized.length === 0) return { mode: "random" };

  const previousHistory =
    previousJourney.mode === "random" ? EMPTY_COMBO_EXPLORER_HISTORY : previousJourney.history;
  const history = departing
    ? advanceComboExplorerHistory(previousHistory, departing)
    : previousHistory;
  return { mode: "search", keywords: normalized, history };
}

export function requestForJourney(
  journey: ComboJourney,
  current: ComboExplorerCurrent | null
): PublicComboSelectionRequest | null {
  if (journey.mode === "random") {
    return null;
  }
  if (journey.mode === "search") {
    return buildComboSearchRequest(journey.keywords, journey.history);
  }
  return current ? buildComboWalkRequest(current, journey.history) : null;
}

export function advanceJourney(
  journey: ComboJourney,
  departing: ComboExplorerCurrent | null
): ComboJourney {
  if (journey.mode === "search") {
    return { mode: "walk", history: journey.history };
  }
  if (journey.mode === "walk" && departing) {
    return {
      mode: "walk",
      history: advanceComboExplorerHistory(journey.history, departing),
    };
  }
  return journey;
}
