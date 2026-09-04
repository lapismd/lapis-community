<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent, within } from "storybook/test";

  import { communityStoryMembers } from "../community-workspace/story-fixtures.js";
  import CommunityMemberHoverCard from "./CommunityMemberHoverCard.svelte";

  const { Story } = defineMeta({
    title: "Community/Members/Hover Card",
    component: CommunityMemberHoverCard,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Contact actions"
  args={{
    member: communityStoryMembers[1]!,
    onOpenProfile: fn(),
    onViewActivity: fn(),
    onMessage: fn(),
    openDelay: 120,
  }}
  play={async ({ canvas, canvasElement, args }) => {
    const page = within(canvasElement.ownerDocument.body);
    const avatar = canvas.getByRole("button", {
      name: "View Ben Stone's profile",
    });
    await userEvent.hover(avatar);
    const preview = await page.findByLabelText("Ben Stone contact preview");
    await expect(preview).toBeVisible();
    await userEvent.click(
      page.getByRole("button", { name: "View activity log for Ben Stone" }),
    );
    await expect(args.onViewActivity).toHaveBeenCalledWith(
      communityStoryMembers[1],
    );
    await userEvent.click(
      page.getByRole("button", { name: "Message Ben Stone" }),
    );
    await expect(args.onMessage).toHaveBeenCalledWith(communityStoryMembers[1]);
  }}
>
  {#snippet template(args)}
    <div style="min-height: 18rem; padding: 4rem;">
      <CommunityMemberHoverCard {...args} />
    </div>
  {/snippet}
</Story>

<Story
  name="Mention trigger"
  args={{
    member: communityStoryMembers[1]!,
    trigger: "mention",
    triggerLabel: "@Ben Stone",
    onOpenProfile: fn(),
    openDelay: 120,
  }}
>
  {#snippet template(args)}
    <p style="min-height: 18rem; padding: 4rem;">
      Ask <CommunityMemberHoverCard {...args} /> to review this message.
    </p>
  {/snippet}
</Story>
