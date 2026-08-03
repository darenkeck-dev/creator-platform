import { describe, expect, it } from "bun:test";

import {
  PublicComboSelectionRequestSchema,
  PublicComboSelectionResponseSchema,
} from "../src/index.js";

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
      },
    };

    expect(
      PublicComboSelectionRequestSchema.safeParse({ ...request, mode: "search" }).success
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
});
