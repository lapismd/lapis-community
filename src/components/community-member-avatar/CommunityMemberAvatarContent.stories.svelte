<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";

  import { communityStoryMembers } from "../community-workspace/story-fixtures.js";
  import CommunityMemberAvatar from "./CommunityMemberAvatar.svelte";

  const { Story } = defineMeta({
    title: "Community/Members/Avatar Content",
    component: CommunityMemberAvatar,
    tags: ["visual-pending"],
  });

  const ada = communityStoryMembers[0]!;
</script>

<Story
  name="Image avatar"
  args={{
    member: {
      ...ada,
      avatarUrl: "https://example.test/ada.png",
    },
    size: "large",
  }}
  play={async ({ canvas }) => {
    const avatar = canvas.getByRole("img", { name: "Ada Lovelace avatar" });
    await expect(avatar.querySelector("img")).toHaveAttribute(
      "src",
      "https://example.test/ada.png",
    );
    await expect(
      avatar.querySelector('[data-ui-part="image"]'),
    ).toHaveAttribute("data-content", "image");
  }}
/>

<Story
  name="Emoji avatar"
  args={{
    member: {
      ...ada,
      name: "Nyra",
      initials: "NY",
      avatarUrl: "🧭",
      kind: "agent",
    },
    size: "large",
  }}
  play={async ({ canvas }) => {
    const avatar = canvas.getByRole("img", { name: "Nyra avatar" });
    await expect(avatar).toHaveAttribute("data-shape", "rounded");
    await expect(
      avatar.querySelector('[data-ui-part="emoji"]'),
    ).toHaveTextContent("🧭");
    await expect(avatar.querySelector("img")).toBeNull();
  }}
/>

<Story
  name="Initials fallback"
  args={{
    member: { ...ada, avatarUrl: undefined },
    size: "large",
  }}
  play={async ({ canvas }) => {
    const avatar = canvas.getByRole("img", { name: "Ada Lovelace avatar" });
    await expect(avatar).toHaveAttribute("data-shape", "circle");
    await expect(
      avatar.querySelector('[data-ui-part="image"]'),
    ).toHaveAttribute("data-content", "initials");
    await expect(
      avatar.querySelector('[data-ui-part="image"]'),
    ).toHaveTextContent(ada.initials);
  }}
/>
