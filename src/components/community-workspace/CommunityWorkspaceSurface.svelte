<script lang="ts">
  import type { ComposerStatus } from "@lapismd/design-core/ai/chat";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { Skeleton } from "@lapismd/design-core/shadcn/skeleton";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import HashIcon from "@lucide/svelte/icons/hash";
  import LogInIcon from "@lucide/svelte/icons/log-in";
  import MessagesSquareIcon from "@lucide/svelte/icons/messages-square";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";
  import type { Snippet } from "svelte";

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
    historyUpdating = false,
    historyLoading = false,
    messageSupplement,
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
    historyUpdating?: boolean;
    historyLoading?: boolean;
    messageSupplement?: Snippet<[import("./model.js").CommunityMessageModel]>;
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
  const knownNonmember = $derived(
    activeRoom.kind !== "direct" && activeRoom.membership === "not-joined",
  );
  const surfaceReadOnly = $derived(readOnly || knownNonmember);
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

{#snippet roomMembershipFooter()}
  <footer
    class="community-workspace-surface__membership"
    data-ui-part="room-membership"
    aria-label="Room membership"
  >
    <span class="community-workspace-surface__membership-label">
      {#if activeRoom.kind === "forum"}
        <MessagesSquareIcon aria-hidden="true" />
      {:else}
        <HashIcon aria-hidden="true" />
      {/if}
      <span>
        Viewing <strong
          >{activeRoom.kind === "channel" ? "#" : ""}{activeRoom.name}</strong
        >
      </span>
    </span>
    {#if roomJoinActionVisible}
      <Button
        type="button"
        size="sm"
        disabled={roomJoinActionPending || roomJoinActionAccepted}
        onclick={() => handlers.onJoinRoom?.(activeRoom.id)}
      >
        <LogInIcon data-icon="inline-start" aria-hidden="true" />
        {roomJoinActionAccepted
          ? "Join requested"
          : roomJoinActionPending
            ? "Joining…"
            : "Join to participate"}
      </Button>
    {/if}
  </footer>
{/snippet}

{#snippet roomIntro(kind: "channel" | "forum")}
  <section class="community-workspace-surface__intro">
    <span class="community-workspace-surface__image" aria-hidden="true">
      {#if kind === "forum"}
        <MessagesSquareIcon />
      {:else}
        <SparklesIcon />
      {/if}
    </span>
    <h1>{kind === "channel" ? "#" : ""}{activeRoom.name}</h1>
    {#if kind === "forum"}
      <p>This forum has no active topics yet.</p>
      <p>Start a discussion or browse another forum.</p>
    {:else}
      <p>
        This is the beginning of the {activeRoom.private
          ? "private"
          : "regular"} channel.
      </p>
      <p>Say hi, ask a question, or share what brought you here.</p>
    {/if}
    <div class="community-workspace-surface__actions">
      {#if knownNonmember && roomJoinActionVisible}
        <Button
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
                ? "Joining…"
                : `Join ${kind}`}
          </strong>
        </Button>
      {/if}
      {#if handlers.onBrowseRooms}
        <Button
          variant="outline"
          class="community-workspace-surface__action-card"
          onclick={() => handlers.onBrowseRooms?.(kind)}
        >
          <span class="community-workspace-surface__action-icon">
            {#if kind === "forum"}
              <MessagesSquareIcon aria-hidden="true" />
            {:else}
              <HashIcon aria-hidden="true" />
            {/if}
          </span>
          <strong>Browse {kind === "forum" ? "forums" : "channels"}</strong>
        </Button>
      {/if}
      {#if handlers.onCreateRoom}
        <Button
          variant="outline"
          class="community-workspace-surface__action-card"
          onclick={() => handlers.onCreateRoom?.(kind)}
        >
          <span class="community-workspace-surface__action-icon">
            <PlusIcon aria-hidden="true" />
          </span>
          <strong>Create a {kind}</strong>
        </Button>
      {/if}
    </div>
  </section>
{/snippet}

<div class="community-workspace-surface" data-view={model.view}>
  {#if historyLoading}
    <div
      class="community-workspace-surface__history-skeleton"
      role="status"
      aria-label={activeRoom.kind === "forum"
        ? "Loading forum topics"
        : "Loading channel messages"}
      data-kind={activeRoom.kind === "forum" ? "forum" : "channel"}
    >
      {#if activeRoom.kind === "forum"}
        <div class="community-workspace-surface__forum-skeleton-heading">
          <div>
            <Skeleton
              class="community-workspace-surface__forum-skeleton-title"
            />
            <Skeleton
              class="community-workspace-surface__forum-skeleton-description"
            />
          </div>
          <Skeleton
            class="community-workspace-surface__forum-skeleton-action"
          />
        </div>
        <div class="community-workspace-surface__forum-skeleton-table">
          <div class="community-workspace-surface__forum-skeleton-columns">
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </div>
          {#each Array(4) as _, index (index)}
            <div class="community-workspace-surface__forum-skeleton-row">
              <div>
                <Skeleton
                  class="community-workspace-surface__forum-skeleton-topic"
                />
                <Skeleton
                  class="community-workspace-surface__forum-skeleton-excerpt"
                />
                <Skeleton
                  class="community-workspace-surface__forum-skeleton-meta"
                />
              </div>
              <Skeleton
                class="community-workspace-surface__forum-skeleton-count"
              />
              <Skeleton
                class="community-workspace-surface__forum-skeleton-activity"
              />
            </div>
          {/each}
        </div>
      {:else}
        <div class="community-workspace-surface__channel-skeleton-rows">
          {#each Array(5) as _, index (index)}
            <div class="community-workspace-surface__history-skeleton-row">
              <Skeleton
                class="community-workspace-surface__history-skeleton-avatar"
              />
              <div>
                <Skeleton
                  class="community-workspace-surface__history-skeleton-name"
                />
                <Skeleton
                  class="community-workspace-surface__history-skeleton-line"
                />
                <Skeleton
                  class="community-workspace-surface__history-skeleton-line short"
                />
              </div>
            </div>
          {/each}
        </div>
        <div class="community-workspace-surface__composer-skeleton">
          <Skeleton
            class="community-workspace-surface__composer-skeleton-label"
          />
          <Skeleton
            class="community-workspace-surface__composer-skeleton-action"
          />
        </div>
      {/if}
    </div>
  {:else if model.view === "forum-index"}
    <div
      class="community-workspace-surface__forum-scroll-shell"
      data-ui-part="forum-scroll-shell"
    >
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
        {...handlers.onOpenProfile === undefined
          ? {}
          : { onOpenProfile: handlers.onOpenProfile }}
        {...handlers.onMessageMember === undefined
          ? {}
          : { onMessageMember: handlers.onMessageMember }}
        {...handlers.onWaveMember === undefined
          ? {}
          : { onWaveMember: handlers.onWaveMember }}
        {...knownNonmember || handlers.onCreateTopic === undefined
          ? {}
          : {
              onCreateTopic: (draft) =>
                Promise.resolve(handlers.onCreateTopic?.(activeRoom.id, draft)),
            }}
        disabled={surfaceReadOnly}
        {readOnlyReason}
        {...composerStatus === undefined ? {} : { composerStatus }}
        {...retryComposerOperation === undefined
          ? {}
          : { onRetryComposerStatus: retryComposerOperation }}
        {...dismissComposerOperation === undefined
          ? {}
          : { onDismissComposerStatus: dismissComposerOperation }}
        canDeleteTopic={(topic) =>
          topic.authorId === model.currentMemberId ||
          activeRoom.permissions?.delete.state === "enabled"}
        {historyUpdating}
        {...handlers.onTopicAction === undefined
          ? {}
          : { onTopicAction: handlers.onTopicAction }}
      >
        {#snippet emptyState()}
          {@render roomIntro("forum")}
        {/snippet}
      </ForumTopicList>
    </div>
    {#if knownNonmember}
      {@render roomMembershipFooter()}
    {/if}
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
      {...messageSupplement === undefined ? {} : { messageSupplement }}
      disabled={surfaceReadOnly}
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
      {...knownNonmember ? { footer: roomMembershipFooter } : {}}
      {...knownNonmember
        ? {}
        : {
            onSend: (content: string) =>
              handlers.onSendMessage?.(activeRoom.id, content),
          }}
      {...knownNonmember || handlers.onReply === undefined
        ? {}
        : { onReply: handlers.onReply }}
      {...knownNonmember ||
      handlers.onOpenThread === undefined ||
      activeRoom.kind === "forum"
        ? {}
        : { onOpenThread: handlers.onOpenThread }}
      replyActionLabel={activeRoom.kind === "forum"
        ? "Reply"
        : "Reply in thread"}
      {...surfaceReadOnly || handlers.onToggleReaction === undefined
        ? {}
        : { onToggleReaction: handlers.onToggleReaction }}
      {...surfaceReadOnly || handlers.onAddReaction === undefined
        ? {}
        : { onAddReaction: handlers.onAddReaction }}
      {...handlers.onCopyMessageLink === undefined
        ? {}
        : { onCopyMessageLink: handlers.onCopyMessageLink }}
      {...handlers.onCopyMessage === undefined
        ? {}
        : { onCopyMessage: handlers.onCopyMessage }}
      {...handlers.onCopyEvent === undefined
        ? {}
        : { onCopyEvent: handlers.onCopyEvent }}
      {...knownNonmember || handlers.onEditMessage === undefined
        ? {}
        : { onEditMessage: handlers.onEditMessage }}
      {...knownNonmember || handlers.onSaveMessageEdit === undefined
        ? {}
        : { onSaveMessageEdit: handlers.onSaveMessageEdit }}
      {...knownNonmember || handlers.onDeleteMessage === undefined
        ? {}
        : { onDeleteMessage: handlers.onDeleteMessage }}
      {...handlers.onReportMessage === undefined
        ? {}
        : { onReportMessage: handlers.onReportMessage }}
      {...handlers.onOpenProfile === undefined
        ? {}
        : { onOpenProfile: handlers.onOpenProfile }}
      {...handlers.onSelectRoom === undefined
        ? {}
        : { onOpenRoom: handlers.onSelectRoom }}
      {...handlers.onMessageMember === undefined
        ? {}
        : { onMessageMember: handlers.onMessageMember }}
      {...handlers.onWaveMember === undefined
        ? {}
        : { onWaveMember: handlers.onWaveMember }}
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
          {@render roomIntro("channel")}
        {/if}
      {/snippet}
    </CommunityConversation>
  {/if}
</div>

<style>
  .community-workspace-surface__history-skeleton {
    display: flex;
    min-height: 100%;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.25rem;
  }

  .community-workspace-surface__channel-skeleton-rows {
    display: grid;
    gap: 1.25rem;
  }

  .community-workspace-surface__history-skeleton-row {
    display: grid;
    grid-template-columns: 2.5rem minmax(0, 1fr);
    gap: 0.75rem;
    align-items: start;
  }

  .community-workspace-surface__history-skeleton-row > div {
    display: grid;
    gap: 0.5rem;
  }

  :global(.community-workspace-surface__history-skeleton-avatar) {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 999px;
  }

  :global(.community-workspace-surface__history-skeleton-name) {
    width: min(10rem, 35%);
    height: 0.9rem;
  }

  :global(.community-workspace-surface__history-skeleton-line) {
    width: min(38rem, 90%);
    height: 0.8rem;
  }

  :global(.community-workspace-surface__history-skeleton-line.short) {
    width: min(24rem, 58%);
  }

  .community-workspace-surface__composer-skeleton {
    display: flex;
    min-height: 5.5rem;
    align-items: flex-end;
    gap: 1rem;
    margin-top: auto;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-xl, 0.875rem);
    background: var(--background);
    box-shadow: var(--shadow-sm);
  }

  :global(.community-workspace-surface__composer-skeleton-label) {
    width: min(24rem, 68%);
    height: 0.85rem;
  }

  :global(.community-workspace-surface__composer-skeleton-action) {
    width: 2rem;
    height: 2rem;
    margin-inline-start: auto;
    border-radius: 999px;
  }

  .community-workspace-surface__forum-skeleton-heading {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 1rem;
    padding-block: 0.25rem 0.5rem;
  }

  .community-workspace-surface__forum-skeleton-heading > div {
    display: grid;
    min-width: 0;
    gap: 0.65rem;
  }

  :global(.community-workspace-surface__forum-skeleton-title) {
    width: min(12rem, 42vw);
    height: 1.5rem;
  }

  :global(.community-workspace-surface__forum-skeleton-description) {
    width: min(20rem, 58vw);
    height: 0.8rem;
  }

  :global(.community-workspace-surface__forum-skeleton-action) {
    width: 6rem;
    height: 2.25rem;
    border-radius: var(--radius-md, 0.5rem);
  }

  .community-workspace-surface__forum-skeleton-table {
    display: grid;
    border-block-start: 1px solid var(--border);
  }

  .community-workspace-surface__forum-skeleton-columns,
  .community-workspace-surface__forum-skeleton-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 4rem 5rem;
    gap: 1.25rem;
    align-items: center;
  }

  .community-workspace-surface__forum-skeleton-columns {
    padding: 0.75rem;
  }

  .community-workspace-surface__forum-skeleton-columns :global(*) {
    width: 2.75rem;
    height: 0.65rem;
  }

  .community-workspace-surface__forum-skeleton-row {
    min-height: 6rem;
    padding: 1rem 0.75rem;
    border-block-start: 1px solid var(--border);
  }

  .community-workspace-surface__forum-skeleton-row > div {
    display: grid;
    min-width: 0;
    gap: 0.5rem;
  }

  :global(.community-workspace-surface__forum-skeleton-topic) {
    width: min(24rem, 72%);
    height: 0.95rem;
  }

  :global(.community-workspace-surface__forum-skeleton-excerpt) {
    width: min(38rem, 92%);
    height: 0.75rem;
  }

  :global(.community-workspace-surface__forum-skeleton-meta) {
    width: 8rem;
    height: 0.7rem;
  }

  :global(.community-workspace-surface__forum-skeleton-count),
  :global(.community-workspace-surface__forum-skeleton-activity) {
    width: 2.5rem;
    height: 0.8rem;
  }
  .community-workspace-surface {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 0;
    height: 100%;
    min-height: 0;
  }

  .community-workspace-surface > :global(.community-conversation) {
    flex: 1;
    min-height: 0;
  }

  .community-workspace-surface__forum-scroll-shell {
    min-width: 0;
    min-height: 0;
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .community-workspace-surface__intro {
    display: grid;
    gap: 0.5rem;
    padding: 1.5rem 1.25rem 1rem;
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

  .community-workspace-surface__membership {
    position: relative;
    z-index: 1;
    display: flex;
    width: 100%;
    min-height: 4.5rem;
    flex: none;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1rem;
    isolation: isolate;
    background: var(--background);
  }

  .community-workspace-surface > .community-workspace-surface__membership {
    flex: none;
    border-block-start: 1px solid var(--border);
  }

  .community-workspace-surface__membership-label {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.75rem;
  }

  .community-workspace-surface__membership-label :global(svg) {
    width: 1.25rem;
    height: 1.25rem;
    flex: none;
  }

  .community-workspace-surface__membership-label span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-width: 34rem) {
    .community-workspace-surface__actions {
      width: 100%;
      grid-template-columns: 1fr;
    }
  }
</style>
