<script lang="ts">
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
    CommunityReplyTarget,
  } from "../../community/index.js";
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

  let {
    room,
    rooms = [],
    messages,
    members,
    directMember,
    onSend,
    onReply,
    onOpenThread,
    onToggleReaction,
    onAddReaction,
    onCopyMessageLink,
    onCopyMessage,
    onEditMessage,
    onDeleteMessage,
    onOpenProfile,
    onOpenRoom,
    onMessageMember,
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
  }: {
    room: CommunityRoomModel;
    rooms?: readonly CommunityRoomModel[];
    messages: CommunityMessageModel[];
    members: CommunityMemberModel[];
    directMember?: CommunityMemberModel;
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
    onEditMessage?: (messageId: string) => void | Promise<void>;
    onDeleteMessage?: (messageId: string) => void | Promise<void>;
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
</script>

<div
  class="community-conversation"
  data-room-kind={room.kind}
  data-composer-placement={composerPlacement}
  data-footer={footer ? "custom" : "composer"}
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
      {#if room.kind === "direct"}
        <div class="community-conversation__direct-empty">
          <span class="community-conversation__direct-day" aria-hidden="true"
            >Today</span
          >
          <section class="community-conversation__direct-intro">
            <CommunityMemberAvatar
              member={displayedDirectMember}
              size="large"
              showPresence
              decorative
            />
            <h1>{displayedDirectMember.name}</h1>
            <p>
              This is the beginning of your direct message with {displayedDirectMember.name}.
            </p>
          </section>
          <SystemMessage variant="divider">Today</SystemMessage>
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
          {...replyTarget === undefined
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
          {...onCancelReply === undefined
            ? {}
            : { onCancelContext: onCancelReply }}
          onSubmit={(submission) => onSend?.(submission.content)}
        />
      {/if}
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
          {...onEditMessage === undefined ||
          (restrictMessageManagement && message.authorId !== currentMemberId)
            ? {}
            : { onEdit: onEditMessage }}
          {...onDeleteMessage === undefined ||
          (restrictMessageManagement &&
            message.authorId !== currentMemberId &&
            !canDeleteAny)
            ? {}
            : { onDelete: onDeleteMessage }}
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

  .community-conversation[data-footer="custom"]
    :global(
      [data-ui-component="ai-chat-layout"] > [data-ui-part="composer-dock"]
    ) {
    border-block-start: 1px solid var(--border);
    padding: 0;
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

  .community-conversation__direct-day {
    width: max-content;
    margin-inline: auto;
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 0.2rem 0.65rem;
    color: var(--muted-foreground);
    background: var(--background);
    font-size: 0.75rem;
    font-weight: 500;
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
    font-size: 1.4rem;
  }

  .community-conversation__direct-intro p {
    color: var(--muted-foreground);
  }
</style>
