// @ts-expect-error -- Bun supplies this runtime module; the browser app does not include Bun types.
import { describe, expect, it } from "bun:test";

import {
  buildBulletinManifest,
  markdownSummaryToText,
  parseBulletin,
} from "../scripts/bulletin-content";

const bulletin = (frontmatter: string, content = "Bulletin body") =>
  `---\n${frontmatter}\n---\n${content}\n`;

describe("bulletin content preparation", () => {
  it("parses a published bulletin with optional image metadata", () => {
    expect(
      parseBulletin(
        bulletin(
          "title: Site Update\ndate: 2026-08-16\nsummary: A short update\nimage: /media/bulletins/update.webp\nimage_alt: The updated site"
        ),
        "/content/bulletins/2026-08-16-site-update.md"
      )
    ).toEqual({
      slug: "2026-08-16-site-update",
      title: "Site Update",
      date: "2026-08-16",
      summary: "A short update",
      summaryText: "A short update",
      image: "/media/bulletins/update.webp",
      imageAlt: "The updated site",
      content: "Bulletin body",
    });
  });

  it("preserves Markdown links and derives metadata-safe summary text", () => {
    const source = bulletin(
      'title: Linked Summary\ndate: 2026-08-16\nsummary: "Read the [release notes](https://example.com) for **details**."'
    );
    expect(parseBulletin(source, "/content/bulletins/2026-08-16-linked-summary.md")).toMatchObject({
      summary: "Read the [release notes](https://example.com) for **details**.",
      summaryText: "Read the release notes for details.",
    });
    expect(markdownSummaryToText("A [link](/news/example) and `code`")).toBe(
      "A link and code"
    );
  });

  it("excludes explicit and filename-marked drafts", () => {
    expect(
      parseBulletin(
        bulletin("title: Draft\ndate: 2026-08-16\nsummary: Not published\ndraft: true"),
        "/content/bulletins/2026-08-16-draft.md"
      )
    ).toBeNull();
    expect(
      parseBulletin(
        bulletin("title: Draft\ndate: 2026-08-16\nsummary: Not published"),
        "/content/bulletins/2026-08-16-update-draft.md"
      )
    ).toBeNull();
  });

  it("requires summary and body content", () => {
    expect(() =>
      parseBulletin(
        bulletin("title: Missing Summary\ndate: 2026-08-16"),
        "/content/bulletins/2026-08-16-missing-summary.md"
      )
    ).toThrow("summary must be a non-empty string");
    expect(() =>
      parseBulletin(
        bulletin("title: Empty\ndate: 2026-08-16\nsummary: Empty body", ""),
        "/content/bulletins/2026-08-16-empty.md"
      )
    ).toThrow("published bulletin content cannot be empty");
  });

  it("sorts newest first and rejects duplicate slugs", () => {
    const manifest = buildBulletinManifest([
      {
        filePath: "/content/bulletins/2026-08-01-older.md",
        source: bulletin("title: Older\ndate: 2026-08-01\nsummary: Older update"),
      },
      {
        filePath: "/content/bulletins/2026-08-16-newer.md",
        source: bulletin("title: Newer\ndate: 2026-08-16\nsummary: Newer update"),
      },
    ]);
    expect(manifest.bulletins.map(({ title }) => title)).toEqual(["Newer", "Older"]);

    expect(() =>
      buildBulletinManifest([
        {
          filePath: "/one/2026-08-16-update.md",
          source: bulletin("title: One\ndate: 2026-08-16\nsummary: First"),
        },
        {
          filePath: "/two/2026-08-16-update.md",
          source: bulletin("title: Two\ndate: 2026-08-16\nsummary: Second"),
        },
      ])
    ).toThrow("Duplicate published bulletin slug: 2026-08-16-update");
  });
});
