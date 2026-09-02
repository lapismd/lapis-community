<script lang="ts">
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
  import HashIcon from "@lucide/svelte/icons/hash";
  import HeadphonesIcon from "@lucide/svelte/icons/headphones";
  import LockIcon from "@lucide/svelte/icons/lock";
  import SquareTerminalIcon from "@lucide/svelte/icons/square-terminal";
  import UsersIcon from "@lucide/svelte/icons/users";
  import { onMount, untrack } from "svelte";

  import type { CommunityController } from "../../community/index.js";
  import {
    createCommunityStoryRuntime,
    type CommunityStoryRuntime,
  } from "../../testing/index.js";
  import CommunityChannelSettings from "../community-channel-settings/CommunityChannelSettings.svelte";
  import CommunityDetails from "../community-details/CommunityDetails.svelte";
  import CommunityNavigation from "../community-navigation/CommunityNavigation.svelte";
  import type { CommunityNavigationModel } from "../community-navigation/model.js";
  import CommunitySwitcher from "../community-switcher/CommunitySwitcher.svelte";
  import CommunityThreadPanel from "../community-thread-panel/CommunityThreadPanel.svelte";
  import CommunityWorkspaceSurface from "./CommunityWorkspaceSurface.svelte";
  import {
    findCommunityRoom,
    memberById,
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

  let runtime = $state<CommunityStoryRuntime>();
  let community = $state<CommunityController>();
  let runtimeError = $state("");
  let lastAction = $state("ready");
  const model = $derived(community?.state.workspace ?? initialModel);

  onMount(() => {
    let active = true;
    void createCommunityStoryRuntime()
      .then((created) => {
        if (!active) {
          created.dispose();
          return;
        }
        runtime = created;
        community = created.controller;
        community.initialize();
      })
      .catch((cause: unknown) => {
        if (active) {
          runtimeError =
            cause instanceof Error
              ? cause.message
              : "Community story runtime failed";
        }
      });
    return () => {
      active = false;
      runtime?.dispose();
    };
  });

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
        ...(room.private === undefined ? {} : { restricted: room.private }),
        ...(room.mentionCount === undefined && room.unreadCount === undefined
          ? {}
          : { unreadCount: room.mentionCount ?? room.unreadCount }),
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
    effectiveSidePanel === "thread"
      ? "Thread"
      : activeRoom.kind === "channel"
        ? "Channel settings"
        : "Room details",
  );

  function selectRoom(roomId: string): void {
    community?.actions.selectRoom(roomId);
    controller.right.close();
    controller.mobile.showMain();
    lastAction = `selected-room:${roomId}`;
  }

  function react(messageId: string, emoji: string): void {
    void community?.actions.toggleReaction(messageId, emoji);
    lastAction = `reaction:${messageId}:${emoji}`;
  }

  function openSidePanel(panel: Exclude<CommunitySidePanel, "none">): void {
    if (panel === "details") community?.actions.openDetails();
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
    community?.actions.closeSidePanel();
    controller.right.close();
    lastAction = "closed-side-panel";
  }
</script>

{#if runtimeError}
  <div class="community-workspace-story__unavailable" role="status">
    {runtimeError}
  </div>
{/if}

<div
  class="community-workspace-story"
  data-testid="community-workspace-frame"
  data-last-action={lastAction}
  data-community-status={community?.state.status ?? "loading"}
  data-community-backend={runtime?.backend ?? "loading"}
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
            community?.actions.selectCommunity(communityId);
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
      <AppShell.Toolbar
        label={`${activeRoom.name} toolbar`}
        class="community-workspace__toolbar"
      >
        <div class="community-workspace__toolbar-start">
          {#if navigationCompact || controller.mobile.resolvedMode === "mobile"}
            <AppShell.Sidebar.Toggle side="left" sidebarName="navigation" />
          {/if}
          <div class="community-workspace__room-title">
            <strong>
              {#if activeRoom.private}
                <LockIcon data-icon="inline-start" aria-hidden="true" />
              {:else if activeRoom.kind === "channel"}
                <HashIcon data-icon="inline-start" aria-hidden="true" />
              {:else}
                <span aria-hidden="true">●</span>
              {/if}
              {activeRoom.name}
            </strong>
          </div>
        </div>
        <div class="community-workspace__toolbar-actions">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Open Buzz Term"
            title="Open Buzz Term"
          >
            <SquareTerminalIcon aria-hidden="true" />
          </Button>
          {#if activeRoom.memberCount}
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`View channel members (${activeRoom.memberCount})`}
            >
              <UsersIcon data-icon="inline-start" aria-hidden="true" />
              {activeRoom.memberCount}
            </Button>
          {/if}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Start huddle"
            title="Start huddle"
          >
            <HeadphonesIcon aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Manage channel"
            title="Manage channel"
            onclick={() => {
              openSidePanel("details");
              lastAction = "opened-details";
            }}
          >
            <EllipsisIcon aria-hidden="true" />
          </Button>
        </div>
      </AppShell.Toolbar>

      <AppShell.Body layout="regions" label="Community workspace">
        <AppShell.Body.Content label={`${activeRoom.name} content`}>
          <CommunityWorkspaceSurface
            {model}
            handlers={{
              ...(community?.handlers ?? {}),
              onSendMessage: (roomId, content) => {
                community?.handlers.onSendMessage?.(roomId, content);
                lastAction = "sent-message";
              },
              onOpenTopic: (topicId) => {
                community?.actions.openTopic(topicId);
                openSidePanel("details");
                lastAction = `opened-topic:${topicId}`;
              },
              onOpenThread: (messageId) => {
                community?.actions.openThread(messageId);
                openSidePanel("thread");
                lastAction = `opened-thread:${messageId}`;
              },
              onToggleReaction: react,
              onAddReaction: react,
            }}
          />
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
      {#if effectiveSidePanel === "thread" && model.thread}
        <AppShell.Sidebar.Header class="community-workspace__panel-header">
          <strong>{sidePanelTitle}</strong>
          <AppShell.Sidebar.Close onclick={closeSidePanel} />
        </AppShell.Sidebar.Header>
        <AppShell.Sidebar.Body>
          <CommunityThreadPanel
            thread={model.thread}
            members={model.members}
            onSendReply={(_rootMessageId, content) => {
              community?.handlers.onSendReply?.(_rootMessageId, content);
              lastAction = "sent-reply";
            }}
            onToggleReaction={react}
            onAddReaction={react}
          />
        </AppShell.Sidebar.Body>
      {:else if activeRoom.kind === "channel"}
        <CommunityChannelSettings
          room={activeRoom}
          members={model.members}
          description={model.details?.description ??
            activeRoom.description ??
            "Community channel"}
          onAction={(action) => {
            lastAction = `channel-settings:${action}`;
          }}
        />
      {:else if model.details}
        <AppShell.Sidebar.Header class="community-workspace__panel-header">
          <strong>{sidePanelTitle}</strong>
          <AppShell.Sidebar.Close onclick={closeSidePanel} />
        </AppShell.Sidebar.Header>
        <AppShell.Sidebar.Body>
          <CommunityDetails
            room={activeRoom}
            details={model.details}
            members={model.members}
          />
        </AppShell.Sidebar.Body>
      {/if}
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
    --ui-shell-right-sidebar-gap: 0;
  }

  .community-workspace-story
    :global(
      .community-workspace__shell:has(
          > .ui-minimal-app-shell__composition
            > .ui-minimal-app-shell__sidebar[data-side="right"][data-presentation="inline"]:not(
              [hidden]
            )
        )
        > .ui-minimal-app-shell__composition
        > .ui-minimal-app-shell__main
    ) {
    border-start-end-radius: 0;
    border-end-end-radius: 0;
  }

  .community-workspace-story
    :global(
      .community-workspace__shell
        > .ui-minimal-app-shell__composition
        > .ui-minimal-app-shell__sidebar[data-side="right"][data-presentation="inline"]
    ) {
    margin-block: var(--ui-shell-main-block-inset);
    margin-inline-end: var(--ui-shell-main-block-inset);
    border: var(--ui-shell-main-border);
    border-inline-start: 0;
    border-start-end-radius: var(--ui-shell-main-radius);
    border-end-end-radius: var(--ui-shell-main-radius);
    background: var(--background);
    box-shadow: var(--ui-shell-main-shadow);
  }

  .community-workspace-story :global(.community-workspace__navigation-sidebar) {
    background: color-mix(
      in srgb,
      var(--sidebar, var(--background)) 92%,
      var(--primary) 8%
    );
  }

  .community-workspace__rail-header,
  .community-workspace__toolbar-start,
  .community-workspace__toolbar-actions,
  .community-workspace__member-footer {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.5rem;
  }

  .community-workspace__rail-header {
    width: 100%;
  }

  .community-workspace__rail-header :global([data-ui-part="sidebar-close"]) {
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

  .community-workspace__room-title,
  .community-workspace__member-footer > span:last-child {
    display: grid;
    min-width: 0;
  }

  .community-workspace__room-title strong,
  .community-workspace__room-title span,
  .community-workspace__member-footer strong,
  .community-workspace__member-footer small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .community-workspace__room-title span,
  .community-workspace__member-footer small {
    color: var(--muted-foreground);
    font-size: 0.68rem;
    font-weight: 400;
  }

  .community-workspace__toolbar-start {
    flex: 1;
  }

  .community-workspace-story :global(.community-workspace__toolbar) {
    border-block-end: 0;
  }

  .community-workspace__room-title strong {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.88rem;
  }

  .community-workspace__toolbar-actions {
    margin-inline-start: auto;
  }

  .community-workspace-story :global(.community-workspace__panel-header) {
    min-height: var(--ui-shell-toolbar-height);
    padding: 0.75rem 1rem;
    border-block-end: 0;
  }

  .community-workspace-story
    :global([data-ui-part="body-content"] > [data-ui-component="scroll-area"]),
  .community-workspace-story
    :global(
      [data-ui-part="body-content"] [data-ui-part="scroll-area-viewport"]
    ) {
    height: 100%;
  }
</style>
