<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";
  import CommunityRoomEditor from "./CommunityRoomEditor.svelte";
  const { Story } = defineMeta({
    title: "Community/Rooms/Room editor",
    component: CommunityRoomEditor,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Edit channel"
  args={{
    open: true,
    roomKind: "channel",
    initial: {
      name: "general",
      description: "Community chat",
      visibility: "public",
      lifecycle: "ongoing",
    },
    onSave: fn(),
  }}
  play={async ({ canvasElement, args }) => {
    const overlay = within(canvasElement.ownerDocument.body);
    const name = overlay.getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "announcements");
    await userEvent.click(overlay.getByRole("button", { name: "Save" }));
    await expect(args.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ name: "announcements" }),
    );
  }}
>
  {#snippet template(args)}
    <CommunityRoomEditor {...args} />
  {/snippet}
</Story>
