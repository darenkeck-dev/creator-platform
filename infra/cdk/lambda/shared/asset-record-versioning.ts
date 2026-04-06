import { PutCommand, type DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { ASSET_SCHEMA_VERSION, AssetRecordSchema } from "@media-manager/contracts";
import { z } from "zod";

type AssetRecord = z.infer<typeof AssetRecordSchema>;

type AssetVersioningInput = {
  db: DynamoDBDocumentClient;
  tableName: string;
  item: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function getSchemaVersion(item: Record<string, unknown>): number {
  if (typeof item.schemaVersion === "number" && Number.isInteger(item.schemaVersion)) {
    return item.schemaVersion;
  }

  return 0;
}

type AssetMigration = (item: Record<string, unknown>) => Record<string, unknown>;

function migrateAssetV0ToV1(item: Record<string, unknown>): Record<string, unknown> {
  return {
    ...item,
    schemaVersion: 1,
  };
}

function migrateAssetV1ToV2(item: Record<string, unknown>): Record<string, unknown> {
  return {
    ...item,
    schemaVersion: 2,
  };
}

const assetMigrations: Record<number, AssetMigration> = {
  0: migrateAssetV0ToV1,
  1: migrateAssetV1ToV2,
};

function upgradeAssetRecordShape(item: Record<string, unknown>): Record<string, unknown> {
  const initialVersion = getSchemaVersion(item);
  if (initialVersion > ASSET_SCHEMA_VERSION) {
    return item;
  }

  let next = { ...item };
  let version = initialVersion;

  while (version < ASSET_SCHEMA_VERSION) {
    const migrate = assetMigrations[version];
    if (!migrate) {
      throw new Error(`No migration registered for asset schema version ${version}`);
    }

    next = migrate(next);
    version = getSchemaVersion(next);
  }

  return next;
}

async function persistIfUpgraded(input: {
  db: DynamoDBDocumentClient;
  tableName: string;
  original: Record<string, unknown>;
  upgraded: Record<string, unknown>;
}): Promise<void> {
  const originalVersion = getSchemaVersion(input.original);
  const upgradedVersion = getSchemaVersion(input.upgraded);
  if (upgradedVersion <= originalVersion) {
    return;
  }

  const pk = typeof input.original.pk === "string" ? input.original.pk : null;
  const sk = typeof input.original.sk === "string" ? input.original.sk : null;
  if (!pk || !sk) {
    return;
  }

  await input.db.send(
    new PutCommand({
      TableName: input.tableName,
      Item: {
        ...input.original,
        ...input.upgraded,
      },
      ConditionExpression: "attribute_exists(pk) AND attribute_exists(sk)",
    })
  );
}

export async function readAssetRecordWithUpgrade(
  input: AssetVersioningInput
): Promise<AssetRecord> {
  const upgraded = await upgradeAssetItemSchemaVersion(input);
  return AssetRecordSchema.parse(upgraded);
}

export async function upgradeAssetItemSchemaVersion(
  input: AssetVersioningInput
): Promise<Record<string, unknown>> {
  const record = asRecord(input.item);
  if (!record) {
    throw new Error("Asset record is not an object");
  }

  const upgraded = upgradeAssetRecordShape(record);
  await persistIfUpgraded({
    db: input.db,
    tableName: input.tableName,
    original: record,
    upgraded,
  });

  return upgraded;
}

export async function safeReadAssetRecordWithUpgrade(
  input: AssetVersioningInput
): Promise<AssetRecord | null> {
  try {
    return await readAssetRecordWithUpgrade(input);
  } catch {
    return null;
  }
}
