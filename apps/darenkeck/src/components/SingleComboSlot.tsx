import { ComboPlayer } from "@media-manager/shared";

type ComboPayload = {
  comboId: string;
  videoTitle: string;
  audioTitle: string;
  videoSrc: string;
  audioSrc: string;
};

type SingleComboSlotProps = {
  combo: ComboPayload;
  playbackCycle: number;
  audioMuted: boolean;
  audioVolume: number;
  onTimelineEnded?: () => void;
  onPlaybackReady?: () => void;
  onPlaybackStateChange?: (phase: string) => void;
};

export function SingleComboSlot({
  combo,
  playbackCycle,
  audioMuted,
  audioVolume,
  onTimelineEnded,
  onPlaybackReady,
  onPlaybackStateChange,
}: SingleComboSlotProps) {
  return (
    <div className="absolute inset-0 z-0">
      <ComboPlayer
        key={`${combo.comboId}-${playbackCycle}`}
        audioMuted={audioMuted}
        audioSrc={combo.audioSrc}
        audioTitle={combo.audioTitle}
        audioVolume={audioVolume}
        autoPlay
        className="h-full w-full"
        comboId={combo.comboId}
        onPlaybackReady={onPlaybackReady}
        onPlaybackStateChange={onPlaybackStateChange}
        onTimelineEnded={onTimelineEnded}
        preload="auto"
        suppressUi
        variant="background"
        videoSrc={combo.videoSrc}
        videoTitle={combo.videoTitle}
      />
    </div>
  );
}
