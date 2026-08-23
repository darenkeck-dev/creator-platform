import {
  ComboPlayer,
  type ComboPlayerHandle,
  type ComboPlayerPhase,
  type ComboTimelineTrack,
} from "@media-manager/shared";
import type { Ref } from "react";

import type { ComboPayload } from "../lib/slot-manager";

type SingleComboSlotProps = {
  combo: ComboPayload;
  playbackCycle: number;
  audioMuted: boolean;
  audioVolume: number;
  playerRef?: Ref<ComboPlayerHandle>;
  timelineTrack?: ComboTimelineTrack;
  onVideoElementChange?: (video: HTMLVideoElement | null) => void;
  onAudioElementChange?: (audio: HTMLAudioElement | null) => void;
  onTimelineEnded?: () => void;
  onPlaybackReady?: () => void;
  onPlaybackStateChange?: (phase: ComboPlayerPhase) => void;
  onTimeUpdate?: (snapshot: { currentTime: number; duration: number; remaining: number }) => void;
};

export function SingleComboSlot({
  combo,
  playbackCycle,
  audioMuted,
  audioVolume,
  playerRef,
  timelineTrack,
  onVideoElementChange,
  onAudioElementChange,
  onTimelineEnded,
  onPlaybackReady,
  onPlaybackStateChange,
  onTimeUpdate,
}: SingleComboSlotProps) {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 print:hidden">
      <ComboPlayer
        key={`${combo.comboId}-${playbackCycle}`}
        audioMuted={audioMuted}
        audioSrc={combo.audioSrc}
        audioTitle={combo.audioTitle}
        audioVolume={audioVolume}
        autoPlay
        className="h-full w-full"
        comboId={combo.comboId}
        onAudioElementChange={onAudioElementChange}
        onPlaybackReady={onPlaybackReady}
        onPlaybackStateChange={onPlaybackStateChange}
        onTimeUpdate={onTimeUpdate}
        onTimelineEnded={onTimelineEnded}
        onVideoElementChange={onVideoElementChange}
        preload="auto"
        ref={playerRef}
        suppressUi
        timelineTrack={timelineTrack}
        variant="background"
        videoSrc={combo.videoSrc}
        videoTitle={combo.videoTitle}
      />
    </div>
  );
}
