<script lang="ts">
  import { Badge } from "@lapismd/design-core/shadcn/badge";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as ContextMenu from "@lapismd/design-core/shadcn/context-menu";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import BellOffIcon from "@lucide/svelte/icons/bell-off";
  import CheckIcon from "@lucide/svelte/icons/check";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
  import StarIcon from "@lucide/svelte/icons/star";
  import TrashIcon from "@lucide/svelte/icons/trash-2";
  import type { Snippet } from "svelte";

  import type { CommunityTopicDraft } from "../../community/index.js";
  import CommunityTopicComposer from "../community-topic-composer/CommunityTopicComposer.svelte";
  import {
    memberById,
    type CommunityMemberModel,
    type CommunityTopicModel,
  } from "../community-workspace/model.js";

  let {
    title = "Forum",
    description = "Long-form community discussions",
    topics,
    members,
    onOpenTopic,
    onCreateTopic,
    onTopicAction,
    canDeleteTopic = () => true,
    actions,
    disabled = false,
    readOnlyReason = "Posting is unavailable",
  }: {
    title?: string;
    description?: string;
    topics: CommunityTopicModel[];
    members: CommunityMemberModel[];
    onOpenTopic?: (topicId: string) => void;
    onCreateTopic?: (draft: CommunityTopicDraft) => Promise<void>;
    onTopicAction?: (
      topicId: string,
      action: "copy-link" | "mark-read" | "star" | "mute" | "delete",
    ) => void | Promise<void>;
    canDeleteTopic?: (topic: CommunityTopicModel) => boolean;
    actions?: Snippet;
    disabled?: boolean;
    readOnlyReason?: string;
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

<section class="forum-topic-list" aria-labelledby="forum-topic-list-title">
  <header>
    <div>
      <h1 id="forum-topic-list-title">{title}</h1>
      <p>{description}</p>
    </div>
  </header>

  {#if actions}
    {@render actions()}
  {/if}

  {#if onCreateTopic}
    <CommunityTopicComposer
      forumName={title}
      onPublish={onCreateTopic}
      {disabled}
      disabledReason={readOnlyReason}
    />
  {/if}

  <div class="forum-topic-list__columns" aria-hidden="true">
    <span>Topic</span><span>Replies</span><span>Activity</span>
  </div>

  <div class="forum-topic-list__topics">
    {#each topics as topic (topic.id)}
      {@const author = memberById(members, topic.authorId)}
      {@const participants = topic.participantIds
        .slice(0, 3)
        .map((participantId) => memberById(members, participantId))}
      <div class="forum-topic-list__topic-row">
        <ContextMenu.Root
          ><ContextMenu.Trigger
            ><Button
              type="button"
              variant="ghost"
              class="forum-topic-list__topic"
              aria-label={`Open topic ${topic.title}`}
              onclick={() => onOpenTopic?.(topic.id)}
            >
              <span class="forum-topic-list__topic-main">
                <span class="forum-topic-list__title-row">
                  {#if topic.pinned}<span aria-label="Pinned topic">⌁</span
                    >{/if}
                  <strong>{topic.title}</strong>
                  {#if topic.solved}<Badge variant="secondary">Solved</Badge
                    >{/if}
                </span>
                <span class="forum-topic-list__excerpt">{topic.excerpt}</span>
                <span class="forum-topic-list__meta">
                  Started by {author.name}
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
                    {#if participant.avatarUrl}
                      <img src={participant.avatarUrl} alt="" />
                    {:else}
                      {participant.initials}
                    {/if}
                  </span>
                {/each}
              </span>
              <span class="forum-topic-list__count">{topic.replyCount}</span>
              <span class="forum-topic-list__activity"
                >{topic.lastActivityLabel}</span
              >
            </Button></ContextMenu.Trigger
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
      </div>
    {/each}
  </div>
</section>

<style>
  .forum-topic-list {
    width: min(100%, 68rem);
    margin: 0 auto;
    padding: clamp(1rem, 3vw, 2.5rem);
  }

  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding-block-end: 1rem;
  }

  h1,
  p {
    margin: 0;
  }

  h1 {
    font-size: clamp(1.35rem, 2vw, 1.75rem);
  }

  header p {
    margin-block-start: 0.35rem;
    color: var(--muted-foreground);
  }

  .forum-topic-list__columns,
  :global(.forum-topic-list__topic[data-ui-component="button"]) {
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
  .forum-topic-list__topic-row {
    position: relative;
    display: flex;
    min-width: 0;
  }
  .forum-topic-list__topic-row
    > :global([data-ui-part="context-menu-trigger"]) {
    min-width: 0;
    flex: 1;
  }
  :global(.forum-topic-list__menu[data-ui-component="button"]) {
    position: absolute;
    inset-block-start: 0.75rem;
    inset-inline-end: 0.5rem;
    opacity: 0;
  }
  .forum-topic-list__topic-row:hover :global(.forum-topic-list__menu),
  .forum-topic-list__topic-row:focus-within :global(.forum-topic-list__menu) {
    opacity: 1;
  }

  :global(.forum-topic-list__topic[data-ui-component="button"]) {
    width: 100%;
    height: auto;
    min-height: 5.25rem;
    border: 0;
    border-block-end: 1px solid var(--border);
    padding: 1rem 0.75rem;
    color: var(--foreground);
    background: transparent;
    font: inherit;
    text-align: start;
    white-space: normal;
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
    display: grid;
    min-width: 0;
    gap: 0.32rem;
  }

  .forum-topic-list__title-row,
  .forum-topic-list__meta {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
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
    display: flex;
    justify-content: flex-end;
    padding-inline-end: 0.2rem;
  }

  .forum-topic-list__avatar {
    display: grid;
    width: 1.7rem;
    height: 1.7rem;
    place-items: center;
    overflow: hidden;
    margin-inline-end: -0.35rem;
    border: 2px solid var(--background);
    border-radius: 999px;
    color: var(--primary-foreground);
    background: var(--primary);
    font-size: 0.55rem;
    font-weight: 750;
  }

  .forum-topic-list__avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .forum-topic-list__count,
  .forum-topic-list__activity {
    text-align: center;
  }

  @media (max-width: 44rem) {
    .forum-topic-list__columns {
      display: none;
    }

    :global(.forum-topic-list__topic[data-ui-component="button"]) {
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
