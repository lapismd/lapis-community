<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent } from "storybook/test";

  import { communityStoryMembers } from "../community-workspace/story-fixtures.js";
  import CommunityMemberProfile from "./CommunityMemberProfile.svelte";

  const { Story } = defineMeta({
    title: "Community/Members/Profile",
    component: CommunityMemberProfile,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Member actions"
  args={{
    member: communityStoryMembers[0]!,
    onMessage: fn(),
    onWave: fn(),
    onFollow: fn(),
  }}
  play={async ({ canvas, args }) => {
    await expect(canvas.queryByText("Offline")).not.toBeInTheDocument();
    await expect(
      canvas.getByRole("img", { name: /Ada Lovelace, Online/u }),
    ).toBeVisible();
    const messageAction = canvas.getByRole("button", { name: "Message" });
    await userEvent.hover(messageAction);
    await expect(messageAction).toHaveClass("community-member-profile__action");
    await userEvent.click(messageAction);
    await expect(args.onMessage).toHaveBeenCalledOnce();
  }}
/>
