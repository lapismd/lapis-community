<script lang="ts">
  import {
    Composer,
    Layout,
    LayoutScrollButton,
    MessageList,
    SystemMessage,
  } from "@lapismd/design-core/ai/chat";
  import type { Snippet } from "svelte";

  import type {
    CommunityCustomEmoji,
    CommunityReplyTarget,
  } from "../../community/index.js";
  import CommunityEmojiPicker from "../community-emoji-picker/CommunityEmojiPicker.svelte";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import CommunityMessage from "../community-message/CommunityMessage.svelte";
  import CommunityReplyContext from "../community-reply-context/CommunityReplyContext.svelte";
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
    onMessageMember,
    onViewMemberActivity,
    replyTarget,
    communityEmojis = [],
    onCancelReply,
    disabled = false,
    disabledReason = "Reconnect to send messages",
    composerPlacement = "overlay",
    replyActionLabel = "Reply in thread",
    intro,
  }: {
    room: CommunityRoomModel;
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
    replyActionLabel?: string;
    intro?: Snippet;
  } = $props();

  let draft = $state("");
  const density = $derived(room.kind === "forum" ? "spacious" : "compact");
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
            <CommunityReplyContext
              target={replyTarget}
              {...onCancelReply === undefined
                ? {}
                : { onCancel: onCancelReply }}
            />
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
          {replyActionLabel}
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

  .community-conversation[data-room-kind="direct"]
    :global([data-ui-part="empty-state"]) {
    display: block;
  }

  .community-conversation[data-room-kind="forum"]
    :global([data-ui-part="list-spacer"]) {
    display: none;
  }

  .community-conversation[data-room-kind="forum"]
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
