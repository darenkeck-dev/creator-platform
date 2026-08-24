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

async function navigateFromHome(page: Page, label: "Blog" | "Resume"): Promise<void> {
  const homePanel = page.locator("[data-home-panel]");
  await homePanel.getByRole("button", { name: "Open navigation" }).click();
  await homePanel
    .getByRole("navigation", { name: "Primary" })
    .getByRole("link", { name: label })
    .click();
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
  const homePageScroll = await page.evaluate(() => {
    window.scrollTo(0, 100);
    const state = {
      scrollHeight: document.scrollingElement?.scrollHeight ?? 0,
      scrollY: window.scrollY,
      viewportHeight: window.innerHeight,
    };
    window.scrollTo(0, 0);
    return state;
  });
  const homeNewsBox = await page.getByRole("region", { name: "Latest news" }).boundingBox();
  const allNewsColor = await page
    .getByRole("link", { name: "All news" })
    .evaluate((link) => getComputedStyle(link).color);
  const homePanelShellPosition = await page
    .locator("[data-home-panel-shell]")
    .evaluate((shell) => getComputedStyle(shell).position);
  const homeMediaBackground = await page
    .locator("[data-media-controls]")
    .evaluate((controls) => getComputedStyle(controls).backgroundColor);
  const homeCircleBorders = await page
    .locator("[data-media-controls] button")
    .evaluateAll((buttons) => buttons.map((button) => getComputedStyle(button).borderTopWidth));
  const homeNavigationButton = page.getByRole("button", { name: "Open navigation" });
  const homeNavigationButtonBox = await homeNavigationButton.boundingBox();
  const homeNavigationButtonBorder = await homeNavigationButton.evaluate(
    (button) => getComputedStyle(button).borderTopWidth
  );
  const homeNavigationGlyph = await homeNavigationButton.locator("svg path").evaluate((path) => {
    const box = (path as SVGGraphicsElement).getBBox();
    return { height: box.height, width: box.width };
  });
  const homeNavigationGlyphRects = await homeNavigationButton.locator("svg rect").count();
  const homeHeaderControlsBox = await page.locator("[data-home-header-controls]").boundingBox();
  const homeMediaBox = await page.locator("[data-media-controls]").boundingBox();
  const homeMinimizeBox = await page.getByRole("button", { name: "Minimize page" }).boundingBox();
  const homeTitleBox = await page.locator("[data-home-panel] header strong").boundingBox();
  if (
    !homePanelBox ||
    !homeMediaBox ||
    !homeMinimizeBox ||
    !homeNewsBox ||
    !homeNavigationButtonBox ||
    !homeHeaderControlsBox ||
    !homeTitleBox ||
    homePageScroll.scrollY !== 0 ||
    homePageScroll.scrollHeight > homePageScroll.viewportHeight + 1 ||
    homePanelShellPosition === "fixed" ||
    allNewsColor !== "rgb(233, 204, 0)" ||
    homeMediaBackground === "rgba(0, 0, 0, 0)" ||
    homeCircleBorders.some((borderWidth) => borderWidth !== "0px") ||
    homeNavigationButtonBorder !== "0px" ||
    homeNavigationGlyphRects !== 0 ||
    homeNavigationGlyph.width < 14 ||
    homeNavigationGlyph.height < 10 ||
    Math.abs(homePanelBox.width - 896) > 1 ||
    homeHeaderControlsBox.width > 72 ||
    homeHeaderControlsBox.height > 32 ||
    Math.abs(
      homeHeaderControlsBox.x +
        homeHeaderControlsBox.width -
        (homePanelBox.x + homePanelBox.width - 56)
    ) >
      1 ||
    Math.abs(
      homeNavigationButtonBox.y +
        homeNavigationButtonBox.height / 2 -
        (homeMinimizeBox.y + homeMinimizeBox.height / 2)
    ) > 1 ||
    Math.abs(homeNewsBox.y + homeNewsBox.height - (homePanelBox.y + homePanelBox.height)) > 1 ||
    Math.abs(homePanelBox.y + homePanelBox.height - homeMediaBox.y) > 1
  ) {
    throw new Error(
      `Homepage shelf controls or viewport lock are invalid: ${JSON.stringify({ homeHeaderControlsBox, homeMinimizeBox, homeNavigationButtonBox, homePageScroll, homePanelBox, homeMediaBox, homePanelShellPosition, homeTitleBox })}`
    );
  }

  await page.locator("[data-home-navigation-button]").click();
  await page.waitForTimeout(250);
  const expandedHomeMenu = page.locator("[data-home-navigation-menu]");
  const [
    expandedHomeMenuBackground,
    expandedHomeMenuBox,
    expandedHomeLinkBoxes,
    expandedHomeHeaderOpacity,
    expandedBurgerTransform,
  ] =
    await Promise.all([
      expandedHomeMenu.evaluate((menu) => getComputedStyle(menu).backgroundColor),
      expandedHomeMenu.boundingBox(),
      expandedHomeMenu.locator("a").evaluateAll((links) =>
        links.map((link) => {
          const box = link.getBoundingClientRect();
          const style = getComputedStyle(link);
          return {
            color: style.color,
            fontSize: style.fontSize,
            height: box.height,
            width: box.width,
            x: box.x,
            y: box.y,
          };
        })
      ),
      page.locator("[data-home-intro]").evaluate((header) => getComputedStyle(header).opacity),
      page
        .locator("[data-home-navigation-button] svg")
        .evaluate((svg) => {
          const style = getComputedStyle(svg);
          return { rotate: style.rotate, transform: style.transform };
        }),
    ]);
  if (
    !expandedHomeMenuBox ||
    expandedHomeMenuBackground !== "rgba(0, 0, 0, 0)" ||
    expandedHomeHeaderOpacity !== "0" ||
    (expandedBurgerTransform.transform === "none" && expandedBurgerTransform.rotate === "none") ||
    expandedBurgerTransform.rotate !== "-90deg" ||
    expandedHomeMenuBox.x + expandedHomeMenuBox.width > homeNavigationButtonBox.x + 1 ||
    expandedHomeLinkBoxes.map((box) => box.color).join("|") !==
      "rgb(0, 134, 186)|rgb(253, 71, 0)|rgb(250, 1, 0)" ||
    expandedHomeLinkBoxes.some((box) => box.fontSize !== "16px") ||
    expandedHomeLinkBoxes.some(
      (box) => Math.abs(box.y + box.height / 2 - (expandedHomeMenuBox.y + expandedHomeMenuBox.height / 2)) > 1
    ) ||
    Math.max(...expandedHomeLinkBoxes.map((box) => box.width)) -
      Math.min(...expandedHomeLinkBoxes.map((box) => box.width)) >
      1
  ) {
    throw new Error(
      `Homepage navigation did not expand evenly without a background: ${JSON.stringify({ expandedBurgerTransform, expandedHomeHeaderOpacity, expandedHomeLinkBoxes, expandedHomeMenuBackground, expandedHomeMenuBox, homeNavigationButtonBox })}`
    );
  }
  await page.keyboard.press("Escape");
  await expandedHomeMenu.waitFor({ state: "hidden" });

  await page.getByRole("button", { name: "Minimize page" }).click();
  await page.locator("[data-site-wordmark]").waitFor({ state: "visible" });
  const sameVideoOnMinimizedHome = await page.evaluate(
    () =>
      (window as Window & { continuityVideo?: HTMLVideoElement }).continuityVideo ===
      document.querySelector("video")
  );
  if (!sameVideoOnMinimizedHome) throw new Error("Homepage minimize remounted ComboPlayer.");
  const homeRestoreButton = page.getByRole("button", { name: "Restore page" });
  if ((await homeRestoreButton.locator("svg rect").count()) !== 1) {
    throw new Error("Homepage restore control does not use the same square outline as minimize.");
  }
  await homeRestoreButton.click();
  await page.locator("[data-site-wordmark]").waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Minimize page" }).waitFor({ state: "visible" });

  await page.getByRole("button", { name: "Explore combinations by tone" }).click();
  await page.getByRole("button", { name: "OK" }).click();
  await page.getByTitle("Soft, careful, and non-threatening.").click();
  await page.getByRole("button", { name: "Unmute audio" }).click();
  await page.getByRole("button", { name: "Close tone explorer" }).click();
  const requestCountBeforeNavigation = randomRequests;

  await navigateFromHome(page, "Resume");
  await page.locator(".resume-document").waitFor({ state: "visible" });
  const resumeBreadcrumbs = page.getByRole("navigation", { name: "Breadcrumb" });
  await resumeBreadcrumbs.getByRole("link", { name: "Home" }).waitFor({ state: "visible" });
  await resumeBreadcrumbs.getByText("resume", { exact: true }).waitFor({ state: "visible" });
  const resumeBreadcrumbColor = await resumeBreadcrumbs.evaluate(
    (navigation) => getComputedStyle(navigation).color
  );
  if (resumeBreadcrumbColor !== "rgb(0, 134, 186)") {
    throw new Error(`Resume breadcrumbs use the wrong palette color: ${resumeBreadcrumbColor}.`);
  }
  await page.getByRole("link", { name: "Download" }).waitFor({ state: "visible" });
  const resumeCardBox = await page.locator(".resume-document").boundingBox();
  const resumeNavBox = await page.locator("[data-document-nav]").boundingBox();
  const desktopMediaBox = await page.locator("[data-media-controls]").boundingBox();
  const desktopBreadcrumbBox = await resumeBreadcrumbs.boundingBox();
  const desktopMinimizeBox = await page
    .locator("[data-document-minimize-control]")
    .boundingBox();
  const resumeNavPosition = await page
    .locator("[data-document-nav]")
    .evaluate((navigation) => getComputedStyle(navigation).position);
  if (
    !resumeCardBox ||
    !resumeNavBox ||
    !desktopMediaBox ||
    resumeNavPosition !== "sticky" ||
    Math.abs(resumeNavBox.x + resumeNavBox.width / 2 - 640) > 1 ||
    Math.abs(resumeNavBox.y - resumeCardBox.y) > 1 ||
    Math.abs(resumeNavBox.height - 64) > 1 ||
    Math.abs(desktopMediaBox.y + desktopMediaBox.height - 720) > 1
  ) {
    throw new Error(
      `Document breadcrumb or bottom-control rows are misplaced: ${JSON.stringify({ resumeCardBox, resumeNavBox, desktopMediaBox, resumeNavPosition })}`
    );
  }
  if (
    !desktopMinimizeBox ||
    !desktopBreadcrumbBox ||
    Math.abs(
        desktopMinimizeBox.y +
          desktopMinimizeBox.height / 2 -
        (desktopBreadcrumbBox.y + desktopBreadcrumbBox.height / 2)
    ) > 1
  ) {
    throw new Error(
      `Document minimize control is not aligned with upper navigation: ${JSON.stringify({ desktopBreadcrumbBox, desktopMediaBox, desktopMinimizeBox, resumeNavBox })}`
    );
  }
  if (
    (await page.locator("[data-top-left-scrim]").count()) !== 1 ||
    (await page.locator("[data-top-right-scrim]").count()) !== 1
  ) {
    throw new Error("Top-corner legibility scrims are missing.");
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
  await page.getByRole("button", { name: "Minimize page" }).click();
  await page.locator("[data-site-wordmark]").waitFor({ state: "visible" });
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
  await page.locator("[data-site-wordmark]").waitFor({ state: "visible" });
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

  await navigateFromHome(page, "Blog");
  await page.locator(".blog-document").waitFor({ state: "visible" });
  const blogBreadcrumbs = page.getByRole("navigation", { name: "Breadcrumb" });
  await blogBreadcrumbs.getByRole("link", { name: "Home" }).waitFor({ state: "visible" });
  await blogBreadcrumbs.getByText("blog", { exact: true }).waitFor({ state: "visible" });
  const blogBreadcrumbColor = await blogBreadcrumbs.evaluate(
    (navigation) => getComputedStyle(navigation).color
  );
  if (blogBreadcrumbColor !== "rgb(253, 71, 0)") {
    throw new Error(`Blog breadcrumbs use the wrong palette color: ${blogBreadcrumbColor}.`);
  }
  const blogIndexCardBox = await page.locator(".blog-document").boundingBox();
  const desktopViewport = page.viewportSize();
  if (
    !blogIndexCardBox ||
    !desktopViewport ||
    Math.abs(blogIndexCardBox.y + blogIndexCardBox.height - (desktopViewport.height - 64)) > 1
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
    const fixedNavBox = await documentNav.boundingBox();
    if (
      !fixedNavBox ||
      Math.abs(fixedNavBox.y) > 1 ||
      (await documentNav.getByRole("button", { name: "Open navigation" }).count()) !== 0
    ) {
      throw new Error(`Document navigation did not dock at the top: ${JSON.stringify(fixedNavBox)}`);
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
  const homeControlPosition = await mobileHomeControls.evaluate(
    (controls) => getComputedStyle(controls).position
  );
  const mobileControlsInitialBox = await mobileHomeControls.boundingBox();
  const mobileHomeScroll = await mobilePage.evaluate(() => {
    window.scrollTo(0, 100);
    const state = {
      scrollHeight: document.scrollingElement?.scrollHeight ?? 0,
      scrollY: window.scrollY,
      viewportHeight: window.innerHeight,
    };
    window.scrollTo(0, 0);
    return state;
  });
  if (
    homeControlPosition !== "fixed" ||
    !mobileControlsInitialBox ||
    mobileHomeScroll.scrollY !== 0 ||
    mobileHomeScroll.scrollHeight > mobileHomeScroll.viewportHeight + 1
  ) {
    throw new Error(`Mobile homepage controls must remain fixed: ${homeControlPosition}.`);
  }

  await navigateFromHome(mobilePage, "Resume");
  const mobileResumeNav = mobilePage.locator("[data-document-nav]");
  const mobileMinimizeControl = mobileResumeNav.getByRole("button", {
    name: "Minimize page",
  });
  await mobileMinimizeControl.waitFor({ state: "visible" });
  const mobileResumeCardBox = await mobilePage.locator(".resume-document").boundingBox();
  if (!mobileResumeCardBox || Math.abs(mobileResumeCardBox.width - 390) > 1) {
    throw new Error(
      `Mobile resume card did not fill the viewport: ${JSON.stringify(mobileResumeCardBox)}`
    );
  }
  const mobileBreadcrumb = mobileResumeNav.getByRole("navigation", { name: "Breadcrumb" });
  const mobileDocumentFavicon = mobileResumeNav.locator("[data-document-favicon]");
  await mobileBreadcrumb.waitFor({ state: "visible" });
  await mobileDocumentFavicon.waitFor({ state: "visible" });
  if (
    (await mobileResumeNav.locator("[data-document-audio-control]").count()) !== 0 ||
    (await mobileResumeNav.locator("[data-document-tone-control]").count()) !== 0
  ) {
    throw new Error("Mobile upper navigation still contains media controls.");
  }
  const mobileBreadcrumbJustification = await mobileBreadcrumb
    .locator("ol")
    .evaluate((list) => getComputedStyle(list).justifyContent);
  const [mobileUndockedBreadcrumbBox, mobileUndockedFaviconBox] = await Promise.all([
    mobileBreadcrumb.boundingBox(),
    mobileDocumentFavicon.boundingBox(),
  ]);
  if (
    mobileBreadcrumbJustification !== "flex-start" ||
    !mobileUndockedBreadcrumbBox ||
    !mobileUndockedFaviconBox ||
    Math.abs(
      mobileUndockedBreadcrumbBox.x -
        (mobileUndockedFaviconBox.x + mobileUndockedFaviconBox.width + 8)
    ) > 1
  ) {
    throw new Error(
      `Mobile undocked breadcrumbs are misplaced: ${JSON.stringify({ mobileBreadcrumbJustification, mobileUndockedBreadcrumbBox, mobileUndockedFaviconBox })}`
    );
  }
  await mobilePage.locator("[data-tone-floating]").waitFor({ state: "visible" });
  await scrollDocument(mobilePage, "Mobile resume before tone selection");
  await mobileResumeNav.locator("[data-document-tone-control]").waitFor({ state: "visible" });
  const mobileDockedFavicon = mobileDocumentFavicon;
  await mobileDockedFavicon.waitFor({ state: "visible" });
  await mobilePage.locator("[data-tone-floating]").waitFor({ state: "hidden" });
  await mobilePage.locator("[data-site-wordmark]").waitFor({ state: "hidden" });
  if (
    (await mobilePage.locator("[data-top-left-scrim]").count()) !== 0 ||
    (await mobilePage.locator("[data-top-right-scrim]").count()) !== 0
  ) {
    throw new Error("Top-corner scrims remained visible after document navigation docked.");
  }
  const dockedBreadcrumbBox = await mobileBreadcrumb.boundingBox();
  const dockedBreadcrumbJustification = await mobileBreadcrumb
    .locator("ol")
    .evaluate((list) => getComputedStyle(list).justifyContent);
  const mobileDockedFaviconBox = await mobileDockedFavicon.boundingBox();
  const mobileBottomNavBox = await mobileResumeNav.boundingBox();
  const mobileMediaBox = await mobileHomeControls.boundingBox();
  if (
    !dockedBreadcrumbBox ||
    !mobileDockedFaviconBox ||
    !mobileBottomNavBox ||
    !mobileMediaBox ||
    dockedBreadcrumbJustification !== "flex-start" ||
    Math.abs(
      dockedBreadcrumbBox.x -
        (mobileDockedFaviconBox.x + mobileDockedFaviconBox.width + 8)
    ) > 1 ||
    Math.abs(mobileBottomNavBox.y) > 1 ||
    Math.abs(mobileBottomNavBox.height - 64) > 1 ||
    Math.abs(mobileMediaBox.y + mobileMediaBox.height - 844) > 1
  ) {
    throw new Error(
      `Upper breadcrumb dock or bottom controls are misplaced: ${JSON.stringify({ dockedBreadcrumbBox, dockedBreadcrumbJustification, mobileBottomNavBox, mobileDockedFaviconBox, mobileMediaBox })}`
    );
  }
  let mobileScrollBeforeTone = await mobilePage.evaluate(() => window.scrollY);
  await mobileMinimizeControl.click();
  const mobileMinimizedWordmark = mobilePage.locator("[data-site-wordmark]");
  await mobileMinimizedWordmark.waitFor({ state: "visible" });
  await mobilePage.locator(".resume-document").waitFor({ state: "hidden" });
  const minimizedFloatingControls = mobilePage.locator("[data-media-controls]");
  await minimizedFloatingControls.waitFor({ state: "visible" });
  await mobilePage.locator("[data-tone-floating]").waitFor({ state: "visible" });
  const minimizedAudioPosition = await minimizedFloatingControls.evaluate(
    (controls) => getComputedStyle(controls).position
  );
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
  if ((await minimizedFloatingControls.getByRole("button", { name: "Restore page" }).count()) !== 1) {
    throw new Error("Minimized controls do not expose one restore button.");
  }
  await minimizedFloatingControls.getByRole("button", { name: "Restore page" }).click();
  await mobilePage.locator(".resume-document").waitFor({ state: "visible" });
  await mobileHomeControls.waitFor({ state: "visible" });
  await mobileMinimizedWordmark.waitFor({ state: "visible" });
  mobileScrollBeforeTone = await mobilePage.evaluate(() => window.scrollY);
  await mobileHomeControls.getByRole("button", { name: "Unmute audio" }).click();
  await mobileHomeControls
    .getByRole("button", { name: "Mute audio" })
    .waitFor({ state: "visible" });
  await mobilePage.getByRole("button", { name: "Explore combinations by tone" }).click();
  const mobileExplainerAccept = mobilePage.getByRole("button", { name: "OK" });
  if (await mobileExplainerAccept.isVisible()) await mobileExplainerAccept.click();
  const mobileToneClose = mobilePage.getByRole("button", { name: "Close tone explorer" });
  await mobileToneClose
    .waitFor({ state: "visible" });
  const mobileToneBackdropBox = await mobilePage
    .locator("[data-tone-explorer-backdrop]")
    .boundingBox();
  const mobileToneSuggestionsBox = await mobilePage
    .locator("[data-tone-explorer-suggestions]")
    .boundingBox();
  const mobileOpenToneBox = await mobileToneClose.boundingBox();
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
    mobileScrollLock.bodyTop !==
      (mobileScrollBeforeTone === 0 ? "0px" : `-${mobileScrollBeforeTone}px`)
  ) {
    throw new Error(
      `Mobile tone explorer layout or scroll lock is invalid: ${JSON.stringify({ mobileToneBackdropBox, mobileToneSuggestionsBox, mobileOpenToneBox, mobileScrollLock, mobileScrollBeforeTone })}`
    );
  }
  await mobileToneClose.click();
  await mobileHomeControls.waitFor({ state: "visible" });
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

  await mobilePage.getByRole("button", { name: "Explore combinations by tone" }).click();
  await mobileToneClose.waitFor({ state: "visible" });
  const toneSubmittedAt = Date.now();
  await mobilePage.getByTitle("Start random walk").click();
  await mobilePage
    .locator('[data-submit-state="succeeded"]')
    .waitFor({ state: "visible", timeout: 500 });
  await mobileToneClose.waitFor({ state: "hidden", timeout: 2000 });
  const toneSuccessDuration = Date.now() - toneSubmittedAt;
  if (toneSuccessDuration < 900) {
    throw new Error(
      `Tone explorer closed before its success check was readable: ${toneSuccessDuration}ms.`
    );
  }
  await mobileHomeControls.waitFor({ state: "visible" });
  await mobilePage.evaluate(() => {
    (window as Window & { mobileContinuityVideo?: HTMLVideoElement }).mobileContinuityVideo =
      document.querySelector("video") ?? undefined;
  });

  await scrollDocument(mobilePage, "Mobile resume");
  const mobileStickyNavBox = await mobileResumeNav.boundingBox();
  const mobileControlsAfterScroll = await mobileHomeControls.boundingBox();
  if (
    !mobileStickyNavBox ||
    !mobileControlsAfterScroll ||
    Math.abs(mobileStickyNavBox.y - mobileBottomNavBox.y) > 1 ||
    Math.abs(mobileControlsAfterScroll.y - mobileMediaBox.y) > 1
  ) {
    throw new Error(
      `Mobile bottom controls moved during document scroll: ${JSON.stringify({ mobileStickyNavBox, mobileMediaBox, mobileControlsAfterScroll })}`
    );
  }
  const sameMobileVideo = await mobilePage.evaluate(
    () =>
      (window as Window & { mobileContinuityVideo?: HTMLVideoElement }).mobileContinuityVideo ===
      document.querySelector("video")
  );
  if (!sameMobileVideo) throw new Error("ComboPlayer remounted on the mobile resume route.");

  await mobileMinimizeControl.click();
  await mobilePage.locator("[data-site-wordmark]").waitFor({ state: "visible" });
  await mobilePage.getByRole("button", { name: "Restore page" }).click();
  await mobilePage.locator(".resume-document").waitFor({ state: "visible" });
  await mobileResumeNav.getByRole("link", { name: "Home" }).click();
  await navigateFromHome(mobilePage, "Blog");
  await mobilePage.locator(".blog-document").waitFor({ state: "visible" });
  await mobilePage.getByRole("button", { name: "Minimize page" }).waitFor({ state: "visible" });
  await mobilePage.locator("[data-media-controls]").waitFor({ state: "visible" });
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
  await navigateFromHome(mediumPage, "Blog");
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
  const mediumMinimize = mediumNav.getByRole("button", { name: "Minimize page" });
  await mediumMinimize.waitFor({ state: "visible" });
  const mediumBreadcrumb = mediumNav.getByRole("navigation", { name: "Breadcrumb" });
  await mediumBreadcrumb.waitFor({ state: "visible" });
  const mediumControls = mediumPage.locator("[data-media-controls]");
  await mediumControls.waitFor({ state: "visible" });
  const mediumControlsBeforeScroll = await mediumControls.boundingBox();
  const mediumBreadcrumbJustification = await mediumBreadcrumb
    .locator("ol")
    .evaluate((list) => getComputedStyle(list).justifyContent);
  if (mediumBreadcrumbJustification !== "center") {
    throw new Error(`Medium breadcrumbs are not centered: ${mediumBreadcrumbJustification}.`);
  }
  await scrollDocument(mediumPage, "Medium blog");
  const mediumStickyNavBox = await mediumNav.boundingBox();
  const mediumControlsAfterScroll = await mediumControls.boundingBox();
  if (
    !mediumStickyNavBox ||
    !mediumControlsBeforeScroll ||
    !mediumControlsAfterScroll ||
    Math.abs(mediumStickyNavBox.y) > 1 ||
    Math.abs(mediumStickyNavBox.height - 64) > 1 ||
    Math.abs(mediumControlsAfterScroll.y + mediumControlsAfterScroll.height - 600) > 1 ||
    Math.abs(mediumControlsBeforeScroll.y - mediumControlsAfterScroll.y) > 1
  ) {
    throw new Error(
      `Medium navigation or bottom controls moved incorrectly: ${JSON.stringify({ mediumStickyNavBox, mediumControlsBeforeScroll, mediumControlsAfterScroll })}`
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
