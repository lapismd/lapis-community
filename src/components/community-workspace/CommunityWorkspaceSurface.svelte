<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import BotIcon from "@lucide/svelte/icons/bot";
  import HashIcon from "@lucide/svelte/icons/hash";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";

  import CommunityConversation from "../community-conversation/CommunityConversation.svelte";
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
  }: {
    model: CommunityWorkspaceModel;
    handlers?: CommunityWorkspaceHandlers;
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
    />
  {:else}
    <CommunityConversation
      room={activeRoom}
      messages={model.messages}
      members={model.members}
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
    >
      {#snippet intro()}
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
            <Button variant="outline">
              <HashIcon data-icon="inline-start" aria-hidden="true" />
              Browse channels
            </Button>
            <Button variant="outline">
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              Create a channel
            </Button>
            <Button variant="outline">
              <BotIcon data-icon="inline-start" aria-hidden="true" />
              Create an agent
            </Button>
          </div>
        </section>
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
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding-block-start: 0.5rem;
  }

  .community-workspace-surface__actions :global([data-ui-component="button"]) {
    border-radius: 999px;
  }
</style>
