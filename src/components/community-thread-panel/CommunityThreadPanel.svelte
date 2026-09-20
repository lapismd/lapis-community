<script lang="ts">
  import CommunityAgentThreadContext from "../community-agent-thread-context/CommunityAgentThreadContext.svelte";
  import { createThreadDraft } from "./thread-draft.svelte.js";
  import { focusReply } from "./focus-reply.js";
  import { observeReadEnd } from "../community-workspace/observe-read-end.js";
  import CommunityAgentComposerActivity from "../community-agent-composer-activity/CommunityAgentComposerActivity.svelte";
  import {
    Layout,
    LayoutScrollButton,
    MessageList,
    type ComposerStatus,
  } from "@lapismd/design-core/ai/chat";
  import type {
    CommunityCustomEmoji,
    CommunityMessageReport,
    CommunityReplyTarget,
    CommunityHistoryState,
    CommunityTimelinePresentation,
    CommunityTimelinePosition,
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

  import type { ThreadPanelProps } from "./props.js";
  import { useAgentConversation } from "../community-agent-conversation/context.svelte.js";
  let {
    activityContext,
    virtualize = false,
    history,
    presentation,
    onPresentationChange,
    onLoadOlder,
    onLoadLatest,
    readBoundary,
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
    onSaveMessageEdit,
    onDeleteMessage,
    onReportMessage,
    onReply,
    onOpenProfile,
    onOpenRoom,
    onMessageMember,
    onWaveMember,
    onViewMemberActivity,
    replyTarget,
    focusMessageId,
    communityEmojis = [],
    onCancelReply,
    disabled = false,
    disabledReason = "Reconnect to reply",
    composerStatus,
    onRetryComposerStatus,
    onDismissComposerStatus,
    currentMemberId,
    canDeleteAny = false,
  }: ThreadPanelProps = $props();

  const conversationKey = $derived(
    presentation?.key ??
      JSON.stringify([currentMemberId, thread.rootMessageId]),
  );
  const draft = createThreadDraft({
    key: () => conversationKey,
    presentation: () => presentation,
    changed: (key, value) => onPresentationChange?.(key, { draft: value }),
    switched: () => {
      editingMessageId = undefined;
    },
  });
  const latestArrivalId = $derived(
    thread.messages.findLast(
      (message) =>
        message.authorId !== currentMemberId &&
        (!message.sourceEvent ||
          [9, 11, 1111, 14].includes(message.sourceEvent.kind)),
    )?.id,
  );
  const effectiveReadBoundary = $derived(
    history?.hasNewer || history?.loading ? undefined : readBoundary,
  );
  let viewport = $state<HTMLElement | null>(null);
  const conversation = useAgentConversation();
  const focused = $derived(
    focusMessageId ?? replyTarget?.eventId ?? conversation?.replyCommentId,
  );
  const focusAnchor = $derived(
    focused && thread.messages.some((message) => message.id === focused)
      ? focused
      : thread.rootMessageId,
  );
  let editingMessageId = $state<string | undefined>();
  const rootMessage = $derived(
    thread.messages.find((message) => message.id === thread.rootMessageId),
  );
  const rootAuthor = $derived(
    rootMessage === undefined
      ? undefined
      : memberById(members, rootMessage.authorId),
  );

  function startEditing(messageId: string): void {
    const message = thread.messages.find(
      (candidate) => candidate.id === messageId,
    );
    if (message === undefined) return;
    editingMessageId = message.id;
    draft.value = message.content;
  }

  function cancelComposerContext(): void {
    if (editingMessageId !== undefined) {
      editingMessageId = undefined;
      draft.value = "";
      return;
    }
    onCancelReply?.();
  }

  async function submitComposer(content: string): Promise<void> {
    if (editingMessageId !== undefined && onSaveMessageEdit !== undefined) {
      await onSaveMessageEdit(editingMessageId, content);
      editingMessageId = undefined;
      return;
    }
    await onSendReply?.(thread.rootMessageId, content);
  }
</script>

<div class="community-thread-panel" use:focusReply={{ id: focused, viewport }}>
  {#snippet messageRow(
    message: import("../community-workspace/model.js").CommunityMessageModel,
    index: number,
  )}
    <CommunityMessage
      {message}
      highlighted={message.id === focused}
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
      {...(onEditMessage === undefined && onSaveMessageEdit === undefined) ||
      message.authorId !== currentMemberId
        ? {}
        : {
            onEdit: onSaveMessageEdit
              ? () => startEditing(message.id)
              : onEditMessage,
          }}
      {...onDeleteMessage === undefined ||
      (message.authorId !== currentMemberId && !canDeleteAny)
        ? {}
        : { onDelete: onDeleteMessage }}
      {...onReportMessage === undefined ? {} : { onReport: onReportMessage }}
      {...onOpenProfile === undefined ? {} : { onOpenProfile }}
      {...onOpenRoom === undefined ? {} : { onOpenRoom }}
      {...onMessageMember === undefined ? {} : { onMessageMember }}
      {...onWaveMember === undefined ? {} : { onWaveMember }}
      {...onViewMemberActivity === undefined ? {} : { onViewMemberActivity }}
      {...message.id === thread.rootMessageId || onReply === undefined
        ? {}
        : {
            onReply,
            replyActionLabel: "Reply",
          }}
    />
    <CommunityAgentThreadContext
      messageId={message.id}
      rootId={thread.rootMessageId}
      roomId={rooms.find(
        (room) =>
          (room.groupId ?? room.id) ===
          message.sourceEvent?.tags.find(([key]) => key === "h")?.[1],
      )?.id}
    />
  {/snippet}
  <Layout
    bind:scrollRef={viewport}
    density="compact"
    scrollMode={virtualize ? "history" : "stream"}
    {conversationKey}
    {...history?.unreadEventIds
      ? { hasNewMessages: history.unreadEventIds.length > 0 }
      : {}}
    hasNewer={history?.hasNewer ?? false}
    {...onLoadLatest ? { onLoadLatest } : {}}
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
        bind:value={draft.value}
        {members}
        {rooms}
        {communityEmojis}
        {...currentMemberId === undefined ? {} : { currentMemberId }}
        {...onOpenProfile === undefined ? {} : { onOpenMember: onOpenProfile }}
        {...onMessageMember === undefined ? {} : { onMessageMember }}
        {...onWaveMember === undefined ? {} : { onWaveMember }}
        {...editingMessageId !== undefined
          ? {
              context: {
                kind: "edit" as const,
                id: editingMessageId,
                label: "Editing message",
              },
            }
          : replyTarget === undefined
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
        {...editingMessageId === undefined && onCancelReply === undefined
          ? {}
          : { onCancelContext: cancelComposerContext }}
        onSubmit={(submission) => submitComposer(submission.content)}
      />
      {#if activityContext}<CommunityAgentComposerActivity
          context={activityContext}
        />{/if}
    {/snippet}

    <MessageList
      density="compact"
      aria-label="Thread replies"
      conversationKey={`${conversationKey}:${focused ?? ""}`}
      latestMessageId={latestArrivalId ?? ""}
      {...virtualize
        ? {
            items: thread.messages,
            row: messageRow,
            virtualize: true,
            ...(focused
              ? {
                  initialPosition: {
                    messageId: focusAnchor,
                    index: thread.messages.findIndex(
                      (message) => message.id === focusAnchor,
                    ),
                    offset: 0,
                    atLatest: false,
                  },
                  retainRowIds: [focusAnchor],
                }
              : presentation?.position
                ? { initialPosition: presentation.position }
                : {}),
            onPositionChange: (position) => {
              if (presentation)
                onPresentationChange?.(presentation.key, { position });
            },
          }
        : {}}
      {...onLoadOlder ? { scrollToTopAction: onLoadOlder } : {}}
      hasOlder={history?.hasOlder ?? false}
      loading={history?.loading ?? false}
    >
      {#each thread.messages as message, index (message.id)}{@render messageRow(
          message,
          index,
        )}{/each}
      {#snippet footer()}
        {#if effectiveReadBoundary}<div
            use:observeReadEnd={effectiveReadBoundary}
            data-ui-part="read-boundary"
            style="height: 1px;"
          ></div>{/if}
      {/snippet}
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
