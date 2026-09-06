<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor, within } from "storybook/test";

  import RegistryBrowser from "./RegistryBrowser.svelte";
  import RegistryBrowserCommunityStoryHarness from "./RegistryBrowserCommunityStoryHarness.svelte";
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
  name="Routed reviews controller"
  play={async ({ canvas }) => {
    const story = await canvas.findByTestId(
      "registry-browser-community-story",
      {},
      { timeout: 10_000 },
    );
    await expect(story).toHaveAttribute("data-route", "reviews");
    await expect(
      await canvas.findByRole(
        "region",
        { name: "AI Assistant community discussion" },
        { timeout: 15_000 },
      ),
    ).toBeVisible();
    await expect(
      await canvas.findByText(/Reply 41:/u, {}, { timeout: 15_000 }),
    ).toBeVisible();
    await expect(
      await canvas.findByRole(
        "heading",
        { name: "New & Unread Topics" },
        { timeout: 15_000 },
      ),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: /Suggested Registry topic 2/u }),
    ).toBeVisible();
    const suggestions = await canvas.findByRole(
      "region",
      { name: "New & Unread topics" },
      { timeout: 15_000 },
    );
    await expect(within(suggestions).getByText("Replies")).toBeVisible();
    await expect(within(suggestions).getByText("Activity")).toBeVisible();
    await expect(
      within(suggestions).queryByRole("button", { name: / menu$/u }),
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByText("Community discussion about AI Assistant."),
    ).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Details" }));
    await waitFor(() => expect(story).toHaveAttribute("data-route", "details"));
    await expect(
      await canvas.findByRole("heading", { name: "AI Assistant", level: 1 }),
    ).toBeVisible();
    await expect(canvas.queryByText(/Reply 41:/u)).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: /Reviews/u }));
    await waitFor(() => expect(story).toHaveAttribute("data-route", "reviews"));
    await expect(canvas.getByText(/Reply 41:/u)).toBeVisible();
    await expect(
      canvas.queryByRole("status", { name: "Loading discussion posts" }),
    ).not.toBeInTheDocument();
  }}
>
  {#snippet template()}
    <RegistryBrowserCommunityStoryHarness />
  {/snippet}
</Story>

<Story
  name="Routed reviews mobile"
  globals={{ viewport: { value: "mobile2", isRotated: false } }}
  play={async ({ canvas }) => {
    await expect(
      await canvas.findByRole(
        "region",
        { name: "AI Assistant community discussion" },
        { timeout: 15_000 },
      ),
    ).toBeVisible();
    await expect(
      await canvas.findByText(/Reply 41:/u, {}, { timeout: 15_000 }),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <RegistryBrowserCommunityStoryHarness />
  {/snippet}
</Story>

<Story
  name="Routed reviews dark"
  globals={{ colorMode: "dark" }}
  play={async ({ canvas }) => {
    await expect(
      await canvas.findByRole(
        "region",
        { name: "AI Assistant community discussion" },
        { timeout: 15_000 },
      ),
    ).toBeVisible();
    await expect(
      await canvas.findByText(/Reply 41:/u, {}, { timeout: 15_000 }),
    ).toBeVisible();
  }}
>
  {#snippet template()}
    <RegistryBrowserCommunityStoryHarness />
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
  name="Cached registry while relay loads"
  play={async ({ canvas, canvasElement }) => {
    await expect(
      await canvas.findByText("Showing a verified cached registry."),
    ).toBeVisible();
    await expect(
      canvas.getByText("Checking the registry relay for updates."),
    ).toBeVisible();
    await userEvent.click(
      canvas.getAllByRole("button", { name: "Open AI Assistant" })[0]!,
    );
    await expect(
      await canvas.findByRole("heading", { name: "AI Assistant", level: 1 }),
    ).toBeVisible();
    const status = canvas
      .getByText("Showing a verified cached registry.")
      .closest('[role="status"]');
    const breadcrumb = canvas.getByRole("navigation", {
      name: "breadcrumb",
    });
    await expect(status).not.toBeNull();
    await expect(
      status!.compareDocumentPosition(breadcrumb) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).not.toBe(0);
    await expect(
      canvasElement.querySelectorAll('[data-ui-part="toolbar"]'),
    ).toHaveLength(1);
  }}
>
  {#snippet template()}
    <RegistryBrowserStoryHarness sourceMode="refreshing-cache" />
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
      canvas.queryByText("Seeded registry discussion"),
    ).not.toBeInTheDocument();
    await expect(
      canvas.getByRole("group", { name: "Plugin reactions and reviews" }),
    ).toBeVisible();
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
    await userEvent.click(canvas.getByRole("button", { name: /Reviews/u }));
    await expect(
      await canvas.findByRole("region", {
        name: "AI Assistant reactions and reviews",
      }),
    ).toBeVisible();
    await expect(
      canvas.queryByText("Community discussion about AI Assistant."),
    ).not.toBeInTheDocument();
    await expect(
      (await canvas.findAllByText("Seeded registry discussion"))[0],
    ).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "AI Assistant" }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("link", { name: "AI Assistant" }));
    await expect(
      await canvas.findByRole("heading", { name: "AI Assistant", level: 1 }),
    ).toBeVisible();
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
      canvas.queryByText("Seeded registry discussion"),
    ).not.toBeInTheDocument();
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
