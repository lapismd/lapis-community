<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { fn } from "storybook/test";

  import {
    communityStoryMembers,
    communityStoryThread,
  } from "../community-workspace/story-fixtures.js";
  import CommunityThreadPanel from "./CommunityThreadPanel.svelte";

  const { Story } = defineMeta({
    title: "Community/Shell/Thread Panel",
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
>
  {#snippet template(args)}
    <div
      style="width: min(100%, 28rem); height: 38rem; border: 1px solid var(--border);"
    >
      <CommunityThreadPanel {...args} />
    </div>
  {/snippet}
</Story>
