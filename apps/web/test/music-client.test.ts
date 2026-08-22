// @ts-expect-error -- Bun supplies this runtime module; the browser app does not include Bun types.
import { afterEach, describe, expect, it } from "bun:test";
import { MusicReadinessResponseSchema } from "@media-manager/contracts";

import { MusicClientError, musicErrorMessage, musicRequest } from "../lib/music-client";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("musicRequest", () => {
  it("parses contract-valid responses", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          schemaVersion: "music-readiness-response/v1",
          ready: false,
          issues: [
            {
              code: "cover_missing",
              entityType: "release",
              entityId: "release-1",
              message: "Cover asset is required",
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )) as typeof fetch;

    const result = await musicRequest(
      "releases/release-1/readiness",
      MusicReadinessResponseSchema
    );
    expect(result.ready).toBe(false);
    expect(result.issues[0]?.code).toBe("cover_missing");
  });

  it("preserves upstream status and message payloads", async () => {
    const payload = {
      message: "Music record is not ready to publish",
      issues: [{ code: "cover_missing" }],
    };
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(payload), {
        status: 409,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;

    try {
      await musicRequest("releases/release-1/publish", MusicReadinessResponseSchema, {
        method: "POST",
      });
      throw new Error("Expected request to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(MusicClientError);
      expect((error as MusicClientError).status).toBe(409);
      expect((error as MusicClientError).payload).toEqual(payload);
      expect(musicErrorMessage((error as MusicClientError).payload)).toBe(
        "Music record is not ready to publish"
      );
    }
  });

  it("rejects successful responses that violate the contract", () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ ready: true, issues: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof fetch;
    expect(
      musicRequest("releases/release-1/readiness", MusicReadinessResponseSchema)
    ).rejects.toThrow("Music response failed validation");
  });
});
