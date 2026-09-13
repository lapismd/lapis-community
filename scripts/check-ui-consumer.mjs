import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { build, preview } from "vite";
import tailwindcss from "@tailwindcss/vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { chromium } from "playwright";
import { tursoBundleBuildPlugin } from "./vite-turso-bundle.ts";

const root = process.cwd();
const installedCore = fs.realpathSync(
  path.join(root, "node_modules/@lapismd/design-core"),
);
assert(
  installedCore.includes(`${path.sep}node_modules${path.sep}`),
  "Consumer must resolve the packaged Design Core artifact, not sibling source",
);
const outDir = path.join(root, ".local/ui-consumer-dist");
const cacheDir = fs.mkdtempSync(
  path.join(root, "node_modules/.cache/ui-consumer-"),
);
const evidence = path.join(root, ".local/ui-evidence");
fs.mkdirSync(evidence, { recursive: true });
const config = {
  configFile: false,
  root: path.join(root, "dev/ui-consumer"),
  cacheDir,
  plugins: [
    tailwindcss(),
    svelte({ configFile: false }),
    tursoBundleBuildPlugin(),
  ],
  worker: { format: "es", plugins: () => [tursoBundleBuildPlugin()] },
  resolve: {
    dedupe: ["svelte"],
    alias: {
      "@lapismd/lapis-community/components": path.join(
        root,
        "src/components/index.ts",
      ),
    },
  },
  build: { outDir, emptyOutDir: true, target: "esnext" },
  logLevel: "warn",
};
try {
  await build(config);
} catch (error) {
  console.error(String(error.message).slice(0, 1200));
  fs.rmSync(cacheDir, { recursive: true, force: true });
  process.exit(1);
}
const server = await preview({
  ...config,
  preview: { host: "127.0.0.1", port: 0, open: false },
});
const address = server.httpServer.address();
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ headless: true });
let activePage;
let activeScenario = "startup";
async function until(test) {
  for (let i = 0; i < 50; i++) {
    try {
      return await test();
    } catch (error) {
      if (i === 49) throw error;
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}
try {
  for (const [width, height] of [
    [1280, 700],
    [390, 640],
    [1280, 400],
  ])
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport: { width, height },
        colorScheme: theme,
      });
      await context.addInitScript((theme) => {
        document.addEventListener("DOMContentLoaded", () =>
          document.documentElement.classList.toggle("dark", theme === "dark"),
        );
      }, theme);
      const page = await context.newPage();
      activePage = page;
      activeScenario = `${width}-${height}-${theme}: dialog`;
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(origin);
      await page.evaluate(
        (theme) =>
          document.documentElement.classList.toggle("dark", theme === "dark"),
        theme,
      );
      const trigger = page.getByRole("button", { name: "Edit record" });
      await trigger.click();
      const dialog = page.getByRole("dialog", { name: "Edit record" });
      const close = dialog.getByRole("button", { name: "Close", exact: true });
      await dialog.getByRole("textbox").first().focus();
      await page.mouse.move(0, 0);
      const before = await close.evaluate(
        (el) => getComputedStyle(el).backgroundColor,
      );
      await close.hover();
      await until(async () =>
        assert.notEqual(
          await close.evaluate((el) => getComputedStyle(el).backgroundColor),
          before,
        ),
      );
      assert.equal(
        await close.evaluate((el) => getComputedStyle(el).width),
        "32px",
      );
      assert.equal(
        await close.locator("svg").evaluate((el) => getComputedStyle(el).width),
        "16px",
      );
      assert.equal(
        await dialog.evaluate((el) => getComputedStyle(el).fontSize),
        "14px",
      );
      assert.equal(
        await dialog
          .getByRole("heading")
          .evaluate((el) => getComputedStyle(el).fontSize),
        "18px",
      );
      const viewport = dialog.locator('[data-ui-part="scroll-area-viewport"]'),
        footer = dialog.locator('[data-ui-part="dialog-frame-footer"]');
      const footerY = (await footer.boundingBox()).y;
      assert(
        await viewport.evaluate((el) => el.scrollHeight > el.clientHeight),
      );
      await viewport.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      assert(await viewport.evaluate((el) => el.scrollTop > 0));
      assert(Math.abs((await footer.boundingBox()).y - footerY) < 1);
      const bounds = await dialog.boundingBox();
      assert(bounds.x >= 15 && bounds.x + bounds.width <= width - 15);
      assert(bounds.y >= 15 && bounds.y + bounds.height <= height - 15);
      await page.screenshot({
        path: path.join(evidence, `dialog-${width}-${height}-${theme}.png`),
      });
      await page.keyboard.press("Escape");
      await until(async () =>
        assert(await trigger.evaluate((el) => el === document.activeElement)),
      );
      await page.goto(`${origin}/?pattern=confirmation`);
      activeScenario = `${width}-${height}-${theme}: confirmation`;
      await page.getByRole("button", { name: "Remove record" }).click();
      let confirm = page.getByRole("alertdialog");
      assert((await confirm.boundingBox()).width <= Math.min(448, width - 32));
      await confirm.getByRole("button", { name: "Cancel" }).click();
      await until(async () =>
        assert.equal(
          await page.getByRole("status").textContent(),
          "Record retained",
        ),
      );
      await page.getByRole("button", { name: "Remove record" }).click();
      await page.getByRole("button", { name: "Remove", exact: true }).click();
      await page.getByRole("alert").waitFor();
      await page.getByRole("button", { name: "Remove", exact: true }).click();
      await until(async () =>
        assert.equal(
          await page.getByRole("status").textContent(),
          "Record removed",
        ),
      );
      await page.goto(`${origin}/?pattern=identity`);
      for (const label of [
        "Inline identity",
        "Markdown identity",
        "Composer identity",
      ]) {
        activeScenario = `${width}-${height}-${theme}: ${label}`;
        const mention = page
          .getByRole("region", { name: label })
          .getByRole("button", { name: "Avery", exact: true });
        const avatar = mention.locator(
          '[data-ui-component="community-member-avatar"]',
        );
        const initials = avatar.locator('[data-ui-part="image"] > span');
        const a = await avatar.boundingBox(),
          i = await initials.boundingBox();
        assert(
          await mention.evaluate(
            (el) =>
              el.getBoundingClientRect().height <=
              parseFloat(getComputedStyle(el).lineHeight) + 0.5,
          ),
        );
        assert(i.width < a.width && i.height < a.height);
        assert(Math.abs(i.x + i.width / 2 - a.x - a.width / 2) < 1);
        await mention.hover();
        const contact = page.getByRole("group", {
          name: "Avery contact preview",
        });
        await contact.waitFor();
        await until(async () =>
          assert.equal(
            await contact.getAttribute("id"),
            await mention.getAttribute("aria-controls"),
          ),
        );
        await contact.getByRole("button", { name: "Message Avery" }).click();
        assert.equal(
          await page.getByRole("status").textContent(),
          "Message Avery",
        );
        await contact.getByRole("button", { name: "Wave to Avery" }).click();
        assert.equal(
          await page.getByRole("status").textContent(),
          "Waved to Avery",
        );
        await page.mouse.move(0, 0);
        await page.keyboard.press("Escape");
        await contact.waitFor({ state: "hidden" });
      }
      await page.screenshot({
        path: path.join(evidence, `identity-${width}-${height}-${theme}.png`),
      });
      await page.goto(`${origin}/?pattern=agents`);
      activeScenario = `${width}-${height}-${theme}: agents`;
      await page
        .getByRole("button", { name: "Add agent", exact: true })
        .click();
      const agentDialog = page.getByRole("dialog", {
        name: "Create managed agent",
      });
      const agentFooter = agentDialog.locator(
        '[data-ui-part="dialog-frame-footer"]',
      );
      const agentViewport = agentDialog.locator(
        '.ui-dialog-frame-scroll > [data-ui-part="scroll-area-viewport"]',
      );
      const ay = (await agentFooter.boundingBox()).y;
      if (height <= 640) {
        assert(
          await agentViewport.evaluate(
            (el) => el.scrollHeight > el.clientHeight,
          ),
        );
        await agentViewport.evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });
        assert(await agentViewport.evaluate((el) => el.scrollTop > 0));
        assert(Math.abs((await agentFooter.boundingBox()).y - ay) < 1);
      }
      await agentViewport.evaluate((el) => {
        el.scrollTop = 0;
      });
      const choose = agentDialog.getByRole("button", {
        name: "Choose agent image",
      });
      await choose.click();
      const picker = page.getByLabel("Avatar image picker", { exact: true });
      await picker.waitFor();
      const pb = await picker.boundingBox();
      assert(pb.x >= 0 && pb.x + pb.width <= width);
      assert(pb.y >= 0 && pb.y + pb.height <= height);
      await picker.getByRole("tab", { name: "Emoji", exact: true }).click();
      await picker.getByRole("button", { name: "Browse all emoji" }).click();
      await page
        .locator("em-emoji-picker")
        .getByRole("button", { name: "🤣", exact: true })
        .click();
      await until(async () =>
        assert(
          decodeURIComponent(
            await agentDialog
              .getByAltText("Selected avatar")
              .getAttribute("src"),
          ).includes("🤣"),
        ),
      );
      await page.keyboard.press("Escape");
      await until(async () =>
        assert(await choose.evaluate((el) => el === document.activeElement)),
      );
      await page.screenshot({
        path: path.join(evidence, `agents-${width}-${height}-${theme}.png`),
      });
      await page.keyboard.press("Escape");
      assert.deepEqual(errors, []);
      await context.close();
    }
  console.log(
    `Packaged consumer passed: six viewport/theme dialog, confirmation, identity, and avatar contracts. Design Core: ${installedCore}`,
  );
} catch (error) {
  console.error(`Packaged consumer failed at ${activeScenario}`);
  if (activePage && !activePage.isClosed()) {
    await activePage.screenshot({
      path: path.join(evidence, "consumer-failure.png"),
    });
    fs.writeFileSync(
      path.join(evidence, "consumer-failure.html"),
      await activePage.content(),
    );
  }
  throw error;
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
  fs.rmSync(cacheDir, { recursive: true, force: true });
}
