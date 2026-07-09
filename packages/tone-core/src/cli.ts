import { writeFile } from "node:fs/promises";
import { analyzeAudioFile, analyzeVideoFile } from "./openai.js";

async function main(argv: string[]): Promise<number> {
  const [command, mediaType, inputPath, ...rest] = argv;
  if (command !== "analyze" || (mediaType !== "audio" && mediaType !== "video") || !inputPath) {
    usage();
    return 2;
  }

  const options = parseOptions(rest);
  const assetId = options["asset-id"] ?? `${mediaType}-1`;
  const out = options.out;
  if (!out) {
    throw new Error("Missing required --out JSON path");
  }

  const analysis =
    mediaType === "audio"
      ? await analyzeAudioFile({ sourcePath: inputPath, assetId, title: options.title })
      : await analyzeVideoFile({
          sourcePath: inputPath,
          assetId,
          title: options.title,
          ffmpegPath: options["ffmpeg-path"],
        });

  await writeFile(out, `${JSON.stringify(analysis, null, 2)}\n`, "utf-8");
  return 0;
}

function parseOptions(args: string[]): Record<string, string> {
  const options: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
    const key = arg.slice(2);
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    options[key] = value;
    index += 1;
  }
  return options;
}

function usage(): void {
  console.log(
    "Usage: bun packages/tone-core/src/cli.ts analyze <audio|video> <input> --asset-id ID --out JSON"
  );
}

main(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
