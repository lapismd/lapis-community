<script lang="ts">
  import type { Snippet } from "svelte";
  import { Layout, LayoutScrollButton } from "@lapismd/design-core/ai/chat";
  import type {
    CommunityAgentActivityContext,
    CommunityAgentActivityItem,
    CommunityAgentIdentity,
    CommunityAgentTranscriptEntry,
  } from "../../community/agent-contracts.js";
  import type { CommunityMemberModel } from "../community-workspace/model.js";
  import CommunityAgentTranscript from "./CommunityAgentTranscript.svelte";
  import "./activity-feed.css";

  let {
    activity,
    agent,
    context,
    conversationKey,
    members = [],
    onOpenRequest,
    header,
    working = false,
    messageContent,
    onLoadLatest,
  }: {
    header?: Snippet;
    messageContent?: Snippet<
      [Extract<CommunityAgentTranscriptEntry, { type: "message" }>]
    >;
    working?: boolean;
    activity: readonly CommunityAgentActivityItem[];
    agent: Pick<CommunityAgentIdentity, "pubkey" | "name" | "avatarUrl">;
    context?: CommunityAgentActivityContext;
    conversationKey: string;
    members?: readonly CommunityMemberModel[];
    onOpenRequest?: (item: CommunityAgentActivityItem) => void;
    onLoadLatest?: () => Promise<void>;
  } = $props();
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
      {agent}
      {...context ? { context } : {}}
      {members}
      {working}
      {...header ? { header } : {}}
      {...messageContent ? { messageContent } : {}}
      {...onOpenRequest ? { onOpenRequest } : {}}
    />
  </Layout>
</div>
