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
    scopeRoom: { id: "general", name: "lapis-general", kind: "channel" },
    rooms: [{ id: "general", name: "lapis-general", kind: "channel" }],
    messages: [
      {
        id: "message",
        authorId: "steve",
        content: "Welcome channel update",
        timestamp: "now",
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
  }}
  play={async ({ canvasElement, args }) => {
    const overlay = within(canvasElement.ownerDocument.body);
    const dialog = overlay.getByRole("dialog", { name: "Search community" });
    const searchInput = within(dialog).getByLabelText("Search community");
    const searchInputGroup = searchInput.closest(
      '[data-ui-part="input-group"]',
    );
    if (!searchInputGroup) throw new Error("Expected the command input group");
    await expect(getComputedStyle(searchInputGroup).borderTopWidth).toBe("0px");
    await expect(getComputedStyle(searchInputGroup).outlineStyle).toBe("none");
    await expect(
      getComputedStyle(searchInputGroup)
        .getPropertyValue("--tw-ring-color")
        .trim(),
    ).toBe("transparent");
    await expect(
      getComputedStyle(searchInputGroup)
        .getPropertyValue("--tw-ring-shadow")
        .trim(),
    ).toBe("0 0 #0000");
    await expect(
      getComputedStyle(searchInput).getPropertyValue("--tw-ring-color").trim(),
    ).toBe("transparent");
    await expect(getComputedStyle(dialog).boxShadow).not.toBe("none");
    await expect(
      overlay.getByRole("option", { name: /Welcome channel update/u }),
    ).toBeVisible();
    await expect(
      overlay.getByRole("option", { name: /Lapis member/u }),
    ).toBeVisible();
    await expect(
      overlay.queryByRole("option", { name: /^\{/u }),
    ).not.toBeInTheDocument();
    await expect(overlay.getByText("Recent activity")).toBeVisible();
    await expect(
      overlay.getByRole("option", { name: "Browse channels" }),
    ).toBeVisible();
    await expect(
      overlay.getByRole("option", { name: "Create a new channel" }),
    ).toBeVisible();
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
    await expect(
      parseFloat(getComputedStyle(scopedInput).paddingInlineStart),
    ).toBeGreaterThan(scopeButton.getBoundingClientRect().width + 8);
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
    await userEvent.click(
      overlay.getByRole("option", { name: /^lapis-general/u }),
    );
    await expect(args.onSelectRoom).toHaveBeenCalledWith(
      expect.objectContaining({ id: "general" }),
    );
    await userEvent.click(
      overlay.getByRole("option", { name: /Welcome channel update/u }),
    );
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
