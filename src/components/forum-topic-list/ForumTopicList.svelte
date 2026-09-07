<script lang="ts">
  import type { ComposerStatus } from "@lapismd/design-core/ai/chat";
  import { Badge } from "@lapismd/design-core/shadcn/badge";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as ContextMenu from "@lapismd/design-core/shadcn/context-menu";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import * as Empty from "@lapismd/design-core/shadcn/empty";
  import BellOffIcon from "@lucide/svelte/icons/bell-off";
  import CheckIcon from "@lucide/svelte/icons/check";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
  import MessagesSquareIcon from "@lucide/svelte/icons/messages-square";
  import StarIcon from "@lucide/svelte/icons/star";
  import TrashIcon from "@lucide/svelte/icons/trash-2";
  import type { Snippet } from "svelte";

  import type {
    CommunityCustomEmoji,
    CommunityTopicDraft,
  } from "../../community/index.js";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import CommunityMemberHoverCard from "../community-member-hover-card/CommunityMemberHoverCard.svelte";
  import CommunityTopicComposer from "../community-topic-composer/CommunityTopicComposer.svelte";
  import {
    memberById,
    type CommunityMemberModel,
    type CommunityTopicModel,
  } from "../community-workspace/model.js";

  let {
    title = "Forum",
    description = "",
    topics,
    members,
    rooms = [],
    communityEmojis = [],
    currentMemberId,
    onOpenTopic,
    onOpenProfile,
    onMessageMember,
    onWaveMember,
    onCreateTopic,
    onTopicAction,
    canDeleteTopic = () => true,
    actions,
    disabled = false,
    readOnlyReason = "Posting is unavailable",
    composerStatus,
    onRetryComposerStatus,
    onDismissComposerStatus,
    historyUpdating = false,
    embedded = false,
    showTopicActions = true,
    emptyState,
  }: {
    title?: string;
    description?: string;
    topics: CommunityTopicModel[];
    members: CommunityMemberModel[];
    rooms?: readonly import("../community-workspace/model.js").CommunityRoomModel[];
    communityEmojis?: readonly CommunityCustomEmoji[];
    currentMemberId?: string;
    onOpenTopic?: (topicId: string) => void;
    onOpenProfile?: (member: CommunityMemberModel) => void;
    onMessageMember?: (member: CommunityMemberModel) => void | Promise<void>;
    onWaveMember?: (member: CommunityMemberModel) => void | Promise<void>;
    onCreateTopic?: (draft: CommunityTopicDraft) => Promise<void>;
    onTopicAction?: (
      topicId: string,
      action: "copy-link" | "mark-read" | "star" | "mute" | "delete",
    ) => void | Promise<void>;
    canDeleteTopic?: (topic: CommunityTopicModel) => boolean;
    actions?: Snippet;
    disabled?: boolean;
    readOnlyReason?: string;
    composerStatus?: ComposerStatus;
    onRetryComposerStatus?: () => void | Promise<void>;
    onDismissComposerStatus?: () => void;
    historyUpdating?: boolean;
    embedded?: boolean;
    showTopicActions?: boolean;
    emptyState?: Snippet;
  } = $props();
</script>

{#snippet dropdownActions(topic: CommunityTopicModel)}
  <DropdownMenu.Group
    ><DropdownMenu.Item onSelect={() => onTopicAction?.(topic.id, "copy-link")}
      ><CopyIcon data-icon="inline-start" aria-hidden="true" />Copy link</DropdownMenu.Item
    ><DropdownMenu.Item onSelect={() => onTopicAction?.(topic.id, "mark-read")}
      ><CheckIcon data-icon="inline-start" aria-hidden="true" />Mark read</DropdownMenu.Item
    ><DropdownMenu.Item onSelect={() => onTopicAction?.(topic.id, "star")}
      ><StarIcon
        data-icon="inline-start"
        aria-hidden="true"
      />Star</DropdownMenu.Item
    ><DropdownMenu.Item onSelect={() => onTopicAction?.(topic.id, "mute")}
      ><BellOffIcon
        data-icon="inline-start"
        aria-hidden="true"
      />Mute</DropdownMenu.Item
    ></DropdownMenu.Group
  >{#if canDeleteTopic(topic)}<DropdownMenu.Separator /><DropdownMenu.Group
      ><DropdownMenu.Item
        variant="destructive"
        onSelect={() => onTopicAction?.(topic.id, "delete")}
        ><TrashIcon
          data-icon="inline-start"
          aria-hidden="true"
        />Delete</DropdownMenu.Item
      ></DropdownMenu.Group
    >{/if}
{/snippet}

{#snippet contextActions(topic: CommunityTopicModel)}
  <ContextMenu.Group
    ><ContextMenu.Item onSelect={() => onTopicAction?.(topic.id, "copy-link")}
      ><CopyIcon data-icon="inline-start" aria-hidden="true" />Copy link</ContextMenu.Item
    ><ContextMenu.Item onSelect={() => onTopicAction?.(topic.id, "mark-read")}
      ><CheckIcon data-icon="inline-start" aria-hidden="true" />Mark read</ContextMenu.Item
    ><ContextMenu.Item onSelect={() => onTopicAction?.(topic.id, "star")}
      ><StarIcon
        data-icon="inline-start"
        aria-hidden="true"
      />Star</ContextMenu.Item
    ><ContextMenu.Item onSelect={() => onTopicAction?.(topic.id, "mute")}
      ><BellOffIcon
        data-icon="inline-start"
        aria-hidden="true"
      />Mute</ContextMenu.Item
    ></ContextMenu.Group
  >{#if canDeleteTopic(topic)}<ContextMenu.Separator /><ContextMenu.Group
      ><ContextMenu.Item
        variant="destructive"
        onSelect={() => onTopicAction?.(topic.id, "delete")}
        ><TrashIcon
          data-icon="inline-start"
          aria-hidden="true"
        />Delete</ContextMenu.Item
      ></ContextMenu.Group
    >{/if}
{/snippet}

{#snippet topicButton(topic: CommunityTopicModel)}
  <Button
    type="button"
    variant="ghost"
    class="forum-topic-list__topic"
    aria-label={`Open ${topic.unread ? "unread " : topic.isNew ? "new " : ""}topic ${topic.title}`}
    onclick={() => onOpenTopic?.(topic.id)}
  ></Button>
{/snippet}

{#snippet topicContent(topic: CommunityTopicModel)}
  {@const author = memberById(members, topic.authorId)}
  {@const participants = topic.participantIds
    .slice(0, 3)
    .map((participantId) => memberById(members, participantId))}
  {@const replyCountAvailable = topic.replyCountAvailable ?? true}
  <span class="forum-topic-list__topic-main">
    <span class="forum-topic-list__title-row">
      {#if topic.unread}
        <span
          class="forum-topic-list__unread-marker"
          data-ui-part="forum-topic-unread-marker"
          role="img"
          aria-label="Unread topic"
        ></span>
      {/if}
      {#if topic.pinned}<span aria-label="Pinned topic">⌁</span>{/if}
      <strong>{topic.title}</strong>
      {#if topic.solved}<Badge variant="secondary">Solved</Badge>{/if}
      {#if !topic.unread && topic.isNew}<Badge variant="secondary">New</Badge
        >{/if}
    </span>
    <span class="forum-topic-list__excerpt">{topic.excerpt}</span>
    <span class="forum-topic-list__meta">
      <span>Started by</span>
      <span class="forum-topic-list__author">
        <CommunityMemberHoverCard
          member={author}
          trigger="mention"
          triggerLabel={author.name}
          {...onOpenProfile === undefined ? {} : { onOpenProfile }}
          {...onMessageMember === undefined
            ? {}
            : { onMessage: onMessageMember }}
          {...onWaveMember === undefined ? {} : { onWave: onWaveMember }}
        />
      </span>
      {#each topic.tags ?? [] as tag (tag)}
        <Badge variant="outline">{tag}</Badge>
      {/each}
    </span>
  </span>
  <span
    class="forum-topic-list__participants"
    data-ui-part="forum-topic-participants"
    title={participants.length
      ? `Recent participants: ${participants.map((participant) => participant.name).join(", ")}`
      : "No replies yet"}
    aria-hidden="true"
  >
    {#each participants as participant (participant.id)}
      <span class="forum-topic-list__avatar">
        <CommunityMemberAvatar member={participant} size="xsmall" decorative />
      </span>
    {/each}
  </span>
  <span
    class="forum-topic-list__count"
    aria-label={!replyCountAvailable
      ? "Reply count unavailable"
      : topic.replyCountApproximate
        ? `Approximately ${topic.replyCount} replies`
        : historyUpdating
          ? `${topic.replyCount} or more replies; older history is updating`
          : `${topic.replyCount} replies`}
    >{#if !replyCountAvailable}—{:else if topic.replyCountApproximate}~{/if}{replyCountAvailable
      ? topic.replyCount
      : ""}{replyCountAvailable && historyUpdating ? "+" : ""}</span
  >
  <span class="forum-topic-list__activity">{topic.lastActivityLabel}</span>
{/snippet}

<section
  class="forum-topic-list"
  class:forum-topic-list--embedded={embedded}
  aria-label={`${title} topics`}
>
  {#if actions}
    {@render actions()}
  {/if}

  {#if onCreateTopic}
    <CommunityTopicComposer
      forumName={title}
      {members}
      {rooms}
      {communityEmojis}
      {...currentMemberId === undefined ? {} : { currentMemberId }}
      onPublish={onCreateTopic}
      {disabled}
      disabledReason={readOnlyReason}
      {...composerStatus === undefined ? {} : { composerStatus }}
      {...onRetryComposerStatus === undefined ? {} : { onRetryComposerStatus }}
      {...onDismissComposerStatus === undefined
        ? {}
        : { onDismissComposerStatus }}
    />
  {/if}

  {#if topics.length === 0}
    {#if emptyState}
      {@render emptyState()}
    {:else}
      <Empty.Root class="forum-topic-list__empty">
        <Empty.Header>
          <Empty.Media variant="icon">
            <MessagesSquareIcon aria-hidden="true" />
          </Empty.Media>
          <Empty.Title role="heading" aria-level={2}>
            No active topics in {title}
          </Empty.Title>
          <Empty.Description>
            {description ||
              "Start a discussion or check back for new activity."}
          </Empty.Description>
        </Empty.Header>
      </Empty.Root>
    {/if}
  {:else}
    <div class="forum-topic-list__columns" aria-hidden="true">
      <span>Topic</span><span>Replies</span><span>Activity</span>
    </div>

    <div class="forum-topic-list__topics">
      {#each topics as topic (topic.id)}
        <div class="forum-topic-list__topic-row">
          {#if showTopicActions}
            <ContextMenu.Root
              ><ContextMenu.Trigger
                >{@render topicButton(topic)}</ContextMenu.Trigger
              ><ContextMenu.Content
                >{@render contextActions(topic)}</ContextMenu.Content
              ></ContextMenu.Root
            ><DropdownMenu.Root
              ><DropdownMenu.Trigger
                >{#snippet child({ props })}<Button
                    {...props}
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    class="forum-topic-list__menu"
                    aria-label={`Open ${topic.title} menu`}
                    ><EllipsisIcon aria-hidden="true" /></Button
                  >{/snippet}</DropdownMenu.Trigger
              ><DropdownMenu.Content align="end"
                >{@render dropdownActions(topic)}</DropdownMenu.Content
              ></DropdownMenu.Root
            >
          {:else}
            {@render topicButton(topic)}
          {/if}
          {@render topicContent(topic)}
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .forum-topic-list {
    width: min(100%, 68rem);
    margin: 0 auto;
    padding: clamp(1rem, 3vw, 2.5rem);
  }

  .forum-topic-list--embedded {
    width: 100%;
    padding: 0;
  }

  .forum-topic-list__columns,
  .forum-topic-list__topic-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 5rem 4.5rem 7rem;
    align-items: center;
    gap: 1rem;
  }

  .forum-topic-list__columns {
    margin-block-start: 1.25rem;
    border-block-end: 1px solid var(--border);
    padding: 0.55rem 0.75rem;
    color: var(--muted-foreground);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .forum-topic-list__columns span:first-child {
    grid-column: span 2;
  }

  .forum-topic-list__columns span:not(:first-child) {
    text-align: center;
  }

  .forum-topic-list__topics {
    display: grid;
  }

  :global(.forum-topic-list__empty) {
    align-items: start;
    justify-items: start;
    padding: clamp(2rem, 8vh, 5rem) 0.5rem;
    max-width: 36rem;
    text-align: start;
  }
  .forum-topic-list__topic-row {
    position: relative;
    min-width: 0;
    min-height: 5.25rem;
    border-block-end: 1px solid var(--border);
    padding: 1rem 0.75rem;
  }
  .forum-topic-list__topic-row
    > :global([data-ui-part="context-menu-trigger"]) {
    position: absolute;
    inset: 0;
  }
  :global(.forum-topic-list__menu[data-ui-component="button"]) {
    position: absolute;
    z-index: 2;
    inset-block-start: 0.75rem;
    inset-inline-end: 0.5rem;
    opacity: 0;
  }
  .forum-topic-list__topic-row:hover :global(.forum-topic-list__menu),
  .forum-topic-list__topic-row:focus-within :global(.forum-topic-list__menu) {
    opacity: 1;
  }

  :global(.forum-topic-list__topic[data-ui-component="button"]) {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    border: 0;
    border-radius: 0;
    background: transparent;
    cursor: pointer;
  }

  :global(.forum-topic-list__topic[data-ui-component="button"]:hover),
  :global(.forum-topic-list__topic[data-ui-component="button"]:focus-visible) {
    background: color-mix(in srgb, var(--foreground) 4%, transparent);
  }

  :global(.forum-topic-list__topic[data-ui-component="button"]:focus-visible) {
    outline: 2px solid var(--ring);
    outline-offset: -2px;
  }

  .forum-topic-list__topic-main {
    position: relative;
    z-index: 1;
    display: grid;
    min-width: 0;
    gap: 0.32rem;
    pointer-events: none;
  }

  .forum-topic-list__title-row,
  .forum-topic-list__meta {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
  }

  .forum-topic-list__title-row {
    position: relative;
  }

  .forum-topic-list__author {
    position: relative;
    z-index: 2;
    display: inline-flex;
    pointer-events: auto;
  }

  .forum-topic-list__unread-marker {
    position: absolute;
    inset-block-start: 0.72em;
    inset-inline-start: -0.65rem;
    width: 0.4rem;
    height: 0.4rem;
    border-radius: 999px;
    background: var(--primary);
    box-shadow: 0 0 0 0.16rem
      color-mix(in srgb, var(--primary) 16%, transparent);
    transform: translateY(-50%);
    pointer-events: none;
  }

  .forum-topic-list__title-row strong {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .forum-topic-list__excerpt,
  .forum-topic-list__meta,
  .forum-topic-list__activity {
    color: var(--muted-foreground);
    font-size: 0.78rem;
  }

  .forum-topic-list__excerpt {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .forum-topic-list__participants {
    position: relative;
    z-index: 1;
    display: flex;
    justify-content: flex-end;
    padding-inline-end: 0.2rem;
    pointer-events: none;
  }

  .forum-topic-list__avatar {
    display: block;
    margin-inline-end: -0.35rem;
    border-radius: 999px;
    outline: 2px solid var(--background);
  }

  .forum-topic-list__count,
  .forum-topic-list__activity {
    position: relative;
    z-index: 1;
    pointer-events: none;
    text-align: center;
  }

  @media (max-width: 44rem) {
    .forum-topic-list__columns {
      display: none;
    }

    .forum-topic-list__topic-row {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .forum-topic-list__activity {
      display: none;
    }

    .forum-topic-list__participants {
      display: none;
    }
  }
</style>
