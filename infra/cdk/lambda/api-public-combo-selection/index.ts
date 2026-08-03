import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DynamoDBDocumentClient, GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  AssetRecordSchema,
  PublicComboSelectionRequestSchema,
  PublicComboSelectionResponseSchema,
  type AssetRecord,
  type PublicComboSelectionFallbackReason,
  type PublicComboSelectionRequest,
} from "@media-manager/contracts";
import {
  COMBO_TONE_PREDICTOR_VERSION,
  complementaryToneQueryVector,
  comboTonePredictorV0,
  rankComboToneCandidates,
  rankToneQueryCandidates,
  reviewWordsToToneQuery,
  sampleNearestComboToneCandidate,
  toneQueryRetrievalVector,
  type AssetToneVectorIndexQuery,
  type AssetToneVectorMatch,
  type AssetToneVectorQueryOptions,
  type AssetToneVectorRecord,
} from "@media-manager/tone-core";
import { z } from "zod";

import { assetToneVectorRecordForAsset } from "../shared/asset-tone-vector";
import { S3VectorsIndex } from "../shared/s3-vectors-index";

type HttpEvent = {
  requestContext?: {
    http?: { method?: string };
    routeKey?: string;
  };
  body?: string | null;
};

type HttpResponse = { statusCode: number; body: string };

type PublicComboCandidate = {
  comboId: string;
  videoAssetId: string;
  audioAssetId: string;
};

export type PublicComboSelectionDependencies = {
  getAsset(assetId: string): Promise<AssetRecord | null>;
  listPublicReadyAssets(type: "audio" | "video"): Promise<AssetRecord[]>;
  queryNearest(
    query: AssetToneVectorIndexQuery,
    options?: AssetToneVectorQueryOptions
  ): Promise<AssetToneVectorMatch[]>;
  resolvePlaybackUrl(asset: AssetRecord): Promise<string | null>;
  random: () => number;
  emitMetric(metric: PublicComboSelectionMetric): void;
};

type PublicComboSelectionMetric = {
  statusCode: number;
  resolvedMode: "search" | "walk" | "random" | "unavailable";
  fallbackReason?: PublicComboSelectionFallbackReason;
  latencyMs: number;
};

const SOURCE_CANDIDATE_LIMIT = 100;
const COMPLEMENTARY_ANCHOR_LIMIT = 3;
const COMPLEMENTARY_MATCH_LIMIT = 20;
const MAX_REQUEST_BODY_BYTES = 10 * 1024;

export function createHandler(
  dependencies?: PublicComboSelectionDependencies
): (event: HttpEvent) => Promise<HttpResponse> {
  let resolvedDependencies = dependencies;
  return async (event) => {
    const startedAt = Date.now();
    if (
      event.requestContext?.http?.method !== "POST" ||
      event.requestContext?.routeKey !== "POST /public/combos/select"
    ) {
      return response(405, { message: "Method not allowed" });
    }

    resolvedDependencies ??= createDefaultDependencies();

    if (Buffer.byteLength(event.body ?? "", "utf8") > MAX_REQUEST_BODY_BYTES) {
      return finishResponse(
        response(413, { message: "Public combo selection request is too large" }),
        resolvedDependencies,
        startedAt
      );
    }

    let request: PublicComboSelectionRequest;
    try {
      request = PublicComboSelectionRequestSchema.parse(parseBody(event.body));
    } catch (error) {
      if (error instanceof SyntaxError || error instanceof z.ZodError) {
        return finishResponse(
          response(400, { message: "Invalid public combo selection request" }),
          resolvedDependencies,
          startedAt
        );
      }
      throw error;
    }

    try {
      return finishResponse(
        await selectPublicCombo(request, resolvedDependencies),
        resolvedDependencies,
        startedAt
      );
    } catch (error) {
      console.error("Public combo selection failed", { error });
      return finishResponse(
        response(500, { message: "Public combo selection failed" }),
        resolvedDependencies,
        startedAt
      );
    }
  };
}

export const handler = createHandler();

async function selectPublicCombo(
  request: PublicComboSelectionRequest,
  dependencies: PublicComboSelectionDependencies
): Promise<HttpResponse> {
  if (request.mode === "search") {
    return await searchPublicCombo(request, dependencies);
  }

  return await walkPublicCombo(request, dependencies);
}

async function walkPublicCombo(
  request: Extract<PublicComboSelectionRequest, { mode: "walk" }>,
  dependencies: PublicComboSelectionDependencies
): Promise<HttpResponse> {
  const [currentAudio, currentVideo] = await Promise.all([
    dependencies.getAsset(request.current.audioAssetId),
    dependencies.getAsset(request.current.videoAssetId),
  ]);

  if (!currentAudio || !currentVideo) {
    return response(404, { message: "Current public combo assets were not found" });
  }

  const currentAudioVector = assetToneVectorRecordForAsset(currentAudio);
  const currentVideoVector = assetToneVectorRecordForAsset(currentVideo);
  if (!currentAudioVector || !currentVideoVector) {
    return response(400, { message: "Current assets are not eligible for tone walking" });
  }
  if (currentAudioVector.assetType !== "audio" || currentVideoVector.assetType !== "video") {
    return response(400, { message: "Current assets do not match the requested media types" });
  }

  let audioMatches: Awaited<ReturnType<PublicComboSelectionDependencies["queryNearest"]>>;
  let videoMatches: Awaited<ReturnType<PublicComboSelectionDependencies["queryNearest"]>>;
  try {
    [audioMatches, videoMatches] = await Promise.all([
      dependencies.queryNearest({
        vector: currentAudioVector.effectiveTone,
        assetType: "audio",
        limit: SOURCE_CANDIDATE_LIMIT,
      }),
      dependencies.queryNearest({
        vector: currentVideoVector.effectiveTone,
        assetType: "video",
        limit: SOURCE_CANDIDATE_LIMIT,
      }),
    ]);
  } catch (error) {
    console.error("Public combo vector query failed", { error });
    return await randomFallback(request, dependencies, "vector_query_failed");
  }

  const excludedAudioIds = new Set([
    request.current.audioAssetId,
    ...request.history.recentAudioAssetIds,
  ]);
  const audioCandidates = uniqueEligibleRecords(
    audioMatches.map(({ record }) => record),
    "audio"
  ).filter(({ assetId }) => !excludedAudioIds.has(assetId));
  const videoCandidates = uniqueEligibleRecords(
    [currentVideoVector, ...videoMatches.map(({ record }) => record)],
    "video"
  ).slice(0, SOURCE_CANDIDATE_LIMIT);
  const recentComboIds = new Set(request.history.recentComboIds);
  const currentTone = comboTonePredictorV0.predict({
    audioTone: currentAudioVector.effectiveTone,
    videoTone: currentVideoVector.effectiveTone,
  });
  const candidates = audioCandidates.flatMap((audio) =>
    videoCandidates.flatMap((video) => {
      const candidate = pairCandidate(video.assetId, audio.assetId);
      if (recentComboIds.has(candidate.comboId)) {
        return [];
      }
      return [
        {
          candidate,
          predictedTone: comboTonePredictorV0.predict({
            audioTone: audio.effectiveTone,
            videoTone: video.effectiveTone,
          }),
        },
      ];
    })
  );
  const selected = sampleNearestComboToneCandidate(
    rankComboToneCandidates(currentTone, candidates),
    dependencies.random
  );

  if (!selected) {
    return await randomFallback(request, dependencies, "no_walk_candidates");
  }

  const payload = await resolveCandidate(selected.candidate, dependencies, {
    schemaVersion: "combo-selection/v1",
    requestedMode: "walk",
    resolvedMode: "walk",
    predictorVersion: COMBO_TONE_PREDICTOR_VERSION,
    distance: selected.distance,
  });
  if (!payload) {
    return await randomFallback(request, dependencies, "selected_candidate_unavailable");
  }

  return response(200, payload);
}

async function searchPublicCombo(
  request: Extract<PublicComboSelectionRequest, { mode: "search" }>,
  dependencies: PublicComboSelectionDependencies
): Promise<HttpResponse> {
  const query = reviewWordsToToneQuery(request.keywords);
  if (!query) {
    return response(400, { message: "No supported tone words were provided" });
  }

  const retrievalVector = toneQueryRetrievalVector(query);
  const retrievalAbortController = new AbortController();
  const retrievalTimeout = setTimeout(() => retrievalAbortController.abort(), 4_000);
  const queryOptions = { signal: retrievalAbortController.signal };
  let audioMatches: Awaited<ReturnType<PublicComboSelectionDependencies["queryNearest"]>>;
  let videoMatches: Awaited<ReturnType<PublicComboSelectionDependencies["queryNearest"]>>;
  try {
    [audioMatches, videoMatches] = await Promise.all([
      dependencies.queryNearest(
        {
          vector: retrievalVector,
          assetType: "audio",
          limit: SOURCE_CANDIDATE_LIMIT,
        },
        queryOptions
      ),
      dependencies.queryNearest(
        {
          vector: retrievalVector,
          assetType: "video",
          limit: SOURCE_CANDIDATE_LIMIT,
        },
        queryOptions
      ),
    ]);
  } catch (error) {
    clearTimeout(retrievalTimeout);
    console.error("Public combo search vector query failed", { error });
    return await randomFallback(request, dependencies, "vector_query_failed");
  }

  const excludedAudioIds = new Set(request.history.recentAudioAssetIds);
  const recentComboIds = new Set(request.history.recentComboIds);
  const audioCandidates = uniqueEligibleRecords(
    audioMatches.map(({ record }) => record),
    "audio"
  ).filter(({ assetId }) => !excludedAudioIds.has(assetId));
  const videoCandidates = uniqueEligibleRecords(
    videoMatches.map(({ record }) => record),
    "video"
  );
  const candidates = new Map<
    string,
    {
      candidate: PublicComboCandidate;
      predictedTone: AssetToneVectorRecord["effectiveTone"];
    }
  >();
  const addCandidate = (audio: AssetToneVectorRecord, video: AssetToneVectorRecord) => {
    if (excludedAudioIds.has(audio.assetId)) return;
    const candidate = pairCandidate(video.assetId, audio.assetId);
    if (recentComboIds.has(candidate.comboId) || candidates.has(candidate.comboId)) return;
    candidates.set(candidate.comboId, {
      candidate,
      predictedTone: comboTonePredictorV0.predict({
        audioTone: audio.effectiveTone,
        videoTone: video.effectiveTone,
      }),
    });
  };

  for (const audio of audioCandidates) {
    for (const video of videoCandidates) {
      addCandidate(audio, video);
    }
  }

  const complementaryQueries = await Promise.allSettled([
    ...audioCandidates.slice(0, COMPLEMENTARY_ANCHOR_LIMIT).map(async (audio) => ({
      kind: "video" as const,
      audio,
      matches: await dependencies.queryNearest(
        {
          vector: complementaryToneQueryVector(query, audio.effectiveTone, 0.6, 0.4),
          assetType: "video",
          limit: COMPLEMENTARY_MATCH_LIMIT,
        },
        queryOptions
      ),
    })),
    ...videoCandidates.slice(0, COMPLEMENTARY_ANCHOR_LIMIT).map(async (video) => ({
      kind: "audio" as const,
      video,
      matches: await dependencies.queryNearest(
        {
          vector: complementaryToneQueryVector(query, video.effectiveTone, 0.4, 0.6),
          assetType: "audio",
          limit: COMPLEMENTARY_MATCH_LIMIT,
        },
        queryOptions
      ),
    })),
  ]);
  clearTimeout(retrievalTimeout);

  for (const result of complementaryQueries) {
    if (result.status !== "fulfilled") continue;
    if (result.value.kind === "video") {
      for (const video of uniqueEligibleRecords(
        result.value.matches.map(({ record }) => record),
        "video"
      )) {
        addCandidate(result.value.audio, video);
      }
    } else {
      for (const audio of uniqueEligibleRecords(
        result.value.matches.map(({ record }) => record),
        "audio"
      )) {
        addCandidate(audio, result.value.video);
      }
    }
  }
  const complementaryFailures = complementaryQueries.filter(
    (result) => result.status === "rejected"
  ).length;
  if (complementaryFailures > 0) {
    console.error("Public combo complementary retrieval partially failed", {
      failures: complementaryFailures,
    });
  }

  const selected = sampleNearestComboToneCandidate(
    rankToneQueryCandidates(query, [...candidates.values()]),
    dependencies.random
  );

  if (!selected) {
    return await randomFallback(request, dependencies, "no_search_candidates");
  }

  const payload = await resolveCandidate(selected.candidate, dependencies, {
    schemaVersion: "combo-selection/v1",
    requestedMode: "search",
    resolvedMode: "search",
    predictorVersion: COMBO_TONE_PREDICTOR_VERSION,
    distance: selected.distance,
    queryDimensions: query.dimensions,
  });
  if (!payload) {
    return await randomFallback(request, dependencies, "selected_candidate_unavailable");
  }

  return response(200, payload);
}

async function randomFallback(
  request: PublicComboSelectionRequest,
  dependencies: PublicComboSelectionDependencies,
  fallbackReason: PublicComboSelectionFallbackReason
): Promise<HttpResponse> {
  const [videos, audios] = await Promise.all([
    dependencies.listPublicReadyAssets("video"),
    dependencies.listPublicReadyAssets("audio"),
  ]);
  const shuffledVideos = shuffle(videos, dependencies.random);
  const shuffledAudios = shuffle(audios, dependencies.random);
  const currentAudioAssetId = request.mode === "walk" ? request.current.audioAssetId : undefined;
  const exclusionStages = [
    {
      audioIds: new Set(
        [currentAudioAssetId, ...request.history.recentAudioAssetIds].filter(
          (assetId): assetId is string => Boolean(assetId)
        )
      ),
      comboIds: new Set(request.history.recentComboIds),
    },
    {
      audioIds: new Set(
        [currentAudioAssetId, ...request.history.recentAudioAssetIds].filter(
          (assetId): assetId is string => Boolean(assetId)
        )
      ),
      comboIds: new Set<string>(),
    },
    {
      audioIds: new Set(currentAudioAssetId ? [currentAudioAssetId] : []),
      comboIds: new Set<string>(),
    },
  ];

  for (const exclusions of exclusionStages) {
    for (const audio of shuffledAudios) {
      if (exclusions.audioIds.has(audio.id)) {
        continue;
      }
      for (const video of shuffledVideos) {
        const candidate = pairCandidate(video.id, audio.id);
        if (exclusions.comboIds.has(candidate.comboId)) {
          continue;
        }
        const payload = await resolveCandidate(candidate, dependencies, {
          schemaVersion: "combo-selection/v1",
          requestedMode: request.mode,
          resolvedMode: "random",
          predictorVersion: COMBO_TONE_PREDICTOR_VERSION,
          fallbackReason,
        });
        if (payload) {
          return response(200, payload);
        }
      }
    }
  }

  return response(404, {
    message: "No valid public combo found",
    fallbackReason,
  });
}

async function resolveCandidate(
  candidate: PublicComboCandidate,
  dependencies: PublicComboSelectionDependencies,
  selection: Record<string, unknown>
) {
  const [video, audio] = await Promise.all([
    dependencies.getAsset(candidate.videoAssetId),
    dependencies.getAsset(candidate.audioAssetId),
  ]);
  if (!isPublicReadyAsset(video, "video") || !isPublicReadyAsset(audio, "audio")) {
    return null;
  }

  const [videoSrc, audioSrc] = await Promise.all([
    dependencies.resolvePlaybackUrl(video),
    dependencies.resolvePlaybackUrl(audio),
  ]);
  if (!videoSrc || !audioSrc) {
    return null;
  }

  return PublicComboSelectionResponseSchema.parse({
    schemaVersion: "public-combo-selection-response/v1",
    ...candidate,
    videoTitle: video.title,
    audioTitle: audio.title,
    videoSrc,
    audioSrc,
    selection,
  });
}

function uniqueEligibleRecords(
  records: AssetToneVectorRecord[],
  assetType: "audio" | "video"
): AssetToneVectorRecord[] {
  const unique = new Map<string, AssetToneVectorRecord>();
  for (const record of records) {
    if (
      record.assetType === assetType &&
      record.visibility === "public" &&
      record.assetStatus === "ready" &&
      record.toneStatus === "ready"
    ) {
      if (!unique.has(record.assetId)) {
        unique.set(record.assetId, record);
      }
    }
  }
  return [...unique.values()];
}

function pairCandidate(videoAssetId: string, audioAssetId: string): PublicComboCandidate {
  return {
    comboId: `public-${videoAssetId}-${audioAssetId}`,
    videoAssetId,
    audioAssetId,
  };
}

function isPublicReadyAsset(
  asset: AssetRecord | null,
  type: "audio" | "video"
): asset is AssetRecord {
  return asset?.type === type && asset.status === "ready" && asset.visibility === "public";
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.min(Math.max(random(), 0), 1 - Number.EPSILON) * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex] as T, shuffled[index] as T];
  }
  return shuffled;
}

function parseBody(body: string | null | undefined): unknown {
  return body ? JSON.parse(body) : {};
}

function response(statusCode: number, body: unknown): HttpResponse {
  return { statusCode, body: JSON.stringify(body) };
}

function createDefaultDependencies(): PublicComboSelectionDependencies {
  const tableName = requiredEnv("ASSETS_TABLE_NAME");
  const originalsBucketName = requiredEnv("ASSETS_ORIGINALS_BUCKET_NAME");
  const db = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  const s3 = new S3Client({});
  const vectorIndex = new S3VectorsIndex({
    indexArn: requiredEnv("ASSET_TONE_VECTOR_INDEX_ARN"),
    queryTimeoutMs: 4_000,
  });

  return {
    async getAsset(assetId) {
      const result = await db.send(
        new GetCommand({
          TableName: tableName,
          Key: { pk: `ASSET#${assetId}`, sk: "META" },
          ConsistentRead: true,
        })
      );
      const parsed = AssetRecordSchema.safeParse(result.Item);
      return parsed.success ? parsed.data : null;
    },
    async listPublicReadyAssets(type) {
      let lastEvaluatedKey: Record<string, unknown> | undefined;
      const assets: AssetRecord[] = [];
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
          const parsed = AssetRecordSchema.safeParse(item);
          if (parsed.success) {
            assets.push(parsed.data);
          }
        }
        lastEvaluatedKey = page.LastEvaluatedKey as Record<string, unknown> | undefined;
      } while (lastEvaluatedKey && assets.length < 500);
      return assets;
    },
    queryNearest(query, options) {
      return vectorIndex.queryNearest(query, options);
    },
    async resolvePlaybackUrl(asset) {
      if (!isPublicReadyAsset(asset, asset.type === "audio" ? "audio" : "video")) {
        return null;
      }
      if (asset.stream?.hlsMasterUrl) {
        return asset.stream.hlsMasterUrl;
      }
      return await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: asset.original.bucket === "pending" ? originalsBucketName : asset.original.bucket,
          Key: asset.original.key,
          ResponseContentType: asset.original.contentType,
        }),
        { expiresIn: 60 * 15 }
      );
    },
    random: Math.random,
    emitMetric,
  };
}

function requiredEnv(
  name: "ASSETS_TABLE_NAME" | "ASSETS_ORIGINALS_BUCKET_NAME" | "ASSET_TONE_VECTOR_INDEX_ARN"
): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function finishResponse(
  result: HttpResponse,
  dependencies: PublicComboSelectionDependencies,
  startedAt: number
): HttpResponse {
  const body = JSON.parse(result.body) as {
    fallbackReason?: PublicComboSelectionFallbackReason;
    selection?: {
      resolvedMode?: "search" | "walk" | "random";
      fallbackReason?: PublicComboSelectionFallbackReason;
    };
  };
  dependencies.emitMetric({
    statusCode: result.statusCode,
    resolvedMode: body.selection?.resolvedMode ?? "unavailable",
    fallbackReason: body.selection?.fallbackReason ?? body.fallbackReason,
    latencyMs: Date.now() - startedAt,
  });
  return result;
}

function emitMetric(metric: PublicComboSelectionMetric): void {
  const fallbackReason = metric.fallbackReason ?? "none";
  console.log(
    JSON.stringify({
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [
          {
            Namespace: "MediaManager/PublicComboSelection",
            Dimensions: [["ResolvedMode", "StatusCode", "FallbackReason"]],
            Metrics: [
              { Name: "Requests", Unit: "Count" },
              { Name: "Errors", Unit: "Count" },
              { Name: "Latency", Unit: "Milliseconds" },
            ],
          },
        ],
      },
      ResolvedMode: metric.resolvedMode,
      StatusCode: String(metric.statusCode),
      FallbackReason: fallbackReason,
      Requests: 1,
      Errors: metric.statusCode >= 400 ? 1 : 0,
      Latency: metric.latencyMs,
    })
  );
}
