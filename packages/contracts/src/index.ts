import { z } from "zod";

export const ASSET_TYPES = ["video", "audio", "image", "folder"] as const;
export const ASSET_STATUSES = ["draft", "uploaded", "processing", "ready", "error"] as const;
export const ASSET_ORIGINS = ["uploaded", "generated", "derived", "manual"] as const;
export const PROCESSING_PROFILES = [
  "video-standard-v1",
  "audio-passthrough-v1",
  "audio-transcode-hls-v1",
  "image-passthrough-v1",
  "folder-meta-v1",
] as const;
export const ASSET_SCHEMA_VERSION = 1;
export const ASSET_TAG_FACETS = [
  "mood",
  "location",
  "collection",
  "campaign",
  "subject",
  "genre",
] as const;
export const ASSET_TAG_WEIGHTS = ["weak", "moderate", "strong"] as const;
export const ASSET_VISIBILITIES = ["private", "public"] as const;
export const COMBO_VOTE_VALUES = ["up", "down", "none"] as const;
export const ASSET_TONE_ANALYSIS_STATUSES = [
  "not_started",
  "queued",
  "processing",
  "ready",
  "error",
  "skipped",
] as const;
export const ASSET_TONE_ANALYSIS_PROFILES = ["openai-primary-v1"] as const;
export const ASSET_TONE_TAXONOMY_VERSIONS = ["tone-taxonomy/v1", "tone-taxonomy/v2"] as const;
export const ASSET_AUDIT_LOG_CATEGORIES = [
  "upload",
  "media_conversion",
  "audio_conversion",
  "tone_analysis",
  "asset_metadata",
] as const;
export const ASSET_AUDIT_LOG_LEVELS = ["info", "warn", "error"] as const;

export const AssetTypeSchema = z.enum(ASSET_TYPES);
export const AssetStatusSchema = z.enum(ASSET_STATUSES);
export const AssetOriginSchema = z.enum(ASSET_ORIGINS);
export const AssetTagFacetSchema = z.enum(ASSET_TAG_FACETS);
export const AssetTagWeightSchema = z.enum(ASSET_TAG_WEIGHTS);
export const AssetVisibilitySchema = z.enum(ASSET_VISIBILITIES);
export const ProcessingProfileSchema = z.enum(PROCESSING_PROFILES);
export const ProcessingProfileMetadataSchema = z.object({
  id: ProcessingProfileSchema,
  label: z.string().min(1),
  supportedTypes: z.array(AssetTypeSchema),
  mode: z.enum(["mediaconvert", "passthrough"]),
});
export const PROCESSING_PROFILE_METADATA = [
  {
    id: "video-standard-v1",
    label: "Video standard",
    supportedTypes: ["video"],
    mode: "mediaconvert",
  },
  {
    id: "audio-passthrough-v1",
    label: "Audio passthrough",
    supportedTypes: ["audio"],
    mode: "passthrough",
  },
  {
    id: "audio-transcode-hls-v1",
    label: "Audio HLS",
    supportedTypes: ["audio"],
    mode: "mediaconvert",
  },
  {
    id: "image-passthrough-v1",
    label: "Image passthrough",
    supportedTypes: ["image"],
    mode: "passthrough",
  },
  {
    id: "folder-meta-v1",
    label: "Folder metadata",
    supportedTypes: ["folder"],
    mode: "passthrough",
  },
] as const;
export const ComboVoteValueSchema = z.enum(COMBO_VOTE_VALUES);
export const AssetToneAnalysisStatusSchema = z.enum(ASSET_TONE_ANALYSIS_STATUSES);
export const AssetToneAnalysisProfileSchema = z.enum(ASSET_TONE_ANALYSIS_PROFILES);
export const AssetToneTaxonomyVersionSchema = z.enum(ASSET_TONE_TAXONOMY_VERSIONS);
export const AssetAuditLogCategorySchema = z.enum(ASSET_AUDIT_LOG_CATEGORIES);
export const AssetAuditLogLevelSchema = z.enum(ASSET_AUDIT_LOG_LEVELS);

export const AssetOriginalSchema = z.object({
  bucket: z.string().min(1),
  key: z.string().min(1),
  size: z.number().nonnegative(),
  contentType: z.string().min(1),
});

export const AssetTagSchema = z.object({
  facet: AssetTagFacetSchema.optional(),
  value: z.string().min(1),
  weight: AssetTagWeightSchema.optional(),
  source: z.enum(["user", "system"]).optional(),
});

export const AssetRenditionSchema = z.object({
  type: z.enum(["hls", "audio", "image"]),
  label: z.string().min(1),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  bitrateKbps: z.number().int().positive().optional(),
});

export const AssetStreamInfoSchema = z.object({
  hlsMasterUrl: z.string().url().optional(),
  posterUrl: z.string().url().optional(),
  renditions: z.array(AssetRenditionSchema).optional(),
});

export const AssetConversionStatusSchema = z.enum([
  "not_started",
  "queued",
  "processing",
  "ready",
  "error",
  "passthrough_ready",
]);

export const AssetConversionInfoSchema = z.object({
  status: AssetConversionStatusSchema,
  profile: ProcessingProfileSchema,
  jobId: z.string().min(1).optional(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  errorMessage: z.string().min(1).optional(),
});

export const AssetGenerationInfoSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  workflowId: z.string().min(1),
  promptHash: z.string().min(1),
  seed: z.union([z.number().int(), z.string().min(1)]).optional(),
  createdBy: z.string().email(),
});

export const AssetToneAnalysisModelRunSummarySchema = z.object({
  kind: z.string().min(1),
  modelName: z.string().min(1),
  modelVersion: z.string().min(1).optional(),
});

export const AssetToneAnalysisScoresSchema = z.object({
  valence: z.number().min(-1).max(1).optional(),
  arousal: z.number().min(-1).max(1).optional(),
  dominance: z.number().min(-1).max(1).optional(),
  warmth: z.number().min(-1).max(1).optional(),
  tension: z.number().min(-1).max(1).optional(),
  intimacy: z.number().min(-1).max(1).optional(),
  instability: z.number().min(-1).max(1).optional(),
  nostalgia: z.number().min(-1).max(1).optional(),
  beauty: z.number().min(-1).max(1).optional(),
  menace: z.number().min(-1).max(1).optional(),
});

export const AssetToneScoreAdjustmentDimensionSchema = z.object({
  curatorScoreSum: z.number(),
  curatorReviewCount: z.number().int().min(0),
});

export const AssetToneScoreAdjustmentSchema = z.object({
  schemaVersion: z.literal("tone-score-adjustment/v1"),
  algorithm: z.literal("model-prior-mean/v1"),
  modelWeight: z.literal(1),
  curatorReviewCount: z.number().int().min(1),
  dimensions: z.object({
    valence: AssetToneScoreAdjustmentDimensionSchema.optional(),
    arousal: AssetToneScoreAdjustmentDimensionSchema.optional(),
    dominance: AssetToneScoreAdjustmentDimensionSchema.optional(),
    warmth: AssetToneScoreAdjustmentDimensionSchema.optional(),
    tension: AssetToneScoreAdjustmentDimensionSchema.optional(),
    intimacy: AssetToneScoreAdjustmentDimensionSchema.optional(),
    instability: AssetToneScoreAdjustmentDimensionSchema.optional(),
    nostalgia: AssetToneScoreAdjustmentDimensionSchema.optional(),
    beauty: AssetToneScoreAdjustmentDimensionSchema.optional(),
    menace: AssetToneScoreAdjustmentDimensionSchema.optional(),
  }),
  computedAt: z.string().datetime(),
  latestReviewAt: z.string().datetime(),
});

export const AssetToneAnalysisInfoSchema = z.object({
  status: AssetToneAnalysisStatusSchema,
  profile: AssetToneAnalysisProfileSchema,
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  errorMessage: z.string().min(1).optional(),
  analysisSchemaVersion: z.literal("asset-analysis/v1").optional(),
  bundleSchemaVersion: z.literal("tone-analysis-bundle/v1").optional(),
  toneTaxonomyVersion: AssetToneTaxonomyVersionSchema.optional(),
  analysisBucket: z.string().min(1).optional(),
  analysisKey: z.string().min(1).optional(),
  bundleBucket: z.string().min(1).optional(),
  bundleKey: z.string().min(1).optional(),
  modelRuns: z.array(AssetToneAnalysisModelRunSummarySchema).optional(),
  summary: z.string().min(1).optional(),
  primaryWords: z.array(z.string().min(1)).optional(),
  secondaryWords: z.array(z.string().min(1)).optional(),
  avoidWords: z.array(z.string().min(1)).optional(),
  scores: AssetToneAnalysisScoresSchema.optional(),
  adjustedScores: AssetToneAnalysisScoresSchema.optional(),
  scoreAdjustment: AssetToneScoreAdjustmentSchema.optional(),
  semanticSummary: z.string().min(1).optional(),
  caption: z.string().min(1).optional(),
  mood: z.string().min(1).optional(),
});

export const AssetVectorSyncStateSchema = z
  .object({
    schemaVersion: z.literal("asset-vector-sync/v1"),
    status: z.enum(["indexed", "deleted"]),
    vectorSchemaVersion: z.literal("asset-tone-vector/v1"),
    sourceFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    sourceUpdatedAt: z.string().datetime(),
    syncedAt: z.string().datetime(),
  })
  .strict();

export const AssetAuditLogEntrySchema = z.object({
  id: z.string().min(1),
  at: z.string().datetime(),
  category: AssetAuditLogCategorySchema,
  level: AssetAuditLogLevelSchema,
  message: z.string().min(1).max(300),
  source: z.string().min(1).max(80),
  code: z.string().min(1).max(80).optional(),
  details: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export const AssetRecordSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.number().int().min(1),
  ownerEmail: z.string().email(),
  type: AssetTypeSchema,
  title: z.string().min(1),
  description: z.string(),
  status: AssetStatusSchema,
  visibility: AssetVisibilitySchema.default("private"),
  original: AssetOriginalSchema,
  tags: z.array(AssetTagSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  containerId: z.string().min(1).optional(),
  parentId: z.string().min(1).optional(),
  rootId: z.string().min(1).optional(),
  depth: z.number().int().min(0).optional(),
  sourceAssetIds: z.array(z.string().min(1)).optional(),
  origin: AssetOriginSchema.optional(),
  generation: AssetGenerationInfoSchema.optional(),
  searchText: z.string().optional(),
  stream: AssetStreamInfoSchema.optional(),
  processingProfile: ProcessingProfileSchema.optional(),
  conversion: AssetConversionInfoSchema.optional(),
  toneAnalysis: AssetToneAnalysisInfoSchema.optional(),
  vectorSync: AssetVectorSyncStateSchema.optional(),
  auditLog: z.array(AssetAuditLogEntrySchema).max(100).optional(),
});

export const AssetDetailResponseSchema = z.object({
  asset: AssetRecordSchema,
});

export const AssetListResponseSchema = z.object({
  assets: z.array(AssetRecordSchema),
});

export const AssetIdParamSchema = z.object({
  id: z.string().min(1),
});

export const CreateAssetInputSchema = z
  .object({
    type: AssetTypeSchema,
    title: z.string().min(1),
    description: z.string().default(""),
    tags: z.array(AssetTagSchema).default([]),
    visibility: AssetVisibilitySchema.default("private"),
    containerId: z.string().min(1).optional(),
    parentId: z.string().min(1).optional(),
    sourceAssetIds: z.array(z.string().min(1)).max(20).optional(),
    origin: AssetOriginSchema.optional(),
    generation: AssetGenerationInfoSchema.optional(),
    processingProfile: ProcessingProfileSchema.optional(),
    original: z
      .object({
        key: z.string().min(1).optional(),
        size: z.number().nonnegative().optional(),
        contentType: z.string().min(1).optional(),
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    const origin = value.origin ?? (value.type === "folder" ? "manual" : "uploaded");

    if (origin === "generated" && !value.generation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["generation"],
        message: "generation metadata is required when origin is generated",
      });
    }

    if (origin !== "generated" && value.generation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["generation"],
        message: "generation metadata is only allowed when origin is generated",
      });
    }

    if (origin === "derived" && (!value.sourceAssetIds || value.sourceAssetIds.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceAssetIds"],
        message: "sourceAssetIds are required when origin is derived",
      });
    }

    if (value.type === "folder" && origin !== "manual") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["origin"],
        message: "folder assets must use manual origin",
      });
    }
  });

export const UpdateAssetInputSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    tags: z.array(AssetTagSchema).optional(),
    visibility: AssetVisibilitySchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const VideoUploadMetadataSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const AssetUploadUrlInputSchema = z.object({
  contentType: z.string().min(1).optional(),
  videoMetadata: VideoUploadMetadataSchema.optional(),
});

export const AssetUploadUrlResponseSchema = z.object({
  uploadUrl: z.string().url(),
  key: z.string().min(1),
  expiresIn: z.number().int().positive(),
  asset: AssetRecordSchema,
});

export const AssetPlaybackUrlResponseSchema = z.object({
  playbackUrl: z.string().url(),
  contentType: z.string().min(1),
  expiresIn: z.number().int().positive(),
  id: z.string().min(1),
});

export const MultipartInitInputSchema = z.object({
  contentType: z.string().min(1).optional(),
  videoMetadata: VideoUploadMetadataSchema.optional(),
});

export const MultipartInitResponseSchema = z.object({
  uploadId: z.string().min(1),
  key: z.string().min(1),
  partSize: z.number().int().positive(),
  expiresIn: z.number().int().positive(),
  asset: AssetRecordSchema,
});

export const MultipartSignInputSchema = z.object({
  uploadId: z.string().min(1),
  partNumber: z.number().int().min(1).max(10000),
});

export const MultipartSignResponseSchema = z.object({
  uploadId: z.string().min(1),
  partNumber: z.number().int().min(1).max(10000),
  uploadUrl: z.string().url(),
  expiresIn: z.number().int().positive(),
});

export const MultipartCompleteInputSchema = z.object({
  uploadId: z.string().min(1),
  parts: z
    .array(
      z.object({
        partNumber: z.number().int().min(1).max(10000),
        etag: z.string().min(1),
      })
    )
    .min(1),
});

export const MultipartAbortInputSchema = z.object({
  uploadId: z.string().min(1),
});

export const MultipartAbortResponseSchema = z.object({
  aborted: z.literal(true),
  uploadId: z.string().min(1),
  id: z.string().min(1),
});

export const AssetDeleteResponseSchema = z.object({
  id: z.string().min(1),
  deleted: z.literal(true),
});

export const JobTypeSchema = z.enum(["delete_assets", "reprocess_tone", "reprocess_conversion"]);
export const JobStatusSchema = z.enum([
  "queued",
  "running",
  "completed",
  "completed_with_errors",
  "failed",
  "cancelled",
]);

export const JobTargetSchema = z.object({
  assetIds: z.array(z.string().min(1)).min(1).max(100),
  includeDescendants: z.boolean().default(true),
});

export const JobOptionsSchema = z.object({
  processingProfile: ProcessingProfileSchema.optional(),
});

export const JobAssetSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: AssetTypeSchema,
  containerId: z.string().min(1).optional(),
  path: z.string().min(1),
  actionStatus: z.enum(["processable", "container", "skipped"]).default("processable"),
  skipReason: z.string().min(1).optional(),
});

export const JobPreviewSummarySchema = z.object({
  totalItems: z.number().int().nonnegative(),
  folders: z.number().int().nonnegative(),
  audio: z.number().int().nonnegative(),
  video: z.number().int().nonnegative(),
  images: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative().default(0),
  processableItems: z.number().int().nonnegative().optional(),
  skippedItems: z.number().int().nonnegative().optional(),
});

export const JobPreviewSchema = z.object({
  type: JobTypeSchema,
  target: JobTargetSchema,
  options: JobOptionsSchema.default({}),
  summary: JobPreviewSummarySchema,
  roots: z.array(JobAssetSummarySchema),
  items: z.array(JobAssetSummarySchema),
  confirmationToken: z.string().min(1),
  truncated: z.boolean().default(false),
});

export const JobPreviewInputSchema = z.object({
  type: JobTypeSchema,
  target: JobTargetSchema,
  options: JobOptionsSchema.default({}),
});

export const CreateJobInputSchema = JobPreviewInputSchema.extend({
  confirmationToken: z.string().min(1),
});

export const JobFailureSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).optional(),
  message: z.string().min(1),
});

export const JobRecordSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.number().int().min(1),
  ownerEmail: z.string().email(),
  type: JobTypeSchema,
  status: JobStatusSchema,
  target: JobTargetSchema,
  options: JobOptionsSchema.default({}),
  preview: JobPreviewSchema.optional(),
  totalItems: z.number().int().nonnegative(),
  completedItems: z.number().int().nonnegative(),
  failedItems: z.number().int().nonnegative(),
  skippedItems: z.number().int().nonnegative(),
  currentItemId: z.string().min(1).optional(),
  currentItemTitle: z.string().min(1).optional(),
  message: z.string().min(1),
  failures: z.array(JobFailureSchema).max(50).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  finishedAt: z.string().datetime().optional(),
});

export const JobPreviewResponseSchema = z.object({
  preview: JobPreviewSchema,
});

export const JobDetailResponseSchema = z.object({
  job: JobRecordSchema,
});

export const CreateJobResponseSchema = JobDetailResponseSchema;

export const AssetChildrenResponseSchema = z.object({
  parentId: z.string().min(1),
  assets: z.array(AssetRecordSchema),
});

export const AssetLineageResponseSchema = z.object({
  asset: AssetRecordSchema,
  sources: z.array(AssetRecordSchema),
});

export const MoveAssetInputSchema = z
  .object({
    containerId: z.string().min(1).nullable().optional(),
    parentId: z.string().min(1).nullable().optional(),
  })
  .refine((value) => value.containerId !== undefined || value.parentId !== undefined, {
    message: "containerId or parentId must be provided",
  });

export const MoveAssetResponseSchema = z.object({
  asset: AssetRecordSchema,
});

export const ComboPlaybackParamsSchema = z.object({
  videoOffsetMs: z.number().int().min(0).optional(),
  audioOffsetMs: z.number().int().min(0).optional(),
  gainDb: z.number().min(-60).max(24).optional(),
  trimStartMs: z.number().int().min(0).optional(),
  trimEndMs: z.number().int().min(0).optional(),
});

export const ComboRecordSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.number().int().min(1),
  ownerEmail: z.string().email(),
  videoAssetId: z.string().min(1),
  audioAssetId: z.string().min(1),
  pairKey: z.string().min(1).optional(),
  playback: ComboPlaybackParamsSchema.optional(),
  upvotes: z.number().int().min(0),
  downvotes: z.number().int().min(0),
  score: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ComboWithVoteSchema = ComboRecordSchema.extend({
  userVote: ComboVoteValueSchema.default("none"),
});

export const ComboDetailResponseSchema = z.object({
  combo: ComboWithVoteSchema,
});

export const ComboListResponseSchema = z.object({
  combos: z.array(ComboWithVoteSchema),
});

export const CreateComboInputSchema = z.object({
  videoAssetId: z.string().min(1),
  audioAssetId: z.string().min(1),
  playback: ComboPlaybackParamsSchema.optional(),
});

export const ComboVoteInputSchema = z.object({
  action: z.enum(["up", "down", "clear"]),
});

export const ComboVoteByAssetsInputSchema = z.object({
  videoAssetId: z.string().min(1),
  audioAssetId: z.string().min(1),
  action: z.enum(["up", "down", "clear"]),
});

export const ToneReviewTargetTypeSchema = z.enum(["audio", "video", "combo"]);
export const ToneReviewSourceSchema = z.enum(["curator", "anonymous", "authenticated"]);
export const ToneReviewInputSchema = z.object({
  targetType: ToneReviewTargetTypeSchema,
  targetId: z.string().min(1),
  sourceVideoAssetId: z.string().min(1).optional(),
  sourceAudioAssetId: z.string().min(1).optional(),
  reviewSource: ToneReviewSourceSchema.default("curator"),
  reviewerId: z.string().min(1).max(128).optional(),
  taxonomyVersion: AssetToneTaxonomyVersionSchema.optional(),
  keywords: z.array(z.string().trim().min(1).max(40)).max(24).default([]),
  scores: AssetToneAnalysisScoresSchema.optional(),
  modelScoresSnapshot: AssetToneAnalysisScoresSchema.optional(),
  baseScoresSnapshot: AssetToneAnalysisScoresSchema.optional(),
  notes: z.string().max(1000).optional(),
});

export const ToneReviewRecordSchema = ToneReviewInputSchema.extend({
  id: z.string().min(1),
  schemaVersion: z.number().int().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const ToneReviewResponseSchema = z.object({
  review: ToneReviewRecordSchema,
});

export const ToneReviewListQuerySchema = z.object({
  targetType: ToneReviewTargetTypeSchema.optional(),
  targetId: z.string().min(1).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const ToneReviewListResponseSchema = z.object({
  reviews: z.array(ToneReviewRecordSchema),
  nextCursor: z.string().min(1).optional(),
});

export const ComboDeleteResponseSchema = z.object({
  id: z.string().min(1),
  deleted: z.literal(true),
});

export const PublicRandomComboResponseSchema = z.object({
  source: z.enum(["derived", "existing"]),
  selection: z.enum(["primary", "fallback"]),
  comboId: z.string().min(1),
  videoAssetId: z.string().min(1),
  audioAssetId: z.string().min(1),
  videoTitle: z.string().min(1),
  audioTitle: z.string().min(1),
  videoSrc: z.string().url(),
  audioSrc: z.string().url(),
});

const PublicComboSelectionHistorySchema = z
  .object({
    recentComboIds: z.array(z.string().min(1)).max(5).default([]),
    recentAudioAssetIds: z.array(z.string().min(1)).max(3).default([]),
  })
  .strict();

export const PublicComboSelectionRequestSchema = z.discriminatedUnion("mode", [
  z
    .object({
      schemaVersion: z.literal("public-combo-selection-request/v1"),
      mode: z.literal("walk"),
      current: z
        .object({
          audioAssetId: z.string().min(1),
          videoAssetId: z.string().min(1),
        })
        .strict(),
      history: PublicComboSelectionHistorySchema.default({}),
    })
    .strict(),
  z
    .object({
      schemaVersion: z.literal("public-combo-selection-request/v1"),
      mode: z.literal("search"),
      keywords: z.array(z.string().trim().min(1).max(40)).min(1).max(24),
      history: PublicComboSelectionHistorySchema.default({}),
    })
    .strict(),
]);

export const PublicComboSelectionFallbackReasonSchema = z.enum([
  "vector_query_failed",
  "no_walk_candidates",
  "no_search_candidates",
  "selected_candidate_unavailable",
]);
const PublicComboToneDimensionSchema = AssetToneAnalysisScoresSchema.keyof();

const PublicComboSelectionMetadataSchema = z.union([
  z
    .object({
      schemaVersion: z.literal("combo-selection/v1"),
      requestedMode: z.literal("walk"),
      resolvedMode: z.literal("walk"),
      predictorVersion: z.literal("combo-tone-predictor/v0"),
      distance: z.number().finite().nonnegative(),
    })
    .strict(),
  z
    .object({
      schemaVersion: z.literal("combo-selection/v1"),
      requestedMode: z.literal("search"),
      resolvedMode: z.literal("search"),
      predictorVersion: z.literal("combo-tone-predictor/v0"),
      distance: z.number().finite().nonnegative(),
      queryDimensions: z.array(PublicComboToneDimensionSchema).min(1).max(10),
    })
    .strict(),
  z
    .object({
      schemaVersion: z.literal("combo-selection/v1"),
      requestedMode: z.enum(["walk", "search"]),
      resolvedMode: z.literal("random"),
      predictorVersion: z.literal("combo-tone-predictor/v0"),
      fallbackReason: PublicComboSelectionFallbackReasonSchema,
    })
    .strict(),
]);

export const PublicComboSelectionResponseSchema = z
  .object({
    schemaVersion: z.literal("public-combo-selection-response/v1"),
    comboId: z.string().min(1),
    videoAssetId: z.string().min(1),
    audioAssetId: z.string().min(1),
    videoTitle: z.string().min(1),
    audioTitle: z.string().min(1),
    videoSrc: z.string().url(),
    audioSrc: z.string().url(),
    selection: PublicComboSelectionMetadataSchema,
  })
  .strict();

export type AssetType = z.infer<typeof AssetTypeSchema>;
export type AssetStatus = z.infer<typeof AssetStatusSchema>;
export type AssetOrigin = z.infer<typeof AssetOriginSchema>;
export type AssetTagFacet = z.infer<typeof AssetTagFacetSchema>;
export type AssetTagWeight = z.infer<typeof AssetTagWeightSchema>;
export type AssetVisibility = z.infer<typeof AssetVisibilitySchema>;
export type AssetOriginal = z.infer<typeof AssetOriginalSchema>;
export type AssetTag = z.infer<typeof AssetTagSchema>;
export type AssetRendition = z.infer<typeof AssetRenditionSchema>;
export type AssetStreamInfo = z.infer<typeof AssetStreamInfoSchema>;
export type AssetGenerationInfo = z.infer<typeof AssetGenerationInfoSchema>;
export type AssetToneAnalysisStatus = z.infer<typeof AssetToneAnalysisStatusSchema>;
export type AssetToneAnalysisProfile = z.infer<typeof AssetToneAnalysisProfileSchema>;
export type AssetToneAnalysisInfo = z.infer<typeof AssetToneAnalysisInfoSchema>;
export type AssetToneAnalysisScores = z.infer<typeof AssetToneAnalysisScoresSchema>;
export type AssetToneScoreAdjustment = z.infer<typeof AssetToneScoreAdjustmentSchema>;
export type AssetVectorSyncState = z.infer<typeof AssetVectorSyncStateSchema>;
export type AssetRecord = z.infer<typeof AssetRecordSchema>;
export type AssetDetailResponse = z.infer<typeof AssetDetailResponseSchema>;
export type AssetListResponse = z.infer<typeof AssetListResponseSchema>;
export type AssetIdParam = z.infer<typeof AssetIdParamSchema>;
export type CreateAssetInput = z.infer<typeof CreateAssetInputSchema>;
export type UpdateAssetInput = z.infer<typeof UpdateAssetInputSchema>;
export type VideoUploadMetadata = z.infer<typeof VideoUploadMetadataSchema>;
export type AssetUploadUrlInput = z.infer<typeof AssetUploadUrlInputSchema>;
export type AssetUploadUrlResponse = z.infer<typeof AssetUploadUrlResponseSchema>;
export type AssetPlaybackUrlResponse = z.infer<typeof AssetPlaybackUrlResponseSchema>;
export type MultipartInitInput = z.infer<typeof MultipartInitInputSchema>;
export type MultipartInitResponse = z.infer<typeof MultipartInitResponseSchema>;
export type MultipartSignInput = z.infer<typeof MultipartSignInputSchema>;
export type MultipartSignResponse = z.infer<typeof MultipartSignResponseSchema>;
export type MultipartCompleteInput = z.infer<typeof MultipartCompleteInputSchema>;
export type MultipartAbortInput = z.infer<typeof MultipartAbortInputSchema>;
export type MultipartAbortResponse = z.infer<typeof MultipartAbortResponseSchema>;
export type AssetDeleteResponse = z.infer<typeof AssetDeleteResponseSchema>;
export type ProcessingProfile = z.infer<typeof ProcessingProfileSchema>;
export type ProcessingProfileMetadata = z.infer<typeof ProcessingProfileMetadataSchema>;
export type JobType = z.infer<typeof JobTypeSchema>;
export type JobStatus = z.infer<typeof JobStatusSchema>;
export type JobTarget = z.infer<typeof JobTargetSchema>;
export type JobOptions = z.infer<typeof JobOptionsSchema>;
export type JobAssetSummary = z.infer<typeof JobAssetSummarySchema>;
export type JobPreviewSummary = z.infer<typeof JobPreviewSummarySchema>;
export type JobPreview = z.infer<typeof JobPreviewSchema>;
export type JobPreviewInput = z.infer<typeof JobPreviewInputSchema>;
export type CreateJobInput = z.infer<typeof CreateJobInputSchema>;
export type JobRecord = z.infer<typeof JobRecordSchema>;
export type JobPreviewResponse = z.infer<typeof JobPreviewResponseSchema>;
export type JobDetailResponse = z.infer<typeof JobDetailResponseSchema>;
export type CreateJobResponse = z.infer<typeof CreateJobResponseSchema>;
export type AssetChildrenResponse = z.infer<typeof AssetChildrenResponseSchema>;
export type AssetLineageResponse = z.infer<typeof AssetLineageResponseSchema>;
export type MoveAssetInput = z.infer<typeof MoveAssetInputSchema>;
export type MoveAssetResponse = z.infer<typeof MoveAssetResponseSchema>;
export type ComboVoteValue = z.infer<typeof ComboVoteValueSchema>;
export type ComboPlaybackParams = z.infer<typeof ComboPlaybackParamsSchema>;
export type ComboRecord = z.infer<typeof ComboRecordSchema>;
export type ComboWithVote = z.infer<typeof ComboWithVoteSchema>;
export type ComboDetailResponse = z.infer<typeof ComboDetailResponseSchema>;
export type ComboListResponse = z.infer<typeof ComboListResponseSchema>;
export type CreateComboInput = z.infer<typeof CreateComboInputSchema>;
export type ComboVoteInput = z.infer<typeof ComboVoteInputSchema>;
export type ComboVoteByAssetsInput = z.infer<typeof ComboVoteByAssetsInputSchema>;
export type ToneReviewTargetType = z.infer<typeof ToneReviewTargetTypeSchema>;
export type ToneReviewSource = z.infer<typeof ToneReviewSourceSchema>;
export type ToneReviewInput = z.infer<typeof ToneReviewInputSchema>;
export type ToneReviewRecord = z.infer<typeof ToneReviewRecordSchema>;
export type ToneReviewResponse = z.infer<typeof ToneReviewResponseSchema>;
export type ToneReviewListQuery = z.infer<typeof ToneReviewListQuerySchema>;
export type ToneReviewListResponse = z.infer<typeof ToneReviewListResponseSchema>;
export type ComboDeleteResponse = z.infer<typeof ComboDeleteResponseSchema>;
export type PublicRandomComboResponse = z.infer<typeof PublicRandomComboResponseSchema>;
export type PublicComboSelectionRequest = z.infer<typeof PublicComboSelectionRequestSchema>;
export type PublicComboSelectionFallbackReason = z.infer<
  typeof PublicComboSelectionFallbackReasonSchema
>;
export type PublicComboSelectionResponse = z.infer<typeof PublicComboSelectionResponseSchema>;
