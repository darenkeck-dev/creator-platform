import { describe, expect, it } from "bun:test";
import {
  CreateMusicReleaseInputSchema,
  CreateMusicTrackInputSchema,
  MusicReleaseRecordSchema,
  MusicPublicationActionInputSchema,
  MusicDeleteInputSchema,
  MusicTrackRecordSchema,
  PublicMusicCatalogResponseSchema,
  PurchaseLinkSchema,
  UpdateMusicTrackInputSchema,
} from "../src";

const id = "00000000-0000-4000-8000-000000000001";
const now = "2026-08-20T12:00:00.000Z";

describe("music catalog contracts", () => {
  it("accepts draft records and rejects unknown fields", () => {
    expect(
      MusicTrackRecordSchema.parse({
        schemaVersion: "music-track/v1",
        id,
        revision: 1,
        ownerEmail: "owner@example.com",
        title: "Track",
        assetId: "audio-1",
        purchaseLinks: [],
        publicationStatus: "draft",
        standalonePublished: false,
        createdAt: now,
        updatedAt: now,
      }).purchaseLinks
    ).toEqual([]);
    expect(
      CreateMusicTrackInputSchema.safeParse({
        schemaVersion: "music-track-create/v1",
        title: "Track",
        assetId: "audio-1",
        extra: true,
      }).success
    ).toBe(false);
  });

  it("requires HTTPS purchase links", () => {
    expect(
      PurchaseLinkSchema.safeParse({ label: "Buy", url: "http://example.com/buy" }).success
    ).toBe(false);
    expect(
      PurchaseLinkSchema.safeParse({ label: "Buy", url: "https://example.com/buy" }).success
    ).toBe(true);
    expect(
      CreateMusicTrackInputSchema.safeParse({
        schemaVersion: "music-track-create/v1",
        title: "Track",
        assetId: "audio-1",
        purchaseLinks: [{ label: "Buy", url: "http://example.com/buy" }],
      }).success
    ).toBe(false);
  });

  it("requires expected revisions for updates and publication actions", () => {
    expect(
      UpdateMusicTrackInputSchema.safeParse({
        schemaVersion: "music-track-update/v1",
        title: "Changed",
      }).success
    ).toBe(false);
    expect(
      MusicPublicationActionInputSchema.safeParse({
        schemaVersion: "music-publication-action/v1",
        expectedRevision: 3,
      }).success
    ).toBe(true);
    expect(
      MusicDeleteInputSchema.safeParse({
        schemaVersion: "music-publication-action/v1",
        expectedRevision: 3,
      }).success
    ).toBe(true);
    expect(
      MusicDeleteInputSchema.safeParse({ schemaVersion: "music-publication-action/v1" }).success
    ).toBe(false);
  });

  it("validates calendar dates, ordered unique tracks, and the release cap", () => {
    const input = {
      schemaVersion: "music-release-create/v1" as const,
      title: "Release",
      releaseDate: "2026-02-29",
      trackIds: [id, id],
    };
    expect(CreateMusicReleaseInputSchema.safeParse(input).success).toBe(false);
    expect(
      CreateMusicReleaseInputSchema.safeParse({
        ...input,
        releaseDate: "2028-02-29",
        trackIds: [id],
      }).success
    ).toBe(true);
  });

  it("allows incomplete draft releases but requires complete public releases", () => {
    expect(
      MusicReleaseRecordSchema.safeParse({
        schemaVersion: "music-release/v1",
        id,
        revision: 1,
        ownerEmail: "owner@example.com",
        title: "Draft",
        trackIds: [],
        purchaseLinks: [],
        publicationStatus: "draft",
        createdAt: now,
        updatedAt: now,
      }).success
    ).toBe(true);
    expect(
      PublicMusicCatalogResponseSchema.safeParse({
        schemaVersion: "public-music-catalog/v1",
        tracks: [],
        releases: [{ id, title: "Incomplete" }],
      }).success
    ).toBe(false);
  });
});
