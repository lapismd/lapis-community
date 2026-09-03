<script lang="ts">
  import {
    Composer,
    ComposerDrawer,
    Layout,
    LayoutScrollButton,
    MessageList,
  } from "@lapismd/design-core/ai/chat";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import ReplyIcon from "@lucide/svelte/icons/reply";
  import XIcon from "@lucide/svelte/icons/x";

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
    type CommunityThreadModel,
  } from "../community-workspace/model.js";

  let {
    thread,
    members,
    onSendReply,
    onToggleReaction,
    onAddReaction,
    onCopyMessageLink,
    onCopyMessage,
    onEditMessage,
    onDeleteMessage,
    onReply,
    onOpenProfile,
    onMessageMember,
    onViewMemberActivity,
    replyTarget,
    communityEmojis = [],
    onCancelReply,
  }: {
    thread: CommunityThreadModel;
    members: CommunityMemberModel[];
    onSendReply?: (
      rootMessageId: string,
      content: string,
    ) => void | Promise<void>;
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
    onReply?: (messageId: string) => void;
    onOpenProfile?: (member: CommunityMemberModel) => void;
    onMessageMember?: (member: CommunityMemberModel) => void;
    onViewMemberActivity?: (member: CommunityMemberModel) => void;
    replyTarget?: CommunityReplyTarget;
    communityEmojis?: readonly CommunityCustomEmoji[];
    onCancelReply?: () => void;
  } = $props();

  let draft = $state("");
  const rootMessage = $derived(
    thread.messages.find((message) => message.id === thread.rootMessageId),
  );
  const rootAuthor = $derived(
    rootMessage === undefined
      ? undefined
      : memberById(members, rootMessage.authorId),
  );
  const composerContext = $derived(
    replyTarget?.eventId === thread.rootMessageId ? undefined : replyTarget,
  );

  function submit(content: string): void {
    const result = onSendReply?.(thread.rootMessageId, content);
    if (result instanceof Promise) void result.catch(() => (draft = content));
  }
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
        placeholder={rootAuthor === undefined
          ? "Reply to thread"
          : `Reply in thread to ${rootAuthor.name}`}
        onSubmit={submit}
      >
        {#snippet drawer()}
          {#if composerContext}
            <ComposerDrawer
              role="group"
              aria-label={`Replying to ${composerContext.authorName}`}
            >
              <div class="community-thread-panel__reply-context">
                <span>
                  <strong>
                    <ReplyIcon aria-hidden="true" />
                    Replying to {composerContext.authorName}
                  </strong>
                  <small title={composerContext.content}
                    >{composerContext.content}</small
                  >
                </span>
                {#if onCancelReply}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Cancel reply"
                    onclick={onCancelReply}><XIcon aria-hidden="true" /></Button
                  >
                {/if}
              </div>
            </ComposerDrawer>
          {/if}
        {/snippet}
        {#snippet footerActions()}
          <CommunityEmojiPicker
            {communityEmojis}
            label="Add emoji to reply"
            onSelect={(emoji) => (draft += emoji)}
          />
        {/snippet}
      </Composer>
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
          {communityEmojis}
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
          {...onOpenProfile === undefined ? {} : { onOpenProfile }}
          {...onMessageMember === undefined ? {} : { onMessageMember }}
          {...onViewMemberActivity === undefined
            ? {}
            : { onViewMemberActivity }}
          {...message.id === thread.rootMessageId || onReply === undefined
            ? {}
            : {
                onOpenThread: onReply,
                replyActionLabel: "Reply",
              }}
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
    --ui-ai-chat-max-content-width: 100%;

    display: grid;
    flex: 1;
    grid-template-rows: minmax(0, 1fr) auto;
    min-height: 0;
  }

  .community-thread-panel :global([data-ui-component="ai-chat-message-list"]) {
    --ui-ai-chat-max-content-width: 100%;

    width: 100%;
    max-width: none;
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
    width: 100%;
    max-width: none;
    margin-inline: 0;
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
    :global([data-ui-part="composer-dock"] > [data-ui-part="composer-inner"]) {
    width: 100%;
    max-width: none;
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

  .community-thread-panel__reply-context {
    display: flex;
    width: 100%;
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .community-thread-panel
    :global([data-ui-component="ai-chat-composer-drawer"]) {
    padding-block-start: 0.625rem;
    background: color-mix(in srgb, var(--foreground) 4%, var(--background));
  }

  .community-thread-panel__reply-context > span {
    display: grid;
    min-width: 0;
    flex: 1;
    gap: 0.1rem;
  }

  .community-thread-panel__reply-context strong {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.78rem;
    font-weight: 600;
    line-height: 1rem;
  }

  .community-thread-panel__reply-context strong :global(svg) {
    width: 0.8rem;
    height: 0.8rem;
  }

  .community-thread-panel__reply-context small {
    display: block;
    overflow: hidden;
    color: var(--muted-foreground);
    font-size: 0.72rem;
    line-height: 1rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .community-thread-panel__reply-context :global([data-ui-component="button"]) {
    width: 1.5rem;
    height: 1.5rem;
  }
</style>
