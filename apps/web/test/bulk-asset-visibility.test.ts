// @ts-expect-error -- Bun supplies this runtime module; the browser app does not include Bun types.
import { describe, expect, it } from "bun:test";

import { updateBulkAssetVisibility } from "../lib/bulk-asset-visibility";

type FetchImpl = typeof globalThis.fetch;

describe("updateBulkAssetVisibility", () => {
  it("PATCHes encoded asset URLs with the visibility payload", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(input), init });
      return new Response(null, { status: 204 });
    }) as FetchImpl;

    const result = await updateBulkAssetVisibility(
      [{ id: "asset/one two?", type: "video" }],
      "public",
      { fetch: fetchImpl }
    );

    expect(requests).toEqual([
      {
        url: "/api/assets/asset%2Fone%20two%3F",
        init: {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ visibility: "public" }),
        },
      },
    ]);
    expect(result).toEqual({
      updatedIds: ["asset/one two?"],
      failedIds: [],
      skippedFolderIds: [],
    });
  });

  it("respects the configured concurrency cap", async () => {
    let active = 0;
    let peak = 0;
    const fetchImpl = (async () => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return new Response(null, { status: 204 });
    }) as FetchImpl;

    await updateBulkAssetVisibility(
      Array.from({ length: 7 }, (_, index) => ({ id: String(index), type: "image" })),
      "private",
      { fetch: fetchImpl, concurrency: 2 }
    );

    expect(peak).toBe(2);
  });

  it("reports non-OK responses and rejected requests as partial failures", async () => {
    const fetchImpl = (async (input: string | URL | Request) => {
      const id = String(input).split("/").pop();
      if (id === "network-error") throw new Error("network error");
      return new Response(null, { status: id === "server-error" ? 500 : 204 });
    }) as FetchImpl;

    const result = await updateBulkAssetVisibility(
      [
        { id: "ok", type: "audio" },
        { id: "server-error", type: "video" },
        { id: "network-error", type: "image" },
      ],
      "private",
      { fetch: fetchImpl }
    );

    expect(result).toEqual({
      updatedIds: ["ok"],
      failedIds: ["server-error", "network-error"],
      skippedFolderIds: [],
    });
  });

  it("skips folders without making requests", async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return new Response(null, { status: 204 });
    }) as FetchImpl;

    const result = await updateBulkAssetVisibility(
      [
        { id: "folder-a", type: "folder" },
        { id: "asset-a", type: "audio" },
        { id: "folder-b", type: "folder" },
      ],
      "public",
      { fetch: fetchImpl }
    );

    expect(calls).toBe(1);
    expect(result).toEqual({
      updatedIds: ["asset-a"],
      failedIds: [],
      skippedFolderIds: ["folder-a", "folder-b"],
    });
  });

  it("returns each result group in deterministic input order", async () => {
    const delays: Record<string, number> = { first: 15, second: 1, third: 5, fourth: 0 };
    const fetchImpl = (async (input: string | URL | Request) => {
      const id = String(input).split("/").pop() ?? "";
      await new Promise((resolve) => setTimeout(resolve, delays[id]));
      return new Response(null, { status: id === "second" || id === "fourth" ? 500 : 204 });
    }) as FetchImpl;

    const result = await updateBulkAssetVisibility(
      [
        { id: "first", type: "video" },
        { id: "folder-first", type: "folder" },
        { id: "second", type: "audio" },
        { id: "third", type: "image" },
        { id: "folder-second", type: "folder" },
        { id: "fourth", type: "video" },
      ],
      "public",
      { fetch: fetchImpl, concurrency: 4 }
    );

    expect(result).toEqual({
      updatedIds: ["first", "third"],
      failedIds: ["second", "fourth"],
      skippedFolderIds: ["folder-first", "folder-second"],
    });
  });
});
