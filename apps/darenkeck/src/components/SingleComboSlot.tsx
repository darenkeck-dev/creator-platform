import { ComboPlayer } from "@media-manager/shared";

import type { ComboPayload } from "../lib/slot-manager";

type SingleComboSlotProps = {
  combo: ComboPayload;
  playbackCycle: number;
  audioMuted: boolean;
  audioVolume: number;
  onVideoElementChange?: (video: HTMLVideoElement | null) => void;
  onAudioElementChange?: (audio: HTMLAudioElement | null) => void;
  onTimelineEnded?: () => void;
  onPlaybackReady?: () => void;
  onPlaybackStateChange?: (phase: string) => void;
};

export function SingleComboSlot({
  combo,
  playbackCycle,
  audioMuted,
  audioVolume,
  onVideoElementChange,
  onAudioElementChange,
  onTimelineEnded,
  onPlaybackReady,
  onPlaybackStateChange,
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
        onTimelineEnded={onTimelineEnded}
        onVideoElementChange={onVideoElementChange}
        preload="auto"
        suppressUi
        variant="background"
        videoSrc={combo.videoSrc}
        videoTitle={combo.videoTitle}
      />
    </div>
  );
}
