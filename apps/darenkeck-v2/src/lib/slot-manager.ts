export const SlotManagerState = {
  Idle: "idle",
  Initializing: "initializing",
  Ready: "ready",
  LoadingNext: "loading_next",
  Error: "error",
  Destroyed: "destroyed",
} as const;

export type SlotManagerState = (typeof SlotManagerState)[keyof typeof SlotManagerState];

export const SlotPlaybackState = {
  Idle: "idle",
  Loading: "loading",
  Ready: "ready",
  Playing: "playing",
  Completed: "completed",
  Error: "error",
} as const;

export type SlotPlaybackState = (typeof SlotPlaybackState)[keyof typeof SlotPlaybackState];

export const SingleSlotKey = {
  Primary: "primary",
} as const;

export type SingleSlotKey = (typeof SingleSlotKey)[keyof typeof SingleSlotKey];

export type ComboPayload = {
  comboId: string;
  videoTitle: string;
  audioTitle: string;
  videoSrc: string;
  audioSrc: string;
};

export type SlotPlaybackAssignment = {
  combo: ComboPayload;
  playbackCycle: number;
};

type SlotManagerEvents = {
  onComboChanged: (assignment: SlotPlaybackAssignment | null) => void;
  onLoadingChange?: (loading: boolean) => void;
  onError?: (message: string | null) => void;
  onManagerStateChange?: (state: SlotManagerState) => void;
  onSlotStateChange?: (slot: SingleSlotKey, state: SlotPlaybackState) => void;
  onCombosPlayedChange?: (count: number) => void;
  onDebug?: (event: string, data?: Record<string, unknown>) => void;
};

type SlotManagerOptions = {
  fetchRandomCombo: () => Promise<ComboPayload | null>;
  events: SlotManagerEvents;
};

function mapPlayerPhaseToSlotPlaybackState(phase: string): SlotPlaybackState {
  if (phase === "loading") {
    return SlotPlaybackState.Loading;
  }

  if (phase === "ready" || phase === "stalled") {
    return SlotPlaybackState.Ready;
  }

  if (phase === "playing") {
    return SlotPlaybackState.Playing;
  }

  if (phase === "ended") {
    return SlotPlaybackState.Completed;
  }

  if (phase === "error") {
    return SlotPlaybackState.Error;
  }

  return SlotPlaybackState.Idle;
}

export class SlotManager {
  private currentCombo: ComboPayload | null = null;
  private loading = false;
  private destroyed = false;
  private inFlightFetch: Promise<void> | null = null;
  private managerState: SlotManagerState = SlotManagerState.Idle;
  private slotState: SlotPlaybackState = SlotPlaybackState.Idle;
  private combosPlayedCount = 0;
  private playbackCycle = 0;

  constructor(private readonly options: SlotManagerOptions) {}

  async init(): Promise<void> {
    this.setManagerState(SlotManagerState.Initializing);
    await this.loadNext("init");
  }

  async handleSlotPlaybackEnded(slot: SingleSlotKey): Promise<void> {
    this.setSlotState(slot, SlotPlaybackState.Completed);
    this.setCombosPlayedCount(this.combosPlayedCount + 1);
    await this.loadNext("slot-playback-ended");
  }

  handleSlotPlaybackReady(slot: SingleSlotKey): void {
    this.setSlotState(slot, SlotPlaybackState.Ready);
  }

  handleSlotPlaybackPhaseChange(slot: SingleSlotKey, phase: string): void {
    this.setSlotState(slot, mapPlayerPhaseToSlotPlaybackState(phase));
  }

  getCurrentCombo(): ComboPayload | null {
    return this.currentCombo;
  }

  getCombosPlayedCount(): number {
    return this.combosPlayedCount;
  }

  destroy(): void {
    this.destroyed = true;
    this.setManagerState(SlotManagerState.Destroyed);
  }

  private async loadNext(reason: string): Promise<void> {
    if (this.destroyed) {
      return;
    }

    if (this.inFlightFetch) {
      this.emitDebug("fetch.skip.in_flight", { reason });
      return this.inFlightFetch;
    }

    this.inFlightFetch = (async () => {
      this.setLoading(true);
      this.setManagerState(
        reason === "init" ? SlotManagerState.Initializing : SlotManagerState.LoadingNext
      );
      this.options.events.onError?.(null);
      this.setSlotState(SingleSlotKey.Primary, SlotPlaybackState.Loading);
      this.emitDebug("fetch.start", { reason });

      try {
        const next = await this.options.fetchRandomCombo();
        if (this.destroyed) {
          return;
        }

        if (!next) {
          throw new Error("No combo returned from random combo endpoint");
        }

        const previousComboId = this.currentCombo?.comboId ?? null;
        const sameAsPrevious = previousComboId === next.comboId;
        this.currentCombo = next;
        this.playbackCycle += 1;
        this.options.events.onComboChanged({
          combo: next,
          playbackCycle: this.playbackCycle,
        });
        this.setManagerState(SlotManagerState.Ready);
        this.emitDebug("fetch.success", {
          reason,
          comboId: next.comboId,
          previousComboId,
          sameAsPrevious,
          playbackCycle: this.playbackCycle,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load combo";
        this.setManagerState(SlotManagerState.Error);
        this.setSlotState(SingleSlotKey.Primary, SlotPlaybackState.Error);
        this.options.events.onError?.(message);
        this.emitDebug("fetch.error", {
          reason,
          message,
        });
      } finally {
        this.setLoading(false);
        this.inFlightFetch = null;
      }
    })();

    return this.inFlightFetch;
  }

  private setLoading(next: boolean): void {
    if (this.loading === next) {
      return;
    }

    this.loading = next;
    this.options.events.onLoadingChange?.(next);
  }

  private setManagerState(next: SlotManagerState): void {
    if (this.managerState === next) {
      return;
    }

    this.managerState = next;
    this.options.events.onManagerStateChange?.(next);
  }

  private setSlotState(slot: SingleSlotKey, next: SlotPlaybackState): void {
    if (this.slotState === next) {
      return;
    }

    this.slotState = next;
    this.options.events.onSlotStateChange?.(slot, next);
  }

  private setCombosPlayedCount(next: number): void {
    if (this.combosPlayedCount === next) {
      return;
    }

    this.combosPlayedCount = next;
    this.options.events.onCombosPlayedChange?.(next);
  }

  private emitDebug(event: string, data: Record<string, unknown> = {}): void {
    this.options.events.onDebug?.(event, {
      managerState: this.managerState,
      slotState: this.slotState,
      combosPlayedCount: this.combosPlayedCount,
      ...data,
    });
  }
}
