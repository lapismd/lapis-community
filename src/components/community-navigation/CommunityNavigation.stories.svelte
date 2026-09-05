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
  name="Collapsed section pickers"
  parameters={{ layout: "fullscreen", communityAppShell: true }}
  play={async ({ canvas }) => {
    const runtime = canvas.getByTestId("community-navigation-runtime");
    await waitFor(() => {
      expect(runtime).toHaveAttribute("data-community-status", "connected");
    });
    if (runtime.dataset.communityBackend === "live") return;

    const sidebar = canvas.getByLabelText("Left sidebar");
    await fireEvent.click(
      canvas.getByRole("button", { name: "Collapse left sidebar" }),
    );
    await waitFor(() => {
      expect(sidebar).toHaveAttribute("data-state", "collapsed");
    });
    await waitFor(() =>
      expect(canvas.queryByRole("button", { name: "general" })).toBeNull(),
    );
    await expect(canvas.queryByRole("button", { name: "support" })).toBeNull();

    const registry = canvas.getByRole("button", { name: "Registry" });
    const starred = canvas.getByRole("button", { name: "Starred" });
    const channels = canvas.getByRole("button", { name: "Channels" });
    const forums = canvas.getByRole("button", { name: "Forums" });
    const directMessages = canvas.getByRole("button", {
      name: "Direct messages",
    });
    await expect(
      registry.compareDocumentPosition(starred) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await expect(
      starred.compareDocumentPosition(channels) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await expect(starred).toHaveAttribute(
      "data-navigation-section-kind",
      "starred",
    );
    await expect(channels).toHaveAttribute(
      "data-navigation-section-kind",
      "channels",
    );
    await expect(forums).toHaveAttribute(
      "data-navigation-section-kind",
      "forums",
    );
    await expect(directMessages).toHaveAttribute(
      "data-navigation-section-kind",
      "direct-messages",
    );
    await expect(directMessages.querySelector(".lucide-mails")).not.toBeNull();

    await userEvent.click(channels);
    await expect(channels).toHaveAttribute("aria-expanded", "true");
    await userEvent.keyboard("{Escape}");
    await expect(channels).toHaveFocus();
    await expect(channels).toHaveAttribute("aria-expanded", "false");
    await expect(
      directMessages.closest("[data-tooltip-trigger]"),
    ).toHaveAttribute("data-tooltip-trigger", "");
  }}
>
  {#snippet template()}
    <CommunityNavigationShellFixture includeStarred />
  {/snippet}
</Story>

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

    const channelsDisclosure = canvas.getByRole("button", {
      name: "Channels",
    });
    await userEvent.click(channelsDisclosure);
    await waitFor(() => {
      expect(channelsDisclosure).toHaveAttribute("aria-expanded", "false");
    });
    await userEvent.click(channelsDisclosure);
    await waitFor(() => {
      expect(channelsDisclosure).toHaveAttribute("aria-expanded", "true");
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

    const supportDestinations = canvas.getAllByRole("button", {
      name: "support",
    });
    const supportDestination = supportDestinations.at(-1);
    if (!supportDestination) throw new Error("Expected a support destination");
    await userEvent.click(supportDestination);
    await expect(supportDestination).toHaveAttribute("aria-current", "page");

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
