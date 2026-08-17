import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { buildBlogManifest, extractEmbeddedMermaid } from "./blog-content";
import { buildBulletinManifest } from "./bulletin-content";

const execFileAsync = promisify(execFile);
const appDir = fileURLToPath(new URL("..", import.meta.url));
const generatedDir = path.join(appDir, ".generated-content");
const postsDir = path.join(generatedDir, "content", "posts");
const bulletinsDir = path.join(generatedDir, "content", "bulletins");
const diagramsDir = path.join(generatedDir, "diagrams");
const blogManifestPath = path.join(generatedDir, "blog.json");
const bulletinManifestPath = path.join(generatedDir, "bulletins.json");
const publicDiagramsDir = path.join(appDir, "public", "media", "diagrams");
const renderScript = path.join(appDir, "scripts", "render-mermaid-svg.sh");

async function regularFiles(root: string, extension: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(root, entry.name);
        if (entry.isDirectory()) return regularFiles(entryPath, extension);
        if (entry.isFile() && entry.name.endsWith(extension)) return [entryPath];
        return [];
      })
    );
    return nested.flat().sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function renderDiagram(inputPath: string, outputPath: string): Promise<void> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await execFileAsync("bash", [renderScript, inputPath, outputPath], { cwd: appDir });
  const output = await stat(outputPath);
  if (!output.isFile() || output.size === 0) {
    throw new Error(`Mermaid rendering did not create ${outputPath}`);
  }
}

async function writeManifests(): Promise<{
  publishedPosts: number;
  publishedBulletins: number;
  embeddedDiagrams: number;
}> {
  const postPaths = await regularFiles(postsDir, ".md");
  const postFiles = await Promise.all(
    postPaths.map(async (filePath) => ({ filePath, source: await readFile(filePath, "utf8") }))
  );
  const bulletinPaths = await regularFiles(bulletinsDir, ".md");
  const bulletinFiles = await Promise.all(
    bulletinPaths.map(async (filePath) => ({ filePath, source: await readFile(filePath, "utf8") }))
  );
  const blogManifest = buildBlogManifest(postFiles);
  const bulletinManifest = buildBulletinManifest(bulletinFiles);
  const temporaryDiagramDir = await mkdtemp(path.join(os.tmpdir(), "darenkeck-mermaid."));
  let embeddedDiagrams = 0;

  try {
    for (const post of blogManifest.posts) {
      const extracted = extractEmbeddedMermaid(post.content, post.slug, post.title);
      post.content = extracted.content;
      for (const diagram of extracted.diagrams) {
        embeddedDiagrams += 1;
        const inputPath = path.join(temporaryDiagramDir, `${post.slug}-${embeddedDiagrams}.mmd`);
        const outputPath = path.join(publicDiagramsDir, diagram.relativeOutputPath);
        await writeFile(inputPath, `${diagram.source}\n`, "utf8");
        await renderDiagram(inputPath, outputPath);
      }
    }
  } finally {
    await rm(temporaryDiagramDir, { recursive: true, force: true });
  }

  const temporaryBlogPath = `${blogManifestPath}.tmp`;
  const temporaryBulletinPath = `${bulletinManifestPath}.tmp`;
  await Promise.all([
    writeFile(temporaryBlogPath, `${JSON.stringify(blogManifest, null, 2)}\n`, "utf8"),
    writeFile(temporaryBulletinPath, `${JSON.stringify(bulletinManifest, null, 2)}\n`, "utf8"),
  ]);
  await Promise.all([
    rename(temporaryBlogPath, blogManifestPath),
    rename(temporaryBulletinPath, bulletinManifestPath),
  ]);
  return {
    publishedPosts: blogManifest.posts.length,
    publishedBulletins: bulletinManifest.bulletins.length,
    embeddedDiagrams,
  };
}

async function renderSourceDiagrams(): Promise<number> {
  const diagramPaths = await regularFiles(diagramsDir, ".mmd");
  for (const inputPath of diagramPaths) {
    const relativePath = path.relative(diagramsDir, inputPath).replace(/\.mmd$/, ".svg");
    await renderDiagram(inputPath, path.join(publicDiagramsDir, relativePath));
  }
  return diagramPaths.length;
}

await mkdir(generatedDir, { recursive: true });
await rm(publicDiagramsDir, { recursive: true, force: true });
await mkdir(publicDiagramsDir, { recursive: true });
const sourceDiagrams = await renderSourceDiagrams();
const { publishedPosts, publishedBulletins, embeddedDiagrams } = await writeManifests();
console.log(
  `Prepared ${publishedPosts} published blog posts, ${publishedBulletins} bulletins, and ${sourceDiagrams + embeddedDiagrams} diagrams.`
);
