import { DynamoDBClient, type AttributeValue } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { AssetRecordSchema, type AssetRecord } from "@media-manager/contracts";
import {
  ASSET_TONE_VECTOR_SCHEMA_VERSION,
  assetToneVectorSourceFingerprint,
  buildAssetToneVectorRecord,
  type AssetToneVectorIndex,
  type AssetToneVectorRecord,
} from "@media-manager/tone-core";
import { z } from "zod";
import { S3VectorsIndex } from "../shared/s3-vectors-index";

type SqsEvent = {
  Records?: Array<{
    messageId: string;
    body: string;
  }>;
};

type SqsBatchResponse = {
  batchItemFailures: Array<{ itemIdentifier: string }>;
};

type DynamoDbStreamRecord = {
  eventID?: string;
  eventName?: "INSERT" | "MODIFY" | "REMOVE";
  eventSource?: "aws:dynamodb";
  dynamodb?: {
    Keys?: Record<string, AttributeValue>;
    NewImage?: Record<string, AttributeValue>;
    OldImage?: Record<string, AttributeValue>;
  };
};

type DynamoDbStreamEvent = {
  Records?: DynamoDbStreamRecord[];
};

type CommandSender = {
  send(command: unknown): Promise<unknown>;
};

export type VectorIndex = Pick<AssetToneVectorIndex, "upsert" | "delete">;

export type VectorSyncDependencies = {
  db: CommandSender;
  vectorIndex: VectorIndex;
  tableName: string;
  now?: () => string;
};

const VectorSyncMessageSchema = z.object({ assetId: z.string().min(1) }).strict();
const VECTOR_SYNC_STATE_SCHEMA_VERSION = "asset-vector-sync/v1";
const MAX_CONVERGENCE_ATTEMPTS = 5;

function requiredEnv(name: "ASSETS_TABLE_NAME" | "ASSET_TONE_VECTOR_INDEX_ARN"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function isConditionalCheckFailure(error: unknown): boolean {
  return error instanceof Error && error.name === "ConditionalCheckFailedException";
}

function vectorRecordForAsset(asset: AssetRecord): AssetToneVectorRecord | null {
  if (
    (asset.type !== "audio" && asset.type !== "video") ||
    asset.visibility !== "public" ||
    asset.status !== "ready" ||
    asset.toneAnalysis?.status !== "ready" ||
    asset.toneAnalysis.toneTaxonomyVersion !== "tone-taxonomy/v2" ||
    !asset.toneAnalysis.scores
  ) {
    return null;
  }

  try {
    return buildAssetToneVectorRecord({
      assetId: asset.id,
      assetType: asset.type,
      modelScores: asset.toneAnalysis.scores,
      adjustedScores: asset.toneAnalysis.adjustedScores,
      visibility: asset.visibility,
      assetStatus: asset.status,
      toneStatus: asset.toneAnalysis.status,
      updatedAt: asset.updatedAt,
    });
  } catch {
    return null;
  }
}

async function readAsset(
  db: CommandSender,
  tableName: string,
  assetId: string
): Promise<{ asset: AssetRecord; item: Record<string, unknown> } | null> {
  const result = (await db.send(
    new GetCommand({
      TableName: tableName,
      Key: { pk: `ASSET#${assetId}`, sk: "META" },
      ConsistentRead: true,
    })
  )) as { Item?: Record<string, unknown> };

  if (!result.Item) {
    return null;
  }

  const parsed = AssetRecordSchema.safeParse(result.Item);
  return parsed.success ? { asset: parsed.data, item: result.Item } : null;
}

async function persistSyncState(
  dependencies: VectorSyncDependencies,
  asset: AssetRecord,
  item: Record<string, unknown>,
  status: "indexed" | "deleted"
): Promise<void> {
  const sourceFingerprint = assetToneVectorSourceFingerprint(asset);
  const hasVisibility = Object.prototype.hasOwnProperty.call(item, "visibility");
  const hasToneAnalysis = Object.prototype.hasOwnProperty.call(item, "toneAnalysis");
  const conditions = [
    "attribute_exists(pk)",
    "attribute_exists(sk)",
    "id = :assetId",
    "#type = :assetType",
    "#status = :assetStatus",
    "updatedAt = :sourceUpdatedAt",
    hasVisibility ? "visibility = :visibility" : "attribute_not_exists(visibility)",
    hasToneAnalysis ? "toneAnalysis = :toneAnalysis" : "attribute_not_exists(toneAnalysis)",
  ];

  await dependencies.db.send(
    new UpdateCommand({
      TableName: dependencies.tableName,
      Key: { pk: `ASSET#${asset.id}`, sk: "META" },
      UpdateExpression: "SET vectorSync = :vectorSync",
      ConditionExpression: conditions.join(" AND "),
      ExpressionAttributeNames: {
        "#type": "type",
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":assetId": asset.id,
        ":assetType": item.type,
        ":assetStatus": item.status,
        ":sourceUpdatedAt": asset.updatedAt,
        ...(hasVisibility ? { ":visibility": item.visibility } : {}),
        ...(hasToneAnalysis ? { ":toneAnalysis": item.toneAnalysis } : {}),
        ":vectorSync": {
          schemaVersion: VECTOR_SYNC_STATE_SCHEMA_VERSION,
          status,
          vectorSchemaVersion: ASSET_TONE_VECTOR_SCHEMA_VERSION,
          sourceFingerprint,
          sourceUpdatedAt: asset.updatedAt,
          syncedAt: dependencies.now?.() ?? new Date().toISOString(),
        },
      },
    })
  );
}

function streamAssetId(record: DynamoDbStreamRecord): string | null {
  const pk = record.dynamodb?.Keys?.pk;
  const sk = record.dynamodb?.Keys?.sk;
  if (pk?.S?.startsWith("ASSET#") && pk.S.length > "ASSET#".length && sk?.S === "META") {
    return pk.S.slice("ASSET#".length);
  }
  return null;
}

function streamImageAsset(image: Record<string, AttributeValue> | undefined): AssetRecord | null {
  if (!image) {
    return null;
  }
  const parsed = AssetRecordSchema.safeParse(
    Object.fromEntries(Object.entries(image).map(([key, value]) => [key, attributeValue(value)]))
  );
  return parsed.success ? parsed.data : null;
}

function attributeValue(value: AttributeValue): unknown {
  if ("S" in value) return value.S;
  if ("N" in value) return Number(value.N);
  if ("BOOL" in value) return value.BOOL;
  if ("NULL" in value) return null;
  if ("L" in value) return value.L?.map(attributeValue) ?? [];
  if ("M" in value) {
    return Object.fromEntries(
      Object.entries(value.M ?? {}).map(([key, nested]) => [key, attributeValue(nested)])
    );
  }
  if ("SS" in value) return value.SS;
  if ("NS" in value) return value.NS?.map(Number);
  return undefined;
}

function shouldConvergeStreamRecord(record: DynamoDbStreamRecord): boolean {
  if (record.eventName === "REMOVE") {
    return true;
  }
  if (record.eventName !== "INSERT" && record.eventName !== "MODIFY") {
    return false;
  }

  const current = streamImageAsset(record.dynamodb?.NewImage);
  if (!current) {
    return false;
  }
  const previous = streamImageAsset(record.dynamodb?.OldImage);
  return (
    assetToneVectorSourceFingerprint(current) !==
    (previous ? assetToneVectorSourceFingerprint(previous) : undefined)
  );
}

async function convergeAsset(dependencies: VectorSyncDependencies, assetId: string): Promise<void> {
  for (let attempt = 0; attempt < MAX_CONVERGENCE_ATTEMPTS; attempt += 1) {
    const current = await readAsset(dependencies.db, dependencies.tableName, assetId);
    if (!current) {
      await dependencies.vectorIndex.delete(assetId);
      return;
    }

    const record = vectorRecordForAsset(current.asset);
    if (record) {
      await dependencies.vectorIndex.upsert(record);
    } else {
      await dependencies.vectorIndex.delete(assetId);
    }

    try {
      await persistSyncState(
        dependencies,
        current.asset,
        current.item,
        record ? "indexed" : "deleted"
      );
      return;
    } catch (error) {
      if (!isConditionalCheckFailure(error) || attempt === MAX_CONVERGENCE_ATTEMPTS - 1) {
        throw error;
      }
    }
  }
}

export function createHandler(dependencies: VectorSyncDependencies) {
  return async (event: SqsEvent | DynamoDbStreamEvent): Promise<SqsBatchResponse | void> => {
    const records = event.Records ?? [];
    if (
      records.some((record) => "eventSource" in record && record.eventSource === "aws:dynamodb")
    ) {
      await Promise.all(
        (records as DynamoDbStreamRecord[]).map(async (record) => {
          const assetId = streamAssetId(record);
          if (assetId && shouldConvergeStreamRecord(record)) {
            await convergeAsset(dependencies, assetId);
          }
        })
      );
      return;
    }

    const batchItemFailures: SqsBatchResponse["batchItemFailures"] = [];

    await Promise.all(
      (records as NonNullable<SqsEvent["Records"]>).map(async (record) => {
        try {
          const message = VectorSyncMessageSchema.parse(JSON.parse(record.body));
          await convergeAsset(dependencies, message.assetId);
        } catch (error) {
          console.error(
            JSON.stringify({
              level: "error",
              message: "Asset vector synchronization failed",
              messageId: record.messageId,
              errorName: error instanceof Error ? error.name : undefined,
              errorMessage: error instanceof Error ? error.message : "Unknown error",
            })
          );
          batchItemFailures.push({ itemIdentifier: record.messageId });
        }
      })
    );

    return { batchItemFailures };
  };
}

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

export const handler = async (
  event: SqsEvent | DynamoDbStreamEvent
): Promise<SqsBatchResponse | void> =>
  createHandler({
    db,
    vectorIndex: new S3VectorsIndex({ indexArn: requiredEnv("ASSET_TONE_VECTOR_INDEX_ARN") }),
    tableName: requiredEnv("ASSETS_TABLE_NAME"),
  })(event);
