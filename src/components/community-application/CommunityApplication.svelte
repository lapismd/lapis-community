<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Alert from "@lapismd/design-core/shadcn/alert";
  import * as Empty from "@lapismd/design-core/shadcn/empty";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import {
    AppShell,
    AppShellController,
    type AppShellDisplayMode,
  } from "@lapismd/design-core/shell";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
  import HashIcon from "@lucide/svelte/icons/hash";
  import HeadphonesIcon from "@lucide/svelte/icons/headphones";
  import LockIcon from "@lucide/svelte/icons/lock";
  import PackageSearchIcon from "@lucide/svelte/icons/package-search";
  import PanelRightIcon from "@lucide/svelte/icons/panel-right";
  import SquareTerminalIcon from "@lucide/svelte/icons/square-terminal";
  import UsersIcon from "@lucide/svelte/icons/users";
  import WifiOffIcon from "@lucide/svelte/icons/wifi-off";
  import XIcon from "@lucide/svelte/icons/x";
  import { untrack, type Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  import type { CommunityController } from "../../community/index.js";
  import CommunityAppShell from "../community-app-shell/CommunityAppShell.svelte";
  import CommunityChannelSettings from "../community-channel-settings/CommunityChannelSettings.svelte";
  import CommunityDetails from "../community-details/CommunityDetails.svelte";
  import CommunityInbox from "../community-inbox/CommunityInbox.svelte";
  import type { CommunityInboxModel } from "../community-inbox/model.js";
  import CommunityNavigation from "../community-navigation/CommunityNavigation.svelte";
  import type {
    CommunityNavigationItemModel,
    CommunityNavigationModel,
    CommunityNavigationSectionActionModel,
    CommunityNavigationSectionModel,
  } from "../community-navigation/model.js";
  import CommunityProfileMenu from "../community-profile-menu/CommunityProfileMenu.svelte";
  import CommunityRelaySettings from "../community-relay-settings/CommunityRelaySettings.svelte";
  import CommunitySettingsNavigation from "../community-settings-navigation/CommunitySettingsNavigation.svelte";
  import CommunitySettings from "../community-settings/CommunitySettings.svelte";
  import CommunityThreadPanel from "../community-thread-panel/CommunityThreadPanel.svelte";
  import CommunityWorkspaceSurface from "../community-workspace/CommunityWorkspaceSurface.svelte";
  import {
    findCommunityRoom,
    memberById,
    type CommunityRoomModel,
    type CommunityMemberModel,
    type CommunitySidePanel,
  } from "../community-workspace/model.js";

  type CommunityApplicationDestination =
    | "inbox"
    | "registry"
    | "settings"
    | string;

  let {
    controller: community,
    shellController,
    initialDestination = "inbox",
    displayMode = "auto",
    mobileBreakpoint = 1024,
    desktopMinMainWidth = 0,
    registry,
    onDestinationChange = () => {},
    onSectionAction = () => {},
    ...restProps
  }: HTMLAttributes<HTMLDivElement> & {
    controller: CommunityController;
    shellController?: AppShellController;
    initialDestination?: CommunityApplicationDestination;
    displayMode?: AppShellDisplayMode;
    mobileBreakpoint?: number;
    desktopMinMainWidth?: number;
    registry?: Snippet;
    onDestinationChange?: (destinationId: string) => void;
    onSectionAction?: (
      section: CommunityNavigationSectionModel,
      action: CommunityNavigationSectionActionModel,
    ) => void;
  } = $props();

  const internalShellController = untrack(
    () =>
      new AppShellController({
        rightClosed: true,
        rightWidth: 320,
        sidebarMinWidth: 48,
        sidebarMaxWidth: 440,
      }),
  );
  const shell = $derived(shellController ?? internalShellController);
  let activeDestination = $state(
    untrack(() => initialDestination) as CommunityApplicationDestination,
  );
  let settingsSection = $state<"profile" | "custom-emoji">("profile");
  let navigationHistory = $state<string[]>([untrack(() => initialDestination)]);
  let navigationHistoryIndex = $state(0);
  let lastAction = $state("ready");
  let relayNoticeDismissed = $state(false);
  let relaySettingsOpen = $state(false);
  let inlineRelayUrl = $state("");
  let inlineRelayCommunityId = $state("");
  let inlineRelayError = $state("");

  const workspace = $derived(community.state.workspace);
  const activeRoom = $derived(
    findCommunityRoom(workspace) ?? fallbackRoom(workspace.activeRoomId),
  );
  const inbox = $derived(
    community.state.inbox ?? fallbackInbox(activeRoom, workspace.members),
  );
  const currentMember = $derived(
    workspace.currentMemberId
      ? memberById(workspace.members, workspace.currentMemberId)
      : undefined,
  );
  const currentCommunity = $derived(
    workspace.communities.find(
      (candidate) => candidate.id === workspace.activeCommunityId,
    ),
  );
  const activeConnection = $derived(
    community.state.connections.find(
      (connection) => connection.communityId === workspace.activeCommunityId,
    ) ?? community.state.connections[0],
  );
  const hasCommunityConnection = $derived(
    community.state.status === "connected",
  );
  const displayMember = $derived<CommunityMemberModel>(
    currentMember ?? fallbackMember(community.state.settings),
  );
  const navigationModel = $derived<CommunityNavigationModel>({
    searchPlaceholder: "Search everything",
    primaryItems: [
      ...(hasCommunityConnection
        ? [{ id: "inbox", label: "Inbox", kind: "inbox" as const }]
        : []),
      {
        id: "registry",
        label: "Registry",
        kind: "registry",
        icon: "package-search",
      },
    ],
    sections: workspace.navigationSections.map((section) => ({
      id: section.id,
      label: section.label,
      ...(section.id === "channels" && community.state.capabilities.channels
        ? {
            primaryAction: { id: "create", label: "Create channel" },
            actions: [
              {
                id: "browse",
                label: "Browse channels",
                icon: "browse" as const,
              },
            ],
          }
        : {}),
      ...(section.id === "forums" && community.state.capabilities.forums
        ? {
            primaryAction: { id: "create", label: "Create forum" },
            actions: [
              { id: "browse", label: "Browse forums", icon: "browse" as const },
            ],
          }
        : {}),
      ...(section.id === "direct-messages" &&
      community.state.capabilities.directMessages
        ? {
            actions: [
              {
                id: "new",
                label: "New direct message",
                icon: "compose" as const,
              },
            ],
          }
        : {}),
      sortable: true,
      items: (hasCommunityConnection ? section.rooms : []).map((room) => ({
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
  const activeItemId = $derived(
    activeDestination === "inbox" || activeDestination === "registry"
      ? activeDestination
      : activeDestination === "settings"
        ? undefined
        : workspace.activeRoomId,
  );
  const navigationCompact = $derived(
    shell.mobile.resolvedMode === "desktop" &&
      shell.left.collapsed &&
      !shell.left.previewed,
  );
  const canNavigateBack = $derived(navigationHistoryIndex > 0);
  const canNavigateForward = $derived(
    navigationHistoryIndex < navigationHistory.length - 1,
  );
  const workspaceSidePanel = $derived<Exclude<CommunitySidePanel, "none">>(
    workspace.sidePanel === "thread" && workspace.thread ? "thread" : "details",
  );
  const detailsRoom = $derived(
    activeDestination === "inbox" ? inbox.room : activeRoom,
  );
  const sidePanelTitle = $derived(
    activeDestination !== "inbox" && workspaceSidePanel === "thread"
      ? "Thread"
      : detailsRoom.kind === "channel"
        ? "Channel settings"
        : detailsRoom.kind === "forum"
          ? "Forum settings"
          : "Conversation details",
  );
  const emojiOperation = $derived.by(() =>
    Object.entries(community.state.operations)
      .filter(([key]) => key.startsWith("settings:emoji:"))
      .map(([, operation]) => operation)
      .find((operation) => operation.status !== "idle"),
  );
  const relayOperation = $derived(
    activeConnection === undefined
      ? undefined
      : community.state.operations[
          `settings:relay:${activeConnection.communityId}`
        ],
  );
  const showRelayNotice = $derived(
    !relayNoticeDismissed &&
      (community.state.status === "error" ||
        community.state.status === "offline"),
  );
  const inlineRelayOperationPending = $derived(
    relayOperation?.status === "pending" ||
      community.state.status === "connecting",
  );
  const inlineRelayMessage = $derived(
    inlineRelayError || relayOperation?.message || community.state.error || "",
  );

  $effect(() => {
    if (community.state.status === "connecting") relayNoticeDismissed = false;
  });

  $effect(() => {
    if (
      activeConnection !== undefined &&
      inlineRelayCommunityId !== activeConnection.communityId
    ) {
      inlineRelayCommunityId = activeConnection.communityId;
      inlineRelayUrl = activeConnection.relayUrl;
      inlineRelayError = "";
    }
  });

  function itemFor(destinationId: string): CommunityNavigationItemModel | null {
    return (
      [
        ...navigationModel.primaryItems,
        ...navigationModel.sections.flatMap((section) => section.items),
      ].find((item) => item.id === destinationId) ?? null
    );
  }

  function setDestination(
    destinationId: CommunityApplicationDestination,
    recordHistory: boolean,
  ): void {
    if (recordHistory && destinationId !== activeDestination) {
      navigationHistory = [
        ...navigationHistory.slice(0, navigationHistoryIndex + 1),
        destinationId,
      ];
      navigationHistoryIndex = navigationHistory.length - 1;
    }
    activeDestination = destinationId;
    if (destinationId === "inbox") {
      community.actions.selectRoom(inbox.room.id);
    } else if (destinationId !== "registry" && destinationId !== "settings") {
      community.actions.selectRoom(destinationId);
    }
    shell.right.close();
    shell.mobile.showMain();
    lastAction = `selected:${destinationId}`;
    onDestinationChange(destinationId);
  }

  function select(item: CommunityNavigationItemModel): void {
    setDestination(item.id, true);
  }

  function openSettings(recordHistory = true): void {
    setDestination("settings", recordHistory);
    shell.left.expand();
    lastAction = "opened-settings";
  }

  function closeSettings(): void {
    if (canNavigateBack) navigateHistory(-1);
    else setDestination("inbox", true);
  }

  function navigateHistory(offset: -1 | 1): void {
    const nextIndex = navigationHistoryIndex + offset;
    const destinationId = navigationHistory[nextIndex];
    if (destinationId === undefined) return;
    navigationHistoryIndex = nextIndex;
    if (destinationId === "settings") openSettings(false);
    else {
      const item = itemFor(destinationId);
      if (item) setDestination(item.id, false);
    }
  }

  function react(messageId: string, emoji: string): void {
    void community.actions.toggleReaction(messageId, emoji);
    lastAction = `reaction:${messageId}:${emoji}`;
  }

  function openSidePanel(panel: Exclude<CommunitySidePanel, "none">): void {
    if (activeDestination !== "inbox" && panel === "details") {
      community.actions.openDetails();
    }
    shell.right.open();
    if (shell.mobile.resolvedMode === "mobile") {
      const returnFocus =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : undefined;
      shell.mobile.show("right", "right", returnFocus);
    }
  }

  function closeSidePanel(): void {
    community.actions.closeSidePanel();
    shell.right.close();
    lastAction = "closed-side-panel";
  }

  function sendWorkspaceMessage(roomId: string, content: string): void {
    if (activeRoom.kind === "direct") {
      const recipients = roomId.replace(/^dm:/u, "").split(",").filter(Boolean);
      void community.actions.sendDirectMessage(recipients, content);
    } else {
      community.handlers.onSendMessage?.(roomId, content);
    }
    lastAction = "sent-message";
  }

  async function reconnect(): Promise<void> {
    relayNoticeDismissed = false;
    try {
      await community.reconnect();
    } catch {
      // The controller exposes the failure through reactive state and the alert.
    }
  }

  async function connectToRelay(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    inlineRelayError = "";
    if (activeConnection === undefined) {
      inlineRelayError = "Community relay settings are unavailable";
      return;
    }
    try {
      await community.actions.updateRelayUrl(
        activeConnection.communityId,
        inlineRelayUrl,
      );
    } catch (cause) {
      inlineRelayError =
        cause instanceof Error ? cause.message : "Community connection failed";
    }
  }

  function fallbackRoom(roomId: string): CommunityRoomModel {
    return {
      id: roomId,
      name: "Community",
      kind: "channel",
      description: "Community conversation",
    };
  }

  function fallbackInbox(
    room: CommunityRoomModel,
    members: CommunityInboxModel["members"],
  ): CommunityInboxModel {
    return {
      items: [],
      activeItemId: "",
      threadTitle: "Inbox",
      room,
      messages: [],
      members,
      participantCount: 0,
    };
  }

  function fallbackMember(
    settings: CommunityController["state"]["settings"],
  ): CommunityMemberModel {
    const name =
      settings.profile.displayName || settings.profile.username || "Guest";
    const initials =
      name
        .split(/\s+/u)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toLocaleUpperCase() ?? "")
        .join("") || "?";
    return {
      id: settings.profile.pubkey || "anonymous",
      name,
      handle: settings.profile.username || "not-signed-in",
      initials,
      ...(settings.profile.picture === ""
        ? {}
        : { avatarUrl: settings.profile.picture }),
      presence: "offline",
    };
  }
</script>

<CommunityAppShell
  controller={shell}
  {displayMode}
  {mobileBreakpoint}
  {desktopMinMainWidth}
  {canNavigateBack}
  {canNavigateForward}
  onNavigateBack={() => navigateHistory(-1)}
  onNavigateForward={() => navigateHistory(1)}
  data-last-action={lastAction}
  data-community-status={community.state.status}
  {...restProps}
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
    {#if activeDestination === "settings"}
      <CommunitySettingsNavigation
        section={settingsSection}
        onSelect={(value) => (settingsSection = value)}
        onClose={closeSettings}
      />
    {:else}
      <CommunityNavigation
        model={navigationModel}
        {...activeItemId === undefined ? {} : { activeItemId }}
        compact={navigationCompact}
        onSelect={select}
        onSearch={(query) => void community.actions.search(query)}
        {onSectionAction}
        onRequestExpand={() => shell.left.expand()}
      >
        {#snippet footer()}
          {#if showRelayNotice && !navigationCompact}
            <Alert.Root class="community-application__relay-alert">
              <Button
                type="button"
                variant="ghost"
                class="community-application__relay-connect"
                aria-label="Reconnect to community relay"
                onclick={reconnect}
              >
                <WifiOffIcon aria-hidden="true" />
                <span class="community-application__relay-copy">
                  <Alert.Title>Connection lost</Alert.Title>
                  <Alert.Description>
                    {community.state.error ??
                      "Unable to connect to the community relay."}
                  </Alert.Description>
                  <span class="community-application__relay-action-label">
                    Connect to relay
                  </span>
                </span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                class="community-application__relay-dismiss"
                aria-label="Dismiss relay notification"
                title="Dismiss relay notification"
                onclick={() => (relayNoticeDismissed = true)}
              >
                <XIcon aria-hidden="true" />
              </Button>
            </Alert.Root>
          {/if}
          <CommunityProfileMenu
            member={{
              ...displayMember,
              presence:
                community.state.status === "connected" ? "online" : "offline",
            }}
            communityName={currentCommunity?.name ?? "Community"}
            compact={navigationCompact}
            connectionStatus={community.state.status}
            canManageCommunity={community.state.capabilities.manageMembers}
            onAction={(action) => {
              if (action === "settings") openSettings();
              if (action === "community-settings") relaySettingsOpen = true;
            }}
          />
        {/snippet}
      </CommunityNavigation>
    {/if}
  </AppShell.Sidebar>

  <AppShell.Main>
    {#if !hasCommunityConnection}
      <AppShell.Body layout="regions" label="Connect to community relay">
        <AppShell.Body.Content label="Relay connection settings">
          <section class="community-application__disconnected">
            <Empty.Root>
              <Empty.Header>
                <Empty.Media variant="icon">
                  <WifiOffIcon aria-hidden="true" />
                </Empty.Media>
                <Empty.Title>Connect to a community relay</Empty.Title>
                <Empty.Description>
                  Enter the WebSocket URL for the relay that hosts this
                  community.
                </Empty.Description>
              </Empty.Header>
              <Empty.Content>
                <form
                  class="community-application__relay-form"
                  onsubmit={connectToRelay}
                >
                  <Field.Field
                    data-invalid={inlineRelayMessage ? "" : undefined}
                  >
                    <Field.Label for="community-connect-relay-url">
                      Relay URL
                    </Field.Label>
                    <Input
                      id="community-connect-relay-url"
                      type="url"
                      bind:value={inlineRelayUrl}
                      placeholder="wss://relay.example.com"
                      aria-invalid={inlineRelayMessage ? true : undefined}
                      required
                    />
                    {#if inlineRelayMessage}
                      <Field.Error>{inlineRelayMessage}</Field.Error>
                    {/if}
                  </Field.Field>
                  <Button
                    type="submit"
                    disabled={inlineRelayOperationPending ||
                      inlineRelayUrl.trim() === ""}
                  >
                    {inlineRelayOperationPending
                      ? "Connecting…"
                      : "Connect to relay"}
                  </Button>
                </form>
              </Empty.Content>
            </Empty.Root>
          </section>
        </AppShell.Body.Content>
      </AppShell.Body>
    {:else if activeDestination === "settings"}
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
              community.actions.updateProfile(profile)}
            onAddCustomEmoji={(shortcode, url) =>
              community.actions.setCustomEmoji(shortcode, url)}
            onRemoveCustomEmoji={(shortcode) =>
              community.actions.removeCustomEmoji(shortcode)}
          />
        </AppShell.Body.Content>
      </AppShell.Body>
    {:else if activeDestination === "inbox"}
      <CommunityInbox
        model={inbox}
        onSelect={() => void community.actions.markRead(inbox.room.id)}
        onSend={(content) =>
          void community.actions.sendReply(inbox.activeItemId, content)}
        onMarkAllRead={() => void community.actions.markAllRead()}
        onOpenChannelSettings={() => {
          openSidePanel("details");
          lastAction = "opened-details";
        }}
      />
    {:else if activeDestination === "registry"}
      <AppShell.Body layout="regions" label="Plugin registry">
        <AppShell.Body.Content label="Registry content">
          {#if registry}
            {@render registry()}
          {:else}
            <section class="community-application__registry-empty">
              <PackageSearchIcon aria-hidden="true" />
              <h1>Plugin registry</h1>
              <p>The host application can provide its registry surface here.</p>
            </section>
          {/if}
        </AppShell.Body.Content>
      </AppShell.Body>
    {:else}
      <AppShell.Toolbar label={`${activeRoom.name} toolbar`}>
        <div class="community-application__toolbar-start">
          {#if navigationCompact || shell.mobile.resolvedMode === "mobile"}
            <AppShell.Sidebar.Toggle side="left" sidebarName="navigation" />
          {/if}
          <div class="community-application__room-title">
            <strong>
              {#if activeRoom.private || activeRoom.kind === "direct"}
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
        <div class="community-application__toolbar-actions">
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
              aria-label={`View ${activeRoom.kind === "forum" ? "forum" : activeRoom.kind === "direct" ? "conversation" : "channel"} members (${activeRoom.memberCount})`}
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
            aria-label={`Manage ${activeRoom.kind === "forum" ? "forum" : activeRoom.kind === "direct" ? "conversation" : "channel"}`}
            title={`Manage ${activeRoom.kind === "forum" ? "forum" : activeRoom.kind === "direct" ? "conversation" : "channel"}`}
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
            model={workspace}
            handlers={{
              ...community.handlers,
              onSelectRoom: (roomId) => setDestination(roomId, false),
              onSendMessage: sendWorkspaceMessage,
              onOpenTopic: (topicId) => {
                community.actions.openTopic(topicId);
                shell.right.close();
                lastAction = `opened-topic:${topicId}`;
              },
              onOpenThread: (messageId) => {
                community.actions.openThread(messageId);
                openSidePanel("thread");
                lastAction = `opened-thread:${messageId}`;
              },
              onToggleReaction: react,
              onAddReaction: react,
              onCopyMessageLink: (messageId) => {
                lastAction = `copied-message-link:${messageId}`;
              },
              onDeleteMessage: (messageId) => {
                void community.actions.deleteEvent(messageId);
                lastAction = `deleted-message:${messageId}`;
              },
            }}
          />
        </AppShell.Body.Content>
      </AppShell.Body>
    {/if}
  </AppShell.Main>

  <AppShell.Sidebar
    side="right"
    label={`${sidePanelTitle} sidebar`}
    mobileLabel={sidePanelTitle}
    resizeLabel={`Resize ${sidePanelTitle.toLowerCase()} sidebar`}
    closeable
  >
    {#if activeDestination !== "inbox" && workspaceSidePanel === "thread" && workspace.thread}
      <AppShell.Sidebar.Header>
        <PanelRightIcon aria-hidden="true" />
        <strong>{sidePanelTitle}</strong>
        <AppShell.Sidebar.Close onclick={closeSidePanel} />
      </AppShell.Sidebar.Header>
      <AppShell.Sidebar.Body>
        <CommunityThreadPanel
          thread={workspace.thread}
          members={workspace.members}
          onSendReply={(rootMessageId, content) => {
            community.handlers.onSendReply?.(rootMessageId, content);
            lastAction = "sent-reply";
          }}
          onToggleReaction={react}
          onAddReaction={react}
          onCopyMessageLink={(messageId) => {
            lastAction = `copied-message-link:${messageId}`;
          }}
          onDeleteMessage={(messageId) => {
            void community.actions.deleteEvent(messageId);
            lastAction = `deleted-message:${messageId}`;
          }}
        />
      </AppShell.Sidebar.Body>
    {:else if detailsRoom.kind === "channel" || detailsRoom.kind === "forum"}
      <CommunityChannelSettings
        room={detailsRoom}
        members={workspace.members}
        description={activeDestination === "inbox"
          ? (inbox.room.description ?? "Community channel")
          : (workspace.details?.description ??
            detailsRoom.description ??
            "Community channel")}
        onAction={(action) => {
          lastAction = `channel-settings:${action}`;
        }}
      />
    {:else if workspace.details}
      <AppShell.Sidebar.Header>
        <strong>{sidePanelTitle}</strong>
        <AppShell.Sidebar.Close onclick={closeSidePanel} />
      </AppShell.Sidebar.Header>
      <AppShell.Sidebar.Body>
        <CommunityDetails
          room={detailsRoom}
          details={workspace.details}
          members={workspace.members}
        />
      </AppShell.Sidebar.Body>
    {/if}
  </AppShell.Sidebar>
</CommunityAppShell>

{#if activeConnection}
  <CommunityRelaySettings
    bind:open={relaySettingsOpen}
    connection={activeConnection}
    {...relayOperation === undefined ? {} : { operation: relayOperation }}
    onSave={(relayUrl) =>
      community.actions.updateRelayUrl(activeConnection.communityId, relayUrl)}
  />
{/if}

<style>
  .community-application__toolbar-start,
  .community-application__toolbar-actions {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.5rem;
  }

  .community-application__disconnected {
    display: grid;
    height: 100%;
    min-height: 0;
    place-items: center;
    padding: 2rem;
  }

  .community-application__disconnected :global([data-ui-part="empty"]) {
    width: min(100%, 32rem);
  }

  .community-application__relay-form {
    display: grid;
    width: min(100%, 24rem);
    gap: 1rem;
    text-align: start;
  }

  :global(.community-application__relay-alert[data-ui-component="alert"]) {
    position: relative;
    display: block;
    width: auto;
    margin: 0.5rem 0.75rem 0;
    padding: 0;
    overflow: hidden;
    border-color: var(--sidebar-border, var(--border));
    background: var(--sidebar-accent, var(--accent));
  }

  :global(.community-application__relay-connect[data-ui-component="button"]) {
    display: grid;
    width: 100%;
    height: auto;
    min-height: 5rem;
    grid-template-columns: 1.125rem minmax(0, 1fr);
    align-items: start;
    justify-content: stretch;
    gap: 0.625rem;
    padding: 0.75rem 2.75rem 0.75rem 0.75rem;
    border-radius: inherit;
    text-align: start;
    white-space: normal;
  }

  :global(.community-application__relay-connect > svg) {
    margin-block-start: 0.125rem;
  }

  .community-application__relay-copy {
    display: grid;
    min-width: 0;
    gap: 0.125rem;
  }

  .community-application__relay-copy :global([data-ui-part="alert-title"]),
  .community-application__relay-copy
    :global([data-ui-part="alert-description"]) {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .community-application__relay-copy
    :global([data-ui-part="alert-description"]) {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    font-size: 0.72rem;
  }

  .community-application__relay-action-label {
    margin-block-start: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
  }

  :global(.community-application__relay-dismiss[data-ui-component="button"]) {
    position: absolute;
    z-index: 1;
    inset-block-start: 50%;
    inset-inline-end: 0.5rem;
    transform: translateY(-50%);
  }

  .community-application__toolbar-start {
    flex: 1;
  }

  .community-application__room-title {
    display: grid;
    min-width: 0;
  }

  .community-application__room-title strong {
    display: flex;
    overflow: hidden;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.88rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .community-application__toolbar-actions {
    margin-inline-start: auto;
  }

  .community-application__registry-empty {
    display: grid;
    width: min(100% - 2rem, 40rem);
    min-height: 100%;
    margin: 0 auto;
    align-content: center;
    justify-items: center;
    gap: 0.75rem;
    text-align: center;
  }

  .community-application__registry-empty :global(svg) {
    width: 2rem;
    height: 2rem;
    color: var(--primary);
  }

  .community-application__registry-empty h1,
  .community-application__registry-empty p {
    margin: 0;
  }

  .community-application__registry-empty p {
    color: var(--muted-foreground);
  }
</style>
