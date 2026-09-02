<script lang="ts">
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";
  import { Badge } from "@lapismd/design-core/shadcn/badge";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { untrack } from "svelte";

  import CommunityConversation from "../community-conversation/CommunityConversation.svelte";
  import CommunityDetails from "../community-details/CommunityDetails.svelte";
  import CommunityNavigation from "../community-navigation/CommunityNavigation.svelte";
  import type { CommunityNavigationModel } from "../community-navigation/model.js";
  import CommunitySwitcher from "../community-switcher/CommunitySwitcher.svelte";
  import CommunityThreadPanel from "../community-thread-panel/CommunityThreadPanel.svelte";
  import ForumTopicList from "../forum-topic-list/ForumTopicList.svelte";
  import {
    communityForumMessages,
    communityStoryMessages,
    communityStoryThread,
  } from "./story-fixtures.js";
  import {
    findCommunityRoom,
    memberById,
    type CommunityMessageModel,
    type CommunityReactionModel,
    type CommunityRoomModel,
    type CommunitySidePanel,
    type CommunityWorkspaceModel,
  } from "./model.js";

  let {
    initialModel,
    initialWidth = 1280,
    initialNavigationCollapsed = false,
  }: {
    initialModel: CommunityWorkspaceModel;
    initialWidth?: number;
    initialNavigationCollapsed?: boolean;
  } = $props();

  let model = $state<CommunityWorkspaceModel>(
    untrack(
      () => JSON.parse(JSON.stringify(initialModel)) as CommunityWorkspaceModel,
    ),
  );
  let lastAction = $state("ready");

  const controller = untrack(
    () =>
      new AppShellController({
        leftCollapsed: initialNavigationCollapsed,
        leftWidth: 252,
        rightClosed:
          initialModel.sidePanel === undefined ||
          initialModel.sidePanel === "none",
        rightWidth: 320,
        sidebarMinWidth: 48,
        sidebarMaxWidth: 440,
      }),
  );
  const communitiesSidebar = untrack(() =>
    controller.createSidebar("communities", "left", {
      width: 64,
      minWidth: 56,
      maxWidth: 280,
    }),
  );

  const activeRoom = $derived(
    findCommunityRoom(model) ??
      ({
        id: model.activeRoomId,
        name: "Community",
        kind: "channel",
        description: "Community conversation",
      } satisfies CommunityRoomModel),
  );
  const currentMember = $derived(
    model.currentMemberId
      ? memberById(model.members, model.currentMemberId)
      : undefined,
  );
  const navigationModel = $derived<CommunityNavigationModel>({
    searchPlaceholder: "Search community",
    primaryItems: [],
    sections: model.navigationSections.map((section) => ({
      id: section.id,
      label: section.label,
      items: section.rooms.map((room) => ({
        id: room.id,
        label: room.name,
        kind: room.kind === "direct" ? "direct-message" : room.kind,
        restricted: room.private,
        unreadCount: room.mentionCount ?? room.unreadCount,
      })),
    })),
  });
  const navigationCompact = $derived(
    controller.mobile.resolvedMode === "desktop" &&
      controller.left.collapsed &&
      !controller.left.previewed,
  );
  const communitiesCompact = $derived(
    controller.mobile.resolvedMode === "desktop" &&
      !communitiesSidebar.previewed,
  );
  const effectiveSidePanel = $derived<Exclude<CommunitySidePanel, "none">>(
    model.sidePanel === "thread" && model.thread ? "thread" : "details",
  );
  const sidePanelTitle = $derived(
    effectiveSidePanel === "thread" ? "Thread" : "Room details",
  );

  function selectRoom(roomId: string): void {
    const room = model.navigationSections
      .flatMap((section) => section.rooms)
      .find((candidate) => candidate.id === roomId);
    if (!room) return;
    model = {
      ...model,
      activeRoomId: room.id,
      view: room.kind === "forum" ? "forum-index" : "channel",
      messages:
        room.kind === "forum" ? communityForumMessages : communityStoryMessages,
      sidePanel: "none",
    };
    controller.right.close();
    controller.mobile.showMain();
    lastAction = `selected-room:${roomId}`;
  }

  function addMessage(content: string): CommunityMessageModel {
    return {
      id: `fixture-${model.messages.length + 1}`,
      authorId: model.currentMemberId ?? model.members[0]?.id ?? "unknown",
      timestamp: "Now",
      content,
      reactions: [],
    };
  }

  function updateReaction(
    message: CommunityMessageModel,
    emoji: string,
  ): CommunityMessageModel {
    const reactions = [...(message.reactions ?? [])];
    const index = reactions.findIndex((reaction) => reaction.emoji === emoji);
    if (index === -1) {
      reactions.push({ emoji, count: 1, selected: true });
    } else {
      const current = reactions[index]!;
      reactions[index] = {
        ...current,
        count: Math.max(0, current.count + (current.selected ? -1 : 1)),
        selected: !current.selected,
      } satisfies CommunityReactionModel;
    }
    return { ...message, reactions };
  }

  function react(messageId: string, emoji: string): void {
    const thread = model.thread;
    model = {
      ...model,
      messages: model.messages.map((message) =>
        message.id === messageId ? updateReaction(message, emoji) : message,
      ),
      ...(thread
        ? {
            thread: {
              ...thread,
              messages: thread.messages.map((message) =>
                message.id === messageId
                  ? updateReaction(message, emoji)
                  : message,
              ),
            },
          }
        : {}),
    };
    lastAction = `reaction:${messageId}:${emoji}`;
  }

  function openSidePanel(panel: Exclude<CommunitySidePanel, "none">): void {
    model = { ...model, sidePanel: panel };
    controller.right.open();
    if (controller.mobile.resolvedMode === "mobile") {
      const returnFocus =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : undefined;
      controller.mobile.show("right", "right", returnFocus);
    }
  }

  function closeSidePanel(): void {
    model = { ...model, sidePanel: "none" };
    lastAction = "closed-side-panel";
  }
</script>

<div
  class="community-workspace-story"
  data-testid="community-workspace-frame"
  data-last-action={lastAction}
  style={`--community-workspace-story-width: ${initialWidth}px`}
>
  <AppShell.Root
    {controller}
    mobileBreakpoint={1024}
    desktopMinMainWidth={480}
    class="community-workspace__shell"
  >
    <AppShell.Sidebar
      side="left"
      sidebarController={communitiesSidebar}
      label="Community switcher"
      mobileLabel="Communities"
      variant="outer"
      resizable={false}
      closeable
    >
      <AppShell.Sidebar.Header>
        <div class="community-workspace__rail-header">
          <span class="community-workspace__brand" aria-hidden="true">L</span>
          {#if !communitiesCompact}
            <strong>Communities</strong>
            <AppShell.Sidebar.Close label="Close communities sidebar" />
          {/if}
        </div>
      </AppShell.Sidebar.Header>
      <AppShell.Sidebar.Body>
        <CommunitySwitcher
          communities={model.communities}
          activeCommunityId={model.activeCommunityId}
          compact={communitiesCompact}
          onSelect={(communityId) => {
            model = { ...model, activeCommunityId: communityId };
            controller.mobile.showMain();
            lastAction = `selected-community:${communityId}`;
          }}
        />
      </AppShell.Sidebar.Body>
    </AppShell.Sidebar>

    <AppShell.Sidebar
      side="left"
      label="Community navigation sidebar"
      mobileLabel="Channels, forums, and messages"
      resizeLabel="Resize community navigation sidebar"
      closeable
      revealOnEdgeHover
      edgeRevealLabel="Preview community navigation sidebar"
      class="community-workspace__navigation-sidebar"
    >
      <CommunityNavigation
        model={navigationModel}
        activeItemId={model.activeRoomId}
        compact={navigationCompact}
        onSelect={(item) => selectRoom(item.id)}
        onSearch={(query) => {
          lastAction = `searched:${query}`;
        }}
        onRequestExpand={() => controller.left.expand()}
      >
        {#snippet headerStart()}
          {#if !navigationCompact}
            <AppShell.Sidebar.Toggle
              side="left"
              sidebarController={communitiesSidebar}
              sidebarName="communities"
            />
          {/if}
        {/snippet}
        {#snippet headerEnd()}
          {#if !navigationCompact}
            <AppShell.Sidebar.Close
              label="Close community navigation sidebar"
            />
          {/if}
        {/snippet}
        {#snippet footer()}
          {#if currentMember && !navigationCompact}
            <div class="community-workspace__member-footer">
              <span
                class="community-workspace__member-avatar"
                aria-hidden="true">{currentMember.initials}</span
              >
              <span>
                <strong>{currentMember.name}</strong>
                <small>@{currentMember.handle}</small>
              </span>
            </div>
          {/if}
        {/snippet}
      </CommunityNavigation>
    </AppShell.Sidebar>

    <AppShell.Main>
      <AppShell.Toolbar label={`${activeRoom.name} toolbar`}>
        <div class="community-workspace__toolbar-start">
          <AppShell.Sidebar.Toggle side="left" sidebarName="navigation" />
          <div class="community-workspace__room-title">
            <strong>
              {activeRoom.kind === "channel"
                ? "#"
                : activeRoom.kind === "forum"
                  ? "▤"
                  : "●"}
              {activeRoom.name}
            </strong>
            <span>{activeRoom.description}</span>
          </div>
        </div>
        <div class="community-workspace__toolbar-actions">
          {#if activeRoom.memberCount}
            <Badge variant="outline">{activeRoom.memberCount} members</Badge>
          {/if}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onclick={() => {
              openSidePanel("details");
              lastAction = "opened-details";
            }}
          >
            Details
          </Button>
        </div>
      </AppShell.Toolbar>

      <AppShell.Body layout="regions" label="Community workspace">
        <AppShell.Body.Content label={`${activeRoom.name} content`}>
          {#if model.view === "forum-index"}
            <ForumTopicList
              title={activeRoom.name}
              description={activeRoom.description ??
                "Long-form community discussions"}
              topics={model.topics}
              members={model.members}
              onOpenTopic={(topicId) => {
                model = {
                  ...model,
                  view: "forum-thread",
                  messages: communityForumMessages,
                };
                openSidePanel("details");
                lastAction = `opened-topic:${topicId}`;
              }}
            />
          {:else}
            <CommunityConversation
              room={activeRoom}
              messages={model.messages}
              members={model.members}
              onSend={(content) => {
                model = {
                  ...model,
                  messages: [...model.messages, addMessage(content)],
                };
                lastAction = "sent-message";
              }}
              onOpenThread={(messageId) => {
                model = {
                  ...model,
                  thread: { ...communityStoryThread, rootMessageId: messageId },
                };
                openSidePanel("thread");
                lastAction = `opened-thread:${messageId}`;
              }}
              onToggleReaction={react}
              onAddReaction={react}
            />
          {/if}
        </AppShell.Body.Content>
      </AppShell.Body>
    </AppShell.Main>

    <AppShell.Sidebar
      side="right"
      label={`${sidePanelTitle} sidebar`}
      mobileLabel={sidePanelTitle}
      resizeLabel={`Resize ${sidePanelTitle.toLowerCase()} sidebar`}
      closeable
    >
      <AppShell.Sidebar.Header>
        <strong>{sidePanelTitle}</strong>
        <AppShell.Sidebar.Close onclick={closeSidePanel} />
      </AppShell.Sidebar.Header>
      <AppShell.Sidebar.Body>
        {#if effectiveSidePanel === "thread" && model.thread}
          <CommunityThreadPanel
            thread={model.thread}
            members={model.members}
            onSendReply={(_rootMessageId, content) => {
              if (!model.thread) return;
              model = {
                ...model,
                thread: {
                  ...model.thread,
                  messages: [...model.thread.messages, addMessage(content)],
                },
              };
              lastAction = "sent-reply";
            }}
            onToggleReaction={react}
            onAddReaction={react}
          />
        {:else if model.details}
          <CommunityDetails
            room={activeRoom}
            details={model.details}
            members={model.members}
          />
        {/if}
      </AppShell.Sidebar.Body>
    </AppShell.Sidebar>
  </AppShell.Root>
</div>

<style>
  .community-workspace-story {
    width: min(100%, var(--community-workspace-story-width));
    height: min(46rem, 100vh);
    min-height: 40rem;
    margin: 0 auto;
    overflow: hidden;
    color: var(--foreground);
    background: var(--background);
  }

  .community-workspace-story :global(.community-workspace__shell) {
    --ui-shell-height: 100%;
  }

  .community-workspace-story :global(.community-workspace__navigation-sidebar) {
    background: color-mix(
      in srgb,
      var(--sidebar, var(--background)) 92%,
      var(--primary) 8%
    );
  }

  .community-workspace__rail-header,
  .community-workspace__navigation-header,
  .community-workspace__toolbar-start,
  .community-workspace__toolbar-actions,
  .community-workspace__member-footer {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.5rem;
  }

  .community-workspace__rail-header,
  .community-workspace__navigation-header {
    width: 100%;
  }

  .community-workspace__rail-header :global([data-ui-part="sidebar-close"]),
  .community-workspace__navigation-header
    :global([data-ui-part="sidebar-close"]) {
    margin-inline-start: auto;
  }

  .community-workspace__brand,
  .community-workspace__member-avatar {
    display: grid;
    width: 2rem;
    height: 2rem;
    flex: none;
    place-items: center;
    border-radius: 0.6rem;
    color: var(--primary-foreground);
    background: var(--primary);
    font-size: 0.72rem;
    font-weight: 750;
  }

  .community-workspace__community-title,
  .community-workspace__room-title,
  .community-workspace__member-footer > span:last-child {
    display: grid;
    min-width: 0;
  }

  .community-workspace__community-title strong,
  .community-workspace__community-title span,
  .community-workspace__room-title strong,
  .community-workspace__room-title span,
  .community-workspace__member-footer strong,
  .community-workspace__member-footer small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .community-workspace__community-title span,
  .community-workspace__room-title span,
  .community-workspace__member-footer small {
    color: var(--muted-foreground);
    font-size: 0.68rem;
    font-weight: 400;
  }

  .community-workspace__toolbar-start {
    flex: 1;
  }

  .community-workspace__room-title strong {
    font-size: 0.88rem;
  }

  .community-workspace__toolbar-actions {
    margin-inline-start: auto;
  }

  .community-workspace-story
    :global([data-ui-part="body-content"] > [data-ui-component="scroll-area"]),
  .community-workspace-story
    :global(
      [data-ui-part="body-content"] [data-ui-part="scroll-area-viewport"]
    ) {
    height: 100%;
  }

  @media (max-width: 44rem) {
    .community-workspace__room-title span,
    .community-workspace__toolbar-actions :global([data-ui-component="badge"]) {
      display: none;
    }
  }
</style>
