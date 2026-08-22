// @ts-expect-error -- Bun supplies this runtime module; the browser app does not include Bun types.
import { describe, expect, it } from "bun:test";
import type { AssetRecord, MusicTrackRecord } from "@media-manager/contracts";

import {
  canAddTrackCount,
  findTrackByAssetId,
  issuesForEntity,
  moveItem,
  mergeAuthoritativeTracks,
  remainingTrackCapacity,
  removeCatalogTrack,
  toneWarnings,
  updatePurchaseLink,
  upsertCatalogTrack,
} from "../lib/music-ui";
import { runWithConcurrency } from "../lib/upload-files";

describe("music ordering", () => {
  it("moves tracks without mutating input and ignores invalid moves", () => {
    const tracks = ["one", "two", "three"];
    expect(moveItem(tracks, 1, -1)).toEqual(["two", "one", "three"]);
    expect(moveItem(tracks, 0, -1)).toEqual(tracks);
    expect(tracks).toEqual(["one", "two", "three"]);
  });

  it("retains selected-file order despite concurrent completion order", async () => {
    const selected = ["slow.wav", "fast.wav", "middle.wav"];
    const completed: string[] = [];
    const results = await runWithConcurrency(selected, 3, async (name, index) => {
      await new Promise((resolve) => setTimeout(resolve, index === 0 ? 8 : index === 1 ? 1 : 4));
      completed.push(name);
      return `${name}-track`;
    });
    expect(completed).not.toEqual(selected);
    expect(results.map((result) => (result.ok ? result.value : null))).toEqual([
      "slow.wav-track",
      "fast.wav-track",
      "middle.wav-track",
    ]);
  });
});

describe("release track capacity", () => {
  it("rejects batches that cannot all be linked before upload begins", () => {
    expect(remainingTrackCapacity(18)).toBe(2);
    expect(canAddTrackCount(18, 2)).toBe(true);
    expect(canAddTrackCount(18, 3)).toBe(false);
    expect(remainingTrackCapacity(25)).toBe(0);
  });
});

describe("local catalog state", () => {
  it("removes deleted tracks and permits a fresh record for the same asset", () => {
    const first = { id: "track-1", assetId: "asset-1" };
    const deleted = removeCatalogTrack([first], first.id);
    expect(deleted).toEqual([]);
    const replacement = { id: "track-2", assetId: "asset-1" };
    expect(upsertCatalogTrack(deleted, replacement)).toEqual([replacement]);
  });

  it("replaces a revised record without duplicating or reordering other records", () => {
    const revised = { id: "track-1", revision: 2 };
    expect(
      upsertCatalogTrack(
        [
          { id: "track-2", revision: 1 },
          { id: "track-1", revision: 1 },
        ],
        revised
      )
    ).toEqual([revised, { id: "track-2", revision: 1 }]);
  });

  it("merges authoritative revisions only into clean track drafts", () => {
    const base: MusicTrackRecord = {
      schemaVersion: "music-track/v1",
      id: "track-1",
      assetId: "asset-1",
      revision: 1,
      ownerEmail: "owner@example.com",
      title: "Server title",
      purchaseLinks: [{ label: "Store", url: "https://example.com" }],
      publicationStatus: "draft",
      standalonePublished: false,
      createdAt: "2026-08-20T12:00:00.000Z",
      updatedAt: "2026-08-20T12:00:00.000Z",
    };
    const authoritative = { ...base, revision: 2 };
    const dirty = { ...base, title: "Unsaved local title" };
    expect(mergeAuthoritativeTracks([base], [authoritative], new Set())).toEqual([
      authoritative,
    ]);
    expect(mergeAuthoritativeTracks([dirty], [authoritative], new Set())).toEqual([
      authoritative,
    ]);
    expect(
      mergeAuthoritativeTracks([dirty], [authoritative], new Set([dirty.id]))
    ).toEqual([dirty]);
  });

  it("reconciles an ambiguous create by its preserved asset identity", () => {
    const existing: MusicTrackRecord = {
      schemaVersion: "music-track/v1",
      id: "track-9",
      assetId: "asset-recovery",
      revision: 1,
      ownerEmail: "owner@example.com",
      title: "Recovered track",
      purchaseLinks: [],
      publicationStatus: "draft",
      standalonePublished: false,
      createdAt: "2026-08-20T12:00:00.000Z",
      updatedAt: "2026-08-20T12:00:00.000Z",
    };
    expect(findTrackByAssetId([existing], "asset-recovery")).toBe(existing);
    expect(findTrackByAssetId([existing], "other-asset")).toBeUndefined();
  });
});

describe("purchase links", () => {
  it("edits one field without changing link order", () => {
    const links = [
      { label: "Bandcamp", url: "https://example.com/a" },
      { label: "Store", url: "https://example.com/b" },
    ];
    expect(updatePurchaseLink(links, 1, "label", "Vinyl")).toEqual([
      links[0],
      { label: "Vinyl", url: "https://example.com/b" },
    ]);
    expect(links[1]?.label).toBe("Store");
  });
});

describe("readiness presentation", () => {
  it("associates track and asset blockers and keeps tone analysis warning-only", () => {
    const issues = [
      { code: "track_purchase_links_empty", entityType: "track" as const, entityId: "track-1", message: "Track requires a purchase link" },
      { code: "asset_not_ready", entityType: "asset" as const, entityId: "asset-1", message: "Asset is not ready" },
      { code: "cover_missing", entityType: "release" as const, entityId: "release-1", message: "Cover asset is required" },
    ];
    expect(issuesForEntity(issues, "track-1", "asset-1").map((issue) => issue.code)).toEqual([
      "track_purchase_links_empty",
      "asset_not_ready",
    ]);

    const asset = {
      id: "asset-1",
      type: "audio",
      title: "First Track",
      toneAnalysis: { status: "processing" },
    } as AssetRecord;
    expect(toneWarnings([asset])).toEqual([
      "First Track: tone analysis is processing. This does not block publishing.",
    ]);
  });
});
