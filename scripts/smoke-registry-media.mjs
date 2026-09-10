import process from "node:process";

import { chromium } from "playwright";

const storyUrl = process.argv[2];
if (!storyUrl) throw new Error("Storybook story URL is required");

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const staticCatalogRequests = [];
  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (
      pathname === "/registry/index.json" ||
      pathname === "/registry/runtime.json" ||
      /^\/registry\/plugins\/[^/]+\.json$/u.test(pathname)
    ) {
      staticCatalogRequests.push(request.url());
    }
  });
  await page.goto(storyUrl, { waitUntil: "networkidle" });
  const pluginHero = page.locator(".registry-plugin-detail__hero h1");
  if (!(await pluginHero.isVisible())) {
    const firstPost = page.getByRole("button", {
      name: "Go to the first post",
    });
    if (await firstPost.isVisible()) {
      await firstPost.click();
    }
  }
  try {
    await pluginHero.waitFor();
  } catch (cause) {
    const content = await page.locator("body").innerText();
    throw new Error(
      `Registry detail did not render. Page content:\n${content}`,
      {
        cause,
      },
    );
  }

  const mediaTriggers = page.locator(
    ".registry-plugin-detail__banner, .registry-media-gallery__track button, .registry-plugin-detail__overview-media",
  );
  for (let index = 0; index < (await mediaTriggers.count()); index += 1) {
    const trigger = mediaTriggers.nth(index);
    await trigger.scrollIntoViewIfNeeded();
    await trigger.locator("img").waitFor();
  }

  const media = page.locator(
    ".registry-plugin-detail__icon img, .registry-plugin-detail__banner img, .registry-media-gallery__track img, .registry-plugin-detail__overview-media img",
  );
  const mediaCount = await media.count();
  if (mediaCount < 4) {
    throw new Error(
      `Expected projected plugin media, found ${mediaCount} images`,
    );
  }
  for (let index = 0; index < mediaCount; index += 1) {
    const item = media.nth(index);
    await item.scrollIntoViewIfNeeded();
    await item.evaluate(async (image) => {
      if (image.complete && image.naturalWidth > 0) return;
      await new Promise((resolve, reject) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", reject, { once: true });
      });
    });
    const source = await item.getAttribute("src");
    if (!source?.startsWith("blob:")) {
      throw new Error(`Media did not use a verified Blob URL: ${source}`);
    }
  }

  await page.locator('button[aria-label*=" banner:"]').click();
  const viewer = page.getByRole("dialog");
  await viewer.waitFor();
  for (const [label, mode] of [
    ["Split", "full"],
    ["Light", "light"],
    ["Dark", "dark"],
  ]) {
    await viewer.getByRole("radio", { name: label }).click();
    if ((await viewer.getAttribute("data-media-mode")) !== mode) {
      throw new Error(`${label} did not select the ${mode} media variant`);
    }
    const source = await viewer
      .locator(".registry-media-viewer__slide[aria-selected='true'] img")
      .getAttribute("src");
    if (!source?.startsWith("blob:")) {
      throw new Error(`${label} viewer mode did not use verified Blob media`);
    }
  }
  await viewer.getByRole("button", { name: "Close media viewer" }).click();
  if (staticCatalogRequests.length > 0) {
    throw new Error(
      `Relay-backed story requested static catalog documents: ${staticCatalogRequests.join(", ")}`,
    );
  }
} finally {
  await browser.close();
}
