import path from "node:path";

import { parse } from "yaml";

export type PublishedBulletin = {
  slug: string;
  title: string;
  date: string;
  summary: string;
  summaryText: string;
  image?: string;
  imageAlt?: string;
  content: string;
};

type BulletinFrontmatter = {
  title: string;
  date: string;
  summary: string;
  image?: string;
  imageAlt?: string;
  draft: boolean;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function markdownSummaryToText(summary: string): string {
  return summary
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s*|[-+*]\s+|\d+\.\s+)/gm, "")
    .replace(/[`*_~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function requiredString(value: unknown, field: string, filePath: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${filePath}: ${field} must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(value: unknown, field: string, filePath: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return requiredString(value, field, filePath);
}

function splitFrontmatter(
  source: string,
  filePath: string
): { metadata: Record<string, unknown>; content: string } {
  const normalized = source.replaceAll("\r\n", "\n");
  if (!normalized.startsWith("---\n")) {
    throw new Error(`${filePath}: bulletins must begin with YAML frontmatter`);
  }
  const end = normalized.indexOf("\n---\n", 4);
  if (end === -1) {
    throw new Error(`${filePath}: bulletin frontmatter is not closed`);
  }
  const parsed = parse(normalized.slice(4, end));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${filePath}: bulletin frontmatter must be an object`);
  }
  return {
    metadata: parsed as Record<string, unknown>,
    content: normalized.slice(end + 5).trim(),
  };
}

function parseFrontmatter(
  metadata: Record<string, unknown>,
  filePath: string
): BulletinFrontmatter {
  const title = requiredString(metadata.title, "title", filePath);
  const date = requiredString(metadata.date, "date", filePath);
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  if (
    !DATE_PATTERN.test(date) ||
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== date
  ) {
    throw new Error(`${filePath}: date must use a valid YYYY-MM-DD value`);
  }
  if (metadata.draft !== undefined && typeof metadata.draft !== "boolean") {
    throw new Error(`${filePath}: draft must be true or false`);
  }
  return {
    title,
    date,
    summary: requiredString(metadata.summary, "summary", filePath),
    image: optionalString(metadata.image, "image", filePath),
    imageAlt: optionalString(metadata.image_alt, "image_alt", filePath),
    draft: metadata.draft ?? false,
  };
}

export function parseBulletin(source: string, filePath: string): PublishedBulletin | null {
  const { metadata, content } = splitFrontmatter(source, filePath);
  const frontmatter = parseFrontmatter(metadata, filePath);
  if (frontmatter.draft || path.basename(filePath, path.extname(filePath)).endsWith("-draft")) {
    return null;
  }
  if (!content) throw new Error(`${filePath}: published bulletin content cannot be empty`);
  const summaryText = markdownSummaryToText(frontmatter.summary);
  if (!summaryText) throw new Error(`${filePath}: summary must contain readable text`);

  const slug = path.basename(filePath, path.extname(filePath));
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(`${filePath}: filename must contain lowercase letters, numbers, and hyphens only`);
  }

  return {
    slug,
    title: frontmatter.title,
    date: frontmatter.date,
    summary: frontmatter.summary,
    summaryText,
    ...(frontmatter.image ? { image: frontmatter.image } : {}),
    ...(frontmatter.imageAlt ? { imageAlt: frontmatter.imageAlt } : {}),
    content,
  };
}

export function buildBulletinManifest(files: Array<{ filePath: string; source: string }>): {
  bulletins: PublishedBulletin[];
} {
  const bulletins = files
    .map(({ filePath, source }) => parseBulletin(source, filePath))
    .filter((bulletin): bulletin is PublishedBulletin => bulletin !== null)
    .sort(
      (left, right) => right.date.localeCompare(left.date) || left.slug.localeCompare(right.slug)
    );

  const slugs = new Set<string>();
  for (const bulletin of bulletins) {
    if (slugs.has(bulletin.slug)) {
      throw new Error(`Duplicate published bulletin slug: ${bulletin.slug}`);
    }
    slugs.add(bulletin.slug);
  }
  return { bulletins };
}
