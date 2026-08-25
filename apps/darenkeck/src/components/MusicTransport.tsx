import type { PublicMusicTrack } from "@media-manager/contracts";
import { Link } from "react-router-dom";

import { formatMusicDuration } from "../lib/music";
import { ContentSizeButton } from "./ContentSizeButton";
import { ShellLoader } from "./ShellLoader";

type MusicTransportProps = {
  audioMuted: boolean;
  contentMinimized: boolean;
  currentTime: number;
  duration: number;
  loading?: boolean;
  playing: boolean;
  releaseId: string;
  releaseTitle: string;
  showBottomMinimize: boolean;
  track: PublicMusicTrack;
  onExit: () => void;
  onMuteToggle: () => void;
  onMinimize: () => void;
  onNavigate: () => void;
  onPlayToggle: () => void;
  onSeek: (seconds: number) => void;
};

const controlClassName =
  "flex h-10 w-10 shrink-0 items-center justify-center text-white transition hover:text-white/70 min-[360px]:h-12 min-[360px]:w-12";
const controlsClassName =
  "pointer-events-none fixed bottom-0 left-1/2 z-[140] grid h-[max(4rem,calc(env(safe-area-inset-bottom)+3.5rem))] w-full max-w-4xl -translate-x-1/2 grid-cols-[5.5rem_minmax(0,1fr)_5.5rem] items-center gap-2 border-t border-white/25 bg-black/40 px-4 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.3)] backdrop-blur-md min-[360px]:grid-cols-[7rem_minmax(0,1fr)_7rem] sm:gap-3 sm:px-6";
const centerClassName =
  "flex min-w-0 justify-center px-1 text-center text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]";

function MinimizedPlayerColorBorder() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-x-0 top-0 grid h-0.5 grid-cols-4"
      data-minimized-player-color-border
    >
      <span className="bg-[var(--primary-yellow)]" />
      <span className="bg-[var(--primary-red)]" />
      <span className="bg-[var(--primary-orange)]" />
      <span className="bg-[var(--primary-blue)]" />
    </div>
  );
}

export function MusicTransportLoader({
  audioMuted,
  contentMinimized,
  onMuteToggle,
  onMinimize,
  onNavigate,
  onPlayToggle,
  playing,
  showBottomMinimize,
}: {
  audioMuted: boolean;
  contentMinimized: boolean;
  onMuteToggle: () => void;
  onMinimize: () => void;
  onNavigate: () => void;
  onPlayToggle: () => void;
  playing: boolean;
  showBottomMinimize: boolean;
}) {
  return (
    <>
      <div className="pointer-events-none fixed bottom-0 left-1/2 z-[125] h-28 w-full max-w-4xl -translate-x-1/2 bg-gradient-to-t from-black/65 to-transparent" />
      <aside
        aria-label="Music player loading"
        className={controlsClassName}
        data-music-transport
        data-music-transport-loading
      >
        {contentMinimized ? <MinimizedPlayerColorBorder /> : null}
        <div className="pointer-events-auto flex items-center gap-2">
          <MusicPlayButton context="combo" onClick={onPlayToggle} playing={playing} />
          <MusicMuteButton audioMuted={audioMuted} context="audio" onClick={onMuteToggle} />
        </div>
        <div className={centerClassName}><ShellLoader /></div>
        <div className="pointer-events-auto flex items-center gap-2">
          {contentMinimized || showBottomMinimize ? (
            <ContentSizeButton
              expanded={!contentMinimized}
              onClick={contentMinimized ? onNavigate : onMinimize}
            />
          ) : null}
        </div>
      </aside>
    </>
  );
}

export function MusicPlayButton({
  context = "music",
  playing,
  onClick,
}: {
  context?: "combo" | "music";
  playing: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={playing ? `Pause ${context}` : `Play ${context}`}
      className={controlClassName}
      data-player-control
      onClick={onClick}
      type="button"
    >
      {playing ? (
        <svg aria-hidden="true" fill="currentColor" height="24" viewBox="0 0 24 24" width="24">
          <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
        </svg>
      ) : (
        <svg aria-hidden="true" fill="currentColor" height="24" viewBox="0 0 24 24" width="24">
          <path d="M8 5v14l11-7z" />
        </svg>
      )}
    </button>
  );
}

export function MusicMuteButton({
  audioMuted,
  context = "music",
  onClick,
}: {
  audioMuted: boolean;
  context?: "audio" | "music";
  onClick: () => void;
}) {
  return (
    <button
      aria-label={audioMuted ? `Unmute ${context}` : `Mute ${context}`}
      className={controlClassName}
      data-player-control
      onClick={onClick}
      type="button"
    >
      <svg aria-hidden="true" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24">
        <path d="M11 5L6 9H3v6h3l5 4V5z" />
        {audioMuted ? (
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

export function MusicExitButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      aria-label="Stop music and return to ambient playback"
      className={controlClassName}
      data-player-control
      onClick={onClick}
      title="Stop music"
      type="button"
    >
      <svg aria-hidden="true" fill="currentColor" height="24" viewBox="0 0 24 24" width="24">
        <rect height="12" rx="1" width="12" x="6" y="6" />
      </svg>
    </button>
  );
}

export function MusicTransport({
  audioMuted,
  contentMinimized,
  currentTime,
  duration,
  loading = false,
  playing,
  releaseId,
  releaseTitle,
  showBottomMinimize,
  track,
  onExit,
  onMinimize,
  onMuteToggle,
  onNavigate,
  onPlayToggle,
  onSeek,
}: MusicTransportProps) {
  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;

  return (
    <>
      <div className="pointer-events-none fixed bottom-0 left-1/2 z-[125] h-28 w-full max-w-4xl -translate-x-1/2 bg-gradient-to-t from-black/65 to-transparent" />
      <aside aria-label="Music player" className={controlsClassName} data-music-transport>
        {contentMinimized ? <MinimizedPlayerColorBorder /> : null}
        <div className="pointer-events-auto col-start-1 flex items-center gap-2">
          <MusicPlayButton onClick={onPlayToggle} playing={playing} />
          <MusicMuteButton audioMuted={audioMuted} onClick={onMuteToggle} />
        </div>
        <div className={`${centerClassName} col-start-2`} data-music-track-label>
          {loading ? (
            <ShellLoader />
          ) : (
            <Link
              aria-label={`View ${releaseTitle} on the Music page`}
              className="pointer-events-auto min-w-0 transition hover:text-cyan-100"
              onClick={onNavigate}
              to={`/music#release-${releaseId}`}
            >
              <strong className="block truncate text-sm">{track.title}</strong>
              <span className="mt-1 hidden truncate text-[11px] text-white/60 sm:block">
                {releaseTitle}
              </span>
            </Link>
          )}
        </div>
        <div
          className="pointer-events-auto col-start-3 flex items-center justify-self-end gap-2"
          data-music-right-controls
        >
          <MusicExitButton onClick={onExit} />
          {contentMinimized || showBottomMinimize ? (
            <ContentSizeButton
              expanded={!contentMinimized}
              onClick={contentMinimized ? onNavigate : onMinimize}
            />
          ) : (
            <span aria-hidden="true" className="h-8 w-8 shrink-0" data-music-size-slot />
          )}
        </div>
      </aside>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed bottom-0 left-1/2 z-[145] h-1 w-full max-w-4xl -translate-x-1/2 bg-white/20"
        data-music-progress-rail
      >
        <div
          className="h-full bg-cyan-100 transition-[width] duration-150 ease-linear motion-reduce:transition-none"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <input
        aria-label={`Music progress: ${formatMusicDuration(currentTime) ?? "0:00"} of ${formatMusicDuration(duration) ?? "0:00"}`}
        className="fixed bottom-0 left-1/2 z-[150] h-5 w-full max-w-4xl -translate-x-1/2 cursor-pointer opacity-0"
        max={duration || 0}
        min={0}
        onChange={(event) => onSeek(Number(event.target.value))}
        step={0.1}
        type="range"
        value={Math.min(currentTime, duration || currentTime)}
      />
    </>
  );
}
