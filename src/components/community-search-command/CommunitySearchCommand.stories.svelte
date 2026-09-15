<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";
  import CommunitySearchCommand from "./CommunitySearchCommand.svelte";
  import CommunitySearchCommandStoryHarness from "./CommunitySearchCommandStoryHarness.svelte";
  const { Story } = defineMeta({
    title: "Community/Search/Search command",
    component: CommunitySearchCommand,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Results"
  args={{
    open: true,
    query: "",
    scope: {
      id: "room:general",
      kind: "channel",
      label: "#lapis-general",
      roomIds: ["general"],
    },
    rooms: [
      {
        id: "general",
        name: "lapis-general",
        kind: "channel",
        isProjectChannel: true,
        lastActivityAt: "2026-09-11T12:00:00.000Z",
      },
      {
        id: "announcements",
        name: "announcements",
        kind: "channel",
        lastActivityAt: "2026-09-11T11:00:00.000Z",
      },
      {
        id: "support",
        name: "support",
        kind: "forum",
        lastActivityAt: "2026-09-11T10:00:00.000Z",
      },
      {
        id: "design",
        name: "design",
        kind: "channel",
        lastActivityAt: "2026-09-11T09:00:00.000Z",
      },
      {
        id: "archive",
        name: "older-room-not-shown",
        kind: "channel",
        lastActivityAt: "2026-09-01T09:00:00.000Z",
      },
    ],
    messages: [
      {
        id: "message",
        authorId: "steve",
        content: "Welcome channel update",
        timestamp: "now",
        createdAt: "2026-09-11T11:55:00.000Z",
        roomId: "general",
      },
      {
        id: "other-message",
        authorId: "noor",
        content: "Another channel update",
        timestamp: "earlier",
        roomId: "other",
      },
    ],
    members: [
      {
        id: "steve",
        name: "Lapis member",
        handle: "steve",
        initials: "LM",
      },
    ],
    onSelectRoom: fn(),
    onSelectMessage: fn(),
    onSelectMember: fn(),
    onQueryChange: fn(),
    onBrowseChannels: fn(),
    canCreateChannel: true,
    onCreateChannel: fn(),
    onCreateAgent: fn(),
  }}
  play={async ({ canvasElement, args }) => {
    const overlay = within(canvasElement.ownerDocument.body);
    const dialog = overlay.getByRole("dialog", { name: "Search community" });
    await expect(
      dialog.querySelector(
        '[data-ui-component="command-view"][data-ui-part="root"]',
      ),
    ).not.toBeNull();
    await expect(
      within(dialog).queryByText(
        "Search rooms, loaded messages, and known members. The relay is queried when it supports NIP-50.",
      ),
    ).not.toBeInTheDocument();
    const searchInput = within(dialog).getByLabelText("Search community");
    const searchInputGroup = searchInput.closest(
      '[data-ui-part="input-group"]',
    );
    if (!searchInputGroup) throw new Error("Expected the command input group");
    await expect(getComputedStyle(searchInputGroup).borderTopWidth).toBe("0px");
    await expect(getComputedStyle(searchInputGroup).outlineStyle).toBe("none");
    await expect(getComputedStyle(dialog).boxShadow).not.toBe("none");
    await expect(
      overlay.queryByRole("option", { name: /Welcome channel update/u }),
    ).not.toBeInTheDocument();
    await expect(
      overlay.queryByRole("option", { name: /Lapis member/u }),
    ).not.toBeInTheDocument();
    await expect(
      overlay.queryByRole("option", { name: /older-room-not-shown/u }),
    ).not.toBeInTheDocument();
    await expect(
      overlay.queryByRole("option", { name: /^\{/u }),
    ).not.toBeInTheDocument();
    await expect(overlay.getByText("Recent activity")).toBeVisible();
    const recentGeneral = overlay.getByRole("option", {
      name: /^lapis-general/u,
    });
    await expect(
      recentGeneral.querySelector('[data-ui-part="project-channel-icon"]'),
    ).toBeVisible();
    await expect(
      overlay
        .getByRole("option", { name: /^announcements/u })
        .querySelector('[data-ui-part="project-channel-icon"]'),
    ).toBeNull();
    const recentActivityTime = recentGeneral.querySelector<HTMLElement>(
      '[data-ui-part="trailing"]',
    );
    await expect(recentActivityTime).not.toBeNull();
    await expect(
      recentActivityTime!.getBoundingClientRect().left,
    ).toBeGreaterThan(recentGeneral.getBoundingClientRect().left);
    await expect(
      overlay.getByRole("option", { name: "Browse channels" }),
    ).toBeVisible();
    await expect(
      overlay.getByRole("option", { name: "Create a new channel" }),
    ).toBeVisible();
    await expect(
      overlay.getByRole("option", { name: "Create a new agent" }),
    ).toBeVisible();
    const scopeAction = overlay.getByRole("option", {
      name: /Search in #lapis-general/u,
    });
    const scopeDescription = scopeAction.querySelector<HTMLElement>(
      '[data-ui-part="item-description"]',
    );
    await expect(scopeDescription).not.toBeNull();
    await expect(
      scopeDescription!.getBoundingClientRect().right,
    ).toBeGreaterThan(scopeAction.getBoundingClientRect().left);
    await userEvent.click(
      overlay.getByRole("option", { name: /Search in #lapis-general/u }),
    );
    await expect(
      overlay.getByRole("dialog", { name: "Search in #lapis-general" }),
    ).toBeVisible();
    const scopeButton = overlay.getByRole("button", {
      name: "Remove #lapis-general search scope",
    });
    await expect(scopeButton).toBeVisible();
    const scopedInput = within(
      overlay.getByRole("dialog", { name: "Search in #lapis-general" }),
    ).getByLabelText("Search in #lapis-general");
    await expect(scopeButton.getBoundingClientRect().right).toBeLessThanOrEqual(
      scopedInput.getBoundingClientRect().left,
    );
    await userEvent.type(scopedInput, "channel");
    await expect(
      overlay.getByRole("option", { name: /Welcome channel update/u }),
    ).toBeVisible();
    await expect(
      overlay.queryByRole("option", { name: /Another channel update/u }),
    ).not.toBeInTheDocument();
    await expect(
      overlay.queryByRole("option", { name: /^lapis-general/u }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      overlay.getByRole("button", {
        name: "Remove #lapis-general search scope",
      }),
    );
    await expect(
      overlay.getByRole("option", { name: /Another channel update/u }),
    ).toBeVisible();
    await userEvent.clear(
      within(
        overlay.getByRole("dialog", { name: "Search community" }),
      ).getByLabelText("Search community"),
    );
    await userEvent.type(
      within(
        overlay.getByRole("dialog", { name: "Search community" }),
      ).getByLabelText("Search community"),
      "lapis",
    );
    await userEvent.click(
      overlay.getByRole("option", { name: /^lapis-general/u }),
    );
    await expect(args.onSelectRoom).toHaveBeenCalledWith(
      expect.objectContaining({ id: "general" }),
    );
    const globalInput = within(
      overlay.getByRole("dialog", { name: "Search community" }),
    ).getByLabelText("Search community");
    await userEvent.clear(globalInput);
    await userEvent.type(globalInput, "Welcome");
    const messageResult = overlay.getByRole("option", {
      name: /Lapis member.*Welcome channel update/u,
    });
    await expect(
      messageResult.querySelector(
        '[data-ui-component="community-member-avatar"]',
      ),
    ).not.toBeNull();
    await expect(within(messageResult).getByText("Lapis member")).toBeVisible();
    await expect(within(messageResult).getByText("Welcome").tagName).toBe(
      "MARK",
    );
    const messageTime = messageResult.querySelector<HTMLElement>(
      '[data-ui-part="trailing"]',
    );
    await expect(messageTime).not.toBeNull();
    await expect(messageTime!.textContent?.trim()).not.toBe("");
    await expect(messageTime!.getBoundingClientRect().right).toBeGreaterThan(
      within(messageResult).getByText("Lapis member").getBoundingClientRect()
        .right,
    );
    await userEvent.click(messageResult);
    await expect(args.onSelectMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: "message", roomId: "general" }),
    );
    const closeButton = overlay.getByRole("button", { name: "Close search" });
    await expect(closeButton).toHaveAttribute("data-variant", "outline");
    await userEvent.hover(closeButton);
    await expect(closeButton).toBeVisible();
  }}
>
  {#snippet template(args)}
    <CommunitySearchCommandStoryHarness {args} />
  {/snippet}</Story
>

<Story
  name="Project scope"
  args={{
    open: true,
    query: "",
    scope: {
      id: "project:lapis-community",
      kind: "project",
      label: "Lapis Community",
      roomIds: ["general", "support"],
    },
    rooms: [],
    messages: [],
    members: [],
    onSelectRoom: fn(),
    onSelectMessage: fn(),
    onSelectMember: fn(),
    onQueryChange: fn(),
    onBrowseChannels: fn(),
    onCreateChannel: fn(),
  }}
  play={async ({ canvasElement }) => {
    const overlay = within(canvasElement.ownerDocument.body);
    await expect(
      overlay.getByRole("option", { name: /Search in Lapis Community/u }),
    ).toBeVisible();
    await userEvent.click(
      overlay.getByRole("option", { name: /Search in Lapis Community/u }),
    );
    await expect(
      overlay.getByRole("button", {
        name: "Remove Lapis Community search scope",
      }),
    ).toBeVisible();
    await expect(
      overlay.getByRole("dialog", { name: "Search in Lapis Community" }),
    ).toBeVisible();
  }}
>
  {#snippet template(args)}
    <CommunitySearchCommandStoryHarness {args} />
  {/snippet}</Story
>
