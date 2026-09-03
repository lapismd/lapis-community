import process from "node:process";

import { chromium } from "playwright";

const storyUrl = process.argv[2];
if (!storyUrl) throw new Error("Storybook story URL is required");

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await page.goto(storyUrl, { waitUntil: "networkidle" });
  await page.locator(".registry-plugin-detail__hero h1").waitFor();

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
    const pathname = new URL(source, storyUrl).pathname;
    if (!pathname.startsWith("/registry/assets/")) {
      throw new Error(
        `Media escaped the verified registry projection: ${source}`,
      );
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
    await viewer.getByRole("button", { name: label }).click();
    if ((await viewer.getAttribute("data-media-mode")) !== mode) {
      throw new Error(`${label} did not select the ${mode} media variant`);
    }
    const source = await viewer
      .locator(".registry-media-viewer__slide[aria-selected='true'] img")
      .getAttribute("src");
    if (!new URL(source, storyUrl).pathname.startsWith("/registry/assets/")) {
      throw new Error(
        `${label} viewer mode did not use mirrored registry media`,
      );
    }
  }
  await viewer.getByRole("button", { name: "Close media viewer" }).click();
} finally {
  await browser.close();
}
