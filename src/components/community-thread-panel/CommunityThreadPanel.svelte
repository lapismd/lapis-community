<script lang="ts">
  import { Composer, Layout, MessageList } from "@lapismd/design-core/ai/chat";

  import CommunityMessage from "../community-message/CommunityMessage.svelte";
  import {
    memberById,
    type CommunityMemberModel,
    type CommunityThreadModel,
  } from "../community-workspace/model.js";

  let {
    thread,
    members,
    onSendReply,
    onToggleReaction,
    onAddReaction,
  }: {
    thread: CommunityThreadModel;
    members: CommunityMemberModel[];
    onSendReply?: (rootMessageId: string, content: string) => void;
    onToggleReaction?: (messageId: string, emoji: string) => void;
    onAddReaction?: (messageId: string, emoji: string) => void;
  } = $props();

  let draft = $state("");
</script>

<div class="community-thread-panel">
  <Layout
    density="compact"
    aria-label="Message thread"
    isEmpty={thread.messages.length === 0}
  >
    {#snippet composer()}
      <Composer
        density="compact"
        bind:value={draft}
        placeholder="Reply to thread"
        onSubmit={(content) => onSendReply?.(thread.rootMessageId, content)}
      />
    {/snippet}

    <MessageList
      density="compact"
      latestMessageId={thread.messages.at(-1)?.id ?? ""}
      aria-label="Thread replies"
    >
      {#each thread.messages as message (message.id)}
        <CommunityMessage
          {message}
          author={memberById(members, message.authorId)}
          density="compact"
          onToggleReaction={(messageId, emoji) =>
            onToggleReaction?.(messageId, emoji)}
          onAddReaction={(messageId, emoji) =>
            onAddReaction?.(messageId, emoji)}
        />
      {/each}
    </MessageList>
  </Layout>
</div>

<style>
  .community-thread-panel {
    display: flex;
    width: 100%;
    min-width: 0;
    height: 100%;
    min-height: 0;
  }

  .community-thread-panel :global([data-ui-component="ai-chat-layout"]) {
    flex: 1;
    min-height: 0;
  }
</style>
