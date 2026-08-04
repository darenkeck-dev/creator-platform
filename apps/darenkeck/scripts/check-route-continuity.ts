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
      }),
    });
  });
  await page.route("https://media.invalid/**", (route) => route.abort());

  await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: "domcontentloaded" });
  await page.locator("video").waitFor({ state: "attached" });
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

  await page.getByRole("link", { name: "Dev work" }).click();
  await page.locator(".resume-document").waitFor({ state: "visible" });

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

  console.log("Darenkeck route continuity check passed");
} finally {
  await browser?.close();
  await viteServer.close();
}
