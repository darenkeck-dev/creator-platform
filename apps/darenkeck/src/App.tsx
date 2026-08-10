import type {
  PublicComboPredictedTone,
  PublicComboSelectionRequest,
} from "@media-manager/contracts";
import { lazy, Suspense, useEffect, useEffectEvent, useRef, useState } from "react";
import { useLocation, useOutlet } from "react-router-dom";

import { BulletinSection } from "./components/BulletinSection";
import { LinksSection } from "./components/LinksSection";
import { ShellLoader } from "./components/ShellLoader";
import { ToneExplorer, ToneExplorerExplainer, ToneExplorerIcon } from "./components/ToneExplorer";
import {
  advanceJourney,
  journeyForKeywords,
  requestForJourney,
  type ComboJourney,
} from "./lib/combo-journey";
import {
  SingleSlotKey,
  SlotManager,
  type ComboPayload,
  type SlotManagerState,
  type SlotPlaybackState,
  type SlotPlaybackAssignment,
} from "./lib/slot-manager";
import { setPageMetadata } from "./lib/page-metadata";
import { isDocumentPath, isHomePath, isResumePrintMode } from "./lib/route-mode";
import {
  acknowledgeToneExplorer,
  hasAcknowledgedToneExplorer,
  type StorageLike,
} from "./lib/tone-explorer-preference";
import { TONE_WHEEL_DIMENSIONS } from "./lib/tone-wheel";

const SingleComboSlot = lazy(async () => {
  const module = await import("./components/SingleComboSlot");
  return { default: module.SingleComboSlot };
});

const ENABLE_DEBUG_LOGS = false;
const SHOW_LOCAL_DEBUG_CONTROLS = false;
const DOCUMENT_TRANSITION_MS = 400;

function DocumentRouteTransition({
  pathname,
  printMode,
}: {
  pathname: string;
  printMode: boolean;
}) {
  const outlet = useOutlet();
  const outletRef = useRef(outlet);
  const renderedPathRef = useRef(pathname);
  const [renderedOutlet, setRenderedOutlet] = useState(outlet);
  const [documentVisible, setDocumentVisible] = useState(printMode);
  outletRef.current = outlet;

  useEffect(() => {
    if (printMode) {
      renderedPathRef.current = pathname;
      setRenderedOutlet(outletRef.current);
      setDocumentVisible(true);
      return;
    }

    let frameId: number | null = null;
    let timeoutId: number | null = null;

    const nextIsDocument = isDocumentPath(pathname);
    const renderedIsDocument = isDocumentPath(renderedPathRef.current);

    if (nextIsDocument) {
      renderedPathRef.current = pathname;
      setRenderedOutlet(outletRef.current);
      if (renderedIsDocument) {
        setDocumentVisible(true);
      } else {
        setDocumentVisible(false);
        frameId = window.requestAnimationFrame(() => setDocumentVisible(true));
      }
    } else if (renderedIsDocument) {
      setDocumentVisible(false);
      timeoutId = window.setTimeout(() => {
        renderedPathRef.current = pathname;
        setRenderedOutlet(outletRef.current);
      }, DOCUMENT_TRANSITION_MS);
    } else {
      renderedPathRef.current = pathname;
      setRenderedOutlet(outletRef.current);
    }

    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [pathname, printMode]);

  return (
    <div
      aria-hidden={!documentVisible && isDocumentPath(renderedPathRef.current)}
      className={`min-h-dvh origin-bottom transition-[opacity,transform,filter] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none print:transform-none print:opacity-100 print:filter-none ${
        documentVisible
          ? "translate-y-0 scale-100 opacity-100 blur-none"
          : "pointer-events-none translate-y-6 scale-[0.985] opacity-0 blur-[2px]"
      }`}
      inert={!documentVisible}
    >
      {renderedOutlet}
    </div>
  );
}

function formatMediaDuration(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "?";
  }

  return value.toFixed(2);
}

function formatMediaSnapshot(element: HTMLMediaElement | null): string {
  if (!element) {
    return "unavailable";
  }

  return [
    `paused=${element.paused}`,
    `muted=${element.muted}`,
    `vol=${element.volume.toFixed(2)}`,
    `time=${element.currentTime.toFixed(2)}/${formatMediaDuration(element.duration)}`,
    `ready=${element.readyState}`,
    `network=${element.networkState}`,
  ].join(" | ");
}

function getErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    return `${error.name}: ${error.message}`;
  }
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}

function getApiBaseUrl(): string | null {
  const raw = import.meta.env.VITE_COMBO_API_BASE_URL ?? import.meta.env.VITE_API_BASE_URL;
  if (!raw) {
    return null;
  }

  if (import.meta.env.DEV) {
    return "";
  }

  return raw.replace(/\/$/, "");
}

function getToneExplorerStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function parsePredictedTone(value: unknown): PublicComboPredictedTone | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  const entries = TONE_WHEEL_DIMENSIONS.map(
    (dimension) => [dimension, candidate[dimension]] as const
  );
  if (
    entries.some(
      ([, score]) => typeof score !== "number" || !Number.isFinite(score) || score < -1 || score > 1
    )
  ) {
    return undefined;
  }
  return Object.fromEntries(entries) as PublicComboPredictedTone;
}

function parseComboPayload(payload: unknown): ComboPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const candidate = payload as Record<string, unknown>;
  if (
    typeof candidate.comboId !== "string" ||
    typeof candidate.videoAssetId !== "string" ||
    typeof candidate.audioAssetId !== "string" ||
    typeof candidate.videoTitle !== "string" ||
    typeof candidate.audioTitle !== "string" ||
    typeof candidate.videoSrc !== "string" ||
    typeof candidate.audioSrc !== "string"
  ) {
    return null;
  }
  const predictedTone = parsePredictedTone(candidate.predictedTone);
  return {
    comboId: candidate.comboId,
    videoAssetId: candidate.videoAssetId,
    audioAssetId: candidate.audioAssetId,
    videoTitle: candidate.videoTitle,
    audioTitle: candidate.audioTitle,
    videoSrc: candidate.videoSrc,
    audioSrc: candidate.audioSrc,
    ...(predictedTone ? { predictedTone } : {}),
  };
}

async function fetchRandomCombo(previousAudioAssetId?: string): Promise<ComboPayload | null> {
  const apiBaseUrl = getApiBaseUrl();

  if (!apiBaseUrl && !import.meta.env.DEV) {
    return null;
  }

  const query = previousAudioAssetId
    ? `?previousAudioAssetId=${encodeURIComponent(previousAudioAssetId)}`
    : "";
  const response = await fetch(`${apiBaseUrl}/public/combos/random${query}`, {
    method: "GET",
    cache: "no-store",
  });
  if (!response.ok) {
    return null;
  }

  return parseComboPayload(await response.json());
}

async function fetchSelectedCombo(
  request: PublicComboSelectionRequest
): Promise<ComboPayload | null> {
  const apiBaseUrl = getApiBaseUrl();
  if (!apiBaseUrl && !import.meta.env.DEV) {
    return null;
  }

  const response = await fetch(`${apiBaseUrl}/public/combos/select`, {
    method: "POST",
    cache: "no-store",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
  });
  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? String(payload.message)
        : `Combo selection failed (${response.status})`;
    throw new Error(message);
  }

  return parseComboPayload(payload);
}

function DarenKeckWordmark() {
  return (
    <span className="relative inline-flex items-center">
      <img
        alt="Daren Keck"
        className="h-12 w-auto"
        draggable={false}
        onDragStart={(event) => {
          event.preventDefault();
        }}
        src="/images/written_title_700.webp"
      />
      <span
        className="absolute inset-0 select-text text-transparent"
        style={{ userSelect: "text" }}
      >
        Daren Keck
      </span>
    </span>
  );
}

export function App() {
  type AudioLevel = "muted" | "full";

  const location = useLocation();
  const isHome = isHomePath(location.pathname);
  const printMode = isResumePrintMode(location.pathname, location.search);
  const [slotAssignment, setSlotAssignment] = useState<SlotPlaybackAssignment | null>(null);
  const [comboLoading, setComboLoading] = useState(false);
  const [comboError, setComboError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<AudioLevel>("muted");
  const [audioVolume, setAudioVolume] = useState(1);
  const [isBulletinOpen, setIsBulletinOpen] = useState(true);
  const [isToneExplorerOpen, setIsToneExplorerOpen] = useState(false);
  const [showToneExplorerExplainer, setShowToneExplorerExplainer] = useState(false);
  const [toneExplorerAcknowledged, setToneExplorerAcknowledged] = useState(false);
  const [playerEnabled, setPlayerEnabled] = useState(false);
  const [managerEnabled, setManagerEnabled] = useState(false);
  const [playbackPhase, setPlaybackPhase] = useState("loading");
  const [managerState, setManagerState] = useState<SlotManagerState>("idle");
  const [slotState, setSlotState] = useState<SlotPlaybackState>("idle");
  const [combosPlayedCount, setCombosPlayedCount] = useState(0);
  const [debugActionMessage, setDebugActionMessage] = useState<string | null>(null);
  const [debugSampleCount, setDebugSampleCount] = useState(0);
  const managerRef = useRef<SlotManager | null>(null);
  const toneExplorerButtonRef = useRef<HTMLButtonElement | null>(null);
  const journeyRef = useRef<ComboJourney>({ mode: "random" });
  const bulletinStateBeforeToneRef = useRef(true);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const previousPathRef = useRef(location.pathname);

  useEffect(() => {
    if (!isHome) {
      return;
    }
    setPageMetadata({
      title: "darenkeck",
      description: "Personal page for Daren Keck with music, links, and live combo visuals.",
      url: "https://darenkeck.com/",
    });
  }, [isHome]);

  useEffect(() => {
    setToneExplorerAcknowledged(hasAcknowledgedToneExplorer(getToneExplorerStorage()));
  }, []);

  useEffect(() => {
    if (printMode) {
      setPlayerEnabled(false);
      setManagerEnabled(false);
      return;
    }
    const frameId = window.requestAnimationFrame(() => {
      setPlayerEnabled(true);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [printMode]);

  useEffect(() => {
    if (!playerEnabled || printMode) {
      return;
    }

    const win = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };

    let timeoutId: number | null = null;
    let idleId: number | null = null;

    const enableManager = () => {
      setManagerEnabled(true);
    };

    if (typeof win.requestIdleCallback === "function") {
      idleId = win.requestIdleCallback(enableManager, { timeout: 800 });
    } else {
      timeoutId = window.setTimeout(enableManager, 500);
    }

    return () => {
      if (idleId !== null && typeof win.cancelIdleCallback === "function") {
        win.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [playerEnabled, printMode]);

  useEffect(() => {
    if (!SHOW_LOCAL_DEBUG_CONTROLS) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setDebugSampleCount((current) => current + 1);
    }, 500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!managerEnabled || printMode) {
      return;
    }

    const manager = new SlotManager({
      fetchNextCombo: async (currentCombo) => {
        const journey = journeyRef.current;
        const request = requestForJourney(journey, currentCombo);
        if (!request) {
          return fetchRandomCombo(currentCombo?.audioAssetId);
        }

        let next: ComboPayload | null = null;
        try {
          next = await fetchSelectedCombo(request);
          if (!next) {
            throw new Error("Combo selection returned an invalid payload");
          }
        } catch (error) {
          console.error("Tone selection failed; falling back to random playback", { error });
          const fallback = await fetchRandomCombo(currentCombo?.audioAssetId);
          if (fallback && journeyRef.current === journey) {
            journeyRef.current = { mode: "random" };
          }
          return fallback;
        }
        if (next && journeyRef.current === journey) {
          journeyRef.current = advanceJourney(journey, currentCombo);
        }
        return next;
      },
      events: {
        onComboChanged: setSlotAssignment,
        onLoadingChange: setComboLoading,
        onError: setComboError,
        onManagerStateChange: setManagerState,
        onSlotStateChange: (_slot, state) => {
          setSlotState(state);
        },
        onCombosPlayedChange: setCombosPlayedCount,
        onDebug: (event, data) => {
          if (ENABLE_DEBUG_LOGS) {
            console.log("[darenkeck][SlotManager]", event, data ?? {});
          }
        },
      },
    });
    managerRef.current = manager;
    void manager.init();

    return () => {
      manager.destroy();
      if (managerRef.current === manager) {
        managerRef.current = null;
      }
    };
  }, [managerEnabled, printMode]);

  const handleTimelineEnded = () => {
    void managerRef.current?.handleSlotPlaybackEnded(SingleSlotKey.Primary);
  };

  const openToneExplorer = () => {
    if (isToneExplorerOpen) {
      return;
    }
    bulletinStateBeforeToneRef.current = isBulletinOpen;
    setIsBulletinOpen(false);
    setIsToneExplorerOpen(true);
  };

  const closeToneExplorer = () => {
    setIsToneExplorerOpen(false);
    setIsBulletinOpen(bulletinStateBeforeToneRef.current);
  };

  const closeToneExplorerForNavigation = useEffectEvent(() => {
    setShowToneExplorerExplainer(false);
    if (!isToneExplorerOpen) {
      return;
    }
    setIsToneExplorerOpen(false);
    setIsBulletinOpen(bulletinStateBeforeToneRef.current);
  });

  useEffect(() => {
    if (previousPathRef.current === location.pathname) {
      return;
    }
    previousPathRef.current = location.pathname;
    closeToneExplorerForNavigation();
  }, [location.pathname]);

  const handleBulletinMaximize = () => {
    setIsToneExplorerOpen(false);
    setIsBulletinOpen(true);
  };

  const handleToneExplorerToggle = () => {
    if (isToneExplorerOpen) {
      closeToneExplorer();
      return;
    }
    if (toneExplorerAcknowledged || hasAcknowledgedToneExplorer(getToneExplorerStorage())) {
      setToneExplorerAcknowledged(true);
      openToneExplorer();
      return;
    }
    setShowToneExplorerExplainer(true);
  };

  const handleToneExplorerAccept = () => {
    acknowledgeToneExplorer(getToneExplorerStorage());
    setToneExplorerAcknowledged(true);
    setShowToneExplorerExplainer(false);
    openToneExplorer();
  };

  const handleToneSubmit = (keywords: string[]) => {
    if (comboLoading || !managerRef.current) {
      return;
    }
    journeyRef.current = journeyForKeywords(
      keywords,
      journeyRef.current,
      slotAssignment?.combo ?? null
    );
    void managerRef.current.requestNext();
  };

  const handlePlaybackReady = () => {
    managerRef.current?.handleSlotPlaybackReady(SingleSlotKey.Primary);
  };

  const handlePlaybackStateChange = (phase: string) => {
    setPlaybackPhase(phase);
    managerRef.current?.handleSlotPlaybackPhaseChange(SingleSlotKey.Primary, phase);
  };

  const handlePauseBothForDebug = () => {
    videoElementRef.current?.pause();
    audioElementRef.current?.pause();
    setDebugActionMessage("Paused both media elements");
  };

  const handleSyncAudioForDebug = () => {
    const video = videoElementRef.current;
    const audio = audioElementRef.current;
    if (!video || !audio) {
      setDebugActionMessage("Cannot sync: media elements unavailable");
      return;
    }

    audio.currentTime = video.currentTime;
    setDebugActionMessage(`Synced audio to video @ ${video.currentTime.toFixed(2)}s`);
  };

  const handleProbePlaybackForDebug = async () => {
    const results: string[] = [];

    if (!videoElementRef.current || !audioElementRef.current) {
      setDebugActionMessage("Cannot probe: media elements unavailable");
      return;
    }

    try {
      await videoElementRef.current.play();
      results.push("video play ok");
    } catch (error) {
      results.push(`video play failed (${getErrorMessage(error)})`);
    }

    try {
      await audioElementRef.current.play();
      results.push("audio play ok");
    } catch (error) {
      results.push(`audio play failed (${getErrorMessage(error)})`);
    }

    setDebugActionMessage(results.join(" | "));
  };

  const handleNextComboForDebug = () => {
    void managerRef.current?.handleSlotPlaybackEnded(SingleSlotKey.Primary);
    setDebugActionMessage("Requested next combo");
  };

  const handleAudioLevelToggle = () => {
    const next = nextAudioLevel;
    setAudioLevel(next);

    if (next !== "full") {
      return;
    }

    const video = videoElementRef.current;
    const audio = audioElementRef.current;
    if (!video || !audio) {
      return;
    }

    audio.currentTime = video.currentTime;
    void Promise.all([
      video.paused ? video.play() : Promise.resolve(),
      audio.paused ? audio.play() : Promise.resolve(),
    ]).catch(() => {
      // Keep UI responsive; ComboPlayer handles playback state/error reporting.
    });
  };

  const isAudioMuted = audioLevel === "muted";
  const nextAudioLevel: AudioLevel = audioLevel === "full" ? "muted" : "full";
  const audioButtonTitle = nextAudioLevel === "full" ? "Unmute audio" : "Mute audio";
  const audioDebugSnapshot = formatMediaSnapshot(audioElementRef.current);
  const videoDebugSnapshot = formatMediaSnapshot(videoElementRef.current);

  const linkItems = [
    { label: "Resume", href: "/dev", external: false },
    { label: "Blog", href: "/blog", external: false },
    { label: "Wayfarer Records", href: "https://wayfarermusicgroup.com/dir" },
  ];

  const bulletinItems = [
    <>
      My collaboration{" "}
      <a
        className="font-semibold text-yellow-300"
        href="https://wayfarermusicgroup.com/dir/shadow-dance-is-now-available/"
        rel="noreferrer"
        target="_blank"
      >
        Shadow Dance
      </a>{" "}
      with the talented{" "}
      <a className="text-yellow-300" href="https://billydenk.com" rel="noreferrer" target="_blank">
        Billy Denk
      </a>{" "}
      is out now! Listen on{" "}
      <a
        className="text-yellow-300"
        href="https://wayfarermusicgroup.bandcamp.com/track/shadow-dance"
        rel="noreferrer"
        target="_blank"
      >
        Bandcamp
      </a>{" "}
      or your favorite streaming platform.
    </>,
  ];

  return (
    <div className="relative isolate min-h-dvh overflow-x-clip">
      {playerEnabled && !printMode ? (
        <Suspense fallback={null}>
          {slotAssignment ? (
            <SingleComboSlot
              audioMuted={isAudioMuted}
              audioVolume={audioVolume}
              combo={slotAssignment.combo}
              playbackCycle={slotAssignment.playbackCycle}
              onAudioElementChange={(audio) => {
                audioElementRef.current = audio;
              }}
              onPlaybackReady={handlePlaybackReady}
              onPlaybackStateChange={handlePlaybackStateChange}
              onTimelineEnded={handleTimelineEnded}
              onVideoElementChange={(video) => {
                videoElementRef.current = video;
              }}
            />
          ) : null}
        </Suspense>
      ) : null}
      {!printMode ? (
        <>
          <button
            aria-label={audioButtonTitle}
            className="pointer-events-auto fixed z-[130] inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/40 bg-black/45 text-white shadow-lg backdrop-blur-sm [left:max(1.5rem,env(safe-area-inset-left))] [top:max(1.5rem,env(safe-area-inset-top))] print:hidden"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleAudioLevelToggle();
            }}
            title={audioButtonTitle}
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
              {audioLevel === "muted" ? (
                <>
                  <path d="M16 9l5 6" />
                  <path d="M21 9l-5 6" />
                </>
              ) : (
                <g transform="translate(0 -2)">
                  <path d="M16 10.5c1 .8 1.5 2 1.5 3.5s-.5 2.7-1.5 3.5" />
                  <path d="M18.8 7.7c1.7 1.5 2.7 3.8 2.7 6.3s-1 4.8-2.7 6.3" />
                </g>
              )}
            </svg>
          </button>

          <button
            aria-expanded={isToneExplorerOpen}
            aria-label={isToneExplorerOpen ? "Close tone explorer" : "Explore combinations by tone"}
            className={`pointer-events-auto fixed z-[130] inline-flex h-12 w-12 items-center justify-center rounded-full border bg-black/45 text-white shadow-lg backdrop-blur-sm transition [right:max(1.5rem,env(safe-area-inset-right))] [top:max(1.5rem,env(safe-area-inset-top))] hover:bg-black/65 print:hidden ${
              isToneExplorerOpen
                ? "border-sky-300 text-sky-200 shadow-[0_0_24px_rgba(56,189,248,0.45)]"
                : toneExplorerAcknowledged
                  ? "border-white/40"
                  : "border-sky-200/70 text-sky-100 shadow-[0_0_24px_rgba(56,189,248,0.35)] motion-safe:animate-pulse"
            }`}
            onClick={handleToneExplorerToggle}
            ref={toneExplorerButtonRef}
            title={isToneExplorerOpen ? "Close tone explorer" : "Explore by tone"}
            type="button"
          >
            {isToneExplorerOpen ? (
              <svg
                aria-hidden="true"
                fill="none"
                height="24"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="24"
              >
                <path d="M6 6l12 12" />
                <path d="M18 6L6 18" />
              </svg>
            ) : (
              <ToneExplorerIcon tone={slotAssignment?.combo.predictedTone} />
            )}
          </button>

          <ToneExplorer
            disabled={!slotAssignment}
            error={comboError}
            loading={comboLoading}
            onSubmit={handleToneSubmit}
            open={isToneExplorerOpen}
          />

          {showToneExplorerExplainer ? (
            <ToneExplorerExplainer
              onAccept={handleToneExplorerAccept}
              onDismiss={() => setShowToneExplorerExplainer(false)}
              returnFocusRef={toneExplorerButtonRef}
            />
          ) : null}
        </>
      ) : null}

      {!printMode ? (
        <div className="pointer-events-none fixed inset-0 z-10 bg-[linear-gradient(180deg,rgba(0,0,0,0.12),rgba(0,0,0,0.62))] print:hidden" />
      ) : null}

      <div className="relative z-20 min-h-dvh">
        <DocumentRouteTransition pathname={location.pathname} printMode={printMode} />
      </div>

      {isHome ? (
        <section className="fixed inset-0 z-20 mx-auto flex h-dvh w-full max-w-xl items-end px-4 py-4 sm:px-6 sm:py-8">
          <div className="relative w-full">
            <div
              aria-hidden={!isBulletinOpen}
              className={`relative z-10 mb-1 flex items-center justify-end px-1 transition-all duration-300 ease-in-out ${
                isBulletinOpen
                  ? "translate-y-[8px] scale-100 opacity-100"
                  : "pointer-events-none translate-y-4 scale-95 opacity-0"
              }`}
            >
              <div className="flex items-center gap-2">
                <DarenKeckWordmark />
                <button
                  aria-label="Minimize bulletin"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white transition-all duration-200 ease-in-out hover:bg-black/35"
                  onClick={() => setIsBulletinOpen(false)}
                  tabIndex={isBulletinOpen ? 0 : -1}
                  title="Minimize"
                  type="button"
                >
                  <svg
                    aria-hidden="true"
                    fill="none"
                    height="20"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                    viewBox="0 0 24 24"
                    width="20"
                  >
                    <rect height="16" rx="2.5" width="16" x="4" y="4" />
                    <path d="M8 12h8" />
                  </svg>
                </button>
              </div>
            </div>

            <div
              aria-hidden={isBulletinOpen}
              className={`fixed right-4 z-[120] flex items-center gap-2 transition-all duration-300 ease-in-out [bottom:max(1.5rem,calc(env(safe-area-inset-bottom)+1rem))] sm:right-6 sm:[bottom:max(2.5rem,calc(env(safe-area-inset-bottom)+2rem))] ${
                isBulletinOpen
                  ? "pointer-events-none translate-y-3 scale-95 opacity-0"
                  : "pointer-events-auto translate-y-0 scale-100 opacity-100"
              }`}
            >
              <DarenKeckWordmark />
              <button
                aria-label="Maximize bulletin"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white transition-all duration-200 ease-in-out hover:bg-black/35"
                onClick={handleBulletinMaximize}
                tabIndex={isBulletinOpen ? -1 : 0}
                title="Maximize"
                type="button"
              >
                <svg
                  aria-hidden="true"
                  fill="none"
                  height="20"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  viewBox="0 0 24 24"
                  width="20"
                >
                  <rect height="16" rx="2.5" width="16" x="4" y="4" />
                  <path d="M12 8v8" />
                  <path d="M8 12h8" />
                </svg>
              </button>
            </div>

            <div
              className={`overflow-hidden transition-all duration-300 ease-in-out ${
                isBulletinOpen
                  ? "glass-card rounded-2xl border p-4 shadow-2xl shadow-black/35 sm:p-5"
                  : "rounded-2xl border-0 p-0 shadow-none"
              }`}
            >
              <div
                aria-hidden={!isBulletinOpen}
                className={`grid overflow-hidden transition-all duration-300 ease-in-out ${
                  isBulletinOpen
                    ? "grid-rows-[1fr] opacity-100"
                    : "pointer-events-none grid-rows-[0fr] opacity-0"
                }`}
                inert={!isBulletinOpen}
              >
                <div className="min-h-0 space-y-5">
                  <header className="space-y-2">
                    <h1 className="text-3xl font-bold text-white">Hey!</h1>
                    <p className="text-sm leading-relaxed text-white/85">
                      This is my personal page. I'm a full-stack developer with a decade of
                      experience, and I write music at Wayfarer Records!
                    </p>
                    <p className="text-sm leading-relaxed text-white/80">
                      I'll occasionally link up fun projects here as well.
                    </p>
                  </header>
                  <BulletinSection items={bulletinItems} />
                  <LinksSection links={linkItems} />
                  {/* {!slotAssignment ? (
                  <p className="text-xs text-white/70">
                    {comboLoading
                      ? "Loading combo player..."
                      : (comboError ?? "Combo playback unavailable. Set VITE_COMBO_API_BASE_URL.")}
                  </p>
                ) : null} */}
                  {/* <p className="text-[11px] text-white/65">
                  manager: {managerState} | slot: {slotState} | combos played: {combosPlayedCount}
                </p> */}
                </div>
              </div>
            </div>

            {comboLoading ? (
              <div className="pointer-events-none fixed z-40 left-1/2 [top:calc(max(1.5rem,env(safe-area-inset-top))+24px)] -translate-x-1/2 -translate-y-1/2">
                <ShellLoader />
              </div>
            ) : null}

            {!comboLoading && !slotAssignment && comboError ? (
              <p className="pointer-events-none absolute left-1/2 top-full mt-3 -translate-x-1/2 text-xs text-white/70">
                {comboError}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {SHOW_LOCAL_DEBUG_CONTROLS && !printMode ? (
        <aside className="pointer-events-auto fixed bottom-3 right-3 z-[60] w-[min(92vw,420px)] rounded-xl border border-white/30 bg-black/70 p-3 text-[11px] text-white shadow-2xl backdrop-blur-sm">
          <p className="font-semibold uppercase tracking-[0.14em] text-white/85">
            Local playback debug
          </p>
          <p className="mt-1 text-white/70">sample: {debugSampleCount}</p>
          <p className="mt-2 break-all text-white/80">
            combo: {slotAssignment?.combo.comboId ?? "none"}
          </p>
          <p className="mt-1 text-white/80">
            manager={managerState} | slot={slotState} | phase={playbackPhase}
          </p>
          <p className="mt-1 text-white/80">
            loading={String(comboLoading)} | muted={String(isAudioMuted)} | played=
            {combosPlayedCount}
          </p>
          <p className="mt-2 break-all text-white/75">audio: {audioDebugSnapshot}</p>
          <p className="mt-1 break-all text-white/75">video: {videoDebugSnapshot}</p>

          <label className="mt-2 block text-white/80" htmlFor="debug-audio-volume">
            Debug audio volume: {audioVolume.toFixed(2)}
          </label>
          <input
            className="mt-1 w-full"
            id="debug-audio-volume"
            max={1}
            min={0}
            onChange={(event) => {
              setAudioVolume(Math.min(1, Math.max(0, Number(event.target.value) || 0)));
            }}
            step={0.05}
            type="range"
            value={audioVolume}
          />

          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              className="rounded border border-white/35 bg-white/10 px-2 py-1 text-left hover:bg-white/20"
              onClick={() => {
                handleAudioLevelToggle();
                setDebugActionMessage("Requested unmute and playback resume");
              }}
              type="button"
            >
              Force unmute
            </button>
            <button
              className="rounded border border-white/35 bg-white/10 px-2 py-1 text-left hover:bg-white/20"
              onClick={() => {
                setAudioLevel("muted");
                setDebugActionMessage("Set audio state to muted");
              }}
              type="button"
            >
              Force mute
            </button>
            <button
              className="rounded border border-white/35 bg-white/10 px-2 py-1 text-left hover:bg-white/20"
              onClick={() => {
                void handleProbePlaybackForDebug();
              }}
              type="button"
            >
              Probe play()
            </button>
            <button
              className="rounded border border-white/35 bg-white/10 px-2 py-1 text-left hover:bg-white/20"
              onClick={handlePauseBothForDebug}
              type="button"
            >
              Pause both
            </button>
            <button
              className="rounded border border-white/35 bg-white/10 px-2 py-1 text-left hover:bg-white/20"
              onClick={handleSyncAudioForDebug}
              type="button"
            >
              Sync audio to video
            </button>
            <button
              className="rounded border border-white/35 bg-white/10 px-2 py-1 text-left hover:bg-white/20"
              onClick={handleNextComboForDebug}
              type="button"
            >
              Next combo
            </button>
          </div>

          {debugActionMessage ? <p className="mt-2 text-white/70">{debugActionMessage}</p> : null}
          <p className="mt-2 break-all text-white/65">
            audioSrc: {slotAssignment?.combo.audioSrc ?? "none"}
          </p>
        </aside>
      ) : null}
    </div>
  );
}
