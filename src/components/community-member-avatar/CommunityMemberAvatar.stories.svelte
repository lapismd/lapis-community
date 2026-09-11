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

<Story
  name="Unknown presence"
  args={{
    member: communityStoryMembers[0]!,
    size: "large",
    showPresence: true,
    presence: "unknown",
  }}
  play={async ({ canvas }) => {
    const avatar = canvas.getByRole("img", {
      name: "Ada Lovelace, Presence unknown",
    });
    await expect(
      avatar.querySelector('[data-ui-part="presence"]'),
    ).toHaveAttribute("data-presence", "unknown");
  }}
/>

<Story
  name="Large rounded avatar"
  args={{
    member: communityStoryMembers[0]!,
    size: "xlarge",
    shape: "rounded",
    showPresence: true,
  }}
  play={async ({ canvas }) => {
    const avatar = canvas.getByRole("img", { name: "Ada Lovelace, Online" });
    await expect(avatar.getBoundingClientRect().width).toBeGreaterThanOrEqual(
      95,
    );
    await expect(avatar).toHaveAttribute("data-shape", "rounded");
    await expect(
      avatar.querySelector('[data-ui-part="presence"]'),
    ).toBeVisible();
  }}
/>

<Story
  name="Compact avatar"
  args={{
    member: communityStoryMembers[1]!,
    size: "xsmall",
    showPresence: false,
  }}
/>
