<script lang="ts">
  import { threadTranscriptMessages } from "./thread-transcript-messages.js";
  import CommunityTranscriptCommentMessage from "../community-transcript-comment-message/CommunityTranscriptCommentMessage.svelte";
  import CommunityAgentThreadContext from "../community-agent-thread-context/CommunityAgentThreadContext.svelte";
  import { createThreadDraft } from "./thread-draft.svelte.js";
  import { focusReply } from "./focus-reply.js";
  import { observeReadEnd } from "../community-workspace/observe-read-end.js";
  import {
    Layout,
    LayoutScrollButton,
    MessageList,
  } from "@lapismd/design-core/ai/chat";
  import type {
    CommunityCustomEmoji,
    CommunityMessageReport,
    CommunityReplyTarget,
    CommunityHistoryState,
    CommunityTimelinePresentation,
    CommunityTimelinePosition,
  } from "../../community/index.js";
  import CommunityThreadPanelComposer from "./CommunityThreadPanelComposer.svelte";
  import CommunityThreadMessage from "./CommunityThreadMessage.svelte";
  import { isMessageContinuation } from "../community-message/grouping.js";
  import { estimateCommunityMessageRow } from "../community-conversation/message-row-estimate.js";
  import {
    memberById,
    type CommunityMemberModel,
    type CommunityRoomModel,
    type CommunityThreadModel,
  } from "../community-workspace/model.js";

  import type { ThreadPanelProps } from "./props.js";
  import type { CommunityComposerAgentModel } from "../community-chat-composer/composer-agent-model.js";
  import { communityIdentityMembers } from "../../community/member-identity.js";
  import { useAgentConversation } from "../community-agent-conversation/context.svelte.js";
  import "./thread-panel.css";
  let panelProps: ThreadPanelProps & {
    agents?: readonly CommunityComposerAgentModel[];
  } = $props();
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
    members: membersProp,
    rooms = [],
    agents = [],
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
  }: ThreadPanelProps & {
    agents?: readonly CommunityComposerAgentModel[];
  } = $derived(panelProps);
  const members = $derived(communityIdentityMembers(membersProp, agents));

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
  const effectiveReadBoundary = $derived(
    history?.hasNewer || history?.loading ? undefined : readBoundary,
  );
  let viewport = $state<HTMLElement | null>(null);
  const conversation = useAgentConversation();
  const channelId = $derived(
    thread.messages[0]?.sourceEvent?.tags.find(([key]) => key === "h")?.[1],
  );
  const messages = $derived(
    threadTranscriptMessages(
      thread.messages,
      conversation,
      thread.rootMessageId,
      channelId,
    ),
  );
  const latestArrivalId = $derived(
    messages.findLast(
      (message) =>
        message.authorId !== currentMemberId &&
        (!message.sourceEvent ||
          [9, 11, 1111, 14].includes(message.sourceEvent.kind)),
    )?.id,
  );
  const transcriptComments = $derived(
    new Set(conversation?.transcriptComments.map(({ event }) => event.id)),
  );
  const focused = $derived(
    focusMessageId ??
      replyTarget?.eventId ??
      (conversation?.replies.messageFocus?.rootId === thread.rootMessageId
        ? conversation.replies.messageFocus.id
        : undefined) ??
      conversation?.replyCommentId,
  );
  const focusAnchor = $derived(
    focused && messages.some((message) => message.id === focused)
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
  function estimateMessageRow(
    message: import("../community-workspace/model.js").CommunityMessageModel,
    index: number,
  ): number {
    return estimateCommunityMessageRow(message, {
      density: "compact",
      continuation: isMessageContinuation(messages, index),
      hasSupplement: true,
    });
  }

  function startEditing(messageId: string): void {
    const message = thread.messages.find(
      (candidate) => candidate.id === messageId,
    );
    if (message === undefined) return;
    editingMessageId = message.id;
    draft.value = message.content;
  }
</script>

<div class="community-thread-panel" use:focusReply={{ id: focused, viewport }}>
  {#if conversation?.replies.navigationError}<p role="alert">
      {conversation.replies.navigationError}
    </p>{/if}
  {#snippet messageRow(
    message: import("../community-workspace/model.js").CommunityMessageModel,
    index: number,
  )}
    {#if transcriptComments.has(message.id)}
      <CommunityTranscriptCommentMessage
        {message}
        highlighted={message.id === focused}
      />
    {:else}
      <CommunityThreadMessage
        panel={panelProps}
        {message}
        {messages}
        {index}
        {members}
        {focused}
        {startEditing}
      />
    {/if}
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
    scrollMode={history ? "history" : "stream"}
    {conversationKey}
    {...history?.unreadEventIds
      ? { hasNewMessages: history.unreadEventIds.length > 0 }
      : {}}
    hasNewer={history?.hasNewer ?? false}
    {...onLoadLatest ? { onLoadLatest } : {}}
    aria-label="Message thread"
    isEmpty={messages.length === 0}
  >
    {#snippet scrollButton({ isVisible, hasNewMessages, scrollToBottom })}
      <LayoutScrollButton
        {isVisible}
        {hasNewMessages}
        onClick={scrollToBottom}
      />
    {/snippet}
    {#snippet composer()}
      <CommunityThreadPanelComposer
        bind:value={draft.value}
        bind:editingMessageId
        {members}
        {rooms}
        {agents}
        {currentMemberId}
        rootMessageId={thread.rootMessageId}
        {rootMessage}
        rootAuthorName={rootAuthor?.name}
        {replyTarget}
        {communityEmojis}
        {activityContext}
        {disabled}
        {disabledReason}
        {composerStatus}
        {onSendReply}
        {onSaveMessageEdit}
        {onCancelReply}
        {onOpenProfile}
        {onMessageMember}
        {onWaveMember}
        {onRetryComposerStatus}
        {onDismissComposerStatus}
      />
    {/snippet}

    <MessageList
      density="compact"
      aria-label="Thread replies"
      conversationKey={`${conversationKey}:${focused ?? ""}`}
      latestMessageId={latestArrivalId ?? ""}
      {...virtualize
        ? {
            items: messages,
            row: messageRow,
            virtualize: true,
            estimateSize: estimateMessageRow,
            ...(focused
              ? {
                  initialPosition: {
                    messageId: focusAnchor,
                    index: messages.findIndex(
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
      {#each messages as message, index (message.id)}{@render messageRow(
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
