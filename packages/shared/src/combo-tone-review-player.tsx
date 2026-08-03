"use client";

import { useEffect, useState } from "react";

import { ComboPlayer } from "./combo-player";
import { ToneWordPicker, useToneWordPicker } from "./tone-word-picker";

export type ComboToneReviewPayload = {
  targetType: "combo";
  targetId: string;
  sourceVideoAssetId: string;
  sourceAudioAssetId: string;
  keywords: string[];
};

export type ComboToneReviewPlayerProps = {
  combo: {
    comboId: string;
    videoAssetId: string;
    audioAssetId: string;
    videoTitle: string;
    audioTitle: string;
    videoSrc: string;
    audioSrc: string;
  };
  className?: string;
  loadingNext?: boolean;
  minKeywordsToSubmit?: number;
  onNext?: () => void;
  onSubmit: (payload: ComboToneReviewPayload) => Promise<void> | void;
};

const DEFAULT_MIN_KEYWORDS_TO_SUBMIT = 3;
const MAX_KEYWORD_PILE_COLUMNS = 4;

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function keywordPilePlacements(keywords: string[]) {
  const heights = [1, 0];

  return keywords.map((keyword) => {
    let column = 0;
    const existingColumns = heights.map((height, index) => ({ height, index }));
    const allExistingColumnsEven = heights.every((height) => height === heights[0]);

    if (
      allExistingColumnsEven &&
      (heights[0] ?? 0) >= 2 &&
      heights.length < MAX_KEYWORD_PILE_COLUMNS
    ) {
      column = heights.length;
      heights.push(0);
    } else {
      const eligibleColumns = existingColumns.filter(({ index }) => {
        return index === 0 || (heights[index - 1] ?? 0) > (heights[index] ?? 0);
      });
      column =
        eligibleColumns.sort(
          (left, right) => left.height - right.height || left.index - right.index
        )[0]?.index ?? 0;
    }

    const rowFromBottom = heights[column] ?? 0;
    heights[column] = rowFromBottom + 1;
    return { column, keyword, rowFromBottom };
  });
}

export function ComboToneReviewPlayer({
  combo,
  className,
  loadingNext = false,
  minKeywordsToSubmit = DEFAULT_MIN_KEYWORDS_TO_SUBMIT,
  onNext,
  onSubmit,
}: ComboToneReviewPlayerProps) {
  const keywordSeed = `combo:${combo.comboId}`;
  const {
    selectedWords: selectedKeywords,
    selectedWordSet: selectedKeywordSet,
    suggestions: keywordOptions,
    toggleWord: toggleKeyword,
    showNextSuggestions: showNextKeywordOptions,
  } = useToneWordPicker({
    seed: keywordSeed,
    explorationMode: "distinct-other-roots",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitSucceeded, setSubmitSucceeded] = useState(false);
  const keywordPlacements = keywordPilePlacements(selectedKeywords);
  const pileRows = Math.max(
    1,
    ...keywordPlacements.map((placement) => placement.rowFromBottom + 1)
  );
  const pileGridRows = pileRows + 1;

  useEffect(() => {
    setSubmitting(false);
    setSubmitSucceeded(false);
  }, [keywordSeed]);

  function toggleReviewKeyword(keyword: string) {
    setSubmitSucceeded(false);
    toggleKeyword(keyword);
  }

  async function submitReview() {
    setSubmitting(true);
    setSubmitSucceeded(false);
    try {
      await onSubmit({
        targetType: "combo",
        targetId: combo.comboId,
        sourceVideoAssetId: combo.videoAssetId,
        sourceAudioAssetId: combo.audioAssetId,
        keywords: selectedKeywords,
      });
      setSubmitSucceeded(true);
    } finally {
      setSubmitting(false);
    }
  }

  const submitButton =
    selectedKeywords.length > 0 ? (
      <button
        className="inline-flex w-28 items-center justify-center rounded-full border border-sky-200/90 bg-sky-400 px-5 py-2 text-sm font-semibold text-black shadow-[0_0_24px_rgba(56,189,248,0.55)] transition hover:bg-sky-300 disabled:cursor-not-allowed disabled:border-white/35 disabled:bg-black/55 disabled:text-white/60 disabled:shadow-none"
        disabled={submitting || selectedKeywords.length < minKeywordsToSubmit}
        onClick={() => void submitReview()}
        title="Submit review"
        type="button"
      >
        {submitting ? (
          <svg aria-hidden="true" className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              d="M4 12a8 8 0 018-8"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="4"
            />
          </svg>
        ) : submitSucceeded ? (
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : (
          "Submit"
        )}
      </button>
    ) : null;

  return (
    <div
      className={cx("relative overflow-hidden rounded-2xl border bg-black shadow-sm", className)}
      style={{ minHeight: 420, height: "min(72vh, 760px)" }}
    >
      <ComboPlayer
        key={combo.comboId}
        audioSrc={combo.audioSrc}
        audioTitle={combo.audioTitle}
        defaultAudioMuted={false}
        audioMutedByDefault={false}
        className="h-full w-full"
        comboId={combo.comboId}
        preload="auto"
        variant="background"
        videoSrc={combo.videoSrc}
        videoTitle={combo.videoTitle}
      />

      {onNext ? (
        <button
          className={cx(
            "pointer-events-auto rounded-full border bg-black/45 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur-sm transition hover:bg-black/65 disabled:opacity-70",
            submitSucceeded
              ? "border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.45)]"
              : "border-white/50"
          )}
          disabled={loadingNext}
          onClick={onNext}
          style={{ bottom: 24, position: "absolute", right: 24, zIndex: 120 }}
          type="button"
        >
          {loadingNext ? "Loading..." : "Next"}
        </button>
      ) : null}

      <div
        className="pointer-events-none absolute inset-x-0 top-0 px-4 py-4 sm:px-6 sm:py-6"
        style={{ zIndex: 120 }}
      >
        <ToneWordPicker
          className="pointer-events-auto"
          onNext={showNextKeywordOptions}
          onToggleWord={toggleReviewKeyword}
          selectedWords={selectedKeywordSet}
          suggestions={keywordOptions}
          variant="combo-overlay"
        />
      </div>

      {selectedKeywords.length > 0 ? (
        <div
          className="pointer-events-none"
          style={{
            bottom: 24,
            left: 24,
            maxWidth: "calc(100% - 9rem)",
            position: "absolute",
            zIndex: 120,
          }}
        >
          <div
            className="pointer-events-auto grid items-end gap-2 overflow-visible"
            style={{
              gridTemplateColumns: `repeat(${Math.max(2, Math.min(MAX_KEYWORD_PILE_COLUMNS, keywordPlacements.length + 1))}, max-content)`,
              gridTemplateRows: `repeat(${pileGridRows}, max-content)`,
            }}
          >
            <div style={{ gridColumn: 1, gridRow: pileGridRows }}>{submitButton}</div>
            {keywordPlacements.map(({ column, keyword, rowFromBottom }) => (
              <button
                className="rounded-full border border-sky-400 bg-transparent px-3 py-1.5 text-sm text-white shadow-sm transition hover:bg-sky-400/15"
                key={keyword}
                onClick={() => toggleReviewKeyword(keyword)}
                style={{ gridColumn: column + 1, gridRow: pileGridRows - rowFromBottom }}
                title={`Remove ${keyword} from this review.`}
                type="button"
              >
                {keyword}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {loadingNext ? (
        <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-black/20">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/35 border-t-white" />
        </div>
      ) : null}
    </div>
  );
}
