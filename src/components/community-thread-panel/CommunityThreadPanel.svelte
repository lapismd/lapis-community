<script lang="ts">
  import {
    Layout,
    LayoutScrollButton,
    MessageList,
    type ComposerStatus,
  } from "@lapismd/design-core/ai/chat";
  import type {
    CommunityCustomEmoji,
    CommunityReplyTarget,
  } from "../../community/index.js";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import CommunityMessage from "../community-message/CommunityMessage.svelte";
  import { isMessageContinuation } from "../community-message/grouping.js";
  import {
    memberById,
    type CommunityMemberModel,
    type CommunityRoomModel,
    type CommunityThreadModel,
  } from "../community-workspace/model.js";

  let {
    thread,
    members,
    rooms = [],
    onSendReply,
    onToggleReaction,
    onAddReaction,
    onCopyMessageLink,
    onCopyMessage,
    onCopyEvent,
    onEditMessage,
    onDeleteMessage,
    onReply,
    onOpenProfile,
    onOpenRoom,
    onMessageMember,
    onViewMemberActivity,
    replyTarget,
    communityEmojis = [],
    onCancelReply,
    disabled = false,
    disabledReason = "Reconnect to reply",
    composerStatus,
    onRetryComposerStatus,
    onDismissComposerStatus,
    currentMemberId,
    canDeleteAny = false,
  }: {
    thread: CommunityThreadModel;
    members: CommunityMemberModel[];
    rooms?: readonly CommunityRoomModel[];
    onSendReply?: (
      rootMessageId: string,
      content: string,
    ) => void | Promise<void>;
    onToggleReaction?: (
      messageId: string,
      emoji: string,
      custom?: { shortcode: string; url: string },
    ) => void | Promise<void>;
    onAddReaction?: (
      messageId: string,
      emoji: string,
      custom?: { shortcode: string; url: string },
    ) => void | Promise<void>;
    onCopyMessageLink?: (messageId: string) => void;
    onCopyMessage?: (messageId: string) => void;
    onCopyEvent?: (messageId: string) => void;
    onEditMessage?: (messageId: string) => void | Promise<void>;
    onDeleteMessage?: (messageId: string) => void | Promise<void>;
    onReply?: (messageId: string) => void;
    onOpenProfile?: (member: CommunityMemberModel) => void;
    onOpenRoom?: (roomId: string) => void;
    onMessageMember?: (member: CommunityMemberModel) => void | Promise<void>;
    onViewMemberActivity?: (
      member: CommunityMemberModel,
    ) => void | Promise<void>;
    replyTarget?: CommunityReplyTarget;
    communityEmojis?: readonly CommunityCustomEmoji[];
    onCancelReply?: () => void;
    disabled?: boolean;
    disabledReason?: string;
    composerStatus?: ComposerStatus;
    onRetryComposerStatus?: () => void | Promise<void>;
    onDismissComposerStatus?: () => void;
    currentMemberId?: string;
    canDeleteAny?: boolean;
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
      <CommunityChatComposer
        bind:value={draft}
        {members}
        {rooms}
        {communityEmojis}
        {...currentMemberId === undefined ? {} : { currentMemberId }}
        {...replyTarget === undefined
          ? {}
          : { context: { kind: "reply" as const, target: replyTarget } }}
        {disabled}
        {disabledReason}
        ariaLabel="Thread reply composer"
        submitLabel="Send reply"
        placeholder={rootAuthor === undefined
          ? "Reply to thread"
          : `Reply in thread to ${rootAuthor.name}`}
        {...composerStatus === undefined ? {} : { composerStatus }}
        {...onRetryComposerStatus === undefined
          ? {}
          : { onRetryComposerStatus }}
        {...onDismissComposerStatus === undefined
          ? {}
          : { onDismissComposerStatus }}
        {...onCancelReply === undefined
          ? {}
          : { onCancelContext: onCancelReply }}
        onSubmit={(submission) =>
          onSendReply?.(thread.rootMessageId, submission.content)}
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
          {members}
          {rooms}
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
          {...onCopyEvent === undefined ? {} : { onCopyEvent }}
          {...onEditMessage === undefined ||
          message.authorId !== currentMemberId
            ? {}
            : { onEdit: onEditMessage }}
          {...onDeleteMessage === undefined ||
          (message.authorId !== currentMemberId && !canDeleteAny)
            ? {}
            : { onDelete: onDeleteMessage }}
          {...onOpenProfile === undefined ? {} : { onOpenProfile }}
          {...onOpenRoom === undefined ? {} : { onOpenRoom }}
          {...onMessageMember === undefined ? {} : { onMessageMember }}
          {...onViewMemberActivity === undefined
            ? {}
            : { onViewMemberActivity }}
          {...message.id === thread.rootMessageId || onReply === undefined
            ? {}
            : {
                onReply,
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

  .community-thread-panel :global([data-ui-part="list-spacer"]) {
    display: none;
  }

  .community-thread-panel
    :global(
      [data-ui-component="ai-chat-message-list"] [data-ui-part="list-inner"]
    ) {
    justify-content: flex-start;
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
</style>
