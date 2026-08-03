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
    limit: z.number().int().min(1).max(100),
  })
  .strict();

export type AssetToneVectorIndexQuery = z.infer<typeof AssetToneVectorIndexQuerySchema>;

export type AssetToneVectorMatch = {
  record: AssetToneVectorRecord;
  distance: number;
};

export interface AssetToneVectorIndex {
  upsert(record: AssetToneVectorRecord): Promise<void>;
  delete(assetId: string): Promise<void>;
  queryNearest(query: AssetToneVectorIndexQuery): Promise<AssetToneVectorMatch[]>;
}

export type AssetToneVectorQueryInput = {
  tone: ToneVector;
  limit: number;
};

export class AssetToneVectorQueryService {
  constructor(private readonly index: AssetToneVectorIndex) {}

  queryNearest(input: AssetToneVectorQueryInput): Promise<AssetToneVectorMatch[]> {
    return this.index.queryNearest(
      AssetToneVectorIndexQuerySchema.parse({
        vector: assetToneVectorValues(input.tone),
        limit: input.limit,
      })
    );
  }
}
