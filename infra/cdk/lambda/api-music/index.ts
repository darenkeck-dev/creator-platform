import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  type TransactWriteCommandInput,
} from "@aws-sdk/lib-dynamodb";
import {
  AssetRecordSchema,
  CreateMusicReleaseInputSchema,
  CreateMusicTrackInputSchema,
  MUSIC_ADMIN_RESPONSE_SCHEMA_VERSION,
  MUSIC_RELEASE_SCHEMA_VERSION,
  MUSIC_TRACK_SCHEMA_VERSION,
  MusicDeleteResponseSchema,
  MusicDeleteInputSchema,
  MusicPublicationActionInputSchema,
  MusicReadinessResponseSchema,
  MusicReleaseListResponseSchema,
  MusicReleaseRecordSchema,
  MusicReleaseResponseSchema,
  MusicTrackListResponseSchema,
  MusicTrackRecordSchema,
  MusicTrackResponseSchema,
  UpdateMusicReleaseInputSchema,
  UpdateMusicTrackInputSchema,
  type AssetRecord,
  type MusicReadinessIssue,
  type MusicReleaseRecord,
  type MusicTrackRecord,
} from "@media-manager/contracts";
import { randomUUID } from "node:crypto";
import { z } from "zod";

type HttpEvent = {
  requestContext?: {
    routeKey?: string;
    authorizer?: { jwt?: { claims?: Record<string, string> } };
  };
  pathParameters?: { id?: string };
  body?: string | null;
};

type Result = { statusCode: number; body: string };
type MusicKind = "track" | "release";

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});
const MAX_ADMIN_RECORDS = 200;
const MAX_TRACK_REFERENCES = 100;
const MAX_COVER_REFERENCES = 100;

type TrackReferenceAggregate = {
  trackId: string;
  ownerEmail: string;
  totalReferenceCount: number;
  publishedReferenceCount: number;
};

class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly issues?: unknown
  ) {
    super(message);
  }
}

function response(statusCode: number, body: unknown): Result {
  return { statusCode, body: JSON.stringify(body) };
}

function tableName(): string {
  const value = process.env.ASSETS_TABLE_NAME;
  if (!value) throw new Error("Missing environment variable: ASSETS_TABLE_NAME");
  return value;
}

function ownerEmail(event: HttpEvent): string {
  const parsed = z.string().email().safeParse(event.requestContext?.authorizer?.jwt?.claims?.email);
  if (!parsed.success) throw new ApiError(403, "Forbidden");
  return parsed.data;
}

function idFrom(event: HttpEvent): string {
  const parsed = z.string().uuid().safeParse(event.pathParameters?.id);
  if (!parsed.success) throw new ApiError(400, "Invalid music id");
  return parsed.data;
}

function bodyFrom(event: HttpEvent): unknown {
  try {
    return event.body ? JSON.parse(event.body) : {};
  } catch {
    throw new ApiError(400, "Invalid JSON body");
  }
}

function cleanItem(item: Record<string, unknown>): Record<string, unknown> {
  const { pk: _pk, sk: _sk, ...record } = item;
  return record;
}

function parseTrack(item: Record<string, unknown>): MusicTrackRecord {
  return MusicTrackRecordSchema.parse(cleanItem(item));
}

function parseRelease(item: Record<string, unknown>): MusicReleaseRecord {
  return MusicReleaseRecordSchema.parse(cleanItem(item));
}

function musicKey(kind: MusicKind, id: string) {
  return { pk: "MUSIC", sk: `${kind === "track" ? "TRACK" : "RELEASE"}#${id}` };
}

function trackReverseKey(assetId: string) {
  return { pk: `ASSET#${assetId}`, sk: "MUSIC_TRACK" };
}

function coverReverseKey(assetId: string, releaseId: string) {
  return { pk: `ASSET#${assetId}`, sk: `MUSIC_RELEASE#${releaseId}` };
}

function trackReleaseKey(trackId: string, releaseId: string) {
  return { pk: `MUSIC_TRACK#${trackId}`, sk: `RELEASE#${releaseId}` };
}

function trackReferenceAggregateKey(trackId: string) {
  return { pk: `MUSIC_TRACK#${trackId}`, sk: "REFERENCE_AGGREGATE" };
}

function catalogAggregateKey() {
  return { pk: "MUSIC_CATALOG", sk: "CATALOG_AGGREGATE" };
}

async function getTrack(id: string): Promise<MusicTrackRecord | null> {
  const result = await db.send(
    new GetCommand({
      TableName: tableName(),
      Key: musicKey("track", id),
      ConsistentRead: true,
    })
  );
  return result.Item ? parseTrack(result.Item) : null;
}

async function getRelease(id: string): Promise<MusicReleaseRecord | null> {
  const result = await db.send(
    new GetCommand({
      TableName: tableName(),
      Key: musicKey("release", id),
      ConsistentRead: true,
    })
  );
  return result.Item ? parseRelease(result.Item) : null;
}

async function getAsset(id: string): Promise<AssetRecord | null> {
  const result = await db.send(
    new GetCommand({
      TableName: tableName(),
      Key: { pk: `ASSET#${id}`, sk: "META" },
      ConsistentRead: true,
    })
  );
  return result.Item ? AssetRecordSchema.parse(result.Item) : null;
}

async function getTrackReferenceAggregate(
  trackId: string,
  owner: string
): Promise<TrackReferenceAggregate> {
  const result = await db.send(
    new GetCommand({
      TableName: tableName(),
      Key: trackReferenceAggregateKey(trackId),
      ConsistentRead: true,
    })
  );
  const item = result.Item;
  if (
    !item ||
    item.trackId !== trackId ||
    item.ownerEmail !== owner ||
    !Number.isInteger(item.totalReferenceCount) ||
    !Number.isInteger(item.publishedReferenceCount)
  ) {
    throw new ApiError(409, "Track reference aggregate is unavailable");
  }
  return {
    trackId,
    ownerEmail: owner,
    totalReferenceCount: item.totalReferenceCount as number,
    publishedReferenceCount: item.publishedReferenceCount as number,
  };
}

function requireOwner<T extends { ownerEmail: string }>(record: T | null, owner: string): T {
  if (!record) throw new ApiError(404, "Music record not found");
  if (record.ownerEmail !== owner) throw new ApiError(403, "Forbidden");
  return record;
}

async function requireAsset(
  id: string,
  type: "audio" | "image",
  owner: string
): Promise<AssetRecord> {
  const asset = await getAsset(id);
  if (!asset) throw new ApiError(400, `Referenced ${type} asset not found`);
  if (asset.ownerEmail !== owner)
    throw new ApiError(403, "Forbidden: asset belongs to another owner");
  if (asset.type !== type) throw new ApiError(400, `Referenced asset must be ${type}`);
  return asset;
}

async function requireTracks(ids: string[], owner: string): Promise<MusicTrackRecord[]> {
  const tracks: MusicTrackRecord[] = [];
  for (const id of ids) {
    const track = await getTrack(id);
    if (!track) throw new ApiError(400, `Referenced track not found: ${id}`);
    if (track.ownerEmail !== owner)
      throw new ApiError(403, "Forbidden: track belongs to another owner");
    tracks.push(track);
  }
  return tracks;
}

async function transact(items: NonNullable<TransactWriteCommandInput["TransactItems"]>) {
  try {
    await db.send(new TransactWriteCommand({ TransactItems: items }));
  } catch (error) {
    if (
      error instanceof Error &&
      ["ConditionalCheckFailedException", "TransactionCanceledException"].includes(error.name)
    ) {
      throw new ApiError(409, "Music catalog conflict");
    }
    throw error;
  }
}

function trackPut(
  track: MusicTrackRecord,
  expected?: { revision: number; status: "draft" | "published" }
) {
  return {
    Put: {
      TableName: tableName(),
      Item: { ...musicKey("track", track.id), ...track },
      ...(expected
        ? {
            ConditionExpression:
              "revision = :expectedRevision AND publicationStatus = :expectedStatus AND ownerEmail = :ownerEmail",
            ExpressionAttributeValues: {
              ":expectedRevision": expected.revision,
              ":expectedStatus": expected.status,
              ":ownerEmail": track.ownerEmail,
            },
          }
        : {}),
    },
  };
}

function releasePut(
  release: MusicReleaseRecord,
  expected?: { revision: number; status: "draft" | "published" }
) {
  return {
    Put: {
      TableName: tableName(),
      Item: { ...musicKey("release", release.id), ...release },
      ...(expected
        ? {
            ConditionExpression:
              "revision = :expectedRevision AND publicationStatus = :expectedStatus AND ownerEmail = :ownerEmail",
            ExpressionAttributeValues: {
              ":expectedRevision": expected.revision,
              ":expectedStatus": expected.status,
              ":ownerEmail": release.ownerEmail,
            },
          }
        : {}),
    },
  };
}

function assetLinkCountUpdate(asset: AssetRecord, type: "audio" | "image", delta: 1 | -1) {
  return {
    Update: {
      TableName: tableName(),
      Key: { pk: `ASSET#${asset.id}`, sk: "META" },
      UpdateExpression: "ADD officialMusicLinkCount :delta",
      ConditionExpression:
        "attribute_exists(pk) AND attribute_not_exists(officialMusicDeletionLock) AND ownerEmail = :ownerEmail AND #type = :type AND updatedAt = :updatedAt" +
        (delta < 0 ? " AND officialMusicLinkCount >= :one" : "") +
        (delta > 0 && type === "image"
          ? " AND (attribute_not_exists(officialMusicLinkCount) OR officialMusicLinkCount < :maxReferences)"
          : ""),
      ExpressionAttributeNames: { "#type": "type" },
      ExpressionAttributeValues: {
        ":delta": delta,
        ":ownerEmail": asset.ownerEmail,
        ":type": type,
        ":updatedAt": asset.updatedAt,
        ...(delta < 0 ? { ":one": 1 } : {}),
        ...(delta > 0 && type === "image" ? { ":maxReferences": MAX_COVER_REFERENCES } : {}),
      },
    },
  };
}

function catalogCountUpdate(kind: MusicKind, delta: 1 | -1) {
  return {
    Update: {
      TableName: tableName(),
      Key: catalogAggregateKey(),
      UpdateExpression: `ADD totalRecordCount :delta, ${kind}Count :delta`,
      ConditionExpression:
        delta > 0
          ? "attribute_not_exists(totalRecordCount) OR totalRecordCount < :maxRecords"
          : "totalRecordCount >= :one AND #kindCount >= :one",
      ExpressionAttributeNames: delta < 0 ? { "#kindCount": `${kind}Count` } : undefined,
      ExpressionAttributeValues: {
        ":delta": delta,
        ...(delta > 0 ? { ":maxRecords": MAX_ADMIN_RECORDS } : { ":one": 1 }),
      },
    },
  };
}

function trackReferenceCountUpdate(
  aggregate: TrackReferenceAggregate,
  changes: { total: 1 | -1 | 0; published: 1 | -1 | 0 }
) {
  const additions: string[] = [];
  const values: Record<string, unknown> = {
    ":expectedTotal": aggregate.totalReferenceCount,
    ":expectedPublished": aggregate.publishedReferenceCount,
    ":ownerEmail": aggregate.ownerEmail,
  };
  if (changes.total !== 0) {
    additions.push("totalReferenceCount :totalDelta");
    values[":totalDelta"] = changes.total;
  }
  if (changes.published !== 0) {
    additions.push("publishedReferenceCount :publishedDelta");
    values[":publishedDelta"] = changes.published;
  }
  let condition =
    "ownerEmail = :ownerEmail AND totalReferenceCount = :expectedTotal AND publishedReferenceCount = :expectedPublished";
  if (changes.total > 0) {
    condition += " AND totalReferenceCount < :maxReferences";
    values[":maxReferences"] = MAX_TRACK_REFERENCES;
  }
  if (changes.total < 0) condition += " AND totalReferenceCount > publishedReferenceCount";
  if (changes.published > 0) condition += " AND publishedReferenceCount < totalReferenceCount";
  if (changes.published < 0) condition += " AND publishedReferenceCount >= :one";
  if (changes.published < 0) values[":one"] = 1;
  return {
    Update: {
      TableName: tableName(),
      Key: trackReferenceAggregateKey(aggregate.trackId),
      UpdateExpression: `ADD ${additions.join(", ")}`,
      ConditionExpression: condition,
      ExpressionAttributeValues: values,
    },
  };
}

function trackReferenceAggregateCondition(aggregate: TrackReferenceAggregate) {
  return {
    ConditionCheck: {
      TableName: tableName(),
      Key: trackReferenceAggregateKey(aggregate.trackId),
      ConditionExpression:
        "ownerEmail = :ownerEmail AND totalReferenceCount = :expectedTotal AND publishedReferenceCount = :expectedPublished",
      ExpressionAttributeValues: {
        ":ownerEmail": aggregate.ownerEmail,
        ":expectedTotal": aggregate.totalReferenceCount,
        ":expectedPublished": aggregate.publishedReferenceCount,
      },
    },
  };
}

function trackCondition(track: MusicTrackRecord) {
  return {
    ConditionCheck: {
      TableName: tableName(),
      Key: musicKey("track", track.id),
      ConditionExpression:
        "revision = :revision AND publicationStatus = :status AND ownerEmail = :ownerEmail",
      ExpressionAttributeValues: {
        ":revision": track.revision,
        ":status": track.publicationStatus,
        ":ownerEmail": track.ownerEmail,
      },
    },
  };
}

async function list(kind: MusicKind, owner: string): Promise<Result> {
  const items: Array<Record<string, unknown>> = [];
  let cursor: Record<string, unknown> | undefined;
  do {
    const page = await db.send(
      new QueryCommand({
        TableName: tableName(),
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :prefix)",
        ExpressionAttributeValues: {
          ":pk": "MUSIC",
          ":prefix": kind === "track" ? "TRACK#" : "RELEASE#",
        },
        ExclusiveStartKey: cursor,
        ConsistentRead: true,
        Limit: MAX_ADMIN_RECORDS - items.length,
      })
    );
    items.push(...(page.Items ?? []));
    if (items.length >= MAX_ADMIN_RECORDS && page.LastEvaluatedKey)
      throw new ApiError(409, "Music catalog record limit exceeded");
    cursor = page.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (cursor);
  if (kind === "track") {
    return response(
      200,
      MusicTrackListResponseSchema.parse({
        schemaVersion: MUSIC_ADMIN_RESPONSE_SCHEMA_VERSION,
        tracks: items.map(parseTrack).filter((item) => item.ownerEmail === owner),
      })
    );
  }
  return response(
    200,
    MusicReleaseListResponseSchema.parse({
      schemaVersion: MUSIC_ADMIN_RESPONSE_SCHEMA_VERSION,
      releases: items.map(parseRelease).filter((item) => item.ownerEmail === owner),
    })
  );
}

async function createTrack(event: HttpEvent, owner: string): Promise<Result> {
  const parsed = CreateMusicTrackInputSchema.safeParse(bodyFrom(event));
  if (!parsed.success) throw new ApiError(400, "Invalid request body", parsed.error.issues);
  const asset = await requireAsset(parsed.data.assetId, "audio", owner);
  const now = new Date().toISOString();
  const track = MusicTrackRecordSchema.parse({
    schemaVersion: MUSIC_TRACK_SCHEMA_VERSION,
    id: randomUUID(),
    revision: 1,
    ownerEmail: owner,
    title: parsed.data.title,
    assetId: parsed.data.assetId,
    durationSeconds: parsed.data.durationSeconds,
    purchaseLinks: parsed.data.purchaseLinks,
    publicationStatus: "draft",
    standalonePublished: false,
    createdAt: now,
    updatedAt: now,
  });
  await transact([
    {
      Put: {
        ...trackPut(track).Put,
        ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
      },
    },
    {
      Put: {
        TableName: tableName(),
        Item: {
          ...trackReverseKey(track.assetId),
          trackId: track.id,
          ownerEmail: owner,
          publicationStatus: "draft",
        },
        ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
      },
    },
    assetLinkCountUpdate(asset, "audio", 1),
    {
      Put: {
        TableName: tableName(),
        Item: {
          ...trackReferenceAggregateKey(track.id),
          trackId: track.id,
          ownerEmail: owner,
          totalReferenceCount: 0,
          publishedReferenceCount: 0,
        },
        ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
      },
    },
    catalogCountUpdate("track", 1),
  ]);
  return response(
    201,
    MusicTrackResponseSchema.parse({ schemaVersion: MUSIC_ADMIN_RESPONSE_SCHEMA_VERSION, track })
  );
}

async function createRelease(event: HttpEvent, owner: string): Promise<Result> {
  const parsed = CreateMusicReleaseInputSchema.safeParse(bodyFrom(event));
  if (!parsed.success) throw new ApiError(400, "Invalid request body", parsed.error.issues);
  const cover = parsed.data.coverAssetId
    ? await requireAsset(parsed.data.coverAssetId, "image", owner)
    : null;
  const tracks = await requireTracks(parsed.data.trackIds, owner);
  const aggregates = await Promise.all(
    tracks.map((track) => getTrackReferenceAggregate(track.id, owner))
  );
  const now = new Date().toISOString();
  const release = MusicReleaseRecordSchema.parse({
    id: randomUUID(),
    revision: 1,
    ownerEmail: owner,
    ...parsed.data,
    schemaVersion: MUSIC_RELEASE_SCHEMA_VERSION,
    publicationStatus: "draft",
    createdAt: now,
    updatedAt: now,
  });
  const items: NonNullable<TransactWriteCommandInput["TransactItems"]> = [
    {
      Put: {
        ...releasePut(release).Put,
        ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
      },
    },
    catalogCountUpdate("release", 1),
  ];
  if (release.coverAssetId) {
    items.push({
      Put: {
        TableName: tableName(),
        Item: {
          ...coverReverseKey(release.coverAssetId, release.id),
          releaseId: release.id,
          ownerEmail: owner,
          publicationStatus: "draft",
        },
        ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
      },
    });
    items.push(assetLinkCountUpdate(cover!, "image", 1));
  }
  for (const [index, track] of tracks.entries()) {
    items.push({
      Put: {
        TableName: tableName(),
        Item: {
          ...trackReleaseKey(track.id, release.id),
          releaseId: release.id,
          ownerEmail: owner,
          publicationStatus: "draft",
        },
        ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
      },
    });
    items.push(trackReferenceCountUpdate(aggregates[index]!, { total: 1, published: 0 }));
  }
  await transact(items);
  return response(
    201,
    MusicReleaseResponseSchema.parse({
      schemaVersion: MUSIC_ADMIN_RESPONSE_SCHEMA_VERSION,
      release,
    })
  );
}

async function detail(kind: MusicKind, id: string, owner: string): Promise<Result> {
  if (kind === "track") {
    const track = requireOwner(await getTrack(id), owner);
    return response(
      200,
      MusicTrackResponseSchema.parse({ schemaVersion: MUSIC_ADMIN_RESPONSE_SCHEMA_VERSION, track })
    );
  }
  const release = requireOwner(await getRelease(id), owner);
  return response(
    200,
    MusicReleaseResponseSchema.parse({
      schemaVersion: MUSIC_ADMIN_RESPONSE_SCHEMA_VERSION,
      release,
    })
  );
}

async function updateTrack(event: HttpEvent, id: string, owner: string): Promise<Result> {
  const parsed = UpdateMusicTrackInputSchema.safeParse(bodyFrom(event));
  if (!parsed.success) throw new ApiError(400, "Invalid request body", parsed.error.issues);
  const current = requireOwner(await getTrack(id), owner);
  if (current.publicationStatus !== "draft")
    throw new ApiError(409, "Published tracks cannot be edited");
  if (parsed.data.expectedRevision !== current.revision)
    throw new ApiError(409, "Music catalog conflict");
  const {
    schemaVersion: _schemaVersion,
    expectedRevision: _expectedRevision,
    ...updates
  } = parsed.data;
  const track = MusicTrackRecordSchema.parse({
    ...current,
    ...updates,
    revision: current.revision + 1,
    durationSeconds:
      updates.durationSeconds === null
        ? undefined
        : (updates.durationSeconds ?? current.durationSeconds),
    updatedAt: new Date().toISOString(),
  });
  await transact([trackPut(track, { revision: current.revision, status: "draft" })]);
  return response(
    200,
    MusicTrackResponseSchema.parse({ schemaVersion: MUSIC_ADMIN_RESPONSE_SCHEMA_VERSION, track })
  );
}

async function updateRelease(event: HttpEvent, id: string, owner: string): Promise<Result> {
  const parsed = UpdateMusicReleaseInputSchema.safeParse(bodyFrom(event));
  if (!parsed.success) throw new ApiError(400, "Invalid request body", parsed.error.issues);
  const current = requireOwner(await getRelease(id), owner);
  if (current.publicationStatus !== "draft")
    throw new ApiError(409, "Published releases cannot be edited");
  if (parsed.data.expectedRevision !== current.revision)
    throw new ApiError(409, "Music catalog conflict");
  const coverChanging =
    parsed.data.coverAssetId !== undefined &&
    current.coverAssetId !== (parsed.data.coverAssetId ?? undefined);
  const nextCover = parsed.data.coverAssetId
    ? await requireAsset(parsed.data.coverAssetId, "image", owner)
    : null;
  const nextTracks = parsed.data.trackIds
    ? await requireTracks(parsed.data.trackIds, owner)
    : await requireTracks(current.trackIds, owner);
  const previousCover =
    current.coverAssetId && coverChanging
      ? await requireAsset(current.coverAssetId, "image", owner)
      : null;
  const {
    schemaVersion: _schemaVersion,
    expectedRevision: _expectedRevision,
    ...updates
  } = parsed.data;
  const nullableKeys = ["releaseDate", "type", "coverAssetId", "coverAlt", "description"] as const;
  const next: Record<string, unknown> = {
    ...current,
    ...updates,
    revision: current.revision + 1,
    updatedAt: new Date().toISOString(),
  };
  for (const key of nullableKeys) if (updates[key] === null) delete next[key];
  const release = MusicReleaseRecordSchema.parse(next);
  const oldTracks = new Set(current.trackIds);
  const newTracks = new Set(release.trackIds);
  const removedTrackIds = current.trackIds.filter((trackId) => !newTracks.has(trackId));
  const addedTrackIds = release.trackIds.filter((trackId) => !oldTracks.has(trackId));
  const changedAggregates = new Map(
    await Promise.all(
      [...removedTrackIds, ...addedTrackIds].map(
        async (trackId) => [trackId, await getTrackReferenceAggregate(trackId, owner)] as const
      )
    )
  );
  const items: NonNullable<TransactWriteCommandInput["TransactItems"]> = [
    releasePut(release, { revision: current.revision, status: "draft" }),
  ];
  if (current.coverAssetId && current.coverAssetId !== release.coverAssetId) {
    items.push({
      Delete: {
        TableName: tableName(),
        Key: coverReverseKey(current.coverAssetId, id),
        ConditionExpression: "releaseId = :releaseId AND publicationStatus = :draft",
        ExpressionAttributeValues: { ":releaseId": id, ":draft": "draft" },
      },
    });
    items.push(assetLinkCountUpdate(previousCover!, "image", -1));
  }
  if (release.coverAssetId && release.coverAssetId !== current.coverAssetId) {
    items.push({
      Put: {
        TableName: tableName(),
        Item: {
          ...coverReverseKey(release.coverAssetId, id),
          releaseId: id,
          ownerEmail: owner,
          publicationStatus: "draft",
        },
        ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
      },
    });
    items.push(assetLinkCountUpdate(nextCover!, "image", 1));
  }
  for (const trackId of removedTrackIds) {
    items.push({
      Delete: {
        TableName: tableName(),
        Key: trackReleaseKey(trackId, id),
        ConditionExpression: "releaseId = :releaseId AND publicationStatus = :draft",
        ExpressionAttributeValues: { ":releaseId": id, ":draft": "draft" },
      },
    });
    items.push(
      trackReferenceCountUpdate(changedAggregates.get(trackId)!, { total: -1, published: 0 })
    );
  }
  for (const trackId of addedTrackIds) {
    items.push({
      Put: {
        TableName: tableName(),
        Item: {
          ...trackReleaseKey(trackId, id),
          releaseId: id,
          ownerEmail: owner,
          publicationStatus: "draft",
        },
        ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
      },
    });
    items.push(
      trackReferenceCountUpdate(changedAggregates.get(trackId)!, { total: 1, published: 0 })
    );
  }
  await transact(items);
  return response(
    200,
    MusicReleaseResponseSchema.parse({
      schemaVersion: MUSIC_ADMIN_RESPONSE_SCHEMA_VERSION,
      release,
    })
  );
}

async function remove(
  event: HttpEvent,
  kind: MusicKind,
  id: string,
  owner: string
): Promise<Result> {
  const parsed = MusicDeleteInputSchema.safeParse(bodyFrom(event));
  if (!parsed.success) throw new ApiError(400, "Invalid request body", parsed.error.issues);
  const expectedRevision = parsed.data.expectedRevision;
  const items: NonNullable<TransactWriteCommandInput["TransactItems"]> = [];
  if (kind === "track") {
    const track = requireOwner(await getTrack(id), owner);
    if (track.revision !== expectedRevision) throw new ApiError(409, "Music catalog conflict");
    if (track.publicationStatus !== "draft")
      throw new ApiError(409, "Only draft tracks can be deleted");
    const asset = await requireAsset(track.assetId, "audio", owner);
    items.push({
      Delete: {
        TableName: tableName(),
        Key: musicKey("track", id),
        ConditionExpression:
          "revision = :revision AND publicationStatus = :draft AND ownerEmail = :ownerEmail",
        ExpressionAttributeValues: {
          ":revision": expectedRevision,
          ":draft": "draft",
          ":ownerEmail": owner,
        },
      },
    });
    items.push({
      Delete: {
        TableName: tableName(),
        Key: trackReverseKey(track.assetId),
        ConditionExpression: "trackId = :trackId",
        ExpressionAttributeValues: { ":trackId": id },
      },
    });
    items.push({
      Delete: {
        TableName: tableName(),
        Key: trackReferenceAggregateKey(id),
        ConditionExpression:
          "ownerEmail = :ownerEmail AND totalReferenceCount = :zero AND publishedReferenceCount = :zero",
        ExpressionAttributeValues: { ":ownerEmail": owner, ":zero": 0 },
      },
    });
    items.push(assetLinkCountUpdate(asset, "audio", -1));
    items.push(catalogCountUpdate("track", -1));
  } else {
    const release = requireOwner(await getRelease(id), owner);
    if (release.revision !== expectedRevision) throw new ApiError(409, "Music catalog conflict");
    if (release.publicationStatus !== "draft")
      throw new ApiError(409, "Only draft releases can be deleted");
    const aggregates = new Map(
      await Promise.all(
        release.trackIds.map(
          async (trackId) => [trackId, await getTrackReferenceAggregate(trackId, owner)] as const
        )
      )
    );
    items.push({
      Delete: {
        TableName: tableName(),
        Key: musicKey("release", id),
        ConditionExpression:
          "revision = :revision AND publicationStatus = :draft AND ownerEmail = :ownerEmail",
        ExpressionAttributeValues: {
          ":revision": expectedRevision,
          ":draft": "draft",
          ":ownerEmail": owner,
        },
      },
    });
    if (release.coverAssetId) {
      const cover = await requireAsset(release.coverAssetId, "image", owner);
      items.push({
        Delete: {
          TableName: tableName(),
          Key: coverReverseKey(release.coverAssetId, id),
          ConditionExpression: "releaseId = :releaseId AND publicationStatus = :draft",
          ExpressionAttributeValues: { ":releaseId": id, ":draft": "draft" },
        },
      });
      items.push(assetLinkCountUpdate(cover, "image", -1));
    }
    for (const trackId of release.trackIds) {
      items.push({
        Delete: {
          TableName: tableName(),
          Key: trackReleaseKey(trackId, id),
          ConditionExpression: "releaseId = :releaseId AND publicationStatus = :draft",
          ExpressionAttributeValues: { ":releaseId": id, ":draft": "draft" },
        },
      });
      items.push(trackReferenceCountUpdate(aggregates.get(trackId)!, { total: -1, published: 0 }));
    }
    items.push(catalogCountUpdate("release", -1));
  }
  await transact(items);
  return response(
    200,
    MusicDeleteResponseSchema.parse({
      schemaVersion: MUSIC_ADMIN_RESPONSE_SCHEMA_VERSION,
      id,
      deleted: true,
    })
  );
}

function assetReadiness(
  asset: AssetRecord,
  type: "audio" | "image",
  entityId: string
): MusicReadinessIssue[] {
  const issues: MusicReadinessIssue[] = [];
  if (asset.type !== type)
    issues.push({
      code: `asset_not_${type}`,
      entityType: "asset",
      entityId: asset.id,
      message: `Asset must be ${type}`,
    });
  if (asset.status !== "ready")
    issues.push({
      code: "asset_not_ready",
      entityType: "asset",
      entityId: asset.id,
      message: "Asset is not ready",
    });
  if (type === "audio" && !asset.stream?.hlsMasterUrl)
    issues.push({
      code: "audio_hls_missing",
      entityType: "asset",
      entityId: asset.id,
      message: "Audio HLS is unavailable",
    });
  if (asset.ownerEmail.length === 0)
    issues.push({
      code: "asset_owner_missing",
      entityType: "asset",
      entityId,
      message: "Asset owner is missing",
    });
  return issues;
}

async function readiness(
  kind: MusicKind,
  id: string,
  owner: string
): Promise<{
  result: Result;
  issues: MusicReadinessIssue[];
  track?: MusicTrackRecord;
  release?: MusicReleaseRecord;
  tracks?: MusicTrackRecord[];
  assets?: AssetRecord[];
}> {
  const issues: MusicReadinessIssue[] = [];
  if (kind === "track") {
    const track = requireOwner(await getTrack(id), owner);
    const asset = await getAsset(track.assetId);
    if (!track.purchaseLinks.length)
      issues.push({
        code: "track_purchase_links_empty",
        entityType: "track",
        entityId: id,
        message: "Track requires a purchase link",
      });
    if (!asset)
      issues.push({
        code: "audio_asset_missing",
        entityType: "asset",
        entityId: track.assetId,
        message: "Audio asset is missing",
      });
    else if (asset.ownerEmail !== owner)
      issues.push({
        code: "asset_owner_mismatch",
        entityType: "asset",
        entityId: asset.id,
        message: "Audio asset owner does not match",
      });
    else issues.push(...assetReadiness(asset, "audio", id));
    return {
      result: response(
        200,
        MusicReadinessResponseSchema.parse({
          schemaVersion: "music-readiness-response/v1",
          ready: issues.length === 0,
          issues,
        })
      ),
      issues,
      track,
      assets: asset ? [asset] : [],
    };
  }
  const release = requireOwner(await getRelease(id), owner);
  if (!release.releaseDate)
    issues.push({
      code: "release_date_missing",
      entityType: "release",
      entityId: id,
      message: "Release date is required",
    });
  if (!release.type)
    issues.push({
      code: "release_type_missing",
      entityType: "release",
      entityId: id,
      message: "Release type is required",
    });
  if (!release.coverAssetId)
    issues.push({
      code: "cover_missing",
      entityType: "release",
      entityId: id,
      message: "Cover asset is required",
    });
  if (!release.coverAlt)
    issues.push({
      code: "cover_alt_missing",
      entityType: "release",
      entityId: id,
      message: "Cover alt text is required",
    });
  if (!release.trackIds.length)
    issues.push({
      code: "release_tracks_empty",
      entityType: "release",
      entityId: id,
      message: "Release requires at least one track",
    });
  if (!release.purchaseLinks.length)
    issues.push({
      code: "release_purchase_links_empty",
      entityType: "release",
      entityId: id,
      message: "Release requires a purchase link",
    });
  const tracks = await requireTracks(release.trackIds, owner);
  const assets: AssetRecord[] = [];
  if (release.coverAssetId) {
    const cover = await getAsset(release.coverAssetId);
    if (!cover)
      issues.push({
        code: "cover_asset_missing",
        entityType: "asset",
        entityId: release.coverAssetId,
        message: "Cover asset is missing",
      });
    else if (cover.ownerEmail !== owner)
      issues.push({
        code: "asset_owner_mismatch",
        entityType: "asset",
        entityId: cover.id,
        message: "Cover asset owner does not match",
      });
    else {
      assets.push(cover);
      issues.push(...assetReadiness(cover, "image", id));
    }
  }
  for (const track of tracks) {
    if (!track.purchaseLinks.length)
      issues.push({
        code: "track_purchase_links_empty",
        entityType: "track",
        entityId: track.id,
        message: "Track requires a purchase link",
      });
    const audio = await getAsset(track.assetId);
    if (!audio)
      issues.push({
        code: "audio_asset_missing",
        entityType: "asset",
        entityId: track.assetId,
        message: "Audio asset is missing",
      });
    else if (audio.ownerEmail !== owner)
      issues.push({
        code: "asset_owner_mismatch",
        entityType: "asset",
        entityId: audio.id,
        message: "Audio asset owner does not match",
      });
    else {
      assets.push(audio);
      issues.push(...assetReadiness(audio, "audio", track.id));
    }
  }
  return {
    result: response(
      200,
      MusicReadinessResponseSchema.parse({
        schemaVersion: "music-readiness-response/v1",
        ready: issues.length === 0,
        issues,
      })
    ),
    issues,
    release,
    tracks,
    assets,
  };
}

function publicationAssetUpdate(asset: AssetRecord, type: "audio" | "image", delta: 1 | -1) {
  const publishing = delta > 0;
  return {
    Update: {
      TableName: tableName(),
      Key: { pk: `ASSET#${asset.id}`, sk: "META" },
      UpdateExpression: publishing
        ? "SET visibility = :public, updatedAt = :updatedAt ADD publishedMusicLinkCount :delta"
        : "SET updatedAt = :updatedAt ADD publishedMusicLinkCount :delta",
      ConditionExpression:
        "attribute_exists(pk) AND attribute_not_exists(officialMusicDeletionLock) AND ownerEmail = :ownerEmail AND #type = :type AND updatedAt = :assetUpdatedAt" +
        (publishing ? " AND #status = :ready" : "") +
        (publishing && type === "audio" ? " AND attribute_exists(#stream.#hls)" : "") +
        (publishing ? "" : " AND publishedMusicLinkCount >= :one"),
      ExpressionAttributeNames: {
        "#type": "type",
        ...(publishing ? { "#status": "status" } : {}),
        ...(publishing && type === "audio" ? { "#stream": "stream", "#hls": "hlsMasterUrl" } : {}),
      },
      ExpressionAttributeValues: {
        ":delta": delta,
        ":updatedAt": new Date().toISOString(),
        ":assetUpdatedAt": asset.updatedAt,
        ":ownerEmail": asset.ownerEmail,
        ":type": type,
        ...(publishing ? { ":public": "public", ":ready": "ready" } : { ":one": 1 }),
      },
    },
  };
}

function publicationAction(event: HttpEvent) {
  const parsed = MusicPublicationActionInputSchema.safeParse(bodyFrom(event));
  if (!parsed.success) throw new ApiError(400, "Invalid request body", parsed.error.issues);
  return parsed.data;
}

async function publish(
  event: HttpEvent,
  kind: MusicKind,
  id: string,
  owner: string
): Promise<Result> {
  const action = publicationAction(event);
  const checked = await readiness(kind, id, owner);
  if (checked.issues.length)
    throw new ApiError(409, "Music record is not ready to publish", checked.issues);
  const now = new Date().toISOString();
  if (kind === "track") {
    const current = checked.track!;
    const aggregate = await getTrackReferenceAggregate(id, owner);
    if (action.expectedRevision !== current.revision)
      throw new ApiError(409, "Music catalog conflict");
    if (current.standalonePublished)
      throw new ApiError(409, "Track is already published standalone");
    const track = MusicTrackRecordSchema.parse({
      ...current,
      revision: current.revision + 1,
      publicationStatus: "published",
      standalonePublished: true,
      updatedAt: now,
    });
    const items: NonNullable<TransactWriteCommandInput["TransactItems"]> = [
      trackPut(track, { revision: current.revision, status: current.publicationStatus }),
      trackReferenceAggregateCondition(aggregate),
    ];
    if (current.publicationStatus === "draft") {
      items.push(publicationAssetUpdate(checked.assets![0]!, "audio", 1));
      items.push({
        Update: {
          TableName: tableName(),
          Key: trackReverseKey(track.assetId),
          UpdateExpression: "SET publicationStatus = :published",
          ConditionExpression: "trackId = :trackId AND publicationStatus = :draft",
          ExpressionAttributeValues: {
            ":published": "published",
            ":draft": "draft",
            ":trackId": id,
          },
        },
      });
    }
    await transact(items);
    return response(
      200,
      MusicTrackResponseSchema.parse({ schemaVersion: MUSIC_ADMIN_RESPONSE_SCHEMA_VERSION, track })
    );
  }
  const currentRelease = checked.release!;
  if (action.expectedRevision !== currentRelease.revision)
    throw new ApiError(409, "Music catalog conflict");
  if (currentRelease.publicationStatus !== "draft")
    throw new ApiError(409, "Release is already published");
  const release = MusicReleaseRecordSchema.parse({
    ...currentRelease,
    revision: currentRelease.revision + 1,
    publicationStatus: "published",
    updatedAt: now,
  });
  const assets = new Map((checked.assets ?? []).map((asset) => [asset.id, asset]));
  const aggregates = new Map(
    await Promise.all(
      checked.tracks!.map(
        async (track) => [track.id, await getTrackReferenceAggregate(track.id, owner)] as const
      )
    )
  );
  const items: NonNullable<TransactWriteCommandInput["TransactItems"]> = [
    releasePut(release, { revision: currentRelease.revision, status: "draft" }),
    publicationAssetUpdate(assets.get(release.coverAssetId!)!, "image", 1),
  ];
  for (const track of checked.tracks!) {
    if (track.publicationStatus === "draft") {
      const publishedTrack = MusicTrackRecordSchema.parse({
        ...track,
        revision: track.revision + 1,
        publicationStatus: "published",
        updatedAt: now,
      });
      items.push(
        trackPut(publishedTrack, { revision: track.revision, status: "draft" }),
        publicationAssetUpdate(assets.get(track.assetId)!, "audio", 1)
      );
    } else {
      items.push(trackCondition(track));
    }
    items.push(trackReferenceCountUpdate(aggregates.get(track.id)!, { total: 0, published: 1 }));
  }
  await transact(items);
  return response(
    200,
    MusicReleaseResponseSchema.parse({
      schemaVersion: MUSIC_ADMIN_RESPONSE_SCHEMA_VERSION,
      release,
    })
  );
}

async function unpublish(
  event: HttpEvent,
  kind: MusicKind,
  id: string,
  owner: string
): Promise<Result> {
  const action = publicationAction(event);
  const now = new Date().toISOString();
  if (kind === "track") {
    const current = requireOwner(await getTrack(id), owner);
    if (action.expectedRevision !== current.revision)
      throw new ApiError(409, "Music catalog conflict");
    if (!current.standalonePublished) throw new ApiError(409, "Track is not published standalone");
    const aggregate = await getTrackReferenceAggregate(id, owner);
    const requiredByRelease = aggregate.publishedReferenceCount > 0;
    const track = MusicTrackRecordSchema.parse({
      ...current,
      revision: current.revision + 1,
      publicationStatus: requiredByRelease ? "published" : "draft",
      standalonePublished: false,
      updatedAt: now,
    });
    const items: NonNullable<TransactWriteCommandInput["TransactItems"]> = [
      trackPut(track, { revision: current.revision, status: "published" }),
      trackReferenceAggregateCondition(aggregate),
    ];
    if (!requiredByRelease) {
      const asset = await requireAsset(track.assetId, "audio", owner);
      items.push(publicationAssetUpdate(asset, "audio", -1));
      items.push({
        Update: {
          TableName: tableName(),
          Key: trackReverseKey(track.assetId),
          UpdateExpression: "SET publicationStatus = :draft",
          ConditionExpression: "trackId = :trackId AND publicationStatus = :published",
          ExpressionAttributeValues: {
            ":draft": "draft",
            ":published": "published",
            ":trackId": id,
          },
        },
      });
    }
    await transact(items);
    return response(
      200,
      MusicTrackResponseSchema.parse({ schemaVersion: MUSIC_ADMIN_RESPONSE_SCHEMA_VERSION, track })
    );
  }
  const current = requireOwner(await getRelease(id), owner);
  if (action.expectedRevision !== current.revision)
    throw new ApiError(409, "Music catalog conflict");
  if (current.publicationStatus !== "published")
    throw new ApiError(409, "Release is not published");
  const tracks = await requireTracks(current.trackIds, owner);
  const trackStates = await Promise.all(
    tracks.map(async (track) => {
      const aggregate = await getTrackReferenceAggregate(track.id, owner);
      return {
        track,
        aggregate,
        retainPublished: track.standalonePublished || aggregate.publishedReferenceCount > 1,
      };
    })
  );
  const release = MusicReleaseRecordSchema.parse({
    ...current,
    revision: current.revision + 1,
    publicationStatus: "draft",
    updatedAt: now,
  });
  const items: NonNullable<TransactWriteCommandInput["TransactItems"]> = [
    releasePut(release, { revision: current.revision, status: "published" }),
  ];
  if (release.coverAssetId) {
    const cover = await requireAsset(release.coverAssetId, "image", owner);
    items.push(publicationAssetUpdate(cover, "image", -1));
  }
  for (const { track, aggregate, retainPublished } of trackStates) {
    if (retainPublished) {
      items.push(trackCondition(track));
    } else {
      const audio = await requireAsset(track.assetId, "audio", owner);
      const draftTrack = MusicTrackRecordSchema.parse({
        ...track,
        revision: track.revision + 1,
        publicationStatus: "draft",
        updatedAt: now,
      });
      items.push(
        trackPut(draftTrack, { revision: track.revision, status: "published" }),
        publicationAssetUpdate(audio, "audio", -1)
      );
    }
    items.push(trackReferenceCountUpdate(aggregate, { total: 0, published: -1 }));
  }
  await transact(items);
  return response(
    200,
    MusicReleaseResponseSchema.parse({
      schemaVersion: MUSIC_ADMIN_RESPONSE_SCHEMA_VERSION,
      release,
    })
  );
}

export async function handler(event: HttpEvent): Promise<Result> {
  try {
    const route = event.requestContext?.routeKey ?? "";
    const owner = ownerEmail(event);
    if (route === "GET /music/tracks") return await list("track", owner);
    if (route === "POST /music/tracks") return await createTrack(event, owner);
    if (route === "GET /music/releases") return await list("release", owner);
    if (route === "POST /music/releases") return await createRelease(event, owner);
    const kind: MusicKind | null = route.includes("/music/tracks/")
      ? "track"
      : route.includes("/music/releases/")
        ? "release"
        : null;
    if (!kind) return response(405, { message: "Method not allowed" });
    const id = idFrom(event);
    if (route.endsWith("/readiness")) return (await readiness(kind, id, owner)).result;
    if (route.endsWith("/publish")) return await publish(event, kind, id, owner);
    if (route.endsWith("/unpublish")) return await unpublish(event, kind, id, owner);
    if (route.startsWith("GET ")) return await detail(kind, id, owner);
    if (route.startsWith("PATCH "))
      return kind === "track"
        ? await updateTrack(event, id, owner)
        : await updateRelease(event, id, owner);
    if (route.startsWith("DELETE ")) return await remove(event, kind, id, owner);
    return response(405, { message: "Method not allowed" });
  } catch (error) {
    if (error instanceof ApiError)
      return response(error.statusCode, {
        message: error.message,
        ...(error.issues ? { issues: error.issues } : {}),
      });
    console.error("Music API failed", error);
    return response(500, { message: error instanceof Error ? error.message : "Unexpected error" });
  }
}
