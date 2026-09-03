<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";

  import { communityStoryMembers } from "../community-workspace/story-fixtures.js";
  import CommunityMemberAvatar from "./CommunityMemberAvatar.svelte";

  const { Story } = defineMeta({
    title: "Community/Members/Avatar",
    component: CommunityMemberAvatar,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Presence avatar"
  args={{
    member: communityStoryMembers[0]!,
    size: "large",
    showPresence: true,
  }}
  play={async ({ canvas }) => {
    await expect(
      canvas.getByRole("img", { name: /Ada Lovelace, Online/u }),
    ).toBeVisible();
  }}
/>
