import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  ASSET_SCHEMA_VERSION,
  AssetRecordSchema,
  ComboDeleteResponseSchema,
  ComboDetailResponseSchema,
  ComboListResponseSchema,
  ComboRecordSchema,
  ComboVoteByAssetsInputSchema,
  ComboVoteInputSchema,
  ComboVoteValueSchema,
  CreateComboInputSchema,
  PublicRandomComboResponseSchema,
  ToneReviewInputSchema,
  ToneReviewResponseSchema,
  type ComboVoteValue,
} from "@media-manager/contracts";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  readAssetRecordWithUpgrade,
  safeReadAssetRecordWithUpgrade,
} from "../shared/asset-record-versioning";

type HttpEvent = {
  requestContext?: {
    http?: {
      method?: string;
    };
    routeKey?: string;
    authorizer?: {
      jwt?: {
        claims?: Record<string, string>;
      };
    };
  };
  pathParameters?: {
    id?: string;
  };
  queryStringParameters?: Record<string, string | undefined>;
  body?: string | null;
};

type ComboRecord = z.infer<typeof ComboRecordSchema>;
type PublicRandomSource = "derived" | "existing";
type PublicRandomSelection = "primary" | "fallback";
type PublicRandomCandidate = {
  comboId: string;
  videoAssetId: string;
  audioAssetId: string;
  videoTitle: string;
  audioTitle: string;
  videoSrc: string;
  audioSrc: string;
};

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const PLAYBACK_URL_EXPIRES_IN_SECONDS = 60 * 15;

function response(statusCode: number, body: unknown): { statusCode: number; body: string } {
  return {
    statusCode,
    body: JSON.stringify(body),
  };
}

function getTableName(): string {
  const tableName = process.env.ASSETS_TABLE_NAME;
  if (!tableName) {
    throw new Error("Missing environment variable: ASSETS_TABLE_NAME");
  }

  return tableName;
}

function getCreatedAtIndex(): string {
  const indexName = process.env.ASSETS_CREATED_AT_INDEX;
  if (!indexName) {
    throw new Error("Missing environment variable: ASSETS_CREATED_AT_INDEX");
  }

  return indexName;
}

function getOriginalsBucketName(): string {
  const bucketName = process.env.ASSETS_ORIGINALS_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("Missing environment variable: ASSETS_ORIGINALS_BUCKET_NAME");
  }

  return bucketName;
}

function getOwnerEmail(event: HttpEvent): string {
  const claims = event.requestContext?.authorizer?.jwt?.claims;
  const parsed = z.string().email().safeParse(claims?.email);
  if (!parsed.success) {
    throw new Error("Unauthorized: missing email claim");
  }

  return parsed.data;
}

function parseBody(body: string | null | undefined): unknown {
  if (!body) {
    return {};
  }

  return JSON.parse(body);
}

function parseComboId(event: HttpEvent): string {
  const parsed = z.string().min(1).safeParse(event.pathParameters?.id);
  if (!parsed.success) {
    throw new Error("Invalid combo id");
  }

  return parsed.data;
}

function buildPairKey(ownerEmail: string, videoAssetId: string, audioAssetId: string): string {
  return `${ownerEmail}#video:${videoAssetId}#audio:${audioAssetId}`;
}

function isAssetPublic(asset: z.infer<typeof AssetRecordSchema>): boolean {
  return asset.visibility === "public";
}

async function resolvePublicPlaybackUrl(
  asset: z.infer<typeof AssetRecordSchema>,
  originalsBucketName: string
): Promise<string | null> {
  if (!isAssetPublic(asset) || asset.status !== "ready") {
    return null;
  }

  if (asset.stream?.hlsMasterUrl) {
    return asset.stream.hlsMasterUrl;
  }

  const bucketName =
    asset.original.bucket === "pending" ? originalsBucketName : asset.original.bucket;
  return await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucketName,
      Key: asset.original.key,
      ResponseContentType: asset.original.contentType,
    }),
    { expiresIn: PLAYBACK_URL_EXPIRES_IN_SECONDS }
  );
}

async function getAssetById(tableName: string, id: string) {
  const result = await db.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        pk: `ASSET#${id}`,
        sk: "META",
      },
    })
  );

  if (!result.Item) {
    return null;
  }

  return await readAssetRecordWithUpgrade({
    db,
    tableName,
    item: result.Item,
  });
}

async function getComboById(tableName: string, id: string): Promise<ComboRecord | null> {
  const result = await db.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        pk: `COMBO#${id}`,
        sk: "META",
      },
    })
  );

  if (!result.Item) {
    return null;
  }

  return ComboRecordSchema.parse(result.Item);
}

async function findComboByPairKey(
  tableName: string,
  ownerEmail: string,
  pairKey: string
): Promise<ComboRecord | null> {
  const createdAtIndex = getCreatedAtIndex();
  const result = await db.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: createdAtIndex,
      KeyConditionExpression: "gsi1pk = :gsiPk",
      ExpressionAttributeValues: {
        ":gsiPk": `COMBO#OWNER#${ownerEmail}`,
      },
      ScanIndexForward: false,
      Limit: 200,
    })
  );

  for (const item of result.Items ?? []) {
    const parsed = ComboRecordSchema.safeParse(item);
    if (!parsed.success) {
      continue;
    }

    const itemPairKey =
      parsed.data.pairKey ??
      buildPairKey(parsed.data.ownerEmail, parsed.data.videoAssetId, parsed.data.audioAssetId);
    if (itemPairKey === pairKey) {
      return parsed.data;
    }
  }

  return null;
}

async function validatePairAssets(
  tableName: string,
  ownerEmail: string,
  videoAssetId: string,
  audioAssetId: string
): Promise<{ ok: true } | { ok: false; statusCode: number; body: string }> {
  const [videoAsset, audioAsset] = await Promise.all([
    getAssetById(tableName, videoAssetId),
    getAssetById(tableName, audioAssetId),
  ]);

  if (!videoAsset) {
    return {
      ok: false,
      statusCode: 400,
      body: JSON.stringify({ message: "Video asset not found" }),
    };
  }
  if (!audioAsset) {
    return {
      ok: false,
      statusCode: 400,
      body: JSON.stringify({ message: "Audio asset not found" }),
    };
  }
  if (videoAsset.ownerEmail !== ownerEmail || audioAsset.ownerEmail !== ownerEmail) {
    return { ok: false, statusCode: 403, body: JSON.stringify({ message: "Forbidden" }) };
  }
  if (videoAsset.type !== "video") {
    return {
      ok: false,
      statusCode: 400,
      body: JSON.stringify({ message: "videoAssetId must reference a video asset" }),
    };
  }
  if (audioAsset.type !== "audio") {
    return {
      ok: false,
      statusCode: 400,
      body: JSON.stringify({ message: "audioAssetId must reference an audio asset" }),
    };
  }

  return { ok: true };
}

async function createComboRecord(input: {
  tableName: string;
  ownerEmail: string;
  videoAssetId: string;
  audioAssetId: string;
  playback?: z.infer<typeof CreateComboInputSchema>["playback"];
}): Promise<ComboRecord> {
  const { tableName, ownerEmail, videoAssetId, audioAssetId, playback } = input;
  const id = randomUUID();
  const now = new Date().toISOString();
  const pairKey = buildPairKey(ownerEmail, videoAssetId, audioAssetId);

  const combo = ComboRecordSchema.parse({
    id,
    schemaVersion: ASSET_SCHEMA_VERSION,
    ownerEmail,
    videoAssetId,
    audioAssetId,
    pairKey,
    playback,
    upvotes: 0,
    downvotes: 0,
    score: 0,
    createdAt: now,
    updatedAt: now,
  });

  await db.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        pk: `COMBO#${id}`,
        sk: "META",
        gsi1pk: `COMBO#OWNER#${ownerEmail}`,
        gsi1sk: `${combo.createdAt}#${combo.id}`,
        ...combo,
      },
      ConditionExpression: "attribute_not_exists(pk) AND attribute_not_exists(sk)",
    })
  );

  return combo;
}

async function getUserVote(
  tableName: string,
  comboId: string,
  ownerEmail: string
): Promise<ComboVoteValue> {
  const result = await db.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        pk: `COMBO#${comboId}`,
        sk: `VOTE#${ownerEmail}`,
      },
    })
  );

  if (!result.Item) {
    return "none";
  }

  const parsed = ComboVoteValueSchema.safeParse(result.Item.value);
  return parsed.success ? parsed.data : "none";
}

function withUserVote(combo: ComboRecord, userVote: ComboVoteValue) {
  return {
    ...combo,
    userVote,
  };
}

async function listCombos(event: HttpEvent): Promise<{ statusCode: number; body: string }> {
  const tableName = getTableName();
  const createdAtIndex = getCreatedAtIndex();
  const ownerEmail = getOwnerEmail(event);
  const result = await db.send(
    new QueryCommand({
      TableName: tableName,
      IndexName: createdAtIndex,
      KeyConditionExpression: "gsi1pk = :gsiPk",
      ExpressionAttributeValues: {
        ":gsiPk": `COMBO#OWNER#${ownerEmail}`,
      },
      ScanIndexForward: false,
      Limit: 100,
    })
  );

  const combos = (result.Items ?? [])
    .map((item) => ComboRecordSchema.safeParse(item))
    .filter((parsed): parsed is z.SafeParseSuccess<ComboRecord> => parsed.success)
    .map((parsed) => parsed.data);

  const combosWithVote = await Promise.all(
    combos.map(async (combo) => {
      const userVote = await getUserVote(tableName, combo.id, ownerEmail);
      return withUserVote(combo, userVote);
    })
  );

  const payload = ComboListResponseSchema.parse({ combos: combosWithVote });
  return response(200, payload);
}

async function createCombo(event: HttpEvent): Promise<{ statusCode: number; body: string }> {
  const tableName = getTableName();
  const ownerEmail = getOwnerEmail(event);
  const parsedBody = CreateComboInputSchema.safeParse(parseBody(event.body));
  if (!parsedBody.success) {
    return response(400, { message: "Invalid request body", issues: parsedBody.error.issues });
  }

  const { videoAssetId, audioAssetId, playback } = parsedBody.data;
  const validated = await validatePairAssets(tableName, ownerEmail, videoAssetId, audioAssetId);
  if (!validated.ok) {
    return {
      statusCode: validated.statusCode,
      body: validated.body,
    };
  }

  const pairKey = buildPairKey(ownerEmail, videoAssetId, audioAssetId);
  const existing = await findComboByPairKey(tableName, ownerEmail, pairKey);
  if (existing) {
    const payload = ComboDetailResponseSchema.parse({ combo: withUserVote(existing, "none") });
    return response(200, payload);
  }

  const combo = await createComboRecord({
    tableName,
    ownerEmail,
    videoAssetId,
    audioAssetId,
    playback,
  });

  const payload = ComboDetailResponseSchema.parse({ combo: withUserVote(combo, "none") });
  return response(201, payload);
}

async function getCombo(
  event: HttpEvent,
  id: string
): Promise<{ statusCode: number; body: string }> {
  const tableName = getTableName();
  const ownerEmail = getOwnerEmail(event);
  const combo = await getComboById(tableName, id);
  if (!combo) {
    return response(404, { message: "Combo not found" });
  }
  if (combo.ownerEmail !== ownerEmail) {
    return response(403, { message: "Forbidden" });
  }

  const userVote = await getUserVote(tableName, combo.id, ownerEmail);
  const payload = ComboDetailResponseSchema.parse({ combo: withUserVote(combo, userVote) });
  return response(200, payload);
}

async function deleteCombo(
  event: HttpEvent,
  id: string
): Promise<{ statusCode: number; body: string }> {
  const tableName = getTableName();
  const ownerEmail = getOwnerEmail(event);
  const combo = await getComboById(tableName, id);
  if (!combo) {
    return response(404, { message: "Combo not found" });
  }
  if (combo.ownerEmail !== ownerEmail) {
    return response(403, { message: "Forbidden" });
  }

  let lastEvaluatedKey: Record<string, unknown> | undefined;
  do {
    const page = await db.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: {
          ":pk": `COMBO#${id}`,
        },
        ProjectionExpression: "pk, sk",
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    for (const item of page.Items ?? []) {
      const pk = item.pk;
      const sk = item.sk;
      if (typeof pk !== "string" || typeof sk !== "string") {
        continue;
      }

      await db.send(
        new DeleteCommand({
          TableName: tableName,
          Key: { pk, sk },
        })
      );
    }

    lastEvaluatedKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey);

  const payload = ComboDeleteResponseSchema.parse({ id, deleted: true as const });
  return response(200, payload);
}

function computeVoteDelta(current: ComboVoteValue, next: ComboVoteValue) {
  if (current === next) {
    return { upvotes: 0, downvotes: 0, score: 0 };
  }

  const deltas = {
    upvotes: 0,
    downvotes: 0,
    score: 0,
  };

  if (current === "up") {
    deltas.upvotes -= 1;
    deltas.score -= 1;
  } else if (current === "down") {
    deltas.downvotes -= 1;
    deltas.score += 1;
  }

  if (next === "up") {
    deltas.upvotes += 1;
    deltas.score += 1;
  } else if (next === "down") {
    deltas.downvotes += 1;
    deltas.score -= 1;
  }

  return deltas;
}

async function voteOnCombo(
  event: HttpEvent,
  id: string
): Promise<{ statusCode: number; body: string }> {
  const tableName = getTableName();
  const ownerEmail = getOwnerEmail(event);
  const parsedBody = ComboVoteInputSchema.safeParse(parseBody(event.body));
  if (!parsedBody.success) {
    return response(400, { message: "Invalid request body", issues: parsedBody.error.issues });
  }

  const combo = await getComboById(tableName, id);
  if (!combo) {
    return response(404, { message: "Combo not found" });
  }
  if (combo.ownerEmail !== ownerEmail) {
    return response(403, { message: "Forbidden" });
  }

  const currentVote = await getUserVote(tableName, id, ownerEmail);
  const nextVote: ComboVoteValue =
    parsedBody.data.action === "clear" ? "none" : parsedBody.data.action;
  if (currentVote === nextVote) {
    const payload = ComboDetailResponseSchema.parse({ combo: withUserVote(combo, currentVote) });
    return response(200, payload);
  }

  const delta = computeVoteDelta(currentVote, nextVote);

  if (delta.upvotes !== 0 || delta.downvotes !== 0 || delta.score !== 0) {
    const now = new Date().toISOString();
    await db.send(
      new UpdateCommand({
        TableName: tableName,
        Key: {
          pk: `COMBO#${id}`,
          sk: "META",
        },
        ConditionExpression: "attribute_exists(pk) AND attribute_exists(sk)",
        UpdateExpression:
          "SET #updatedAt = :updatedAt ADD #upvotes :upDelta, #downvotes :downDelta, #score :scoreDelta",
        ExpressionAttributeNames: {
          "#updatedAt": "updatedAt",
          "#upvotes": "upvotes",
          "#downvotes": "downvotes",
          "#score": "score",
        },
        ExpressionAttributeValues: {
          ":updatedAt": now,
          ":upDelta": delta.upvotes,
          ":downDelta": delta.downvotes,
          ":scoreDelta": delta.score,
        },
      })
    );
  }

  if (nextVote === "none") {
    await db.send(
      new DeleteCommand({
        TableName: tableName,
        Key: {
          pk: `COMBO#${id}`,
          sk: `VOTE#${ownerEmail}`,
        },
      })
    );
  } else {
    await db.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          pk: `COMBO#${id}`,
          sk: `VOTE#${ownerEmail}`,
          value: nextVote,
          updatedAt: new Date().toISOString(),
        },
      })
    );
  }

  const updatedCombo = await getComboById(tableName, id);
  if (!updatedCombo) {
    return response(404, { message: "Combo not found" });
  }

  const payload = ComboDetailResponseSchema.parse({ combo: withUserVote(updatedCombo, nextVote) });
  return response(200, payload);
}

async function voteOnComboByAssets(
  event: HttpEvent
): Promise<{ statusCode: number; body: string }> {
  const tableName = getTableName();
  const ownerEmail = getOwnerEmail(event);
  const parsedBody = ComboVoteByAssetsInputSchema.safeParse(parseBody(event.body));
  if (!parsedBody.success) {
    return response(400, { message: "Invalid request body", issues: parsedBody.error.issues });
  }

  const { videoAssetId, audioAssetId, action } = parsedBody.data;
  const validated = await validatePairAssets(tableName, ownerEmail, videoAssetId, audioAssetId);
  if (!validated.ok) {
    return {
      statusCode: validated.statusCode,
      body: validated.body,
    };
  }

  const pairKey = buildPairKey(ownerEmail, videoAssetId, audioAssetId);
  let combo = await findComboByPairKey(tableName, ownerEmail, pairKey);

  if (!combo && action === "clear") {
    return response(200, {
      combo: {
        id: "preview",
        schemaVersion: ASSET_SCHEMA_VERSION,
        ownerEmail,
        videoAssetId,
        audioAssetId,
        pairKey,
        upvotes: 0,
        downvotes: 0,
        score: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userVote: "none",
      },
    });
  }

  if (!combo) {
    combo = await createComboRecord({
      tableName,
      ownerEmail,
      videoAssetId,
      audioAssetId,
    });
  }

  const syntheticEvent: HttpEvent = {
    ...event,
    pathParameters: { id: combo.id },
    body: JSON.stringify({ action }),
  };

  return await voteOnCombo(syntheticEvent, combo.id);
}

async function submitToneReview(event: HttpEvent): Promise<{ statusCode: number; body: string }> {
  const tableName = getTableName();
  const ownerEmail = getOwnerEmail(event);
  const parsedBody = ToneReviewInputSchema.safeParse(parseBody(event.body));
  if (!parsedBody.success) {
    return response(400, { message: "Invalid request body", issues: parsedBody.error.issues });
  }

  const input = parsedBody.data;
  if (input.targetType === "combo") {
    const combo = await getComboById(tableName, input.targetId);
    if (!combo) {
      return response(404, { message: "Combo not found" });
    }
    if (combo.ownerEmail !== ownerEmail) {
      return response(403, { message: "Forbidden" });
    }
  } else {
    const asset = await getAssetById(tableName, input.targetId);
    if (!asset) {
      return response(404, { message: "Asset not found" });
    }
    if (asset.ownerEmail !== ownerEmail || asset.type !== input.targetType) {
      return response(403, { message: "Forbidden" });
    }
  }

  const now = new Date().toISOString();
  const review = ToneReviewResponseSchema.shape.review.parse({
    id: `tone_review_${randomUUID()}`,
    schemaVersion: ASSET_SCHEMA_VERSION,
    ...input,
    keywords: [...new Set(input.keywords.map((keyword) => keyword.trim()).filter(Boolean))],
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    createdAt: now,
    updatedAt: now,
  });

  await db.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        pk: `TONE_REVIEW#${review.targetType}#${review.targetId}`,
        sk: `REVIEW#${review.createdAt}#${review.id}`,
        gsi1pk: `TONE_REVIEW#${review.reviewSource}`,
        gsi1sk: `${review.createdAt}#${review.id}`,
        ...review,
      },
    })
  );

  return response(201, ToneReviewResponseSchema.parse({ review }));
}

function shuffleInPlace<T>(items: T[]): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j] as T, items[i] as T];
  }
}

function pickRandom<T>(items: T[]): T | null {
  if (items.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * items.length);
  return items[index] ?? null;
}

function isPublicReadyAsset(
  asset: z.infer<typeof AssetRecordSchema>,
  type: "video" | "audio"
): boolean {
  return asset.type === type && asset.status === "ready" && asset.visibility === "public";
}

async function scanPublicComboMetaRecords(tableName: string): Promise<ComboRecord[]> {
  let lastEvaluatedKey: Record<string, unknown> | undefined;
  const combos: ComboRecord[] = [];
  let scannedPages = 0;

  do {
    const page = await db.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "begins_with(pk, :comboPrefix) AND sk = :meta",
        ExpressionAttributeValues: {
          ":comboPrefix": "COMBO#",
          ":meta": "META",
        },
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 100,
      })
    );

    for (const item of page.Items ?? []) {
      const parsed = ComboRecordSchema.safeParse(item);
      if (!parsed.success) {
        continue;
      }

      combos.push(parsed.data);
    }

    scannedPages += 1;
    lastEvaluatedKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey && combos.length < 500 && scannedPages < 20);

  return combos;
}

async function scanPublicReadyAssetsByType(
  tableName: string,
  type: "video" | "audio"
): Promise<Array<z.infer<typeof AssetRecordSchema>>> {
  let lastEvaluatedKey: Record<string, unknown> | undefined;
  const assets: Array<z.infer<typeof AssetRecordSchema>> = [];
  let scannedPages = 0;

  do {
    const page = await db.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression:
          "begins_with(pk, :assetPrefix) AND sk = :meta AND #type = :type AND #status = :ready AND #visibility = :public",
        ExpressionAttributeNames: {
          "#type": "type",
          "#status": "status",
          "#visibility": "visibility",
        },
        ExpressionAttributeValues: {
          ":assetPrefix": "ASSET#",
          ":meta": "META",
          ":type": type,
          ":ready": "ready",
          ":public": "public",
        },
        ExclusiveStartKey: lastEvaluatedKey,
        Limit: 100,
      })
    );

    for (const item of page.Items ?? []) {
      const parsed = await safeReadAssetRecordWithUpgrade({
        db,
        tableName,
        item,
      });
      if (!parsed) {
        continue;
      }

      assets.push(parsed);
    }

    scannedPages += 1;
    lastEvaluatedKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey && assets.length < 500 && scannedPages < 20);

  return assets;
}

async function pickDerivedPublicPairCandidate(
  tableName: string,
  originalsBucketName: string,
  previousAudioAssetId?: string
): Promise<PublicRandomCandidate | null> {
  const [publicVideos, allPublicAudios] = await Promise.all([
    scanPublicReadyAssetsByType(tableName, "video"),
    scanPublicReadyAssetsByType(tableName, "audio"),
  ]);

  const publicAudios = previousAudioAssetId
    ? allPublicAudios.filter((asset) => asset.id !== previousAudioAssetId)
    : allPublicAudios;

  if (publicVideos.length === 0 || publicAudios.length === 0) {
    return null;
  }

  shuffleInPlace(publicVideos);
  shuffleInPlace(publicAudios);

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const videoAsset = pickRandom(publicVideos);
    const audioAsset = pickRandom(publicAudios);

    if (!videoAsset || !audioAsset) {
      continue;
    }

    const [videoSrc, audioSrc] = await Promise.all([
      resolvePublicPlaybackUrl(videoAsset, originalsBucketName),
      resolvePublicPlaybackUrl(audioAsset, originalsBucketName),
    ]);

    if (!videoSrc || !audioSrc) {
      continue;
    }

    return {
      comboId: `public-${videoAsset.id}-${audioAsset.id}`,
      videoAssetId: videoAsset.id,
      audioAssetId: audioAsset.id,
      videoTitle: videoAsset.title,
      audioTitle: audioAsset.title,
      videoSrc,
      audioSrc,
    };
  }

  return null;
}

async function pickExistingPublicComboCandidate(
  tableName: string,
  originalsBucketName: string,
  previousAudioAssetId?: string
): Promise<PublicRandomCandidate | null> {
  const combos = await scanPublicComboMetaRecords(tableName);
  if (combos.length === 0) {
    return null;
  }

  shuffleInPlace(combos);

  for (const combo of combos) {
    if (previousAudioAssetId && combo.audioAssetId === previousAudioAssetId) {
      continue;
    }

    const [videoAsset, audioAsset] = await Promise.all([
      getAssetById(tableName, combo.videoAssetId),
      getAssetById(tableName, combo.audioAssetId),
    ]);

    if (!videoAsset || !audioAsset) {
      continue;
    }

    if (!isPublicReadyAsset(videoAsset, "video") || !isPublicReadyAsset(audioAsset, "audio")) {
      continue;
    }

    const [videoSrc, audioSrc] = await Promise.all([
      resolvePublicPlaybackUrl(videoAsset, originalsBucketName),
      resolvePublicPlaybackUrl(audioAsset, originalsBucketName),
    ]);

    if (!videoSrc || !audioSrc) {
      continue;
    }

    return {
      comboId: combo.id,
      videoAssetId: combo.videoAssetId,
      audioAssetId: combo.audioAssetId,
      videoTitle: videoAsset.title,
      audioTitle: audioAsset.title,
      videoSrc,
      audioSrc,
    };
  }

  return null;
}

function chooseRandomSourceOrder(): [PublicRandomSource, PublicRandomSource] {
  if (Math.random() < 0.5) {
    return ["derived", "existing"];
  }

  return ["existing", "derived"];
}

function buildPublicRandomPayload(
  candidate: PublicRandomCandidate,
  source: PublicRandomSource,
  selection: PublicRandomSelection
) {
  return PublicRandomComboResponseSchema.parse({
    source,
    selection,
    comboId: candidate.comboId,
    videoAssetId: candidate.videoAssetId,
    audioAssetId: candidate.audioAssetId,
    videoTitle: candidate.videoTitle,
    audioTitle: candidate.audioTitle,
    videoSrc: candidate.videoSrc,
    audioSrc: candidate.audioSrc,
  });
}

async function pickPublicRandomCandidateBySource(
  source: PublicRandomSource,
  tableName: string,
  originalsBucketName: string,
  previousAudioAssetId?: string
): Promise<PublicRandomCandidate | null> {
  if (source === "derived") {
    return await pickDerivedPublicPairCandidate(
      tableName,
      originalsBucketName,
      previousAudioAssetId
    );
  }

  return await pickExistingPublicComboCandidate(
    tableName,
    originalsBucketName,
    previousAudioAssetId
  );
}

function parsePreviousAudioAssetId(event: HttpEvent): string | undefined {
  const candidate =
    event.queryStringParameters?.previousAudioAssetId ?? event.queryStringParameters?.previousTrack;
  const parsed = z.string().min(1).safeParse(candidate);
  if (!parsed.success) {
    return undefined;
  }

  return parsed.data;
}

async function getRandomPublicCombo(
  event: HttpEvent
): Promise<{ statusCode: number; body: string }> {
  const tableName = getTableName();
  const originalsBucketName = getOriginalsBucketName();
  const previousAudioAssetId = parsePreviousAudioAssetId(event);
  const [primarySource, secondarySource] = chooseRandomSourceOrder();

  const primaryCandidate = await pickPublicRandomCandidateBySource(
    primarySource,
    tableName,
    originalsBucketName,
    previousAudioAssetId
  );
  if (primaryCandidate) {
    const payload = buildPublicRandomPayload(primaryCandidate, primarySource, "primary");
    return response(200, payload);
  }

  const fallbackCandidate = await pickPublicRandomCandidateBySource(
    secondarySource,
    tableName,
    originalsBucketName,
    previousAudioAssetId
  );
  if (fallbackCandidate) {
    const payload = buildPublicRandomPayload(fallbackCandidate, secondarySource, "fallback");
    return response(200, payload);
  }

  return response(404, { message: "No valid public combo found" });
}

export async function handler(event: HttpEvent): Promise<{ statusCode: number; body: string }> {
  try {
    const method = event.requestContext?.http?.method;
    const routeKey = event.requestContext?.routeKey;

    if (method === "GET" && routeKey === "GET /combos") {
      return await listCombos(event);
    }

    if (method === "POST" && routeKey === "POST /combos") {
      return await createCombo(event);
    }

    if (method === "POST" && routeKey === "POST /combos/vote") {
      return await voteOnComboByAssets(event);
    }

    if (method === "POST" && routeKey === "POST /tone-reviews") {
      return await submitToneReview(event);
    }

    if (method === "GET" && routeKey === "GET /public/combos/random") {
      return await getRandomPublicCombo(event);
    }

    const id = parseComboId(event);

    if (method === "GET" && routeKey === "GET /combos/{id}") {
      return await getCombo(event, id);
    }

    if (method === "DELETE" && routeKey === "DELETE /combos/{id}") {
      return await deleteCombo(event, id);
    }

    if (method === "POST" && routeKey === "POST /combos/{id}/vote") {
      return await voteOnCombo(event, id);
    }

    return response(405, { message: "Method not allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return response(500, { message });
  }
}
