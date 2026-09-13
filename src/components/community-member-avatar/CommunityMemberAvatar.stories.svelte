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
    await expect(avatar).toHaveAccessibleName("Ada Lovelace, Presence unknown");
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

<Story
  name="Deterministic fallback palette"
  play={async ({ canvas }) => {
    const avatars = canvas.getAllByRole("img");
    const tones = avatars.map((avatar) =>
      avatar
        .querySelector('[data-ui-part="image"]')
        ?.getAttribute("data-fallback-tone"),
    );

    await expect(new Set(tones).size).toBeGreaterThan(1);
    await expect(tones).toEqual(["blue", "rose", "violet", "blue", "blue"]);
  }}
>
  {#snippet template()}
    <div class="community-member-avatar-story__palette">
      {#each communityStoryMembers as member (member.id)}
        <CommunityMemberAvatar {member} size="large" />
      {/each}
    </div>
  {/snippet}
</Story>

<style>
  .community-member-avatar-story__palette {
    display: flex;
    gap: 0.75rem;
    padding: 1rem;
  }
</style>
