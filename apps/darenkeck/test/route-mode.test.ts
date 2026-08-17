// @ts-expect-error -- Bun supplies this runtime module; the browser app does not include Bun types.
import { describe, expect, it } from "bun:test";

import { isDocumentPath, isHomePath, isResumePrintMode } from "../src/lib/route-mode";

describe("route mode", () => {
  it("classifies only the index route as home", () => {
    expect(isHomePath("/")).toBe(true);
    expect(isHomePath("/dev")).toBe(false);
  });

  it("isolates media only for the internal resume print route", () => {
    expect(isResumePrintMode("/dev", "?print=1")).toBe(true);
    expect(isResumePrintMode("/dev", "")).toBe(false);
    expect(isResumePrintMode("/", "?print=1")).toBe(false);
  });

  it("classifies persistent document routes", () => {
    expect(isDocumentPath("/dev")).toBe(true);
    expect(isDocumentPath("/blog")).toBe(true);
    expect(isDocumentPath("/blog/first-post")).toBe(true);
    expect(isDocumentPath("/news")).toBe(true);
    expect(isDocumentPath("/news/2026-08-16-site-update")).toBe(true);
    expect(isDocumentPath("/")).toBe(false);
    expect(isDocumentPath("/blogroll")).toBe(false);
    expect(isDocumentPath("/newsletter")).toBe(false);
  });
});
