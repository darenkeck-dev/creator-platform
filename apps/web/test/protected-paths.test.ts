// @ts-expect-error -- Bun supplies this runtime module; the browser app does not include Bun types.
import { describe, expect, it } from "bun:test";

import { isProtectedPath } from "../lib/protected-paths";

describe("authenticated release paths", () => {
  it.each(["/releases", "/releases/new", "/releases/123"])("protects %s", (pathname: string) => {
    expect(isProtectedPath(pathname)).toBe(true);
  });

  it("does not match unrelated prefixes", () => {
    expect(isProtectedPath("/releases-public")).toBe(false);
  });
});
