<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent } from "storybook/test";

  import RegistryBrowser from "./RegistryBrowser.svelte";
  import RegistryBrowserStoryHarness from "./RegistryBrowserStoryHarness.svelte";

  const { Story } = defineMeta({
    title: "Community/Registry/Browser",
    component: RegistryBrowser,
    tags: ["visual-pending"],
    globals: { viewport: { value: "desktop", isRotated: false } },
    parameters: {
      layout: "fullscreen",
      docs: {
        story: { inline: false, iframeHeight: 760 },
        source: {
          language: "svelte",
          code: `<RegistryBrowser {source} bind:route {installActions} onRouteChange={syncHistory} onInstall={installPlugin} />`,
        },
      },
    },
  });
</script>

<Story
  name="Loading skeleton"
  play={async ({ canvas, canvasElement }) => {
    await expect(
      await canvas.findByRole("status", {
        name: "Loading the plugin registry",
      }),
    ).toBeVisible();
    await expect(
      canvasElement.querySelectorAll('[data-ui-component="skeleton"]').length,
    ).toBeGreaterThan(8);
    await expect(
      canvasElement.querySelector(".lucide-loader-circle"),
    ).toBeNull();
  }}
>
  {#snippet template()}
    <RegistryBrowserStoryHarness sourceMode="loading" />
  {/snippet}
</Story>

<Story
  name="Cached registry notice"
  play={async ({ canvas }) => {
    await expect(await canvas.findByRole("status")).toHaveTextContent(
      "Showing a verified cached registry.",
    );
    await expect(
      canvas.getByText("The registry relay is unavailable."),
    ).toBeVisible();
    const refresh = canvas.getByRole("button", { name: "Refresh registry" });
    await expect(refresh).toBeVisible();
    await expect(refresh).toHaveTextContent("");
  }}
>
  {#snippet template()}
    <RegistryBrowserStoryHarness sourceMode="cached" />
  {/snippet}
</Story>

<Story
  name="Discovery to detail with discussion"
  play={async ({ canvas }) => {
    await expect(
      canvas.queryByRole("navigation", { name: "breadcrumb" }),
    ).not.toBeInTheDocument();
    await expect(
      await canvas.findByRole("heading", { name: "Make Lapis Notes yours." }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getAllByRole("button", { name: "Open AI Assistant" })[0]!,
    );
    await expect(
      await canvas.findByRole("heading", { name: "AI Assistant", level: 1 }),
    ).toBeVisible();
    await expect(
      (await canvas.findAllByText("Seeded registry discussion"))[0],
    ).toBeVisible();
    const relatedHeading = canvas.getByRole("heading", {
      name: "Related plugins",
    });
    const discussion = canvas.getByRole("region", {
      name: "AI Assistant community",
    });
    await expect(
      relatedHeading.compareDocumentPosition(discussion) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    const breadcrumb = canvas.getByRole("navigation", { name: "breadcrumb" });
    await expect(
      breadcrumb.querySelector('[data-ui-part="breadcrumb-separator"]'),
    ).toHaveTextContent("");
    await expect(
      breadcrumb.querySelector('[data-ui-part="breadcrumb-separator"] svg'),
    ).not.toBeNull();
    await expect(
      breadcrumb.querySelector(
        '[data-ui-part="breadcrumb-separator"] svg.lucide-chevron-right',
      ),
    ).not.toBeNull();
    await expect(canvas.getByRole("link", { name: "Registry" })).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Install in Lapis" }),
    );
    await expect(
      canvas.getByRole("button", { name: "Installed" }),
    ).toBeDisabled();
    await userEvent.click(canvas.getByRole("link", { name: "Registry" }));
    await expect(
      await canvas.findByRole("heading", { name: "Make Lapis Notes yours." }),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("navigation", { name: "breadcrumb" }),
    ).not.toBeInTheDocument();
  }}
>
  {#snippet template()}
    <RegistryBrowserStoryHarness />
  {/snippet}
</Story>

<Story
  name="Directory state and detail cache"
  play={async ({ canvas }) => {
    const search = await canvas.findByRole("textbox", {
      name: "Search registry plugins",
    });
    await userEvent.type(search, "AI");
    await userEvent.click(
      canvas.getByRole("button", { name: "Open AI Assistant" }),
    );
    await expect(
      await canvas.findByRole("heading", { name: "AI Assistant", level: 1 }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("link", { name: "Plugins" }));
    await expect(
      await canvas.findByRole("textbox", { name: "Search registry plugins" }),
    ).toHaveValue("AI");
    await userEvent.click(
      canvas.getByRole("button", { name: "Open AI Assistant" }),
    );
    await expect(
      await canvas.findByRole("heading", { name: "AI Assistant", level: 1 }),
    ).toBeVisible();
    await expect(
      (await canvas.findAllByText("Seeded registry discussion"))[0],
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Desktop" }));
    await expect(await canvas.findByText("8 results")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: /Desktop/u, pressed: true }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Open AI Assistant" }),
    );
    await expect(
      await canvas.findByRole("heading", { name: "AI Assistant", level: 1 }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "AI" }));
    await expect(await canvas.findByText("1 result")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: /AI/u, pressed: true }),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <RegistryBrowserStoryHarness initialRoute={{ page: "directory" }} />
  {/snippet}
</Story>

<Story
  name="Cached registry refresh"
  play={async ({ canvas }) => {
    await expect(
      await canvas.findByText("Showing a verified cached registry."),
    ).toBeVisible();
    await expect(
      await canvas.findByRole("heading", { name: "AI Assistant", level: 1 }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Install unavailable" }),
    ).toBeDisabled();
    await userEvent.click(
      canvas.getByRole("button", { name: "Refresh registry" }),
    );
    await expect(
      canvas.queryByText("Showing a verified cached registry."),
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "Install in Lapis" }),
    ).toBeEnabled();
  }}
>
  {#snippet template()}
    <RegistryBrowserStoryHarness
      initialRoute={{ page: "plugin", pluginId: "ai" }}
      sourceMode="cached"
    />
  {/snippet}
</Story>
