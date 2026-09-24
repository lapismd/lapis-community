<script lang="ts">
  import { Layout, LayoutScrollButton } from "@lapismd/design-core/ai/chat";
  import type { CommunityAgentActivityFeedProps } from "./activity-feed-props.js";
  import CommunityAgentTranscript from "./CommunityAgentTranscript.svelte";
  import "./activity-feed.css";

  let {
    activity,
    execution,
    agent,
    context,
    conversationKey,
    members = [],
    onOpenRequest,
    header,
    working = false,
    messageContent,
    onLoadLatest,
    onLoadOlder,
    hasOlder = false,
    loading = false,
  }: CommunityAgentActivityFeedProps = $props();
</script>

<div class="agent-activity-feed">
  <Layout
    density="compact"
    scrollMode="stream"
    {conversationKey}
    {...onLoadLatest ? { onLoadLatest } : {}}
    aria-label="Agent activity"
  >
    {#snippet scrollButton({ isVisible, hasNewMessages, scrollToBottom })}
      <LayoutScrollButton
        {isVisible}
        {hasNewMessages}
        onClick={scrollToBottom}
      />
    {/snippet}
    {#snippet composer()}{/snippet}
    <CommunityAgentTranscript
      {activity}
      {...execution ? { execution } : {}}
      {agent}
      {...context ? { context } : {}}
      {members}
      {working}
      {...header ? { header } : {}}
      {...messageContent ? { messageContent } : {}}
      {...onOpenRequest ? { onOpenRequest } : {}}
      {...onLoadOlder ? { onLoadOlder, hasOlder, loading } : {}}
    />
  </Layout>
</div>
