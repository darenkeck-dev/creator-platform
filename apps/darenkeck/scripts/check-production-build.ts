import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { chromium, type Browser, type Page } from "playwright";
import { preview } from "vite";

const appDir = fileURLToPath(new URL("..", import.meta.url));
const manifest = JSON.parse(
  await readFile(new URL("../.generated-content/blog.json", import.meta.url), "utf8")
) as { posts?: Array<{ slug?: string }> };
const publishedSlug = manifest.posts?.find((post) => post.slug)?.slug;
const bulletinManifest = JSON.parse(
  await readFile(new URL("../.generated-content/bulletins.json", import.meta.url), "utf8")
) as { bulletins?: Array<{ slug?: string; summary?: string }> };
const publishedBulletinSlug = bulletinManifest.bulletins?.find(
  (bulletin) => bulletin.slug
)?.slug;
const homepageSummaryHref = bulletinManifest.bulletins
  ?.slice(0, 3)
  .map((bulletin) => bulletin.summary?.match(/\[[^\]]+\]\(([^)]+)\)/)?.[1])
  .find((href): href is string => Boolean(href));
const previewServer = await preview({
  root: appDir,
  logLevel: "error",
  preview: { host: "127.0.0.1", port: 0 },
});
const address = previewServer.httpServer.address();
if (!address || typeof address === "string") {
  await previewServer.close();
  throw new Error("Unable to resolve the production-build preview port.");
}

const baseUrl = `http://127.0.0.1:${address.port}`;
const combo = {
  source: "derived",
  selection: "primary",
  comboId: "production-smoke-combo",
  videoAssetId: "production-smoke-video",
  audioAssetId: "production-smoke-audio",
  videoTitle: "Production Smoke Video",
  audioTitle: "Production Smoke Audio",
  videoSrc: "https://media.invalid/video.m3u8",
  audioSrc: "https://media.invalid/audio.m3u8",
};

async function configureRoutes(page: Page): Promise<void> {
  await page.route("**/public/combos/random**", (route) =>
    route.fulfill({ contentType: "application/json", body: JSON.stringify(combo) })
  );
  await page.route("https://media.invalid/**", (route) => route.abort());
}

let browser: Browser | undefined;

try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const pageErrors: string[] = [];
  const invalidJavaScriptResponses: string[] = [];
  let javascriptResponses = 0;

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    if (!pathname.endsWith(".js")) return;
    javascriptResponses += 1;
    const contentType = response.headers()["content-type"] ?? "";
    if (!response.ok() || !/(?:java|ecma)script/i.test(contentType)) {
      invalidJavaScriptResponses.push(
        `${response.status()} ${contentType || "missing"} ${pathname}`
      );
    }
  });
  await configureRoutes(page);

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  const homePanelAlignment = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>("[data-home-panel-shell]");
    const panel = document.querySelector<HTMLElement>("[data-home-panel]");
    if (!shell || !panel) return null;
    return {
      actual: window.innerHeight - panel.getBoundingClientRect().bottom,
      expected: Number.parseFloat(getComputedStyle(shell).bottom),
    };
  });
  if (
    !homePanelAlignment ||
    Math.abs(homePanelAlignment.actual - homePanelAlignment.expected) > 1
  ) {
    throw new Error(
      `Homepage panel is not anchored to its bottom inset: ${JSON.stringify(homePanelAlignment)}`
    );
  }
  const homepageBulletinCount = await page.locator("[data-home-bulletin]").count();
  const expectedHomepageBulletins = Math.min(3, bulletinManifest.bulletins?.length ?? 0);
  if (homepageBulletinCount !== expectedHomepageBulletins) {
    throw new Error(
      `Homepage rendered ${homepageBulletinCount} bulletins; expected ${expectedHomepageBulletins}.`
    );
  }
  if ((await page.locator("[data-home-bulletin] a a").count()) > 0) {
    throw new Error("Homepage bulletin summaries rendered nested links.");
  }
  if (homepageSummaryHref) {
    await page.waitForFunction(
      (expectedHref) =>
        Array.from(document.querySelectorAll("[data-home-bulletin] a")).some(
          (link) => link.getAttribute("href") === expectedHref
        ),
      homepageSummaryHref
    );
  }
  await page.getByRole("link", { name: "News", exact: true }).click();
  await page.locator(".bulletin-document").waitFor({ state: "visible" });
  await page.getByRole("link", { name: "darenkeck", exact: true }).click();
  await page.getByRole("link", { name: "Resume" }).click();
  await page.locator(".resume-document").waitFor({ state: "visible" });
  await page.getByRole("link", { name: "darenkeck", exact: true }).click();
  await page.getByRole("link", { name: "Blog" }).click();
  await page.locator(".blog-document").waitFor({ state: "visible" });

  if (publishedSlug) {
    await page.goto(`${baseUrl}/blog/${publishedSlug}`, { waitUntil: "domcontentloaded" });
    await page.locator(".blog-document h1").waitFor({ state: "visible" });
  }

  if (publishedBulletinSlug) {
    await page.goto(`${baseUrl}/news/${publishedBulletinSlug}`, {
      waitUntil: "domcontentloaded",
    });
    await page.locator(".bulletin-document h1").waitFor({ state: "visible" });
  }

  await page.goto(`${baseUrl}/dev`, { waitUntil: "domcontentloaded" });
  await page.locator(".resume-document").waitFor({ state: "visible" });

  if (javascriptResponses === 0)
    throw new Error("Production smoke did not load JavaScript assets.");
  if (invalidJavaScriptResponses.length > 0) {
    throw new Error(
      `Production build returned invalid JavaScript responses: ${invalidJavaScriptResponses.join(", ")}`
    );
  }
  if (pageErrors.length > 0) {
    throw new Error(`Production build raised browser errors: ${pageErrors.join(" | ")}`);
  }

  console.log("Darenkeck production-build route and JavaScript MIME smoke passed");
} finally {
  await browser?.close();
  await previewServer.close();
}
