export const ComboTrackKind = {
  Video: "video",
  Audio: "audio",
} as const;

export type ComboTrackKind = (typeof ComboTrackKind)[keyof typeof ComboTrackKind];

export const ComboPlayerPhase = {
  Idle: "idle",
  Loading: "loading",
  Ready: "ready",
  Playing: "playing",
  Stalled: "stalled",
  Ended: "ended",
  Error: "error",
} as const;

export type ComboPlayerPhase = (typeof ComboPlayerPhase)[keyof typeof ComboPlayerPhase];

export type ComboPlaybackSnapshot = {
  phase: ComboPlayerPhase;
  isPlaying: boolean;
  atEnd: boolean;
  currentTime: number;
  duration: number;
  masterTrack: ComboTrackKind;
};

export type ComboDurations = {
  videoDuration: number;
  audioDuration: number;
};

export function normalizeDuration(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function getMasterTrackFromDurations(durations: ComboDurations): ComboTrackKind {
  void durations;
  return ComboTrackKind.Audio;
}

export function getTimelineDuration(durations: ComboDurations): number {
  if (durations.audioDuration > 0) {
    return durations.audioDuration;
  }

  return durations.videoDuration;
}

export function mapFollowerTime(
  masterTime: number,
  followerDuration: number,
  timelineDuration: number
): number {
  if (followerDuration <= 0) {
    return masterTime;
  }

  if (timelineDuration > 0 && masterTime >= timelineDuration) {
    return followerDuration;
  }

  return masterTime % followerDuration;
}

export function isTimelineEnded(masterCurrentTime: number, timelineDuration: number): boolean {
  if (timelineDuration <= 0) {
    return false;
  }

  return masterCurrentTime >= timelineDuration - 0.05;
}
