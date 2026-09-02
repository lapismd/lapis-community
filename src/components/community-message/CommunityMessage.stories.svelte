<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { fn } from "storybook/test";

  import {
    communityStoryMembers,
    communityStoryMessages,
  } from "../community-workspace/story-fixtures.js";
  import CommunityMessage from "./CommunityMessage.svelte";

  const { Story } = defineMeta({
    title: "Community/Shell/Message",
    component: CommunityMessage,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Message with thread and reactions"
  args={{
    message: communityStoryMessages[1]!,
    author: communityStoryMembers[1]!,
    density: "compact",
    onOpenThread: fn(),
    onToggleReaction: fn(),
    onAddReaction: fn(),
  }}
/>
