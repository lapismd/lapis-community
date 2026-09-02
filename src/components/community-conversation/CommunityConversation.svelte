<script lang="ts">
  import {
    Composer,
    Layout,
    LayoutScrollButton,
    MessageList,
    SystemMessage,
  } from "@lapismd/design-core/ai/chat";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import XIcon from "@lucide/svelte/icons/x";
  import type { Snippet } from "svelte";

  import type {
    CommunityCustomEmoji,
    CommunityReplyTarget,
  } from "../../community/index.js";
  import CommunityEmojiPicker from "../community-emoji-picker/CommunityEmojiPicker.svelte";
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
    onCopyMessage,
    onEditMessage,
    onDeleteMessage,
    replyTarget,
    communityEmojis = [],
    onCancelReply,
    disabled = false,
    disabledReason = "Reconnect to send messages",
    composerPlacement = "overlay",
    intro,
  }: {
    room: CommunityRoomModel;
    messages: CommunityMessageModel[];
    members: CommunityMemberModel[];
    onSend?: (content: string) => void | Promise<void>;
    onOpenThread?: (messageId: string) => void;
    onToggleReaction?: (
      messageId: string,
      emoji: string,
      custom?: { shortcode: string; url: string },
    ) => void;
    onAddReaction?: (
      messageId: string,
      emoji: string,
      custom?: { shortcode: string; url: string },
    ) => void;
    onCopyMessageLink?: (messageId: string) => void;
    onCopyMessage?: (messageId: string) => void;
    onEditMessage?: (messageId: string) => void;
    onDeleteMessage?: (messageId: string) => void;
    replyTarget?: CommunityReplyTarget;
    communityEmojis?: readonly CommunityCustomEmoji[];
    onCancelReply?: () => void;
    disabled?: boolean;
    disabledReason?: string;
    composerPlacement?: "overlay" | "row";
    intro?: Snippet;
  } = $props();

  let draft = $state("");
  const density = $derived(room.kind === "forum" ? "spacious" : "compact");

  function submit(content: string): void {
    const result = onSend?.(content);
    if (result instanceof Promise) {
      void result.catch(() => {
        draft = content;
      });
    }
  }
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
        {disabled}
        aria-label={disabled ? disabledReason : undefined}
        title={disabled ? disabledReason : undefined}
        bind:value={draft}
        placeholder={`Message ${room.kind === "channel" ? "#" : ""}${room.name}`}
        onSubmit={submit}
      >
        {#if replyTarget}
          {#snippet headerContext()}
            <div class="community-conversation__reply-context">
              <span>
                <strong>Replying to {replyTarget.authorName}</strong>
                <small>{replyTarget.content.slice(0, 140)}</small>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Cancel reply"
                onclick={onCancelReply}
              >
                <XIcon aria-hidden="true" />
              </Button>
            </div>
          {/snippet}
        {/if}
        {#snippet footerActions()}
          <CommunityEmojiPicker
            {communityEmojis}
            label="Add emoji to message"
            onSelect={(emoji) => (draft += emoji)}
          />
        {/snippet}
      </Composer>
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
          {communityEmojis}
          onOpenThread={(messageId) => onOpenThread?.(messageId)}
          onToggleReaction={(messageId, emoji, custom) =>
            custom
              ? onToggleReaction?.(messageId, emoji, custom)
              : onToggleReaction?.(messageId, emoji)}
          onAddReaction={(messageId, emoji, custom) =>
            custom
              ? onAddReaction?.(messageId, emoji, custom)
              : onAddReaction?.(messageId, emoji)}
          onCopyLink={(messageId) => onCopyMessageLink?.(messageId)}
          onCopyMessage={(messageId) => onCopyMessage?.(messageId)}
          onEdit={(messageId) => onEditMessage?.(messageId)}
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
    :global([data-ui-part="composer-dock"] > [data-ui-part="composer-inner"]) {
    width: 100%;
    max-width: none;
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

  .community-conversation__reply-context {
    display: flex;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.45rem 0.55rem;
    border-block-end: 1px solid var(--border);
  }

  .community-conversation__reply-context > span {
    display: grid;
    min-width: 0;
  }

  .community-conversation__reply-context small {
    overflow: hidden;
    color: var(--muted-foreground);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
