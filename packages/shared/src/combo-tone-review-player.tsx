"use client";

import { useEffect, useState } from "react";

import { ComboPlayer } from "./combo-player";
import { ToneWordPicker, useToneWordPicker } from "./tone-word-picker";
import { ToneWordSubmitPile } from "./tone-word-submit-pile";

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

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
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
          <ToneWordSubmitPile
            onSubmit={() => void submitReview()}
            onToggleWord={toggleReviewKeyword}
            selectedWords={selectedKeywords}
            submitDisabled={selectedKeywords.length < minKeywordsToSubmit}
            submitSucceeded={submitSucceeded}
            submitTitle="Submit review"
            submitting={submitting}
            wordTitle={(keyword) => `Remove ${keyword} from this review.`}
          />
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
