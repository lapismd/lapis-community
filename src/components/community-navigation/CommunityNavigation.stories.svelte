<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import {
    expect,
    fireEvent,
    userEvent,
    waitFor,
    within,
  } from "storybook/test";
  import CommunityNavigation from "./CommunityNavigation.svelte";
  import CommunityNavigationShellFixture from "./CommunityNavigationShellFixture.svelte";

  const consumerSource = `<script lang="ts">
  import { CommunityNavigation, type CommunityNavigationModel } from "@lapismd/lapis-community/components";

  let { model, activeItemId }: { model: CommunityNavigationModel; activeItemId: string } = $props();
<\/script>

<CommunityNavigation
  {model}
  {activeItemId}
  onSelect={(item) => console.log(item.id)}
  onSearch={(query) => console.log(query)}
/>`;

  const { Story } = defineMeta({
    title: "Community/Navigation/Sidebar",
    component: CommunityNavigation,
    tags: ["visual-pending"],
    parameters: {
      layout: "fullscreen",
      docs: {
        source: { language: "svelte", code: consumerSource },
        description: {
          component:
            "Buzz-inspired navigation for the Inbox, registry, NIP-29 channels, forums, and direct messages currently supported by Lapis Community. Search, collapsible groups, and action menus use Design Core primitives.",
        },
      },
    },
  });
</script>

<Story
  name="Supported community destinations"
  parameters={{ layout: "fullscreen", communityAppShell: true }}
  play={async ({ canvas, canvasElement }) => {
    const search = canvas.getByRole("button", { name: "Search community" });
    const runtime = canvas.getByTestId("community-navigation-runtime");

    await waitFor(() => {
      expect(runtime).toHaveAttribute("data-community-status", "connected");
    });
    if (runtime.dataset.communityBackend === "live") return;

    await expect(search).toHaveTextContent("Search everything");
    await expect(search).toHaveTextContent("⌘K");
    await expect(parseFloat(getComputedStyle(search).marginInlineStart)).toBe(
      12,
    );
    await userEvent.click(search);
    await expect(canvas.getByRole("button", { name: "Inbox" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(
      canvas.getByRole("button", { name: "Registry" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("heading", { name: "Channels" }),
    ).toBeVisible();
    await expect(canvas.getByRole("heading", { name: "Forums" })).toBeVisible();
    await expect(
      canvas.getByRole("heading", { name: "Direct messages" }),
    ).toBeVisible();
    const directMessage = canvas.getByRole("button", { name: "Member" });
    await expect(
      directMessage.querySelector(
        '[data-ui-component="community-member-avatar"]',
      ),
    ).not.toBeNull();
    await expect(
      directMessage.querySelector('[data-ui-part="presence"]'),
    ).toHaveAttribute("data-presence", "offline");
    await expect(
      canvas.getByRole("button", { name: "Open Channels menu" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Create channel" }),
    ).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Agents" })).toBeNull();
    await expect(
      canvas.queryByRole("button", { name: "Workflows" }),
    ).toBeNull();

    await userEvent.click(canvas.getByRole("button", { name: "Channels" }));
    await waitFor(() => {
      expect(canvas.queryByRole("button", { name: "general" })).toBeNull();
    });
    await userEvent.click(canvas.getByRole("button", { name: "Channels" }));
    await waitFor(() => {
      expect(canvas.getByRole("button", { name: "general" })).toBeVisible();
    });

    await userEvent.click(
      canvas.getByRole("button", { name: "Open Channels menu" }),
    );
    const overlay = within(canvasElement.ownerDocument.body);
    const menu = overlay.getByRole("menu");
    const browseChannels = overlay.getByRole("menuitem", {
      name: "Browse channels",
    });
    const sortChannels = overlay.getByRole("menuitem", {
      name: "Sort",
    });

    await expect(browseChannels).toBeVisible();
    await expect(sortChannels).toBeVisible();
    await expect(
      menu.querySelector('[data-ui-part$="-separator"]:last-child'),
    ).toBeNull();
    await expect(browseChannels).toHaveAttribute(
      "data-ui-part",
      "dropdown-menu-item",
    );
    await expect(sortChannels).toHaveAttribute(
      "data-ui-part",
      "dropdown-menu-sub-trigger",
    );
    await waitFor(() => {
      expect(parseFloat(getComputedStyle(menu).minWidth)).toBeGreaterThan(0);
      expect(
        parseFloat(getComputedStyle(menu).paddingInlineStart),
      ).toBeGreaterThan(0);
      expect(
        parseFloat(getComputedStyle(browseChannels).paddingInlineStart),
      ).toBeGreaterThan(0);
    });
    await userEvent.click(browseChannels);
    await waitFor(() => {
      expect(canvasElement.ownerDocument.body.style.pointerEvents).not.toBe(
        "none",
      );
    });

    await userEvent.click(canvas.getByRole("button", { name: "support" }));
    await expect(
      canvas.getByRole("button", { name: "support" }),
    ).toHaveAttribute("aria-current", "page");

    const sidebarToggle = canvas.getByRole("button", {
      name: "Collapse left sidebar",
    });
    await expect(
      sidebarToggle.querySelector('[data-ui-part="sidebar-toggle-indicator"]'),
    ).toHaveAttribute("width", "6");
    await userEvent.click(sidebarToggle);
    await expect(
      canvas
        .getByRole("button", { name: "Expand left sidebar" })
        .querySelector('[data-ui-part="sidebar-toggle-indicator"]'),
    ).toHaveAttribute("width", "2");
    await expect(canvas.getByLabelText("Left sidebar")).toHaveAttribute(
      "data-state",
      "collapsed",
    );
    await expect(
      canvas.queryByRole("searchbox", { name: "Search community" }),
    ).toBeNull();
    await fireEvent.keyDown(canvasElement.ownerDocument.body, {
      key: "k",
      metaKey: true,
    });
    await expect(canvas.getByLabelText("Left sidebar")).toHaveAttribute(
      "data-state",
      "collapsed",
    );
  }}
>
  {#snippet template()}
    <CommunityNavigationShellFixture />
  {/snippet}
</Story>
