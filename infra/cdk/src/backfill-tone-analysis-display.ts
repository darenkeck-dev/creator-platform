import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const stage = (process.env.APP_STAGE ?? "prod").trim().toLowerCase() || "prod";
const defaultTableName = stage === "prod" ? "Assets" : `Assets-${stage}`;
const TABLE_NAME = process.env.ASSETS_TABLE_NAME ?? defaultTableName;

type CliOptions = {
  apply: boolean;
};

type CandidateAsset = {
  id: string;
  toneAnalysis: Record<string, unknown>;
};

type AssetAnalysisLike = {
  tone?: {
    words?: {
      summary?: string;
      primary?: string[];
      secondary?: string[];
      avoid?: string[];
    };
    value?: Record<string, number>;
  };
  modelRuns?: Array<{
    kind?: string;
    metadata?: Record<string, unknown>;
  }>;
};

function parseArgs(argv: string[]): CliOptions {
  const args = new Set(argv);
  const apply = args.has("--apply");

  if (args.has("--help") || args.has("-h")) {
    console.log(
      [
        "Usage:",
        "  bun run --cwd infra/cdk backfill:tone-analysis-display",
        "  bun run --cwd infra/cdk backfill:tone-analysis-display -- --apply",
        "",
        "Behavior:",
        "  default: dry run (no writes)",
        "  --apply: copies display-ready tone fields from asset-analysis.json into asset.toneAnalysis",
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

function stringMetadataValue(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function displayToneFromAnalysis(analysis: AssetAnalysisLike): Record<string, unknown> {
  const words = analysis.tone?.words;
  const scores = analysis.tone?.value;
  const toneRun = analysis.modelRuns?.find((run) => run.kind === "tone");
  const metadata = toneRun?.metadata;

  return {
    ...(words?.summary ? { summary: words.summary } : {}),
    ...(words?.primary ? { primaryWords: words.primary } : {}),
    ...(words?.secondary ? { secondaryWords: words.secondary } : {}),
    ...(words?.avoid ? { avoidWords: words.avoid } : {}),
    ...(scores ? { scores } : {}),
    ...(stringMetadataValue(metadata, "semanticSummary")
      ? { semanticSummary: stringMetadataValue(metadata, "semanticSummary") }
      : {}),
    ...(stringMetadataValue(metadata, "caption")
      ? { caption: stringMetadataValue(metadata, "caption") }
      : {}),
    ...(stringMetadataValue(metadata, "mood") ? { mood: stringMetadataValue(metadata, "mood") } : {}),
  };
}

function needsDisplayBackfill(toneAnalysis: Record<string, unknown>): boolean {
  return (
    toneAnalysis.status === "ready" &&
    typeof toneAnalysis.analysisBucket === "string" &&
    typeof toneAnalysis.analysisKey === "string" &&
    typeof toneAnalysis.summary !== "string" &&
    typeof toneAnalysis.scores !== "object"
  );
}

async function scanCandidates(db: DynamoDBDocumentClient): Promise<CandidateAsset[]> {
  const candidates: CandidateAsset[] = [];
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  do {
    const result = await db.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        ProjectionExpression: "id, toneAnalysis",
        FilterExpression:
          "begins_with(pk, :assetPkPrefix) AND sk = :metaSk AND toneAnalysis.#status = :ready AND attribute_exists(toneAnalysis.analysisBucket) AND attribute_exists(toneAnalysis.analysisKey)",
        ExpressionAttributeNames: {
          "#status": "status",
        },
        ExpressionAttributeValues: {
          ":assetPkPrefix": "ASSET#",
          ":metaSk": "META",
          ":ready": "ready",
        },
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    for (const item of result.Items ?? []) {
      if (
        typeof item.id === "string" &&
        item.toneAnalysis &&
        typeof item.toneAnalysis === "object" &&
        !Array.isArray(item.toneAnalysis) &&
        needsDisplayBackfill(item.toneAnalysis as Record<string, unknown>)
      ) {
        candidates.push({
          id: item.id,
          toneAnalysis: item.toneAnalysis as Record<string, unknown>,
        });
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey);

  return candidates;
}

function isAssetAnalysisLike(value: unknown): value is AssetAnalysisLike {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

async function readAnalysisFromS3(s3: S3Client, bucket: string, key: string): Promise<AssetAnalysisLike> {
  const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = await result.Body?.transformToString();
  if (!body) {
    throw new Error(`Empty analysis object: s3://${bucket}/${key}`);
  }

  const parsed = JSON.parse(body) as unknown;
  if (!isAssetAnalysisLike(parsed)) {
    throw new Error(`Invalid analysis object: s3://${bucket}/${key}`);
  }

  return parsed;
}

async function updateToneDisplayFields(
  db: DynamoDBDocumentClient,
  candidate: CandidateAsset,
  displayFields: Record<string, unknown>
): Promise<void> {
  const now = new Date().toISOString();
  await db.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { pk: `ASSET#${candidate.id}`, sk: "META" },
      ConditionExpression: "attribute_exists(pk) AND attribute_exists(sk)",
      UpdateExpression: "SET toneAnalysis = :toneAnalysis, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":toneAnalysis": {
          ...candidate.toneAnalysis,
          ...displayFields,
          updatedAt: now,
        },
        ":updatedAt": now,
      },
    })
  );
}

async function run(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  const s3 = new S3Client({});

  console.log(`Stage: ${stage}`);
  console.log(`Table: ${TABLE_NAME}`);
  console.log(`Mode: ${options.apply ? "apply" : "dry-run"}`);

  const candidates = await scanCandidates(db);
  console.log(`Ready tone analyses missing display fields: ${candidates.length}`);

  let updated = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const bucket = candidate.toneAnalysis.analysisBucket as string;
    const key = candidate.toneAnalysis.analysisKey as string;

    try {
      const analysis = await readAnalysisFromS3(s3, bucket, key);
      const displayFields = displayToneFromAnalysis(analysis);
      const hasDisplayFields = Object.keys(displayFields).length > 0;
      console.log(
        `${options.apply ? "Backfill" : "Would backfill"}: ${candidate.id} (${hasDisplayFields ? "display fields found" : "no display fields"})`
      );

      if (options.apply && hasDisplayFields) {
        await updateToneDisplayFields(db, candidate, displayFields);
        updated += 1;
      }
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`Failed ${candidate.id}: ${message}`);
    }
  }

  if (!options.apply && candidates.length > 0) {
    console.log("Run with --apply to write display fields.");
  }

  console.log(`Backfill complete. Updated: ${updated}, failed: ${failed}`);
}

void run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(`Tone analysis display backfill failed: ${message}`);
  process.exit(1);
});
