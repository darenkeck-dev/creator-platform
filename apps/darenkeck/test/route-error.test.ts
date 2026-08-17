// @ts-expect-error -- Bun supplies this runtime module; the browser app does not include Bun types.
import { describe, expect, it } from "bun:test";

import { isStaleChunkError } from "../src/components/RouteErrorPage";

describe("route error recovery", () => {
  it("recognizes invalid JavaScript MIME responses from stale chunks", () => {
    expect(
      isStaleChunkError(new TypeError("'text/html' is not a valid JavaScript MIME type."))
    ).toBe(true);
    expect(isStaleChunkError(new TypeError("Failed to fetch dynamically imported module"))).toBe(
      true
    );
  });

  it("does not classify unrelated route errors as stale chunks", () => {
    expect(isStaleChunkError(new Error("Unknown blog post"))).toBe(false);
  });
});
