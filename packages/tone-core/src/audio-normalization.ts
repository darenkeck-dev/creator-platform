import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";

import { runFfmpeg } from "./frame-extraction.js";

export type NormalizeAudioForOpenAIInput = {
  inputPath: string;
  outputDir: string;
  ffmpegPath?: string;
  timeoutMs?: number;
};

export async function normalizeAudioForOpenAI(
  input: NormalizeAudioForOpenAIInput
): Promise<string> {
  const ffmpegPath = input.ffmpegPath ?? process.env.FFMPEG_PATH ?? "ffmpeg";
  const outputPath = join(input.outputDir, "openai-audio.mp3");

  await mkdir(input.outputDir, { recursive: true });
  await rm(outputPath, { force: true });

  await runFfmpeg({
    ffmpegPath,
    args: [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      input.inputPath,
      "-vn",
      "-ac",
      "2",
      "-ar",
      "44100",
      "-b:a",
      "128k",
      "-map_metadata",
      "-1",
      outputPath,
    ],
    timeoutMs: input.timeoutMs ?? 300_000,
  });

  return outputPath;
}
