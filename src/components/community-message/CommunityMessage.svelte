<script lang="ts">
  import {
    Message,
    MessageBubble,
    MessageMetadata,
  } from "@lapismd/design-core/ai/chat";
  import { ReactionBar } from "@lapismd/design-core/ai/experimental";
  import { Button } from "@lapismd/design-core/shadcn/button";

  import type {
    CommunityMemberModel,
    CommunityMessageModel,
  } from "../community-workspace/model.js";

  let {
    message,
    author,
    density = "compact",
    onOpenThread,
    onToggleReaction,
    onAddReaction,
  }: {
    message: CommunityMessageModel;
    author: CommunityMemberModel;
    density?: "compact" | "balanced" | "spacious";
    onOpenThread?: (messageId: string) => void;
    onToggleReaction?: (messageId: string, emoji: string) => void;
    onAddReaction?: (messageId: string, emoji: string) => void;
  } = $props();
</script>

<Message
  sender="assistant"
  {density}
  class="community-message"
  aria-label={`Message from ${author.name}`}
>
  {#snippet avatar()}
    <span class="community-message__avatar" aria-hidden="true"
      >{author.initials}</span
    >
  {/snippet}
  {#snippet name()}
    <span class="community-message__author">{author.name}</span>
    {#if author.role}
      <span class="community-message__role">{author.role}</span>
    {/if}
  {/snippet}

  <MessageBubble variant="ghost" {density}>
    <p class="community-message__content">{message.content}</p>
  </MessageBubble>

  {#if message.reactions?.length && onToggleReaction && onAddReaction}
    <ReactionBar
      reactions={message.reactions}
      label={`Reactions to ${author.name}'s message`}
      onToggle={(emoji) => onToggleReaction(message.id, emoji)}
      onAdd={(emoji) => onAddReaction(message.id, emoji)}
    />
  {:else if message.reactions?.length && onToggleReaction}
    <ReactionBar
      reactions={message.reactions}
      label={`Reactions to ${author.name}'s message`}
      onToggle={(emoji) => onToggleReaction(message.id, emoji)}
    />
  {:else if message.reactions?.length}
    <ReactionBar
      reactions={message.reactions}
      label={`Reactions to ${author.name}'s message`}
    />
  {/if}

  {#snippet metadata()}
    <div class="community-message__metadata">
      <MessageMetadata timestamp={message.timestamp} />
      {#if message.edited}<span>edited</span>{/if}
      {#if message.replyCount || onOpenThread}
        <Button
          type="button"
          variant="link"
          size="xs"
          onclick={() => onOpenThread?.(message.id)}
        >
          {message.replyLabel ??
            `${message.replyCount ?? 0} ${(message.replyCount ?? 0) === 1 ? "reply" : "replies"}`}
        </Button>
      {/if}
    </div>
  {/snippet}
</Message>

<style>
  :global(.community-message) {
    border-radius: var(--radius);
    padding-block: 0.2rem;
  }

  :global(.community-message:hover) {
    background: color-mix(in srgb, var(--foreground) 4%, transparent);
  }

  .community-message__avatar {
    display: grid;
    width: 2.25rem;
    height: 2.25rem;
    place-items: center;
    border-radius: 0.7rem;
    color: var(--primary-foreground);
    background: var(--primary);
    font-size: 0.72rem;
    font-weight: 750;
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
    min-height: 1.4rem;
    align-items: center;
    gap: 0.4rem;
    color: var(--muted-foreground);
    font-size: 0.72rem;
  }

  .community-message__metadata :global([data-ui-component="button"]) {
    height: auto;
    padding: 0;
  }
</style>
