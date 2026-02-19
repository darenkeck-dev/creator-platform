import { z } from "zod";

export const ASSET_TYPES = ["video", "audio", "image"] as const;
export const ASSET_STATUSES = ["draft", "uploaded", "processing", "ready", "error"] as const;

export const AssetTypeSchema = z.enum(ASSET_TYPES);
export const AssetStatusSchema = z.enum(ASSET_STATUSES);

export const AssetOriginalSchema = z.object({
  bucket: z.string().min(1),
  key: z.string().min(1),
  size: z.number().nonnegative(),
  contentType: z.string().min(1),
});

export const AssetTagSchema = z.object({
  facet: z.string().min(1).optional(),
  value: z.string().min(1),
  weight: z.number().optional(),
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

export const AssetRecordSchema = z.object({
  id: z.string().min(1),
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

export type AssetType = z.infer<typeof AssetTypeSchema>;
export type AssetStatus = z.infer<typeof AssetStatusSchema>;
export type AssetOriginal = z.infer<typeof AssetOriginalSchema>;
export type AssetTag = z.infer<typeof AssetTagSchema>;
export type AssetRendition = z.infer<typeof AssetRenditionSchema>;
export type AssetStreamInfo = z.infer<typeof AssetStreamInfoSchema>;
export type AssetRecord = z.infer<typeof AssetRecordSchema>;
export type AssetDetailResponse = z.infer<typeof AssetDetailResponseSchema>;
export type AssetListResponse = z.infer<typeof AssetListResponseSchema>;
export type AssetIdParam = z.infer<typeof AssetIdParamSchema>;
