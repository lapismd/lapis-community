<script lang="ts">
  import {
    Composer,
    Layout,
    LayoutScrollButton,
    MessageList,
  } from "@lapismd/design-core/ai/chat";
  import { Button } from "@lapismd/design-core/shadcn/button";
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
  const composerContext = $derived.by(() => {
    if (replyTarget) {
      return {
        authorName: replyTarget.authorName,
        content: replyTarget.content,
        isRoot: replyTarget.eventId === thread.rootMessageId,
      };
    }
    if (rootMessage === undefined || rootAuthor === undefined) return undefined;
    return {
      authorName: rootAuthor.name,
      content: rootMessage.content,
      isRoot: true,
    };
  });

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
        {#snippet headerContext()}
          {#if composerContext}
            <div
              class="community-thread-panel__reply-context"
              aria-label={`${composerContext.isRoot ? "Thread from" : "Replying to"} ${composerContext.authorName}`}
            >
              <span
                ><strong
                  >{composerContext.isRoot ? "Thread from" : "Replying to"}
                  {composerContext.authorName}</strong
                ><small>{composerContext.content.slice(0, 120)}</small></span
              >
              {#if !composerContext.isRoot && onCancelReply}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Cancel reply"
                  onclick={onCancelReply}><XIcon aria-hidden="true" /></Button
                >
              {/if}
            </div>
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
    min-width: 0;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.45rem 0.55rem;
    border-block-end: 1px solid var(--border);
  }

  .community-thread-panel__reply-context > span {
    display: grid;
    min-width: 0;
  }
  .community-thread-panel__reply-context small {
    overflow: hidden;
    color: var(--muted-foreground);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
