<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { fn } from "storybook/test";

  import {
    communityStoryMembers,
    communityStoryMessages,
    communityStoryNavigation,
  } from "../community-workspace/story-fixtures.js";
  import CommunityConversation from "./CommunityConversation.svelte";

  const generalRoom = communityStoryNavigation[0]!.rooms[1]!;

  const { Story } = defineMeta({
    title: "Community/Shell/Conversation",
    component: CommunityConversation,
    tags: ["visual-pending"],
  });
</script>

<Story
  name="Compact channel feed"
  args={{
    room: generalRoom,
    messages: communityStoryMessages,
    members: communityStoryMembers,
    onSend: fn(),
    onOpenThread: fn(),
    onToggleReaction: fn(),
    onAddReaction: fn(),
  }}
>
  {#snippet template(args)}
    <div
      style="width: min(100%, 54rem); height: 38rem; border: 1px solid var(--border);"
    >
      <CommunityConversation {...args} />
    </div>
  {/snippet}
</Story>
