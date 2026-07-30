import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium, type Browser } from "playwright";
import { createServer } from "vite";

const appDir = fileURLToPath(new URL("..", import.meta.url));
const outputPath = resolve(appDir, "public/daren-keck-resume.pdf");
const viteServer = await createServer({
  root: appDir,
  logLevel: "error",
  server: {
    host: "127.0.0.1",
    port: 0,
  },
});
await viteServer.listen();

const address = viteServer.httpServer?.address();
if (!address || typeof address === "string") {
  await viteServer.close();
  throw new Error("Unable to resolve the resume preview server port.");
}

let browser: Browser | undefined;

try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/dev`, { waitUntil: "networkidle" });
  await page.locator(".resume-document").waitFor({ state: "visible" });
  await page.emulateMedia({ media: "print" });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: outputPath,
    format: "Letter",
    preferCSSPageSize: true,
    printBackground: false,
  });
  console.log(`Generated ${outputPath}`);
} catch (error) {
  if (error instanceof Error && error.message.includes("Executable doesn't exist")) {
    throw new Error("Playwright Chromium is not installed. Run `bunx playwright install chromium`.", { cause: error });
  }
  throw error;
} finally {
  await browser?.close();
  await viteServer.close();
}
