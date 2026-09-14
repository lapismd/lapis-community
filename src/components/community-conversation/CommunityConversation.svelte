<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import CommunitySkeleton from "../community-skeleton/CommunitySkeleton.svelte";
  import { untrack } from "svelte";
  import { observeReadEnd } from "../community-workspace/observe-read-end.js";
  import CommunityAgentComposerActivity from "../community-agent-composer-activity/CommunityAgentComposerActivity.svelte";
  import {
    Layout,
    LayoutScrollButton,
    MessageList,
    SystemMessage,
    type ComposerStatus,
  } from "@lapismd/design-core/ai/chat";
  import type { Snippet } from "svelte";

  import type {
    CommunityCustomEmoji,
    CommunityMessageReport,
    CommunityReplyTarget,
    CommunityTimelinePresentation,
    CommunityTimelinePosition,
  } from "../../community/index.js";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import CommunityMessage from "../community-message/CommunityMessage.svelte";
  import { isMessageContinuation } from "../community-message/grouping.js";
  import {
    memberById,
    type CommunityMemberModel,
    type CommunityMessageModel,
    type CommunityRoomModel,
  } from "../community-workspace/model.js";

  import type { CommunityAgentActivityContext } from "../../community/agent-contracts.js";
  let {
    activityContext,
    room,
    draftKey = room.id,
    history,
    onLoadOlder,
    onLoadLatest,
    virtualize = false,
    presentation,
    onPresentationChange,
    rooms = [],
    messages,
    members,
    directMember,
    directMemberAvatarShape = "circle",
    onSend,
    onReply,
    onOpenThread,
    onToggleReaction,
    onAddReaction,
    onCopyMessageLink,
    onCopyMessage,
    onCopyEvent,
    onEditMessage,
    onSaveMessageEdit,
    onDeleteMessage,
    onReportMessage,
    onOpenProfile,
    onOpenRoom,
    onMessageMember,
    onWaveMember,
    onViewMemberActivity,
    replyTarget,
    communityEmojis = [],
    onCancelReply,
    disabled = false,
    disabledReason = "Reconnect to send messages",
    composerStatus,
    onRetryComposerStatus,
    onDismissComposerStatus,
    restrictMessageManagement = false,
    currentMemberId,
    canDeleteAny = false,
    composerPlacement = "overlay",
    replyActionLabel = "Reply in thread",
    intro,
    footer,
    messageSupplement,
    readBoundary,
  }: {
    readBoundary?: { key: string; onRead?: () => void };
    activityContext?: CommunityAgentActivityContext;
    room: CommunityRoomModel;
    draftKey?: string;
    history?: {
      hasOlder: boolean;
      loading: boolean;
      hasNewer?: boolean;
      unreadEventIds?: readonly string[];
      error?: string;
    };
    /** Opt in to paged, anchored rendering without changing existing snippet consumers. */
    virtualize?: boolean;
    onLoadLatest?: () => Promise<void>;
    presentation?: CommunityTimelinePresentation;
    onPresentationChange?: (
      key: string,
      update: { draft?: string; position?: CommunityTimelinePosition },
    ) => void;
    onLoadOlder?: () => Promise<void>;
    rooms?: readonly CommunityRoomModel[];
    messages: CommunityMessageModel[];
    members: CommunityMemberModel[];
    directMember?: CommunityMemberModel;
    directMemberAvatarShape?: "circle" | "rounded";
    onSend?: (content: string) => void | Promise<void>;
    onReply?: (messageId: string) => void;
    onOpenThread?: (messageId: string) => void;
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
    onSaveMessageEdit?: (
      messageId: string,
      content: string,
    ) => void | Promise<void>;
    onDeleteMessage?: (messageId: string) => void | Promise<void>;
    onReportMessage?: (
      messageId: string,
      report: CommunityMessageReport,
    ) => void | Promise<void>;
    onOpenProfile?: (member: CommunityMemberModel) => void;
    onOpenRoom?: (roomId: string) => void;
    onMessageMember?: (member: CommunityMemberModel) => void | Promise<void>;
    onWaveMember?: (member: CommunityMemberModel) => void | Promise<void>;
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
    restrictMessageManagement?: boolean;
    currentMemberId?: string;
    canDeleteAny?: boolean;
    composerPlacement?: "overlay" | "row";
    replyActionLabel?: string;
    intro?: Snippet;
    footer?: Snippet;
    messageSupplement?: Snippet<[CommunityMessageModel]>;
  } = $props();

  let draft = $state("");
  $effect(() => {
    const saved = presentation;
    if (saved)
      untrack(() => {
        draft = saved.draft;
      });
  });
  $effect(() => {
    const value = draft;
    const key = presentation?.key;
    if (key && previousDraftKey === draftKey)
      untrack(() => onPresentationChange?.(key, { draft: value }));
  });
  const latestArrivalId = $derived(
    messages.findLast(
      (message) =>
        message.authorId !== currentMemberId &&
        !message.activity &&
        (!message.sourceEvent ||
          [9, 11, 1111, 14].includes(message.sourceEvent.kind)),
    )?.id,
  );
  const effectiveReadBoundary = $derived(
    history?.hasNewer || history?.loading ? undefined : readBoundary,
  );

  const conversationDrafts = new Map<string, string>();
  let previousDraftKey: string | undefined;
  let previousDraftIdentity: string | undefined;
  let draftIdentityLoaded = false;
  $effect(() => {
    const identity = currentMemberId;
    untrack(() => {
      if (draftIdentityLoaded && previousDraftIdentity === identity) return;
      draftIdentityLoaded = true;
      previousDraftIdentity = identity;
      conversationDrafts.clear();
      previousDraftKey = undefined;
      draft = presentation?.draft ?? "";
      editingMessageId = undefined;
    });
  });
  $effect(() => {
    const key = draftKey;
    untrack(() => {
      if (previousDraftKey === key) return;
      if (previousDraftKey !== undefined)
        conversationDrafts.set(previousDraftKey, draft);
      draft = presentation?.draft ?? conversationDrafts.get(key) ?? "";
      previousDraftKey = key;
    });
  });
  let editingMessageId = $state<string | undefined>();
  const density = $derived(room.kind === "forum" ? "spacious" : "compact");
  const composerRooms = $derived(rooms.length > 0 ? rooms : [room]);
  const displayedDirectMember = $derived(
    directMember ?? {
      id: room.id,
      name: room.name,
      handle: room.id,
      initials:
        room.name
          .split(/\s+/u)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toLocaleUpperCase() ?? "")
          .join("") || "?",
      presence: "offline" as const,
    },
  );

  function messageDay(message: CommunityMessageModel): string {
    if (message.createdAt === undefined) return "unknown";
    const date = new Date(message.createdAt);
    if (!Number.isFinite(date.getTime())) return "unknown";
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }

  function startsMessageDay(
    entries: readonly CommunityMessageModel[],
    index: number,
  ): boolean {
    return (
      index === 0 ||
      messageDay(entries[index - 1]!) !== messageDay(entries[index]!)
    );
  }

  function messageDayLabel(message: CommunityMessageModel): string {
    if (message.createdAt === undefined) return "Today";
    const date = new Date(message.createdAt);
    if (!Number.isFinite(date.getTime())) return "Today";
    const today = new Date();
    const dateStart = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    );
    const todayStart = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const elapsedDays = Math.round(
      (todayStart.getTime() - dateStart.getTime()) / 86_400_000,
    );
    if (elapsedDays === 0) return "Today";
    if (elapsedDays === 1) return "Yesterday";
    return new Intl.DateTimeFormat("en", {
      weekday: "long",
      month: "long",
      day: "numeric",
      ...(date.getFullYear() === today.getFullYear()
        ? {}
        : { year: "numeric" }),
    }).format(date);
  }

  function startEditing(message: CommunityMessageModel): void {
    editingMessageId = message.id;
    draft = message.content;
  }

  function cancelComposerContext(): void {
    if (editingMessageId !== undefined) {
      editingMessageId = undefined;
      draft = "";
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
    await onSend?.(content);
  }
</script>

<div
  class="community-conversation"
  data-room-kind={room.kind}
  data-composer-placement={composerPlacement}
  data-footer={footer ? "custom" : "composer"}
>
  {#snippet messageRow(message: CommunityMessageModel, index: number)}
    {#if startsMessageDay(messages, index)}
      <SystemMessage variant="divider">
        {messageDayLabel(message)}
      </SystemMessage>
    {/if}
    {#snippet supplement()}
      {#if messageSupplement}
        {@render messageSupplement(message)}
      {/if}
    {/snippet}
    <CommunityMessage
      {message}
      isContinuation={isMessageContinuation(messages, index)}
      author={memberById(members, message.authorId)}
      {members}
      rooms={composerRooms}
      {...onOpenProfile === undefined ? {} : { onOpenProfile }}
      {...onOpenRoom === undefined ? {} : { onOpenRoom }}
      replyParticipants={(message.replyParticipantIds ?? []).map((id) =>
        memberById(members, id),
      )}
      {density}
      {communityEmojis}
      {...currentMemberId === undefined ? {} : { currentMemberId }}
      {replyActionLabel}
      {...messageSupplement === undefined ? {} : { supplement }}
      {...onReply === undefined ? {} : { onReply }}
      {...onOpenThread === undefined ? {} : { onOpenThread }}
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
      (restrictMessageManagement && message.authorId !== currentMemberId)
        ? {}
        : {
            onEdit: onSaveMessageEdit
              ? () => startEditing(message)
              : onEditMessage,
          }}
      {...onDeleteMessage === undefined ||
      (restrictMessageManagement &&
        message.authorId !== currentMemberId &&
        !canDeleteAny)
        ? {}
        : { onDelete: onDeleteMessage }}
      {...onReportMessage === undefined ? {} : { onReport: onReportMessage }}
      {...onMessageMember === undefined ? {} : { onMessageMember }}
      {...onWaveMember === undefined ? {} : { onWaveMember }}
      {...onViewMemberActivity === undefined ? {} : { onViewMemberActivity }}
    />
  {/snippet}
  <Layout
    {density}
    scrollMode={virtualize ? "history" : "stream"}
    conversationKey={presentation?.key ?? draftKey}
    {...history?.unreadEventIds
      ? { hasNewMessages: history.unreadEventIds.length > 0 }
      : {}}
    hasNewer={history?.hasNewer ?? false}
    {...onLoadLatest ? { onLoadLatest } : {}}
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
      {#if history?.loading}
        <CommunitySkeleton
          layout="messages"
          count={5}
          label="Loading messages"
        />
      {:else if history?.error}
        <p role="alert">{history.error}</p>
        <Button variant="ghost" onclick={() => onLoadLatest?.().catch(() => {})}
          >Retry loading messages</Button
        >
      {:else if room.kind === "direct"}
        <div class="community-conversation__direct-empty">
          <CommunityChip
            class="community-conversation__direct-day"
            variant="muted"
            ariaHidden>Today</CommunityChip
          >
          <section class="community-conversation__direct-intro">
            {#if onOpenProfile}
              <button
                type="button"
                class="community-conversation__direct-avatar-button"
                data-ui-part="direct-message-profile-action"
                aria-label={`View ${displayedDirectMember.name}'s profile`}
                onclick={() => onOpenProfile?.(displayedDirectMember)}
              >
                <CommunityMemberAvatar
                  member={displayedDirectMember}
                  size="large"
                  showPresence
                  shape={directMemberAvatarShape}
                  decorative
                />
              </button>
            {:else}
              <CommunityMemberAvatar
                member={displayedDirectMember}
                size="large"
                showPresence
                shape={directMemberAvatarShape}
                decorative
              />
            {/if}
            <h1>{displayedDirectMember.name}</h1>
            <p>
              This is the beginning of your direct message with {displayedDirectMember.name}.
            </p>
          </section>
          <SystemMessage variant="divider">Today</SystemMessage>
        </div>
      {:else if intro}
        <div class="community-conversation__room-empty">
          {@render intro()}
        </div>
      {:else}
        <div class="community-conversation__empty">
          <strong>Start the conversation in {room.name}</strong>
          <span>Messages published to this room will appear here.</span>
        </div>
      {/if}
    {/snippet}
    {#snippet composer()}
      {#if footer}
        {@render footer()}
      {:else}
        <CommunityChatComposer
          bind:value={draft}
          {members}
          rooms={composerRooms}
          {communityEmojis}
          {...currentMemberId === undefined ? {} : { currentMemberId }}
          {...onOpenProfile === undefined
            ? {}
            : { onOpenMember: onOpenProfile }}
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
          placeholder={`Message ${room.kind === "channel" ? "#" : ""}${room.name}`}
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
      {/if}
      <CommunityAgentComposerActivity
        context={activityContext ??
          (room.kind === "direct"
            ? {
                kind: "dm",
                ...(displayedDirectMember
                  ? { agentPubkey: displayedDirectMember.id }
                  : {}),
              }
            : { kind: "channel", channelId: room.groupId ?? room.id })}
      />
    {/snippet}

    <MessageList
      {density}
      aria-label={`${room.name} messages`}
      conversationKey={presentation?.key ?? draftKey}
      latestMessageId={latestArrivalId ?? ""}
      {...virtualize
        ? {
            items: messages,
            row: messageRow,
            virtualize: true,
            ...(presentation?.position
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
      {#snippet header()}{#if intro}{@render intro()}{/if}{/snippet}
      {#snippet footer()}
        {#if effectiveReadBoundary}<div
            use:observeReadEnd={effectiveReadBoundary}
            data-ui-part="read-boundary"
            style="height: 1px;"
          ></div>{/if}
      {/snippet}
      {#each messages as message, index (message.id)}{@render messageRow(
          message,
          index,
        )}{/each}
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

  .community-conversation[data-footer="custom"]
    :global(
      [data-ui-component="ai-chat-layout"] > [data-ui-part="composer-dock"]
    ) {
    z-index: 1;
    overflow: hidden;
    border-block-start: 1px solid var(--border);
    padding: 0;
    background: var(--background);
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

  .community-conversation__room-empty {
    width: 100%;
    min-height: 100%;
  }

  .community-conversation[data-room-kind="channel"]
    :global(
      [data-ui-part="empty-state"]:has(.community-conversation__room-empty)
    ) {
    display: block;
    width: 100%;
  }

  .community-conversation__empty strong {
    color: var(--foreground);
  }

  .community-conversation[data-room-kind="direct"]
    :global([data-ui-part="empty-state"]) {
    display: block;
  }

  .community-conversation :global([data-ui-part="list-spacer"]) {
    display: none;
  }

  .community-conversation
    :global(
      [data-ui-component="ai-chat-message-list"] [data-ui-part="list-inner"]
    ) {
    justify-content: flex-start;
    padding-block-start: 0.5rem;
  }

  .community-conversation__direct-empty {
    display: grid;
    width: 100%;
    align-content: start;
    padding: 1rem 0.75rem 3rem;
  }

  :global(.community-conversation__direct-day[data-ui-part="community-chip"]) {
    width: max-content;
    margin-inline: auto;
  }

  .community-conversation__direct-intro {
    display: grid;
    gap: 0.5rem;
    padding: 1.5rem 0.25rem 2rem;
  }

  .community-conversation__direct-intro h1,
  .community-conversation__direct-intro p {
    margin: 0;
  }

  .community-conversation__direct-intro h1 {
    margin-block-start: 0.75rem;
    font-size: var(--community-text-dialog);
  }

  .community-conversation__direct-intro p {
    color: var(--muted-foreground);
  }

  .community-conversation__direct-avatar-button {
    display: inline-grid;
    width: 4rem;
    height: 4rem;
    place-items: center;
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 999px;
    color: inherit;
    background: transparent;
    cursor: pointer;
  }

  .community-conversation__direct-avatar-button:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 3px;
  }

  .community-conversation__direct-avatar-button
    :global(.community-member-avatar) {
    transition:
      transform 120ms ease,
      filter 120ms ease;
  }

  .community-conversation__direct-avatar-button:hover
    :global(.community-member-avatar),
  .community-conversation__direct-avatar-button:focus-visible
    :global(.community-member-avatar) {
    transform: translateY(-1px);
    filter: drop-shadow(0 0.35rem 0.6rem rgb(15 23 42 / 0.12));
  }
</style>
