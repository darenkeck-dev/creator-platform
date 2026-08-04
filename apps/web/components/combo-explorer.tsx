"use client";

import {
  PublicComboSelectionResponseSchema,
  type PublicComboSelectionRequest,
  type PublicComboSelectionResponse,
  type PublicRandomComboResponse,
} from "@media-manager/contracts";
import {
  EMPTY_COMBO_EXPLORER_HISTORY,
  ToneWordPicker,
  ToneWordSubmitPile,
  advanceComboExplorerHistory,
  buildComboSearchRequest,
  buildComboWalkRequest,
  useToneWordPicker,
  type ComboExplorerHistory,
} from "@media-manager/shared";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ComboPlayer } from "@/components/combo-player";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ExplorerCombo = Pick<
  PublicComboSelectionResponse,
  | "comboId"
  | "videoAssetId"
  | "audioAssetId"
  | "videoTitle"
  | "audioTitle"
  | "videoSrc"
  | "audioSrc"
>;

const MIN_KEYWORDS_TO_SUBMIT = 3;

export function ComboExplorer({
  initialCombo,
}: {
  initialCombo: PublicRandomComboResponse | null;
}) {
  const [combo, setCombo] = useState<ExplorerCombo | null>(initialCombo);
  const [history, setHistory] = useState<ComboExplorerHistory>(EMPTY_COMBO_EXPLORER_HISTORY);
  const [selection, setSelection] = useState<PublicComboSelectionResponse["selection"] | null>(
    null
  );
  const [pendingMode, setPendingMode] = useState<"search" | "walk" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoWalk, setAutoWalk] = useState(true);
  const picker = useToneWordPicker({
    seed: "combo-explorer",
    explorationMode: "distinct-other-roots",
    maxSelectedWords: 6,
  });

  async function requestSelection(request: PublicComboSelectionRequest) {
    const response = await fetch("/api/public/combos/select", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    const json = (await response.json()) as unknown;
    if (!response.ok) {
      const message =
        json && typeof json === "object" && "message" in json && typeof json.message === "string"
          ? json.message
          : `Combo selection failed (${response.status})`;
      throw new Error(message);
    }
    return PublicComboSelectionResponseSchema.parse(json);
  }

  async function search() {
    if (picker.selectedWords.length === 0 || pendingMode) return;
    setPendingMode("search");
    setError(null);
    try {
      const result = await requestSelection(buildComboSearchRequest(picker.selectedWords));
      setCombo(result);
      setSelection(result.selection);
      setHistory(EMPTY_COMBO_EXPLORER_HISTORY);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Tone search failed");
    } finally {
      setPendingMode(null);
    }
  }

  async function walk() {
    if (!combo || pendingMode) return;
    setPendingMode("walk");
    setError(null);
    try {
      const result = await requestSelection(buildComboWalkRequest(combo, history));
      setHistory((previous) => advanceComboExplorerHistory(previous, combo));
      setCombo(result);
      setSelection(result.selection);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Walk failed");
    } finally {
      setPendingMode(null);
    }
  }

  const reviewHref = combo
    ? `/review?targetType=combo&comboId=${encodeURIComponent(combo.comboId)}&videoAssetId=${encodeURIComponent(combo.videoAssetId)}&audioAssetId=${encodeURIComponent(combo.audioAssetId)}`
    : null;

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="border-b px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-semibold">Combo Explorer</h2>
            <p className="text-sm text-muted-foreground">
              Choose the overall feeling, find a matching pair, then walk through nearby tones.
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            History {history.recentComboIds.length}/5 combos · {history.recentAudioAssetIds.length}
            /3 audio
          </p>
        </div>
      </div>

      <div className="relative min-h-[420px] bg-black" style={{ height: "min(68vh, 680px)" }}>
        {combo ? (
          <ComboPlayer
            audioSrc={combo.audioSrc}
            audioTitle={combo.audioTitle}
            autoPlay
            className="h-full w-full"
            comboId={combo.comboId}
            defaultAudioMuted={false}
            key={combo.comboId}
            onTimelineEnded={() => {
              if (autoWalk) void walk();
            }}
            preload="auto"
            showBuiltInMuteControl
            variant="background"
            videoSrc={combo.videoSrc}
            videoTitle={combo.videoTitle}
          />
        ) : (
          <div className="flex h-full min-h-[420px] items-center justify-center px-6 text-center text-sm text-white/60">
            Select tone words below to find the first public combination.
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 z-[120] px-4 py-4 sm:px-6 sm:py-6">
          <ToneWordPicker
            className="pointer-events-auto"
            onNext={picker.showNextSuggestions}
            onToggleWord={picker.toggleWord}
            selectedWords={picker.selectedWordSet}
            suggestions={picker.suggestions}
            variant="combo-overlay"
          />
        </div>

        {picker.selectedWords.length > 0 ? (
          <div
            className="pointer-events-none"
            style={{
              bottom: 24,
              left: 24,
              maxWidth: "calc(100% - 3rem)",
              position: "absolute",
              zIndex: 120,
            }}
          >
            <ToneWordSubmitPile
              maxColumns={2}
              onSubmit={() => void search()}
              onToggleWord={picker.toggleWord}
              selectedWords={picker.selectedWords}
              submitDisabled={
                pendingMode !== null || picker.selectedWords.length < MIN_KEYWORDS_TO_SUBMIT
              }
              submitTitle="Start tone walk"
              submitting={pendingMode === "search"}
              wordTitle={(keyword) => `Remove ${keyword} from this walk.`}
            />
          </div>
        ) : null}
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={!combo || pendingMode !== null} onClick={walk} variant="outline">
            <ArrowRight aria-hidden="true" className="h-4 w-4" />
            {pendingMode === "walk" ? "Walking…" : "Walk nearby"}
          </Button>
          {reviewHref ? (
            <Link className={cn(buttonVariants({ variant: "ghost" }))} href={reviewHref}>
              Review this combo
            </Link>
          ) : null}
          <label className="ml-auto inline-flex items-center gap-2 text-xs text-muted-foreground">
            <input
              checked={autoWalk}
              className="h-4 w-4 rounded border"
              onChange={(event) => setAutoWalk(event.target.checked)}
              type="checkbox"
            />
            Walk when playback ends
          </label>
        </div>

        {error ? (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        {combo ? (
          <div className="grid gap-3 border-t pt-4 text-sm sm:grid-cols-[minmax(0,1fr)_auto]">
            <div>
              <p className="font-medium">
                {combo.videoTitle} <span className="text-muted-foreground">+</span>{" "}
                {combo.audioTitle}
              </p>
              <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                {combo.videoAssetId} / {combo.audioAssetId}
              </p>
            </div>
            <SelectionDiagnostics selection={selection} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SelectionDiagnostics({
  selection,
}: {
  selection: PublicComboSelectionResponse["selection"] | null;
}) {
  if (!selection) {
    return <p className="text-xs text-muted-foreground">Random starting pair</p>;
  }

  return (
    <div className="text-xs text-muted-foreground sm:text-right">
      <p>
        {selection.requestedMode} → {selection.resolvedMode}
      </p>
      {"distance" in selection ? <p>distance {selection.distance.toFixed(4)}</p> : null}
      {"fallbackReason" in selection ? (
        <p>{selection.fallbackReason.replaceAll("_", " ")}</p>
      ) : null}
      <p>{selection.predictorVersion}</p>
    </div>
  );
}
