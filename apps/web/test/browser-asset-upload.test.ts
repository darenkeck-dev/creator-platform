// @ts-expect-error -- Bun supplies this runtime module; the browser app does not include Bun types.
import { afterEach, describe, expect, it } from "bun:test";

import { AssetUploadError, uploadAssetFile } from "../lib/browser-asset-upload";

const originalFetch = globalThis.fetch;
const now = "2026-08-20T12:00:00.000Z";
const draftAsset = {
  id: "asset-recovery-1",
  schemaVersion: 1,
  ownerEmail: "owner@example.com",
  type: "audio" as const,
  title: "Recovery",
  description: "",
  status: "draft" as const,
  visibility: "private" as const,
  libraryVisibility: "unlisted" as const,
  original: {
    bucket: "originals",
    key: "asset-recovery-1/source",
    size: 0,
    contentType: "audio/wav",
  },
  tags: [],
  createdAt: now,
  updatedAt: now,
};

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("music asset upload recovery", () => {
  it("retains the created asset when upload signing fails", async () => {
    const calls: string[] = [];
    let createBody: Record<string, unknown> | undefined;
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      calls.push(url);
      if (url === "/api/assets") {
        createBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return Response.json({ asset: draftAsset }, { status: 201 });
      }
      return Response.json({ message: "Signing unavailable" }, { status: 503 });
    }) as typeof fetch;

    try {
      await uploadAssetFile(
        new File(["audio"], "recovery.wav", { type: "audio/wav" }),
        "audio",
        undefined,
        "unlisted"
      );
      throw new Error("Expected signing failure");
    } catch (error) {
      expect(error).toBeInstanceOf(AssetUploadError);
      expect((error as AssetUploadError).asset.id).toBe(draftAsset.id);
      expect((error as AssetUploadError).stage).toBe("signing");
      expect((error as Error).message).toBe("Signing unavailable");
    }
    expect(calls).toEqual(["/api/assets", `/api/assets/${draftAsset.id}/upload-url`]);
    expect(createBody?.libraryVisibility).toBe("unlisted");
  });

  it("reuses an already uploaded asset without uploading the file again", async () => {
    const uploadedAsset = { ...draftAsset, status: "uploaded" as const };
    const calls: string[] = [];
    globalThis.fetch = (async (input: string | URL | Request) => {
      calls.push(String(input));
      return Response.json({ asset: uploadedAsset });
    }) as typeof fetch;

    const result = await uploadAssetFile(
      new File(["audio"], "recovery.wav", { type: "audio/wav" }),
      "audio",
      draftAsset
    );
    expect(result.status).toBe("uploaded");
    expect(calls).toEqual([`/api/assets/${draftAsset.id}`]);
  });

  it("creates a replacement when the preserved asset no longer exists", async () => {
    const replacement = { ...draftAsset, id: "asset-replacement-2" };
    const calls: string[] = [];
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      calls.push(url);
      if (url === `/api/assets/${draftAsset.id}`) {
        return Response.json({ message: "Asset not found" }, { status: 404 });
      }
      if (url === "/api/assets") {
        return Response.json({ asset: replacement }, { status: 201 });
      }
      return Response.json({ message: "Signing unavailable" }, { status: 503 });
    }) as typeof fetch;

    try {
      await uploadAssetFile(
        new File(["audio"], "recovery.wav", { type: "audio/wav" }),
        "audio",
        draftAsset
      );
      throw new Error("Expected signing failure");
    } catch (error) {
      expect(error).toBeInstanceOf(AssetUploadError);
      expect((error as AssetUploadError).asset.id).toBe(replacement.id);
    }
    expect(calls).toEqual([
      `/api/assets/${draftAsset.id}`,
      "/api/assets",
      `/api/assets/${replacement.id}/upload-url`,
    ]);
  });
});
