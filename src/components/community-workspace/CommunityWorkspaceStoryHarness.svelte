<script lang="ts">
  import CommunitySkeleton from "../community-skeleton/CommunitySkeleton.svelte";
  import { AppShell, AppShellController } from "@lapismd/design-core/shell";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
  import HashIcon from "@lucide/svelte/icons/hash";
  import HeadphonesIcon from "@lucide/svelte/icons/headphones";
  import LockIcon from "@lucide/svelte/icons/lock";
  import MessagesSquareIcon from "@lucide/svelte/icons/messages-square";
  import SquareTerminalIcon from "@lucide/svelte/icons/square-terminal";
  import UsersIcon from "@lucide/svelte/icons/users";
  import { untrack } from "svelte";

  import { createWorkspaceStoryRuntime } from "../../testing/workspace-story-runtime.svelte.js";
  import CommunityAppShell from "../community-app-shell/CommunityAppShell.svelte";
  import CommunityChannelSettings from "../community-channel-settings/CommunityChannelSettings.svelte";
  import CommunityDetails from "../community-details/CommunityDetails.svelte";
  import CommunityNavigation from "../community-navigation/CommunityNavigation.svelte";
  import type { CommunityNavigationModel } from "../community-navigation/model.js";
  import CommunityProfileMenu from "../community-profile-menu/CommunityProfileMenu.svelte";
  import CommunitySettingsNavigation from "../community-settings-navigation/CommunitySettingsNavigation.svelte";
  import CommunitySettings from "../community-settings/CommunitySettings.svelte";
  import type { CommunitySettingsSection } from "../community-settings/model.js";
  import CommunityThreadPanel from "../community-thread-panel/CommunityThreadPanel.svelte";
  import CommunityWorkspaceSurface from "./CommunityWorkspaceSurface.svelte";
  import {
    findCommunityRoom,
    memberById,
    rootCommunityMessageId,
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

  const runtimeState = createWorkspaceStoryRuntime();
  const runtime = $derived(runtimeState.runtime);
  const community = $derived(runtime?.controller);
  let lastAction = $state("ready");
  let showSettings = $state(false);
  let settingsSection = $state<CommunitySettingsSection>("profile");
  let requestedSidePanel = $state<CommunitySidePanel>(
    untrack(() => initialModel.sidePanel ?? "none"),
  );
  const model = $derived(community?.state.workspace ?? initialModel);

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
  const sidePanelTitle = $derived(
    requestedSidePanel === "thread"
      ? "Thread"
      : activeRoom.kind === "channel"
        ? "Channel settings"
        : activeRoom.kind === "forum"
          ? "Forum settings"
          : "Conversation details",
  );
  const emojiOperation = $derived.by(() =>
    Object.entries(community?.state.operations ?? {})
      .filter(([key]) => key.startsWith("settings:emoji:"))
      .map(([, operation]) => operation)
      .find((operation) => operation.status !== "idle"),
  );

  function selectRoom(roomId: string): void {
    showSettings = false;
    requestedSidePanel = "none";
    community?.actions.selectRoom(roomId);
    controller.right.close();
    controller.mobile.showMain();
    lastAction = `selected-room:${roomId}`;
  }

  function closeSettings(): void {
    showSettings = false;
    lastAction = "closed-settings";
  }

  function react(messageId: string, emoji: string): void {
    void community?.actions.toggleReaction(messageId, emoji);
    lastAction = `reaction:${messageId}:${emoji}`;
  }

  function openSidePanel(panel: Exclude<CommunitySidePanel, "none">): void {
    requestedSidePanel = panel;
    if (panel === "details") community?.actions.openDetails();
    controller.right.expand();
    if (controller.mobile.resolvedMode === "mobile") {
      const returnFocus =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : undefined;
      controller.mobile.show("right", "right", returnFocus);
    }
  }

  function closeSidePanel(): void {
    requestedSidePanel = "none";
    community?.actions.closeSidePanel();
    if (controller.right.collapsed) controller.right.expand();
    controller.right.close();
    lastAction = "closed-side-panel";
  }
</script>

{#if runtimeState.error}
  <div class="community-workspace-story__unavailable" role="status">
    {runtimeState.error}
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
  {#if community}
    <AppShell.Sidebar
      side="left"
      label="Community navigation sidebar"
      mobileLabel="Channels, forums, and messages"
      resizeLabel="Resize community navigation sidebar"
      closeable
      revealOnEdgeHover
      edgeRevealLabel="Preview community navigation sidebar"
    >
      {#if showSettings}
        <CommunitySettingsNavigation
          section={settingsSection}
          onSelect={(value) => (settingsSection = value)}
          onClose={closeSettings}
        />
      {:else}
        <CommunityNavigation
          model={navigationModel}
          activeItemId={model.activeRoomId}
          compact={navigationCompact}
          onSelect={(item) => selectRoom(item.id)}
          onSearch={(query) => {
            lastAction = `searched:${query}`;
          }}
          onSectionAction={(_section, action) => {
            lastAction = `section:${action.id}`;
          }}
          onItemAction={(item, action) => {
            lastAction = `${action}:${item.id}`;
          }}
        >
          {#snippet footer()}
            {#if currentMember}
              <CommunityProfileMenu
                member={currentMember}
                communityName={currentCommunity?.name ?? "Community"}
                compact={navigationCompact}
                canManageCommunity={community?.state.capabilities
                  .manageMembers ?? false}
                onAction={(action) => {
                  if (action === "settings") {
                    showSettings = true;
                    controller.left.expand();
                    controller.right.close();
                    lastAction = "opened-settings";
                  }
                }}
                onPresenceChange={(presence) => {
                  lastAction = `presence:${presence}`;
                }}
              />
            {/if}
          {/snippet}
        </CommunityNavigation>
      {/if}
    </AppShell.Sidebar>

    <AppShell.Main>
      {#if showSettings && community}
        <AppShell.Body layout="regions" label="Personal settings">
          <AppShell.Body.Content>
            <CommunitySettings
              model={community.state.settings}
              section={settingsSection}
              {...community.state.operations["settings:profile"] === undefined
                ? {}
                : {
                    profileOperation:
                      community.state.operations["settings:profile"],
                  }}
              {...emojiOperation === undefined ? {} : { emojiOperation }}
              onUpdateProfile={(profile) =>
                community!.actions.updateProfile(profile)}
              onAddCustomEmoji={(shortcode, url) =>
                community!.actions.setCustomEmoji(shortcode, url)}
              onRemoveCustomEmoji={(shortcode) =>
                community!.actions.removeCustomEmoji(shortcode)}
            />
          </AppShell.Body.Content>
        </AppShell.Body>
      {:else}
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
                {:else if activeRoom.kind === "forum"}
                  <MessagesSquareIcon
                    data-icon="inline-start"
                    data-ui-part="room-kind-icon"
                    aria-hidden="true"
                  />
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
                aria-label={`View ${activeRoom.kind === "forum" ? "forum" : "channel"} members (${activeRoom.memberCount})`}
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
              aria-label={`Manage ${activeRoom.kind === "forum" ? "forum" : "channel"}`}
              title={`Manage ${activeRoom.kind === "forum" ? "forum" : "channel"}`}
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
              {...community?.state.replyTarget === undefined
                ? {}
                : { replyTarget: community.state.replyTarget }}
              handlers={{
                ...(community?.handlers ?? {}),
                onSelectRoom: selectRoom,
                onBrowseRooms: (kind) => {
                  lastAction = `browsed-${kind}s`;
                },
                onSendMessage: async (roomId, content) => {
                  if (community?.state.replyTarget)
                    await community.actions.sendReply(
                      community.state.replyTarget.eventId,
                      content,
                    );
                  else
                    await community?.handlers.onSendMessage?.(roomId, content);
                  community?.actions.clearReplyTarget();
                  lastAction = "sent-message";
                },
                onOpenTopic: (topicId) => {
                  requestedSidePanel = "none";
                  community?.actions.openTopic(topicId);
                  controller.right.close();
                  lastAction = `opened-topic:${topicId}`;
                },
                onReply: (messageId) => {
                  community?.actions.setReplyTarget(messageId);
                  if (activeRoom.kind === "channel") {
                    community?.actions.openThread(
                      rootCommunityMessageId(model.messages, messageId),
                    );
                    openSidePanel("thread");
                  }
                  lastAction = `replying-to:${messageId}`;
                },
                onOpenThread: (messageId) => {
                  community?.actions.clearReplyTarget();
                  community?.actions.openThread(messageId);
                  openSidePanel("thread");
                  lastAction = `opened-thread:${messageId}`;
                },
                onToggleReaction: react,
                onAddReaction: react,
                onCopyMessageLink: (messageId) => {
                  lastAction = `copied-message-link:${messageId}`;
                },
                onDeleteMessage: (messageId) => {
                  void community?.actions.deleteEvent(messageId);
                  lastAction = `deleted-message:${messageId}`;
                },
                onCreateTopic: async (roomId, draft) => {
                  await community?.actions.createTopic(roomId, draft);
                  lastAction = "created-topic";
                },
              }}
            />
          </AppShell.Body.Content>
        </AppShell.Body>
      {/if}
    </AppShell.Main>

    {#if requestedSidePanel !== "none"}
      <AppShell.Sidebar
        side="right"
        label={`${sidePanelTitle} sidebar`}
        mobileLabel={sidePanelTitle}
        resizeLabel={`Resize ${sidePanelTitle.toLowerCase()} sidebar`}
        closeable
      >
        {#if requestedSidePanel === "thread"}
          <AppShell.Sidebar.Header>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              data-ui-part="sidebar-toggle"
              data-side="right"
              data-state="expanded"
              aria-label={`Close ${sidePanelTitle.toLowerCase()} sidebar`}
              title={`Close ${sidePanelTitle.toLowerCase()} sidebar`}
              onclick={closeSidePanel}
            >
              <svg
                data-ui-part="sidebar-toggle-icon"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <rect x="1" y="2" width="22" height="20" rx="4"></rect>
                <g transform="translate(24 0) scale(-1 1)">
                  <rect
                    x="4"
                    y="5"
                    width="6"
                    height="14"
                    rx="2"
                    fill="currentColor"
                    data-ui-part="sidebar-toggle-indicator"
                  ></rect>
                </g>
              </svg>
            </Button>
            <strong>{sidePanelTitle}</strong>
            <AppShell.Sidebar.Close onclick={closeSidePanel} />
          </AppShell.Sidebar.Header>
          <AppShell.Sidebar.Body>
            {#if model.thread}
              <CommunityThreadPanel
                thread={model.thread}
                members={model.members}
                {...community?.state.replyTarget === undefined
                  ? {}
                  : { replyTarget: community.state.replyTarget }}
                onSendReply={(_rootMessageId, content) => {
                  community?.handlers.onSendReply?.(_rootMessageId, content);
                  community?.actions.clearReplyTarget();
                  lastAction = "sent-reply";
                }}
                onReply={(messageId) => {
                  community?.actions.setReplyTarget(messageId);
                  lastAction = `replying-to:${messageId}`;
                }}
                onCancelReply={() => community?.actions.clearReplyTarget()}
                onToggleReaction={react}
                onAddReaction={react}
                onCopyMessageLink={(messageId) => {
                  lastAction = `copied-message-link:${messageId}`;
                }}
                onDeleteMessage={(messageId) => {
                  void community?.actions.deleteEvent(messageId);
                  lastAction = `deleted-message:${messageId}`;
                }}
              />
            {:else}
              <CommunitySkeleton
                layout="messages"
                label="Loading thread"
                padded
              />
            {/if}
          </AppShell.Sidebar.Body>
        {:else if activeRoom.kind === "channel" || activeRoom.kind === "forum"}
          <CommunityChannelSettings
            room={activeRoom}
            members={model.members}
            description={model.details?.description ??
              activeRoom.description ??
              "Community channel"}
            onClose={closeSidePanel}
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
    {/if}
  {:else}
    <AppShell.Main>
      <CommunitySkeleton layout="messages" label="Loading community" />
    </AppShell.Main>
  {/if}
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
    font-size: var(--community-text-secondary);
    font-weight: 400;
  }

  .community-workspace__toolbar-start {
    flex: 1;
  }

  .community-workspace__room-title strong {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: var(--community-text-body);
  }

  .community-workspace__toolbar-actions {
    margin-inline-start: auto;
  }
</style>
