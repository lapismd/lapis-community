<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";
  import CommunityMemberCommand from "./CommunityMemberCommand.svelte";
  const { Story } = defineMeta({
    title: "Community/Members/Member command",
    component: CommunityMemberCommand,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Manage members"
  args={{
    open: true,
    mode: "manage",
    members: [
      {
        id: "steve",
        name: "Steve",
        handle: "steve",
        initials: "SJ",
        presence: "online",
      },
    ],
    onSelect: fn(),
    onRemove: fn(),
  }}
  play={async ({ canvasElement, args }) => {
    const overlay = within(canvasElement.ownerDocument.body);
    await userEvent.click(overlay.getByRole("option", { name: /Steve/ }));
    await expect(args.onRemove).toHaveBeenCalledWith(
      expect.objectContaining({ id: "steve" }),
    );
  }}
>
  {#snippet template(args)}
    <CommunityMemberCommand {...args} />
  {/snippet}
</Story>
