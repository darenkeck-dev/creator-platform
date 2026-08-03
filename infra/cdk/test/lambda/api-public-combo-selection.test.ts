/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";
import type { AssetRecord } from "@media-manager/contracts";
import {
  buildAssetToneVectorRecord,
  type AssetToneVectorIndexQuery,
  type AssetToneVectorMatch,
} from "@media-manager/tone-core";

import {
  createHandler,
  type PublicComboSelectionDependencies,
} from "../../lambda/api-public-combo-selection";

const event = (body: unknown) => ({
  requestContext: {
    http: { method: "POST" },
    routeKey: "POST /public/combos/select",
  },
  body: JSON.stringify(body),
});

const request = {
  schemaVersion: "public-combo-selection-request/v1",
  mode: "walk",
  current: {
    audioAssetId: "audio-current",
    videoAssetId: "video-current",
  },
  history: {
    recentAudioAssetIds: ["audio-recent"],
    recentComboIds: ["public-video-other-audio-near"],
  },
};

describe("public combo selection API", () => {
  it("returns 400 for an invalid request", async () => {
    const result = await createHandler(unusedDependencies())(event({ mode: "search" }));
    expect(result.statusCode).toBe(400);
  });

  it("rejects oversized request bodies", async () => {
    const result = await createHandler(unusedDependencies())({
      requestContext: {
        http: { method: "POST" },
        routeKey: "POST /public/combos/select",
      },
      body: "x".repeat(10 * 1024 + 1),
    });
    expect(result.statusCode).toBe(413);
  });

  it("walks by exact predicted combo tone while enforcing history", async () => {
    const assets = new Map(
      [
        asset("audio-current", "audio", 0),
        asset("video-current", "video", 0),
        asset("audio-near", "audio", 0.1),
        asset("audio-recent", "audio", 0.01),
        asset("video-other", "video", 1),
      ].map((value) => [value.id, value])
    );
    const queries: AssetToneVectorIndexQuery[] = [];
    const metrics: Array<{ statusCode: number; resolvedMode: string; fallbackReason?: string }> =
      [];
    const dependencies: PublicComboSelectionDependencies = {
      async getAsset(assetId) {
        return assets.get(assetId) ?? null;
      },
      async listPublicReadyAssets() {
        throw new Error("Fallback should not be used");
      },
      async queryNearest(query) {
        queries.push(query);
        if (query.assetType === "audio") {
          return [
            match(assets.get("audio-current") as AssetRecord),
            match(assets.get("audio-recent") as AssetRecord),
            match(assets.get("audio-near") as AssetRecord),
          ];
        }
        return [
          {
            ...match(assets.get("video-current") as AssetRecord),
            record: {
              ...match(assets.get("video-current") as AssetRecord).record,
              effectiveTone: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            },
          },
          match(assets.get("video-other") as AssetRecord),
        ];
      },
      async resolvePlaybackUrl(value) {
        return value.stream?.hlsMasterUrl ?? null;
      },
      random: () => 0,
      emitMetric(metric) {
        metrics.push(metric);
      },
    };

    const result = await createHandler(dependencies)(event(request));
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(queries.map(({ assetType }) => assetType).sort()).toEqual(["audio", "video"]);
    expect(queries.every(({ limit }) => limit === 100)).toBe(true);
    expect(body.comboId).toBe("public-video-current-audio-near");
    expect(body.selection).toEqual({
      schemaVersion: "combo-selection/v1",
      requestedMode: "walk",
      resolvedMode: "walk",
      predictorVersion: "combo-tone-predictor/v0",
      distance: expect.any(Number),
    });
    expect(body.selection.distance).toBeCloseTo(0.036);
    expect(metrics).toEqual([expect.objectContaining({ statusCode: 200, resolvedMode: "walk" })]);
  });

  it("returns an explicit random fallback when vector lookup fails", async () => {
    const assets = new Map(
      [
        asset("audio-current", "audio", 0),
        asset("video-current", "video", 0),
        asset("audio-fallback", "audio", 0),
        asset("video-fallback", "video", 0),
      ].map((value) => [value.id, value])
    );
    const metrics: Array<{ statusCode: number; resolvedMode: string; fallbackReason?: string }> =
      [];
    const dependencies: PublicComboSelectionDependencies = {
      async getAsset(assetId) {
        return assets.get(assetId) ?? null;
      },
      async listPublicReadyAssets(type) {
        return type === "audio"
          ? [assets.get("audio-fallback") as AssetRecord]
          : [assets.get("video-fallback") as AssetRecord];
      },
      async queryNearest() {
        throw new Error("vector service unavailable");
      },
      async resolvePlaybackUrl(value) {
        return value.stream?.hlsMasterUrl ?? null;
      },
      random: () => 0,
      emitMetric(metric) {
        metrics.push(metric);
      },
    };

    const result = await createHandler(dependencies)(event(request));
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.comboId).toBe("public-video-fallback-audio-fallback");
    expect(body.selection).toEqual({
      schemaVersion: "combo-selection/v1",
      requestedMode: "walk",
      resolvedMode: "random",
      predictorVersion: "combo-tone-predictor/v0",
      fallbackReason: "vector_query_failed",
    });
    expect(metrics).toEqual([
      expect.objectContaining({
        statusCode: 200,
        resolvedMode: "random",
        fallbackReason: "vector_query_failed",
      }),
    ]);
  });

  it("relaxes recent history for fallback without repeating the current audio", async () => {
    const assets = new Map(
      [
        asset("audio-current", "audio", 0),
        asset("video-current", "video", 0),
        asset("audio-fallback", "audio", 0),
        asset("video-fallback", "video", 0),
      ].map((value) => [value.id, value])
    );
    const dependencies: PublicComboSelectionDependencies = {
      async getAsset(assetId) {
        return assets.get(assetId) ?? null;
      },
      async listPublicReadyAssets(type) {
        return type === "audio"
          ? [
              assets.get("audio-current") as AssetRecord,
              assets.get("audio-fallback") as AssetRecord,
            ]
          : [assets.get("video-fallback") as AssetRecord];
      },
      async queryNearest() {
        return [];
      },
      async resolvePlaybackUrl(value) {
        return value.stream?.hlsMasterUrl ?? null;
      },
      random: () => 0,
      emitMetric() {},
    };

    const result = await createHandler(dependencies)(
      event({
        ...request,
        history: {
          recentAudioAssetIds: ["audio-fallback"],
          recentComboIds: ["public-video-fallback-audio-fallback"],
        },
      })
    );
    const body = JSON.parse(result.body);

    expect(result.statusCode).toBe(200);
    expect(body.audioAssetId).toBe("audio-fallback");
    expect(body.audioAssetId).not.toBe("audio-current");
    expect(body.selection.fallbackReason).toBe("no_walk_candidates");
  });

  it("rejects a current asset that is not tone-walk eligible", async () => {
    const dependencies = unusedDependencies();
    dependencies.getAsset = async (assetId) =>
      assetId === "audio-current"
        ? { ...asset("audio-current", "audio", 0), visibility: "private" }
        : asset("video-current", "video", 0);

    const result = await createHandler(dependencies)(event(request));
    expect(result.statusCode).toBe(400);
  });
});

function unusedDependencies(): PublicComboSelectionDependencies {
  return {
    async getAsset() {
      return null;
    },
    async listPublicReadyAssets() {
      return [];
    },
    async queryNearest() {
      return [];
    },
    async resolvePlaybackUrl() {
      return null;
    },
    random: () => 0,
    emitMetric() {},
  };
}

function asset(id: string, type: "audio" | "video", tone: number): AssetRecord {
  return {
    id,
    schemaVersion: 2,
    ownerEmail: "owner@example.com",
    type,
    title: id,
    description: "",
    status: "ready",
    visibility: "public",
    original: {
      bucket: "media-originals-test",
      key: `${id}.mp4`,
      size: 100,
      contentType: type === "audio" ? "audio/mp4" : "video/mp4",
    },
    tags: [],
    stream: { hlsMasterUrl: `https://example.com/${id}.m3u8` },
    toneAnalysis: {
      status: "ready",
      profile: "openai-primary-v1",
      toneTaxonomyVersion: "tone-taxonomy/v2",
      scores: {
        valence: tone,
        arousal: tone,
        dominance: tone,
        warmth: tone,
        tension: tone,
        intimacy: tone,
        instability: tone,
        nostalgia: tone,
        beauty: tone,
        menace: tone,
      },
      updatedAt: "2026-08-03T12:00:00.000Z",
    },
    createdAt: "2026-08-03T12:00:00.000Z",
    updatedAt: "2026-08-03T12:00:00.000Z",
  };
}

function match(value: AssetRecord): AssetToneVectorMatch {
  return {
    record: buildAssetToneVectorRecord({
      assetId: value.id,
      assetType: value.type as "audio" | "video",
      modelScores: value.toneAnalysis?.scores ?? {},
      adjustedScores: value.toneAnalysis?.adjustedScores,
      visibility: value.visibility,
      assetStatus: value.status,
      toneStatus: value.toneAnalysis?.status ?? "not_started",
      updatedAt: value.updatedAt,
    }),
    distance: 0,
  };
}
