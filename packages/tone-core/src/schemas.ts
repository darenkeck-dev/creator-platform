import { z } from "zod";

export const ASSET_ANALYSIS_SCHEMA_VERSION = "asset-analysis/v1";
export const COMBO_ANALYSIS_SCHEMA_VERSION = "combo-analysis/v1";
export const TONE_ANALYSIS_BUNDLE_SCHEMA_VERSION = "tone-analysis-bundle/v1";
export const TONE_TAXONOMY_VERSION = "tone-taxonomy/v2";
export const TONE_TAXONOMY_VERSIONS = ["tone-taxonomy/v1", "tone-taxonomy/v2"] as const;
export const AUDIO_SEMANTIC_TONE_SCHEMA_VERSION = "audio-semantic-tone/v1";
export const VIDEO_SEMANTIC_TONE_SCHEMA_VERSION = "video-semantic-tone/v1";

export const ToneDimensionSchema = z.enum([
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
]);

export const ToneTaxonomyVersionSchema = z.enum(TONE_TAXONOMY_VERSIONS);

export const ToneVectorSchema = z.record(ToneDimensionSchema, z.number().min(-1).max(1));

export const ToneWordsSchema = z.object({
  summary: z.string().min(1),
  primary: z.array(z.string().min(1)),
  secondary: z.array(z.string().min(1)),
  avoid: z.array(z.string().min(1)),
});

export const StructuredToneDescriptorSchema = z.object({
  descriptor: z.string().min(1),
  dimension: z.string().min(1).optional(),
  strength: z.enum(["none", "weak", "medium", "strong", "extreme"]).optional(),
  strengthLabel: z.enum(["none", "weak", "medium", "strong", "extreme"]).optional(),
  strengthValue: z.number().min(0).max(1).optional(),
  evidence: z.string().min(1).optional(),
  rationale: z.string().min(1).optional(),
  mappedDimension: z.string().min(1).optional(),
  modelDimension: z.string().min(1).optional(),
});

export const TonePayloadSchema = z.object({
  value: ToneVectorSchema,
  words: ToneWordsSchema,
  contributors: z.array(z.string().min(1)),
  taxonomyVersion: ToneTaxonomyVersionSchema,
});

export const ModelRunSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  license: z.string().min(1),
});

export const AssetAnalysisModelRunSchema = z.object({
  kind: z.enum(["tone", "embedding", "semantic"]),
  model: ModelRunSchema,
  parameters: z.record(z.unknown()).optional(),
  tone: ToneVectorSchema.optional(),
  toneWords: ToneWordsSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
  rawScores: z.record(z.number()).optional(),
});

export const AssetAnalysisSchema = z.object({
  schemaVersion: z.literal(ASSET_ANALYSIS_SCHEMA_VERSION),
  assetId: z.string().min(1),
  assetType: z.enum(["audio", "video"]),
  source: z.object({
    kind: z.literal("file"),
    path: z.string().min(1),
  }),
  toneTaxonomyVersion: ToneTaxonomyVersionSchema,
  tone: TonePayloadSchema.optional(),
  modelRuns: z.array(AssetAnalysisModelRunSchema),
  createdAt: z.string().datetime(),
});

export const AudioSemanticToneSchema = z.object({
  schemaVersion: z.literal(AUDIO_SEMANTIC_TONE_SCHEMA_VERSION),
  caption: z.string().optional(),
  audioDescription: z.string().optional(),
  semanticSummary: z.string().optional(),
  mood: z.string().optional(),
  instrumentation: z.array(z.string()).default([]),
  vocals: z.string().optional(),
  audibleEvidence: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  descriptorScores: z.array(StructuredToneDescriptorSchema),
  rationale: z.string().optional(),
});

export const VideoSemanticToneSchema = z.object({
  schemaVersion: z.literal(VIDEO_SEMANTIC_TONE_SCHEMA_VERSION),
  caption: z.string().optional(),
  sceneDescription: z.string().optional(),
  semanticSummary: z.string().optional(),
  mood: z.string().optional(),
  setting: z.string().optional(),
  subjects: z.array(z.string()).default([]),
  visualEvidence: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  descriptorScores: z.array(StructuredToneDescriptorSchema),
  rationale: z.string().optional(),
});

export const ComboFeaturesSchema = z.object({
  audioTone: ToneVectorSchema,
  videoTone: ToneVectorSchema,
  deltaTone: ToneVectorSchema,
  absDeltaTone: ToneVectorSchema,
  interactionTone: ToneVectorSchema,
  congruence: z.number(),
  contrast: z.number(),
  intensity: z.number(),
  strongestMatches: z.array(z.string()),
  strongestContrasts: z.array(z.string()),
});

export const ComboAnalysisSchema = z.object({
  schemaVersion: z.literal(COMBO_ANALYSIS_SCHEMA_VERSION),
  comboId: z.string().min(1),
  audioAssetId: z.string().min(1),
  videoAssetId: z.string().min(1),
  toneTaxonomyVersion: ToneTaxonomyVersionSchema,
  audioTitle: z.string().optional(),
  videoTitle: z.string().optional(),
  features: ComboFeaturesSchema,
  nearestNeighborVector: z.array(z.number()),
  vectorLayout: z.record(z.unknown()),
  sourceAnalyses: z.record(z.unknown()).optional(),
  createdAt: z.string().datetime(),
});

export type ToneDimension = z.infer<typeof ToneDimensionSchema>;
export type ToneTaxonomyVersion = z.infer<typeof ToneTaxonomyVersionSchema>;
export type ToneVector = z.infer<typeof ToneVectorSchema>;
export type ToneWords = z.infer<typeof ToneWordsSchema>;
export type StructuredToneDescriptor = z.infer<typeof StructuredToneDescriptorSchema>;
export type AssetAnalysis = z.infer<typeof AssetAnalysisSchema>;
export type AudioSemanticTone = z.infer<typeof AudioSemanticToneSchema>;
export type VideoSemanticTone = z.infer<typeof VideoSemanticToneSchema>;
export type ComboFeatures = z.infer<typeof ComboFeaturesSchema>;
export type ComboAnalysis = z.infer<typeof ComboAnalysisSchema>;
