<script lang="ts">
  import { fn } from "storybook/test";

  import {
    communityStoryMembers,
    communityStoryNavigation,
    communityStoryThread,
  } from "../community-workspace/story-fixtures.js";
  import CommunityThreadPanel from "./CommunityThreadPanel.svelte";

  const rooms = communityStoryNavigation.flatMap((section) => section.rooms);
  const thread = {
    ...communityStoryThread,
    rootMessageId: "story-lc-ui-052-thread",
    messages: communityStoryThread.messages.map((message, index) =>
      index === 0 ? { ...message, id: "story-lc-ui-052-thread" } : message,
    ),
  };

  let remount = $state(0);
</script>

<div>
  <button type="button" onclick={() => (remount += 1)}>Remount</button>
  {#key remount}
    <div
      style="width: min(100%, 28rem); height: 38rem; border: 1px solid var(--border);"
    >
      <CommunityThreadPanel
        {thread}
        members={communityStoryMembers}
        {rooms}
        currentMemberId="story-member"
        onSendReply={fn()}
      />
    </div>
  {/key}
</div>
