"use client";

import type { AssetDetailResponse, ToneReviewTargetType } from "@media-manager/contracts";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Asset = AssetDetailResponse["asset"];
type ToneScores = NonNullable<NonNullable<Asset["toneAnalysis"]>["scores"]>;
type ToneScoreKey = keyof ToneScores;

type ReviewTarget = {
  targetType: ToneReviewTargetType;
  targetId: string;
  label: string;
  taxonomyVersion?: "tone-taxonomy/v1" | "tone-taxonomy/v2";
};

type Props = {
  title?: string;
  description?: string;
  targets: ReviewTarget[];
};

const SCORE_KEYS: Array<[ToneScoreKey, string]> = [
  ["valence", "Valence"],
  ["arousal", "Arousal"],
  ["dominance", "Dominance"],
  ["warmth", "Warmth"],
  ["tension", "Tension"],
  ["intimacy", "Intimacy"],
  ["instability", "Instability"],
  ["nostalgia", "Nostalgia"],
  ["beauty", "Beauty"],
  ["menace", "Menace"],
];

function parseKeywords(input: string) {
  return [...new Set(input.split(/[\n,]/).map((keyword) => keyword.trim()).filter(Boolean))];
}

function initialScoreState(): Record<ToneScoreKey, number> {
  return Object.fromEntries(
    SCORE_KEYS.map(([key]) => [key, 0])
  ) as Record<ToneScoreKey, number>;
}

export function ToneReviewPanel({
  title = "Tone Review",
  description = "Add human keywords and tone scores for this target.",
  targets,
}: Props) {
  const [selectedTargetKey, setSelectedTargetKey] = useState("0");
  const selectedTarget = targets[Number(selectedTargetKey)] ?? targets[0];
  const [keywordsByTarget, setKeywordsByTarget] = useState<Record<string, string>>(() =>
    Object.fromEntries(targets.map((_, index) => [String(index), ""]))
  );
  const [scoresByTarget, setScoresByTarget] = useState<Record<string, Record<ToneScoreKey, number>>>(
    () => Object.fromEntries(targets.map((_, index) => [String(index), initialScoreState()]))
  );
  const [notesByTarget, setNotesByTarget] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!selectedTarget) {
    return null;
  }

  const scores = scoresByTarget[selectedTargetKey] ?? initialScoreState();
  const keywordValue = keywordsByTarget[selectedTargetKey] ?? "";
  const notes = notesByTarget[selectedTargetKey] ?? "";

  async function submitReview() {
    setSubmitting(true);
    setMessage(null);

    try {
      const response = await fetch("/api/tone-reviews", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetType: selectedTarget.targetType,
          targetId: selectedTarget.targetId,
          reviewSource: "curator",
          ...(selectedTarget.taxonomyVersion
            ? { taxonomyVersion: selectedTarget.taxonomyVersion }
            : {}),
          keywords: parseKeywords(keywordValue),
          scores,
          ...(notes.trim() ? { notes: notes.trim() } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit tone review");
      }

      setMessage("Review submitted.");
    } catch {
      setMessage("Could not submit review. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        {targets.length > 1 ? (
          <Select onValueChange={setSelectedTargetKey} value={selectedTargetKey}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Review target" />
            </SelectTrigger>
            <SelectContent>
              {targets.map((target, index) => (
                <SelectItem key={`${target.targetType}-${target.targetId}`} value={String(index)}>
                  {target.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      <div className="mt-5 space-y-5">
        <div>
          <label className="text-sm font-medium" htmlFor="tone-review-keywords">
            Keywords
          </label>
          <Textarea
            className="mt-2"
            id="tone-review-keywords"
            onChange={(event) =>
              setKeywordsByTarget((previous) => ({
                ...previous,
                [selectedTargetKey]: event.target.value,
              }))
            }
            placeholder="calm, warm, intimate"
            value={keywordValue}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Separate keywords with commas or new lines.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {SCORE_KEYS.map(([key, label]) => (
            <label className="block text-sm" key={key}>
              <div className="mb-1 flex items-center justify-between gap-3">
                <span className="font-medium">{label}</span>
                <span className="tabular-nums text-muted-foreground">{scores[key].toFixed(2)}</span>
              </div>
              <input
                className="w-full accent-primary"
                max="1"
                min="-1"
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setScoresByTarget((previous) => ({
                    ...previous,
                    [selectedTargetKey]: { ...scores, [key]: value },
                  }));
                }}
                step="0.05"
                type="range"
                value={scores[key]}
              />
            </label>
          ))}
        </div>

        <div>
          <label className="text-sm font-medium" htmlFor="tone-review-notes">
            Notes
          </label>
          <Textarea
            className="mt-2"
            id="tone-review-notes"
            onChange={(event) =>
              setNotesByTarget((previous) => ({ ...previous, [selectedTargetKey]: event.target.value }))
            }
            placeholder="Optional review notes"
            value={notes}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button disabled={submitting} onClick={() => void submitReview()} type="button">
            {submitting ? "Submitting..." : "Submit Review"}
          </Button>
          {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
        </div>
      </div>
    </section>
  );
}
