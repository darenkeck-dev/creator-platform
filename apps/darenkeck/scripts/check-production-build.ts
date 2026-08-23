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
const musicCatalog = {
  schemaVersion: "public-music-catalog/v1",
  tracks: [
    {
      id: "92f61076-ce78-44fa-917f-a3cc837b105d",
      title: "Moonlit Home",
      durationSeconds: 243,
      audioUrl: "https://media.invalid/moonlit-home.m3u8",
      purchaseLinks: [{ label: "Bandcamp", url: "https://example.com/moonlit-home" }],
    },
  ],
  releases: [
    {
      id: "c4cd15e3-5ba5-4d5b-99ad-91fcf082a3aa",
      title: "Moonlit Home",
      releaseDate: "2026-08-01",
      type: "single",
      coverUrl: "https://media.invalid/moonlit-home.webp",
      coverAlt: "Moonlit Home cover",
      trackIds: ["92f61076-ce78-44fa-917f-a3cc837b105d"],
      tracks: [
        {
          id: "92f61076-ce78-44fa-917f-a3cc837b105d",
          title: "Moonlit Home",
          durationSeconds: 243,
          audioUrl: "https://media.invalid/moonlit-home.m3u8",
          purchaseLinks: [{ label: "Bandcamp", url: "https://example.com/moonlit-home" }],
        },
      ],
      purchaseLinks: [{ label: "Bandcamp", url: "https://example.com/moonlit-home" }],
    },
  ],
};

async function configureRoutes(page: Page): Promise<void> {
  await page.route("**/public/combos/random**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(combo) });
  });
  await page.route("**/public/music", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.fulfill({ contentType: "application/json", body: JSON.stringify(musicCatalog) });
  });
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
  await page.getByRole("link", { name: "View all news", exact: true }).click();
  await page.locator(".bulletin-document").waitFor({ state: "visible" });
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.getByRole("link", { name: "Resume" }).click();
  await page.locator(".resume-document").waitFor({ state: "visible" });
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.getByRole("link", { name: "Music" }).click();
  await page.getByLabel("Loading releases").waitFor({ state: "visible" });
  await page.getByRole("heading", { name: "Moonlit Home" }).waitFor({ state: "visible" });
  await page
    .getByRole("button", { name: "Moonlit Home" })
    .evaluate((button) => (button as HTMLElement).click());
  await page.locator("[data-music-transport-loading]").waitFor({ state: "visible" });
  await page.locator(".track-loading-ellipsis").waitFor({ state: "visible" });
  await page.locator("[data-music-transport]").waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Mute music" }).waitFor({ state: "visible" });
  await page.locator("[data-document-nav]").evaluate((navigation) => {
    const article = navigation.parentElement;
    if (article) article.style.minHeight = "1800px";
  });
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.locator("[data-document-music-controls]").waitFor({ state: "visible" });
  if (
    (await page.locator("[data-music-transport]").count()) !== 0 ||
    (await page.locator("[data-media-controls]").count()) !== 0
  ) {
    throw new Error("Non-docked media controls remained visible after sticky controls mounted.");
  }
  const stickyMusicNav = await page.locator("[data-document-nav]").boundingBox();
  if (!stickyMusicNav || stickyMusicNav.y < -1 || stickyMusicNav.y > 1) {
    throw new Error(`Music controls did not enter the sticky row: ${JSON.stringify(stickyMusicNav)}`);
  }
  await page
    .getByRole("button", { name: "Moonlit Home" })
    .evaluate((button) => (button as HTMLElement).click());
  await page
    .locator("[data-document-center-control] .app-shell-loader")
    .waitFor({ state: "visible" });
  await page.locator("[data-document-music-controls]").waitFor({ state: "visible" });
  await page.locator(".track-loading-ellipsis").waitFor({ state: "visible" });
  await page
    .locator("[data-document-center-control] .app-shell-loader")
    .waitFor({ state: "hidden" });
  await page.locator("[data-document-music-controls]").waitFor({ state: "visible" });
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.locator("[data-music-transport]").waitFor({ state: "visible" });
  await page.getByRole("link", { name: "View Moonlit Home on the Music page" }).click();
  await page.waitForURL("**/music#release-c4cd15e3-5ba5-4d5b-99ad-91fcf082a3aa");
  await page
    .locator("#release-c4cd15e3-5ba5-4d5b-99ad-91fcf082a3aa")
    .waitFor({ state: "visible" });
  await page.getByRole("link", { name: "Home", exact: true }).click();
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

  const mobilePage = await browser.newPage({ viewport: { width: 320, height: 700 } });
  mobilePage.on("pageerror", (error) => pageErrors.push(`mobile: ${error.message}`));
  await configureRoutes(mobilePage);
  await mobilePage.goto(`${baseUrl}/music`, { waitUntil: "domcontentloaded" });
  await mobilePage.getByLabel("Loading releases").waitFor({ state: "visible" });
  await mobilePage.getByRole("heading", { name: "Moonlit Home" }).waitFor({ state: "visible" });
  await mobilePage.getByRole("button", { name: "Moonlit Home" }).click();
  await mobilePage.locator("[data-music-transport-loading]").waitFor({ state: "visible" });
  const mobileTransportBounds = await mobilePage
    .locator("[data-music-transport]")
    .evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        left: bounds.left,
        right: bounds.right,
        viewportWidth: window.innerWidth,
        documentWidth: document.documentElement.scrollWidth,
      };
    });
  if (
    mobileTransportBounds.left < 0 ||
    mobileTransportBounds.right > mobileTransportBounds.viewportWidth ||
    mobileTransportBounds.documentWidth > mobileTransportBounds.viewportWidth
  ) {
    throw new Error(
      `Music page overflows the mobile viewport: ${JSON.stringify(mobileTransportBounds)}`
    );
  }
  const mobileTransportChildrenOverlap = await mobilePage
    .locator("[data-music-transport]")
    .evaluate((element) => {
      const boxes = Array.from(element.children)
        .map((child) => child.getBoundingClientRect())
        .sort((left, right) => left.left - right.left);
      return boxes.some((box, index) => {
        const next = boxes[index + 1];
        return next ? box.right > next.left + 0.5 : false;
      });
    });
  if (mobileTransportChildrenOverlap) {
    throw new Error("Music transport controls overlap at 320px.");
  }
  await mobilePage.locator("[data-document-nav]").evaluate((navigation) => {
    const article = navigation.parentElement;
    if (article) article.style.minHeight = "1800px";
  });
  await mobilePage.evaluate(() => window.scrollTo(0, 600));
  const mobileStickyControls = mobilePage.locator("[data-document-music-controls]");
  await mobileStickyControls.waitFor({ state: "visible" });
  if ((await mobilePage.locator("[data-media-controls]").count()) !== 0) {
    throw new Error("Ambient controls remained visible in mobile docked music mode.");
  }
  const [mobileStickyNavBox, mobileStickyControlsBox] = await Promise.all([
    mobilePage.locator("[data-document-nav]").boundingBox(),
    mobileStickyControls.boundingBox(),
  ]);
  if (
    !mobileStickyNavBox ||
    !mobileStickyControlsBox ||
    mobileStickyNavBox.y < -1 ||
    mobileStickyNavBox.y > 1 ||
    mobileStickyControlsBox.x < mobileStickyNavBox.x ||
    mobileStickyControlsBox.x + mobileStickyControlsBox.width >
      mobileStickyNavBox.x + mobileStickyNavBox.width
  ) {
    throw new Error(
      `Music controls did not fit the mobile sticky row: ${JSON.stringify({ mobileStickyNavBox, mobileStickyControlsBox })}`
    );
  }
  const mobileStickyButtonsOverlap = await mobilePage
    .locator("[data-document-nav]")
    .getByRole("button")
    .evaluateAll((buttons) => {
      const boxes = buttons
        .map((button) => button.getBoundingClientRect())
        .filter((box) => box.width > 0 && box.height > 0)
        .sort((left, right) => left.left - right.left);
      return boxes.some((box, index) => {
        const next = boxes[index + 1];
        return next ? box.right > next.left + 0.5 : false;
      });
    });
  if (mobileStickyButtonsOverlap) {
    throw new Error("Music controls overlap in the 320px sticky row.");
  }
  if (
    (await mobilePage.locator('[data-document-nav] nav[aria-label="Breadcrumb"]').isVisible()) ||
    (await mobilePage.locator("[data-document-minimize-control]").isVisible())
  ) {
    throw new Error("Mobile docked music controls did not clear the breadcrumb row.");
  }
  await mobilePage.close();

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
