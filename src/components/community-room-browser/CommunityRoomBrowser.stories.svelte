<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";
  import CommunityRoomBrowser from "./CommunityRoomBrowser.svelte";
  const { Story } = defineMeta({
    title: "Community/Rooms/Room browser",
    component: CommunityRoomBrowser,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="All rooms"
  args={{
    open: true,
    canCreate: true,
    rooms: [
      {
        id: "general",
        name: "general",
        kind: "channel",
        isProjectChannel: true,
        membership: "joined",
      },
      {
        id: "help",
        name: "help",
        kind: "forum",
        description: "Questions and answers",
        membership: "not-joined",
      },
      {
        id: "announcements-archive",
        name: "announcements-archive",
        kind: "channel",
        membership: "joined",
        archived: true,
      },
    ],
    onSelect: fn(),
    onJoin: fn(),
    onLeave: fn(),
    onCreate: fn(),
  }}
  play={async ({ canvasElement, args }) => {
    const overlay = within(canvasElement.ownerDocument.body);
    const search = overlay.getByLabelText("Search rooms");
    const searchGroup = search.closest('[data-ui-part="input-group"]');
    await expect(searchGroup).not.toBeNull();
    await expect(
      within(searchGroup as HTMLElement).getByRole("button", {
        name: "Sort rooms by A to Z",
      }),
    ).toBeVisible();
    await expect(
      overlay.getByRole("tab", { name: "All rooms" }),
    ).toHaveAttribute("data-state", "active");
    await expect(overlay.getByRole("tab", { name: "Joined" })).toBeVisible();
    await expect(overlay.getByRole("tab", { name: "Archived" })).toBeVisible();
    const general = overlay.getByRole("button", { name: /^general\b/u });
    await expect(
      general.parentElement!.querySelector(
        '[data-ui-part="project-channel-icon"]',
      ),
    ).toBeVisible();
    await expect(
      overlay
        .getByRole("button", { name: /^help\b/u })
        .parentElement!.querySelector('[data-ui-part="project-channel-icon"]'),
    ).toBeNull();
    const leave = overlay.getByRole("button", { name: "Leave general" });
    await expect(leave).toHaveAttribute("data-variant", "destructive");
    await userEvent.click(leave);
    await expect(args.onLeave).toHaveBeenCalledWith(
      expect.objectContaining({ id: "general" }),
    );
    const create = overlay.getByRole("button", {
      name: "Create a new channel",
    });
    const list = create.nextElementSibling;
    if (!(list instanceof HTMLElement))
      throw new Error("Expected the room list after the create button");
    await expect(
      list.getBoundingClientRect().top - create.getBoundingClientRect().bottom,
    ).toBeGreaterThan(0);
    await userEvent.click(create);
    await expect(args.onCreate).toHaveBeenCalledWith("channel");
    await userEvent.type(search, "help");
    await expect(overlay.queryByText("general")).toBeNull();
    await userEvent.click(overlay.getByRole("button", { name: /^help/u }));
    await expect(args.onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "help" }),
    );
    await userEvent.clear(search);
    await userEvent.click(overlay.getByRole("tab", { name: "Archived" }));
    await expect(overlay.getByText("announcements-archive")).toBeVisible();
  }}
>
  {#snippet template(args)}<CommunityRoomBrowser {...args} />{/snippet}
</Story>
