import {
  DeleteVectorsCommand,
  GetVectorsCommand,
  PutVectorsCommand,
  QueryVectorsCommand,
  S3VectorsClient,
} from "@aws-sdk/client-s3vectors";
import {
  AssetToneVectorRecordSchema,
  type AssetToneVectorIndex,
  type AssetToneVectorRecord,
  type AssetToneVectorQueryOptions,
} from "@media-manager/tone-core";

const VectorIndexMetadataSchema = AssetToneVectorRecordSchema.omit({
  assetId: true,
  effectiveTone: true,
});
type VectorIndexMetadata = Omit<AssetToneVectorRecord, "assetId" | "effectiveTone">;

export type S3VectorsIndexOptions = {
  indexArn: string;
  client?: S3VectorsClient;
  queryTimeoutMs?: number;
};

export class S3VectorsIndex implements AssetToneVectorIndex {
  private readonly client: S3VectorsClient;
  private readonly indexArn: string;
  private readonly queryTimeoutMs: number | undefined;

  constructor({
    indexArn,
    client = new S3VectorsClient({}),
    queryTimeoutMs,
  }: S3VectorsIndexOptions) {
    this.indexArn = indexArn;
    this.client = client;
    this.queryTimeoutMs = queryTimeoutMs;
  }

  async upsert(input: AssetToneVectorRecord): Promise<void> {
    const record = AssetToneVectorRecordSchema.parse(input);

    await this.client.send(
      new PutVectorsCommand({
        indexArn: this.indexArn,
        vectors: [
          {
            key: record.assetId,
            data: { float32: record.effectiveTone },
            metadata: metadataFromRecord(record),
          },
        ],
      })
    );
  }

  async delete(assetId: string): Promise<void> {
    await this.client.send(
      new DeleteVectorsCommand({
        indexArn: this.indexArn,
        keys: [assetId],
      })
    );
  }

  async queryNearest(
    { vector, assetType, limit }: Parameters<AssetToneVectorIndex["queryNearest"]>[0],
    options?: AssetToneVectorQueryOptions
  ) {
    const abortController = this.queryTimeoutMs ? new AbortController() : undefined;
    const abortFromCaller = () => abortController?.abort();
    if (options?.signal?.aborted) {
      abortController?.abort();
    } else {
      options?.signal?.addEventListener("abort", abortFromCaller, { once: true });
    }
    const abortSignal = abortController?.signal ?? options?.signal;
    const timeout = abortController
      ? setTimeout(() => abortController.abort(), this.queryTimeoutMs)
      : undefined;

    try {
      const response = await this.client.send(
        new QueryVectorsCommand({
          indexArn: this.indexArn,
          queryVector: { float32: vector },
          topK: limit,
          filter: { assetType },
          returnDistance: true,
        }),
        { abortSignal }
      );

      const queryVectors = response.vectors ?? [];
      if (queryVectors.length === 0) {
        return [];
      }

      const stored = await this.client.send(
        new GetVectorsCommand({
          indexArn: this.indexArn,
          keys: queryVectors.map((result) => requiredKey(result.key)),
          returnData: true,
          returnMetadata: true,
        }),
        { abortSignal }
      );
      const records = new Map(
        (stored.vectors ?? []).map((result) => {
          const assetId = requiredKey(result.key);
          if (!result.data || !("float32" in result.data) || !result.data.float32) {
            throw new Error(`S3 Vectors record ${assetId} is missing float32 data`);
          }
          const float32 = result.data.float32;
          return [
            assetId,
            AssetToneVectorRecordSchema.parse({
              assetId,
              effectiveTone: float32.map((value, index) =>
                requiredFiniteNumber(value, `vector value ${index} for ${assetId}`)
              ),
              ...VectorIndexMetadataSchema.parse(result.metadata),
            }),
          ];
        })
      );

      return queryVectors.map((result) => {
        const assetId = requiredKey(result.key);
        const distance = requiredFiniteNumber(result.distance, `distance for ${assetId}`);
        const record = records.get(assetId);
        if (!record) {
          throw new Error(`S3 Vectors record ${assetId} was not returned by GetVectors`);
        }

        return {
          record,
          distance,
        };
      });
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
      options?.signal?.removeEventListener("abort", abortFromCaller);
    }
  }
}

function metadataFromRecord(record: AssetToneVectorRecord): VectorIndexMetadata {
  return {
    assetType: record.assetType,
    vectorSchemaVersion: record.vectorSchemaVersion,
    taxonomyVersion: record.taxonomyVersion,
    adjustmentAlgorithm: record.adjustmentAlgorithm,
    visibility: record.visibility,
    assetStatus: record.assetStatus,
    toneStatus: record.toneStatus,
    updatedAt: record.updatedAt,
  };
}

function requiredKey(key: string | undefined): string {
  if (!key) {
    throw new Error("S3 Vectors result is missing a key");
  }
  return key;
}

function requiredFiniteNumber(value: unknown, description: string): number {
  const number =
    value && typeof value === "object" && "string" in value && typeof value.string === "string"
      ? Number(value.string)
      : Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`S3 Vectors result has an invalid ${description}`);
  }
  return number;
}
