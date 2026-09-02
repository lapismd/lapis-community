<script lang="ts">
  import {
    Composer,
    Layout,
    LayoutScrollButton,
    MessageList,
  } from "@lapismd/design-core/ai/chat";

  import CommunityMessage from "../community-message/CommunityMessage.svelte";
  import { isMessageContinuation } from "../community-message/grouping.js";
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
    onCopyMessageLink,
    onDeleteMessage,
  }: {
    thread: CommunityThreadModel;
    members: CommunityMemberModel[];
    onSendReply?: (rootMessageId: string, content: string) => void;
    onToggleReaction?: (messageId: string, emoji: string) => void;
    onAddReaction?: (messageId: string, emoji: string) => void;
    onCopyMessageLink?: (messageId: string) => void;
    onDeleteMessage?: (messageId: string) => void;
  } = $props();

  let draft = $state("");
</script>

<div class="community-thread-panel">
  <Layout
    density="compact"
    aria-label="Message thread"
    isEmpty={thread.messages.length === 0}
  >
    {#snippet scrollButton({ isVisible, hasNewMessages, scrollToBottom })}
      <LayoutScrollButton
        {isVisible}
        {hasNewMessages}
        onClick={scrollToBottom}
      />
    {/snippet}
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
      {#each thread.messages as message, index (message.id)}
        <CommunityMessage
          {message}
          isContinuation={isMessageContinuation(thread.messages, index)}
          author={memberById(members, message.authorId)}
          replyParticipants={(message.replyParticipantIds ?? []).map((id) =>
            memberById(members, id),
          )}
          density="compact"
          onToggleReaction={(messageId, emoji) =>
            onToggleReaction?.(messageId, emoji)}
          onAddReaction={(messageId, emoji) =>
            onAddReaction?.(messageId, emoji)}
          onCopyLink={(messageId) => onCopyMessageLink?.(messageId)}
          onDelete={(messageId) => onDeleteMessage?.(messageId)}
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
    display: grid;
    flex: 1;
    grid-template-rows: minmax(0, 1fr) auto;
    min-height: 0;
  }

  .community-thread-panel
    :global(
      [data-ui-component="ai-chat-layout"] > [data-ui-part="scroll-shell"]
    ) {
    grid-row: 1;
  }

  .community-thread-panel
    :global(
      [data-ui-component="ai-chat-layout"] [data-ui-part="message-area"]
    ) {
    padding-block-end: 0.5rem;
  }

  .community-thread-panel
    :global(
      [data-ui-component="ai-chat-layout"] > [data-ui-part="composer-dock"]
    ) {
    position: relative;
    inset: auto;
    grid-row: 2;
    padding: 0.5rem 0.75rem 0.75rem;
    border-block-start: 1px solid var(--border);
    background: var(--background);
    pointer-events: auto;
  }

  .community-thread-panel
    :global(
      [data-ui-component="ai-chat-layout"]
        > [data-ui-part="composer-dock"]::before
    ) {
    display: none;
  }

  .community-thread-panel :global([data-ui-component="ai-chat-composer"]) {
    --ui-ai-chat-composer-radius: 0.75rem;
  }
</style>
