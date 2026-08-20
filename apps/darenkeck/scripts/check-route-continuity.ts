import { fileURLToPath } from "node:url";

import { chromium, type Browser, type Page } from "playwright";
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

const continuityCombo = {
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
};

async function configurePlaybackRoutes(page: Page, onRandomRequest: () => void): Promise<void> {
  await page.route("**/public/combos/random**", async (route) => {
    onRandomRequest();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(continuityCombo),
    });
  });
  await page.route("https://media.invalid/**", (route) => route.abort());
}

async function scrollDocument(page: Page, label: string): Promise<void> {
  const scrollY = await page.evaluate(async () => {
    window.scrollTo(0, 900);
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    return window.scrollY;
  });
  if (scrollY <= 0) throw new Error(`${label} document did not become scrollable.`);
}

try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let randomRequests = 0;
  await configurePlaybackRoutes(page, () => {
    randomRequests += 1;
  });

  await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: "domcontentloaded" });
  await page.locator("video").waitFor({ state: "attached" });
  await page
    .locator('button[aria-label="Explore combinations by tone"] svg[data-tone-wheel="predicted"]')
    .waitFor({ state: "visible" });
  await page.evaluate(() => {
    (window as Window & { continuityVideo?: HTMLVideoElement }).continuityVideo =
      document.querySelector("video") ?? undefined;
  });

  const homePanelBox = await page.locator("[data-home-panel]").boundingBox();
  const homeMinimizeBox = await page.locator("[data-home-minimize-control]").boundingBox();
  const homeTitleBox = await page.locator("[data-home-panel] header strong").boundingBox();
  if (
    !homePanelBox ||
    !homeMinimizeBox ||
    !homeTitleBox ||
    Math.abs(homeMinimizeBox.x + homeMinimizeBox.width - (homePanelBox.x + homePanelBox.width - 4)) >
      1 ||
    Math.abs(
      homeMinimizeBox.y +
        homeMinimizeBox.height / 2 -
        (homeTitleBox.y + homeTitleBox.height / 2)
    ) > 1
  ) {
    throw new Error(
      `Homepage minimize control is not aligned with the title: ${JSON.stringify({ homeMinimizeBox, homePanelBox, homeTitleBox })}`
    );
  }

  await page.getByRole("button", { name: "Minimize page" }).click();
  await page.getByRole("button", { name: "Restore page" }).waitFor({ state: "visible" });
  const sameVideoOnMinimizedHome = await page.evaluate(
    () =>
      (window as Window & { continuityVideo?: HTMLVideoElement }).continuityVideo ===
      document.querySelector("video")
  );
  if (!sameVideoOnMinimizedHome) throw new Error("Homepage minimize remounted ComboPlayer.");
  await page.getByRole("button", { name: "Restore page" }).click();
  await page.getByRole("button", { name: "Minimize page" }).waitFor({ state: "visible" });

  await page.getByRole("button", { name: "Explore combinations by tone" }).click();
  await page.getByRole("button", { name: "OK" }).click();
  await page.getByTitle("Soft, careful, and non-threatening.").click();
  await page.getByRole("button", { name: "Unmute audio" }).click();
  await page.getByRole("button", { name: "Close tone explorer" }).click();
  const requestCountBeforeNavigation = randomRequests;

  await page.getByRole("link", { name: "Resume" }).click();
  await page.locator(".resume-document").waitFor({ state: "visible" });
  const resumeBreadcrumbs = page.getByRole("navigation", { name: "Breadcrumb" });
  await resumeBreadcrumbs.getByRole("link", { name: "Home" }).waitFor({ state: "visible" });
  await resumeBreadcrumbs.getByText("resume", { exact: true }).waitFor({ state: "visible" });
  await page.getByRole("link", { name: "Download" }).waitFor({ state: "visible" });
  const resumeCardBox = await page.locator(".resume-document").boundingBox();
  const resumeNavBox = await page.locator("[data-document-nav]").boundingBox();
  const desktopBreadcrumbBox = await resumeBreadcrumbs.boundingBox();
  const desktopMinimizeBox = await page
    .locator("[data-document-minimize-control]")
    .boundingBox();
  if (!resumeCardBox || !resumeNavBox || Math.abs(resumeCardBox.y - resumeNavBox.y) > 1) {
    throw new Error(
      `Document navigation is not flush with its container: ${JSON.stringify({ resumeCardBox, resumeNavBox })}`
    );
  }
  if (
    !desktopMinimizeBox ||
    !desktopBreadcrumbBox ||
    Math.abs(
      desktopMinimizeBox.x +
        desktopMinimizeBox.width -
        (resumeNavBox.x + resumeNavBox.width - 4)
    ) >
      1 ||
    Math.abs(
      desktopMinimizeBox.y +
        desktopMinimizeBox.height / 2 -
        (desktopBreadcrumbBox.y + desktopBreadcrumbBox.height / 2)
    ) > 1
  ) {
    throw new Error(
      `Document minimize control is not aligned with breadcrumbs: ${JSON.stringify({ desktopBreadcrumbBox, desktopMinimizeBox, resumeNavBox })}`
    );
  }
  const matchingTopCorners = await page.evaluate(() => {
    const card = document.querySelector(".resume-document");
    const nav = document.querySelector("[data-document-nav]");
    if (!card || !nav) return false;
    return (
      getComputedStyle(card).borderTopLeftRadius === getComputedStyle(nav).borderTopLeftRadius &&
      getComputedStyle(card).borderTopRightRadius === getComputedStyle(nav).borderTopRightRadius
    );
  });
  if (!matchingTopCorners) {
    throw new Error("Document navigation corners do not match the container.");
  }
  await page.getByRole("button", { name: "Minimize page" }).waitFor({ state: "visible" });

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

  await page.evaluate(() => {
    (window as Window & { continuityDocument?: Element }).continuityDocument =
      document.querySelector(".resume-document") ?? undefined;
  });
  await scrollDocument(page, "Desktop resume before minimize");
  const desktopScrollBeforeMinimize = await page.evaluate(() => window.scrollY);
  await page.getByRole("button", { name: "Minimize page" }).click();
  await page.getByRole("button", { name: "Restore page" }).waitFor({ state: "visible" });
  await page.locator(".resume-document").waitFor({ state: "hidden" });
  const desktopMinimizedState = await page.evaluate(() => ({
    sameDocument:
      (window as Window & { continuityDocument?: Element }).continuityDocument ===
      document.querySelector(".resume-document"),
    sameVideo:
      (window as Window & { continuityVideo?: HTMLVideoElement }).continuityVideo ===
      document.querySelector("video"),
  }));
  if (!desktopMinimizedState.sameDocument || !desktopMinimizedState.sameVideo) {
    throw new Error(
      `Desktop minimize remounted persistent UI: ${JSON.stringify(desktopMinimizedState)}`
    );
  }
  await page.getByRole("button", { name: "Restore page" }).click();
  await page.locator(".resume-document").waitFor({ state: "visible" });
  await page.waitForFunction((scrollY) => window.scrollY === scrollY, desktopScrollBeforeMinimize);
  const focusReturnedToMinimize = await page
    .getByRole("button", { name: "Minimize page" })
    .evaluate((button) => document.activeElement === button);
  if (!focusReturnedToMinimize) {
    throw new Error("Restoring the desktop document did not return focus to Minimize.");
  }
  if (randomRequests !== requestCountBeforeNavigation) {
    throw new Error("Minimizing the desktop document triggered another random combo request.");
  }

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
  await blogBreadcrumbs.getByRole("link", { name: "Home" }).waitFor({ state: "visible" });
  await blogBreadcrumbs.getByText("blog", { exact: true }).waitFor({ state: "visible" });
  const blogIndexCardBox = await page.locator(".blog-document").boundingBox();
  const desktopViewport = page.viewportSize();
  if (
    !blogIndexCardBox ||
    !desktopViewport ||
    Math.abs(blogIndexCardBox.y + blogIndexCardBox.height - (desktopViewport.height - 40)) > 1
  ) {
    throw new Error(
      `Blog index card is not bottom aligned: ${JSON.stringify({ blogIndexCardBox, desktopViewport })}`
    );
  }
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
    const documentNav = page.locator("[data-document-nav]");
    await scrollDocument(page, "Desktop blog");
    const stickyNavBox = await documentNav.boundingBox();
    if (!stickyNavBox || stickyNavBox.y < -1 || stickyNavBox.y > 1) {
      throw new Error(`Document navigation did not remain sticky: ${JSON.stringify(stickyNavBox)}`);
    }
    const markdownTable = page.locator("[data-markdown-table]").first();
    if ((await markdownTable.count()) > 0) {
      await markdownTable.locator("table thead th").first().waitFor({ state: "visible" });
    }
    const sameVideoOnEntry = await page.evaluate(
      () =>
        (window as Window & { continuityVideo?: HTMLVideoElement }).continuityVideo ===
        document.querySelector("video")
    );
    if (!sameVideoOnEntry) throw new Error("ComboPlayer remounted while opening a blog entry.");
  }

  const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  let mobileRandomRequests = 0;
  await configurePlaybackRoutes(mobilePage, () => {
    mobileRandomRequests += 1;
  });
  await mobilePage.goto(`http://127.0.0.1:${address.port}/`, {
    waitUntil: "domcontentloaded",
  });
  await mobilePage.locator("video").waitFor({ state: "attached" });
  await mobilePage.evaluate(() => {
    (window as Window & { mobileContinuityVideo?: HTMLVideoElement }).mobileContinuityVideo =
      document.querySelector("video") ?? undefined;
  });
  const mobileHomeControls = mobilePage.locator("[data-media-controls]");
  await mobileHomeControls.waitFor({ state: "visible" });
  const homeControlPosition = await mobileHomeControls
    .getByRole("button", { name: "Unmute audio" })
    .evaluate((button) => getComputedStyle(button).position);
  if (homeControlPosition !== "fixed") {
    throw new Error(
      `Mobile homepage controls must remain floating, received ${homeControlPosition}.`
    );
  }

  await mobilePage.getByRole("link", { name: "Resume" }).click();
  const mobileResumeNav = mobilePage.locator("[data-document-nav]");
  const mobileAudioControl = mobileResumeNav.locator("[data-document-audio-control]");
  const mobileToneControl = mobileResumeNav.locator("[data-document-tone-control]");
  const mobileMinimizeControl = mobileResumeNav.getByRole("button", { name: "Minimize page" });
  await mobileAudioControl.waitFor({ state: "visible" });
  await mobileToneControl.waitFor({ state: "visible" });
  await mobileMinimizeControl.waitFor({ state: "visible" });
  const mobileResumeCardBox = await mobilePage.locator(".resume-document").boundingBox();
  if (!mobileResumeCardBox || Math.abs(mobileResumeCardBox.width - 390) > 1) {
    throw new Error(
      `Mobile resume card did not fill the viewport: ${JSON.stringify(mobileResumeCardBox)}`
    );
  }
  const embeddedControlPosition = await mobileAudioControl
    .getByRole("button", { name: "Unmute audio" })
    .evaluate((button) => getComputedStyle(button).position);
  if (embeddedControlPosition !== "relative") {
    throw new Error(
      `Mobile document controls must be embedded, received ${embeddedControlPosition}.`
    );
  }
  const mobileAudioBox = await mobileAudioControl.boundingBox();
  const mobileBreadcrumb = mobileResumeNav.getByRole("navigation", { name: "Breadcrumb" });
  const mobileBreadcrumbBox = await mobileBreadcrumb.boundingBox();
  const mobileMinimizeBox = await mobileMinimizeControl.boundingBox();
  const mobileToneBox = await mobileToneControl.boundingBox();
  if (
    !mobileAudioBox ||
    !mobileBreadcrumbBox ||
    !mobileMinimizeBox ||
    !mobileToneBox ||
    mobileAudioBox.x + mobileAudioBox.width > mobileBreadcrumbBox.x ||
    mobileBreadcrumbBox.x + mobileBreadcrumbBox.width > mobileToneBox.x ||
    mobileToneBox.x + mobileToneBox.width > mobileMinimizeBox.x
  ) {
    throw new Error(
      `Mobile controls do not flank breadcrumbs: ${JSON.stringify({ mobileAudioBox, mobileBreadcrumbBox, mobileMinimizeBox, mobileToneBox })}`
    );
  }
  const mobileBreadcrumbJustification = await mobileBreadcrumb
    .locator("ol")
    .evaluate((list) => getComputedStyle(list).justifyContent);
  if (mobileBreadcrumbJustification !== "center") {
    throw new Error(`Mobile breadcrumbs are not centered: ${mobileBreadcrumbJustification}.`);
  }
  await scrollDocument(mobilePage, "Mobile resume before tone selection");
  const mobileScrollBeforeTone = await mobilePage.evaluate(() => window.scrollY);
  await mobileMinimizeControl.click();
  const mobileRestoreControl = mobilePage.getByRole("button", { name: "Restore page" });
  await mobileRestoreControl.waitFor({ state: "visible" });
  await mobilePage.locator(".resume-document").waitFor({ state: "hidden" });
  const minimizedFloatingControls = mobilePage.locator("[data-media-controls]");
  await minimizedFloatingControls.waitFor({ state: "visible" });
  const minimizedAudioPosition = await minimizedFloatingControls
    .getByRole("button", { name: "Unmute audio" })
    .evaluate((button) => getComputedStyle(button).position);
  const sameMobileVideoWhileMinimized = await mobilePage.evaluate(
    () =>
      (window as Window & { mobileContinuityVideo?: HTMLVideoElement }).mobileContinuityVideo ===
      document.querySelector("video")
  );
  if (minimizedAudioPosition !== "fixed" || !sameMobileVideoWhileMinimized) {
    throw new Error(
      `Mobile minimize did not preserve playback or float controls: ${JSON.stringify({ minimizedAudioPosition, sameMobileVideoWhileMinimized })}`
    );
  }
  await mobileRestoreControl.click();
  await mobileAudioControl.waitFor({ state: "visible" });
  await mobilePage.waitForFunction((scrollY) => window.scrollY === scrollY, mobileScrollBeforeTone);
  await mobileAudioControl.getByRole("button", { name: "Unmute audio" }).click();
  await mobileAudioControl
    .getByRole("button", { name: "Mute audio" })
    .waitFor({ state: "visible" });
  await mobileToneControl.getByRole("button", { name: "Explore combinations by tone" }).click();
  const mobileExplainerAccept = mobilePage.getByRole("button", { name: "OK" });
  if (await mobileExplainerAccept.isVisible()) await mobileExplainerAccept.click();
  await mobileToneControl
    .getByRole("button", { name: "Explore combinations by tone" })
    .waitFor({ state: "visible" });
  if ((await mobileResumeNav.locator("[data-document-audio-control]").count()) !== 0) {
    throw new Error("Embedded mute control remained visible while tone selection was open.");
  }
  const mobileOverlayClose = mobilePage.locator("[data-tone-explorer-close]");
  await mobileOverlayClose.waitFor({ state: "visible" });
  const mobileToneBackdropBox = await mobilePage
    .locator("[data-tone-explorer-backdrop]")
    .boundingBox();
  const mobileToneSuggestionsBox = await mobilePage
    .locator("[data-tone-explorer-suggestions]")
    .boundingBox();
  const mobileOpenToneBox = await mobileOverlayClose.boundingBox();
  const mobileScrollLock = await mobilePage.evaluate(() => ({
    bodyPosition: document.body.style.position,
    bodyTop: document.body.style.top,
    rootOverflow: document.documentElement.style.overflow,
  }));
  if (
    !mobileToneBackdropBox ||
    mobileToneBackdropBox.x !== 0 ||
    mobileToneBackdropBox.y !== 0 ||
    Math.abs(mobileToneBackdropBox.width - 390) > 1 ||
    Math.abs(mobileToneBackdropBox.height - 844) > 1 ||
    !mobileToneSuggestionsBox ||
    !mobileOpenToneBox ||
    mobileToneSuggestionsBox.y < 844 * 0.25 ||
    mobileToneSuggestionsBox.y < mobileOpenToneBox.y + mobileOpenToneBox.height ||
    mobileScrollLock.rootOverflow !== "hidden" ||
    mobileScrollLock.bodyPosition !== "fixed" ||
    mobileScrollLock.bodyTop !== `-${mobileScrollBeforeTone}px`
  ) {
    throw new Error(
      `Mobile tone explorer layout or scroll lock is invalid: ${JSON.stringify({ mobileToneBackdropBox, mobileToneSuggestionsBox, mobileOpenToneBox, mobileScrollLock, mobileScrollBeforeTone })}`
    );
  }
  await mobileOverlayClose.click();
  await mobileAudioControl.waitFor({ state: "visible" });
  const mobileScrollAfterTone = await mobilePage.evaluate(() => ({
    bodyPosition: document.body.style.position,
    rootOverflow: document.documentElement.style.overflow,
    scrollY: window.scrollY,
  }));
  if (
    mobileScrollAfterTone.bodyPosition !== "" ||
    mobileScrollAfterTone.rootOverflow !== "" ||
    mobileScrollAfterTone.scrollY !== mobileScrollBeforeTone
  ) {
    throw new Error(
      `Mobile tone explorer did not restore page scrolling: ${JSON.stringify({ mobileScrollAfterTone, mobileScrollBeforeTone })}`
    );
  }

  await mobileToneControl.getByRole("button", { name: "Explore combinations by tone" }).click();
  await mobileOverlayClose.waitFor({ state: "visible" });
  const toneSubmittedAt = Date.now();
  await mobilePage.getByTitle("Start random walk").click();
  await mobilePage
    .locator('[data-submit-state="succeeded"]')
    .waitFor({ state: "visible", timeout: 500 });
  await mobileOverlayClose.waitFor({ state: "hidden", timeout: 2000 });
  const toneSuccessDuration = Date.now() - toneSubmittedAt;
  if (toneSuccessDuration < 900) {
    throw new Error(
      `Tone explorer closed before its success check was readable: ${toneSuccessDuration}ms.`
    );
  }
  await mobileAudioControl.waitFor({ state: "visible" });
  await mobilePage.evaluate(() => {
    (window as Window & { mobileContinuityVideo?: HTMLVideoElement }).mobileContinuityVideo =
      document.querySelector("video") ?? undefined;
  });

  await scrollDocument(mobilePage, "Mobile resume");
  const mobileStickyNavBox = await mobileResumeNav.boundingBox();
  const mobileStickyAudioBox = await mobileAudioControl.boundingBox();
  const mobileStickyToneBox = await mobileToneControl.boundingBox();
  if (
    !mobileStickyNavBox ||
    !mobileStickyAudioBox ||
    !mobileStickyToneBox ||
    mobileStickyNavBox.y < -1 ||
    mobileStickyNavBox.y > 1 ||
    mobileStickyAudioBox.y < mobileStickyNavBox.y ||
    mobileStickyToneBox.y < mobileStickyNavBox.y ||
    mobileStickyAudioBox.y + mobileStickyAudioBox.height >
      mobileStickyNavBox.y + mobileStickyNavBox.height ||
    mobileStickyToneBox.y + mobileStickyToneBox.height >
      mobileStickyNavBox.y + mobileStickyNavBox.height
  ) {
    throw new Error(
      `Mobile media controls did not remain inside sticky navigation: ${JSON.stringify({ mobileStickyNavBox, mobileStickyAudioBox, mobileStickyToneBox })}`
    );
  }
  const sameMobileVideo = await mobilePage.evaluate(
    () =>
      (window as Window & { mobileContinuityVideo?: HTMLVideoElement }).mobileContinuityVideo ===
      document.querySelector("video")
  );
  if (!sameMobileVideo) throw new Error("ComboPlayer remounted on the mobile resume route.");

  await mobileResumeNav.getByRole("link", { name: "Home" }).click();
  await mobilePage.getByRole("link", { name: "Blog" }).click();
  await mobilePage.locator("[data-document-audio-control]").waitFor({ state: "visible" });
  await mobilePage.locator("[data-document-tone-control]").waitFor({ state: "visible" });
  if (mobileRandomRequests !== 2) {
    throw new Error("Mobile document navigation triggered another random combo request.");
  }

  const mediumPage = await browser.newPage({ viewport: { width: 820, height: 600 } });
  let mediumRandomRequests = 0;
  await configurePlaybackRoutes(mediumPage, () => {
    mediumRandomRequests += 1;
  });
  await mediumPage.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: "domcontentloaded" });
  await mediumPage.locator("video").waitFor({ state: "attached" });
  await mediumPage.evaluate(() => {
    (window as Window & { mediumContinuityVideo?: HTMLVideoElement }).mediumContinuityVideo =
      document.querySelector("video") ?? undefined;
  });
  await mediumPage.getByRole("link", { name: "Blog" }).click();
  const mediumBlogCard = mediumPage.locator(".blog-document");
  await mediumBlogCard.waitFor({ state: "visible" });
  const mediumCardBox = await mediumBlogCard.boundingBox();
  if (!mediumCardBox || Math.abs(mediumCardBox.width - 820) > 1) {
    throw new Error(`Medium blog card did not fill the viewport: ${JSON.stringify(mediumCardBox)}`);
  }
  const mediumEntries = mediumPage.locator('.blog-document a[href^="/blog/"]');
  if ((await mediumEntries.count()) > 0) {
    await mediumEntries.first().click();
    await mediumPage.waitForURL(/\/blog\/.+/);
    await mediumPage.locator(".blog-document h1").waitFor({ state: "visible" });
  }
  const mediumNav = mediumPage.locator("[data-document-nav]");
  const mediumAudio = mediumNav.locator("[data-document-audio-control]");
  const mediumTone = mediumNav.locator("[data-document-tone-control]");
  const mediumMinimize = mediumNav.getByRole("button", { name: "Minimize page" });
  await mediumAudio.waitFor({ state: "visible" });
  await mediumTone.waitFor({ state: "visible" });
  await mediumMinimize.waitFor({ state: "visible" });
  const mediumAudioBox = await mediumAudio.boundingBox();
  const mediumBreadcrumb = mediumNav.getByRole("navigation", { name: "Breadcrumb" });
  const mediumBreadcrumbBox = await mediumBreadcrumb.boundingBox();
  const mediumMinimizeBox = await mediumMinimize.boundingBox();
  const mediumToneBox = await mediumTone.boundingBox();
  if (
    !mediumAudioBox ||
    !mediumBreadcrumbBox ||
    !mediumMinimizeBox ||
    !mediumToneBox ||
    mediumAudioBox.x + mediumAudioBox.width > mediumBreadcrumbBox.x ||
    mediumBreadcrumbBox.x + mediumBreadcrumbBox.width > mediumToneBox.x ||
    mediumToneBox.x + mediumToneBox.width > mediumMinimizeBox.x
  ) {
    throw new Error(
      `Medium controls do not flank breadcrumbs: ${JSON.stringify({ mediumAudioBox, mediumBreadcrumbBox, mediumMinimizeBox, mediumToneBox })}`
    );
  }
  const mediumBreadcrumbJustification = await mediumBreadcrumb
    .locator("ol")
    .evaluate((list) => getComputedStyle(list).justifyContent);
  if (mediumBreadcrumbJustification !== "center") {
    throw new Error(`Medium breadcrumbs are not centered: ${mediumBreadcrumbJustification}.`);
  }
  await scrollDocument(mediumPage, "Medium blog");
  const mediumStickyNavBox = await mediumNav.boundingBox();
  if (!mediumStickyNavBox || mediumStickyNavBox.y < -1 || mediumStickyNavBox.y > 1) {
    throw new Error(
      `Medium document navigation did not remain sticky: ${JSON.stringify(mediumStickyNavBox)}`
    );
  }
  const sameMediumVideo = await mediumPage.evaluate(
    () =>
      (window as Window & { mediumContinuityVideo?: HTMLVideoElement }).mediumContinuityVideo ===
      document.querySelector("video")
  );
  if (!sameMediumVideo || mediumRandomRequests !== 1) {
    throw new Error("Medium blog navigation did not preserve playback continuity.");
  }

  console.log("Darenkeck route continuity check passed");
} finally {
  await browser?.close();
  await viteServer.close();
}
