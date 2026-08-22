/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";
import {
  AssetRecordSchema,
  AssetConversionInfoSchema,
  CreateAssetInputSchema,
  CreateComboInputSchema,
  ComboVoteInputSchema,
  MultipartCompleteInputSchema,
  JobPreviewInputSchema,
  JobRecordSchema,
  ToneReviewInputSchema,
} from "@media-manager/contracts";

describe("contracts", () => {
  it("accepts conversion metadata payload on asset record", () => {
    const parsed = AssetRecordSchema.safeParse({
      id: "asset-1",
      schemaVersion: 1,
      ownerEmail: "owner@example.com",
      type: "video",
      title: "My clip",
      description: "desc",
      status: "processing",
      original: {
        bucket: "media-originals-test",
        key: "incoming/asset-1",
        size: 1200,
        contentType: "video/mp4",
      },
      tags: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      processingProfile: "video-standard-v1",
      conversion: {
        status: "processing",
        profile: "video-standard-v1",
        jobId: "12345",
        updatedAt: "2026-01-01T00:00:01.000Z",
      },
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects invalid conversion status", () => {
    const parsed = AssetConversionInfoSchema.safeParse({
      status: "stuck",
      profile: "video-standard-v1",
      updatedAt: "2026-01-01T00:00:01.000Z",
    });

    expect(parsed.success).toBe(false);
  });

  it("supports upload-time processing profile on create", () => {
    const parsed = CreateAssetInputSchema.safeParse({
      type: "audio",
      title: "Podcast",
      description: "Episode 1",
      processingProfile: "audio-passthrough-v1",
    });

    expect(parsed.success).toBe(true);
  });

  it("defaults assets to listed and accepts unlisted release uploads", () => {
    expect(
      CreateAssetInputSchema.parse({ type: "audio", title: "Library" }).libraryVisibility
    ).toBe("listed");
    expect(
      CreateAssetInputSchema.parse({
        type: "audio",
        title: "Release",
        libraryVisibility: "unlisted",
      }).libraryVisibility
    ).toBe("unlisted");
  });

  it("accepts audio transcode processing profile on create", () => {
    const parsed = CreateAssetInputSchema.safeParse({
      type: "audio",
      title: "Podcast",
      description: "Episode 2",
      processingProfile: "audio-transcode-hls-v1",
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts AAC passthrough HLS packaging on create", () => {
    expect(
      CreateAssetInputSchema.parse({
        type: "audio",
        title: "Packaged master",
        processingProfile: "audio-package-hls-v1",
      }).processingProfile
    ).toBe("audio-package-hls-v1");
  });

  it("accepts generated provenance metadata on create", () => {
    const parsed = CreateAssetInputSchema.safeParse({
      type: "video",
      title: "AI clip",
      description: "generated",
      origin: "generated",
      generation: {
        provider: "openai",
        model: "sora-v1",
        workflowId: "wf-1",
        promptHash: "abc123",
        seed: 42,
        createdBy: "owner@example.com",
      },
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects generated provenance fields when origin is uploaded", () => {
    const parsed = CreateAssetInputSchema.safeParse({
      type: "video",
      title: "Uploaded clip",
      origin: "uploaded",
      generation: {
        provider: "openai",
        model: "sora-v1",
        workflowId: "wf-1",
        promptHash: "abc123",
        createdBy: "owner@example.com",
      },
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects derived origin without sourceAssetIds", () => {
    const parsed = CreateAssetInputSchema.safeParse({
      type: "video",
      title: "Derived clip",
      origin: "derived",
    });

    expect(parsed.success).toBe(false);
  });

  it("requires multipart complete parts to be non-empty", () => {
    const parsed = MultipartCompleteInputSchema.safeParse({
      uploadId: "upload-1",
      parts: [],
    });

    expect(parsed.success).toBe(false);
  });

  it("supports combo create and vote payloads", () => {
    const comboParsed = CreateComboInputSchema.safeParse({
      videoAssetId: "video-1",
      audioAssetId: "audio-1",
      playback: {
        gainDb: -2,
      },
    });
    const voteParsed = ComboVoteInputSchema.safeParse({ action: "up" });

    expect(comboParsed.success).toBe(true);
    expect(voteParsed.success).toBe(true);
  });

  it("supports tone review payloads", () => {
    const parsed = ToneReviewInputSchema.safeParse({
      targetType: "combo",
      targetId: "combo-1",
      reviewSource: "curator",
      taxonomyVersion: "tone-taxonomy/v2",
      keywords: ["warm", "calm"],
      scores: {
        valence: 0.5,
        arousal: -0.25,
      },
      modelScoresSnapshot: {
        valence: 0.25,
      },
      notes: "Good fit.",
    });

    expect(parsed.success).toBe(true);
  });

  it("supports generic asset job preview and progress records", () => {
    const previewInput = JobPreviewInputSchema.safeParse({
      type: "reprocess_conversion",
      target: {
        assetIds: ["folder-1"],
        includeDescendants: true,
      },
      options: {
        processingProfile: "video-standard-v1",
      },
    });
    const job = JobRecordSchema.safeParse({
      id: "job-1",
      schemaVersion: 1,
      ownerEmail: "owner@example.com",
      type: "reprocess_tone",
      status: "running",
      target: {
        assetIds: ["folder-1"],
        includeDescendants: true,
      },
      options: {},
      totalItems: 3,
      completedItems: 1,
      failedItems: 0,
      skippedItems: 0,
      message: "Deleting item",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:01.000Z",
    });

    expect(previewInput.success).toBe(true);
    expect(job.success).toBe(true);
  });
});
