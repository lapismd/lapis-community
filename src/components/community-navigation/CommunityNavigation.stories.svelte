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

  const { Story } = defineMeta({
    title: "Community/Navigation",
    component: CommunityNavigation,
    tags: ["visual-pending"],
    parameters: {
      layout: "fullscreen",
      docs: {
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
  play={async ({ canvas, canvasElement }) => {
    const search = canvas.getByRole("searchbox", { name: "Search community" });

    await expect(search).toHaveAttribute("placeholder", "Search everything");
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
    await expect(canvas.queryByRole("button", { name: "general" })).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Channels" }));
    await expect(canvas.getByRole("button", { name: "general" })).toBeVisible();

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

    await userEvent.click(canvas.getByRole("button", { name: "AI support" }));
    await expect(
      canvas.getByRole("button", { name: "AI support" }),
    ).toHaveAttribute("aria-current", "page");

    await userEvent.type(search, "release");
    await expect(
      canvas.getByRole("button", { name: "plugin-releases" }),
    ).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "general" })).toBeNull();
    await userEvent.clear(search);

    await userEvent.click(
      canvas.getByRole("button", { name: "Collapse left sidebar" }),
    );
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
      "expanded",
    );
    await expect(
      canvas.getByRole("searchbox", { name: "Search community" }),
    ).toHaveFocus();
  }}
>
  {#snippet template()}
    <CommunityNavigationShellFixture />
  {/snippet}
</Story>
