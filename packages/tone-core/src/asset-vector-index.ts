import { z } from "zod";

import {
  AssetToneVectorValuesSchema,
  assetToneVectorValues,
  type AssetToneVectorRecord,
} from "./asset-vector.js";
import type { ToneVector } from "./schemas.js";

export const AssetToneVectorIndexQuerySchema = z
  .object({
    vector: AssetToneVectorValuesSchema,
    assetType: z.enum(["audio", "video"]),
    limit: z.number().int().min(1).max(100),
  })
  .strict();

export type AssetToneVectorIndexQuery = z.infer<typeof AssetToneVectorIndexQuerySchema>;

export type AssetToneVectorMatch = {
  record: AssetToneVectorRecord;
  distance: number;
};

export type AssetToneVectorQueryOptions = {
  signal?: AbortSignal;
};

export interface AssetToneVectorIndex {
  upsert(record: AssetToneVectorRecord): Promise<void>;
  delete(assetId: string): Promise<void>;
  queryNearest(
    query: AssetToneVectorIndexQuery,
    options?: AssetToneVectorQueryOptions
  ): Promise<AssetToneVectorMatch[]>;
}

export type AssetToneVectorQueryInput = {
  tone: ToneVector;
  assetType: "audio" | "video";
  limit: number;
};

export class AssetToneVectorQueryService {
  constructor(private readonly index: AssetToneVectorIndex) {}

  queryNearest(input: AssetToneVectorQueryInput): Promise<AssetToneVectorMatch[]> {
    return this.index.queryNearest(
      AssetToneVectorIndexQuerySchema.parse({
        vector: assetToneVectorValues(input.tone),
        assetType: input.assetType,
        limit: input.limit,
      })
    );
  }
}
