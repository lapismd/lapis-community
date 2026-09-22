<script lang="ts">
  import {
    Message,
    MessageBubble,
    MessageMetadata,
  } from "@lapismd/design-core/ai/chat";
  import CommunityReactions from "../community-reactions/CommunityReactions.svelte";
  import { ConfirmDialog } from "@lapismd/design-core/forms/dialog";
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
  import CommunityMarkdownContent from "../community-markdown-content/CommunityMarkdownContent.svelte";
  import { communityMemberAvatarShape } from "../community-member-avatar/model.js";
  import CommunityMemberHoverCard from "../community-member-hover-card/CommunityMemberHoverCard.svelte";
  import CommunityMessageReplySummary from "./CommunityMessageReplySummary.svelte";
  import CommunityReportDialog from "../community-report-dialog/CommunityReportDialog.svelte";
  import type {
    CommunityEmojiReference,
    CommunityMemberModel,
    CommunityMessageModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";

  import { memberById } from "../community-workspace/model.js";
  import { messageActivityContent } from "./message-activity.js";

  import type { CommunityMessageProps } from "./props.js";
  import "./community-message.css";

  let {
    message,
    author,
    members = [],
    rooms = [],
    isContinuation = false,
    highlighted = false,
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
    avatarShape,
  }: CommunityMessageProps = $props();
  const resolvedAvatarShape = $derived(
    avatarShape ?? communityMemberAvatarShape(author),
  );

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
  const activityContent = $derived(
    messageActivityContent(message.activity, activityMembers),
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
  data-highlighted={highlighted ? "" : undefined}
  data-message-id={message.id}
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
        avatarShape={resolvedAvatarShape}
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
        <CommunityReactions
          mode="picker"
          pickerLabel="Add reaction"
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
    <CommunityReactions
      mode="bar"
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
        <CommunityMessageReplySummary
          label={replyLabel}
          participants={replyParticipants}
          onOpenThread={onOpenThread
            ? () => onOpenThread(message.id)
            : undefined}
          {onOpenProfile}
          {onMessageMember}
          {onWaveMember}
          {onViewMemberActivity}
        />
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
  <ConfirmDialog
    bind:open={deleteOpen}
    pending={deletePending}
    destructive
    onConfirm={async () => {
      await confirmDelete();
      return !deleteError;
    }}
  >
    {#snippet title()}Delete message?{/snippet}
    {#snippet description()}
      This removes your message from the conversation. This action cannot be
      undone.
    {/snippet}
    {#snippet confirmLabel()}
      {deletePending ? "Deleting…" : "Delete message"}
    {/snippet}

    {#if deleteError}<p class="community-message__delete-error" role="alert">
        {deleteError}
      </p>{/if}
  </ConfirmDialog>
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

  :global(.community-message[data-highlighted]) {
    background: color-mix(in srgb, var(--primary) 12%, var(--background));
  }

  :global(.community-message[data-continuation] [data-ui-part="name"]) {
    display: none;
  }

  .community-message__continuation-time {
    display: block;
    width: 2.25rem;
    min-height: 1.375rem;
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
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

  .community-message__delete-error {
    margin: 0;
    color: var(--destructive);
    font-size: var(--community-text-body);
  }

  .community-message__author {
    font-weight: 700;
  }

  .community-message__role {
    margin-inline-start: 0.35rem;
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
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
    font-size: var(--community-text-secondary);
    line-height: 1;
  }

  .community-message__metadata
    :global([data-ui-component="ai-chat-message-metadata"]) {
    min-height: 1.5rem;
    margin-top: 0;
    line-height: 1;
  }
</style>
