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
} from "@media-manager/tone-core";

const VectorIndexMetadataSchema = AssetToneVectorRecordSchema.omit({
  assetId: true,
  effectiveTone: true,
});
type VectorIndexMetadata = Omit<AssetToneVectorRecord, "assetId" | "effectiveTone">;

export type S3VectorsIndexOptions = {
  indexArn: string;
  client?: S3VectorsClient;
};

export class S3VectorsIndex implements AssetToneVectorIndex {
  private readonly client: S3VectorsClient;
  private readonly indexArn: string;

  constructor({ indexArn, client = new S3VectorsClient({}) }: S3VectorsIndexOptions) {
    this.indexArn = indexArn;
    this.client = client;
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

  async queryNearest({ vector, limit }: Parameters<AssetToneVectorIndex["queryNearest"]>[0]) {
    const response = await this.client.send(
      new QueryVectorsCommand({
        indexArn: this.indexArn,
        queryVector: { float32: vector },
        topK: limit,
        returnDistance: true,
      })
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
      })
    );
    const records = new Map(
      (stored.vectors ?? []).map((result) => {
        const assetId = requiredKey(result.key);
        if (!result.data || !("float32" in result.data)) {
          throw new Error(`S3 Vectors record ${assetId} is missing float32 data`);
        }
        return [
          assetId,
          AssetToneVectorRecordSchema.parse({
            assetId,
            effectiveTone: result.data.float32,
            ...VectorIndexMetadataSchema.parse(result.metadata),
          }),
        ];
      })
    );

    return queryVectors.map((result) => {
      const assetId = requiredKey(result.key);
      if (!Number.isFinite(result.distance)) {
        throw new Error("S3 Vectors query result is missing a key or finite distance");
      }
      const record = records.get(assetId);
      if (!record) {
        throw new Error(`S3 Vectors record ${assetId} was not returned by GetVectors`);
      }

      return {
        record,
        distance: result.distance as number,
      };
    });
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
