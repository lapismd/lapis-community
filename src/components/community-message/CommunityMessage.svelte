<script lang="ts">
  import {
    Message,
    MessageBubble,
    MessageMetadata,
  } from "@lapismd/design-core/ai/chat";
  import { ReactionBar } from "@lapismd/design-core/ai/experimental";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
  import MessageSquareReplyIcon from "@lucide/svelte/icons/message-square-reply";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import { onDestroy } from "svelte";

  import type { CommunityCustomEmoji } from "../../community/index.js";
  import CommunityEmojiPicker from "../community-emoji-picker/CommunityEmojiPicker.svelte";
  import CommunityMemberHoverCard from "../community-member-hover-card/CommunityMemberHoverCard.svelte";
  import type {
    CommunityEmojiReference,
    CommunityMemberModel,
    CommunityMessageModel,
  } from "../community-workspace/model.js";

  let {
    message,
    author,
    isContinuation = false,
    replyParticipants = [],
    communityEmojis = [],
    density = "compact",
    onReply,
    onOpenThread,
    onToggleReaction,
    onAddReaction,
    onCopyLink,
    onCopyMessage,
    onEdit,
    onDelete,
    onOpenProfile,
    onMessageMember,
    onViewMemberActivity,
    replyActionLabel = "Reply in thread",
  }: {
    message: CommunityMessageModel;
    author: CommunityMemberModel;
    isContinuation?: boolean;
    replyParticipants?: CommunityMemberModel[];
    communityEmojis?: readonly CommunityCustomEmoji[];
    density?: "compact" | "balanced" | "spacious";
    onReply?: (messageId: string) => void;
    onOpenThread?: (messageId: string) => void;
    onToggleReaction?: (
      messageId: string,
      emoji: string,
      customEmoji?: CommunityEmojiReference,
    ) => void;
    onAddReaction?: (
      messageId: string,
      emoji: string,
      customEmoji?: CommunityEmojiReference,
    ) => void;
    onCopyLink?: (messageId: string) => void;
    onCopyMessage?: (messageId: string) => void;
    onEdit?: (messageId: string) => void;
    onDelete?: (messageId: string) => void;
    onOpenProfile?: (member: CommunityMemberModel) => void;
    onMessageMember?: (member: CommunityMemberModel) => void;
    onViewMemberActivity?: (member: CommunityMemberModel) => void;
    replyActionLabel?: string;
  } = $props();

  const actionOpenDelay = 180;
  const actionCloseDelay = 150;
  let actionOpenTimer: ReturnType<typeof setTimeout> | undefined;
  let actionCloseTimer: ReturnType<typeof setTimeout> | undefined;
  let actionsVisible = $state(false);
  let hasFocusWithin = false;

  function clearActionOpenTimer(): void {
    if (actionOpenTimer === undefined) return;
    clearTimeout(actionOpenTimer);
    actionOpenTimer = undefined;
  }

  function clearActionCloseTimer(): void {
    if (actionCloseTimer === undefined) return;
    clearTimeout(actionCloseTimer);
    actionCloseTimer = undefined;
  }

  function scheduleActions(): void {
    clearActionCloseTimer();
    if (actionsVisible) return;
    clearActionOpenTimer();
    actionOpenTimer = setTimeout(() => {
      actionsVisible = true;
      actionOpenTimer = undefined;
    }, actionOpenDelay);
  }

  function keepActionsVisible(): void {
    clearActionOpenTimer();
    clearActionCloseTimer();
    actionsVisible = true;
  }

  function scheduleActionsHide(): void {
    clearActionOpenTimer();
    clearActionCloseTimer();
    if (hasFocusWithin) return;
    actionCloseTimer = setTimeout(() => {
      actionsVisible = false;
      actionCloseTimer = undefined;
    }, actionCloseDelay);
  }

  function focusActions(): void {
    hasFocusWithin = true;
    keepActionsVisible();
  }

  function blurActions(event: FocusEvent): void {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget instanceof Node) {
      if (event.currentTarget.contains(next)) return;
    }
    hasFocusWithin = false;
    clearActionCloseTimer();
    actionsVisible = false;
  }

  onDestroy(() => {
    clearActionOpenTimer();
    clearActionCloseTimer();
  });

  const isSelected = $derived(
    message.reactions?.some((reaction) => reaction.selected) ?? false,
  );

  const replyLabel = $derived.by(() => {
    const replyCount = message.replyCount ?? 0;
    return (
      message.replyLabel ??
      `${replyCount} ${replyCount === 1 ? "reply" : "replies"}`
    );
  });
  const showReplySummary = $derived(
    (message.replyCount ?? 0) > 0 && onOpenThread !== undefined,
  );
  const replyAction = $derived(onReply ?? onOpenThread);
</script>

<Message
  sender="assistant"
  {density}
  class="community-message"
  data-selected={isSelected ? "" : undefined}
  data-continuation={isContinuation ? "" : undefined}
  data-actions-visible={actionsVisible ? "" : undefined}
  aria-label={`Message from ${author.name}`}
  onpointerenter={scheduleActions}
  onpointerleave={scheduleActionsHide}
  onfocusin={focusActions}
  onfocusout={blurActions}
>
  {#snippet avatar()}
    {#if isContinuation}
      <span class="community-message__continuation-time" aria-hidden="true">
        {message.timestamp}
      </span>
    {:else}
      <CommunityMemberHoverCard
        member={author}
        {...onOpenProfile === undefined ? {} : { onOpenProfile }}
        {...onMessageMember === undefined ? {} : { onMessage: onMessageMember }}
        {...onViewMemberActivity === undefined
          ? {}
          : { onViewActivity: onViewMemberActivity }}
      />
    {/if}
  {/snippet}
  {#snippet name()}
    {#if !isContinuation}
      <span class="community-message__author">{author.name}</span>
      {#if author.role}
        <span class="community-message__role">{author.role}</span>
      {/if}
    {/if}
  {/snippet}

  <MessageBubble variant="ghost" {density}>
    <p class="community-message__content">{message.content}</p>
  </MessageBubble>

  {#if onAddReaction}
    <div
      class="community-message__actions"
      data-ui-part="message-actions"
      role="group"
      aria-label={`Actions for ${author.name}'s message`}
      onpointerenter={keepActionsVisible}
      onpointerleave={scheduleActionsHide}
    >
      <CommunityEmojiPicker
        label="Add reaction"
        {communityEmojis}
        onSelect={(emoji, custom) =>
          onAddReaction(
            message.id,
            emoji,
            custom === undefined
              ? undefined
              : { shortcode: custom.shortcode, url: custom.url },
          )}
      />
      {#if replyAction}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={replyActionLabel}
          title={replyActionLabel}
          onclick={() => replyAction(message.id)}
        >
          <MessageSquareReplyIcon aria-hidden="true" />
        </Button>
      {/if}
      {#if onCopyLink}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Copy message link"
          title="Copy message link"
          onclick={() => onCopyLink(message.id)}
        >
          <CopyIcon aria-hidden="true" />
        </Button>
      {/if}
      {#if onCopyLink || onCopyMessage || onEdit || onDelete}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="More message actions"
                title="More message actions"
              >
                <EllipsisIcon aria-hidden="true" />
              </Button>
            {/snippet}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end" sideOffset={4}>
            {#if onCopyMessage}
              <DropdownMenu.Group>
                <DropdownMenu.Item onSelect={() => onCopyMessage(message.id)}>
                  <CopyIcon data-icon="inline-start" aria-hidden="true" />
                  Copy message
                </DropdownMenu.Item>
              </DropdownMenu.Group>
            {/if}
            {#if onCopyLink}
              <DropdownMenu.Group>
                <DropdownMenu.Item onSelect={() => onCopyLink(message.id)}>
                  <CopyIcon data-icon="inline-start" aria-hidden="true" />
                  Copy message link
                </DropdownMenu.Item>
              </DropdownMenu.Group>
            {/if}
            {#if onEdit}
              <DropdownMenu.Group>
                <DropdownMenu.Item onSelect={() => onEdit(message.id)}>
                  <PencilIcon data-icon="inline-start" aria-hidden="true" />
                  Edit message
                </DropdownMenu.Item>
              </DropdownMenu.Group>
            {/if}
            {#if onDelete}
              <DropdownMenu.Group>
                <DropdownMenu.Item
                  variant="destructive"
                  onSelect={() => onDelete(message.id)}
                >
                  <Trash2Icon data-icon="inline-start" aria-hidden="true" />
                  Delete message
                </DropdownMenu.Item>
              </DropdownMenu.Group>
            {/if}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      {/if}
    </div>
  {/if}

  {#if message.reactions?.length}
    <ReactionBar
      reactions={message.reactions}
      label={`Reactions to ${author.name}'s message`}
      onToggle={(emoji) => {
        const reaction = message.reactions?.find(
          (candidate) => candidate.emoji === emoji,
        );
        if (reaction?.customEmojiUrl)
          onToggleReaction?.(message.id, emoji, {
            shortcode: emoji,
            url: reaction.customEmojiUrl,
          });
        else onToggleReaction?.(message.id, emoji);
      }}
    />
  {/if}

  {#snippet metadata()}
    <div class="community-message__metadata">
      {#if !isContinuation}
        <MessageMetadata timestamp={message.timestamp} />
      {/if}
      {#if message.edited}<span>edited</span>{/if}
      {#if showReplySummary}
        <Button
          type="button"
          variant="ghost"
          size="xs"
          class="community-message__reply-summary"
          aria-label={replyLabel}
          onclick={() => onOpenThread?.(message.id)}
        >
          {#if replyParticipants.length}
            <span class="community-message__reply-avatars" aria-hidden="true">
              {#each replyParticipants.slice(0, 3) as participant (participant.id)}
                <span title={participant.name}>
                  {#if participant.avatarUrl}
                    <img src={participant.avatarUrl} alt="" />
                  {:else}
                    {participant.initials}
                  {/if}
                </span>
              {/each}
            </span>
          {/if}
          <span>{replyLabel}</span>
        </Button>
      {/if}
    </div>
  {/snippet}
</Message>

<style>
  :global(.community-message) {
    position: relative;
    width: calc(100% + 1rem);
    margin-inline: -0.5rem;
    border-radius: var(--radius);
    padding: 0.375rem 0.5rem;
    transition: background-color 120ms ease;
  }

  :global(.community-message:hover),
  :global(.community-message:focus-within),
  :global(.community-message[data-selected]) {
    background: color-mix(in srgb, var(--foreground) 4%, transparent);
  }

  :global(.community-message[data-continuation]) {
    padding-block: 0.125rem;
  }

  :global(.community-message[data-continuation] [data-ui-part="name"]) {
    display: none;
  }

  .community-message__continuation-time {
    display: flex;
    width: 2.25rem;
    min-height: 1.5rem;
    align-items: flex-start;
    justify-content: flex-end;
    padding-block-start: 0.2rem;
    color: var(--muted-foreground);
    font-size: 0.56rem;
    line-height: 1;
    opacity: 0;
    transition: opacity 120ms ease;
  }

  :global(.community-message[data-continuation]:hover)
    .community-message__continuation-time,
  :global(.community-message[data-continuation]:focus-within)
    .community-message__continuation-time {
    opacity: 1;
  }

  :global(
      .community-message
        [data-ui-component="ai-chat-message-bubble"][data-variant="ghost"]
    ) {
    padding-inline: 0;
  }

  .community-message__actions {
    position: absolute;
    z-index: 3;
    inset-block-start: 0;
    inset-inline-end: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.125rem;
    padding: 0.125rem;
    border: 1px solid var(--border);
    border-radius: 999px;
    opacity: 0;
    background: var(--popover, var(--background));
    box-shadow: var(--shadow-sm);
    pointer-events: none;
    transition:
      opacity 120ms ease,
      transform 120ms ease;
    transform: translateY(calc(-100% + 0.15rem));
  }

  :global(.community-message[data-actions-visible])
    .community-message__actions {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(calc(-100% + 0.3rem));
  }

  .community-message__actions :global([data-ui-component="button"]:hover) {
    background: color-mix(in srgb, var(--foreground) 12%, transparent);
    box-shadow: inset 0 0 0 1px
      color-mix(in srgb, var(--foreground) 10%, transparent);
  }

  .community-message__author {
    font-weight: 700;
  }

  .community-message__role {
    margin-inline-start: 0.35rem;
    color: var(--muted-foreground);
    font-size: 0.68rem;
    font-weight: 500;
    text-transform: uppercase;
  }

  .community-message__content {
    margin: 0;
    color: var(--foreground);
    line-height: 1.55;
    white-space: pre-wrap;
  }

  .community-message__metadata {
    display: flex;
    min-height: 1.5rem;
    align-items: center;
    gap: 0.4rem;
    color: var(--muted-foreground);
    font-size: 0.72rem;
    line-height: 1;
  }

  .community-message__metadata
    :global([data-ui-component="ai-chat-message-metadata"]) {
    min-height: 1.5rem;
    margin-top: 0;
    line-height: 1;
  }

  :global(.community-message__reply-summary[data-ui-component="button"]) {
    height: 1.5rem;
    gap: 0.4rem;
    padding: 0 0.35rem;
    border-radius: 999px;
    color: var(--muted-foreground);
    font-size: 0.72rem;
    line-height: 1;
  }

  :global(.community-message__reply-summary[data-ui-component="button"]:hover),
  :global(
      .community-message__reply-summary[data-ui-component="button"]:focus-visible
    ) {
    color: var(--foreground);
    background: color-mix(in srgb, var(--foreground) 8%, transparent);
  }

  .community-message__reply-avatars {
    display: flex;
    padding-inline-start: 0.2rem;
  }

  .community-message__reply-avatars > span {
    display: grid;
    width: 1.3rem;
    height: 1.3rem;
    place-items: center;
    overflow: hidden;
    margin-inline-start: -0.2rem;
    border: 2px solid var(--background);
    border-radius: 50%;
    color: var(--primary-foreground);
    background: var(--primary);
    font-size: 0.46rem;
    font-weight: 750;
  }

  .community-message__reply-avatars img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
