import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const TARGET_SCHEMA_VERSION = 1;
const stage = (process.env.APP_STAGE ?? "prod").trim().toLowerCase() || "prod";
const defaultTableName = stage === "prod" ? "Assets" : `Assets-${stage}`;
const TABLE_NAME = process.env.ASSETS_TABLE_NAME ?? defaultTableName;

type AssetKey = {
  pk: string;
  sk: string;
};

type CliOptions = {
  apply: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const args = new Set(argv);
  const apply = args.has("--apply");

  if (args.has("--help") || args.has("-h")) {
    console.log(
      [
        "Usage:",
        "  bun run --cwd infra/cdk backfill:asset-schema-version",
        "  bun run --cwd infra/cdk backfill:asset-schema-version -- --apply",
        "",
        "Behavior:",
        "  default: dry run (no writes)",
        "  --apply: writes schemaVersion=1 to legacy ASSET#*/META items",
        "",
        "Optional env vars:",
        "  APP_STAGE (default: prod)",
        "  ASSETS_TABLE_NAME (default: Assets or Assets-<stage>)",
      ].join("\n")
    );
    process.exit(0);
  }

  return { apply };
}

async function scanLegacyAssets(db: DynamoDBDocumentClient): Promise<AssetKey[]> {
  const keys: AssetKey[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const result = await db.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        ProjectionExpression: "pk, sk",
        FilterExpression:
          "begins_with(pk, :assetPkPrefix) AND sk = :metaSk AND attribute_not_exists(schemaVersion)",
        ExpressionAttributeValues: {
          ":assetPkPrefix": "ASSET#",
          ":metaSk": "META",
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    for (const item of result.Items ?? []) {
      const pk = item.pk;
      const sk = item.sk;
      if (typeof pk === "string" && typeof sk === "string") {
        keys.push({ pk, sk });
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey);

  return keys;
}

async function updateSchemaVersion(db: DynamoDBDocumentClient, key: AssetKey): Promise<boolean> {
  try {
    await db.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: key,
        ConditionExpression:
          "attribute_exists(pk) AND attribute_exists(sk) AND attribute_not_exists(schemaVersion)",
        UpdateExpression: "SET schemaVersion = :schemaVersion",
        ExpressionAttributeValues: {
          ":schemaVersion": TARGET_SCHEMA_VERSION,
        },
      })
    );
    return true;
  } catch (error) {
    if (error instanceof Error && error.name === "ConditionalCheckFailedException") {
      return false;
    }

    throw error;
  }
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));

  console.log(`Stage: ${stage}`);
  console.log(`Table: ${TABLE_NAME}`);
  console.log(`Mode: ${options.apply ? "apply" : "dry-run"}`);

  const legacyKeys = await scanLegacyAssets(db);
  console.log(`Legacy asset META items missing schemaVersion: ${legacyKeys.length}`);

  if (!options.apply) {
    if (legacyKeys.length > 0) {
      const preview = legacyKeys.slice(0, 10).map((item) => `${item.pk} ${item.sk}`);
      console.log("Preview (first up to 10 keys):");
      for (const line of preview) {
        console.log(`  ${line}`);
      }
      console.log("Run with --apply to perform the backfill.");
    }
    return;
  }

  let updated = 0;
  let skipped = 0;

  for (const key of legacyKeys) {
    const didUpdate = await updateSchemaVersion(db, key);
    if (didUpdate) {
      updated += 1;
    } else {
      skipped += 1;
    }
  }

  console.log(`Backfill complete. Updated: ${updated}, skipped: ${skipped}`);
}

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Asset schemaVersion backfill failed: ${message}`);
  process.exit(1);
});
