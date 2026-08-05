// @ts-expect-error -- Bun supplies this runtime module; the browser app does not include Bun types.
import { describe, expect, it } from "bun:test";

import { SingleSlotKey, SlotManager, type ComboPayload } from "../src/lib/slot-manager";

const combo = (id: string): ComboPayload => ({
  comboId: `combo-${id}`,
  videoAssetId: `video-${id}`,
  audioAssetId: `audio-${id}`,
  videoTitle: `Video ${id}`,
  audioTitle: `Audio ${id}`,
  videoSrc: `https://example.com/video-${id}.m3u8`,
  audioSrc: `https://example.com/audio-${id}.m3u8`,
  predictedTone: {
    valence: 0.1,
    arousal: 0.2,
    dominance: 0.3,
    warmth: 0.4,
    tension: 0.5,
    intimacy: 0.6,
    instability: 0.7,
    nostalgia: 0.8,
    beauty: 0.9,
    menace: 1,
  },
});

describe("SlotManager", () => {
  it("serializes automatic and manual transitions through one selector", async () => {
    const reasons: string[] = [];
    const assignments: string[] = [];
    const manager = new SlotManager({
      async fetchNextCombo(current, reason) {
        reasons.push(reason);
        return combo(current ? "next" : "initial");
      },
      events: {
        onComboChanged(assignment) {
          if (assignment) assignments.push(assignment.combo.comboId);
        },
      },
    });

    await manager.init();
    await manager.requestNext();
    await manager.handleSlotPlaybackEnded(SingleSlotKey.Primary);

    expect(reasons).toEqual(["init", "tone-submit", "slot-playback-ended"]);
    expect(assignments).toEqual(["combo-initial", "combo-next", "combo-next"]);
    expect(manager.getCurrentCombo()?.predictedTone?.menace).toBe(1);
  });

  it("queues a manual tone request behind an automatic transition", async () => {
    const reasons: string[] = [];
    let releaseAutomatic: ((value: ComboPayload) => void) | null = null;
    const manager = new SlotManager({
      async fetchNextCombo(current, reason) {
        reasons.push(reason);
        if (reason === "slot-playback-ended") {
          return await new Promise<ComboPayload>((resolve) => {
            releaseAutomatic = resolve;
          });
        }
        return combo(current ? "manual" : "initial");
      },
      events: { onComboChanged() {} },
    });

    await manager.init();
    const automatic = manager.handleSlotPlaybackEnded(SingleSlotKey.Primary);
    const manual = manager.requestNext();
    releaseAutomatic?.(combo("automatic"));
    await Promise.all([automatic, manual]);

    expect(reasons).toEqual(["init", "slot-playback-ended", "tone-submit"]);
  });
});
