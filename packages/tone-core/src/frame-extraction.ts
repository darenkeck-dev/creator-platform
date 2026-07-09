import { spawn } from "node:child_process";
import { mkdir, readdir, rm } from "node:fs/promises";
import { join } from "node:path";

export type ExtractVideoFramesInput = {
  inputPath: string;
  outputDir: string;
  ffmpegPath?: string;
  frameRate?: number;
  maxFrames?: number;
  width?: number;
  timeoutMs?: number;
};

export async function extractVideoFrames(input: ExtractVideoFramesInput): Promise<string[]> {
  const frameRate = input.frameRate ?? 1;
  const maxFrames = input.maxFrames ?? 12;
  const width = input.width ?? 768;
  const ffmpegPath = input.ffmpegPath ?? process.env.FFMPEG_PATH ?? "ffmpeg";
  const outputPattern = join(input.outputDir, "frame-%03d.jpg");

  await rm(input.outputDir, { force: true, recursive: true });
  await mkdir(input.outputDir, { recursive: true });

  await runFfmpeg({
    ffmpegPath,
    args: [
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      input.inputPath,
      "-vf",
      `fps=${frameRate},scale=${width}:-1`,
      "-frames:v",
      String(maxFrames),
      "-q:v",
      "3",
      outputPattern,
    ],
    timeoutMs: input.timeoutMs ?? 60_000,
  });

  const files = await readdir(input.outputDir);
  return files
    .filter((file) => file.endsWith(".jpg"))
    .sort()
    .map((file) => join(input.outputDir, file));
}

async function runFfmpeg(input: {
  ffmpegPath: string;
  args: string[];
  timeoutMs: number;
}): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(input.ffmpegPath, input.args, { stdio: ["ignore", "ignore", "pipe"] });
    const stderr: Buffer[] = [];
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`ffmpeg timed out after ${input.timeoutMs}ms`));
    }, input.timeoutMs);

    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`ffmpeg exited with ${code}: ${Buffer.concat(stderr).toString("utf-8")}`));
    });
  });
}
