// @ts-expect-error -- Bun supplies this runtime module; the browser app does not include Bun types.
import { describe, expect, it } from "bun:test";

import { buildBlogManifest, extractEmbeddedMermaid, parseBlogPost } from "../scripts/blog-content";

const post = (frontmatter: string, content = "Post body") =>
  `---\n${frontmatter}\n---\n${content}\n`;

describe("blog content preparation", () => {
  it("parses a published post and derives its slug", () => {
    expect(
      parseBlogPost(
        post("title: First Post\ndate: 2026-08-10\nsummary: A short summary"),
        "/content/posts/2026-08-10-first-post.md"
      )
    ).toEqual({
      slug: "first-post",
      title: "First Post",
      date: "2026-08-10",
      summary: "A short summary",
      content: "Post body",
    });
  });

  it("uses excerpt as index copy and removes a repeated title heading", () => {
    expect(
      parseBlogPost(
        post(
          "title: Existing Post\ndate: 2026-08-10\nexcerpt: Existing summary",
          "# Existing Post\n\nFirst paragraph"
        ),
        "/content/posts/existing-post.md"
      )
    ).toEqual({
      slug: "existing-post",
      title: "Existing Post",
      date: "2026-08-10",
      summary: "Existing summary",
      content: "First paragraph",
    });
  });

  it("excludes draft content from the manifest", () => {
    const source = post("title: Draft\ndate: 2026-08-10\ndraft: true", "Private draft");
    expect(parseBlogPost(source, "/content/posts/draft.md")).toBeNull();
    expect(buildBlogManifest([{ filePath: "draft.md", source }])).toEqual({ posts: [] });
    expect(
      parseBlogPost(
        post("title: Filename Draft\ndate: 2026-08-10"),
        "/content/posts/2026-08-10-filename-draft.md"
      )
    ).toBeNull();
  });

  it("sorts posts newest first", () => {
    const manifest = buildBlogManifest([
      { filePath: "older.md", source: post("title: Older\ndate: 2026-08-01") },
      { filePath: "newer.md", source: post("title: Newer\ndate: 2026-08-10") },
    ]);
    expect(manifest.posts.map(({ title }) => title)).toEqual(["Newer", "Older"]);
  });

  it("rejects duplicate published slugs", () => {
    expect(() =>
      buildBlogManifest([
        { filePath: "one.md", source: post("title: One\ndate: 2026-08-01\nslug: same") },
        { filePath: "two.md", source: post("title: Two\ndate: 2026-08-02\nslug: same") },
      ])
    ).toThrow("Duplicate published blog slug: same");
  });

  it("requires a boolean draft value", () => {
    expect(() =>
      parseBlogPost(post('title: Draft\ndate: 2026-08-10\ndraft: "yes"'), "/content/posts/draft.md")
    ).toThrow("draft must be true or false");
  });

  it("rejects impossible calendar dates", () => {
    expect(() =>
      parseBlogPost(post("title: Invalid Date\ndate: 2026-02-31"), "/content/posts/invalid-date.md")
    ).toThrow("date must use a valid YYYY-MM-DD value");
  });

  it("replaces Mermaid fences with deterministic static diagram links", () => {
    const extracted = extractEmbeddedMermaid(
      "Before\n\n```mermaid\nflowchart LR\n  A --> B\n```\n\nAfter",
      "example-post",
      "Example Post"
    );
    expect(extracted.content).toBe(
      "Before\n\n![Example Post diagram 1](/media/diagrams/posts/example-post/diagram-1.svg)\n\nAfter"
    );
    expect(extracted.diagrams).toEqual([
      {
        relativeOutputPath: "posts/example-post/diagram-1.svg",
        source: "flowchart LR\n  A --> B",
      },
    ]);
  });
});
