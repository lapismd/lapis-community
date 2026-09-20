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
    const at = button.querySelector("[data-ui-part='composer-mention-at']");
    const lock = button.querySelector("[data-ui-part='composer-mention-lock']");
    await expect(at).not.toBeNull();
    await expect(lock).not.toBeNull();
    await expect(
      button.querySelector("[data-ui-component='community-member-avatar']"),
    ).not.toBeNull();
    await expect(
      at &&
        lock &&
        (at.compareDocumentPosition(lock) &
          Node.DOCUMENT_POSITION_FOLLOWING) !==
          0,
    ).toBe(true);
  }}
/>
