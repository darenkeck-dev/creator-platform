"use client";

import type {
  AssetDetailResponse,
  ToneReviewRecord,
  ToneReviewTargetType,
} from "@media-manager/contracts";
import { ComboToneReviewPlayer, ToneWordPicker, useToneWordPicker } from "@media-manager/shared";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ReviewMediaPlayer } from "@/components/review-media-player";

type Asset = AssetDetailResponse["asset"];

type ReviewTarget = {
  targetType: ToneReviewTargetType;
  targetId: string;
  label: string;
  title: string;
  taxonomyVersion?: "tone-taxonomy/v1" | "tone-taxonomy/v2";
  sourceVideoAssetId?: string;
  sourceAudioAssetId?: string;
};

type ReviewMedia =
  | {
      targetType: "combo";
      id: string;
      videoTitle: string;
      audioTitle: string;
      videoSrc: string;
      audioSrc: string;
    }
  | {
      targetType: "video";
      asset: Asset;
    }
  | {
      targetType: "audio";
      asset: Asset;
    };

type Props = {
  target: ReviewTarget;
  media: ReviewMedia;
  targetReviews: Array<{
    review: ToneReviewRecord;
  }>;
};

const MIN_KEYWORDS_TO_SUBMIT = 3;

export function ToneReviewWorkbench({ target, media, targetReviews }: Props) {
  const router = useRouter();
  const keywordSeed = `${target.targetType}:${target.targetId}`;
  const pickerEnabled = media.targetType !== "combo";
  const {
    round: keywordRound,
    selectedWords: selectedKeywords,
    selectedWordSet: selectedKeywordSet,
    suggestions: keywordOptions,
    toggleWord: toggleKeyword,
    showNextSuggestions: showNextKeywordOptions,
  } = useToneWordPicker({
    seed: keywordSeed,
    explorationMode: "any-other-root",
    enabled: pickerEnabled,
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitSucceeded, setSubmitSucceeded] = useState(false);
  const [loadingNext, setLoadingNext] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    function handleNextLoading() {
      setLoadingNext(true);
    }

    window.addEventListener("review:next-loading", handleNextLoading);
    return () => window.removeEventListener("review:next-loading", handleNextLoading);
  }, []);

  function toggleReviewKeyword(keyword: string) {
    setSubmitSucceeded(false);
    toggleKeyword(keyword);
  }

  async function submitReview() {
    setSubmitting(true);
    setSubmitSucceeded(false);
    setMessage(null);
    try {
      const response = await fetch("/api/tone-reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetType: target.targetType,
          targetId: target.targetId,
          reviewSource: "curator",
          ...(target.taxonomyVersion ? { taxonomyVersion: target.taxonomyVersion } : {}),
          ...(target.targetType === "combo"
            ? {
                sourceVideoAssetId: target.sourceVideoAssetId,
                sourceAudioAssetId: target.sourceAudioAssetId,
              }
            : {}),
          keywords: selectedKeywords,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit review");
      }

      setMessage(`Saved ${target.label.toLowerCase()} review.`);
      setSubmitSucceeded(true);
      router.refresh();
    } catch {
      setSubmitSucceeded(false);
      setMessage("Could not save review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitComboReview(payload: { keywords: string[] }) {
    setSubmitSucceeded(false);
    setMessage(null);

    const response = await fetch("/api/tone-reviews", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        targetType: target.targetType,
        targetId: target.targetId,
        reviewSource: "curator",
        ...(target.taxonomyVersion ? { taxonomyVersion: target.taxonomyVersion } : {}),
        ...(target.targetType === "combo"
          ? {
              sourceVideoAssetId: target.sourceVideoAssetId,
              sourceAudioAssetId: target.sourceAudioAssetId,
            }
          : {}),
        keywords: payload.keywords,
      }),
    });

    if (!response.ok) {
      setMessage("Could not save review. Please try again.");
      throw new Error("Failed to submit review");
    }

    setMessage(`Saved ${target.label.toLowerCase()} review.`);
    setSubmitSucceeded(true);
  }

  function loadNextCombo() {
    if (media.targetType !== "combo") {
      return;
    }

    setLoadingNext(true);
    const params = new URLSearchParams({ targetType: "combo", next: String(Date.now()) });
    params.set("previousTargetId", media.id);
    if (target.sourceAudioAssetId) {
      params.set("previousAudioAssetId", target.sourceAudioAssetId);
    }
    router.push(`/review?${params.toString()}`);
    router.refresh();
  }

  const keywordPicker = (
    <div className="pointer-events-auto w-full space-y-1.5 text-white">
      <style>{`
        @keyframes tone-review-button-in {
          from { opacity: 0; transform: translateY(-4px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
      {keywordOptions.length > 0 ? (
        <div className="space-y-1.5" key={`${keywordSeed}:${keywordRound}`}>
          <ToneWordPicker
            className="[&>div]:animate-[tone-review-button-in_140ms_ease-out_both]"
            onNext={showNextKeywordOptions}
            onToggleWord={toggleReviewKeyword}
            selectedWords={selectedKeywordSet}
            suggestions={keywordOptions}
          />
        </div>
      ) : null}
    </div>
  );

  const submitIconButton =
    selectedKeywords.length >= MIN_KEYWORDS_TO_SUBMIT ? (
      <button
        className="inline-flex items-center gap-2 rounded-full border border-primary bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-70"
        disabled={submitting}
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
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : null}
        {submitSucceeded ? "Saved" : "Submit"}
      </button>
    ) : null;

  const selectedKeywordRow =
    selectedKeywords.length > 0 ? (
      <div className="pointer-events-auto flex w-full min-w-0 max-w-full items-end justify-between gap-2 overflow-hidden">
        <div className="flex min-w-0 flex-1 gap-2" style={{ flexWrap: "wrap-reverse" }}>
          {selectedKeywords.map((keyword) => (
            <button
              className="rounded-full border border-white/80 bg-white/85 px-3 py-1.5 text-sm text-black shadow-sm transition hover:bg-white"
              key={keyword}
              onClick={() => toggleReviewKeyword(keyword)}
              title={`Remove ${keyword} from this review.`}
              type="button"
            >
              {keyword}
            </button>
          ))}
        </div>
        {submitIconButton}
      </div>
    ) : null;

  const isAudioReview = media.targetType === "audio";

  return (
    <section className="space-y-6">
      <div className="space-y-6">
        <div className="relative">
          {media.targetType === "combo" ? (
            <ComboToneReviewPlayer
              combo={{
                comboId: media.id,
                videoAssetId: target.sourceVideoAssetId ?? "",
                audioAssetId: target.sourceAudioAssetId ?? "",
                videoTitle: media.videoTitle,
                audioTitle: media.audioTitle,
                videoSrc: media.videoSrc,
                audioSrc: media.audioSrc,
              }}
              loadingNext={loadingNext}
              onNext={loadNextCombo}
              onSubmit={(payload) => submitComboReview(payload)}
            />
          ) : isAudioReview ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-black p-4 shadow-sm sm:p-6">{keywordPicker}</div>
              <ReviewMediaPlayer {...media} />
              {selectedKeywordRow ? (
                <div className="pointer-events-none rounded-xl bg-black p-4 shadow-sm sm:p-6">
                  {selectedKeywordRow}
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <ReviewMediaPlayer {...media} />
              <div className="pointer-events-none absolute inset-x-0 top-0 z-40 px-4 py-4 sm:px-6 sm:py-6">
                {keywordPicker}
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 px-4 py-4 sm:px-6 sm:py-6">
                {selectedKeywordRow}
              </div>
            </>
          )}
          {media.targetType !== "combo" && loadingNext ? (
            <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-black/20">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/35 border-t-white" />
            </div>
          ) : null}
        </div>

        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>

      <section className="rounded-xl border bg-card p-4 shadow-sm">
        <h2 className="text-sm font-semibold">Reviews For This {target.label}</h2>
        <div className="mt-3 space-y-2">
          {targetReviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No reviews for this {target.label.toLowerCase()} yet.
            </p>
          ) : null}
          {targetReviews.map(({ review }) => (
            <div className="rounded-lg border px-3 py-2 text-sm" key={review.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{new Date(review.createdAt).toLocaleString()}</span>
                <span className="text-xs text-muted-foreground">{review.reviewSource}</span>
              </div>
              {review.keywords.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {review.keywords.map((keyword) => (
                    <span className="rounded-full border px-2 py-0.5 text-xs" key={keyword}>
                      {keyword}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
