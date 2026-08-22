import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { BatchGetCommand, DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  AssetRecordSchema,
  PUBLIC_MUSIC_CATALOG_SCHEMA_VERSION,
  PublicMusicCatalogResponseSchema,
  type AssetRecord,
  type MusicReleaseRecord,
  type MusicTrackRecord,
  type PublicMusicTrack,
  MusicReleaseRecordSchema,
  MusicTrackRecordSchema,
} from "@media-manager/contracts";

const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});
const COVER_URL_EXPIRES_SECONDS = 900;
const MAX_PUBLIC_RECORDS = 200;
const MAX_QUERY_PAGES = 5;

function requiredEnv(name: "ASSETS_TABLE_NAME" | "ASSETS_ORIGINALS_BUCKET_NAME"): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function cleanItem(item: Record<string, unknown>): Record<string, unknown> {
  const { pk: _pk, sk: _sk, ...record } = item;
  return record;
}

async function loadPublishedRecords(): Promise<{
  tracks: MusicTrackRecord[];
  releases: MusicReleaseRecord[];
}> {
  const items: Array<Record<string, unknown>> = [];
  let cursor: Record<string, unknown> | undefined;
  let pages = 0;
  do {
    pages += 1;
    const page = await db.send(
      new QueryCommand({
        TableName: requiredEnv("ASSETS_TABLE_NAME"),
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: { ":pk": "MUSIC" },
        ExclusiveStartKey: cursor,
        ConsistentRead: true,
        Limit: MAX_PUBLIC_RECORDS - items.length,
      })
    );
    items.push(...(page.Items ?? []));
    if ((items.length >= MAX_PUBLIC_RECORDS || pages >= MAX_QUERY_PAGES) && page.LastEvaluatedKey)
      throw new Error("Public music catalog read limit exceeded");
    cursor = page.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (cursor);

  const tracks: MusicTrackRecord[] = [];
  const releases: MusicReleaseRecord[] = [];
  for (const item of items) {
    if (typeof item.sk !== "string") continue;
    if (item.sk.startsWith("TRACK#")) {
      const parsed = MusicTrackRecordSchema.safeParse(cleanItem(item));
      if (parsed.success && parsed.data.publicationStatus === "published") tracks.push(parsed.data);
    } else if (item.sk.startsWith("RELEASE#")) {
      const parsed = MusicReleaseRecordSchema.safeParse(cleanItem(item));
      if (parsed.success && parsed.data.publicationStatus === "published")
        releases.push(parsed.data);
    }
  }
  return { tracks, releases };
}

async function loadAssets(ids: string[]): Promise<Map<string, AssetRecord>> {
  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += 100) chunks.push(ids.slice(index, index + 100));
  const pages = await Promise.all(
    chunks.map(async (chunk) => {
      let keys = chunk.map((id) => ({ pk: `ASSET#${id}`, sk: "META" }));
      const items: Array<Record<string, unknown>> = [];
      for (let attempt = 0; keys.length > 0 && attempt < 3; attempt += 1) {
        const result = await db.send(
          new BatchGetCommand({
            RequestItems: {
              [requiredEnv("ASSETS_TABLE_NAME")]: { Keys: keys, ConsistentRead: true },
            },
          })
        );
        items.push(...(result.Responses?.[requiredEnv("ASSETS_TABLE_NAME")] ?? []));
        keys = (result.UnprocessedKeys?.[requiredEnv("ASSETS_TABLE_NAME")]?.Keys ?? []) as Array<{
          pk: string;
          sk: string;
        }>;
      }
      if (keys.length > 0) throw new Error("Public music asset batch remained unprocessed");
      return items;
    })
  );
  const assets = new Map<string, AssetRecord>();
  for (const item of pages.flat()) {
    const parsed = AssetRecordSchema.safeParse(item);
    if (parsed.success) assets.set(parsed.data.id, parsed.data);
  }
  return assets;
}

function availableAsset(asset: AssetRecord | null, type: "audio" | "image", owner: string) {
  return Boolean(
    asset &&
    asset.ownerEmail === owner &&
    asset.type === type &&
    asset.status === "ready" &&
    asset.visibility === "public"
  );
}

export async function handler(): Promise<{
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}> {
  try {
    const records = await loadPublishedRecords();
    const assetIds = new Set(records.tracks.map((track) => track.assetId));
    for (const release of records.releases)
      if (release.coverAssetId) assetIds.add(release.coverAssetId);
    const assets = await loadAssets([...assetIds]);
    const publicTracks = new Map<string, PublicMusicTrack>();

    for (const track of records.tracks) {
      const asset = assets.get(track.assetId) ?? null;
      if (
        track.purchaseLinks.length === 0 ||
        !availableAsset(asset, "audio", track.ownerEmail) ||
        !asset?.stream?.hlsMasterUrl
      )
        continue;
      publicTracks.set(track.id, {
        id: track.id,
        title: track.title,
        durationSeconds: track.durationSeconds,
        audioUrl: asset.stream.hlsMasterUrl,
        purchaseLinks: track.purchaseLinks,
      });
    }

    const releaseCandidates = records.releases.flatMap((release) => {
      if (
        !release.releaseDate ||
        !release.type ||
        !release.coverAssetId ||
        !release.coverAlt ||
        release.trackIds.length === 0 ||
        release.purchaseLinks.length === 0
      ) {
        return [];
      }
      const tracks = release.trackIds.map((id) => publicTracks.get(id));
      if (tracks.some((track) => !track)) return [];
      const authoritativeTracks = release.trackIds.map((id) =>
        records.tracks.find((track) => track.id === id)
      );
      if (authoritativeTracks.some((track) => !track || track.ownerEmail !== release.ownerEmail))
        return [];
      const cover = assets.get(release.coverAssetId) ?? null;
      if (!availableAsset(cover, "image", release.ownerEmail) || !cover) return [];
      return [{ release, tracks: tracks as PublicMusicTrack[], cover }];
    });
    const releases = [];
    for (let index = 0; index < releaseCandidates.length; index += 10) {
      const batch = releaseCandidates.slice(index, index + 10);
      releases.push(
        ...(await Promise.all(
          batch.map(async ({ release, tracks, cover }) => {
            const coverUrl = await getSignedUrl(
              s3,
              new GetObjectCommand({
                Bucket:
                  cover.original.bucket === "pending"
                    ? requiredEnv("ASSETS_ORIGINALS_BUCKET_NAME")
                    : cover.original.bucket,
                Key: cover.original.key,
                ResponseContentType: cover.original.contentType,
              }),
              { expiresIn: COVER_URL_EXPIRES_SECONDS }
            );
            return {
              id: release.id,
              title: release.title,
              releaseDate: release.releaseDate!,
              type: release.type!,
              coverUrl,
              coverAlt: release.coverAlt!,
              trackIds: release.trackIds,
              tracks,
              purchaseLinks: release.purchaseLinks,
              description: release.description,
            };
          })
        ))
      );
    }

    const payload = PublicMusicCatalogResponseSchema.parse({
      schemaVersion: PUBLIC_MUSIC_CATALOG_SCHEMA_VERSION,
      tracks: [...publicTracks.values()],
      releases,
    });
    return {
      statusCode: 200,
      headers: { "cache-control": "public, max-age=300" },
      body: JSON.stringify(payload),
    };
  } catch (error) {
    console.error("Public music API failed", error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: error instanceof Error ? error.message : "Unexpected error",
      }),
    };
  }
}
