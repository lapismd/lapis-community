<script lang="ts">
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
  import CommunityMessage from "../community-message/CommunityMessage.svelte";
  import { isMessageContinuation } from "../community-message/grouping.js";
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
  } = $props();
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
    scrollMode={history ? "history" : "stream"}
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
