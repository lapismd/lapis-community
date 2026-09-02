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

  const isSelected = $derived(
    message.reactions?.some((reaction) => reaction.selected) ?? false,
  );
</script>

<Message
  sender="assistant"
  {density}
  class="community-message"
  data-selected={isSelected ? "" : undefined}
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

  {#if onAddReaction}
    <ReactionBar
      reactions={message.reactions ?? []}
      label={`Reactions to ${author.name}'s message`}
      onToggle={(emoji) => onToggleReaction?.(message.id, emoji)}
      onAdd={(emoji) => onAddReaction(message.id, emoji)}
    />
  {:else if message.reactions?.length}
    <ReactionBar
      reactions={message.reactions}
      label={`Reactions to ${author.name}'s message`}
      onToggle={(emoji) => onToggleReaction?.(message.id, emoji)}
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

  .community-message__avatar {
    display: grid;
    width: 2.25rem;
    height: 2.25rem;
    place-items: center;
    overflow: hidden;
    border-radius: 50%;
    color: var(--primary-foreground);
    background: var(--primary);
    font-size: 0.72rem;
    font-weight: 750;
  }

  .community-message__avatar :global(img) {
    border-radius: inherit;
  }

  :global(
      .community-message
        [data-ui-component="ai-chat-message-bubble"][data-variant="ghost"]
    ) {
    padding-inline: 0;
  }

  :global(
      .community-message
        [data-ui-component="ai-chat-reaction-bar"]
        [data-ui-component="ai-chat-emoji-picker"]
        [data-ui-component="button"]
    ) {
    opacity: 0;
    background: transparent;
    transition:
      opacity 120ms ease,
      background-color 120ms ease;
  }

  :global(
      .community-message:hover
        [data-ui-component="ai-chat-reaction-bar"]
        [data-ui-component="ai-chat-emoji-picker"]
        [data-ui-component="button"]
    ),
  :global(
      .community-message:focus-within
        [data-ui-component="ai-chat-reaction-bar"]
        [data-ui-component="ai-chat-emoji-picker"]
        [data-ui-component="button"]
    ),
  :global(
      .community-message[data-selected]
        [data-ui-component="ai-chat-reaction-bar"]
        [data-ui-component="ai-chat-emoji-picker"]
        [data-ui-component="button"]
    ) {
    opacity: 1;
  }

  :global(
      .community-message
        [data-ui-component="ai-chat-reaction-bar"]
        [data-ui-component="ai-chat-emoji-picker"]
        [data-ui-component="button"]:hover
    ) {
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
