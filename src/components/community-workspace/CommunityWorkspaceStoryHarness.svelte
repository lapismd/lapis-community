<script lang="ts">
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
  import HashIcon from "@lucide/svelte/icons/hash";
  import HeadphonesIcon from "@lucide/svelte/icons/headphones";
  import LockIcon from "@lucide/svelte/icons/lock";
  import PanelRightIcon from "@lucide/svelte/icons/panel-right";
  import SquareTerminalIcon from "@lucide/svelte/icons/square-terminal";
  import UsersIcon from "@lucide/svelte/icons/users";
  import { onMount, untrack } from "svelte";

  import type { CommunityController } from "../../community/index.js";
  import {
    createCommunityStoryRuntime,
    type CommunityStoryRuntime,
  } from "../../testing/index.js";
  import CommunityAppShell from "../community-app-shell/CommunityAppShell.svelte";
  import CommunityChannelSettings from "../community-channel-settings/CommunityChannelSettings.svelte";
  import CommunityDetails from "../community-details/CommunityDetails.svelte";
  import CommunityNavigation from "../community-navigation/CommunityNavigation.svelte";
  import type { CommunityNavigationModel } from "../community-navigation/model.js";
  import CommunityProfileMenu from "../community-profile-menu/CommunityProfileMenu.svelte";
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
    initialNavigationCollapsed = false,
  }: {
    initialModel: CommunityWorkspaceModel;
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
        rightClosed:
          initialModel.sidePanel === undefined ||
          initialModel.sidePanel === "none",
        rightWidth: 320,
        sidebarMinWidth: 48,
        sidebarMaxWidth: 440,
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
  const currentCommunity = $derived(
    model.communities.find(
      (communityModel) => communityModel.id === model.activeCommunityId,
    ),
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

<CommunityAppShell
  {controller}
  displayMode="desktop"
  desktopMinMainWidth={0}
  data-testid="community-workspace-frame"
  data-last-action={lastAction}
  data-community-status={community?.state.status ?? "loading"}
  data-community-backend={runtime?.backend ?? "loading"}
>
  <AppShell.Sidebar
    side="left"
    label="Community navigation sidebar"
    mobileLabel="Channels, forums, and messages"
    resizeLabel="Resize community navigation sidebar"
    closeable
    revealOnEdgeHover
    edgeRevealLabel="Preview community navigation sidebar"
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
      {#snippet footer()}
        {#if currentMember}
          <CommunityProfileMenu
            member={currentMember}
            communityName={currentCommunity?.name ?? "Community"}
            compact={navigationCompact}
            canManageCommunity={community?.state.capabilities.manageMembers ??
              false}
          />
        {/if}
      {/snippet}
    </CommunityNavigation>
  </AppShell.Sidebar>

  <AppShell.Main>
    <AppShell.Toolbar label={`${activeRoom.name} toolbar`}>
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
      <AppShell.Sidebar.Header>
        <PanelRightIcon aria-hidden="true" />
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
      <AppShell.Sidebar.Header>
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
</CommunityAppShell>

<style>
  .community-workspace__toolbar-start,
  .community-workspace__toolbar-actions {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.5rem;
  }

  .community-workspace__room-title {
    display: grid;
    min-width: 0;
  }

  .community-workspace__room-title strong,
  .community-workspace__room-title span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .community-workspace__room-title span {
    color: var(--muted-foreground);
    font-size: 0.68rem;
    font-weight: 400;
  }

  .community-workspace__toolbar-start {
    flex: 1;
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
</style>
