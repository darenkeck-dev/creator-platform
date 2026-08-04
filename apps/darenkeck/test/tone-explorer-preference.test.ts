// @ts-expect-error -- Bun supplies this runtime module; the browser app does not include Bun types.
import { describe, expect, it } from "bun:test";

import {
  TONE_EXPLORER_EXPLAINED_KEY,
  acknowledgeToneExplorer,
  hasAcknowledgedToneExplorer,
} from "../src/lib/tone-explorer-preference";

describe("tone explorer preference", () => {
  it("persists acknowledgment under the versioned key", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem(key: string) {
        return values.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        values.set(key, value);
      },
    };

    expect(hasAcknowledgedToneExplorer(storage)).toBe(false);
    acknowledgeToneExplorer(storage);
    expect(values.get(TONE_EXPLORER_EXPLAINED_KEY)).toBe("1");
    expect(hasAcknowledgedToneExplorer(storage)).toBe(true);
  });

  it("degrades to an unacknowledged session when storage is blocked", () => {
    const storage = {
      getItem() {
        throw new DOMException("Blocked", "SecurityError");
      },
      setItem() {
        throw new DOMException("Blocked", "SecurityError");
      },
    };

    expect(hasAcknowledgedToneExplorer(storage)).toBe(false);
    expect(() => acknowledgeToneExplorer(storage)).not.toThrow();
  });
});
