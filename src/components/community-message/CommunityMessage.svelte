<script lang="ts">
  import {
    Message,
    MessageBubble,
    MessageMetadata,
  } from "@lapismd/design-core/ai/chat";
  import { ReactionBar } from "@lapismd/design-core/ai/experimental";
  import * as AlertDialog from "@lapismd/design-core/shadcn/alert-dialog";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import ClipboardCopyIcon from "@lucide/svelte/icons/clipboard-copy";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
  import FileJson2Icon from "@lucide/svelte/icons/file-json-2";
  import FlagIcon from "@lucide/svelte/icons/flag";
  import LinkIcon from "@lucide/svelte/icons/link";
  import MessageSquareReplyIcon from "@lucide/svelte/icons/message-square-reply";
  import PencilIcon from "@lucide/svelte/icons/pencil";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import { onDestroy, type Snippet } from "svelte";

  import type {
    CommunityCustomEmoji,
    CommunityMessageReport,
  } from "../../community/index.js";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityEmojiPicker from "../community-emoji-picker/CommunityEmojiPicker.svelte";
  import CommunityMarkdownContent from "../community-markdown-content/CommunityMarkdownContent.svelte";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import CommunityMemberHoverCard from "../community-member-hover-card/CommunityMemberHoverCard.svelte";
  import CommunityReportDialog from "../community-report-dialog/CommunityReportDialog.svelte";
  import type {
    CommunityEmojiReference,
    CommunityMemberModel,
    CommunityMessageModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
  import { memberById } from "../community-workspace/model.js";

  let {
    message,
    author,
    members = [],
    rooms = [],
    isContinuation = false,
    replyParticipants = [],
    communityEmojis = [],
    reactionOptions,
    density = "compact",
    onReply,
    onOpenThread,
    onToggleReaction,
    onAddReaction,
    onCopyLink,
    onCopyMessage,
    onCopyEvent,
    onEdit,
    onDelete,
    onReport,
    onOpenProfile,
    onOpenRoom,
    onMessageMember,
    onWaveMember,
    onViewMemberActivity,
    currentMemberId,
    replyActionLabel = "Reply in thread",
    supplement,
  }: {
    message: CommunityMessageModel;
    author: CommunityMemberModel;
    members?: readonly CommunityMemberModel[];
    rooms?: readonly CommunityRoomModel[];
    isContinuation?: boolean;
    replyParticipants?: CommunityMemberModel[];
    communityEmojis?: readonly CommunityCustomEmoji[];
    reactionOptions?: readonly string[];
    density?: "compact" | "balanced" | "spacious";
    onReply?: (messageId: string) => void;
    onOpenThread?: (messageId: string) => void;
    onToggleReaction?: (
      messageId: string,
      emoji: string,
      customEmoji?: CommunityEmojiReference,
    ) => void | Promise<void>;
    onAddReaction?: (
      messageId: string,
      emoji: string,
      customEmoji?: CommunityEmojiReference,
    ) => void | Promise<void>;
    onCopyLink?: (messageId: string) => void;
    onCopyMessage?: (messageId: string) => void;
    onCopyEvent?: (messageId: string) => void;
    onEdit?: (messageId: string) => void | Promise<void>;
    onDelete?: (messageId: string) => void | Promise<void>;
    onReport?: (
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
    currentMemberId?: string;
    replyActionLabel?: string;
    supplement?: Snippet;
  } = $props();

  const actionOpenDelay = 180;
  const actionCloseDelay = 150;
  let actionOpenTimer: ReturnType<typeof setTimeout> | undefined;
  let actionCloseTimer: ReturnType<typeof setTimeout> | undefined;
  let actionsVisible = $state(false);
  let deleteOpen = $state(false);
  let deletePending = $state(false);
  let deleteError = $state("");
  let reportOpen = $state(false);
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
  const authorName = $derived(
    author.id === currentMemberId ? "You" : author.name,
  );
  const activityMembers = $derived(
    currentMemberId === undefined
      ? members
      : members.map((member) =>
          member.id === currentMemberId ? { ...member, name: "You" } : member,
        ),
  );
  const activityContent = $derived.by(() => {
    const activity = message.activity;
    if (activity === undefined) return "";
    const target =
      activity.targetMemberId === undefined
        ? undefined
        : memberById(activityMembers, activity.targetMemberId);
    const targetReference =
      target === undefined ? "a member" : `@${target.name}`;
    switch (activity.type) {
      case "channel-created":
        return "created this channel";
      case "member-added":
        return `added ${targetReference} to this channel`;
      case "member-removed":
        return `removed ${targetReference} from this channel`;
      case "member-joined":
        return "joined this channel";
      case "member-left":
        return "left this channel";
    }
  });

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
  const replyAction = $derived(
    message.activity === undefined ? (onReply ?? onOpenThread) : undefined,
  );
  const canCopyEvent = $derived(
    message.activity === undefined &&
      onCopyEvent !== undefined &&
      message.sourceEvent !== undefined,
  );

  async function confirmDelete(): Promise<void> {
    if (onDelete === undefined || deletePending) return;
    deletePending = true;
    deleteError = "";
    try {
      await onDelete(message.id);
      deleteOpen = false;
    } catch (cause) {
      deleteError =
        cause instanceof Error
          ? cause.message
          : "The message could not be deleted";
    } finally {
      deletePending = false;
    }
  }
</script>

<Message
  sender="assistant"
  {density}
  class="community-message"
  data-selected={isSelected ? "" : undefined}
  data-continuation={isContinuation ? "" : undefined}
  data-actions-visible={actionsVisible ? "" : undefined}
  aria-label={`Message from ${authorName}`}
  onpointerenter={scheduleActions}
  onpointerleave={scheduleActionsHide}
  onfocusin={focusActions}
  onfocusout={blurActions}
>
  {#snippet avatar()}
    {#if isContinuation}
      <span
        class="community-message__continuation-time"
        data-ui-part="continuation-time"
        aria-hidden="true"
      >
        {message.timestamp}
      </span>
    {:else}
      <CommunityMemberHoverCard
        member={author}
        {...onOpenProfile === undefined ? {} : { onOpenProfile }}
        {...onMessageMember === undefined ? {} : { onMessage: onMessageMember }}
        {...onWaveMember === undefined ? {} : { onWave: onWaveMember }}
        {...onViewMemberActivity === undefined
          ? {}
          : { onViewActivity: onViewMemberActivity }}
      />
    {/if}
  {/snippet}
  {#snippet name()}
    {#if !isContinuation}
      <span class="community-message__author">{authorName}</span>
      {#if author.role}
        <span class="community-message__role">{author.role}</span>
      {/if}
    {/if}
  {/snippet}

  <MessageBubble variant="ghost" {density}>
    {#if message.activity}
      <CommunityMarkdownContent
        class="community-message__content community-message__activity"
        content={activityContent}
        mentionPubkeys={message.activity.targetMemberId === undefined
          ? []
          : [message.activity.targetMemberId]}
        members={activityMembers}
        {rooms}
        {communityEmojis}
        {...onOpenProfile === undefined
          ? {}
          : {
              onOpenMember: (member: CommunityMemberModel) =>
                onOpenProfile(memberById(members, member.id)),
            }}
        {...onOpenRoom === undefined ? {} : { onOpenRoom }}
        {...onMessageMember === undefined
          ? {}
          : {
              onMessageMember: (member: CommunityMemberModel) =>
                onMessageMember(memberById(members, member.id)),
            }}
        {...onWaveMember === undefined
          ? {}
          : {
              onWaveMember: (member: CommunityMemberModel) =>
                onWaveMember(memberById(members, member.id)),
            }}
      />
    {:else}
      <CommunityMarkdownContent
        class="community-message__content"
        content={message.content}
        mentionPubkeys={message.mentionPubkeys ?? []}
        {members}
        {rooms}
        {communityEmojis}
        {...onOpenProfile === undefined ? {} : { onOpenMember: onOpenProfile }}
        {...onMessageMember === undefined ? {} : { onMessageMember }}
        {...onWaveMember === undefined ? {} : { onWaveMember }}
        {...onOpenRoom === undefined ? {} : { onOpenRoom }}
      />
    {/if}
  </MessageBubble>

  {#if supplement}
    <div
      class="community-message__supplement"
      data-ui-part="message-supplement"
    >
      {@render supplement()}
    </div>
  {/if}

  {#if message.activity === undefined && (onAddReaction || replyAction || onCopyLink || onCopyMessage || canCopyEvent || onEdit || onDelete || onReport)}
    <div
      class="community-message__actions"
      data-ui-part="message-actions"
      role="group"
      aria-label={`Actions for ${authorName}'s message`}
      onpointerenter={keepActionsVisible}
      onpointerleave={scheduleActionsHide}
    >
      {#if onAddReaction}
        <CommunityEmojiPicker
          label="Add reaction"
          communityEmojis={reactionOptions === undefined ? communityEmojis : []}
          presets={reactionOptions ?? []}
          presetsOnly={reactionOptions !== undefined}
          onSelect={(emoji, custom) =>
            onAddReaction(
              message.id,
              emoji,
              custom === undefined
                ? undefined
                : { shortcode: custom.shortcode, url: custom.url },
            )}
        />
      {/if}
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
      {#if onCopyLink || onCopyMessage || canCopyEvent || onEdit || onDelete || onReport}
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
          <DropdownMenu.Content
            class="community-message__menu-content"
            align="end"
            sideOffset={4}
          >
            {#if onEdit}
              <DropdownMenu.Group>
                <DropdownMenu.Item onSelect={() => onEdit(message.id)}>
                  <PencilIcon data-icon="inline-start" aria-hidden="true" />
                  Edit message
                </DropdownMenu.Item>
              </DropdownMenu.Group>
            {/if}
            {#if onEdit && (onCopyMessage || canCopyEvent || onCopyLink)}
              <DropdownMenu.Separator />
            {/if}
            {#if onCopyMessage || canCopyEvent || onCopyLink}
              <DropdownMenu.Group>
                {#if onCopyMessage}
                  <DropdownMenu.Item onSelect={() => onCopyMessage(message.id)}>
                    <ClipboardCopyIcon
                      data-icon="inline-start"
                      aria-hidden="true"
                    />
                    Copy message
                  </DropdownMenu.Item>
                {/if}
                {#if canCopyEvent}
                  <DropdownMenu.Item onSelect={() => onCopyEvent?.(message.id)}>
                    <FileJson2Icon
                      data-icon="inline-start"
                      aria-hidden="true"
                    />
                    Copy event
                  </DropdownMenu.Item>
                {/if}
                {#if onCopyLink}
                  <DropdownMenu.Item onSelect={() => onCopyLink(message.id)}>
                    <LinkIcon data-icon="inline-start" aria-hidden="true" />
                    Copy message link
                  </DropdownMenu.Item>
                {/if}
              </DropdownMenu.Group>
            {/if}
            {#if (onEdit || onCopyMessage || canCopyEvent || onCopyLink) && (onReport || onDelete)}
              <DropdownMenu.Separator />
            {/if}
            {#if onReport || onDelete}
              <DropdownMenu.Group>
                {#if onReport}
                  <DropdownMenu.Item onSelect={() => (reportOpen = true)}>
                    <FlagIcon data-icon="inline-start" aria-hidden="true" />
                    Report message
                  </DropdownMenu.Item>
                {/if}
                {#if onDelete}
                  <DropdownMenu.Item
                    variant="destructive"
                    onSelect={() => (deleteOpen = true)}
                  >
                    <Trash2Icon data-icon="inline-start" aria-hidden="true" />
                    Delete message
                  </DropdownMenu.Item>
                {/if}
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
      label={`Reactions to ${authorName}'s message`}
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
      {#if message.edited}<span>(edited)</span>{/if}
      {#if showReplySummary}
        <CommunityChip
          variant="muted"
          class="community-message__reply-summary"
          ariaLabel={replyLabel}
          onclick={() => onOpenThread?.(message.id)}
        >
          {#if replyParticipants.length}
            <span class="community-message__reply-avatars" aria-hidden="true">
              {#each replyParticipants.slice(0, 3) as participant (participant.id)}
                <span title={participant.name}>
                  <CommunityMemberAvatar
                    member={participant}
                    size="xsmall"
                    decorative
                  />
                </span>
              {/each}
            </span>
          {/if}
          <span>{replyLabel}</span>
        </CommunityChip>
      {/if}
    </div>
  {/snippet}
</Message>

{#if onReport}
  <CommunityReportDialog
    bind:open={reportOpen}
    onSubmit={(report) => onReport(message.id, report)}
  />
{/if}

{#if onDelete}
  <AlertDialog.Root bind:open={deleteOpen}>
    <AlertDialog.Content class="community-message__delete-dialog">
      <AlertDialog.Header>
        <AlertDialog.Title>Delete message?</AlertDialog.Title>
        <AlertDialog.Description>
          This removes your message from the conversation. This action cannot be
          undone.
        </AlertDialog.Description>
      </AlertDialog.Header>
      {#if deleteError}<p class="community-message__delete-error" role="alert">
          {deleteError}
        </p>{/if}
      <AlertDialog.Footer>
        <AlertDialog.Cancel disabled={deletePending}>Cancel</AlertDialog.Cancel>
        <Button
          type="button"
          variant="destructive"
          disabled={deletePending}
          onclick={confirmDelete}
        >
          {deletePending ? "Deleting…" : "Delete message"}
        </Button>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/if}

<style>
  .community-message__supplement {
    width: 100%;
    min-width: 0;
  }
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
    padding-block: 0.25rem 0.125rem;
  }

  :global(.community-message[data-continuation] [data-ui-part="name"]) {
    display: none;
  }

  .community-message__continuation-time {
    display: block;
    width: 2.25rem;
    min-height: 1.375rem;
    color: var(--muted-foreground);
    font-size: 0.56rem;
    line-height: 1.375rem;
    text-align: right;
    opacity: 0;
    transition: opacity 120ms ease;
  }

  :global(.community-message[data-continuation]:hover)
    .community-message__continuation-time,
  :global(.community-message[data-continuation]:focus-within)
    .community-message__continuation-time,
  :global(.community-message[data-continuation][data-actions-visible])
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

  .community-message__actions :global([data-ui-component="button"]) {
    border-radius: inherit;
  }

  .community-message__actions :global([data-ui-component="button"]:hover),
  .community-message__actions
    :global([data-ui-component="button"]:focus-visible) {
    background: var(--muted);
    box-shadow: inset 0 0 0 1px
      color-mix(in srgb, var(--foreground) 10%, transparent);
  }

  :global(.community-message__menu-content) {
    min-width: 13.5rem;
  }

  :global(.community-message__delete-dialog) {
    width: min(calc(100vw - 2rem), 28rem);
  }

  .community-message__delete-error {
    margin: 0;
    color: var(--destructive);
    font-size: 0.875rem;
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

  :global(.community-message__content) {
    margin: 0;
    color: var(--foreground);
    line-height: 1.55;
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

  .community-message__reply-avatars {
    display: flex;
    padding-inline-start: 0.2rem;
  }

  .community-message__reply-avatars > span {
    display: block;
    margin-inline-start: -0.2rem;
    border-radius: 50%;
    outline: 2px solid var(--background);
  }
</style>
