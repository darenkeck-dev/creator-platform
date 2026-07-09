/// <reference types="bun-types" />

import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "bun:test";

import { normalizeAudioForOpenAI } from "../src/audio-normalization.js";

describe("audio normalization", () => {
  it("normalizes source audio to a deterministic mp3 path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tone-core-audio-test-"));
    try {
      const inputPath = join(dir, "source.m4a");
      const outputDir = join(dir, "normalized");
      const argsPath = join(dir, "ffmpeg-args.txt");
      const fakeFfmpegPath = join(dir, "fake-ffmpeg.sh");

      await writeFile(inputPath, "not real audio", "utf-8");
      await writeFile(
        fakeFfmpegPath,
        `#!/bin/sh\nprintf '%s\n' "$@" > "${argsPath}"\nlast=""\nfor arg in "$@"; do last="$arg"; done\nprintf 'normalized' > "$last"\n`,
        "utf-8"
      );
      await chmod(fakeFfmpegPath, 0o755);

      const normalizedPath = await normalizeAudioForOpenAI({
        inputPath,
        outputDir,
        ffmpegPath: fakeFfmpegPath,
      });

      const args = await readFile(argsPath, "utf-8");
      expect(normalizedPath).toBe(join(outputDir, "openai-audio.mp3"));
      expect(args).toContain("-vn\n");
      expect(args).toContain("-ac\n2\n");
      expect(args).toContain("-ar\n44100\n");
      expect(args).toContain("-b:a\n128k\n");
      expect(await readFile(normalizedPath, "utf-8")).toBe("normalized");
    } finally {
      await rm(dir, { force: true, recursive: true });
    }
  });
});
