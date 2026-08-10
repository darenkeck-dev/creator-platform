import { fileURLToPath } from "node:url";

import { chromium, type Browser } from "playwright";
import { createServer } from "vite";

const appDir = fileURLToPath(new URL("..", import.meta.url));
const viteServer = await createServer({
  root: appDir,
  logLevel: "error",
  server: { host: "127.0.0.1", port: 0 },
});
await viteServer.listen();

const address = viteServer.httpServer?.address();
if (!address || typeof address === "string") {
  await viteServer.close();
  throw new Error("Unable to resolve the route continuity server port.");
}

let browser: Browser | undefined;

try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let randomRequests = 0;
  await page.route("**/public/combos/random**", async (route) => {
    randomRequests += 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        source: "derived",
        selection: "primary",
        comboId: "continuity-combo",
        videoAssetId: "continuity-video",
        audioAssetId: "continuity-audio",
        videoTitle: "Continuity Video",
        audioTitle: "Continuity Audio",
        videoSrc: "https://media.invalid/video.m3u8",
        audioSrc: "https://media.invalid/audio.m3u8",
        predictedTone: {
          valence: 0.1,
          arousal: 0.2,
          dominance: 0.3,
          warmth: 0.4,
          tension: 0.5,
          intimacy: 0.6,
          instability: 0.7,
          nostalgia: 0.8,
          beauty: 0.9,
          menace: 1,
        },
      }),
    });
  });
  await page.route("https://media.invalid/**", (route) => route.abort());

  await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: "domcontentloaded" });
  await page.locator("video").waitFor({ state: "attached" });
  await page
    .locator('button[aria-label="Explore combinations by tone"] svg[data-tone-wheel="predicted"]')
    .waitFor({ state: "visible" });
  await page.evaluate(() => {
    (window as Window & { continuityVideo?: HTMLVideoElement }).continuityVideo =
      document.querySelector("video") ?? undefined;
  });

  await page.getByRole("button", { name: "Explore combinations by tone" }).click();
  await page.getByRole("button", { name: "OK" }).click();
  await page.getByTitle("Soft, careful, and non-threatening.").click();
  await page.getByRole("button", { name: "Unmute audio" }).click();
  await page.getByRole("button", { name: "Close tone explorer" }).click();
  const requestCountBeforeNavigation = randomRequests;

  await page.getByRole("link", { name: "Resume" }).click();
  await page.locator(".resume-document").waitFor({ state: "visible" });
  const resumeBreadcrumbs = page.getByRole("navigation", { name: "Breadcrumb" });
  await resumeBreadcrumbs.getByRole("link", { name: "darenkeck" }).waitFor({ state: "visible" });
  await resumeBreadcrumbs.getByText("resume", { exact: true }).waitFor({ state: "visible" });
  await page.getByRole("link", { name: "Download" }).waitFor({ state: "visible" });
  if ((await page.getByTitle("Minimize").count()) > 0) {
    throw new Error("Document routes must not render the old minimize control.");
  }

  const sameVideo = await page.evaluate(
    () =>
      (window as Window & { continuityVideo?: HTMLVideoElement }).continuityVideo ===
      document.querySelector("video")
  );
  if (!sameVideo) throw new Error("ComboPlayer remounted while navigating to /dev.");
  if (randomRequests !== requestCountBeforeNavigation) {
    throw new Error("Navigating to /dev triggered another random combo request.");
  }
  await page.getByRole("button", { name: "Mute audio" }).waitFor({ state: "visible" });

  await page.getByRole("button", { name: "Explore combinations by tone" }).click();
  const selectedClass = await page
    .getByTitle("Soft, careful, and non-threatening.")
    .getAttribute("class");
  if (!selectedClass?.includes("bg-white/85")) {
    throw new Error("Selected tone words were not preserved on /dev.");
  }

  await page.goBack({ waitUntil: "domcontentloaded" });
  const sameVideoAfterBack = await page.evaluate(
    () =>
      (window as Window & { continuityVideo?: HTMLVideoElement }).continuityVideo ===
      document.querySelector("video")
  );
  if (!sameVideoAfterBack) throw new Error("ComboPlayer remounted after browser Back.");

  await page.getByRole("link", { name: "Blog" }).click();
  await page.locator(".blog-document").waitFor({ state: "visible" });
  const blogBreadcrumbs = page.getByRole("navigation", { name: "Breadcrumb" });
  await blogBreadcrumbs.getByRole("link", { name: "darenkeck" }).waitFor({ state: "visible" });
  await blogBreadcrumbs.getByText("blog", { exact: true }).waitFor({ state: "visible" });
  const sameVideoOnBlog = await page.evaluate(
    () =>
      (window as Window & { continuityVideo?: HTMLVideoElement }).continuityVideo ===
      document.querySelector("video")
  );
  if (!sameVideoOnBlog) throw new Error("ComboPlayer remounted while navigating to /blog.");
  if (randomRequests !== requestCountBeforeNavigation) {
    throw new Error("Navigating to /blog triggered another random combo request.");
  }

  const blogEntries = page.locator('.blog-document a[href^="/blog/"]');
  if ((await blogEntries.count()) > 0) {
    await blogEntries.first().click();
    await page
      .locator(".blog-document article, .blog-document h1")
      .first()
      .waitFor({ state: "visible" });
    await page
      .getByRole("navigation", { name: "Breadcrumb" })
      .getByRole("link", { name: "blog" })
      .waitFor({ state: "visible" });
    const sameVideoOnEntry = await page.evaluate(
      () =>
        (window as Window & { continuityVideo?: HTMLVideoElement }).continuityVideo ===
        document.querySelector("video")
    );
    if (!sameVideoOnEntry) throw new Error("ComboPlayer remounted while opening a blog entry.");
  }

  console.log("Darenkeck route continuity check passed");
} finally {
  await browser?.close();
  await viteServer.close();
}
