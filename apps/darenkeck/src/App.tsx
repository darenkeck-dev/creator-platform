import type {
  PublicComboPredictedTone,
  PublicComboSelectionRequest,
  PublicMusicRelease,
  PublicMusicTrack,
} from "@media-manager/contracts";
import {
  ComboPlayerPhase,
  ComboTimelineTrack,
  type ComboPlayerHandle,
} from "@media-manager/shared";
import { lazy, Suspense, useEffect, useEffectEvent, useRef, useState, type RefObject } from "react";
import { Link, useLocation, useOutlet } from "react-router-dom";

import { BulletinSection } from "./components/BulletinSection";
import { ContentSizeButton } from "./components/ContentSizeButton";
import { DocumentControlsProvider } from "./components/DocumentControlsContext";
import { MusicPlaybackContext } from "./components/MusicPlaybackContext";
import {
  MusicPlayButton,
  MusicTransport,
  MusicTransportLoader,
} from "./components/MusicTransport";
import { ShellLoader } from "./components/ShellLoader";
import { ToneExplorer, ToneExplorerExplainer, ToneExplorerIcon } from "./components/ToneExplorer";
import {
  advanceJourney,
  journeyForKeywords,
  requestForJourney,
  type ComboJourney,
} from "./lib/combo-journey";
import { latestBulletins } from "./lib/bulletins";
import {
  SingleSlotKey,
  SlotManager,
  type ComboPayload,
  type SlotManagerState,
  type SlotPlaybackState,
  type SlotPlaybackAssignment,
} from "./lib/slot-manager";
import { setPageMetadata } from "./lib/page-metadata";
import { fetchMusicCatalog } from "./lib/music";
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
type AudioLevel = "muted" | "full";

type MusicPlayback = {
  combo: ComboPayload;
  playbackCycle: number;
  release: PublicMusicRelease;
  trackIndex: number;
};

type PublishedAudioReference = {
  releaseId: string;
  releaseTitle: string;
  trackId: string;
  trackTitle: string;
};

function pairMusicTrackWithCombo(combo: ComboPayload, track: PublicMusicTrack): ComboPayload {
  return {
    comboId: `music-${track.id}-${combo.videoAssetId}`,
    videoAssetId: combo.videoAssetId,
    audioAssetId: track.id,
    videoTitle: combo.videoTitle,
    audioTitle: track.title,
    videoSrc: combo.videoSrc,
    audioSrc: track.audioUrl,
  };
}

function DocumentRouteTransition({
  contentMinimized,
  pathname,
  printMode,
}: {
  contentMinimized: boolean;
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

  const renderedDocument = isDocumentPath(renderedPathRef.current);
  const userMinimized = renderedDocument && contentMinimized && !printMode;
  const routeHidden = renderedDocument && (!documentVisible || userMinimized);

  return (
    <div
      aria-hidden={routeHidden}
      className={`min-h-dvh origin-bottom transition-[opacity,transform,filter] duration-[400ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none print:block print:transform-none print:opacity-100 print:filter-none ${
        userMinimized
          ? "hidden"
          : documentVisible
            ? "translate-y-0 scale-100 opacity-100 blur-none"
            : "pointer-events-none translate-y-6 scale-[0.985] opacity-0 blur-[2px]"
      }`}
      inert={routeHidden}
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

function DarenKeckWordmark({
  compact = false,
  onClick,
}: {
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      aria-label="Daren Keck home"
      className="pointer-events-auto relative inline-flex items-center"
      onClick={onClick}
      to="/"
    >
      <img
        alt="Daren Keck"
        className={compact ? "h-8 w-auto" : "h-12 w-auto"}
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
    </Link>
  );
}

type AudioControlProps = {
  audioButtonTitle: string;
  audioLevel: AudioLevel;
  onAudioToggle: () => void;
};

function AudioControl({
  audioButtonTitle,
  audioLevel,
  onAudioToggle,
}: AudioControlProps) {
  return (
    <button
      aria-label={audioButtonTitle}
      className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center text-white transition hover:text-white/70 min-[360px]:h-12 min-[360px]:w-12 print:hidden"
      data-audio-control
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onAudioToggle();
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
  );
}

type ToneControlProps = {
  onToneToggle: () => void;
  predictedTone?: PublicComboPredictedTone;
  toneExplorerAcknowledged: boolean;
  toneExplorerButtonRef: RefObject<HTMLButtonElement | null>;
  toneExplorerOpen: boolean;
};

function ToneControl({
  onToneToggle,
  predictedTone,
  toneExplorerAcknowledged,
  toneExplorerButtonRef,
  toneExplorerOpen,
}: ToneControlProps) {
  const closeState = toneExplorerOpen;

  return (
    <button
      aria-expanded={toneExplorerOpen}
      aria-label={closeState ? "Close tone explorer" : "Explore combinations by tone"}
      className={`pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/60 text-white shadow-lg backdrop-blur-md transition hover:bg-black/65 supports-[backdrop-filter]:bg-black/30 min-[360px]:h-12 min-[360px]:w-12 print:hidden ${
        closeState
          ? "text-sky-200 shadow-[0_0_24px_rgba(56,189,248,0.45)]"
          : toneExplorerAcknowledged
            ? ""
            : "tone-control-first-use text-sky-100"
      }`}
      data-tone-control
      onClick={onToneToggle}
      ref={toneExplorerButtonRef}
      title={closeState ? "Close tone explorer" : "Explore by tone"}
      type="button"
    >
      {closeState ? (
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
        <ToneExplorerIcon tone={predictedTone} />
      )}
    </button>
  );
}

export function App() {
  const location = useLocation();
  const isHome = isHomePath(location.pathname);
  const printMode = isResumePrintMode(location.pathname, location.search);
  const [slotAssignment, setSlotAssignment] = useState<SlotPlaybackAssignment | null>(null);
  const [comboLoading, setComboLoading] = useState(false);
  const [comboError, setComboError] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<AudioLevel>("muted");
  const [audioVolume, setAudioVolume] = useState(1);
  const [isContentMinimized, setIsContentMinimized] = useState(false);
  const [homeNavigationOpen, setHomeNavigationOpen] = useState(false);
  const [documentNavStuck, setDocumentNavStuck] = useState(false);
  const [isToneExplorerOpen, setIsToneExplorerOpen] = useState(false);
  const [toneExplorerOpenedFromDock, setToneExplorerOpenedFromDock] = useState(false);
  const [showToneExplorerExplainer, setShowToneExplorerExplainer] = useState(false);
  const [toneExplorerAcknowledged, setToneExplorerAcknowledged] = useState(false);
  const [playerEnabled, setPlayerEnabled] = useState(false);
  const [managerEnabled, setManagerEnabled] = useState(false);
  const [playbackPhase, setPlaybackPhase] = useState<ComboPlayerPhase>(ComboPlayerPhase.Loading);
  const [managerState, setManagerState] = useState<SlotManagerState>("idle");
  const [slotState, setSlotState] = useState<SlotPlaybackState>("idle");
  const [combosPlayedCount, setCombosPlayedCount] = useState(0);
  const [musicPlayback, setMusicPlayback] = useState<MusicPlayback | null>(null);
  const [musicLoadingTrackId, setMusicLoadingTrackId] = useState<string | null>(null);
  const [musicError, setMusicError] = useState<string | null>(null);
  const [musicProgress, setMusicProgress] = useState({ currentTime: 0, duration: 0 });
  const [publishedAudioReferences, setPublishedAudioReferences] = useState(
    new Map<string, PublishedAudioReference>()
  );
  const [debugActionMessage, setDebugActionMessage] = useState<string | null>(null);
  const [debugSampleCount, setDebugSampleCount] = useState(0);
  const managerRef = useRef<SlotManager | null>(null);
  const toneExplorerButtonRef = useRef<HTMLButtonElement | null>(null);
  const journeyRef = useRef<ComboJourney>({ mode: "random" });
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const playerRef = useRef<ComboPlayerHandle | null>(null);
  const musicRequestRef = useRef(0);
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
    if (printMode) return;
    let active = true;
    void fetchMusicCatalog()
      .then((catalog) => {
        if (!active) return;
        const references = new Map<string, PublishedAudioReference>();
        for (const release of catalog.releases) {
          for (const track of release.tracks) {
            if (references.has(track.audioAssetId)) continue;
            references.set(track.audioAssetId, {
              releaseId: release.id,
              releaseTitle: release.title,
              trackId: track.id,
              trackTitle: track.title,
            });
          }
        }
        setPublishedAudioReferences(references);
      })
      .catch((error: unknown) => {
        console.error("Published music metadata failed to load", error);
      });
    return () => {
      active = false;
    };
  }, [printMode]);

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

  const exitMusicPlayback = () => {
    musicRequestRef.current += 1;
    setMusicLoadingTrackId(null);
    setMusicError(null);
    setMusicProgress({ currentTime: 0, duration: 0 });
    setMusicPlayback(null);
  };

  const startMusicTrack = async (
    release: PublicMusicRelease,
    trackIndex: number,
    unmute = false
  ) => {
    const track = release.tracks[trackIndex];
    if (!track) return;

    if (unmute) setAudioLevel("full");
    const requestId = ++musicRequestRef.current;
    setMusicLoadingTrackId(track.id);
    setMusicError(null);
    setIsToneExplorerOpen(false);
    setShowToneExplorerExplainer(false);

    try {
      const combo = await fetchRandomCombo();
      if (musicRequestRef.current !== requestId) return;
      if (!combo) throw new Error("No background video is available.");

      setMusicProgress({ currentTime: 0, duration: track.durationSeconds ?? 0 });
      setMusicPlayback({
        combo: pairMusicTrackWithCombo(combo, track),
        playbackCycle: requestId,
        release,
        trackIndex,
      });
    } catch (error) {
      if (musicRequestRef.current !== requestId) return;
      console.error("Music playback failed to start", error);
      setMusicError(error instanceof Error ? error.message : "Music playback failed to start.");
    } finally {
      if (musicRequestRef.current === requestId) setMusicLoadingTrackId(null);
    }
  };

  const handleTimelineEnded = () => {
    if (musicPlayback) {
      if (musicLoadingTrackId) return;
      const nextTrackIndex = musicPlayback.trackIndex + 1;
      if (nextTrackIndex < musicPlayback.release.tracks.length) {
        void startMusicTrack(musicPlayback.release, nextTrackIndex);
      } else {
        exitMusicPlayback();
      }
      return;
    }
    void managerRef.current?.handleSlotPlaybackEnded(SingleSlotKey.Primary);
  };

  const openToneExplorer = () => {
    if (isToneExplorerOpen) {
      return;
    }
    setToneExplorerOpenedFromDock(
      documentNavStuck && isDocumentPath(location.pathname) && !isContentMinimized
    );
    setIsToneExplorerOpen(true);
  };

  const closeToneExplorer = () => {
    setToneExplorerOpenedFromDock(false);
    setIsToneExplorerOpen(false);
  };

  const closeToneExplorerForNavigation = useEffectEvent(() => {
    setShowToneExplorerExplainer(false);
    setToneExplorerOpenedFromDock(false);
    if (!isToneExplorerOpen) {
      return;
    }
    setIsToneExplorerOpen(false);
  });

  useEffect(() => {
    if (previousPathRef.current === location.pathname) {
      return;
    }
    previousPathRef.current = location.pathname;
    closeToneExplorerForNavigation();
  }, [location.pathname]);

  const handleContentMinimize = () => {
    setShowToneExplorerExplainer(false);
    setToneExplorerOpenedFromDock(false);
    setIsToneExplorerOpen(false);
    setIsContentMinimized(true);
  };

  const handleMenuNavigate = () => {
    setIsContentMinimized(false);
    setShowToneExplorerExplainer(false);
    setToneExplorerOpenedFromDock(false);
    setIsToneExplorerOpen(false);
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
    if (musicPlayback) return;
    managerRef.current?.handleSlotPlaybackReady(SingleSlotKey.Primary);
  };

  const handlePlaybackStateChange = (phase: ComboPlayerPhase) => {
    setPlaybackPhase(phase);
    if (musicPlayback) return;
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

    if (next !== "full" || musicPlayback) {
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
  const isMusicPlaying =
    playbackPhase === ComboPlayerPhase.Playing || playbackPhase === ComboPlayerPhase.Stalled;
  const activeTrack = musicPlayback?.release.tracks[musicPlayback.trackIndex] ?? null;
  const musicLoading = musicLoadingTrackId !== null;
  const ambientAudioReference = slotAssignment
    ? publishedAudioReferences.get(slotAssignment.combo.audioAssetId) ?? null
    : null;
  const ambientTrackLabel = ambientAudioReference ? (
    <Link
      aria-label={`View ${ambientAudioReference.releaseTitle} on the Music page`}
      className="pointer-events-auto block min-w-0 text-center text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)] transition hover:text-[var(--primary-red)]"
      onClick={handleMenuNavigate}
      to={`/music#release-${ambientAudioReference.releaseId}`}
    >
      <strong className="block truncate text-sm">{ambientAudioReference.trackTitle}</strong>
      <span className="mt-1 hidden truncate text-[11px] text-white/60 sm:block">
        {ambientAudioReference.releaseTitle}
      </span>
    </Link>
  ) : null;
  const documentHeaderDocked =
    documentNavStuck && isDocumentPath(location.pathname) && !isContentMinimized;
  const documentDockVisible =
    isDocumentPath(location.pathname) &&
    !isContentMinimized &&
    !musicPlayback &&
    !musicLoading &&
    !isToneExplorerOpen;
  const nextAudioLevel: AudioLevel = audioLevel === "full" ? "muted" : "full";
  const audioButtonTitle = nextAudioLevel === "full" ? "Unmute audio" : "Mute audio";
  const audioDebugSnapshot = formatMediaSnapshot(audioElementRef.current);
  const videoDebugSnapshot = formatMediaSnapshot(videoElementRef.current);
  const audioControl = (
    <AudioControl
      audioButtonTitle={audioButtonTitle}
      audioLevel={audioLevel}
      onAudioToggle={handleAudioLevelToggle}
    />
  );
  const toneControl = (
    <ToneControl
      onToneToggle={handleToneExplorerToggle}
      predictedTone={slotAssignment?.combo.predictedTone}
      toneExplorerAcknowledged={toneExplorerAcknowledged}
      toneExplorerButtonRef={toneExplorerButtonRef}
      toneExplorerOpen={isToneExplorerOpen}
    />
  );
  return (
    <div
      className={`relative isolate ${isHome ? "h-dvh overflow-hidden" : "min-h-dvh overflow-x-clip"}`}
    >
      {playerEnabled && !printMode ? (
        <Suspense fallback={null}>
          {musicPlayback || slotAssignment ? (
            <SingleComboSlot
              audioMuted={isAudioMuted}
              audioVolume={audioVolume}
              combo={musicPlayback?.combo ?? slotAssignment!.combo}
              playbackCycle={musicPlayback?.playbackCycle ?? slotAssignment!.playbackCycle}
              onAudioElementChange={(audio) => {
                audioElementRef.current = audio;
              }}
              onPlaybackReady={handlePlaybackReady}
              onPlaybackStateChange={handlePlaybackStateChange}
              onTimeUpdate={
                musicPlayback
                  ? ({ currentTime, duration }) => setMusicProgress({ currentTime, duration })
                  : undefined
              }
              onTimelineEnded={handleTimelineEnded}
              playerRef={playerRef}
              timelineTrack={
                musicPlayback ? ComboTimelineTrack.Audio : ComboTimelineTrack.Auto
              }
              onVideoElementChange={(video) => {
                videoElementRef.current = video;
              }}
            />
          ) : null}
        </Suspense>
      ) : null}
      {!printMode ? (
        <>
          {!documentHeaderDocked ? (
            <>
              <div
                aria-hidden="true"
                className="pointer-events-none fixed left-0 top-0 z-[130] h-28 w-56 bg-[radial-gradient(ellipse_at_top_left,rgba(0,0,0,0.45),rgba(0,0,0,0.25)_42%,transparent_72%)]"
                data-top-left-scrim
              />
              <div
                aria-hidden="true"
                className="pointer-events-none fixed right-0 top-0 z-[130] h-28 w-40 bg-[radial-gradient(ellipse_at_top_right,rgba(0,0,0,0.45),rgba(0,0,0,0.25)_42%,transparent_72%)]"
                data-top-right-scrim
              />
            </>
          ) : null}
          {musicPlayback && activeTrack ? (
            <MusicTransport
              audioMuted={isAudioMuted}
              contentMinimized={isContentMinimized}
              currentTime={musicProgress.currentTime}
              duration={musicProgress.duration}
              loading={musicLoading}
              onExit={exitMusicPlayback}
              onMinimize={handleContentMinimize}
              onMuteToggle={handleAudioLevelToggle}
              onNavigate={handleMenuNavigate}
              onPlayToggle={() => void playerRef.current?.togglePlayback()}
              onSeek={(seconds) => playerRef.current?.seekTo(seconds)}
              playing={isMusicPlaying}
              releaseId={musicPlayback.release.id}
              releaseTitle={musicPlayback.release.title}
              track={activeTrack}
            />
          ) : musicLoading ? (
            <MusicTransportLoader
              audioMuted={isAudioMuted}
              contentMinimized={isContentMinimized}
              onMuteToggle={handleAudioLevelToggle}
              onMinimize={handleContentMinimize}
              onNavigate={handleMenuNavigate}
              onPlayToggle={() => void playerRef.current?.togglePlayback()}
              playing={isMusicPlaying}
            />
          ) : (
            <>
              {!isContentMinimized ? (
                <div
                  className="pointer-events-none fixed bottom-0 left-1/2 z-[125] h-28 w-full max-w-4xl -translate-x-1/2 bg-gradient-to-t from-black/65 to-transparent"
                  data-player-depth-gradient
                />
              ) : null}
              {!documentDockVisible ? (
                <div
                  className={`pointer-events-none fixed bottom-0 left-1/2 z-[140] grid h-[max(4rem,calc(env(safe-area-inset-bottom)+3.5rem))] w-full max-w-4xl -translate-x-1/2 grid-cols-[5.5rem_minmax(0,1fr)_5.5rem] items-center gap-2 border-t border-white/25 bg-black/40 px-4 pb-[env(safe-area-inset-bottom)] backdrop-blur-md min-[360px]:grid-cols-[7rem_minmax(0,1fr)_7rem] sm:gap-3 sm:px-6 ${isContentMinimized ? "" : "shadow-[0_-8px_24px_rgba(0,0,0,0.3)]"}`}
                  data-media-controls
                >
                  {isContentMinimized ? (
                    <button
                      aria-label="Restore Home and open navigation"
                      className="pointer-events-auto absolute inset-x-0 top-0 grid h-5 cursor-pointer grid-cols-4 border-0 bg-transparent p-0"
                      data-minimized-player-color-border
                      onClick={() => {
                        handleMenuNavigate();
                        setHomeNavigationOpen(true);
                      }}
                      type="button"
                    >
                      <span className="h-0.5 bg-[var(--primary-yellow)]" />
                      <span className="h-0.5 bg-[var(--primary-red)]" />
                      <span className="h-0.5 bg-[var(--primary-orange)]" />
                      <span className="h-0.5 bg-[var(--primary-blue)]" />
                    </button>
                  ) : null}
                  <div className="pointer-events-auto col-start-1 flex items-center gap-2">
                    <MusicPlayButton
                      context="combo"
                      onClick={() => void playerRef.current?.togglePlayback()}
                      playing={isMusicPlaying}
                    />
                    {audioControl}
                  </div>
                  {ambientTrackLabel ? (
                    <div className="col-start-2 min-w-0 justify-self-center">
                      {ambientTrackLabel}
                    </div>
                  ) : (
                    <span className="col-start-2" />
                  )}
                  <div className="pointer-events-auto col-start-3 flex items-center justify-self-end gap-2">
                    <ContentSizeButton
                      expanded={!isContentMinimized}
                      onClick={
                        isContentMinimized
                          ? handleMenuNavigate
                          : () => {
                              setHomeNavigationOpen(false);
                              handleContentMinimize();
                            }
                      }
                    />
                  </div>
                </div>
              ) : null}
            </>
          )}

          {!musicPlayback && !musicLoading && !documentHeaderDocked ? (
            <div
              className="fixed z-[140] [right:max(1rem,env(safe-area-inset-right))] [top:max(1rem,env(safe-area-inset-top))] min-[360px]:[right:max(1.5rem,env(safe-area-inset-right))] min-[360px]:[top:max(1.5rem,env(safe-area-inset-top))]"
              data-tone-floating
            >
              {toneControl}
            </div>
          ) : null}

          <div
            className={`pointer-events-none fixed z-[140] [left:max(1rem,env(safe-area-inset-left))] [top:max(1rem,env(safe-area-inset-top))] min-[360px]:[left:max(1.5rem,env(safe-area-inset-left))] min-[360px]:[top:max(1.5rem,env(safe-area-inset-top))] ${documentHeaderDocked ? "hidden" : ""}`}
            data-site-wordmark
          >
            <DarenKeckWordmark compact onClick={handleMenuNavigate} />
          </div>

          {!musicPlayback ? (
            <ToneExplorer
              disabled={!slotAssignment}
              error={comboError}
              loading={comboLoading}
              onClose={closeToneExplorer}
              onSubmit={handleToneSubmit}
              open={isToneExplorerOpen}
              showCloseControl={toneExplorerOpenedFromDock}
            />
          ) : null}

          {!musicPlayback && showToneExplorerExplainer ? (
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

      <div
        className={isHome ? "pointer-events-none absolute inset-0 z-20" : "relative z-20 min-h-dvh"}
      >
        <DocumentControlsProvider
          value={{
            center: ambientTrackLabel,
            dockedTone: !musicPlayback && !musicLoading ? toneControl : null,
            leading: (
              <>
                <MusicPlayButton
                  context="combo"
                  onClick={() => void playerRef.current?.togglePlayback()}
                  playing={isMusicPlaying}
                />
                {audioControl}
              </>
            ),
            navHidden: Boolean(
              isHome ||
                isContentMinimized ||
                musicPlayback ||
                musicLoading ||
                isToneExplorerOpen
            ),
            onMinimize: handleContentMinimize,
            onStickyChange: setDocumentNavStuck,
          }}
        >
          <MusicPlaybackContext.Provider
            value={{
              currentTrackId: activeTrack?.id ?? ambientAudioReference?.trackId ?? null,
              error: musicError,
              loadingTrackId: musicLoadingTrackId,
              playing: isMusicPlaying,
              playTrack: (release, trackIndex) => void startMusicTrack(release, trackIndex, true),
            }}
          >
            <DocumentRouteTransition
              contentMinimized={isContentMinimized}
              pathname={location.pathname}
              printMode={printMode}
            />
          </MusicPlaybackContext.Provider>
        </DocumentControlsProvider>
      </div>

      {!printMode && comboLoading && !musicLoading ? (
        <div
          className="pointer-events-none fixed left-1/2 z-[150] -translate-x-1/2 -translate-y-1/2 [top:calc(max(1.5rem,env(safe-area-inset-top))+24px)]"
          data-playback-loader="floating"
        >
          <ShellLoader />
        </div>
      ) : null}

      {isHome ? (
        <section
          className="relative z-20 flex min-h-dvh w-full items-end px-0 pb-[max(4rem,calc(env(safe-area-inset-bottom)+3.5rem))] pt-24 lg:px-6"
          data-home-panel-shell
        >
          <div className="relative mx-auto w-full max-w-4xl">
            <div
              data-home-panel
              className={`relative transition-all duration-300 ease-in-out ${
                !isContentMinimized && !isToneExplorerOpen
                  ? ""
                  : "rounded-none border-0 p-0 shadow-none lg:rounded-2xl"
              }`}
            >
              <div
                aria-hidden={isContentMinimized || isToneExplorerOpen}
                className={`grid transition-all duration-300 ease-in-out ${
                  !isContentMinimized && !isToneExplorerOpen
                    ? "grid-rows-[1fr] overflow-visible opacity-100"
                    : "pointer-events-none grid-rows-[0fr] overflow-hidden opacity-0"
                }`}
                inert={isContentMinimized || isToneExplorerOpen}
              >
                <div className="min-h-0">
                  <nav
                    aria-hidden={!homeNavigationOpen}
                    aria-label="Primary"
                    className={`absolute inset-x-0 bottom-full z-0 grid h-40 grid-rows-4 gap-1 transition-[clip-path] duration-300 ${homeNavigationOpen ? "[clip-path:inset(0_0_0_0)] ease-out" : "pointer-events-none [clip-path:inset(0_0_0_100%)] ease-in"}`}
                    data-home-navigation-rows
                    inert={!homeNavigationOpen}
                  >
                    {[
                      { color: "var(--primary-blue)", label: "Resume", offset: 87, route: "/dev" },
                      {
                        color: "var(--primary-orange)",
                        label: "Blog",
                        offset: 56,
                        route: "/blog",
                      },
                      {
                        color: "var(--primary-red)",
                        label: "Music",
                        offset: 35,
                        route: "/music",
                      },
                      { color: "var(--primary-yellow)", label: "News", offset: 10, route: "/news" },
                    ].map(({ color, label, offset, route }) => {
                      const maskId = `home-navigation-${label.toLowerCase()}-mask`;
                      const edgeMaskId = `home-navigation-${label.toLowerCase()}-edge-mask`;
                      return (
                        <Link
                          className="group relative block min-h-0 overflow-hidden backdrop-blur-[4px] transition hover:brightness-110"
                          key={route}
                          onClick={() => setHomeNavigationOpen(false)}
                          to={route}
                        >
                          <svg aria-hidden="true" className="h-full w-full">
                            <defs>
                              <mask id={maskId}>
                                <rect fill="white" height="100%" width="100%" />
                                <text
                                  dominantBaseline="central"
                                  fill="#333333"
                                  fontFamily="inherit"
                                  fontSize="44"
                                  fontWeight="900"
                                  letterSpacing="0.5"
                                  textAnchor={offset === 10 ? "start" : offset === 87 ? "end" : "middle"}
                                  x={`${offset}%`}
                                  y="50%"
                                >
                                  {label.toUpperCase()}
                                </text>
                              </mask>
                              <mask id={edgeMaskId}>
                                <rect fill="white" height="100%" width="100%" />
                                <text
                                  dominantBaseline="central"
                                  fill="black"
                                  fontFamily="inherit"
                                  fontSize="44"
                                  fontWeight="900"
                                  letterSpacing="0.5"
                                  textAnchor={offset === 10 ? "start" : offset === 87 ? "end" : "middle"}
                                  x={`${offset}%`}
                                  y="50%"
                                >
                                  {label.toUpperCase()}
                                </text>
                              </mask>
                            </defs>
                            <rect
                              data-navigation-row-fill
                              fill={color}
                              height="100%"
                              mask={`url(#${maskId})`}
                              width="100%"
                            />
                            <text
                              data-navigation-label-edge="dark"
                              dominantBaseline="central"
                              fill="none"
                              fontFamily="inherit"
                              fontSize="44"
                              fontWeight="900"
                              letterSpacing="0.5"
                              mask={`url(#${edgeMaskId})`}
                              stroke="rgba(0,0,0,0.62)"
                              strokeLinejoin="round"
                              strokeWidth="1"
                              textAnchor={offset === 10 ? "start" : offset === 87 ? "end" : "middle"}
                              x={`${offset}%`}
                              y="50%"
                            >
                              {label.toUpperCase()}
                            </text>
                          </svg>
                          <span className="sr-only">{label}</span>
                        </Link>
                      );
                    })}
                  </nav>
                  <div
                    className="relative z-10 rounded-none border-y bg-black/65 px-6 pb-0 pt-3 shadow-2xl shadow-black/30 backdrop-blur-[10px] sm:px-10 lg:border lg:px-14"
                    data-home-panel-surface
                  >
                    <button
                      aria-hidden={homeNavigationOpen}
                      aria-label="Open navigation from color border"
                      className={`absolute inset-x-0 top-0 grid h-5 cursor-pointer grid-cols-4 border-0 bg-transparent p-0 transition-opacity duration-200 ${homeNavigationOpen ? "pointer-events-none opacity-0" : "opacity-100"}`}
                      data-home-color-border
                      inert={homeNavigationOpen}
                      onClick={() => setHomeNavigationOpen(true)}
                      tabIndex={homeNavigationOpen ? -1 : undefined}
                      type="button"
                    >
                      <span className="h-0.5 bg-[var(--primary-yellow)]" />
                      <span className="h-0.5 bg-[var(--primary-red)]" />
                      <span className="h-0.5 bg-[var(--primary-orange)]" />
                      <span className="h-0.5 bg-[var(--primary-blue)]" />
                    </button>
                    <header className="relative" data-home-header-controls data-home-intro>
                      <p className="max-w-xl pr-20 text-sm leading-relaxed text-white/85">
                        <strong className="text-base font-bold text-white">Hey!</strong> I'm a
                        full-stack developer with a decade of experience, and I write music at{" "}
                        <a
                          className="font-medium text-white underline decoration-white/35 underline-offset-4 transition hover:decoration-white"
                          href="https://wayfarermusicgroup.com/dir"
                          rel="noreferrer"
                          target="_blank"
                        >
                          Wayfarer Records
                        </a>
                        !
                      </p>
                      <div
                        className="absolute -right-2 -top-1 sm:-right-4 lg:-right-8"
                        data-home-navigation-control
                      >
                        <button
                          aria-expanded={homeNavigationOpen}
                          aria-label={homeNavigationOpen ? "Hide navigation" : "Show navigation"}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white transition-colors duration-200 hover:bg-black/35"
                          data-home-navigation-toggle
                          onClick={() => setHomeNavigationOpen((open) => !open)}
                          type="button"
                        >
                          <svg
                            aria-hidden="true"
                            fill="none"
                            height="20"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeWidth="1.8"
                            viewBox="0 0 24 24"
                            width="20"
                          >
                            <path
                              className={`origin-center transition-[opacity,transform] duration-200 ${homeNavigationOpen ? "rotate-90 opacity-0" : "rotate-0 opacity-100"}`}
                              d="M5 7h14M5 12h14M5 17h14"
                              data-home-navigation-icon="hamburger"
                            />
                            <path
                              className={`origin-center transition-[opacity,transform] duration-200 ${homeNavigationOpen ? "rotate-0 opacity-100" : "-rotate-90 opacity-0"}`}
                              d="m6 9 6 6 6-6"
                              data-home-navigation-icon="caret"
                            />
                          </svg>
                        </button>
                      </div>
                    </header>
                    <div className="mt-4">
                      <BulletinSection bulletins={latestBulletins} />
                    </div>
                  </div>
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
