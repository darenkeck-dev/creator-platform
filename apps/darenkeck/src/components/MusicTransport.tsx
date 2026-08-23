import type { PublicMusicTrack } from "@media-manager/contracts";
import { Link } from "react-router-dom";

import { formatMusicDuration } from "../lib/music";
import { ShellLoader } from "./ShellLoader";

type MusicTransportProps = {
  audioMuted: boolean;
  currentTime: number;
  duration: number;
  loading?: boolean;
  playing: boolean;
  releaseId: string;
  releaseTitle: string;
  track: PublicMusicTrack;
  onExit: () => void;
  onMuteToggle: () => void;
  onPlayToggle: () => void;
  onSeek: (seconds: number) => void;
};

const controlClassName =
  "flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/40 bg-black/45 text-white shadow-lg backdrop-blur-sm transition hover:bg-black/65";
const transportClassName =
  "pointer-events-auto fixed left-1/2 top-[max(1rem,env(safe-area-inset-top))] z-[140] flex w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 items-center gap-2 rounded-2xl border border-white/35 bg-black/75 p-2 text-white shadow-2xl backdrop-blur-md sm:gap-3 sm:px-3";

export function MusicTransportLoader() {
  return (
    <aside
      aria-label="Music player loading"
      className={`${transportClassName} min-h-16 justify-center`}
      data-music-transport
      data-music-transport-loading
    >
      <ShellLoader />
    </aside>
  );
}

export function MusicPlayButton({ playing, onClick }: { playing: boolean; onClick: () => void }) {
  return (
    <button
      aria-label={playing ? "Pause music" : "Play music"}
      className={controlClassName}
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
  onClick,
}: {
  audioMuted: boolean;
  onClick: () => void;
}) {
  return (
    <button
      aria-label={audioMuted ? "Unmute music" : "Mute music"}
      className={controlClassName}
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
      aria-label="Return to ambient playback"
      className={controlClassName}
      onClick={onClick}
      title="Return to ambient playback"
      type="button"
    >
      <svg aria-hidden="true" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24" width="24">
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  );
}

export function MusicTransport({
  audioMuted,
  currentTime,
  duration,
  loading = false,
  playing,
  releaseId,
  releaseTitle,
  track,
  onExit,
  onMuteToggle,
  onPlayToggle,
  onSeek,
}: MusicTransportProps) {
  return (
    <aside
      aria-label="Music player"
      className={transportClassName}
      data-music-transport
    >
      <MusicPlayButton onClick={onPlayToggle} playing={playing} />
      <MusicMuteButton audioMuted={audioMuted} onClick={onMuteToggle} />
      <div className="flex min-w-0 flex-1 justify-center">
        {loading ? (
          <ShellLoader />
        ) : (
          <div className="min-w-0 flex-1">
            <Link
              aria-label={`View ${releaseTitle} on the Music page`}
              className="flex min-w-0 items-baseline gap-2 transition hover:text-cyan-100"
              to={`/music#release-${releaseId}`}
            >
              <strong className="truncate text-sm">{track.title}</strong>
              <span className="hidden truncate text-xs text-white/55 sm:inline">{releaseTitle}</span>
            </Link>
            <div className="mt-1 flex items-center gap-2">
              <span className="hidden w-9 text-right text-[10px] tabular-nums text-white/60 sm:block">
                {formatMusicDuration(currentTime) ?? "0:00"}
              </span>
              <input
                aria-label="Music progress"
                className="min-w-0 flex-1 accent-cyan-200"
                max={duration || 0}
                min={0}
                onChange={(event) => onSeek(Number(event.target.value))}
                step={0.1}
                type="range"
                value={Math.min(currentTime, duration || currentTime)}
              />
              <span className="hidden w-9 text-[10px] tabular-nums text-white/60 sm:block">
                {formatMusicDuration(duration) ?? "0:00"}
              </span>
            </div>
          </div>
        )}
      </div>
      <MusicExitButton onClick={onExit} />
    </aside>
  );
}
