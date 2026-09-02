<script lang="ts">
  import { Badge } from "@lapismd/design-core/shadcn/badge";
  import { Button } from "@lapismd/design-core/shadcn/button";

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
  }: {
    title?: string;
    description?: string;
    topics: CommunityTopicModel[];
    members: CommunityMemberModel[];
    onOpenTopic?: (topicId: string) => void;
  } = $props();
</script>

<section class="forum-topic-list" aria-labelledby="forum-topic-list-title">
  <header>
    <div>
      <h1 id="forum-topic-list-title">{title}</h1>
      <p>{description}</p>
    </div>
    <Button type="button" size="sm">New topic</Button>
  </header>

  <div class="forum-topic-list__columns" aria-hidden="true">
    <span>Topic</span><span>Replies</span><span>Activity</span>
  </div>

  <div class="forum-topic-list__topics">
    {#each topics as topic (topic.id)}
      {@const author = memberById(members, topic.authorId)}
      <Button
        type="button"
        variant="ghost"
        class="forum-topic-list__topic"
        aria-label={`Open topic ${topic.title}`}
        onclick={() => onOpenTopic?.(topic.id)}
      >
        <span class="forum-topic-list__topic-main">
          <span class="forum-topic-list__title-row">
            {#if topic.pinned}<span aria-label="Pinned topic">⌁</span>{/if}
            <strong>{topic.title}</strong>
            {#if topic.solved}<Badge variant="secondary">Solved</Badge>{/if}
          </span>
          <span class="forum-topic-list__excerpt">{topic.excerpt}</span>
          <span class="forum-topic-list__meta">
            Started by {author.name}
            {#each topic.tags ?? [] as tag (tag)}
              <Badge variant="outline">{tag}</Badge>
            {/each}
          </span>
        </span>
        <span class="forum-topic-list__count">{topic.replyCount}</span>
        <span class="forum-topic-list__activity">{topic.lastActivityLabel}</span
        >
      </Button>
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
    padding-block-end: 1.4rem;
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
    grid-template-columns: minmax(0, 1fr) 5rem 7rem;
    align-items: center;
    gap: 1rem;
  }

  .forum-topic-list__columns {
    border-block-end: 1px solid var(--border);
    padding: 0.55rem 0.75rem;
    color: var(--muted-foreground);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .forum-topic-list__columns span:not(:first-child) {
    text-align: center;
  }

  .forum-topic-list__topics {
    display: grid;
  }

  :global(.forum-topic-list__topic[data-ui-component="button"]) {
    border: 0;
    border-block-end: 1px solid var(--border);
    padding: 1rem 0.75rem;
    color: var(--foreground);
    background: transparent;
    font: inherit;
    text-align: start;
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
  }
</style>
