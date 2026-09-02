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
        membership: "joined",
      },
      {
        id: "help",
        name: "help",
        kind: "forum",
        description: "Questions and answers",
        membership: "not-joined",
      },
    ],
    onSelect: fn(),
  }}
  play={async ({ canvasElement, args }) => {
    const overlay = within(canvasElement.ownerDocument.body);
    await userEvent.type(overlay.getByLabelText("Search rooms"), "help");
    await expect(overlay.queryByText("general")).toBeNull();
    await userEvent.click(overlay.getByRole("button", { name: /help/i }));
    await expect(args.onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: "help" }),
    );
  }}
>
  {#snippet template(args)}<CommunityRoomBrowser {...args} />{/snippet}
</Story>
