<script lang="ts">
  import { fn } from "storybook/test";

  import { provideComposerDraftScope } from "../community-chat-composer/composer-draft-scope.js";
  import CommunityTopicComposer from "./CommunityTopicComposer.svelte";

  let { roomId = "support" }: { roomId?: string } = $props();

  let remount = $state(0);

  provideComposerDraftScope(() => ({
    communityId: "story:lc-ui-052",
    roomId,
    viewer: "story-member",
  }));
</script>

<div>
  <button type="button" onclick={() => (remount += 1)}>Remount</button>
  {#key remount}
    <CommunityTopicComposer
      forumName="support"
      currentMemberId="story-member"
      onPublish={fn(async () => {})}
    />
  {/key}
</div>
