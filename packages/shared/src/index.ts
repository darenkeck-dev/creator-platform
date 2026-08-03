export const ASSET_TYPES = ["video", "audio", "image"] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_STATUSES = ["draft", "uploaded", "processing", "ready", "error"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const PROCESSING_PROFILES = [
  "video-standard-v1",
  "audio-passthrough-v1",
  "image-passthrough-v1",
] as const;
export type ProcessingProfile = (typeof PROCESSING_PROFILES)[number];

export type AssetOriginal = {
  bucket: string;
  key: string;
  size: number;
  contentType: string;
};

export type AssetTag = {
  facet?: string;
  value: string;
  weight?: "weak" | "moderate" | "strong";
  source?: "user" | "system";
};

export type AssetRendition = {
  type: "hls" | "audio" | "image";
  label: string;
  width?: number;
  height?: number;
  bitrateKbps?: number;
};

export type AssetStreamInfo = {
  hlsMasterUrl?: string;
  posterUrl?: string;
  renditions?: AssetRendition[];
};

export type AssetConversionStatus =
  | "not_started"
  | "queued"
  | "processing"
  | "ready"
  | "error"
  | "passthrough_ready";

export type AssetConversionInfo = {
  status: AssetConversionStatus;
  profile: ProcessingProfile;
  jobId?: string;
  updatedAt: string;
  completedAt?: string;
  errorMessage?: string;
};

export type AssetRecord = {
  id: string;
  schemaVersion: number;
  ownerEmail: string;
  type: AssetType;
  title: string;
  description: string;
  status: AssetStatus;
  original: AssetOriginal;
  tags: AssetTag[];
  createdAt: string;
  updatedAt: string;
  searchText?: string;
  stream?: AssetStreamInfo;
  processingProfile?: ProcessingProfile;
  conversion?: AssetConversionInfo;
};

export type AssetDetailResponse = {
  asset: AssetRecord;
};

export * from "./combo-playback";
export * from "./combo-player-types";
export * from "./combo-player";
export * from "./combo-tone-review-player";
export * from "./tone-word-picker";
export * from "./browser-env";
