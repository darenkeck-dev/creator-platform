import { readFile } from "node:fs/promises";
import { join } from "node:path";
import OpenAI from "openai";
import {
  ASSET_ANALYSIS_SCHEMA_VERSION,
  AUDIO_SEMANTIC_TONE_SCHEMA_VERSION,
  AudioSemanticToneSchema,
  TONE_TAXONOMY_VERSION,
  VIDEO_SEMANTIC_TONE_SCHEMA_VERSION,
  VideoSemanticToneSchema,
  type AssetAnalysis,
  type AudioSemanticTone,
  type VideoSemanticTone,
} from "./schemas.js";
import { extractVideoFrames } from "./frame-extraction.js";
import { normalizeAudioForOpenAI } from "./audio-normalization.js";
import {
  audioSemanticPrompt,
  audioStructurePrompt,
  jsonSchemaResponseFormat,
  semanticToneJsonSchema,
  videoSemanticPrompt,
} from "./openai-prompts.js";
import { structuredDescriptorsToTone, toneToWords } from "./tone-vector.js";

export type AnalyzeAudioFileInput = {
  sourcePath: string;
  assetId: string;
  title?: string;
  apiKey?: string;
  audioModel?: string;
  structureModel?: string;
  ffmpegPath?: string;
  workDir?: string;
  createdAt?: string;
};

export type AnalyzeVideoFileInput = {
  sourcePath: string;
  assetId: string;
  title?: string;
  apiKey?: string;
  model?: string;
  imageDetail?: "low" | "high" | "auto";
  frameRate?: number;
  maxFrames?: number;
  frameWidth?: number;
  ffmpegPath?: string;
  workDir?: string;
  createdAt?: string;
};

export async function analyzeAudioFile(input: AnalyzeAudioFileInput): Promise<AssetAnalysis> {
  const client = new OpenAI({ apiKey: input.apiKey ?? process.env.OPENAI_API_KEY });
  const audioModel = input.audioModel ?? "gpt-audio";
  const structureModel =
    input.structureModel ?? process.env.OPENAI_AUDIO_STRUCTURE_MODEL ?? "gpt-5";
  const normalizedAudioPath = await normalizeAudioForOpenAI({
    inputPath: input.sourcePath,
    outputDir: input.workDir ?? join("/tmp", "tone-core-audio", input.assetId),
    ffmpegPath: input.ffmpegPath,
  });
  const audioAnalysis = await requestAudioDescription(client, normalizedAudioPath, audioModel);
  const structured = await structureAudioAnalysis(client, audioAnalysis, structureModel);
  const tone = structuredDescriptorsToTone(structured.descriptorScores);

  return {
    schemaVersion: ASSET_ANALYSIS_SCHEMA_VERSION,
    assetId: input.assetId,
    assetType: "audio",
    source: { kind: "file", path: input.sourcePath },
    toneTaxonomyVersion: TONE_TAXONOMY_VERSION,
    tone: {
      value: tone,
      words: toneToWords(tone),
      contributors: ["openai/audio-tone-descriptors"],
      taxonomyVersion: TONE_TAXONOMY_VERSION,
    },
    modelRuns: [
      {
        kind: "tone",
        model: {
          name: "openai/audio-tone-descriptors",
          version: "adapter-0.1.0-ts",
          license: "provider-api",
        },
        parameters: {
          openaiModel: audioModel,
          structureModel,
          schemaVersion: AUDIO_SEMANTIC_TONE_SCHEMA_VERSION,
          normalizedAudioFormat: "mp3",
        },
        tone,
        toneWords: toneToWords(tone),
        metadata: {
          ...structured,
          targetStructuredSchema: AUDIO_SEMANTIC_TONE_SCHEMA_VERSION,
        },
        rawScores: tone,
      },
    ],
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export async function analyzeVideoFile(input: AnalyzeVideoFileInput): Promise<AssetAnalysis> {
  const client = new OpenAI({ apiKey: input.apiKey ?? process.env.OPENAI_API_KEY });
  const model = input.model ?? "gpt-5";
  const frames = await extractVideoFrames({
    inputPath: input.sourcePath,
    outputDir: input.workDir ?? join("/tmp", "tone-core-frames", input.assetId),
    ffmpegPath: input.ffmpegPath,
    frameRate: input.frameRate,
    maxFrames: input.maxFrames,
    width: input.frameWidth,
  });
  if (frames.length === 0) {
    throw new Error(`No video frames sampled from ${input.sourcePath}`);
  }

  const structured = await requestVideoAnalysis(client, frames, model, input.imageDetail ?? "low");
  const tone = structuredDescriptorsToTone(structured.descriptorScores);

  return {
    schemaVersion: ASSET_ANALYSIS_SCHEMA_VERSION,
    assetId: input.assetId,
    assetType: "video",
    source: { kind: "file", path: input.sourcePath },
    toneTaxonomyVersion: TONE_TAXONOMY_VERSION,
    tone: {
      value: tone,
      words: toneToWords(tone),
      contributors: ["openai/video-tone-descriptors"],
      taxonomyVersion: TONE_TAXONOMY_VERSION,
    },
    modelRuns: [
      {
        kind: "tone",
        model: {
          name: "openai/video-tone-descriptors",
          version: "adapter-0.1.0-ts",
          license: "provider-api",
        },
        parameters: {
          openaiModel: model,
          frameRate: input.frameRate ?? 1,
          maxFrames: input.maxFrames ?? 12,
          imageDetail: input.imageDetail ?? "low",
          schemaVersion: VIDEO_SEMANTIC_TONE_SCHEMA_VERSION,
        },
        tone,
        toneWords: toneToWords(tone),
        metadata: {
          ...structured,
          frameCount: frames.length,
          targetStructuredSchema: VIDEO_SEMANTIC_TONE_SCHEMA_VERSION,
        },
        rawScores: tone,
      },
    ],
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

async function requestAudioDescription(
  client: OpenAI,
  sourcePath: string,
  model: string
): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    modalities: ["text", "audio"],
    audio: { voice: "alloy", format: "wav" },
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: audioSemanticPrompt() },
          {
            type: "input_audio",
            input_audio: {
              data: await fileToBase64(sourcePath),
              format: "mp3",
            },
          },
        ],
      },
    ],
  } as never);
  const message = response.choices[0]?.message as unknown as {
    content?: string | null;
    audio?: { transcript?: string | null } | null;
  };
  const text = message.content || message.audio?.transcript;
  if (!text) {
    throw new Error("OpenAI returned an empty audio analysis response");
  }
  return text;
}

async function structureAudioAnalysis(
  client: OpenAI,
  audioAnalysis: string,
  model: string
): Promise<AudioSemanticTone> {
  const response = await client.chat.completions.create({
    model,
    messages: [{ role: "user", content: audioStructurePrompt(audioAnalysis) }],
    response_format: jsonSchemaResponseFormat(
      "audio_semantic_tone",
      semanticToneJsonSchema(AUDIO_SEMANTIC_TONE_SCHEMA_VERSION)
    ),
  } as never);
  const content = response.choices[0]?.message.content;
  if (!content) {
    throw new Error("OpenAI returned an empty structured audio response");
  }
  return AudioSemanticToneSchema.parse(JSON.parse(content));
}

async function requestVideoAnalysis(
  client: OpenAI,
  framePaths: string[],
  model: string,
  imageDetail: "low" | "high" | "auto"
): Promise<VideoSemanticTone> {
  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: videoSemanticPrompt() },
          ...(await Promise.all(
            framePaths.map(async (framePath) => ({
              type: "image_url",
              image_url: {
                url: await imageToDataUrl(framePath),
                detail: imageDetail,
              },
            }))
          )),
        ],
      },
    ],
    response_format: jsonSchemaResponseFormat(
      "video_semantic_tone",
      semanticToneJsonSchema(VIDEO_SEMANTIC_TONE_SCHEMA_VERSION)
    ),
  } as never);
  const content = response.choices[0]?.message.content;
  if (!content) {
    throw new Error("OpenAI returned an empty video analysis response");
  }
  return VideoSemanticToneSchema.parse(JSON.parse(content));
}

async function fileToBase64(path: string): Promise<string> {
  return (await readFile(path)).toString("base64");
}

async function imageToDataUrl(path: string): Promise<string> {
  return `data:image/jpeg;base64,${await fileToBase64(path)}`;
}
