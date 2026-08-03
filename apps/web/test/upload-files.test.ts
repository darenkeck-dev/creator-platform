// @ts-expect-error -- Bun supplies this runtime module; the browser app does not include Bun types.
import { describe, expect, it } from "bun:test";

import {
  aggregateUploadProgress,
  inferAssetTypeFromFile,
  runWithConcurrency,
  titleFromFileName,
} from "../lib/upload-files";

describe("inferAssetTypeFromFile", () => {
  it.each([
    ["clip.bin", "video/mp4", "video"],
    ["track.bin", "audio/mpeg", "audio"],
    ["cover.bin", "image/png", "image"],
    ["CLIP.MOV", "", "video"],
    ["track.flac", "application/octet-stream", "audio"],
    ["cover.JPEG", "application/octet-stream", "image"],
  ] as const)("infers %s", (name: string, type: string, expected: string) => {
    expect(inferAssetTypeFromFile({ name, type })).toBe(expected);
  });

  it("uses MIME before a conflicting extension", () => {
    expect(inferAssetTypeFromFile({ name: "track.mp3", type: "video/mp4" })).toBe("video");
  });

  it("returns null for unsupported files", () => {
    expect(inferAssetTypeFromFile({ name: "notes.pdf", type: "application/pdf" })).toBeNull();
  });
});

describe("titleFromFileName", () => {
  it.each([
    ["  summer.mix.mp3  ", "summer.mix"],
    ["README", "README"],
    [".hidden", ".hidden"],
    ["   ", ""],
  ])("turns %j into %j", (name: string, expected: string) => {
    expect(titleFromFileName(name)).toBe(expected);
  });
});

describe("runWithConcurrency", () => {
  it("bounds workers, preserves item order, and collects failures", async () => {
    let active = 0;
    let peak = 0;

    const results = await runWithConcurrency([1, 2, 3, 4], 2, async (item) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, item % 2 === 0 ? 2 : 5));
      active -= 1;
      if (item === 3) throw new Error("failed three");
      return item * 10;
    });

    expect(peak).toBe(2);
    expect(results[0]).toEqual({ ok: true, value: 10 });
    expect(results[1]).toEqual({ ok: true, value: 20 });
    expect(results[2]?.ok).toBe(false);
    expect(results[3]).toEqual({ ok: true, value: 40 });
  });

  it("rejects an invalid worker bound", () => {
    expect(runWithConcurrency([], 0, async () => null)).rejects.toBeInstanceOf(RangeError);
  });
});

describe("aggregateUploadProgress", () => {
  it("weights progress by file bytes", () => {
    expect(
      aggregateUploadProgress([
        { file: { size: 100 }, progress: 1 },
        { file: { size: 300 }, progress: 0.5 },
      ])
    ).toBe(0.625);
  });

  it("clamps row progress and handles no bytes", () => {
    expect(
      aggregateUploadProgress([
        { file: { size: 10 }, progress: 2 },
        { file: { size: 10 }, progress: -1 },
      ])
    ).toBe(0.5);
    expect(aggregateUploadProgress([])).toBe(0);
    expect(aggregateUploadProgress([{ file: { size: 0 }, progress: 1 }])).toBe(0);
  });
});
