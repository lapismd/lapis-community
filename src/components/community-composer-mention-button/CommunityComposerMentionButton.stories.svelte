<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn } from "storybook/test";

  import CommunityComposerMentionButton from "./CommunityComposerMentionButton.svelte";

  const { Story } = defineMeta({
    title: "Community/Channels/Composer Mention Button",
    component: CommunityComposerMentionButton,
    tags: ["visual-pending"],
    parameters: {
      layout: "centered",
    },
    args: {
      onclick: fn(),
    },
  });

  const fizz = {
    id: "a".repeat(64),
    name: "Fizz",
    handle: "fizz",
    initials: "FI",
    kind: "agent" as const,
  };
</script>

<Story name="Plain mention control" />

<Story
  name="Addressed agent lock"
  args={{ member: fizz }}
  play={async ({ canvas }) => {
    const button = canvas.getByRole("button", { name: "Mention someone" });
    await expect(
      button.querySelector("[data-ui-part='composer-mention-lock']"),
    ).not.toBeNull();
    await expect(
      button.querySelector("[data-ui-component='community-member-avatar']"),
    ).not.toBeNull();
  }}
/>
