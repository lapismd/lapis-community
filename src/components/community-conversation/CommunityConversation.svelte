<script lang="ts">
  import {
    Composer,
    Layout,
    LayoutScrollButton,
    MessageList,
    SystemMessage,
  } from "@lapismd/design-core/ai/chat";
  import type { Snippet } from "svelte";

  import CommunityMessage from "../community-message/CommunityMessage.svelte";
  import { isMessageContinuation } from "../community-message/grouping.js";
  import {
    memberById,
    type CommunityMemberModel,
    type CommunityMessageModel,
    type CommunityRoomModel,
  } from "../community-workspace/model.js";

  let {
    room,
    messages,
    members,
    onSend,
    onOpenThread,
    onToggleReaction,
    onAddReaction,
    onCopyMessageLink,
    onDeleteMessage,
    composerPlacement = "overlay",
    intro,
  }: {
    room: CommunityRoomModel;
    messages: CommunityMessageModel[];
    members: CommunityMemberModel[];
    onSend?: (content: string) => void;
    onOpenThread?: (messageId: string) => void;
    onToggleReaction?: (messageId: string, emoji: string) => void;
    onAddReaction?: (messageId: string, emoji: string) => void;
    onCopyMessageLink?: (messageId: string) => void;
    onDeleteMessage?: (messageId: string) => void;
    composerPlacement?: "overlay" | "row";
    intro?: Snippet;
  } = $props();

  let draft = $state("");
  const density = $derived(room.kind === "forum" ? "spacious" : "compact");
</script>

<div
  class="community-conversation"
  data-room-kind={room.kind}
  data-composer-placement={composerPlacement}
>
  <Layout
    {density}
    aria-label={`${room.name} conversation`}
    isEmpty={messages.length === 0}
  >
    {#snippet scrollButton({ isVisible, hasNewMessages, scrollToBottom })}
      <LayoutScrollButton
        {isVisible}
        {hasNewMessages}
        onClick={scrollToBottom}
      />
    {/snippet}
    {#snippet emptyState()}
      <div class="community-conversation__empty">
        <strong>Start the conversation in {room.name}</strong>
        <span>Messages published to this room will appear here.</span>
      </div>
    {/snippet}
    {#snippet composer()}
      <Composer
        {density}
        bind:value={draft}
        placeholder={`Message ${room.kind === "channel" ? "#" : ""}${room.name}`}
        onSubmit={(content) => onSend?.(content)}
      />
    {/snippet}

    <MessageList
      {density}
      latestMessageId={messages.at(-1)?.id ?? ""}
      aria-label={`${room.name} messages`}
    >
      {#if intro}
        {@render intro()}
      {/if}
      <SystemMessage variant="divider">Today</SystemMessage>
      {#each messages as message, index (message.id)}
        <CommunityMessage
          {message}
          isContinuation={isMessageContinuation(messages, index)}
          author={memberById(members, message.authorId)}
          replyParticipants={(message.replyParticipantIds ?? []).map((id) =>
            memberById(members, id),
          )}
          {density}
          onOpenThread={(messageId) => onOpenThread?.(messageId)}
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
  .community-conversation {
    display: flex;
    width: 100%;
    min-width: 0;
    height: 100%;
    min-height: 0;
  }

  .community-conversation :global([data-ui-component="ai-chat-layout"]) {
    flex: 1;
    min-width: 0;
    min-height: 0;
  }

  .community-conversation[data-composer-placement="row"]
    :global([data-ui-component="ai-chat-layout"]) {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
  }

  .community-conversation[data-composer-placement="row"]
    :global([data-ui-component="ai-chat-composer"]) {
    --ui-ai-chat-composer-radius: 0.75rem;
  }

  .community-conversation[data-composer-placement="row"]
    :global(
      [data-ui-component="ai-chat-layout"] > [data-ui-part="scroll-shell"]
    ) {
    grid-row: 1;
  }

  .community-conversation[data-composer-placement="row"]
    :global(
      [data-ui-component="ai-chat-layout"] [data-ui-part="message-area"]
    ) {
    padding-block-end: 0.5rem;
  }

  .community-conversation[data-composer-placement="row"]
    :global(
      [data-ui-component="ai-chat-layout"] > [data-ui-part="composer-dock"]
    ) {
    position: relative;
    inset: auto;
    grid-row: 2;
    padding: 0.5rem 0.75rem 0.75rem;
    background: var(--background);
    pointer-events: auto;
  }

  .community-conversation[data-composer-placement="row"]
    :global(
      [data-ui-component="ai-chat-layout"]
        > [data-ui-part="composer-dock"]::before
    ) {
    display: none;
  }

  .community-conversation__empty {
    display: grid;
    place-items: center;
    gap: 0.4rem;
    padding: 3rem 1rem;
    color: var(--muted-foreground);
    text-align: center;
  }

  .community-conversation__empty strong {
    color: var(--foreground);
  }
</style>
