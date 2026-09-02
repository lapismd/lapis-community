<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, fn, userEvent } from "storybook/test";

  import {
    communityStoryMembers,
    communityStoryThread,
  } from "../community-workspace/story-fixtures.js";
  import CommunityThreadPanel from "./CommunityThreadPanel.svelte";

  const { Story } = defineMeta({
    title: "Community/Channels/Thread Panel",
    component: CommunityThreadPanel,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Nested replies shown chronologically"
  args={{
    thread: communityStoryThread,
    members: communityStoryMembers,
    onSendReply: fn(),
    onToggleReaction: fn(),
    onAddReaction: fn(),
  }}
  play={async ({ canvas, args }) => {
    const composer = canvas.getByRole("combobox", { name: "Message" });
    await userEvent.type(composer, "An isolated thread reply");
    await userEvent.keyboard("{Enter}");
    await expect(args.onSendReply).toHaveBeenCalledWith(
      "message-release",
      "An isolated thread reply",
    );

    await userEvent.click(
      canvas.getByRole("button", { name: "2 reactions with 👍" }),
    );
    await expect(args.onToggleReaction).toHaveBeenCalledWith("thread-1", "👍");
  }}
>
  {#snippet template(args)}
    <div
      style="width: min(100%, 28rem); height: 38rem; border: 1px solid var(--border);"
    >
      <CommunityThreadPanel {...args} />
    </div>
  {/snippet}
</Story>
