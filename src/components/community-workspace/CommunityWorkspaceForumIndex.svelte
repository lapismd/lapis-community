<script lang="ts">
  import type { ComposerStatus } from "@lapismd/design-core/ai/chat";
  import { ScrollArea } from "@lapismd/design-core/shadcn/scroll-area";
  import type { Snippet } from "svelte";

  import type {
    CommunityCustomEmoji,
    CommunityHistoryState,
  } from "../../community/index.js";
  import { provideComposerDraftScope } from "../community-chat-composer/composer-draft-scope.js";
  import CommunityHistoryEdge from "../community-history-edge/CommunityHistoryEdge.svelte";
  import ForumTopicList from "../forum-topic-list/ForumTopicList.svelte";
  import type {
    CommunityMemberModel,
    CommunityRoomModel,
    CommunityTopicModel,
    CommunityWorkspaceHandlers,
  } from "./model.js";
  import { observeReadEnd } from "./observe-read-end.js";

  let {
    communityId,
    room,
    currentMemberId,
    topics,
    members,
    rooms,
    communityEmojis = [],
    handlers = {},
    knownNonmember = false,
    disabled = false,
    readOnlyReason = "Reconnect to send messages",
    composerStatus,
    onRetryComposerStatus,
    onDismissComposerStatus,
    historyUpdating = false,
    history,
    onLoadOlder,
    readBoundary,
    emptyState,
    membershipFooter,
  }: {
    communityId: string;
    room: CommunityRoomModel;
    currentMemberId?: string;
    topics: CommunityTopicModel[];
    members: CommunityMemberModel[];
    rooms: readonly CommunityRoomModel[];
    communityEmojis?: readonly CommunityCustomEmoji[];
    handlers?: CommunityWorkspaceHandlers;
    knownNonmember?: boolean;
    disabled?: boolean;
    readOnlyReason?: string;
    composerStatus?: ComposerStatus;
    onRetryComposerStatus?: () => void | Promise<void>;
    onDismissComposerStatus?: () => void;
    historyUpdating?: boolean;
    history?: CommunityHistoryState;
    onLoadOlder?: () => Promise<void>;
    readBoundary: { key: string; onRead?: () => void };
    emptyState: Snippet;
    membershipFooter?: Snippet;
  } = $props();

  provideComposerDraftScope(() => ({
    communityId,
    roomId: room.id,
    viewer: currentMemberId,
  }));

  let forumViewport = $state<HTMLElement | null>(null);
</script>

<ScrollArea
  bind:viewportRef={forumViewport}
  type="hover"
  orientation="vertical"
  class="community-workspace-surface__forum-scroll-shell"
  data-community-part="forum-scroll-shell"
>
  <ForumTopicList
    title={room.name}
    {topics}
    {members}
    {rooms}
    {communityEmojis}
    {...currentMemberId === undefined ? {} : { currentMemberId }}
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
            Promise.resolve(handlers.onCreateTopic?.(room.id, draft)),
        }}
    {disabled}
    {readOnlyReason}
    {...composerStatus === undefined ? {} : { composerStatus }}
    {...onRetryComposerStatus === undefined ? {} : { onRetryComposerStatus }}
    {...onDismissComposerStatus === undefined
      ? {}
      : { onDismissComposerStatus }}
    canDeleteTopic={(topic) =>
      topic.authorId === currentMemberId ||
      room.permissions?.delete.state === "enabled"}
    {historyUpdating}
    {...handlers.onTopicAction === undefined
      ? {}
      : { onTopicAction: handlers.onTopicAction }}
    {emptyState}
  />
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
{#if membershipFooter}
  {@render membershipFooter()}
{/if}
