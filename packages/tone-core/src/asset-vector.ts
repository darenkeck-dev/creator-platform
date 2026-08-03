import { createHash } from "node:crypto";

import { z } from "zod";

import { TONE_TAXONOMY_VERSION, ToneVectorSchema, type ToneVector } from "./schemas.js";

export const ASSET_TONE_VECTOR_SCHEMA_VERSION = "asset-tone-vector/v1";
export const ASSET_TONE_VECTOR_ADJUSTMENT_ALGORITHM = "model-prior-mean/v1";
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

export const AssetToneVectorRecordSchema = z
  .object({
    assetId: z.string().min(1),
    assetType: z.enum(["audio", "video"]),
    effectiveTone: AssetToneVectorValuesSchema,
    vectorSchemaVersion: z.literal(ASSET_TONE_VECTOR_SCHEMA_VERSION),
    taxonomyVersion: z.literal(TONE_TAXONOMY_VERSION),
    adjustmentAlgorithm: z.literal(ASSET_TONE_VECTOR_ADJUSTMENT_ALGORITHM),
    visibility: z.enum(["public", "private"]),
    assetStatus: z.enum(["draft", "uploaded", "processing", "ready", "error"]),
    toneStatus: z.enum(["not_started", "queued", "processing", "ready", "error", "skipped"]),
    updatedAt: z.string().datetime(),
  })
  .strict();

export type AssetToneVectorValues = z.infer<typeof AssetToneVectorValuesSchema>;
export type AssetToneVectorRecord = z.infer<typeof AssetToneVectorRecordSchema>;
export type BuildAssetToneVectorRecordInput = Omit<
  AssetToneVectorRecord,
  "effectiveTone" | "vectorSchemaVersion" | "taxonomyVersion" | "adjustmentAlgorithm"
> & {
  modelScores: Partial<ToneVector>;
  adjustedScores?: Partial<ToneVector>;
};
export type AssetToneVectorSourceFingerprintInput = {
  id: string;
  type: string;
  status: string;
  visibility: string;
  toneAnalysis?: {
    status: string;
    toneTaxonomyVersion?: string;
    scores?: Partial<ToneVector>;
    adjustedScores?: Partial<ToneVector>;
  };
};

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

export function assetToneVectorSourceFingerprint(
  input: AssetToneVectorSourceFingerprintInput
): string {
  const tone = input.toneAnalysis;
  const canonicalSource = [
    input.id,
    input.type,
    input.status,
    input.visibility,
    tone?.status ?? null,
    tone?.toneTaxonomyVersion ?? null,
    ...ASSET_TONE_VECTOR_DIMENSIONS.map((dimension) => tone?.scores?.[dimension] ?? null),
    ...ASSET_TONE_VECTOR_DIMENSIONS.map((dimension) => tone?.adjustedScores?.[dimension] ?? null),
  ];

  return createHash("sha256").update(JSON.stringify(canonicalSource)).digest("hex");
}

export function buildAssetToneVectorRecord({
  modelScores,
  adjustedScores,
  ...metadata
}: BuildAssetToneVectorRecordInput): AssetToneVectorRecord {
  return AssetToneVectorRecordSchema.parse({
    ...metadata,
    effectiveTone: effectiveAssetToneVectorValues(modelScores, adjustedScores),
    vectorSchemaVersion: ASSET_TONE_VECTOR_SCHEMA_VERSION,
    taxonomyVersion: TONE_TAXONOMY_VERSION,
    adjustmentAlgorithm: ASSET_TONE_VECTOR_ADJUSTMENT_ALGORITHM,
  });
}
