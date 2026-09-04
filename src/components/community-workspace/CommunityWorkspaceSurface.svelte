<script lang="ts">
  import type { ComposerStatus } from "@lapismd/design-core/ai/chat";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import HashIcon from "@lucide/svelte/icons/hash";
  import LogInIcon from "@lucide/svelte/icons/log-in";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";

  import CommunityConversation from "../community-conversation/CommunityConversation.svelte";
  import type {
    CommunityCustomEmoji,
    CommunityOperationState,
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
    readOnlyReason = "Reconnect to send messages",
    operation,
    onRetryOperation,
    onDismissOperation,
    showJoinAction = false,
  }: {
    model: CommunityWorkspaceModel;
    handlers?: CommunityWorkspaceHandlers;
    replyTarget?: CommunityReplyTarget;
    communityEmojis?: readonly CommunityCustomEmoji[];
    readOnly?: boolean;
    readOnlyReason?: string;
    operation?: CommunityOperationState;
    onRetryOperation?: () => void | Promise<void>;
    onDismissOperation?: () => void;
    showJoinAction?: boolean;
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
  const rooms = $derived(
    model.navigationSections.flatMap((section) => section.rooms),
  );
  const activeDirectMember = $derived(
    activeRoom.kind === "direct"
      ? (activeRoom.participantIds
          ?.filter((id) => id !== model.currentMemberId)
          .map((id) => model.members.find((member) => member.id === id))
          .find((member) => member !== undefined) ??
          model.members.find((member) => member.name === activeRoom.name))
      : undefined,
  );
  const roomJoinActionVisible = $derived(
    showJoinAction &&
      handlers.onJoinRoom !== undefined &&
      activeRoom.kind !== "direct",
  );
  const roomJoinActionPending = $derived(operation?.status === "pending");
  const roomJoinActionAccepted = $derived(operation?.status === "accepted");
  const composerStatus = $derived<ComposerStatus | undefined>(
    operation?.status === "failed"
      ? {
          type: "error",
          message:
            operation.message ??
            operation.failure?.message ??
            "Action did not complete",
        }
      : operation?.status === "accepted"
        ? {
            type: "warning",
            message: operation.message ?? "Accepted by relay, still syncing",
          }
        : readOnly
          ? { type: "warning", message: readOnlyReason }
          : undefined,
  );
  const retryComposerOperation = $derived(
    operation?.status === "failed" && operation.failure?.retryable
      ? onRetryOperation
      : undefined,
  );
  const dismissComposerOperation = $derived(
    operation !== undefined && operation.status !== "idle"
      ? onDismissOperation
      : undefined,
  );
</script>

{#snippet roomJoinAction()}
  <Button
    type="button"
    variant="outline"
    class="community-workspace-surface__action-card"
    disabled={roomJoinActionPending || roomJoinActionAccepted}
    onclick={() => handlers.onJoinRoom?.(activeRoom.id)}
  >
    <span class="community-workspace-surface__action-icon">
      <LogInIcon aria-hidden="true" />
    </span>
    <strong>
      {roomJoinActionAccepted
        ? "Join requested"
        : roomJoinActionPending
          ? `Joining ${activeRoom.kind === "forum" ? "Forum" : "Channel"}…`
          : `Join ${activeRoom.kind === "forum" ? "Forum" : "Channel"}`}
    </strong>
  </Button>
{/snippet}

{#snippet forumJoinAction()}
  <div
    class="community-workspace-surface__actions community-workspace-surface__forum-actions"
  >
    {@render roomJoinAction()}
  </div>
{/snippet}

<div class="community-workspace-surface" data-view={model.view}>
  {#if model.view === "forum-index"}
    <ForumTopicList
      title={activeRoom.name}
      topics={model.topics}
      members={model.members}
      {rooms}
      {communityEmojis}
      {...model.currentMemberId === undefined
        ? {}
        : { currentMemberId: model.currentMemberId }}
      {...handlers.onOpenTopic === undefined
        ? {}
        : { onOpenTopic: handlers.onOpenTopic }}
      {...handlers.onCreateTopic === undefined
        ? {}
        : {
            onCreateTopic: (draft) =>
              Promise.resolve(handlers.onCreateTopic?.(activeRoom.id, draft)),
          }}
      disabled={readOnly}
      {readOnlyReason}
      {...composerStatus === undefined ? {} : { composerStatus }}
      {...retryComposerOperation === undefined
        ? {}
        : { onRetryComposerStatus: retryComposerOperation }}
      {...dismissComposerOperation === undefined
        ? {}
        : { onDismissComposerStatus: dismissComposerOperation }}
      {...roomJoinActionVisible ? { actions: forumJoinAction } : {}}
      canDeleteTopic={(topic) =>
        topic.authorId === model.currentMemberId ||
        activeRoom.permissions?.delete.state === "enabled"}
      {...handlers.onTopicAction === undefined
        ? {}
        : { onTopicAction: handlers.onTopicAction }}
    />
  {:else}
    <CommunityConversation
      room={activeRoom}
      messages={model.messages}
      members={model.members}
      {rooms}
      {...activeDirectMember === undefined
        ? {}
        : { directMember: activeDirectMember }}
      {...replyTarget === undefined ? {} : { replyTarget }}
      {communityEmojis}
      disabled={readOnly}
      disabledReason={readOnlyReason}
      {...composerStatus === undefined ? {} : { composerStatus }}
      {...retryComposerOperation === undefined
        ? {}
        : { onRetryComposerStatus: retryComposerOperation }}
      {...dismissComposerOperation === undefined
        ? {}
        : { onDismissComposerStatus: dismissComposerOperation }}
      restrictMessageManagement
      {...model.currentMemberId === undefined
        ? {}
        : { currentMemberId: model.currentMemberId }}
      canDeleteAny={activeRoom.permissions?.delete.state === "enabled"}
      {...handlers.onClearReplyTarget === undefined
        ? {}
        : { onCancelReply: handlers.onClearReplyTarget }}
      composerPlacement="row"
      onSend={(content) => handlers.onSendMessage?.(activeRoom.id, content)}
      {...handlers.onReply === undefined ? {} : { onReply: handlers.onReply }}
      {...handlers.onOpenThread === undefined || activeRoom.kind === "forum"
        ? {}
        : { onOpenThread: handlers.onOpenThread }}
      replyActionLabel={activeRoom.kind === "forum"
        ? "Reply"
        : "Reply in thread"}
      {...readOnly || handlers.onToggleReaction === undefined
        ? {}
        : { onToggleReaction: handlers.onToggleReaction }}
      {...readOnly || handlers.onAddReaction === undefined
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
      {...handlers.onOpenProfile === undefined
        ? {}
        : { onOpenProfile: handlers.onOpenProfile }}
      {...handlers.onSelectRoom === undefined
        ? {}
        : { onOpenRoom: handlers.onSelectRoom }}
      {...handlers.onMessageMember === undefined
        ? {}
        : { onMessageMember: handlers.onMessageMember }}
      {...handlers.onViewMemberActivity === undefined
        ? {}
        : { onViewMemberActivity: handlers.onViewMemberActivity }}
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
              {#if roomJoinActionVisible}
                {@render roomJoinAction()}
              {/if}
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
              {#if handlers.onCreateRoom}
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
              {/if}
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
    flex-direction: column;
    width: 100%;
    min-width: 0;
    height: 100%;
    min-height: 0;
  }

  .community-workspace-surface > :global(.forum-topic-list),
  .community-workspace-surface > :global(.community-conversation) {
    flex: 1;
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
    width: min(100%, 27rem);
    grid-template-columns: repeat(2, minmax(0, 13.125rem));
    gap: 0.75rem;
    padding-block-start: 0.5rem;
  }

  .community-workspace-surface__actions:has(> :nth-child(3)) {
    width: min(100%, 40.875rem);
    grid-template-columns: repeat(3, minmax(0, 13.125rem));
  }

  .community-workspace-surface__forum-actions {
    padding-block: 0 1.25rem;
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
  :global(
      .community-workspace-surface__action-card[data-ui-component="button"]:hover
    )
    .community-workspace-surface__action-icon,
  :global(
      .community-workspace-surface__action-card[data-ui-component="button"]:focus-visible
    )
    .community-workspace-surface__action-icon {
    color: var(--primary);
    background: color-mix(in srgb, var(--primary) 14%, var(--background));
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
      width: 100%;
      grid-template-columns: 1fr;
    }
  }
</style>
