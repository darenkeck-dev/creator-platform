import { z } from "zod";

import { ToneVectorSchema, type ToneVector } from "./schemas.js";

export const ASSET_TONE_VECTOR_SCHEMA_VERSION = "asset-tone-vector/v1";
export const ASSET_TONE_VECTOR_DIMENSIONS = [
  "valence",
  "arousal",
  "dominance",
  "warmth",
  "tension",
  "intimacy",
  "instability",
  "nostalgia",
  "beauty",
  "menace",
] as const;

const ToneValueSchema = z.number().min(-1).max(1);

export const AssetToneVectorValuesSchema = z.tuple([
  ToneValueSchema,
  ToneValueSchema,
  ToneValueSchema,
  ToneValueSchema,
  ToneValueSchema,
  ToneValueSchema,
  ToneValueSchema,
  ToneValueSchema,
  ToneValueSchema,
  ToneValueSchema,
]);

export const AssetToneVectorRecordSchema = z.object({
  assetId: z.string().min(1),
  assetType: z.enum(["audio", "video"]),
  effectiveTone: AssetToneVectorValuesSchema,
  vectorSchemaVersion: z.literal(ASSET_TONE_VECTOR_SCHEMA_VERSION),
  taxonomyVersion: z.literal("tone-taxonomy/v2"),
  adjustmentAlgorithm: z.literal("model-prior-mean/v1"),
  visibility: z.enum(["public", "private"]),
  assetStatus: z.enum(["draft", "uploaded", "processing", "ready", "error"]),
  toneStatus: z.enum(["not_started", "queued", "processing", "ready", "error", "skipped"]),
  updatedAt: z.string().datetime(),
});

export function assetToneVectorValues(tone: ToneVector): AssetToneVectorValues {
  const parsed = ToneVectorSchema.parse(tone);
  return AssetToneVectorValuesSchema.parse(
    ASSET_TONE_VECTOR_DIMENSIONS.map((dimension) => parsed[dimension])
  );
}

export function effectiveAssetToneVectorValues(
  modelScores: Partial<ToneVector>,
  adjustedScores?: Partial<ToneVector>
): AssetToneVectorValues {
  return assetToneVectorValues({ ...modelScores, ...adjustedScores });
}

export type AssetToneVectorValues = z.infer<typeof AssetToneVectorValuesSchema>;
export type AssetToneVectorRecord = z.infer<typeof AssetToneVectorRecordSchema>;
