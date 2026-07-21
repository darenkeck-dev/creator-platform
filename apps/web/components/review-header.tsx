"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";

type ReviewTargetType = "combo" | "audio" | "video";

type Props = {
  targetType: ReviewTargetType;
  currentTargetId?: string;
  currentAudioAssetId?: string;
  showNext?: boolean;
};

export function ReviewHeader({ targetType, currentTargetId, currentAudioAssetId, showNext = true }: Props) {
  const router = useRouter();
  const [loadingNext, setLoadingNext] = useState(false);

  function loadNext() {
    setLoadingNext(true);
    window.dispatchEvent(new Event("review:next-loading"));
    const params = new URLSearchParams({ targetType, next: String(Date.now()) });
    if (currentTargetId) {
      params.set("previousTargetId", currentTargetId);
    }
    if (currentAudioAssetId) {
      params.set("previousAudioAssetId", currentAudioAssetId);
    }
    router.push(`/review?${params.toString()}`);
    router.refresh();
  }

  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Review</h1>
        <div className="flex rounded-lg border bg-background p-1">
          {(["combo", "audio", "video"] as const).map((nextTargetType) => (
            <Link
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition",
                nextTargetType === targetType
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              href={`/review?targetType=${nextTargetType}`}
              key={nextTargetType}
            >
              {nextTargetType === "combo" ? "Combo" : nextTargetType === "audio" ? "Audio" : "Video"}
            </Link>
          ))}
        </div>
      </div>
      {showNext ? (
        <button
          className="rounded-lg border border-primary bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-70"
          disabled={loadingNext}
          onClick={loadNext}
          type="button"
        >
          Next
        </button>
      ) : null}
    </header>
  );
}
