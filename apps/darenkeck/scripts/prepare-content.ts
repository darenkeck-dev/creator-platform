import { execFile } from "node:child_process";
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { buildBlogManifest } from "./blog-content";

const execFileAsync = promisify(execFile);
const appDir = fileURLToPath(new URL("..", import.meta.url));
const generatedDir = path.join(appDir, ".generated-content");
const postsDir = path.join(generatedDir, "content", "posts");
const diagramsDir = path.join(generatedDir, "diagrams");
const manifestPath = path.join(generatedDir, "blog.json");
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

async function writeManifest(): Promise<number> {
  const postPaths = await regularFiles(postsDir, ".md");
  const files = await Promise.all(
    postPaths.map(async (filePath) => ({ filePath, source: await readFile(filePath, "utf8") }))
  );
  const manifest = buildBlogManifest(files);
  const temporaryPath = `${manifestPath}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await rename(temporaryPath, manifestPath);
  return manifest.posts.length;
}

async function renderDiagrams(): Promise<number> {
  await rm(publicDiagramsDir, { recursive: true, force: true });
  await mkdir(publicDiagramsDir, { recursive: true });
  const diagramPaths = await regularFiles(diagramsDir, ".mmd");
  for (const inputPath of diagramPaths) {
    const relativePath = path.relative(diagramsDir, inputPath).replace(/\.mmd$/, ".svg");
    const outputPath = path.join(publicDiagramsDir, relativePath);
    await mkdir(path.dirname(outputPath), { recursive: true });
    await execFileAsync("bash", [renderScript, inputPath, outputPath], { cwd: appDir });
    const output = await stat(outputPath);
    if (!output.isFile() || output.size === 0) {
      throw new Error(`Mermaid rendering did not create ${outputPath}`);
    }
  }
  return diagramPaths.length;
}

await mkdir(generatedDir, { recursive: true });
const publishedPosts = await writeManifest();
const renderedDiagrams = await renderDiagrams();
console.log(`Prepared ${publishedPosts} published blog posts and ${renderedDiagrams} diagrams.`);
