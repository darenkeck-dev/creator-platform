"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  ComboTrackKind,
  getMasterTrackFromDurations,
  getTimelineDuration,
  isTimelineEnded,
  mapFollowerTime,
  normalizeDuration,
  ComboPlayerPhase,
  type ComboPlaybackSnapshot,
} from "./combo-playback";
import { ComboPlayerVariant } from "./combo-player-types";

export type ComboPlayerProps = {
  comboId?: string;
  videoTitle: string;
  audioTitle: string;
  videoSrc: string;
  audioSrc: string;
  className?: string;
  variant?: ComboPlayerVariant;
  autoPlay?: boolean;
  audioMuted?: boolean;
  defaultAudioMuted?: boolean;
  onAudioMutedChange?: (next: boolean) => void;
  audioVolume?: number;
  showBuiltInMuteControl?: boolean;
  audioMutedByDefault?: boolean;
  onVideoElementChange?: (video: HTMLVideoElement | null) => void;
  preload?: "none" | "metadata" | "auto";
  suppressUi?: boolean;
  onTimelineEnded?: () => void;
  onPlaybackReady?: () => void;
  onPlaybackStateChange?: (state: ComboPlayerPhase) => void;
  onTimeUpdate?: (snapshot: { currentTime: number; duration: number; remaining: number }) => void;
  onPlaybackError?: (error: {
    kind: "video" | "audio" | "autoplay" | "sync";
    message: string;
  }) => void;
};

type HlsInstance = {
  destroy: () => void;
};

const ENABLE_COMBO_PLAYER_DEBUG_LOGS = false;

export function ComboPlayer({
  comboId,
  videoTitle,
  audioTitle,
  videoSrc,
  audioSrc,
  className,
  variant = ComboPlayerVariant.Default,
  autoPlay = false,
  audioMuted,
  defaultAudioMuted,
  onAudioMutedChange,
  audioVolume,
  showBuiltInMuteControl = false,
  audioMutedByDefault,
  onVideoElementChange,
  preload = "metadata",
  suppressUi = false,
  onTimelineEnded,
  onPlaybackReady,
  onPlaybackStateChange,
  onTimeUpdate,
  onPlaybackError,
}: ComboPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const shouldBePlayingRef = useRef(false);
  const playRequestRef = useRef(0);
  const autoPlayAttemptedRef = useRef(false);
  const playbackReadyNotifiedRef = useRef(false);
  const timelineEndedNotifiedRef = useRef(false);
  const [phase, setPhase] = useState<ComboPlayerPhase>(ComboPlayerPhase.Loading);
  const mediaReadyRef = useRef({ video: false, audio: false });
  const [message, setMessage] = useState<string | null>(null);
  const [durations, setDurations] = useState({ videoDuration: 0, audioDuration: 0 });
  const [currentTime, setCurrentTime] = useState(0);
  const resolvedDefaultAudioMuted = defaultAudioMuted ?? audioMutedByDefault ?? true;
  const [uncontrolledAudioMuted, setUncontrolledAudioMuted] = useState(resolvedDefaultAudioMuted);

  const masterTrack = useMemo(() => getMasterTrackFromDurations(durations), [durations]);
  const duration = useMemo(() => getTimelineDuration(durations), [durations]);
  const isPlaying = phase === ComboPlayerPhase.Playing || phase === ComboPlayerPhase.Stalled;
  const atEnd = phase === ComboPlayerPhase.Ended;
  const effectiveAudioMuted = audioMuted ?? uncontrolledAudioMuted;
  const effectiveAudioVolume =
    typeof audioVolume === "number" ? Math.min(1, Math.max(0, audioVolume)) : undefined;

  function debugLog(event: string, details: Record<string, unknown>) {
    if (!ENABLE_COMBO_PLAYER_DEBUG_LOGS) {
      return;
    }

    console.log("[ComboPlayer]", event, {
      comboId: comboId ?? "none",
      variant,
      ...details,
    });
  }

  function publishTimeUpdate(nextCurrentTime: number, nextDuration: number) {
    if (variant === ComboPlayerVariant.Background) {
      return;
    }

    onTimeUpdate?.({
      currentTime: nextCurrentTime,
      duration: nextDuration,
      remaining: Math.max(0, nextDuration - nextCurrentTime),
    });
  }

  function reportPlaybackError(kind: "video" | "audio" | "autoplay" | "sync", message: string) {
    onPlaybackError?.({ kind, message });
  }

  function toggleAudioMuted() {
    const previous = effectiveAudioMuted;
    const next = !previous;
    if (audioMuted === undefined) {
      setUncontrolledAudioMuted(next);
    }
    onAudioMutedChange?.(next);
    debugLog("audio.mute.toggle", {
      previous,
      next,
      controlled: audioMuted !== undefined,
    });
  }

  function renderAudioToggleButton(classNameValue: string) {
    const label = effectiveAudioMuted ? "Unmute audio" : "Mute audio";

    return (
      <button
        aria-label={label}
        className={classNameValue}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          toggleAudioMuted();
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
          {effectiveAudioMuted ? (
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
    );
  }

  function getElements() {
    const video = videoRef.current;
    const audio = audioRef.current;
    if (!video || !audio) {
      return null;
    }

    const master = masterTrack === ComboTrackKind.Video ? video : audio;
    const follower = masterTrack === ComboTrackKind.Video ? audio : video;
    return { video, audio, master, follower };
  }

  function assignVideoElement(video: HTMLVideoElement | null) {
    videoRef.current = video;
    onVideoElementChange?.(video);
  }

  function syncDurations() {
    const elements = getElements();
    if (!elements) {
      return;
    }

    const nextDurations = {
      videoDuration: normalizeDuration(elements.video.duration),
      audioDuration: normalizeDuration(elements.audio.duration),
    };
    setDurations(nextDurations);
    debugLog("durationchange", {
      videoCurrentTime: elements.video.currentTime,
      audioCurrentTime: elements.audio.currentTime,
      videoDuration: nextDurations.videoDuration,
      audioDuration: nextDurations.audioDuration,
      nextMasterTrack: getMasterTrackFromDurations(nextDurations),
      nextTimelineDuration: getTimelineDuration(nextDurations),
    });
  }

  function handleVideoCanPlay() {
    const nextReady = { ...mediaReadyRef.current, video: true };
    mediaReadyRef.current = nextReady;
    debugLog("readiness.video", {
      videoReady: nextReady.video,
      audioReady: nextReady.audio,
    });
    handleMediaReadySignal();
  }

  function handleAudioCanPlay() {
    const nextReady = { ...mediaReadyRef.current, audio: true };
    mediaReadyRef.current = nextReady;
    debugLog("readiness.audio", {
      videoReady: nextReady.video,
      audioReady: nextReady.audio,
    });
    handleMediaReadySignal();
  }

  function handleVideoLoadedMetadata() {
    syncDurations();
    handleVideoCanPlay();
  }

  function handleAudioLoadedMetadata() {
    syncDurations();
    handleAudioCanPlay();
  }

  function applyAudioSettingsFromSignals() {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    audio.defaultMuted = effectiveAudioMuted;
    if (effectiveAudioVolume !== undefined) {
      audio.volume = effectiveAudioVolume;
    }
  }

  function handlePlaybackStartedSignal() {
    transitionTo(ComboPlayerPhase.Playing);
  }

  function handlePlaybackPausedSignal() {
    if (phase === ComboPlayerPhase.Ended) {
      return;
    }

    transitionTo(shouldBePlayingRef.current ? ComboPlayerPhase.Stalled : ComboPlayerPhase.Ready);
  }

  function handlePlaybackWaitingSignal() {
    if (shouldBePlayingRef.current) {
      transitionTo(ComboPlayerPhase.Stalled);
    }
  }

  function transitionTo(nextPhase: ComboPlayerPhase) {
    setPhase((currentPhase) => {
      if (currentPhase === nextPhase) {
        return currentPhase;
      }

      debugLog("phase.transition", {
        from: currentPhase,
        to: nextPhase,
        shouldBePlaying: shouldBePlayingRef.current,
      });
      onPlaybackStateChange?.(nextPhase);
      return nextPhase;
    });
  }

  function handleTimelineTimeUpdateSignal() {
    const elements = getElements();
    if (!elements) {
      return;
    }

    const timelineEnded = isTimelineEnded(elements.master.currentTime, duration);
    if (timelineEnded) {
      debugLog("phase.sync.timeline-ended", {
        masterCurrentTime: elements.master.currentTime,
        timelineDuration: duration,
      });
      stopAtEnd();
      return;
    }

    setCurrentTime(elements.master.currentTime);
    publishTimeUpdate(elements.master.currentTime, duration);
  }

  function handleMediaReadySignal() {
    if (!mediaReadyRef.current.video || !mediaReadyRef.current.audio) {
      return;
    }

    if (!playbackReadyNotifiedRef.current) {
      playbackReadyNotifiedRef.current = true;
      debugLog("readiness.both-ready", {
        videoReady: mediaReadyRef.current.video,
        audioReady: mediaReadyRef.current.audio,
      });
      onPlaybackReady?.();
    }

    if (phase === ComboPlayerPhase.Loading) {
      transitionTo(ComboPlayerPhase.Ready);
    }

    if (autoPlay && !autoPlayAttemptedRef.current) {
      autoPlayAttemptedRef.current = true;
      debugLog("autoplay.attempt", {
        phase,
      });
      void startPlayback("Autoplay is blocked. Tap to start playback.");
    }
  }

  function stopAtEnd() {
    const elements = getElements();
    if (!elements) {
      return;
    }

    elements.video.pause();
    elements.audio.pause();
    if (duration > 0) {
      elements.video.currentTime = duration;
      elements.audio.currentTime = duration;
      setCurrentTime(duration);
      publishTimeUpdate(duration, duration);
    }
    shouldBePlayingRef.current = false;
    playRequestRef.current += 1;
    debugLog("playback.stop-at-end", {
      duration,
      playRequestId: playRequestRef.current,
    });
    if (!timelineEndedNotifiedRef.current) {
      timelineEndedNotifiedRef.current = true;
      onTimelineEnded?.();
    }
    transitionTo(ComboPlayerPhase.Ended);
  }

  function handleTrackEnded(kind: ComboTrackKind) {
    debugLog("track.ended", {
      kind,
      masterTrack,
      shouldBePlaying: shouldBePlayingRef.current,
    });
    if (kind === masterTrack) {
      stopAtEnd();
      return;
    }

    const elements = getElements();
    if (!elements) {
      return;
    }

    const follower = kind === ComboTrackKind.Video ? elements.video : elements.audio;
    follower.currentTime = 0;
    if (shouldBePlayingRef.current) {
      void follower.play().catch(() => {
        transitionTo(ComboPlayerPhase.Stalled);
      });
    }
  }

  function restartFromBeginning() {
    const elements = getElements();
    if (!elements) {
      return;
    }

    elements.video.currentTime = 0;
    elements.audio.currentTime = 0;
    setCurrentTime(0);
    shouldBePlayingRef.current = false;
    playRequestRef.current += 1;
    timelineEndedNotifiedRef.current = false;
    debugLog("playback.restart", {
      playRequestId: playRequestRef.current,
    });
    transitionTo(ComboPlayerPhase.Ready);
  }

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    autoPlayAttemptedRef.current = false;
    playbackReadyNotifiedRef.current = false;
    timelineEndedNotifiedRef.current = false;
    const nextReady = { video: false, audio: false };
    mediaReadyRef.current = nextReady;

    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;

    let cancelled = false;
    let hlsInstance: HlsInstance | null = null;

    const setup = async () => {
      debugLog("video.setup.start", {
        src: videoSrc,
      });
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        debugLog("video.setup.native-hls", {
          src: videoSrc,
        });
        video.src = videoSrc;
        return;
      }

      const likelyHls = videoSrc.toLowerCase().includes(".m3u8");
      if (!likelyHls) {
        debugLog("video.setup.direct", {
          src: videoSrc,
        });
        video.src = videoSrc;
        return;
      }

      try {
        const hlsModule = await import("hls.js");
        const Hls = hlsModule.default;
        if (!Hls.isSupported() || cancelled) {
          debugLog("video.setup.hls-unsupported", {
            cancelled,
            src: videoSrc,
          });
          video.muted = true;
          video.defaultMuted = true;
          video.volume = 0;
          video.src = videoSrc;
          return;
        }

        const hls = new Hls();
        debugLog("video.setup.hls-attached", {
          src: videoSrc,
        });
        hls.loadSource(videoSrc);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_event: unknown, data: { fatal?: boolean }) => {
          if (data.fatal && !cancelled) {
            setMessage("Video stream failed to load.");
            reportPlaybackError("video", "Video stream failed to load.");
            transitionTo(ComboPlayerPhase.Error);
          }
        });
        hlsInstance = hls;
      } catch {
        debugLog("video.setup.hls-fallback", {
          src: videoSrc,
        });
        video.muted = true;
        video.defaultMuted = true;
        video.volume = 0;
        video.src = videoSrc;
      }
    };

    void setup();

    return () => {
      cancelled = true;
      debugLog("video.setup.cleanup", {});
      hlsInstance?.destroy();
    };
  }, [videoSrc]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    let cancelled = false;
    let hlsInstance: HlsInstance | null = null;
    const nextReady = { ...mediaReadyRef.current, audio: false };
    playbackReadyNotifiedRef.current = false;
    mediaReadyRef.current = nextReady;

    const setup = async () => {
      debugLog("audio.setup.start", {
        src: audioSrc,
      });
      if (audio.canPlayType("application/vnd.apple.mpegurl")) {
        debugLog("audio.setup.native-hls", {
          src: audioSrc,
        });
        audio.src = audioSrc;
        return;
      }

      const likelyHls = audioSrc.toLowerCase().includes(".m3u8");
      if (!likelyHls) {
        debugLog("audio.setup.direct", {
          src: audioSrc,
        });
        audio.src = audioSrc;
        return;
      }

      try {
        const hlsModule = await import("hls.js");
        const Hls = hlsModule.default;
        if (!Hls.isSupported() || cancelled) {
          debugLog("audio.setup.hls-unsupported", {
            cancelled,
            src: audioSrc,
          });
          audio.src = audioSrc;
          return;
        }

        const hls = new Hls();
        debugLog("audio.setup.hls-attached", {
          src: audioSrc,
        });
        hls.loadSource(audioSrc);
        hls.attachMedia(audio);
        hls.on(Hls.Events.ERROR, (_event: unknown, data: { fatal?: boolean }) => {
          if (data.fatal && !cancelled) {
            setMessage("Audio stream failed to load.");
            reportPlaybackError("audio", "Audio stream failed to load.");
            transitionTo(ComboPlayerPhase.Error);
          }
        });
        hlsInstance = hls;
      } catch {
        debugLog("audio.setup.hls-fallback", {
          src: audioSrc,
        });
        audio.src = audioSrc;
      }
    };

    void setup();

    return () => {
      cancelled = true;
      debugLog("audio.setup.cleanup", {});
      hlsInstance?.destroy();
    };
  }, [audioSrc]);

  useEffect(() => {
    if (audioMuted !== undefined) {
      return;
    }

    setUncontrolledAudioMuted(resolvedDefaultAudioMuted);
  }, [audioMuted, resolvedDefaultAudioMuted]);

  async function startPlayback(errorMessage: string) {
    const playRequestId = ++playRequestRef.current;
    debugLog("playback.start.attempt", {
      playRequestId,
      phase,
      isAudioMuted: effectiveAudioMuted,
    });

    try {
      const current = getElements();
      if (!current) {
        return;
      }

      const videoPlayResult = await current.video.play().then(
        () => ({ ok: true as const }),
        (error: unknown) => ({ ok: false as const, error })
      );
      const audioPlayResult = await current.audio.play().then(
        () => ({ ok: true as const }),
        (error: unknown) => ({ ok: false as const, error })
      );

      if (playRequestRef.current !== playRequestId) {
        return;
      }

      if (!videoPlayResult.ok) {
        throw videoPlayResult.error;
      }

      if (!audioPlayResult.ok && !effectiveAudioMuted) {
        throw audioPlayResult.error;
      }

      if (!audioPlayResult.ok && effectiveAudioMuted) {
        const name =
          audioPlayResult.error instanceof DOMException
            ? audioPlayResult.error.name
            : typeof audioPlayResult.error === "object" &&
                audioPlayResult.error &&
                "name" in audioPlayResult.error
              ? String((audioPlayResult.error as { name?: unknown }).name)
              : "";
        debugLog("playback.start.audio-muted-play-failed", {
          playRequestId,
          name,
        });
      }

      shouldBePlayingRef.current = true;
      setMessage(null);
      debugLog("playback.start.success", {
        playRequestId,
        audioPlayStarted: audioPlayResult.ok,
      });
      transitionTo(ComboPlayerPhase.Playing);
    } catch (error: unknown) {
      if (playRequestRef.current !== playRequestId) {
        return;
      }

      const name =
        error instanceof DOMException
          ? error.name
          : typeof error === "object" && error && "name" in error
            ? String((error as { name?: unknown }).name)
            : "";

      if (name === "AbortError") {
        debugLog("playback.start.abort", {
          playRequestId,
        });
        transitionTo(ComboPlayerPhase.Stalled);
        return;
      }

      shouldBePlayingRef.current = false;
      setMessage(errorMessage);
      reportPlaybackError("autoplay", errorMessage);
      debugLog("playback.start.error", {
        playRequestId,
        name,
      });
      transitionTo(ComboPlayerPhase.Error);
    }
  }

  async function togglePlayback() {
    const elements = getElements();
    if (!elements) {
      return;
    }

    if (isPlaying) {
      debugLog("playback.toggle.pause", {
        currentTime: elements.master.currentTime,
      });
      elements.video.pause();
      elements.audio.pause();
      shouldBePlayingRef.current = false;
      playRequestRef.current += 1;
      transitionTo(ComboPlayerPhase.Ready);
      return;
    }

    if (atEnd || isTimelineEnded(elements.master.currentTime, duration)) {
      restartFromBeginning();
    }

    debugLog("playback.toggle.play", {
      currentTime: elements.master.currentTime,
      atEnd,
    });
    await startPlayback("Playback could not start. Try pressing play again.");
  }

  function seekTo(nextTime: number) {
    const elements = getElements();
    if (!elements) {
      return;
    }

    const shouldResume = shouldBePlayingRef.current || !elements.master.paused;

    const clamped =
      duration > 0 ? Math.max(0, Math.min(nextTime, duration)) : Math.max(0, nextTime);
    const followerDuration =
      masterTrack === ComboTrackKind.Video ? durations.audioDuration : durations.videoDuration;
    const followerTime = mapFollowerTime(clamped, followerDuration, duration);
    debugLog("playback.seek", {
      requestedTime: nextTime,
      clamped,
      followerTime,
      shouldResume,
      masterTrack,
    });

    if (masterTrack === ComboTrackKind.Video) {
      elements.video.currentTime = clamped;
      elements.audio.currentTime = followerTime;
    } else {
      elements.audio.currentTime = clamped;
      elements.video.currentTime = followerTime;
    }

    setCurrentTime(clamped);
    publishTimeUpdate(clamped, duration);
    if (duration > 0 && clamped >= duration) {
      stopAtEnd();
      return;
    }

    if (shouldResume) {
      if (!elements.master.paused && !elements.follower.paused) {
        shouldBePlayingRef.current = true;
        setMessage(null);
        transitionTo(ComboPlayerPhase.Playing);
        return;
      }

      const playRequestId = ++playRequestRef.current;
      const playPromises: Array<Promise<void>> = [];

      if (elements.video.paused) {
        playPromises.push(elements.video.play());
      }
      if (elements.audio.paused) {
        playPromises.push(elements.audio.play());
      }

      if (playPromises.length === 0) {
        shouldBePlayingRef.current = true;
        setMessage(null);
        transitionTo(ComboPlayerPhase.Playing);
        return;
      }

      void Promise.all(playPromises)
        .then(() => {
          if (playRequestRef.current !== playRequestId) {
            return;
          }
          shouldBePlayingRef.current = true;
          setMessage(null);
          transitionTo(ComboPlayerPhase.Playing);
        })
        .catch((error: unknown) => {
          if (playRequestRef.current !== playRequestId) {
            return;
          }

          const name =
            error instanceof DOMException
              ? error.name
              : typeof error === "object" && error && "name" in error
                ? String((error as { name?: unknown }).name)
                : "";

          if (name === "AbortError") {
            transitionTo(ComboPlayerPhase.Stalled);
            return;
          }

          shouldBePlayingRef.current = false;
          transitionTo(ComboPlayerPhase.Stalled);
        });
      return;
    }

    if (phase === ComboPlayerPhase.Ended && clamped < duration) {
      transitionTo(ComboPlayerPhase.Ready);
    } else {
      handleTimelineTimeUpdateSignal();
      transitionTo(ComboPlayerPhase.Ready);
    }
  }

  const snapshot: ComboPlaybackSnapshot = {
    phase,
    isPlaying,
    atEnd,
    currentTime,
    duration,
    masterTrack,
  };

  if (variant === ComboPlayerVariant.Background) {
    return (
      <section className={`relative h-full w-full overflow-hidden ${className ?? ""}`}>
        {showBuiltInMuteControl
          ? renderAudioToggleButton(
              "pointer-events-auto fixed z-30 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/40 bg-black/45 text-white shadow-lg backdrop-blur-sm [left:max(1.5rem,env(safe-area-inset-left))] [top:max(1.5rem,env(safe-area-inset-top))]"
            )
          : null}
        <video
          className="h-full w-full object-cover will-change-transform"
          controls={false}
          disablePictureInPicture
          disableRemotePlayback
          preload={preload}
          muted
          playsInline
          onCanPlay={handleVideoCanPlay}
          onEnded={() => handleTrackEnded(ComboTrackKind.Video)}
          onError={() => {
            setMessage("Video failed to load.");
            reportPlaybackError("video", "Video failed to load.");
            transitionTo(ComboPlayerPhase.Error);
          }}
          onDurationChange={syncDurations}
          onLoadedData={handleVideoCanPlay}
          onLoadedMetadata={handleVideoLoadedMetadata}
          onPlaying={() => {
            handlePlaybackStartedSignal();
          }}
          onWaiting={() => {
            handlePlaybackWaitingSignal();
          }}
          onStalled={() => {
            handlePlaybackWaitingSignal();
          }}
          onPause={handlePlaybackPausedSignal}
          onPlay={handlePlaybackStartedSignal}
          onTimeUpdate={() => {
            handleTimelineTimeUpdateSignal();
          }}
          ref={assignVideoElement}
          style={{
            objectFit: "cover",
            objectPosition: "50% 50%",
            transform: "scale(1.08)",
            transformOrigin: "center center",
          }}
        />
        <audio
          muted={effectiveAudioMuted}
          preload={preload}
          onCanPlay={handleAudioCanPlay}
          onEnded={() => handleTrackEnded(ComboTrackKind.Audio)}
          onError={() => {
            setMessage("Audio failed to load.");
            reportPlaybackError("audio", "Audio failed to load.");
            transitionTo(ComboPlayerPhase.Error);
          }}
          onDurationChange={syncDurations}
          onLoadedData={handleAudioCanPlay}
          onLoadedMetadata={handleAudioLoadedMetadata}
          onPlaying={() => {
            applyAudioSettingsFromSignals();
            handlePlaybackStartedSignal();
          }}
          onWaiting={() => {
            handlePlaybackWaitingSignal();
          }}
          onStalled={() => {
            handlePlaybackWaitingSignal();
          }}
          onPause={handlePlaybackPausedSignal}
          onPlay={() => {
            applyAudioSettingsFromSignals();
            handlePlaybackStartedSignal();
          }}
          onTimeUpdate={() => {
            handleTimelineTimeUpdateSignal();
          }}
          ref={audioRef}
        />
        {!suppressUi &&
        !snapshot.isPlaying &&
        (snapshot.phase === ComboPlayerPhase.Ready ||
          snapshot.phase === ComboPlayerPhase.Stalled) ? (
          <button
            className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-white/40 bg-black/45 px-4 py-2 text-xs font-medium tracking-wide text-white"
            onClick={() => void togglePlayback()}
            type="button"
          >
            Tap to Play
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <section className={`space-y-6 ${className ?? ""}`}>
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Combo Player</h1>
        <p className="text-sm text-muted-foreground">
          Video: {videoTitle} | Audio: {audioTitle}
        </p>
        <p className="text-xs text-muted-foreground">
          Master: {snapshot.masterTrack} | State: {snapshot.phase}
        </p>
        {comboId ? <p className="text-xs text-muted-foreground">Combo ID: {comboId}</p> : null}
      </header>

      <div className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
        <h1>Default Variant</h1>

        <video
          className="w-full rounded-lg border bg-black"
          controls={false}
          disablePictureInPicture
          disableRemotePlayback
          preload={preload}
          muted
          playsInline
          onCanPlay={handleVideoCanPlay}
          onEnded={() => handleTrackEnded(ComboTrackKind.Video)}
          onError={() => {
            setMessage("Video failed to load.");
            reportPlaybackError("video", "Video failed to load.");
            transitionTo(ComboPlayerPhase.Error);
          }}
          onDurationChange={syncDurations}
          onLoadedData={handleVideoCanPlay}
          onLoadedMetadata={handleVideoLoadedMetadata}
          onPlaying={() => {
            handlePlaybackStartedSignal();
          }}
          onWaiting={() => {
            handlePlaybackWaitingSignal();
          }}
          onStalled={() => {
            handlePlaybackWaitingSignal();
          }}
          onPause={handlePlaybackPausedSignal}
          onPlay={handlePlaybackStartedSignal}
          onTimeUpdate={() => {
            handleTimelineTimeUpdateSignal();
          }}
          ref={assignVideoElement}
        />
        <audio
          muted={effectiveAudioMuted}
          preload={preload}
          onCanPlay={handleAudioCanPlay}
          onEnded={() => handleTrackEnded(ComboTrackKind.Audio)}
          onError={() => {
            setMessage("Audio failed to load.");
            reportPlaybackError("audio", "Audio failed to load.");
            transitionTo(ComboPlayerPhase.Error);
          }}
          onDurationChange={syncDurations}
          onLoadedData={handleAudioCanPlay}
          onLoadedMetadata={handleAudioLoadedMetadata}
          onPlaying={() => {
            applyAudioSettingsFromSignals();
            handlePlaybackStartedSignal();
          }}
          onWaiting={() => {
            handlePlaybackWaitingSignal();
          }}
          onStalled={() => {
            handlePlaybackWaitingSignal();
          }}
          onPause={handlePlaybackPausedSignal}
          onPlay={() => {
            applyAudioSettingsFromSignals();
            handlePlaybackStartedSignal();
          }}
          onTimeUpdate={() => {
            handleTimelineTimeUpdateSignal();
          }}
          ref={audioRef}
        />

        <div className="flex flex-wrap items-center gap-2">
          {showBuiltInMuteControl
            ? renderAudioToggleButton(
                "inline-flex h-10 w-10 items-center justify-center rounded-md border text-sm"
              )
            : null}
          <button
            className="rounded-md border bg-foreground px-3 py-2 text-sm text-background"
            onClick={() => void togglePlayback()}
            type="button"
          >
            {snapshot.isPlaying ? "Pause" : snapshot.atEnd ? "Replay" : "Play"}
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm"
            onClick={() => seekTo((getElements()?.master.currentTime ?? snapshot.currentTime) - 10)}
            type="button"
          >
            -10s
          </button>
          <button
            className="rounded-md border px-3 py-2 text-sm"
            onClick={() => seekTo((getElements()?.master.currentTime ?? snapshot.currentTime) + 10)}
            type="button"
          >
            +10s
          </button>
        </div>

        <input
          className="w-full"
          max={snapshot.duration || 0}
          min={0}
          onChange={(event) => {
            const value = Number(event.target.value);
            seekTo(value);
          }}
          step={0.1}
          type="range"
          value={Math.min(snapshot.currentTime, snapshot.duration || snapshot.currentTime)}
        />
        <p className="text-xs text-muted-foreground">
          {snapshot.currentTime.toFixed(1)}s / {snapshot.duration.toFixed(1)}s
        </p>
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </section>
  );
}
