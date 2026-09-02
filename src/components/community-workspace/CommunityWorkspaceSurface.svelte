<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import HashIcon from "@lucide/svelte/icons/hash";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";

  import CommunityConversation from "../community-conversation/CommunityConversation.svelte";
  import type {
    CommunityCustomEmoji,
    CommunityReplyTarget,
  } from "../../community/index.js";
  import ForumTopicList from "../forum-topic-list/ForumTopicList.svelte";
  import {
    findCommunityRoom,
    type CommunityRoomModel,
    type CommunityWorkspaceHandlers,
    type CommunityWorkspaceModel,
  } from "./model.js";

  let {
    model,
    handlers = {},
    replyTarget,
    communityEmojis = [],
    readOnly = false,
  }: {
    model: CommunityWorkspaceModel;
    handlers?: CommunityWorkspaceHandlers;
    replyTarget?: CommunityReplyTarget;
    communityEmojis?: readonly CommunityCustomEmoji[];
    readOnly?: boolean;
  } = $props();

  const activeRoom = $derived(
    findCommunityRoom(model) ??
      ({
        id: model.activeRoomId,
        name: "Community",
        kind: "channel",
        description: "Community conversation",
      } satisfies CommunityRoomModel),
  );
</script>

<div class="community-workspace-surface" data-view={model.view}>
  {#if model.view === "forum-index"}
    <ForumTopicList
      title={activeRoom.name}
      description={activeRoom.description ?? "Long-form community discussions"}
      topics={model.topics}
      members={model.members}
      {...handlers.onOpenTopic === undefined
        ? {}
        : { onOpenTopic: handlers.onOpenTopic }}
      onCreateTopic={() => handlers.onCreateTopic?.(activeRoom.id)}
      {...handlers.onTopicAction === undefined
        ? {}
        : { onTopicAction: handlers.onTopicAction }}
    />
  {:else}
    <CommunityConversation
      room={activeRoom}
      messages={model.messages}
      members={model.members}
      {...replyTarget === undefined ? {} : { replyTarget }}
      {communityEmojis}
      disabled={readOnly}
      disabledReason="Reconnect to send messages"
      {...handlers.onClearReplyTarget === undefined
        ? {}
        : { onCancelReply: handlers.onClearReplyTarget }}
      composerPlacement="row"
      onSend={(content) => handlers.onSendMessage?.(activeRoom.id, content)}
      {...handlers.onOpenThread === undefined
        ? {}
        : { onOpenThread: handlers.onOpenThread }}
      {...handlers.onToggleReaction === undefined
        ? {}
        : { onToggleReaction: handlers.onToggleReaction }}
      {...handlers.onAddReaction === undefined
        ? {}
        : { onAddReaction: handlers.onAddReaction }}
      {...handlers.onCopyMessageLink === undefined
        ? {}
        : { onCopyMessageLink: handlers.onCopyMessageLink }}
      {...handlers.onCopyMessage === undefined
        ? {}
        : { onCopyMessage: handlers.onCopyMessage }}
      {...handlers.onEditMessage === undefined
        ? {}
        : { onEditMessage: handlers.onEditMessage }}
      {...handlers.onDeleteMessage === undefined
        ? {}
        : { onDeleteMessage: handlers.onDeleteMessage }}
    >
      {#snippet intro()}
        {#if model.view === "forum-thread"}
          <div class="community-workspace-surface__forum-back">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onclick={() => handlers.onSelectRoom?.(activeRoom.id)}
            >
              <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
              Back to posts
            </Button>
          </div>
        {:else}
          <section class="community-workspace-surface__intro">
            <span class="community-workspace-surface__image" aria-hidden="true">
              <SparklesIcon />
            </span>
            <h1>#{activeRoom.name}</h1>
            <p>
              This is the beginning of the {activeRoom.private
                ? "private "
                : ""}{activeRoom.name} channel.
            </p>
            <div class="community-workspace-surface__actions">
              <Button
                variant="outline"
                class="community-workspace-surface__action-card"
                onclick={() => handlers.onBrowseRooms?.("channel")}
              >
                <span class="community-workspace-surface__action-icon">
                  <HashIcon aria-hidden="true" />
                </span>
                <strong>Browse channels</strong>
              </Button>
              <Button
                variant="outline"
                class="community-workspace-surface__action-card"
                onclick={() => handlers.onCreateRoom?.("channel")}
              >
                <span class="community-workspace-surface__action-icon">
                  <PlusIcon aria-hidden="true" />
                </span>
                <strong>Create a channel</strong>
              </Button>
              {#if handlers.onCreateAgent}
                <Button
                  variant="outline"
                  class="community-workspace-surface__action-card"
                  onclick={() => handlers.onCreateAgent?.(activeRoom.id)}
                >
                  <span class="community-workspace-surface__action-icon">
                    <SparklesIcon aria-hidden="true" />
                  </span>
                  <strong>Create an agent</strong>
                </Button>
              {/if}
            </div>
          </section>
        {/if}
      {/snippet}
    </CommunityConversation>
  {/if}
</div>

<style>
  .community-workspace-surface {
    display: flex;
    width: 100%;
    min-width: 0;
    height: 100%;
    min-height: 0;
  }

  .community-workspace-surface__intro {
    display: grid;
    gap: 0.5rem;
    padding: 1.5rem 0.5rem 1rem;
  }

  .community-workspace-surface__forum-back {
    padding: 0.75rem 0.5rem 0.25rem;
  }

  .community-workspace-surface__intro h1,
  .community-workspace-surface__intro p {
    margin: 0;
  }

  .community-workspace-surface__intro h1 {
    font-size: 1.4rem;
  }

  .community-workspace-surface__intro p {
    max-width: 44rem;
    color: var(--muted-foreground);
  }

  .community-workspace-surface__image {
    display: grid;
    width: 3rem;
    height: 3rem;
    place-items: center;
    border: 1px solid var(--border);
    border-radius: 0.85rem;
    color: var(--primary);
    background: color-mix(in srgb, var(--primary) 10%, transparent);
  }

  .community-workspace-surface__image :global(svg) {
    width: 1.4rem;
    height: 1.4rem;
  }

  .community-workspace-surface__actions {
    display: grid;
    width: min(100%, 40rem);
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
    padding-block-start: 0.5rem;
  }

  .community-workspace-surface__actions:has(> :nth-child(3)) {
    width: min(100%, 56rem);
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  :global(
      .community-workspace-surface__action-card[data-ui-component="button"]
    ) {
    display: grid;
    height: 7.5rem;
    align-content: space-between;
    justify-items: start;
    padding: 1rem;
    border-radius: 1rem;
    text-align: start;
    white-space: normal;
  }

  .community-workspace-surface__action-icon {
    display: grid;
    width: 2.6rem;
    height: 2.6rem;
    place-items: center;
    border-radius: 50%;
    color: var(--foreground);
    background: var(--muted);
  }

  .community-workspace-surface__action-icon :global(svg) {
    width: 1.15rem;
    height: 1.15rem;
  }

  @media (max-width: 34rem) {
    .community-workspace-surface__actions {
      grid-template-columns: 1fr;
    }
  }
</style>
