import { DescribeTableCommand, DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DeleteObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient, GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import {
  AssetRecordSchema,
  MusicReleaseRecordSchema,
  MusicTrackRecordSchema,
} from "@media-manager/contracts";

type CommandSender = { send(command: unknown): Promise<unknown> };

export type ReconcileMediaOrphansOptions = {
  apply: boolean;
  confirmProduction: boolean;
  help: boolean;
  stage: string;
  tableName: string;
  originalsBucketName: string;
  derivedBucketName: string;
  expectedAccount?: string;
  olderThanDays: number;
};

export type StoredObject = {
  key: string;
  lastModified?: Date;
  etag?: string;
  size?: number;
};

type S3Finding = StoredObject & {
  assetId: string;
  oldEnough: boolean;
  eligibleForDeletion: boolean;
};

type Inventory = {
  scannedRecords: number;
  authoritativeAssets: number;
  invalidAssetRecords: Array<{ pk: string; issues: string[] }>;
  danglingMetadata: Array<{
    type: "track_asset" | "release_cover" | "release_track";
    id: string;
    referenceId: string;
  }>;
  orphanOriginalObjects: S3Finding[];
  orphanDerivedObjects: S3Finding[];
  ambiguousOriginalKeys: string[];
  ambiguousDerivedKeys: string[];
  missingOriginalObjects: Array<{ assetId: string; key: string }>;
  missingDerivedObjects: Array<{ assetId: string; key: string }>;
};

export type ReconcileMediaOrphansSummary = Inventory & {
  schemaVersion: "media-orphan-reconciliation/v1";
  mode: "dry-run" | "apply";
  stage: string;
  tableName: string;
  originalsBucketName: string;
  derivedBucketName: string;
  account: string;
  olderThanDays: number;
  actions: {
    originalObjectsDeleted: number;
    derivedObjectsDeleted: number;
    skippedAfterSafetyRecheck: number;
  };
  failures: Array<{ bucket: string; key: string; error: string }>;
};

export type ReconcileMediaOrphansDependencies = {
  db: CommandSender;
  dynamo: CommandSender;
  s3: CommandSender;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ACCOUNT_PATTERN = /^\d{12}$/;

function optionValue(argv: string[], index: number, name: string): [string, number] {
  const argument = argv[index];
  if (argument.startsWith(`${name}=`)) {
    const value = argument.slice(name.length + 1);
    if (!value) throw new Error(`${name} requires a value`);
    return [value, index];
  }
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return [value, index + 1];
}

function stageResources(stage: string) {
  return {
    tableName: stage === "prod" ? "Assets" : `Assets-${stage}`,
    originalsBucketName: `media-originals-${stage}`,
    derivedBucketName: `media-derived-${stage}`,
  };
}

function validateApplyOptions(options: ReconcileMediaOrphansOptions): void {
  if (!options.apply) return;
  if (!options.expectedAccount)
    throw new Error("--apply requires --expected-account or EXPECTED_AWS_ACCOUNT_ID");
  if (options.stage === "prod" && !options.confirmProduction)
    throw new Error("Production apply requires --confirm-production");
  const expected = stageResources(options.stage);
  if (
    options.tableName !== expected.tableName ||
    options.originalsBucketName !== expected.originalsBucketName ||
    options.derivedBucketName !== expected.derivedBucketName
  ) {
    throw new Error(`Apply resources must exactly match stage ${options.stage}`);
  }
}

export function parseArgs(
  argv: string[],
  env: NodeJS.ProcessEnv = process.env
): ReconcileMediaOrphansOptions {
  let apply = false;
  let confirmProduction = false;
  let help = false;
  let stageArgument: string | undefined;
  let tableArgument: string | undefined;
  let originalsArgument: string | undefined;
  let derivedArgument: string | undefined;
  let expectedAccountArgument: string | undefined;
  let olderThanArgument: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--apply") apply = true;
    else if (argument === "--confirm-production") confirmProduction = true;
    else if (argument === "--help" || argument === "-h") help = true;
    else if (argument === "--stage" || argument.startsWith("--stage="))
      [stageArgument, index] = optionValue(argv, index, "--stage");
    else if (argument === "--table-name" || argument.startsWith("--table-name="))
      [tableArgument, index] = optionValue(argv, index, "--table-name");
    else if (argument === "--originals-bucket" || argument.startsWith("--originals-bucket="))
      [originalsArgument, index] = optionValue(argv, index, "--originals-bucket");
    else if (argument === "--derived-bucket" || argument.startsWith("--derived-bucket="))
      [derivedArgument, index] = optionValue(argv, index, "--derived-bucket");
    else if (argument === "--expected-account" || argument.startsWith("--expected-account="))
      [expectedAccountArgument, index] = optionValue(argv, index, "--expected-account");
    else if (argument === "--older-than-days" || argument.startsWith("--older-than-days="))
      [olderThanArgument, index] = optionValue(argv, index, "--older-than-days");
    else throw new Error(`Unknown argument: ${argument}`);
  }

  const stage = (stageArgument ?? env.APP_STAGE ?? "prod").trim().toLowerCase() || "prod";
  const defaults = stageResources(stage);
  const tableName = tableArgument ?? env.ASSETS_TABLE_NAME ?? defaults.tableName;
  const originalsBucketName =
    originalsArgument ?? env.ASSETS_ORIGINALS_BUCKET_NAME ?? defaults.originalsBucketName;
  const derivedBucketName =
    derivedArgument ?? env.ASSETS_DERIVED_BUCKET_NAME ?? defaults.derivedBucketName;
  const expectedAccount = expectedAccountArgument ?? env.EXPECTED_AWS_ACCOUNT_ID;
  const olderThanDays = Number(olderThanArgument ?? env.MEDIA_ORPHAN_OLDER_THAN_DAYS ?? "7");

  if (!Number.isFinite(olderThanDays) || olderThanDays < 0)
    throw new Error("--older-than-days must be a non-negative number");
  if (expectedAccount && !ACCOUNT_PATTERN.test(expectedAccount))
    throw new Error("--expected-account must contain exactly 12 digits");
  const options = {
    apply,
    confirmProduction,
    help,
    stage,
    tableName,
    originalsBucketName,
    derivedBucketName,
    ...(expectedAccount ? { expectedAccount } : {}),
    olderThanDays,
  };
  if (!help) validateApplyOptions(options);
  return options;
}

export function parseOriginalAssetId(key: string): string | null {
  const match = /^incoming\/([^/]+)(?:\/.+)?$/.exec(key);
  return match && UUID_PATTERN.test(match[1]) ? match[1].toLowerCase() : null;
}

export function parseDerivedAssetId(key: string): string | null {
  const match = /^derived\/([^/]+)\/.+/.exec(key);
  return match && UUID_PATTERN.test(match[1]) ? match[1].toLowerCase() : null;
}

export function isOlderThan(value: Date | undefined, now: Date, days: number): boolean {
  return Boolean(value && value.valueOf() <= now.valueOf() - days * 24 * 60 * 60 * 1000);
}

function completeMetadata(object: StoredObject): boolean {
  return (
    object.lastModified instanceof Date &&
    typeof object.etag === "string" &&
    typeof object.size === "number"
  );
}

function metadataMatches(left: StoredObject, right: StoredObject): boolean {
  return (
    left.lastModified?.valueOf() === right.lastModified?.valueOf() &&
    left.etag === right.etag &&
    left.size === right.size
  );
}

function stripKeys(item: Record<string, unknown>): Record<string, unknown> {
  const { pk: _pk, sk: _sk, gsi1pk: _gsi1pk, gsi1sk: _gsi1sk, ...record } = item;
  return record;
}

function derivedKeyFromUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const key = decodeURIComponent(new URL(value).pathname.replace(/^\/+/, ""));
    return key.startsWith("derived/") ? key : null;
  } catch {
    return null;
  }
}

async function scanTable(db: CommandSender, tableName: string): Promise<Record<string, unknown>[]> {
  const records: Record<string, unknown>[] = [];
  let cursor: Record<string, unknown> | undefined;
  do {
    const result = (await db.send(
      new ScanCommand({ TableName: tableName, ConsistentRead: true, ExclusiveStartKey: cursor })
    )) as { Items?: Record<string, unknown>[]; LastEvaluatedKey?: Record<string, unknown> };
    records.push(...(result.Items ?? []));
    cursor = result.LastEvaluatedKey;
  } while (cursor);
  return records;
}

async function listBucket(
  s3: CommandSender,
  bucketName: string,
  expectedBucketOwner: string
): Promise<StoredObject[]> {
  const objects: StoredObject[] = [];
  let token: string | undefined;
  do {
    const result = (await s3.send(
      new ListObjectsV2Command({
        Bucket: bucketName,
        ExpectedBucketOwner: expectedBucketOwner,
        ContinuationToken: token,
      })
    )) as {
      Contents?: Array<{ Key?: string; LastModified?: Date; ETag?: string; Size?: number }>;
      NextContinuationToken?: string;
    };
    for (const object of result.Contents ?? []) {
      if (!object.Key) continue;
      objects.push({
        key: object.Key,
        lastModified: object.LastModified,
        etag: object.ETag,
        size: object.Size,
      });
    }
    token = result.NextContinuationToken;
  } while (token);
  return objects;
}

export function classifyInventory(
  records: Record<string, unknown>[],
  originalObjects: StoredObject[],
  derivedObjects: StoredObject[],
  options: Pick<
    ReconcileMediaOrphansOptions,
    "originalsBucketName" | "derivedBucketName" | "olderThanDays"
  >,
  now = new Date()
): Inventory {
  const assets = new Map<string, ReturnType<typeof AssetRecordSchema.parse>>();
  const protectedAssetIds = new Set<string>();
  const invalidAssetRecords: Inventory["invalidAssetRecords"] = [];
  for (const item of records) {
    if (typeof item.pk !== "string" || !item.pk.startsWith("ASSET#") || item.sk !== "META")
      continue;
    const keyAssetId = item.pk.slice("ASSET#".length).toLowerCase();
    if (keyAssetId) protectedAssetIds.add(keyAssetId);
    const parsed = AssetRecordSchema.safeParse(item);
    if (parsed.success) {
      assets.set(parsed.data.id.toLowerCase(), parsed.data);
      protectedAssetIds.add(parsed.data.id.toLowerCase());
    } else
      invalidAssetRecords.push({
        pk: item.pk,
        issues: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
      });
  }

  const tracks = records.flatMap((item) => {
    if (item.pk !== "MUSIC" || typeof item.sk !== "string" || !item.sk.startsWith("TRACK#"))
      return [];
    const parsed = MusicTrackRecordSchema.safeParse(stripKeys(item));
    return parsed.success ? [parsed.data] : [];
  });
  const releases = records.flatMap((item) => {
    if (item.pk !== "MUSIC" || typeof item.sk !== "string" || !item.sk.startsWith("RELEASE#"))
      return [];
    const parsed = MusicReleaseRecordSchema.safeParse(stripKeys(item));
    return parsed.success ? [parsed.data] : [];
  });
  const trackIds = new Set(tracks.map((track) => track.id));
  const danglingMetadata: Inventory["danglingMetadata"] = [];
  for (const track of tracks) {
    if (!assets.has(track.assetId.toLowerCase()))
      danglingMetadata.push({ type: "track_asset", id: track.id, referenceId: track.assetId });
  }
  for (const release of releases) {
    if (release.coverAssetId && !assets.has(release.coverAssetId.toLowerCase()))
      danglingMetadata.push({
        type: "release_cover",
        id: release.id,
        referenceId: release.coverAssetId,
      });
    for (const trackId of release.trackIds) {
      if (!trackIds.has(trackId))
        danglingMetadata.push({ type: "release_track", id: release.id, referenceId: trackId });
    }
  }

  const referencedOriginals = new Map<string, string>();
  const referencedDerived = new Map<string, string>();
  for (const asset of assets.values()) {
    if (asset.type === "folder") continue;
    if (
      asset.original.bucket === "pending" ||
      asset.original.bucket === options.originalsBucketName
    )
      referencedOriginals.set(asset.original.key, asset.id);
    for (const key of [
      asset.toneAnalysis?.analysisBucket === options.derivedBucketName
        ? asset.toneAnalysis.analysisKey
        : undefined,
      asset.toneAnalysis?.bundleBucket === options.derivedBucketName
        ? asset.toneAnalysis.bundleKey
        : undefined,
      derivedKeyFromUrl(asset.stream?.hlsMasterUrl),
      derivedKeyFromUrl(asset.stream?.posterUrl),
    ]) {
      if (key) referencedDerived.set(key, asset.id);
    }
  }

  const originalKeys = new Set(originalObjects.map((object) => object.key));
  const derivedKeys = new Set(derivedObjects.map((object) => object.key));
  const ambiguousOriginalKeys: string[] = [];
  const ambiguousDerivedKeys: string[] = [];
  const orphanOriginalObjects: S3Finding[] = [];
  const orphanDerivedObjects: S3Finding[] = [];
  for (const object of originalObjects) {
    if (referencedOriginals.has(object.key)) continue;
    const assetId = parseOriginalAssetId(object.key);
    if (!assetId) {
      ambiguousOriginalKeys.push(object.key);
      continue;
    }
    if (protectedAssetIds.has(assetId) && !assets.has(assetId)) {
      ambiguousOriginalKeys.push(object.key);
      continue;
    }
    const oldEnough = isOlderThan(object.lastModified, now, options.olderThanDays);
    orphanOriginalObjects.push({
      ...object,
      assetId,
      oldEnough,
      eligibleForDeletion: oldEnough && completeMetadata(object),
    });
  }
  for (const object of derivedObjects) {
    const assetId = parseDerivedAssetId(object.key);
    if (!assetId) {
      ambiguousDerivedKeys.push(object.key);
      continue;
    }
    if (protectedAssetIds.has(assetId)) continue;
    const oldEnough = isOlderThan(object.lastModified, now, options.olderThanDays);
    orphanDerivedObjects.push({
      ...object,
      assetId,
      oldEnough,
      eligibleForDeletion: oldEnough && completeMetadata(object),
    });
  }

  return {
    scannedRecords: records.length,
    authoritativeAssets: protectedAssetIds.size,
    invalidAssetRecords,
    danglingMetadata,
    orphanOriginalObjects,
    orphanDerivedObjects,
    ambiguousOriginalKeys,
    ambiguousDerivedKeys,
    missingOriginalObjects: [...referencedOriginals].flatMap(([key, assetId]) =>
      originalKeys.has(key) ? [] : [{ assetId, key }]
    ),
    missingDerivedObjects: [...referencedDerived].flatMap(([key, assetId]) =>
      derivedKeys.has(key) ? [] : [{ assetId, key }]
    ),
  };
}

async function tableAccount(dynamo: CommandSender, tableName: string): Promise<string> {
  const result = (await dynamo.send(new DescribeTableCommand({ TableName: tableName }))) as {
    Table?: { TableArn?: string };
  };
  const account = result.Table?.TableArn?.split(":")[4];
  if (!account || !ACCOUNT_PATTERN.test(account))
    throw new Error(`Unable to determine AWS account from table ${tableName}`);
  return account;
}

async function discover(
  dependencies: ReconcileMediaOrphansDependencies,
  options: ReconcileMediaOrphansOptions,
  account: string,
  now: Date
): Promise<Inventory> {
  const [records, originalObjects, derivedObjects] = await Promise.all([
    scanTable(dependencies.db, options.tableName),
    listBucket(dependencies.s3, options.originalsBucketName, account),
    listBucket(dependencies.s3, options.derivedBucketName, account),
  ]);
  return classifyInventory(records, originalObjects, derivedObjects, options, now);
}

function isPreconditionFailure(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return candidate.name === "PreconditionFailed" || candidate.$metadata?.httpStatusCode === 412;
}

async function stillUnreferenced(
  db: CommandSender,
  tableName: string,
  object: S3Finding,
  scope: "original" | "derived"
): Promise<boolean> {
  const result = (await db.send(
    new GetCommand({
      TableName: tableName,
      Key: { pk: `ASSET#${object.assetId}`, sk: "META" },
      ConsistentRead: true,
    })
  )) as { Item?: Record<string, unknown> };
  if (!result.Item) return true;
  if (scope === "derived") return false;
  const parsed = AssetRecordSchema.safeParse(result.Item);
  return (
    parsed.success &&
    parsed.data.id.toLowerCase() === object.assetId &&
    parsed.data.original.key !== object.key
  );
}

async function deleteObjects(
  db: CommandSender,
  s3: CommandSender,
  tableName: string,
  bucket: string,
  account: string,
  objects: S3Finding[],
  scope: "original" | "derived",
  failures: ReconcileMediaOrphansSummary["failures"]
): Promise<{ deleted: number; skipped: number }> {
  let deleted = 0;
  let skipped = 0;
  for (const object of objects) {
    try {
      if (!(await stillUnreferenced(db, tableName, object, scope))) {
        skipped += 1;
        continue;
      }
      await s3.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: object.key,
          IfMatch: object.etag,
          ExpectedBucketOwner: account,
        })
      );
      deleted += 1;
    } catch (error) {
      if (isPreconditionFailure(error)) {
        skipped += 1;
        continue;
      }
      failures.push({
        bucket,
        key: object.key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return { deleted, skipped };
}

export async function reconcileMediaOrphans(
  dependencies: ReconcileMediaOrphansDependencies,
  options: ReconcileMediaOrphansOptions,
  now = new Date()
): Promise<ReconcileMediaOrphansSummary> {
  validateApplyOptions(options);
  const account = await tableAccount(dependencies.dynamo, options.tableName);
  if (options.expectedAccount && options.expectedAccount !== account)
    throw new Error(
      `AWS account mismatch: expected ${options.expectedAccount}, table is ${account}`
    );

  const inventory = await discover(dependencies, options, account, now);
  const actions = {
    originalObjectsDeleted: 0,
    derivedObjectsDeleted: 0,
    skippedAfterSafetyRecheck: 0,
  };
  const failures: ReconcileMediaOrphansSummary["failures"] = [];

  if (options.apply) {
    const current = await discover(dependencies, options, account, now);
    const currentOriginals = new Map(
      current.orphanOriginalObjects
        .filter((object) => object.eligibleForDeletion)
        .map((object) => [object.key, object])
    );
    const currentDerived = new Map(
      current.orphanDerivedObjects
        .filter((object) => object.eligibleForDeletion)
        .map((object) => [object.key, object])
    );
    const safeOriginals = inventory.orphanOriginalObjects.filter((object) => {
      const candidate = currentOriginals.get(object.key);
      return object.eligibleForDeletion && Boolean(candidate && metadataMatches(object, candidate));
    });
    const safeDerived = inventory.orphanDerivedObjects.filter((object) => {
      const candidate = currentDerived.get(object.key);
      return object.eligibleForDeletion && Boolean(candidate && metadataMatches(object, candidate));
    });
    actions.skippedAfterSafetyRecheck =
      inventory.orphanOriginalObjects.filter((object) => object.eligibleForDeletion).length -
      safeOriginals.length +
      inventory.orphanDerivedObjects.filter((object) => object.eligibleForDeletion).length -
      safeDerived.length;
    const originalDeletion = await deleteObjects(
      dependencies.db,
      dependencies.s3,
      options.tableName,
      options.originalsBucketName,
      account,
      safeOriginals,
      "original",
      failures
    );
    const derivedDeletion = await deleteObjects(
      dependencies.db,
      dependencies.s3,
      options.tableName,
      options.derivedBucketName,
      account,
      safeDerived,
      "derived",
      failures
    );
    actions.originalObjectsDeleted = originalDeletion.deleted;
    actions.derivedObjectsDeleted = derivedDeletion.deleted;
    actions.skippedAfterSafetyRecheck += originalDeletion.skipped + derivedDeletion.skipped;
  }

  return {
    schemaVersion: "media-orphan-reconciliation/v1",
    mode: options.apply ? "apply" : "dry-run",
    stage: options.stage,
    tableName: options.tableName,
    originalsBucketName: options.originalsBucketName,
    derivedBucketName: options.derivedBucketName,
    account,
    olderThanDays: options.olderThanDays,
    ...inventory,
    actions,
    failures,
  };
}

function printHelp(): void {
  console.error(
    [
      "Usage:",
      "  bun run --cwd infra/cdk reconcile:media-orphans",
      "  bun run --cwd infra/cdk reconcile:media-orphans -- --apply --expected-account <12 digits> [--confirm-production]",
      "",
      "Apply deletes only aged S3 objects that remain orphaned and metadata-identical after a second scan.",
      "DynamoDB findings and ambiguous S3 keys are always report-only.",
      "",
      "Options:",
      "  --stage <stage>             APP_STAGE (default: prod)",
      "  --table-name <name>         ASSETS_TABLE_NAME",
      "  --originals-bucket <name>   ASSETS_ORIGINALS_BUCKET_NAME",
      "  --derived-bucket <name>     ASSETS_DERIVED_BUCKET_NAME",
      "  --expected-account <id>     EXPECTED_AWS_ACCOUNT_ID (required with --apply)",
      "  --older-than-days <days>    MEDIA_ORPHAN_OLDER_THAN_DAYS (default: 7)",
      "  --confirm-production        required for production apply",
    ].join("\n")
  );
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(argv);
  if (options.help) {
    printHelp();
    return;
  }
  console.error(
    `Scanning ${options.tableName} and stage ${options.stage} media buckets in ${options.apply ? "apply" : "dry-run"} mode`
  );
  const summary = await reconcileMediaOrphans(
    {
      db: DynamoDBDocumentClient.from(new DynamoDBClient({})),
      dynamo: new DynamoDBClient({}),
      s3: new S3Client({}),
    },
    options
  );
  console.log(JSON.stringify(summary, null, 2));
  if (!options.apply) console.error("Dry run only. Review the JSON report before using --apply.");
  if (summary.failures.length > 0) process.exitCode = 1;
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
