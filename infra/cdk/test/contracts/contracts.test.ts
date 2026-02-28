/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";
import {
  AssetRecordSchema,
  AssetConversionInfoSchema,
  CreateAssetInputSchema,
  MultipartCompleteInputSchema,
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

  it("requires multipart complete parts to be non-empty", () => {
    const parsed = MultipartCompleteInputSchema.safeParse({
      uploadId: "upload-1",
      parts: [],
    });

    expect(parsed.success).toBe(false);
  });
});
