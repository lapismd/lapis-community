<script lang="ts">
  import {
    Composer,
    ComposerDrawer,
    Layout,
    LayoutScrollButton,
    MessageList,
    SystemMessage,
  } from "@lapismd/design-core/ai/chat";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import ReplyIcon from "@lucide/svelte/icons/reply";
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
    onOpenProfile,
    onMessageMember,
    onViewMemberActivity,
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
    onOpenProfile?: (member: CommunityMemberModel) => void;
    onMessageMember?: (member: CommunityMemberModel) => void;
    onViewMemberActivity?: (member: CommunityMemberModel) => void;
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
        {#snippet drawer()}
          {#if replyTarget}
            <ComposerDrawer
              role="group"
              aria-label={`Replying to ${replyTarget.authorName}`}
            >
              <div class="community-conversation__reply-context">
                <span>
                  <strong>
                    <ReplyIcon aria-hidden="true" />
                    Replying to {replyTarget.authorName}
                  </strong>
                  <small title={replyTarget.content}
                    >{replyTarget.content}</small
                  >
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
            </ComposerDrawer>
          {/if}
        {/snippet}
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
          {...onOpenProfile === undefined ? {} : { onOpenProfile }}
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
          {...onMessageMember === undefined ? {} : { onMessageMember }}
          {...onViewMemberActivity === undefined
            ? {}
            : { onViewMemberActivity }}
        />
      {/each}
    </MessageList>
  </Layout>
</div>

<style>
  .community-conversation {
    --ui-ai-chat-max-content-width: 100%;

    display: flex;
    width: 100%;
    min-width: 0;
    height: 100%;
    min-height: 0;
  }

  .community-conversation :global([data-ui-component="ai-chat-layout"]) {
    --ui-ai-chat-max-content-width: 100%;

    flex: 1;
    min-width: 0;
    min-height: 0;
  }

  .community-conversation :global([data-ui-component="ai-chat-message-list"]) {
    --ui-ai-chat-max-content-width: 100%;

    width: 100%;
    max-width: none;
  }

  .community-conversation
    :global(
      [data-ui-component="ai-chat-layout"] [data-ui-part="message-area"]
    ) {
    width: 100%;
    max-width: none;
    margin-inline: 0;
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
    width: 100%;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .community-conversation
    :global([data-ui-component="ai-chat-composer-drawer"]) {
    padding-block-start: 0.625rem;
    background: color-mix(in srgb, var(--foreground) 4%, var(--background));
  }

  .community-conversation__reply-context > span {
    display: grid;
    min-width: 0;
    flex: 1;
    gap: 0.1rem;
  }

  .community-conversation__reply-context strong {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.78rem;
    font-weight: 600;
    line-height: 1rem;
  }

  .community-conversation__reply-context strong :global(svg) {
    width: 0.8rem;
    height: 0.8rem;
  }

  .community-conversation__reply-context small {
    display: block;
    overflow: hidden;
    color: var(--muted-foreground);
    font-size: 0.72rem;
    line-height: 1rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .community-conversation__reply-context :global([data-ui-component="button"]) {
    width: 1.5rem;
    height: 1.5rem;
  }
</style>
