import { supportedDescriptors } from "./taxonomy.js";

export function audioSemanticPrompt(): string {
  return [
    "Analyze the attached audio for semantic content and tonal descriptors.",
    "Return concise natural-language observations only. Do not invent lyrics or sources.",
    "Focus on audible mood, instrumentation, vocals, dynamics, and evidence.",
  ].join("\n");
}

export function audioStructurePrompt(audioAnalysis: string): string {
  return [
    "Convert this audio analysis into strict JSON for schema audio-semantic-tone/v1.",
    `Use only these descriptor words: ${supportedDescriptors().join(", ")}.`,
    "descriptorScores must include the strongest supported descriptors with strengthValue from 0 to 1.",
    "JSON keys: schemaVersion, caption, audioDescription, semanticSummary, mood, instrumentation, vocals, audibleEvidence, tags, descriptorScores, rationale.",
    "Each descriptorScores item: descriptor, dimension, strengthLabel, strengthValue, evidence.",
    audioAnalysis,
  ].join("\n\n");
}

export function videoSemanticPrompt(): string {
  return [
    "Analyze these sampled video frames for visual semantics and tonal descriptors.",
    `Use only these descriptor words: ${supportedDescriptors().join(", ")}.`,
    "Return strict JSON for schema video-semantic-tone/v1.",
    "JSON keys: schemaVersion, caption, sceneDescription, semanticSummary, mood, setting, subjects, visualEvidence, tags, descriptorScores, rationale.",
    "Each descriptorScores item: descriptor, dimension, strengthLabel, strengthValue, evidence.",
    "Do not rate quality or meaning. Describe visual tone only.",
  ].join("\n");
}

export function jsonSchemaResponseFormat(
  name: string,
  schema: Record<string, unknown>
): Record<string, unknown> {
  return {
    type: "json_schema",
    json_schema: {
      name,
      schema,
    },
  };
}

export function semanticToneJsonSchema(schemaVersion: string): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      schemaVersion: { type: "string", enum: [schemaVersion] },
      caption: { type: "string" },
      audioDescription: { type: "string" },
      sceneDescription: { type: "string" },
      semanticSummary: { type: "string" },
      mood: { type: "string" },
      setting: { type: "string" },
      instrumentation: { type: "array", items: { type: "string" } },
      vocals: { type: "string" },
      subjects: { type: "array", items: { type: "string" } },
      audibleEvidence: { type: "array", items: { type: "string" } },
      visualEvidence: { type: "array", items: { type: "string" } },
      tags: { type: "array", items: { type: "string" } },
      descriptorScores: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            descriptor: { type: "string", enum: supportedDescriptors() },
            dimension: { type: "string" },
            strengthLabel: {
              type: "string",
              enum: ["none", "weak", "medium", "strong", "extreme"],
            },
            strengthValue: { type: "number", minimum: 0, maximum: 1 },
            evidence: { type: "string" },
          },
          required: ["descriptor", "dimension", "strengthLabel", "strengthValue", "evidence"],
        },
      },
      rationale: { type: "string" },
    },
    required: ["schemaVersion", "semanticSummary", "descriptorScores", "rationale"],
  };
}
