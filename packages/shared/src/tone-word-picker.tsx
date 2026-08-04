"use client";

import {
  type ReviewWord,
  type ReviewWordExplorationMode,
  buildAdaptiveReviewWordOptions,
  initialReviewWordOptions,
} from "@media-manager/tone-core/review-word-picker";
import { useEffect, useState } from "react";

const DEFAULT_MAX_SELECTED_WORDS = 24;

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export type UseToneWordPickerOptions = {
  seed: string;
  explorationMode: ReviewWordExplorationMode;
  enabled?: boolean;
  maxSelectedWords?: number;
};

export function useToneWordPicker({
  seed,
  explorationMode,
  enabled = true,
  maxSelectedWords = DEFAULT_MAX_SELECTED_WORDS,
}: UseToneWordPickerOptions) {
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<ReviewWord[]>(() =>
    enabled ? initialReviewWordOptions(seed) : []
  );
  const [shownWords, setShownWords] = useState<string[]>(() =>
    enabled ? suggestions.map((word) => word.label) : []
  );
  const [lastSelectedWord, setLastSelectedWord] = useState<string | undefined>();
  const [round, setRound] = useState(0);
  const selectedWordSet = new Set(selectedWords);

  useEffect(() => {
    const initialSuggestions = enabled ? initialReviewWordOptions(seed) : [];
    setSelectedWords([]);
    setSuggestions(initialSuggestions);
    setShownWords(initialSuggestions.map((word) => word.label));
    setLastSelectedWord(undefined);
    setRound(0);
  }, [enabled, explorationMode, seed]);

  function toggleWord(word: string) {
    const selecting = !selectedWordSet.has(word);
    setSelectedWords((previous) =>
      previous.includes(word)
        ? previous.filter((entry) => entry !== word)
        : [...previous, word].slice(0, maxSelectedWords)
    );
    setLastSelectedWord((previous) =>
      selecting ? word : previous === word ? undefined : previous
    );
  }

  function showNextSuggestions() {
    if (!enabled) return;
    const nextRound = round + 1;
    const nextSuggestions = buildAdaptiveReviewWordOptions({
      seed,
      selectedWords,
      shownWords,
      anchorWord: lastSelectedWord,
      round: nextRound,
      explorationMode,
    });
    setRound(nextRound);
    setSuggestions(nextSuggestions);
    setShownWords((previous) =>
      unique([...previous, ...nextSuggestions.map((word) => word.label)])
    );
  }

  return {
    round,
    selectedWords,
    selectedWordSet,
    suggestions,
    toggleWord,
    showNextSuggestions,
  };
}

export type ToneWordPickerProps = {
  suggestions: ReviewWord[];
  selectedWords: readonly string[] | ReadonlySet<string>;
  onToggleWord: (word: string) => void;
  onNext: () => void;
  className?: string;
  variant?: "default" | "combo-overlay";
};

export function ToneWordPicker({
  suggestions,
  selectedWords,
  onToggleWord,
  onNext,
  className,
  variant = "default",
}: ToneWordPickerProps) {
  const selectedWordSet = selectedWords instanceof Set ? selectedWords : new Set(selectedWords);
  const comboOverlay = variant === "combo-overlay";

  return (
    <div
      className={cx(
        comboOverlay
          ? "grid grid-cols-[1fr_auto] items-center gap-2 text-white sm:grid-cols-[1fr_minmax(0,auto)_1fr] sm:gap-8"
          : "flex items-center justify-center gap-2",
        className
      )}
    >
      {comboOverlay ? <div className="hidden sm:block" /> : null}
      <div
        className={cx(
          "flex min-w-0 flex-wrap justify-center gap-2",
          comboOverlay && "sm:max-w-[min(72vw,48rem)]"
        )}
      >
        {suggestions.map((word) => {
          const selected = selectedWordSet.has(word.label);
          return (
            <button
              className={cx(
                "rounded-full border px-3 py-1.5 text-sm backdrop-blur-sm transition hover:border-white/70",
                selected
                  ? "border-white/80 bg-white/85 text-black hover:bg-white"
                  : "border-white/40 bg-black/45 text-white hover:bg-black/60"
              )}
              key={word.label}
              onClick={() => onToggleWord(word.label)}
              title={word.description}
              type="button"
            >
              {word.label}
            </button>
          );
        })}
      </div>
      <button
        aria-label="Show next keyword options"
        className={cx(
          "flex h-8 items-center px-1 text-xl font-semibold text-white transition hover:text-white/75",
          comboOverlay
            ? "min-w-8 justify-end sm:min-w-10 sm:justify-start"
            : "min-w-6 justify-center"
        )}
        onClick={onNext}
        type="button"
      >
        &gt;
      </button>
    </div>
  );
}
