<script lang="ts">
  import { observeReadEnd } from "./observe-read-end.js";
  import { conversationKey } from "../../community/conversations.js";
  import type { ComposerStatus } from "@lapismd/design-core/ai/chat";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { ScrollArea } from "@lapismd/design-core/shadcn/scroll-area";
  import { Skeleton } from "@lapismd/design-core/shadcn/skeleton";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import HashIcon from "@lucide/svelte/icons/hash";
  import LogInIcon from "@lucide/svelte/icons/log-in";
  import MessagesSquareIcon from "@lucide/svelte/icons/messages-square";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import SparklesIcon from "@lucide/svelte/icons/sparkles";
  import type { Snippet } from "svelte";

  import CommunityConversation from "../community-conversation/CommunityConversation.svelte";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import type {
    CommunityCustomEmoji,
    CommunityOperationState,
    CommunityReplyTarget,
    CommunityHistoryState,
    CommunityTimelinePresentation,
    CommunityTimelinePosition,
  } from "../../community/index.js";
  import ForumTopicList from "../forum-topic-list/ForumTopicList.svelte";
  import CommunityHistoryEdge from "../community-history-edge/CommunityHistoryEdge.svelte";
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
    directHistory,
    history,
    onLoadOlder,
    onLoadLatest,
    presentation,
    onPresentationChange,
    virtualize = false,
    onLoadOlderDirectMessages,
    messageSupplement,
    channelActions,
    agentMemberIds = [],
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
    directHistory?: { hasOlder: boolean; loading: boolean; error?: string };
    history?: CommunityHistoryState;
    virtualize?: boolean;
    presentation?: CommunityTimelinePresentation;
    onPresentationChange?: (
      key: string,
      update: { draft?: string; position?: CommunityTimelinePosition },
    ) => void;
    onLoadOlder?: () => Promise<void>;
    onLoadLatest?: () => Promise<void>;
    onLoadOlderDirectMessages?: () => Promise<void>;
    messageSupplement?: Snippet<[import("./model.js").CommunityMessageModel]>;
    channelActions?: Snippet;
    agentMemberIds?: readonly string[];
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
  const agentMemberIdSet = $derived(new Set(agentMemberIds));
  const activeDirectMemberShape = $derived(
    activeDirectMember !== undefined &&
      agentMemberIdSet.has(activeDirectMember.id)
      ? "rounded"
      : "circle",
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
  let forumViewport = $state<HTMLElement | null>(null);
  const readBoundary = $derived.by(() => {
    const windowed = history !== undefined || virtualize;
    const threadId =
      model.view === "forum-thread"
        ? model.messages.find((message) => message.sourceEvent?.kind === 11)?.id
        : undefined;
    const eventId = windowed
      ? model.messages
          .filter(
            (message) =>
              message.authorId !== model.currentMemberId &&
              !message.activity &&
              (model.view !== "forum-index" ||
                model.topics.some((topic) => topic.id === message.id)),
          )
          .at(-1)?.id
      : activeRoom.latestUnreadEventId;
    const onReadRoom = handlers.onReadRoom;
    const roomId = activeRoom.id;
    return {
      key: JSON.stringify([
        model.activeCommunityId,
        roomId,
        model.currentMemberId,
        threadId,
        eventId,
      ]),
      ...(eventId &&
      model.currentMemberId &&
      activeRoom.unreadCount &&
      onReadRoom
        ? {
            onRead: () =>
              onReadRoom(roomId, {
                eventId,
                ...(windowed && threadId
                  ? { threadId }
                  : windowed && activeRoom.kind !== "direct"
                    ? { timeline: true }
                    : {}),
              }),
          }
        : {}),
    };
  });

  // Resolve optional props once per dependency change, rather than on every child prop read.
  const conversationOptions = $derived({
    ...(history ? { history } : {}),
    ...(onLoadOlder ? { onLoadOlder } : {}),
    ...(onLoadLatest ? { onLoadLatest } : {}),
    ...(presentation ? { presentation } : {}),
    ...(onPresentationChange ? { onPresentationChange } : {}),
    ...(activeRoom.conversation?.transport === "nip17" &&
    directHistory &&
    onLoadOlderDirectMessages
      ? {
          history: { ...directHistory, ...history },
          onLoadOlder: onLoadOlderDirectMessages,
        }
      : {}),
    ...(model.view === "forum-thread" && model.messages[0]
      ? {
          activityContext: {
            kind: "forum-topic" as const,
            channelId: activeRoom.groupId ?? activeRoom.id,
            threadRootId:
              model.messages.find((message) => message.sourceEvent?.kind === 11)
                ?.id ?? model.messages[0].id,
          },
        }
      : {}),
    ...(activeDirectMember === undefined
      ? {}
      : { directMember: activeDirectMember }),
    ...(replyTarget === undefined ? {} : { replyTarget }),
    ...(messageSupplement === undefined ? {} : { messageSupplement }),
    ...(composerStatus === undefined ? {} : { composerStatus }),
    ...(retryComposerOperation === undefined
      ? {}
      : { onRetryComposerStatus: retryComposerOperation }),
    ...(dismissComposerOperation === undefined
      ? {}
      : { onDismissComposerStatus: dismissComposerOperation }),
    ...(model.currentMemberId === undefined
      ? {}
      : { currentMemberId: model.currentMemberId }),
    ...(handlers.onClearReplyTarget === undefined
      ? {}
      : { onCancelReply: handlers.onClearReplyTarget }),
    ...(knownNonmember ? { footer: roomMembershipFooter } : {}),
    ...(knownNonmember
      ? {}
      : {
          onSend: (content: string) =>
            handlers.onSendMessage?.(activeRoom.id, content),
        }),
    ...(knownNonmember || handlers.onReply === undefined
      ? {}
      : { onReply: handlers.onReply }),
    ...(knownNonmember ||
    handlers.onOpenThread === undefined ||
    activeRoom.kind === "forum"
      ? {}
      : { onOpenThread: handlers.onOpenThread }),
    ...(surfaceReadOnly || handlers.onToggleReaction === undefined
      ? {}
      : { onToggleReaction: handlers.onToggleReaction }),
    ...(surfaceReadOnly || handlers.onAddReaction === undefined
      ? {}
      : { onAddReaction: handlers.onAddReaction }),
    ...(handlers.onCopyMessageLink === undefined
      ? {}
      : { onCopyMessageLink: handlers.onCopyMessageLink }),
    ...(handlers.onCopyMessage === undefined
      ? {}
      : { onCopyMessage: handlers.onCopyMessage }),
    ...(handlers.onCopyEvent === undefined
      ? {}
      : { onCopyEvent: handlers.onCopyEvent }),
    ...(knownNonmember || handlers.onEditMessage === undefined
      ? {}
      : { onEditMessage: handlers.onEditMessage }),
    ...(knownNonmember || handlers.onSaveMessageEdit === undefined
      ? {}
      : { onSaveMessageEdit: handlers.onSaveMessageEdit }),
    ...(knownNonmember || handlers.onDeleteMessage === undefined
      ? {}
      : { onDeleteMessage: handlers.onDeleteMessage }),
    ...(handlers.onReportMessage === undefined
      ? {}
      : { onReportMessage: handlers.onReportMessage }),
    ...(handlers.onOpenProfile === undefined
      ? {}
      : { onOpenProfile: handlers.onOpenProfile }),
    ...(handlers.onSelectRoom === undefined
      ? {}
      : { onOpenRoom: handlers.onSelectRoom }),
    ...(handlers.onMessageMember === undefined
      ? {}
      : { onMessageMember: handlers.onMessageMember }),
    ...(handlers.onWaveMember === undefined
      ? {}
      : { onWaveMember: handlers.onWaveMember }),
    ...(handlers.onViewMemberActivity === undefined
      ? {}
      : { onViewMemberActivity: handlers.onViewMemberActivity }),
  });
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
      {#if kind === "channel" && channelActions}
        {@render channelActions()}
      {/if}
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

{#snippet directMessageIntro()}
  <section
    class="community-workspace-surface__intro community-workspace-surface__intro--direct"
  >
    {#if activeDirectMember}
      <div class="community-workspace-surface__direct-identity">
        {#if handlers.onOpenProfile}
          <button
            type="button"
            class="community-workspace-surface__direct-avatar-button"
            data-ui-part="direct-message-profile-action"
            aria-label={`View ${activeDirectMember.name}'s profile`}
            onclick={() => handlers.onOpenProfile?.(activeDirectMember)}
          >
            <CommunityMemberAvatar
              member={activeDirectMember}
              size="large"
              showPresence
              shape={activeDirectMemberShape}
              decorative
            />
          </button>
        {:else}
          <span class="community-workspace-surface__direct-avatar">
            <CommunityMemberAvatar
              member={activeDirectMember}
              size="large"
              showPresence
              shape={activeDirectMemberShape}
              decorative
            />
          </span>
        {/if}
        <h1>{activeDirectMember.name}</h1>
      </div>
      <p>
        This is the beginning of your direct message with {activeDirectMember.name}.
      </p>
    {:else}
      <span class="community-workspace-surface__image" aria-hidden="true">
        <MessagesSquareIcon />
      </span>
      <h1>{activeRoom.name}</h1>
      <p>This is the beginning of this direct message.</p>
    {/if}
    <p>Say hi, ask a question, or share what brought you here.</p>
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
    <ScrollArea
      bind:viewportRef={forumViewport}
      type="hover"
      orientation="vertical"
      class="community-workspace-surface__forum-scroll-shell"
      data-community-part="forum-scroll-shell"
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
      {#if history && onLoadOlder}
        <CommunityHistoryEdge
          {history}
          onLoad={onLoadOlder}
          label="Load earlier topics"
          viewport={forumViewport}
        />
      {/if}
      <div
        use:observeReadEnd={readBoundary}
        data-ui-part="read-boundary"
        style="height: 1px;"
      ></div>
    </ScrollArea>
    {#if knownNonmember}
      {@render roomMembershipFooter()}
    {/if}
  {:else}
    <CommunityConversation
      {virtualize}
      {...conversationOptions}
      {readBoundary}
      draftKey={activeRoom.conversation
        ? conversationKey(activeRoom.conversation)
        : JSON.stringify([model.activeCommunityId, activeRoom.id])}
      room={activeRoom}
      messages={model.messages}
      members={model.members}
      {rooms}
      directMemberAvatarShape={activeDirectMemberShape}
      {communityEmojis}
      disabled={surfaceReadOnly}
      disabledReason={readOnlyReason}
      restrictMessageManagement
      canDeleteAny={activeRoom.permissions?.delete.state === "enabled"}
      composerPlacement="row"
      replyActionLabel={activeRoom.kind === "forum"
        ? "Reply"
        : "Reply in thread"}
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
        {:else if activeRoom.kind === "direct"}
          {@render directMessageIntro()}
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

  :global(
      .community-workspace-surface__forum-scroll-shell[data-ui-component="scroll-area"]
    ) {
    min-width: 0;
    min-height: 0;
    flex: 1;
  }

  :global(
      .community-workspace-surface__forum-scroll-shell
        > [data-ui-part="scroll-area-viewport"]
    ) {
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
    font-size: var(--community-text-dialog);
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

  .community-workspace-surface__intro--direct {
    gap: 0.55rem;
  }

  .community-workspace-surface__direct-identity {
    display: grid;
    width: fit-content;
    max-width: 100%;
    gap: 0.75rem;
    justify-items: start;
  }

  .community-workspace-surface__direct-avatar,
  .community-workspace-surface__direct-avatar-button {
    display: inline-grid;
    width: 4rem;
    height: 4rem;
    place-items: center;
  }

  .community-workspace-surface__direct-avatar-button {
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 999px;
    color: inherit;
    background: transparent;
    cursor: pointer;
  }

  .community-workspace-surface__direct-avatar-button:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 3px;
  }

  .community-workspace-surface__direct-avatar-button
    :global(.community-member-avatar) {
    transition:
      transform 120ms ease,
      filter 120ms ease;
  }

  .community-workspace-surface__direct-avatar-button:hover
    :global(.community-member-avatar),
  .community-workspace-surface__direct-avatar-button:focus-visible
    :global(.community-member-avatar) {
    transform: translateY(-1px);
    filter: drop-shadow(0 0.35rem 0.6rem rgb(15 23 42 / 0.12));
  }

  .community-workspace-surface__actions {
    display: flex;
    width: 100%;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding-block-start: 0.5rem;
  }

  :global(
      .community-workspace-surface__action-card[data-ui-component="button"]
    ) {
    display: grid;
    width: 13.125rem;
    max-width: 100%;
    height: 7.5rem;
    flex: 0 0 13.125rem;
    align-content: space-between;
    justify-items: start;
    padding: 1rem;
    border-radius: 1rem;
    text-align: start;
    white-space: normal;
  }
  :global(
      .community-workspace-surface__action-card[data-ui-component="button"]
        strong
    ) {
    font-size: var(--community-text-body);
    font-weight: 550;
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
</style>
