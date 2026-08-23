export const ComboPlayerVariant = {
  Default: "default",
  Background: "background",
} as const;

export type ComboPlayerVariant = (typeof ComboPlayerVariant)[keyof typeof ComboPlayerVariant];

export const ComboTimelineTrack = {
  Auto: "auto",
  Video: "video",
  Audio: "audio",
} as const;

export type ComboTimelineTrack = (typeof ComboTimelineTrack)[keyof typeof ComboTimelineTrack];

export type ComboPlayerHandle = {
  play: () => Promise<void>;
  pause: () => void;
  togglePlayback: () => Promise<void>;
  seekTo: (seconds: number) => void;
};
