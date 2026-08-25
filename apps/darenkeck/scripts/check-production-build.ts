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

async function navigateFromHome(
  page: Page,
  label: "Blog" | "Music" | "News" | "Resume"
): Promise<void> {
  const homePanel = page.locator("[data-home-panel]");
  await homePanel.waitFor({ state: "visible" });
  const navigation = homePanel.locator("[data-home-navigation-rows]");
  if ((await navigation.getAttribute("aria-hidden")) === "true") {
    await homePanel.getByRole("button", { name: "Show navigation" }).click();
  }
  await navigation.getByRole("link", { name: label }).click();
}
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
      audioAssetId: "production-smoke-audio",
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
          audioAssetId: "production-smoke-audio",
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
  await page.locator("[data-site-wordmark]").waitFor({ state: "visible" });
  const wordmarkHomeLink = page.getByRole("link", { name: "Daren Keck home" });
  if ((await wordmarkHomeLink.getAttribute("href")) !== "/") {
    throw new Error("Daren Keck wordmark does not link to Home.");
  }
  await page
    .getByRole("link", { name: "View Moonlit Home on the Music page" })
    .waitFor({ state: "visible" });
  const homeAmbientAlignment = await page.evaluate(() => {
    const controls = document.querySelector<HTMLElement>("[data-media-controls]");
    const label = document.querySelector<HTMLElement>(
      '[aria-label="View Moonlit Home on the Music page"]'
    );
    if (!controls || !label) return null;
    const controlsBox = controls.getBoundingClientRect();
    const labelBox = label.getBoundingClientRect();
    return {
      controlsCenter: controlsBox.x + controlsBox.width / 2,
      labelCenter: labelBox.x + labelBox.width / 2,
    };
  });
  if (
    !homeAmbientAlignment ||
    Math.abs(homeAmbientAlignment.controlsCenter - homeAmbientAlignment.labelCenter) > 1
  ) {
    throw new Error(
      `Homepage ambient metadata is not centered: ${JSON.stringify(homeAmbientAlignment)}`
    );
  }
  if ((await page.getByRole("link", { name: "Wayfarer Records", exact: true }).count()) !== 1) {
    throw new Error("Homepage must expose one inline Wayfarer Records link.");
  }
  const homepagePrimaryNav = page.locator("[data-home-navigation-rows]");
  if (
    (await homepagePrimaryNav.getAttribute("aria-hidden")) !== "true" ||
    (await homepagePrimaryNav.evaluate((navigation) => getComputedStyle(navigation).opacity)) !== "1" ||
    !(await homepagePrimaryNav.evaluate((navigation) =>
      getComputedStyle(navigation).clipPath.includes("100%")
    ))
  ) {
    throw new Error("Homepage navigation rows are not hidden by default.");
  }
  await page.getByRole("button", { name: "Show navigation" }).click();
  await homepagePrimaryNav.getByRole("link", { name: "Resume" }).waitFor({ state: "visible" });
  if ((await homepagePrimaryNav.getByRole("link", { name: "Home" }).count()) !== 0) {
    throw new Error("Homepage primary navigation still includes Home.");
  }
  const homePanelAlignment = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>("[data-home-panel-shell]");
    const panel = document.querySelector<HTMLElement>("[data-home-panel]");
    const controls = document.querySelector<HTMLElement>("[data-media-controls]");
    if (!shell || !panel || !controls) return null;
    return {
      actual: panel.getBoundingClientRect().bottom,
      expected: controls.getBoundingClientRect().top,
      position: getComputedStyle(shell).position,
    };
  });
  if (
    !homePanelAlignment ||
    homePanelAlignment.position === "fixed" ||
    Math.abs(homePanelAlignment.actual - homePanelAlignment.expected) > 1
  ) {
    throw new Error(
      `Homepage panel does not grow to its bottom controls: ${JSON.stringify(homePanelAlignment)}`
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
  await navigateFromHome(page, "News");
  await page.locator(".bulletin-document").waitFor({ state: "visible" });
  const newsNavigationColor = await page
    .locator("[data-document-nav-fill]")
    .evaluate((fill) => getComputedStyle(fill).fill);
  if (newsNavigationColor !== "rgb(233, 204, 0)") {
    throw new Error(`News navigation uses the wrong palette color: ${newsNavigationColor}.`);
  }
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await navigateFromHome(page, "Resume");
  await page.locator(".resume-document").waitFor({ state: "visible" });
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await navigateFromHome(page, "Music");
  await page.getByLabel("Loading releases").waitFor({ state: "visible" });
  await page.getByRole("heading", { name: "Moonlit Home" }).waitFor({ state: "visible" });
  const musicNavigationColor = await page
    .locator("[data-document-nav-fill]")
    .evaluate((fill) => getComputedStyle(fill).fill);
  if (musicNavigationColor !== "rgb(250, 1, 0)") {
    throw new Error(`Music navigation uses the wrong palette color: ${musicNavigationColor}.`);
  }
  await page
    .locator("[data-document-center-control]")
    .getByRole("link", { name: "View Moonlit Home on the Music page" })
    .waitFor({ state: "visible" });
  const ambientCurrentTrack = page.locator("[data-current-music-track]");
  const ambientCurrentTrackColor = await ambientCurrentTrack.evaluate(
    (button) => getComputedStyle(button).color
  );
  if (
    (await ambientCurrentTrack.getAttribute("aria-current")) !== "true" ||
    ambientCurrentTrackColor !== "rgb(250, 1, 0)" ||
    (await ambientCurrentTrack.locator("[data-current-track-playing]").count()) !== 1
  ) {
    throw new Error(
      `Ambient released track is not identified in the Music page: ${ambientCurrentTrackColor}.`
    );
  }
  await page
    .getByRole("button", { name: "Moonlit Home" })
    .evaluate((button) => (button as HTMLElement).click());
  const initialMusicLoader = page.locator("[data-music-transport-loading]");
  await initialMusicLoader.waitFor({ state: "visible" });
  await initialMusicLoader
    .getByRole("button", { name: /^(Play|Pause) combo$/ })
    .waitFor({ state: "visible" });
  await initialMusicLoader.getByRole("button", { name: "Mute audio" }).waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Minimize page" }).waitFor({ state: "visible" });
  await page.locator(".track-loading-ellipsis").waitFor({ state: "visible" });
  await page.locator("[data-music-transport]").waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Mute music" }).waitFor({ state: "visible" });
  const musicControlsBeforeScroll = await page.locator('[aria-label="Music player"]').boundingBox();
  const musicProgressRail = await page.locator("[data-music-progress-rail]").boundingBox();
  const musicTrackLabelBox = await page.locator("[data-music-track-label]").boundingBox();
  const musicControlStyles = await page
    .locator('[aria-label="Music player"] [data-player-control]')
    .evaluateAll((controls) =>
      controls.map((control) => {
        const style = getComputedStyle(control);
        return { backgroundColor: style.backgroundColor, boxShadow: style.boxShadow };
      })
    );
  if (
    !musicControlsBeforeScroll ||
    !musicProgressRail ||
    !musicTrackLabelBox ||
    Math.abs(musicControlsBeforeScroll.width - 896) > 1 ||
    Math.abs(musicProgressRail.width - musicControlsBeforeScroll.width) > 1 ||
    Math.abs(musicProgressRail.x - musicControlsBeforeScroll.x) > 1 ||
    Math.abs(musicProgressRail.height - 4) > 0.5 ||
    Math.abs(
      musicTrackLabelBox.x + musicTrackLabelBox.width / 2 -
        (musicControlsBeforeScroll.x + musicControlsBeforeScroll.width / 2)
    ) > 1 ||
    musicControlStyles.length !== 3 ||
    musicControlStyles.some(
      (style) => style.backgroundColor !== "rgba(0, 0, 0, 0)" || style.boxShadow !== "none"
    ) ||
    (await page
      .locator('[aria-label="Music player"]')
      .getByRole("button", { name: "Minimize page" })
      .count()) !== 1 ||
    Math.abs(musicProgressRail.y + musicProgressRail.height - page.viewportSize()!.height) > 0.5
  ) {
    throw new Error(
      `Music controls or progress rail are misplaced: ${JSON.stringify({ musicControlsBeforeScroll, musicProgressRail })}`
    );
  }
  if (
    (await page.locator("[data-document-nav]").count()) !== 1 ||
    (await page.locator("[data-document-bottom-controls]").count()) !== 0
  ) {
    throw new Error("Music playback did not preserve only the upper section row.");
  }
  await page.locator("main > div > article").evaluate((article) => {
    article.style.minHeight = "1800px";
  });
  await page.evaluate(() => window.scrollTo(0, 600));
  const musicControlsAfterScroll = await page.locator('[aria-label="Music player"]').boundingBox();
  if (
    !musicControlsAfterScroll ||
    Math.abs(musicControlsAfterScroll.y - musicControlsBeforeScroll.y) > 0.5
  ) {
    throw new Error(
      `Music controls moved during scroll: ${JSON.stringify({ musicControlsBeforeScroll, musicControlsAfterScroll })}`
    );
  }
  await page
    .getByRole("button", { name: "Moonlit Home" })
    .evaluate((button) => (button as HTMLElement).click());
  await page.locator('[aria-label="Music player"] .app-shell-loader').waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Mute music" }).waitFor({ state: "visible" });
  await page.locator(".track-loading-ellipsis").waitFor({ state: "visible" });
  await page.locator('[aria-label="Music player"] .app-shell-loader').waitFor({ state: "hidden" });
  const stopBeforeMinimize = await page
    .getByRole("button", { name: "Stop music and return to ambient playback" })
    .boundingBox();
  await page.getByRole("button", { name: "Minimize page" }).click();
  await page
    .locator('[aria-label="Music player"] [data-minimized-player-color-border]')
    .waitFor({ state: "visible" });
  const stopAfterMinimize = await page
    .getByRole("button", { name: "Stop music and return to ambient playback" })
    .boundingBox();
  if (
    !stopBeforeMinimize ||
    !stopAfterMinimize ||
    Math.abs(stopBeforeMinimize.x - stopAfterMinimize.x) > 1 ||
    Math.abs(stopBeforeMinimize.y - stopAfterMinimize.y) > 1
  ) {
    throw new Error(
      `Music Stop moved when content minimized: ${JSON.stringify({ stopAfterMinimize, stopBeforeMinimize })}`
    );
  }
  await page.getByRole("button", { name: "Restore page" }).click();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await page.getByRole("button", { name: "Minimize page" }).waitFor({ state: "visible" });
  const musicControlsWithMinimize = await page.locator('[aria-label="Music player"]').boundingBox();
  const musicLabelWithMinimize = await page.locator("[data-music-track-label]").boundingBox();
  const stopWithMinimize = await page
    .getByRole("button", { name: "Stop music and return to ambient playback" })
    .boundingBox();
  if (
    !musicControlsWithMinimize ||
    !musicLabelWithMinimize ||
    !stopWithMinimize ||
    Math.abs(
      musicLabelWithMinimize.x + musicLabelWithMinimize.width / 2 -
        (musicControlsWithMinimize.x + musicControlsWithMinimize.width / 2)
    ) > 1 ||
    Math.abs(stopWithMinimize.x - stopBeforeMinimize.x) > 1
  ) {
    throw new Error(
      `Music metadata or Stop shifted when the minimize slot appeared: ${JSON.stringify({ musicControlsWithMinimize, musicLabelWithMinimize, stopBeforeMinimize, stopWithMinimize })}`
    );
  }
  await page.getByRole("link", { name: "View Moonlit Home on the Music page" }).click();
  await page.waitForURL("**/music#release-c4cd15e3-5ba5-4d5b-99ad-91fcf082a3aa");
  await page
    .locator("#release-c4cd15e3-5ba5-4d5b-99ad-91fcf082a3aa")
    .waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Stop music and return to ambient playback" }).click();
  await page.getByRole("link", { name: "Home", exact: true }).click();
  await navigateFromHome(page, "Blog");
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
  await mobilePage.locator("[data-site-wordmark]").waitFor({ state: "visible" });
  await mobilePage.getByLabel("Loading releases").waitFor({ state: "visible" });
  await mobilePage.getByRole("heading", { name: "Moonlit Home" }).waitFor({ state: "visible" });
  await mobilePage.getByRole("button", { name: "Moonlit Home" }).click();
  await mobilePage.locator("[data-music-transport-loading]").waitFor({ state: "visible" });
  await mobilePage.locator("[data-music-transport-loading]").waitFor({ state: "hidden" });
  const mobileTransportBounds = await mobilePage
    .locator('[aria-label="Music player"]')
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
    .locator('[aria-label="Music player"]')
    .evaluate((element) => {
      const boxes = Array.from(element.children)
        .map((child) => child.getBoundingClientRect())
        .sort((left, right) => left.left - right.left);
      return boxes.some((box, index) => {
        const next = boxes[index + 1];
        return next
          ? box.right > next.left + 0.5 &&
              box.bottom > next.top + 0.5 &&
              next.bottom > box.top + 0.5
          : false;
      });
    });
  if (mobileTransportChildrenOverlap) {
    throw new Error("Music transport controls overlap at 320px.");
  }
  const [mobileTrackLabelInlineBox, mobilePlayButtonBox] = await Promise.all([
    mobilePage.getByRole("link", { name: "View Moonlit Home on the Music page" }).boundingBox(),
    mobilePage.getByRole("button", { name: /^(Play|Pause) music$/ }).boundingBox(),
  ]);
  if (
    !mobileTrackLabelInlineBox ||
    !mobilePlayButtonBox ||
    mobileTrackLabelInlineBox.y + mobileTrackLabelInlineBox.height <= mobilePlayButtonBox.y ||
    mobileTrackLabelInlineBox.y >= mobilePlayButtonBox.y + mobilePlayButtonBox.height
  ) {
    throw new Error(
      `Track label is not inline with 320px controls: ${JSON.stringify({ mobileTrackLabelInlineBox, mobilePlayButtonBox })}`
    );
  }
  const mobileProgressRail = await mobilePage.locator("[data-music-progress-rail]").boundingBox();
  if (
    !mobileProgressRail ||
    Math.abs(mobileProgressRail.height - 4) > 0.5 ||
    Math.abs(mobileProgressRail.y + mobileProgressRail.height - 700) > 0.5
  ) {
    throw new Error(`Music progress rail is misplaced at 320px: ${JSON.stringify(mobileProgressRail)}`);
  }
  await mobilePage.getByRole("button", { name: "Minimize page" }).click();
  const minimizedWordmark = mobilePage.locator("[data-site-wordmark]");
  const minimizedTrackLink = mobilePage.getByRole("link", {
    name: "View Moonlit Home on the Music page",
  });
  await minimizedWordmark.waitFor({ state: "visible" });
  const [minimizedWordmarkBox, minimizedMusicPlayBox, minimizedTrackBox] = await Promise.all([
    minimizedWordmark.boundingBox(),
    mobilePage.getByRole("button", { name: /^(Play|Pause) music$/ }).boundingBox(),
    minimizedTrackLink.boundingBox(),
  ]);
  if (
    !minimizedWordmarkBox ||
    !minimizedMusicPlayBox ||
    !minimizedTrackBox ||
    minimizedWordmarkBox.x > 24 ||
    minimizedWordmarkBox.y > 24 ||
    minimizedTrackBox.y + minimizedTrackBox.height <= minimizedMusicPlayBox.y ||
    minimizedTrackBox.y >= minimizedMusicPlayBox.y + minimizedMusicPlayBox.height ||
    (await mobilePage.getByRole("button", { name: "Restore page" }).count()) !== 1
  ) {
    throw new Error(
      `Minimized music layout is invalid at 320px: ${JSON.stringify({ minimizedWordmarkBox, minimizedMusicPlayBox, minimizedTrackBox })}`
    );
  }
  await minimizedTrackLink.click();
  await mobilePage.waitForURL("**/music#release-c4cd15e3-5ba5-4d5b-99ad-91fcf082a3aa");
  await mobilePage.getByRole("button", { name: "Minimize page" }).waitFor({ state: "visible" });
  if (
    (await mobilePage.locator("[data-document-nav]").count()) !== 1 ||
    (await mobilePage.locator("[data-document-bottom-controls]").count()) !== 0
  ) {
    throw new Error("Mobile music playback did not preserve only the upper section row.");
  }
  await mobilePage.locator("main > div > article").evaluate((article) => {
    article.style.minHeight = "1800px";
  });
  const mobileControlsBeforeScroll = await mobilePage
    .locator('[aria-label="Music player"]')
    .boundingBox();
  await mobilePage.evaluate(() => window.scrollTo(0, 600));
  const mobileControlsAfterScroll = await mobilePage
    .locator('[aria-label="Music player"]')
    .boundingBox();
  if (
    !mobileControlsBeforeScroll ||
    !mobileControlsAfterScroll ||
    Math.abs(mobileControlsBeforeScroll.y - mobileControlsAfterScroll.y) > 0.5
  ) {
    throw new Error(
      `Mobile music controls moved during scroll: ${JSON.stringify({ mobileControlsBeforeScroll, mobileControlsAfterScroll })}`
    );
  }
  const [mobileSizeControlBox, mobileTrackLabelBox] = await Promise.all([
    mobilePage.getByRole("button", { name: "Minimize page" }).boundingBox(),
    mobilePage.getByRole("link", { name: "View Moonlit Home on the Music page" }).boundingBox(),
  ]);
  if (
    !mobileSizeControlBox ||
    !mobileTrackLabelBox ||
    (mobileSizeControlBox.x < mobileTrackLabelBox.x + mobileTrackLabelBox.width &&
      mobileSizeControlBox.x + mobileSizeControlBox.width > mobileTrackLabelBox.x &&
      mobileSizeControlBox.y < mobileTrackLabelBox.y + mobileTrackLabelBox.height &&
      mobileSizeControlBox.y + mobileSizeControlBox.height > mobileTrackLabelBox.y)
  ) {
    throw new Error(
      `Mobile size control obscures the persistent track label: ${JSON.stringify({ mobileSizeControlBox, mobileTrackLabelBox })}`
    );
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
