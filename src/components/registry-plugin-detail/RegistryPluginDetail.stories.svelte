<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, waitFor, within } from "storybook/test";

  import {
    registryStoryEntries,
    registryStoryResolvedDetail,
  } from "../registry-browser/story-fixtures.js";
  import RegistryPluginDetail from "./RegistryPluginDetail.svelte";
  import RegistryPluginDetailLongDiscussionStoryHarness from "./RegistryPluginDetailLongDiscussionStoryHarness.svelte";

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
  const singleVersionResolved = {
    ...resolved,
    detail: {
      ...resolved.detail,
      versions: {
        [resolved.entry.latestVersion]:
          resolved.detail.versions[resolved.entry.latestVersion]!,
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
      onSelectVersion: fn(),
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
    await expect(page.getByRole("radio", { name: "Dark" })).toHaveAttribute(
      "aria-checked",
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
    await waitFor(() =>
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      ),
    );

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
    const releasesTab = canvas.getByRole("tab", { name: /Releases/u });
    const releasesCount = within(releasesTab).getByText(
      Object.keys(args.resolved.detail.versions).length.toString(),
    );
    await expect(releasesCount).toHaveAttribute("data-ui-component", "badge");
    await userEvent.click(releasesTab);
    const historicalRelease = canvas.getByRole("link", { name: "0.9.0" });
    await expect(historicalRelease).toHaveAttribute(
      "href",
      "#/registry/plugins/ai/versions/0.9.0",
    );
    await userEvent.click(historicalRelease);
    await expect(args.onSelectVersion).toHaveBeenCalledWith("0.9.0");
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
  name="Single version unchanged"
  args={{ resolved: singleVersionResolved }}
  play={async ({ canvas }) => {
    await expect(
      canvas.queryByRole("combobox", { name: "Select plugin version" }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByText("Current version").nextElementSibling,
    ).toHaveTextContent(resolved.entry.latestVersion);
  }}
/>
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
  name="Installation failed"
  args={{
    installAction: {
      state: "rejected",
      reason: "Plugin ai is not compatible: platform-unsupported",
    },
  }}
  play={async ({ canvas }) => {
    const alert = canvas.getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(
      canvas.getByText("Couldn’t install AI Assistant"),
    ).toBeVisible();
    await expect(
      canvas.getByText("Plugin ai is not compatible: platform-unsupported"),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Retry install" }),
    ).toBeVisible();
    await expect(canvas.getAllByRole("alert")).toHaveLength(1);
  }}
/>

<Story
  name="Bounded discussion isolation"
  play={async ({ canvas, canvasElement }) => {
    const slider = await canvas.findByRole(
      "slider",
      { name: "Discussion position" },
      { timeout: 15_000 },
    );
    await expect(slider).toHaveAttribute("aria-valuemax", "260");
    await expect(
      await canvas.findByText(/Reply 259:/u, {}, { timeout: 15_000 }),
    ).toBeVisible();
    const detail = canvasElement.querySelector<HTMLElement>(
      ".registry-plugin-detail",
    );
    await expect(detail).not.toBeNull();
    await waitFor(() =>
      expect(detail).toHaveClass("registry-plugin-detail--discussion-isolated"),
    );
    await waitFor(
      () => expect(slider).toHaveAttribute("aria-disabled", "false"),
      { timeout: 15_000 },
    );

    await userEvent.click(
      canvas.getByRole("button", { name: "Go to the first post" }),
    );
    const openingPost = await canvas.findAllByText(
      "Seeded registry discussion",
      {},
      { timeout: 15_000 },
    );
    await expect(openingPost[0]).toBeVisible();
    await waitFor(() => expect(slider).toHaveAttribute("aria-valuenow", "1"), {
      timeout: 15_000,
    });
    await waitFor(
      () => expect(slider).toHaveAttribute("aria-disabled", "false"),
      { timeout: 15_000 },
    );
    await waitFor(
      () =>
        expect(
          canvas.getByRole("region", {
            name: "Registry Demo community discussion",
          }),
        ).toHaveAttribute("data-page-start", "0"),
      { timeout: 15_000 },
    );
    await waitFor(
      () =>
        expect(detail).not.toHaveClass(
          "registry-plugin-detail--discussion-isolated",
        ),
      { timeout: 15_000 },
    );
    await expect(
      detail.querySelector(".registry-plugin-detail__identity h1"),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <RegistryPluginDetailLongDiscussionStoryHarness />
  {/snippet}
</Story>
