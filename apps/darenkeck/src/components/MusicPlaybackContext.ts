import type { PublicMusicRelease } from "@media-manager/contracts";
import { createContext, useContext } from "react";

export type MusicPlaybackContextValue = {
  currentTrackId: string | null;
  error: string | null;
  loadingTrackId: string | null;
  playing: boolean;
  playTrack: (release: PublicMusicRelease, trackIndex: number) => void;
};

export const MusicPlaybackContext = createContext<MusicPlaybackContextValue | null>(null);

export function useMusicPlayback(): MusicPlaybackContextValue {
  const value = useContext(MusicPlaybackContext);
  if (!value) {
    throw new Error("Music playback context is unavailable");
  }
  return value;
}
