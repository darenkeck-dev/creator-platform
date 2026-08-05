import { describe, expect, it } from "bun:test";

import {
  PublicComboPredictedToneSchema,
  PublicComboSelectionRequestSchema,
  PublicComboSelectionResponseSchema,
  PublicRandomComboResponseSchema,
} from "../src/index.js";

const predictedTone = {
  valence: 0.1,
  arousal: 0.2,
  dominance: 0.3,
  warmth: 0.4,
  tension: 0.5,
  intimacy: 0.6,
  instability: 0.7,
  nostalgia: 0.8,
  beauty: 0.9,
  menace: 1,
};

describe("public combo selection contracts", () => {
  it("parses a walk request with bounded default history", () => {
    expect(
      PublicComboSelectionRequestSchema.parse({
        schemaVersion: "public-combo-selection-request/v1",
        mode: "walk",
        current: {
          audioAssetId: "audio-1",
          videoAssetId: "video-1",
        },
      })
    ).toEqual({
      schemaVersion: "public-combo-selection-request/v1",
      mode: "walk",
      current: {
        audioAssetId: "audio-1",
        videoAssetId: "video-1",
      },
      history: {
        recentComboIds: [],
        recentAudioAssetIds: [],
        recentVideoAssetIds: [],
      },
    });
  });

  it("parses a combined tone-word search request", () => {
    expect(
      PublicComboSelectionRequestSchema.parse({
        schemaVersion: "public-combo-selection-request/v1",
        mode: "search",
        keywords: ["serene", "loving"],
      })
    ).toEqual({
      schemaVersion: "public-combo-selection-request/v1",
      mode: "search",
      keywords: ["serene", "loving"],
      history: {
        recentComboIds: [],
        recentAudioAssetIds: [],
        recentVideoAssetIds: [],
      },
    });
  });

  it("rejects unsupported modes, unknown fields, and oversized history", () => {
    const request = {
      schemaVersion: "public-combo-selection-request/v1",
      mode: "walk",
      current: {
        audioAssetId: "audio-1",
        videoAssetId: "video-1",
      },
      history: {
        recentComboIds: ["1", "2", "3", "4", "5"],
        recentAudioAssetIds: ["1", "2", "3"],
        recentVideoAssetIds: ["1", "2", "3"],
      },
    };

    expect(
      PublicComboSelectionRequestSchema.safeParse({ ...request, mode: "random" }).success
    ).toBe(false);
    expect(
      PublicComboSelectionRequestSchema.safeParse({ ...request, unexpected: true }).success
    ).toBe(false);
    expect(
      PublicComboSelectionRequestSchema.safeParse({
        ...request,
        history: { ...request.history, recentComboIds: ["1", "2", "3", "4", "5", "6"] },
      }).success
    ).toBe(false);
    expect(
      PublicComboSelectionRequestSchema.safeParse({
        ...request,
        history: { ...request.history, recentAudioAssetIds: ["1", "2", "3", "4"] },
      }).success
    ).toBe(false);
    expect(
      PublicComboSelectionRequestSchema.safeParse({
        ...request,
        history: { ...request.history, recentVideoAssetIds: ["1", "2", "3", "4"] },
      }).success
    ).toBe(false);
  });

  it("requires exact walk and random fallback metadata", () => {
    const playback = {
      schemaVersion: "public-combo-selection-response/v1",
      comboId: "public-video-2-audio-2",
      videoAssetId: "video-2",
      audioAssetId: "audio-2",
      videoTitle: "Video 2",
      audioTitle: "Audio 2",
      videoSrc: "https://example.com/video.m3u8",
      audioSrc: "https://example.com/audio.m3u8",
    };

    expect(
      PublicComboSelectionResponseSchema.safeParse({
        ...playback,
        selection: {
          schemaVersion: "combo-selection/v1",
          requestedMode: "search",
          resolvedMode: "search",
          predictorVersion: "combo-tone-predictor/v0",
          distance: 0.1,
          queryDimensions: ["valence", "warmth"],
        },
      }).success
    ).toBe(true);
    expect(
      PublicComboSelectionResponseSchema.safeParse({
        ...playback,
        selection: {
          schemaVersion: "combo-selection/v1",
          requestedMode: "walk",
          resolvedMode: "walk",
          predictorVersion: "combo-tone-predictor/v0",
          distance: 0.25,
        },
      }).success
    ).toBe(true);
    expect(
      PublicComboSelectionResponseSchema.safeParse({
        ...playback,
        selection: {
          schemaVersion: "combo-selection/v1",
          requestedMode: "walk",
          resolvedMode: "random",
          predictorVersion: "combo-tone-predictor/v0",
          fallbackReason: "no_walk_candidates",
        },
      }).success
    ).toBe(true);
    expect(
      PublicComboSelectionResponseSchema.safeParse({
        ...playback,
        selection: {
          schemaVersion: "combo-selection/v1",
          requestedMode: "walk",
          resolvedMode: "walk",
          predictorVersion: "combo-tone-predictor/v0",
        },
      }).success
    ).toBe(false);
  });

  it("accepts complete predicted combo tone and rejects partial or unbounded values", () => {
    const playback = {
      comboId: "public-video-2-audio-2",
      videoAssetId: "video-2",
      audioAssetId: "audio-2",
      videoTitle: "Video 2",
      audioTitle: "Audio 2",
      videoSrc: "https://example.com/video.m3u8",
      audioSrc: "https://example.com/audio.m3u8",
      predictedTone,
    };

    expect(
      PublicRandomComboResponseSchema.safeParse({
        ...playback,
        source: "derived",
        selection: "primary",
      }).success
    ).toBe(true);
    expect(
      PublicComboPredictedToneSchema.safeParse({ ...predictedTone, menace: 1.1 }).success
    ).toBe(false);
    const { menace: _menace, ...partialTone } = predictedTone;
    expect(PublicComboPredictedToneSchema.safeParse(partialTone).success).toBe(false);
  });
});
