import path from "node:path";

import { parse } from "yaml";

export type PublishedBlogPost = {
  slug: string;
  title: string;
  date: string;
  summary?: string;
  content: string;
};

type BlogFrontmatter = {
  title: string;
  date: string;
  slug?: string;
  summary?: string;
  draft: boolean;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function requiredString(value: unknown, field: string, filePath: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${filePath}: ${field} must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(value: unknown, field: string, filePath: string): string | undefined {
  if (value === undefined) return undefined;
  return requiredString(value, field, filePath);
}

function splitFrontmatter(
  source: string,
  filePath: string
): {
  metadata: Record<string, unknown>;
  content: string;
} {
  const normalized = source.replaceAll("\r\n", "\n");
  if (!normalized.startsWith("---\n")) {
    throw new Error(`${filePath}: blog posts must begin with YAML frontmatter`);
  }
  const end = normalized.indexOf("\n---\n", 4);
  if (end === -1) {
    throw new Error(`${filePath}: blog post frontmatter is not closed`);
  }
  const parsed = parse(normalized.slice(4, end));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${filePath}: blog post frontmatter must be an object`);
  }
  return {
    metadata: parsed as Record<string, unknown>,
    content: normalized.slice(end + 5).trim(),
  };
}

function parseFrontmatter(metadata: Record<string, unknown>, filePath: string): BlogFrontmatter {
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
    slug: optionalString(metadata.slug, "slug", filePath),
    summary: optionalString(metadata.summary ?? metadata.excerpt, "summary", filePath),
    draft: metadata.draft ?? false,
  };
}

function defaultSlug(filePath: string): string {
  return path.basename(filePath, path.extname(filePath)).replace(/^\d{4}-\d{2}-\d{2}-/, "");
}

function withoutDuplicateTitle(content: string, title: string): string {
  const [firstLine, ...remainingLines] = content.split("\n");
  return firstLine.trim() === `# ${title}` ? remainingLines.join("\n").trim() : content;
}

export function parseBlogPost(source: string, filePath: string): PublishedBlogPost | null {
  const { metadata, content } = splitFrontmatter(source, filePath);
  const frontmatter = parseFrontmatter(metadata, filePath);
  if (frontmatter.draft || path.basename(filePath, path.extname(filePath)).endsWith("-draft")) {
    return null;
  }
  const publishedContent = withoutDuplicateTitle(content, frontmatter.title);
  if (!publishedContent)
    throw new Error(`${filePath}: published blog post content cannot be empty`);

  const slug = frontmatter.slug ?? defaultSlug(filePath);
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(`${filePath}: slug must contain lowercase letters, numbers, and hyphens only`);
  }

  return {
    slug,
    title: frontmatter.title,
    date: frontmatter.date,
    ...(frontmatter.summary ? { summary: frontmatter.summary } : {}),
    content: publishedContent,
  };
}

export function buildBlogManifest(files: Array<{ filePath: string; source: string }>): {
  posts: PublishedBlogPost[];
} {
  const posts = files
    .map(({ filePath, source }) => parseBlogPost(source, filePath))
    .filter((post): post is PublishedBlogPost => post !== null)
    .sort(
      (left, right) => right.date.localeCompare(left.date) || left.slug.localeCompare(right.slug)
    );

  const slugs = new Set<string>();
  for (const post of posts) {
    if (slugs.has(post.slug)) throw new Error(`Duplicate published blog slug: ${post.slug}`);
    slugs.add(post.slug);
  }
  return { posts };
}
