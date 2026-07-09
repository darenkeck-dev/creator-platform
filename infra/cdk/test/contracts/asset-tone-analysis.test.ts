/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test";

import { AssetRecordSchema } from "@media-manager/contracts";

describe("asset tone analysis contract", () => {
  it("accepts optional tone analysis artifact metadata", () => {
    const parsed = AssetRecordSchema.parse({
      id: "asset-123",
      schemaVersion: 1,
      ownerEmail: "owner@example.com",
      type: "video",
      title: "Demo Video",
      description: "",
      status: "ready",
      visibility: "public",
      original: {
        bucket: "media-originals-test",
        key: "incoming/asset-123/video.mp4",
        size: 1024,
        contentType: "video/mp4",
      },
      tags: [],
      createdAt: "2026-07-06T00:00:00.000Z",
      updatedAt: "2026-07-06T00:00:00.000Z",
      toneAnalysis: {
        status: "ready",
        profile: "openai-primary-v1",
        updatedAt: "2026-07-06T00:01:00.000Z",
        completedAt: "2026-07-06T00:01:00.000Z",
        analysisSchemaVersion: "asset-analysis/v1",
        bundleSchemaVersion: "tone-analysis-bundle/v1",
        toneTaxonomyVersion: "tone-taxonomy/v2",
        analysisBucket: "media-derived-test",
        analysisKey: "derived/asset-123/tone/asset-analysis.json",
        bundleBucket: "media-derived-test",
        bundleKey: "derived/asset-123/tone/asset-123.tonebundle.tar.gz",
        modelRuns: [{ kind: "video-semantic-tone", modelName: "gpt-5" }],
        summary: "A delicate, relaxed, subdued tone.",
        primaryWords: ["delicate", "relaxed", "subdued"],
        secondaryWords: ["beautiful", "safe", "distant"],
        avoidWords: ["urgent", "chaotic"],
        scores: {
          valence: 0.52,
          arousal: -0.8,
          warmth: 0.6,
          tension: -0.82,
        },
        semanticSummary: "Soft pastel clouds drift across a calm sky.",
        caption: "Pastel sky study.",
        mood: "relaxed, subdued, delicate",
      },
    });

    expect(parsed.toneAnalysis?.status).toBe("ready");
    expect(parsed.toneAnalysis?.toneTaxonomyVersion).toBe("tone-taxonomy/v2");
    expect(parsed.toneAnalysis?.summary).toContain("delicate");
    expect(parsed.toneAnalysis?.scores?.arousal).toBe(-0.8);
  });

  it("accepts public asset audit log entries", () => {
    const parsed = AssetRecordSchema.parse({
      id: "asset-123",
      schemaVersion: 1,
      ownerEmail: "owner@example.com",
      type: "audio",
      title: "Demo Audio",
      description: "",
      status: "processing",
      visibility: "private",
      original: {
        bucket: "media-originals-test",
        key: "incoming/asset-123/audio.mp3",
        size: 1024,
        contentType: "audio/mpeg",
      },
      tags: [],
      createdAt: "2026-07-06T00:00:00.000Z",
      updatedAt: "2026-07-06T00:02:00.000Z",
      auditLog: [
        {
          id: "log-1",
          at: "2026-07-06T00:01:00.000Z",
          category: "audio_conversion",
          level: "info",
          source: "upload-trigger",
          code: "conversion.queued",
          message: "Audio conversion: processing queued",
          details: { profile: "audio-transcode-hls-v1" },
        },
      ],
    });

    expect(parsed.auditLog?.[0]?.category).toBe("audio_conversion");
  });
});
