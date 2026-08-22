// @ts-expect-error -- Bun supplies this runtime module; the browser app does not include Bun types.
import { describe, expect, it } from "bun:test";

import { UpstreamApiError, throwUpstreamApiError } from "../lib/upstream-api-error";

describe("upstream API errors", () => {
  it("preserves music-guard conflict status and message", async () => {
    const response = new Response(
      JSON.stringify({ message: "Asset is linked to official music" }),
      { status: 409, headers: { "content-type": "application/json" } }
    );
    try {
      await throwUpstreamApiError(response, "Failed to delete asset");
      throw new Error("Expected conflict");
    } catch (error) {
      expect(error).toBeInstanceOf(UpstreamApiError);
      expect((error as UpstreamApiError).status).toBe(409);
      expect((error as UpstreamApiError).payload).toEqual({
        message: "Asset is linked to official music",
      });
      expect((error as Error).message).toBe("Asset is linked to official music");
    }
  });
});
