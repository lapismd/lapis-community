<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor, within } from "storybook/test";

  import {
    registryStoryEntries,
    registryStoryResolvedDetail,
  } from "../registry-browser/story-fixtures.js";
  import RegistryPluginDetail from "./RegistryPluginDetail.svelte";

  const resolved = registryStoryResolvedDetail();
  const iconResolved = {
    ...resolved,
    detail: {
      ...resolved.detail,
      appearance: {
        icon: "sparkles",
        accent: resolved.detail.appearance?.accent ?? "#8b5cf6",
      },
    },
  };
  const { Story } = defineMeta({
    title: "Community/Registry/Plugin Detail",
    component: RegistryPluginDetail,
    tags: ["visual-pending"],
    args: {
      resolved,
      related: registryStoryEntries.slice(1, 4),
      installAction: { state: "available" },
      onInstall: fn(),
      onOpenPlugin: fn(),
      onOpenCategory: fn(),
      onOpenPlatform: fn(),
    },
    parameters: {
      layout: "fullscreen",
      docs: {
        source: {
          language: "svelte",
          code: `<RegistryPluginDetail {resolved} {related} installAction={installation[resolved.entry.id]} onInstall={installPlugin} />`,
        },
      },
    },
  });
</script>

<Story
  name="Available plugin"
  play={async ({ args, canvas, canvasElement }) => {
    const page = within(canvasElement.ownerDocument.body);
    await userEvent.click(canvas.getByRole("button", { name: "More actions" }));
    const menu = page.getByRole("menu");
    const downloadItem = page.getByRole("menuitem", {
      name: "Download .lapis-plugin",
    });
    await expect(menu.scrollWidth).toBeLessThanOrEqual(menu.clientWidth);
    await expect(downloadItem.scrollWidth).toBeLessThanOrEqual(
      downloadItem.clientWidth,
    );
    await expect(
      menu.querySelector('[data-ui-part$="-separator"]:last-child'),
    ).toBeNull();
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );
    const banner = canvas.getByRole("button", {
      name: /Open AI Assistant banner/u,
    });
    await userEvent.click(banner);
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("button", { name: "Dark" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByRole("dialog")).toHaveAttribute(
      "data-media-mode",
      "dark",
    );
    await userEvent.click(
      page.getByRole("button", { name: "Close media viewer" }),
    );
    await waitFor(() => expect(banner).toHaveFocus());

    const overview = canvas.getByRole("button", {
      name: /Open AI Assistant overview image/u,
    });
    await userEvent.click(overview);
    await expect(page.getByRole("dialog")).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(overview).toHaveFocus());
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );

    await userEvent.click(
      canvas.getByRole("button", { name: "Install in Lapis" }),
    );
    await expect(args.onInstall).toHaveBeenCalledOnce();
    await expect(args.onInstall).toHaveBeenCalledWith(
      expect.objectContaining({
        pluginId: "ai",
        version: "1.4.0",
      }),
    );
    await userEvent.click(canvas.getByRole("tab", { name: "Changelog" }));
    await expect(
      canvas.getByRole("heading", { name: "Changelog" }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: /Releases/u }));
    await expect(canvas.getByText("0.9.0")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Desktop" }));
    await expect(args.onOpenPlatform).toHaveBeenCalledWith("desktop");
    await userEvent.click(canvas.getByRole("button", { name: "AI" }));
    await expect(args.onOpenCategory).toHaveBeenCalledWith("ai");
    await expect(
      canvas.getByRole("link", { name: /By Lapis Labs/u }),
    ).toHaveAttribute("href", "https://example.com/authors/ai");
    const healthBars = canvasElement.querySelectorAll(
      '[data-ui-part="registry-plugin-health-bar"]',
    );
    await expect(healthBars).toHaveLength(2);
    for (const bar of healthBars) {
      await expect(bar.children).toHaveLength(4);
    }
  }}
/>

<Story name="Installing" args={{ installAction: { state: "installing" } }} />
<Story
  name="Signed icon fallback"
  args={{ resolved: iconResolved }}
  play={async ({ canvasElement }) => {
    await expect(
      canvasElement.querySelector(
        ".registry-plugin-detail__icon .lucide-sparkles",
      ),
    ).not.toBeNull();
  }}
/>
<Story name="Installed" args={{ installAction: { state: "installed" } }} />
<Story
  name="Disabled"
  args={{
    installAction: {
      state: "disabled",
      reason: "Not compatible with this app version",
    },
  }}
/>
<Story
  name="Rejected"
  args={{
    installAction: {
      state: "rejected",
      reason: "The host rejected the verified bundle",
    },
  }}
/>
