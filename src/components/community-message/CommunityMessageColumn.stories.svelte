<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect } from "storybook/test";

  import {
    communityStoryMembers,
    communityStoryMessages,
  } from "../community-workspace/story-fixtures.js";
  import CommunityMessage from "./CommunityMessage.svelte";

  const { Story } = defineMeta({
    title: "Community/Channels/Message Column",
    component: CommunityMessage,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Message body fills the conversation column"
  args={{
    message: {
      ...communityStoryMessages[1]!,
      content:
        "Sanitized transcript acceptance uses the full conversation column instead of a readable-width document.",
    },
    author: communityStoryMembers[1]!,
    members: communityStoryMembers,
    density: "compact",
  }}
  play={async ({ canvas }) => {
    const message = canvas.getByLabelText("Message from Ben Stone");
    const bubbles = message.querySelector<HTMLElement>(
      '[data-ui-part="bubbles"]',
    );
    const bubble = message.querySelector<HTMLElement>(
      '[data-ui-component="ai-chat-message-bubble"]',
    );
    const sizer = message.querySelector<HTMLElement>(".cm-sizer");
    await expect(bubbles).not.toBeNull();
    await expect(bubble).not.toBeNull();
    await expect(sizer).not.toBeNull();
    await expect(getComputedStyle(bubble!).maxWidth).toBe("100%");
    await expect(getComputedStyle(sizer!).maxWidth).toBe("100%");
    await expect(sizer!.getBoundingClientRect().width).toBeCloseTo(
      bubbles!.getBoundingClientRect().width,
      0,
    );
  }}
>
  {#snippet template(args)}
    <div style="width: min(100%, 54rem);">
      <CommunityMessage {...args} />
    </div>
  {/snippet}
</Story>
