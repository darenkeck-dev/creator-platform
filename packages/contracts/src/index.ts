import { z } from "zod";

export const ASSET_TYPES = ["video", "audio", "image"] as const;
export const ASSET_STATUSES = ["draft", "uploaded", "processing", "ready", "error"] as const;
export const PROCESSING_PROFILES = [
  "video-standard-v1",
  "audio-passthrough-v1",
  "image-passthrough-v1",
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

export const AssetTypeSchema = z.enum(ASSET_TYPES);
export const AssetStatusSchema = z.enum(ASSET_STATUSES);
export const AssetTagFacetSchema = z.enum(ASSET_TAG_FACETS);
export const AssetTagWeightSchema = z.enum(ASSET_TAG_WEIGHTS);
export const ProcessingProfileSchema = z.enum(PROCESSING_PROFILES);

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

export const AssetRecordSchema = z.object({
  id: z.string().min(1),
  schemaVersion: z.number().int().min(1),
  ownerEmail: z.string().email(),
  type: AssetTypeSchema,
  title: z.string().min(1),
  description: z.string(),
  status: AssetStatusSchema,
  original: AssetOriginalSchema,
  tags: z.array(AssetTagSchema),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  searchText: z.string().optional(),
  stream: AssetStreamInfoSchema.optional(),
  processingProfile: ProcessingProfileSchema.optional(),
  conversion: AssetConversionInfoSchema.optional(),
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

export const CreateAssetInputSchema = z.object({
  type: AssetTypeSchema,
  title: z.string().min(1),
  description: z.string().default(""),
  tags: z.array(AssetTagSchema).default([]),
  processingProfile: ProcessingProfileSchema.optional(),
  original: z
    .object({
      key: z.string().min(1).optional(),
      size: z.number().nonnegative().optional(),
      contentType: z.string().min(1).optional(),
    })
    .optional(),
});

export const UpdateAssetInputSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    tags: z.array(AssetTagSchema).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided",
  });

export const AssetUploadUrlInputSchema = z.object({
  contentType: z.string().min(1).optional(),
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

export type AssetType = z.infer<typeof AssetTypeSchema>;
export type AssetStatus = z.infer<typeof AssetStatusSchema>;
export type AssetTagFacet = z.infer<typeof AssetTagFacetSchema>;
export type AssetTagWeight = z.infer<typeof AssetTagWeightSchema>;
export type AssetOriginal = z.infer<typeof AssetOriginalSchema>;
export type AssetTag = z.infer<typeof AssetTagSchema>;
export type AssetRendition = z.infer<typeof AssetRenditionSchema>;
export type AssetStreamInfo = z.infer<typeof AssetStreamInfoSchema>;
export type AssetRecord = z.infer<typeof AssetRecordSchema>;
export type AssetDetailResponse = z.infer<typeof AssetDetailResponseSchema>;
export type AssetListResponse = z.infer<typeof AssetListResponseSchema>;
export type AssetIdParam = z.infer<typeof AssetIdParamSchema>;
export type CreateAssetInput = z.infer<typeof CreateAssetInputSchema>;
export type UpdateAssetInput = z.infer<typeof UpdateAssetInputSchema>;
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
