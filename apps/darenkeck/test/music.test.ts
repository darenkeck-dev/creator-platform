// @ts-expect-error -- Bun supplies this runtime module; the browser app does not include Bun types.
import { describe, expect, it } from "bun:test";

import type { PublicMusicRelease } from "@media-manager/contracts";

import { formatMusicDuration, sortMusicReleases } from "../src/lib/music";

function release(id: string, title: string, releaseDate: string): PublicMusicRelease {
  return { id, title, releaseDate } as PublicMusicRelease;
}

describe("music catalog", () => {
  it("sorts releases newest first with stable title ordering", () => {
    const releases = sortMusicReleases([
      release("1", "Older", "2024-01-01"),
      release("2", "Zulu", "2026-05-01"),
      release("3", "Alpha", "2026-05-01"),
    ]);

    expect(releases.map(({ title }) => title)).toEqual(["Alpha", "Zulu", "Older"]);
  });

  it("formats rounded track durations without producing sixty seconds", () => {
    expect(formatMusicDuration(239.8)).toBe("4:00");
    expect(formatMusicDuration(61)).toBe("1:01");
    expect(formatMusicDuration(undefined)).toBeNull();
  });
});
