import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { ListVectorsCommand, S3VectorsClient } from "@aws-sdk/client-s3vectors";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { AssetRecordSchema } from "@media-manager/contracts";
import {
  ASSET_TONE_VECTOR_SCHEMA_VERSION,
  assetToneVectorSourceFingerprint,
} from "@media-manager/tone-core";

export const VECTOR_SYNC_STATE_SCHEMA_VERSION = "asset-vector-sync/v1";
const ReconcileAssetRecordSchema = AssetRecordSchema.omit({ vectorSync: true });
const TONE_DIMENSIONS = [
  "valence",
  "arousal",
  "dominance",
  "warmth",
  "tension",
  "intimacy",
  "instability",
  "nostalgia",
  "beauty",
  "menace",
] as const;

type CommandSender = {
  send(command: unknown): Promise<unknown>;
};

export type ReconcileOptions = {
  apply: boolean;
  force: boolean;
  help: boolean;
  stage: string;
  tableName: string;
  indexArn: string;
  queueUrl?: string;
};

export type AssetVectorClassification = {
  assetId: string;
  eligible: boolean;
  expectedStatus: "indexed" | "deleted";
  needsConvergence: boolean;
};

export type ReconcileSummary = {
  indexed: number;
  scanned: number;
  eligible: number;
  ineligible: number;
  current: number;
  needsConvergence: number;
  orphans: number;
  queued: number;
};

export type ReconcileDependencies = {
  db: CommandSender;
  vectors: CommandSender;
  queue: CommandSender;
};

function optionValue(argv: string[], index: number, name: string): [string, number] {
  const argument = argv[index];
  const inlineValue = argument.slice(name.length + 1);
  if (argument.startsWith(`${name}=`)) {
    if (!inlineValue) throw new Error(`${name} requires a value`);
    return [inlineValue, index];
  }

  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return [value, index + 1];
}

export function parseArgs(argv: string[], env: NodeJS.ProcessEnv = process.env): ReconcileOptions {
  let apply = false;
  let force = false;
  let help = false;
  let stageArgument: string | undefined;
  let tableArgument: string | undefined;
  let indexArgument: string | undefined;
  let queueArgument: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") {
      apply = true;
    } else if (argument === "--force") {
      force = true;
    } else if (argument === "--help" || argument === "-h") {
      help = true;
    } else if (argument === "--stage" || argument.startsWith("--stage=")) {
      [stageArgument, index] = optionValue(argv, index, "--stage");
    } else if (argument === "--table-name" || argument.startsWith("--table-name=")) {
      [tableArgument, index] = optionValue(argv, index, "--table-name");
    } else if (argument === "--index-arn" || argument.startsWith("--index-arn=")) {
      [indexArgument, index] = optionValue(argv, index, "--index-arn");
    } else if (argument === "--queue-url" || argument.startsWith("--queue-url=")) {
      [queueArgument, index] = optionValue(argv, index, "--queue-url");
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  const stage = (stageArgument ?? env.APP_STAGE ?? "prod").trim().toLowerCase() || "prod";
  const tableName =
    tableArgument ?? env.ASSETS_TABLE_NAME ?? (stage === "prod" ? "Assets" : `Assets-${stage}`);
  const indexArn = indexArgument ?? env.ASSET_TONE_VECTOR_INDEX_ARN;
  const queueUrl = queueArgument ?? env.VECTOR_SYNC_QUEUE_URL;

  if (!help && !indexArn) {
    throw new Error("--index-arn or ASSET_TONE_VECTOR_INDEX_ARN is required");
  }
  if (apply && !queueUrl) {
    throw new Error("--apply requires --queue-url or VECTOR_SYNC_QUEUE_URL");
  }

  return {
    apply,
    force,
    help,
    stage,
    tableName,
    indexArn: indexArn ?? "",
    ...(queueUrl ? { queueUrl } : {}),
  };
}

export function isVectorEligible(item: Record<string, unknown>): boolean {
  const toneAnalysis =
    item.toneAnalysis && typeof item.toneAnalysis === "object" && !Array.isArray(item.toneAnalysis)
      ? (item.toneAnalysis as Record<string, unknown>)
      : undefined;
  if (
    (item.type !== "audio" && item.type !== "video") ||
    item.visibility !== "public" ||
    item.status !== "ready" ||
    toneAnalysis?.status !== "ready" ||
    toneAnalysis.toneTaxonomyVersion !== "tone-taxonomy/v2" ||
    typeof item.updatedAt !== "string" ||
    Number.isNaN(Date.parse(item.updatedAt))
  ) {
    return false;
  }

  const scores =
    toneAnalysis.scores &&
    typeof toneAnalysis.scores === "object" &&
    !Array.isArray(toneAnalysis.scores)
      ? (toneAnalysis.scores as Record<string, unknown>)
      : undefined;
  const adjustedScores =
    toneAnalysis.adjustedScores &&
    typeof toneAnalysis.adjustedScores === "object" &&
    !Array.isArray(toneAnalysis.adjustedScores)
      ? (toneAnalysis.adjustedScores as Record<string, unknown>)
      : undefined;

  if (!scores || (toneAnalysis.adjustedScores !== undefined && !adjustedScores)) return false;
  const suppliedValuesAreValid = [scores, adjustedScores].every(
    (values) =>
      !values ||
      TONE_DIMENSIONS.every((dimension) => {
        if (!Object.prototype.hasOwnProperty.call(values, dimension)) return true;
        const value = values[dimension];
        return typeof value === "number" && Number.isFinite(value) && value >= -1 && value <= 1;
      })
  );
  if (!suppliedValuesAreValid) return false;

  return TONE_DIMENSIONS.every((dimension) => {
    const value =
      adjustedScores && Object.prototype.hasOwnProperty.call(adjustedScores, dimension)
        ? adjustedScores[dimension]
        : scores[dimension];
    return typeof value === "number" && Number.isFinite(value) && value >= -1 && value <= 1;
  });
}

export function classifyAsset(
  item: Record<string, unknown>,
  indexedKeys: ReadonlySet<string>,
  force = false
): AssetVectorClassification | null {
  if (typeof item.id !== "string" || item.id.length === 0) return null;

  const parsedAsset = ReconcileAssetRecordSchema.safeParse(item);
  if (!parsedAsset.success) {
    return {
      assetId: item.id,
      eligible: false,
      expectedStatus: "deleted",
      needsConvergence: indexedKeys.has(item.id),
    };
  }

  const asset = parsedAsset.data;
  const eligible = isVectorEligible(asset);
  const expectedStatus = eligible ? "indexed" : "deleted";
  const sourceFingerprint = assetToneVectorSourceFingerprint(asset);
  const vectorSync =
    item.vectorSync && typeof item.vectorSync === "object" && !Array.isArray(item.vectorSync)
      ? (item.vectorSync as Record<string, unknown>)
      : undefined;
  const needsConvergence =
    force ||
    vectorSync?.schemaVersion !== VECTOR_SYNC_STATE_SCHEMA_VERSION ||
    vectorSync.vectorSchemaVersion !== ASSET_TONE_VECTOR_SCHEMA_VERSION ||
    vectorSync.sourceFingerprint !== sourceFingerprint ||
    vectorSync.status !== expectedStatus ||
    (eligible ? !indexedKeys.has(asset.id) : indexedKeys.has(asset.id));

  return { assetId: item.id, eligible, expectedStatus, needsConvergence };
}

export async function reconcileAssetVectors(
  dependencies: ReconcileDependencies,
  options: ReconcileOptions
): Promise<ReconcileSummary> {
  const summary: ReconcileSummary = {
    indexed: 0,
    scanned: 0,
    eligible: 0,
    ineligible: 0,
    current: 0,
    needsConvergence: 0,
    orphans: 0,
    queued: 0,
  };
  const indexedKeys = new Set<string>();
  let nextToken: string | undefined;

  do {
    const result = (await dependencies.vectors.send(
      new ListVectorsCommand({ indexArn: options.indexArn, nextToken })
    )) as { vectors?: Array<{ key?: string }>; nextToken?: string };
    for (const vector of result.vectors ?? []) {
      if (typeof vector.key === "string" && vector.key.length > 0) indexedKeys.add(vector.key);
    }
    nextToken = result.nextToken;
  } while (nextToken);

  summary.indexed = indexedKeys.size;
  const authoritativeAssetIds = new Set<string>();
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const result = (await dependencies.db.send(
      new ScanCommand({
        TableName: options.tableName,
        FilterExpression: "begins_with(pk, :assetPkPrefix) AND sk = :metaSk",
        ExpressionAttributeValues: {
          ":assetPkPrefix": "ASSET#",
          ":metaSk": "META",
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    )) as { Items?: Record<string, unknown>[]; LastEvaluatedKey?: Record<string, unknown> };

    for (const item of result.Items ?? []) {
      const classification = classifyAsset(item, indexedKeys, options.force);
      if (!classification) continue;

      authoritativeAssetIds.add(classification.assetId);
      summary.scanned += 1;
      summary[classification.eligible ? "eligible" : "ineligible"] += 1;
      if (!classification.needsConvergence) {
        summary.current += 1;
        continue;
      }

      summary.needsConvergence += 1;
      if (options.apply) {
        await dependencies.queue.send(
          new SendMessageCommand({
            QueueUrl: options.queueUrl,
            MessageBody: JSON.stringify({ assetId: classification.assetId }),
          })
        );
        summary.queued += 1;
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  for (const assetId of indexedKeys) {
    if (authoritativeAssetIds.has(assetId)) continue;
    summary.orphans += 1;
    summary.needsConvergence += 1;
    if (options.apply) {
      await dependencies.queue.send(
        new SendMessageCommand({
          QueueUrl: options.queueUrl,
          MessageBody: JSON.stringify({ assetId }),
        })
      );
      summary.queued += 1;
    }
  }

  return summary;
}

function printHelp(): void {
  console.log(
    [
      "Usage:",
      "  bun run --cwd infra/cdk reconcile:asset-vectors",
      "  bun run --cwd infra/cdk reconcile:asset-vectors -- --apply [--force]",
      "",
      "Behavior:",
      "  default: dry run (reports assets and orphan keys needing vector reconciliation)",
      "  --apply: queues vector reconciliation for every non-current asset and orphan",
      "  --force: treats every authoritative asset and orphan as needing reconciliation",
      "",
      "Options and equivalent environment variables:",
      "  --stage <stage>       APP_STAGE (default: prod)",
      "  --table-name <name>   ASSETS_TABLE_NAME (default: Assets or Assets-<stage>)",
      "  --index-arn <arn>     ASSET_TONE_VECTOR_INDEX_ARN (required)",
      "  --queue-url <url>     VECTOR_SYNC_QUEUE_URL (required with --apply)",
    ].join("\n")
  );
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(argv);
  if (options.help) {
    printHelp();
    return;
  }

  console.log(`Stage: ${options.stage}`);
  console.log(`Table: ${options.tableName}`);
  console.log(`Index: ${options.indexArn}`);
  console.log(`Mode: ${options.apply ? "apply" : "dry-run"}${options.force ? " (force)" : ""}`);

  const summary = await reconcileAssetVectors(
    {
      db: DynamoDBDocumentClient.from(new DynamoDBClient({})),
      vectors: new S3VectorsClient({}),
      queue: new SQSClient({}),
    },
    options
  );

  console.log(`Indexed vector keys: ${summary.indexed}`);
  console.log(`Authoritative asset META records: ${summary.scanned}`);
  console.log(`Eligible: ${summary.eligible}, ineligible: ${summary.ineligible}`);
  console.log(`Orphan index keys: ${summary.orphans}`);
  console.log(
    `Current: ${summary.current}, needs vector reconciliation: ${summary.needsConvergence}`
  );
  if (options.apply) {
    console.log(`Vector reconciliation queued: ${summary.queued}`);
  } else if (summary.needsConvergence > 0) {
    console.log("Run with --apply to queue vector reconciliation.");
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Asset vector reconciliation failed: ${message}`);
    process.exitCode = 1;
  });
}
