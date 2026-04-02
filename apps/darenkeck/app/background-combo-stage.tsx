"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PublicRandomComboResponseSchema } from "@media-manager/contracts";
import { ComboPlayer } from "@media-manager/shared";

type BackgroundComboStageProps = {
  comboId?: string;
  videoTitle: string;
  audioTitle: string;
  videoSrc: string;
  audioSrc: string;
};

type ComboPayload = {
  comboId: string;
  videoTitle: string;
  audioTitle: string;
  videoSrc: string;
  audioSrc: string;
};

const slotList = ["a", "b"] as const;
const showDebugHud = true;
const RECOVERY_RETRY_MS = 1500;
const enableRecoveryRetry = false;

type SlotKey = (typeof slotList)[number];

type SlotState = {
  combo: ComboPayload | null;
  ready: boolean;
  phase: string;
  error: string | null;
  loadCount: number;
};

function logStage(event: string, details: Record<string, unknown>) {
  console.log("[BackgroundComboStage]", event, {
    slots: slotList.join(","),
    ...details,
  });
}

function summarizeSlots(slots: Record<SlotKey, SlotState>) {
  return slotList.map((slot) => ({
    slot,
    comboId: slots[slot]?.combo?.comboId ?? null,
    ready: slots[slot]?.ready ?? false,
    phase: slots[slot]?.phase ?? "unknown",
    error: slots[slot]?.error ?? null,
    loadCount: slots[slot]?.loadCount ?? 0,
  }));
}

function buildInitialSlots(initialCombo: ComboPayload | null): Record<SlotKey, SlotState> {
  return slotList.reduce(
    (accumulator, slot, index) => {
      accumulator[slot] = {
        combo: index === 0 ? initialCombo : null,
        ready: false,
        phase: "idle",
        error: null,
        loadCount: 0,
      };
      return accumulator;
    },
    {} as Record<SlotKey, SlotState>
  );
}

function getNextSlot(activeSlot: SlotKey): SlotKey {
  const index = slotList.indexOf(activeSlot);
  if (index === -1) {
    return slotList[0];
  }

  return slotList[(index + 1) % slotList.length];
}

async function fetchRandomPublicCombo(excludeComboIds: Set<string>): Promise<ComboPayload | null> {
  let fallback: ComboPayload | null = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    let response: Response;
    try {
      response = await fetch("/api/public/combos/random", {
        method: "GET",
        cache: "no-store",
      });
    } catch {
      return null;
    }

    if (!response.ok) {
      return null;
    }

    const parsed = PublicRandomComboResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      return null;
    }

    const candidate: ComboPayload = {
      comboId: parsed.data.comboId,
      videoTitle: parsed.data.videoTitle,
      audioTitle: parsed.data.audioTitle,
      videoSrc: parsed.data.videoSrc,
      audioSrc: parsed.data.audioSrc,
    };

    if (!excludeComboIds.has(candidate.comboId)) {
      return candidate;
    }

    if (!fallback) {
      fallback = candidate;
    }
  }

  return fallback;
}

export function BackgroundComboStage({
  comboId,
  videoTitle,
  audioTitle,
  videoSrc,
  audioSrc,
}: BackgroundComboStageProps) {
  const initialCombo = useMemo<ComboPayload | null>(() => {
    if (!comboId) {
      return null;
    }

    return {
      comboId,
      videoTitle,
      audioTitle,
      videoSrc,
      audioSrc,
    };
  }, [audioSrc, audioTitle, comboId, videoSrc, videoTitle]);

  const [isAudioMuted, setIsAudioMuted] = useState(true);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [activeSlot, setActiveSlot] = useState<SlotKey>(slotList[0]);
  const [slots, setSlots] = useState<Record<SlotKey, SlotState>>(() =>
    buildInitialSlots(initialCombo)
  );
  const slotsRef = useRef(slots);
  const activeSlotRef = useRef(activeSlot);
  const fetchInFlightRef = useRef<Set<SlotKey>>(new Set());
  const pendingSwapFromSlotRef = useRef<SlotKey | null>(null);
  const recoveryTimerRef = useRef<number | null>(null);

  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

  useEffect(() => {
    activeSlotRef.current = activeSlot;
  }, [activeSlot]);

  useEffect(() => {
    setActiveSlot(slotList[0]);
    setSlots(buildInitialSlots(initialCombo));
    pendingSwapFromSlotRef.current = null;
    if (recoveryTimerRef.current !== null) {
      window.clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
    logStage("reset.initial", {
      initialComboId: initialCombo?.comboId ?? null,
    });
  }, [initialCombo]);

  useEffect(() => {
    return () => {
      if (recoveryTimerRef.current !== null) {
        window.clearTimeout(recoveryTimerRef.current);
        recoveryTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setVideoElement(null);
  }, [activeSlot]);

  useEffect(() => {
    logStage("state.snapshot", {
      activeSlot,
      slots: summarizeSlots(slots),
    });
  }, [activeSlot, slots]);

  const label = isAudioMuted ? "Unmute audio" : "Mute audio";

  const queuedSlot = slotList.length > 1 ? getNextSlot(activeSlot) : null;
  const activeState = slots[activeSlot];
  const queuedState = queuedSlot ? slots[queuedSlot] : null;
  const queuedCombo = queuedState?.combo ?? null;
  const queuedReady = queuedState?.ready ?? false;

  const fetchIntoSlot = useCallback(async (slot: SlotKey, reason: string): Promise<boolean> => {
    if (fetchInFlightRef.current.has(slot)) {
      logStage("slot.fetch.skip.in-flight", { slot, reason });
      return false;
    }

    fetchInFlightRef.current.add(slot);
    logStage("slot.fetch.start", { slot, reason });
    try {
      const exclude = new Set<string>();
      for (const candidateSlot of slotList) {
        const comboId = slotsRef.current[candidateSlot]?.combo?.comboId;
        if (comboId) {
          exclude.add(comboId);
        }
      }

      const nextCombo = await fetchRandomPublicCombo(exclude);
      if (!nextCombo) {
        setSlots((previous) => ({
          ...previous,
          [slot]: {
            ...previous[slot],
            ready: false,
            phase: "error",
            error: "fetch_random_combo_failed",
            loadCount: previous[slot].loadCount + 1,
          },
        }));
        logStage("slot.fetch.failed", { slot, reason });
        return false;
      }

      setSlots((previous) => ({
        ...previous,
        [slot]: {
          ...previous[slot],
          combo: nextCombo,
          ready: false,
          phase: "loading",
          error: null,
          loadCount: previous[slot].loadCount + 1,
        },
      }));
      logStage("slot.fetch.assigned", {
        slot,
        reason,
        comboId: nextCombo.comboId,
      });
      return true;
    } finally {
      fetchInFlightRef.current.delete(slot);
    }
  }, []);

  const performSwap = useCallback((fromSlot: SlotKey, toSlot: SlotKey, reason: string) => {
    const nextState = slotsRef.current[toSlot];
    if (!nextState?.combo || !nextState.ready) {
      return false;
    }

    if (recoveryTimerRef.current !== null) {
      window.clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
    pendingSwapFromSlotRef.current = null;
    setActiveSlot(toSlot);
    setSlots((previous) => ({
      ...previous,
      [fromSlot]: {
        ...previous[fromSlot],
        combo: null,
        ready: false,
        phase: "idle",
        error: null,
      },
    }));
    logStage("timeline.swap", {
      reason,
      fromSlot,
      toSlot,
      toComboId: nextState.combo.comboId,
    });
    return true;
  }, []);

  const prefetchNextCombo = useCallback(
    async (baseActiveSlot?: SlotKey) => {
      if (slotList.length <= 1) {
        logStage("prefetch.skip.single-slot", {
          activeSlot: activeSlotRef.current,
        });
        return;
      }

      const currentActive = baseActiveSlot ?? activeSlotRef.current;
      const targetSlot = getNextSlot(currentActive);
      const targetState = slotsRef.current[targetSlot];
      if (targetState?.combo && !targetState.error) {
        return;
      }

      if (targetState?.error) {
        setSlots((previous) => ({
          ...previous,
          [targetSlot]: {
            ...previous[targetSlot],
            combo: null,
            ready: false,
            phase: "idle",
            error: null,
          },
        }));
      }

      void fetchIntoSlot(targetSlot, "prefetch-next");
    },
    [fetchIntoSlot]
  );

  const scheduleRecoveryRetry = useCallback(
    (fromSlot: SlotKey) => {
      if (!enableRecoveryRetry) {
        return;
      }

      if (slotList.length <= 1) {
        return;
      }

      if (recoveryTimerRef.current !== null) {
        window.clearTimeout(recoveryTimerRef.current);
      }

      recoveryTimerRef.current = window.setTimeout(() => {
        recoveryTimerRef.current = null;
        if (activeSlotRef.current !== fromSlot) {
          return;
        }

        const targetSlot = getNextSlot(fromSlot);
        const targetState = slotsRef.current[targetSlot];
        logStage("timeline.recovery.retry", {
          fromSlot,
          targetSlot,
          targetComboId: targetState?.combo?.comboId ?? null,
          targetReady: targetState?.ready ?? false,
          targetPhase: targetState?.phase ?? "unknown",
        });

        if (targetState?.ready && targetState.combo) {
          const swapped = performSwap(fromSlot, targetSlot, "recovery-ready");
          if (swapped) {
            void prefetchNextCombo(targetSlot);
          }
          return;
        }

        if (!targetState?.combo || targetState.phase === "error") {
          if (targetState?.phase === "error") {
            setSlots((previous) => ({
              ...previous,
              [targetSlot]: {
                ...previous[targetSlot],
                combo: null,
                ready: false,
                phase: "idle",
                error: null,
              },
            }));
          }
          void fetchIntoSlot(targetSlot, "recovery-retry");
        }

        scheduleRecoveryRetry(fromSlot);
      }, RECOVERY_RETRY_MS);
    },
    [fetchIntoSlot, performSwap, prefetchNextCombo]
  );

  useEffect(() => {
    void prefetchNextCombo();
  }, [prefetchNextCombo]);

  const handleTimelineEnded = useCallback(() => {
    const currentActive = activeSlotRef.current;

    if (slotList.length <= 1) {
      setSlots((previous) => ({
        ...previous,
        [currentActive]: {
          ...previous[currentActive],
          combo: null,
          ready: false,
          phase: "loading",
          error: null,
        },
      }));
      logStage("timeline.ended.single-slot.refetch", {
        activeSlot: currentActive,
        activeComboId: slotsRef.current[currentActive]?.combo?.comboId ?? null,
      });
      void fetchIntoSlot(currentActive, "single-slot-ended");
      return;
    }

    const targetSlot = getNextSlot(currentActive);
    const nextState = slotsRef.current[targetSlot];

    if (!nextState?.combo || !nextState.ready) {
      pendingSwapFromSlotRef.current = currentActive;
      logStage("timeline.ended.blocked.no-ready-slot", {
        activeSlot: currentActive,
        targetSlot,
        targetComboId: nextState?.combo?.comboId ?? null,
        targetReady: nextState?.ready ?? false,
        targetPhase: nextState?.phase ?? "unknown",
      });
      if (!nextState?.combo || nextState.phase === "error") {
        if (nextState?.phase === "error") {
          setSlots((previous) => ({
            ...previous,
            [targetSlot]: {
              ...previous[targetSlot],
              combo: null,
              ready: false,
              phase: "idle",
              error: null,
            },
          }));
        }
        void fetchIntoSlot(targetSlot, "timeline-ended-recovery");
      }
      scheduleRecoveryRetry(currentActive);
      return;
    }

    const swapped = performSwap(currentActive, targetSlot, "timeline-ended");
    if (swapped) {
      void prefetchNextCombo(targetSlot);
    }
  }, [fetchIntoSlot, performSwap, prefetchNextCombo, scheduleRecoveryRetry]);

  const handleSlotReady = useCallback(
    (slot: SlotKey) => {
      setSlots((previous) => ({
        ...previous,
        [slot]: {
          ...previous[slot],
          ready: true,
          phase: "ready",
          error: null,
        },
      }));
      logStage("slot.ready", {
        slot,
        comboId: slotsRef.current[slot]?.combo?.comboId ?? null,
      });

      const pendingFromSlot = pendingSwapFromSlotRef.current;
      if (pendingFromSlot && activeSlotRef.current === pendingFromSlot) {
        const pendingTarget = getNextSlot(pendingFromSlot);
        if (slot === pendingTarget) {
          const swapped = performSwap(pendingFromSlot, pendingTarget, "queued-ready-after-ended");
          if (swapped) {
            void prefetchNextCombo(pendingTarget);
            return;
          }
        }
      }

      if (slot === activeSlotRef.current) {
        void prefetchNextCombo();
      }
    },
    [performSwap, prefetchNextCombo]
  );

  const handleSlotPhaseChange = useCallback((slot: SlotKey, phase: string) => {
    setSlots((previous) => ({
      ...previous,
      [slot]: {
        ...previous[slot],
        phase,
      },
    }));
  }, []);

  const handleSlotError = useCallback(
    (
      slot: SlotKey,
      error: {
        kind: "video" | "audio" | "autoplay" | "sync";
        message: string;
      }
    ) => {
      setSlots((previous) => ({
        ...previous,
        [slot]: {
          ...previous[slot],
          ready: false,
          phase: "error",
          error: `${error.kind}: ${error.message}`,
        },
      }));
      logStage("slot.error", {
        slot,
        comboId: slotsRef.current[slot]?.combo?.comboId ?? null,
        kind: error.kind,
        message: error.message,
      });

      if (slot !== activeSlotRef.current && slotList.length > 1) {
        setSlots((previous) => ({
          ...previous,
          [slot]: {
            ...previous[slot],
            combo: null,
            ready: false,
            phase: "idle",
          },
        }));
        void prefetchNextCombo();
        const pendingFrom = pendingSwapFromSlotRef.current;
        if (pendingFrom && activeSlotRef.current === pendingFrom) {
          scheduleRecoveryRetry(pendingFrom);
        }
      }
    },
    [prefetchNextCombo, scheduleRecoveryRetry]
  );

  const handleActiveTimeUpdate = useCallback(
    (snapshot: { remaining: number }) => {
      if (snapshot.remaining <= 18) {
        void prefetchNextCombo();
      }
    },
    [prefetchNextCombo]
  );

  const activeDeckClass = "absolute inset-0 z-[1]";
  const hiddenDeckClass = "pointer-events-none absolute inset-0 z-0 opacity-0";

  return (
    <>
      <button
        aria-label={label}
        className="pointer-events-auto fixed z-50 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/40 bg-black/45 text-white shadow-lg backdrop-blur-sm [left:max(1.5rem,env(safe-area-inset-left))] [top:max(1.5rem,env(safe-area-inset-top))]"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsAudioMuted((previous) => !previous);
        }}
        title={label}
        type="button"
      >
        <svg
          aria-hidden="true"
          fill="none"
          height="24"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="24"
        >
          <path d="M11 5L6 9H3v6h3l5 4V5z" />
          {isAudioMuted ? (
            <>
              <path d="M16 9l5 6" />
              <path d="M21 9l-5 6" />
            </>
          ) : (
            <>
              <path d="M16 10.5c1 .8 1.5 2 1.5 3.5s-.5 2.7-1.5 3.5" />
              <path d="M18.8 7.7c1.7 1.5 2.7 3.8 2.7 6.3s-1 4.8-2.7 6.3" />
            </>
          )}
        </svg>
      </button>

      {slotList.map((slot) => {
        const slotState = slots[slot];
        if (!slotState?.combo) {
          return null;
        }

        const isActive = slot === activeSlot;

        return (
          <div className={isActive ? activeDeckClass : hiddenDeckClass} key={slot}>
            <ComboPlayer
              key={`${slot}-${slotState.combo.comboId}`}
              audioMuted={isAudioMuted}
              audioSrc={slotState.combo.audioSrc}
              audioTitle={slotState.combo.audioTitle}
              audioVolume={1}
              autoPlay={isActive}
              className="h-full w-full"
              comboId={slotState.combo.comboId}
              onPlaybackError={(error) => handleSlotError(slot, error)}
              onPlaybackReady={() => handleSlotReady(slot)}
              onPlaybackStateChange={(phase) => handleSlotPhaseChange(slot, phase)}
              onTimeUpdate={isActive ? handleActiveTimeUpdate : undefined}
              onTimelineEnded={isActive ? handleTimelineEnded : undefined}
              onVideoElementChange={isActive ? setVideoElement : undefined}
              preload="auto"
              suppressUi={!isActive}
              variant="background"
              videoSrc={slotState.combo.videoSrc}
              videoTitle={slotState.combo.videoTitle}
            />
          </div>
        );
      })}

      {!queuedCombo ? (
        <p className="pointer-events-none fixed bottom-4 left-4 z-40 rounded-md bg-black/45 px-2 py-1 text-[11px] text-white/90">
          Preloading next combo...
        </p>
      ) : null}

      {showDebugHud ? (
        <aside className="pointer-events-none fixed bottom-3 right-3 z-50 w-[min(92vw,460px)] rounded-md border border-white/30 bg-black/65 p-2 font-mono text-[10px] leading-relaxed text-white/90 backdrop-blur-sm">
          <p>
            active: {activeSlot} | queued: {queuedSlot ?? "n/a"} | queuedReady:{" "}
            {String(queuedReady)}
          </p>
          <p>
            activeCombo: {activeState?.combo?.comboId ?? "none"} | queuedCombo:{" "}
            {queuedCombo?.comboId ?? "none"}
          </p>
          <p>pendingSwapFrom: {pendingSwapFromSlotRef.current ?? "none"}</p>
          {slotList.map((slot) => {
            const slotState = slots[slot];
            return (
              <p key={`hud-${slot}`}>
                {slot}: combo={slotState.combo?.comboId ?? "none"} | ready={String(slotState.ready)}{" "}
                | phase={slotState.phase} | loads={slotState.loadCount}
                {slotState.error ? ` | error=${slotState.error}` : ""}
              </p>
            );
          })}
        </aside>
      ) : null}
    </>
  );
}
