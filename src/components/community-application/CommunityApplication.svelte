<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Alert from "@lapismd/design-core/shadcn/alert";
  import * as AlertDialog from "@lapismd/design-core/shadcn/alert-dialog";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
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
  import SquareTerminalIcon from "@lucide/svelte/icons/square-terminal";
  import UsersIcon from "@lucide/svelte/icons/users";
  import WifiOffIcon from "@lucide/svelte/icons/wifi-off";
  import XIcon from "@lucide/svelte/icons/x";
  import { nip19 } from "nostr-tools";
  import { toast, Toaster } from "svelte-sonner";
  import { untrack, type Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  import type {
    CommunityApplicationExtensions,
    CommunityController,
    CommunityLinkBuilder,
  } from "../../community/index.js";
  import {
    registryRouteFromDestination,
    registryRouteToDestination,
    type RegistryRoute,
  } from "../../registry/index.js";
  import CommunityAppShell from "../community-app-shell/CommunityAppShell.svelte";
  import CommunityChannelSettings from "../community-channel-settings/CommunityChannelSettings.svelte";
  import CommunityEmojiPicker from "../community-emoji-picker/CommunityEmojiPicker.svelte";
  import CommunityDetails from "../community-details/CommunityDetails.svelte";
  import CommunityDirectMessageComposer from "../community-direct-message-composer/CommunityDirectMessageComposer.svelte";
  import CommunityInbox from "../community-inbox/CommunityInbox.svelte";
  import type { CommunityInboxModel } from "../community-inbox/model.js";
  import CommunityNavigation from "../community-navigation/CommunityNavigation.svelte";
  import CommunityMemberCommand from "../community-member-command/CommunityMemberCommand.svelte";
  import CommunityMemberProfile from "../community-member-profile/CommunityMemberProfile.svelte";
  import type {
    CommunityNavigationItemModel,
    CommunityNavigationItemAction,
    CommunityNavigationModel,
    CommunityNavigationSectionActionModel,
    CommunityNavigationSectionModel,
  } from "../community-navigation/model.js";
  import CommunityProfileMenu from "../community-profile-menu/CommunityProfileMenu.svelte";
  import CommunityRelaySettings from "../community-relay-settings/CommunityRelaySettings.svelte";
  import CommunityRoomBrowser from "../community-room-browser/CommunityRoomBrowser.svelte";
  import CommunityRoomEditor from "../community-room-editor/CommunityRoomEditor.svelte";
  import CommunitySearchCommand from "../community-search-command/CommunitySearchCommand.svelte";
  import { projectCommunitySearchResults } from "../community-search-command/model.js";
  import CommunitySettingsNavigation from "../community-settings-navigation/CommunitySettingsNavigation.svelte";
  import CommunitySettings from "../community-settings/CommunitySettings.svelte";
  import CommunityThreadPanel from "../community-thread-panel/CommunityThreadPanel.svelte";
  import CommunityTopicComposer from "../community-topic-composer/CommunityTopicComposer.svelte";
  import CommunityWorkspaceSurface from "../community-workspace/CommunityWorkspaceSurface.svelte";
  import RegistryBrowser from "../registry-browser/RegistryBrowser.svelte";
  import type { RegistryBrowserOptions } from "../registry-browser/model.js";
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
  type CommunityAuthenticatedAction = () => void | Promise<void>;

  let {
    controller: community,
    shellController,
    initialDestination = "inbox",
    displayMode = "auto",
    mobileBreakpoint = 1024,
    desktopMinMainWidth = 0,
    registry,
    registryOptions,
    extensions = {},
    linkBuilder,
    onAuthenticationRequired = async (action) => void (await action()),
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
    registryOptions?: RegistryBrowserOptions;
    extensions?: CommunityApplicationExtensions;
    linkBuilder?: CommunityLinkBuilder;
    onAuthenticationRequired?: (
      action: CommunityAuthenticatedAction,
    ) => Promise<void>;
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
  let registryRoute = $state<RegistryRoute>(
    registryRouteFromDestination(untrack(() => initialDestination)) ?? {
      page: "landing",
    },
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
  let roomEditorOpen = $state(false);
  let roomEditorMode = $state<"create" | "edit">("edit");
  let roomEditorKind = $state<"channel" | "forum">("channel");
  let roomBrowserOpen = $state(false);
  let roomBrowserKind = $state<"all" | "channel" | "forum">("all");
  let memberCommandOpen = $state(false);
  let memberCommandMode = $state<"view" | "manage" | "select">("view");
  let selectedRecipientIds = $state<string[]>([]);
  let topicComposerOpen = $state(false);
  let confirmation = $state<"leave" | "delete" | null>(null);
  let statusOpen = $state(false);
  let statusDraft = $state("");
  let searchOpen = $state(false);
  let appSearchQuery = $state("");
  let sectionEditorOpen = $state(false);
  let sectionEditorMode = $state<"create" | "rename">("create");
  let sectionEditorId = $state("");
  let sectionName = $state("");
  let selectedProfile = $state<CommunityMemberModel | null>(null);

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
  const hasCachedCommunityData = $derived(
    community.state.status === "offline" &&
      community.state.cache.freshness === "offline" &&
      workspace.navigationSections.some((section) => section.rooms.length > 0),
  );
  const hasCommunitySurface = $derived(
    hasCommunityConnection || hasCachedCommunityData,
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
    sections: [
      ...workspace.navigationSections.map((section) => ({
        id: section.id,
        label: section.label,
        ...(section.id === "channels" && community.state.capabilities.channels
          ? {
              primaryAction: { id: "create", label: "Create channel" },
              actions: [
                {
                  id: "browse",
                  label: "Browse channels",
                  icon: "browse-channels" as const,
                },
                { id: "new-section", label: "New section" },
              ],
            }
          : {}),
        ...(section.id === "forums" && community.state.capabilities.forums
          ? {
              primaryAction: { id: "create", label: "Create forum" },
              actions: [
                {
                  id: "browse",
                  label: "Browse forums",
                  icon: "browse-forums" as const,
                },
                { id: "new-section", label: "New section" },
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
        items: (hasCommunitySurface ? section.rooms : [])
          .filter(
            (room) =>
              !community.state.navigation.hiddenRoomIds.includes(room.id),
          )
          .filter(
            (room) =>
              !community.state.navigation.sections.some((custom) =>
                custom.roomIds.includes(room.id),
              ),
          )
          .map((room) => ({
            id: room.id,
            label: room.name,
            kind:
              room.kind === "direct" ? ("direct-message" as const) : room.kind,
            ...(room.private === undefined ? {} : { restricted: room.private }),
            ...(room.mentionCount === undefined &&
            room.unreadCount === undefined
              ? {}
              : { unreadCount: room.mentionCount ?? room.unreadCount }),
            starred: community.state.navigation.starredRoomIds.includes(
              room.id,
            ),
            muted: community.state.navigation.mutedRoomIds.includes(room.id),
            settingsDisabled:
              room.permissions?.update.state === "denied" ||
              room.permissions?.update.state === "unsupported",
            leaveDisabled:
              room.permissions?.leave.state === "denied" ||
              room.permissions?.leave.state === "unsupported",
            deleteDisabled:
              room.permissions?.delete.state === "denied" ||
              room.permissions?.delete.state === "unsupported",
            ...(room.permissions?.update.reason
              ? { settingsReason: room.permissions.update.reason }
              : {}),
            ...(room.permissions?.leave.reason
              ? { leaveReason: room.permissions.leave.reason }
              : {}),
            ...(room.permissions?.delete.reason
              ? { deleteReason: room.permissions.delete.reason }
              : {}),
          })),
      })),
      ...community.state.navigation.sections.map((section) => ({
        id: section.id,
        label: section.name,
        actions: [
          { id: "rename-section", label: "Rename section" },
          { id: "delete-section", label: "Delete section" },
        ],
        sortable: true,
        items: workspace.navigationSections
          .flatMap((candidate) => candidate.rooms)
          .filter((room) => section.roomIds.includes(room.id))
          .map((room) => ({
            id: room.id,
            label: room.name,
            kind:
              room.kind === "direct" ? ("direct-message" as const) : room.kind,
            starred: community.state.navigation.starredRoomIds.includes(
              room.id,
            ),
            muted: community.state.navigation.mutedRoomIds.includes(room.id),
          })),
      })),
    ],
  });
  const allRooms = $derived(
    workspace.navigationSections.flatMap((section) => section.rooms),
  );
  const searchRooms = $derived(
    allRooms.filter((room) =>
      `${room.name} ${room.description ?? ""}`
        .toLocaleLowerCase()
        .includes(appSearchQuery.toLocaleLowerCase()),
    ),
  );
  const projectedSearchResults = $derived(
    projectCommunitySearchResults(community.state.searchResults),
  );
  const searchMessages = $derived(
    [
      ...workspace.messages.filter((message) =>
        message.content
          .toLocaleLowerCase()
          .includes(appSearchQuery.toLocaleLowerCase()),
      ),
      ...projectedSearchResults.messages,
    ].filter(
      (message, index, values) =>
        values.findIndex((candidate) => candidate.id === message.id) === index,
    ),
  );
  const searchMembers = $derived(
    [
      ...workspace.members.filter((member) =>
        `${member.name} ${member.handle}`
          .toLocaleLowerCase()
          .includes(appSearchQuery.toLocaleLowerCase()),
      ),
      ...projectedSearchResults.members,
    ].filter(
      (member, index, values) =>
        values.findIndex((candidate) => candidate.id === member.id) === index,
    ),
  );
  const selectedRecipients = $derived(
    selectedRecipientIds
      .map((id) => workspace.members.find((member) => member.id === id))
      .filter((member) => member !== undefined),
  );
  const isRegistryDestination = $derived(
    registryRouteFromDestination(activeDestination) !== null,
  );
  const activeItemId = $derived(
    activeDestination === "inbox" || isRegistryDestination
      ? activeDestination === "inbox"
        ? "inbox"
        : "registry"
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
    selectedProfile
      ? "Profile"
      : activeDestination !== "inbox" && workspaceSidePanel === "thread"
        ? "Thread"
        : detailsRoom.kind === "channel"
          ? "Channel settings"
          : detailsRoom.kind === "forum"
            ? "Forum settings"
            : "Conversation details",
  );

  function openProfile(member: CommunityMemberModel): void {
    selectedProfile = member;
    shell.right.open();
    if (shell.mobile.resolvedMode === "mobile") {
      const returnFocus =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : undefined;
      shell.mobile.show("right", "right", returnFocus);
    }
    lastAction = `opened-profile:${member.id}`;
  }
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

  async function runAuthenticated(
    action: CommunityAuthenticatedAction,
  ): Promise<void> {
    if (community.state.authentication.status === "connected") {
      await action();
      return;
    }
    await onAuthenticationRequired(action);
  }

  $effect(() => {
    if (
      hasCachedCommunityData &&
      activeDestination === "inbox" &&
      workspace.activeRoomId !== ""
    ) {
      activeDestination = workspace.activeRoomId;
    }
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
    selectedProfile = null;
    if (recordHistory && destinationId !== activeDestination) {
      navigationHistory = [
        ...navigationHistory.slice(0, navigationHistoryIndex + 1),
        destinationId,
      ];
      navigationHistoryIndex = navigationHistory.length - 1;
    }
    activeDestination = destinationId;
    const nextRegistryRoute = registryRouteFromDestination(destinationId);
    if (nextRegistryRoute !== null) registryRoute = nextRegistryRoute;
    if (destinationId === "inbox") {
      community.actions.selectRoom(inbox.room.id);
    } else if (nextRegistryRoute === null && destinationId !== "settings") {
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

  function navigateRegistry(next: RegistryRoute): void {
    setDestination(registryRouteToDestination(next), true);
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
    else if (registryRouteFromDestination(destinationId) !== null) {
      setDestination(destinationId, false);
    } else {
      const item = itemFor(destinationId);
      if (item) setDestination(item.id, false);
    }
  }

  function react(
    messageId: string,
    emoji: string,
    custom?: { shortcode: string; url: string },
  ): void {
    void runAuthenticated(() =>
      community.actions.toggleReaction(messageId, emoji, custom),
    ).catch((cause) =>
      toast.error(
        cause instanceof Error ? cause.message : "Reaction could not be saved",
      ),
    );
    lastAction = `reaction:${messageId}:${emoji}`;
  }

  async function copyText(value: string, success: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(success);
    } catch {
      toast.error("Could not copy to the clipboard");
    }
  }

  function copyMessageLink(messageId: string): void {
    if (activeRoom.kind === "direct") return;
    const message =
      workspace.messages.find((candidate) => candidate.id === messageId) ??
      workspace.thread?.messages.find(
        (candidate) => candidate.id === messageId,
      );
    if (!message || !activeConnection) return;
    const url =
      linkBuilder?.message({
        eventId: message.id,
        authorPubkey: message.authorId,
        relayUrl: activeConnection.relayUrl,
      }) ??
      `nostr:${nip19.neventEncode({ id: message.id, author: message.authorId, relays: [activeConnection.relayUrl] })}`;
    void copyText(url, "Message link copied");
    lastAction = `copied-message-link:${messageId}`;
  }

  function copyMessage(messageId: string): void {
    const message =
      workspace.messages.find((candidate) => candidate.id === messageId) ??
      workspace.thread?.messages.find(
        (candidate) => candidate.id === messageId,
      );
    if (message) void copyText(message.content, "Message copied");
  }

  function openRoomEditor(
    kind: "channel" | "forum",
    mode: "create" | "edit",
  ): void {
    roomEditorKind = kind;
    roomEditorMode = mode;
    roomEditorOpen = true;
  }

  function openRoomBrowser(kind: "all" | "channel" | "forum" = "all"): void {
    roomBrowserKind = kind;
    roomBrowserOpen = true;
  }

  function handleSectionAction(
    section: CommunityNavigationSectionModel,
    action: CommunityNavigationSectionActionModel,
  ): void {
    if (action.id === "browse")
      openRoomBrowser(section.id === "forums" ? "forum" : "channel");
    else if (action.id === "create")
      void runAuthenticated(() =>
        openRoomEditor(section.id === "forums" ? "forum" : "channel", "create"),
      );
    else if (action.id === "new") {
      memberCommandMode = "select";
      selectedRecipientIds = [];
      setDestination("new-direct-message", true);
      memberCommandOpen = true;
    } else if (action.id === "new-section") {
      sectionEditorMode = "create";
      sectionName = "";
      sectionEditorOpen = true;
    } else if (action.id === "rename-section") {
      sectionEditorMode = "rename";
      sectionEditorId = section.id;
      sectionName = section.label;
      sectionEditorOpen = true;
    } else if (action.id === "delete-section") {
      void community.actions.deleteNavigationSection(section.id).then(
        () => toast.success("Section deleted"),
        (cause) =>
          toast.error(
            cause instanceof Error
              ? cause.message
              : "Section could not be deleted",
          ),
      );
    }
    onSectionAction(section, action);
  }

  function handleItemAction(
    item: CommunityNavigationItemModel,
    action: CommunityNavigationItemAction,
  ): void {
    const run = async (): Promise<void> => {
      if (action === "copy-link" && activeConnection)
        await copyText(
          `${activeConnection.relayUrl}#${encodeURIComponent(item.id)}`,
          "Room link copied",
        );
      if (action === "copy-name")
        await copyText(item.label, "Channel name copied");
      if (action === "copy-id") await copyText(item.id, "Channel ID copied");
      if (action === "mark-read") await community.actions.markRead(item.id);
      if (action === "mark-unread") await community.actions.markUnread(item.id);
      if (action === "star" || action === "unstar")
        await community.actions.setRoomStarred(item.id, action === "star");
      if (action === "mute" || action === "unmute")
        await community.actions.setRoomMuted(item.id, action === "mute");
      if (action === "hide")
        await community.actions.setRoomHidden(item.id, true);
      if (action === "archive") await extensions.archive?.(item.id);
      if (action.startsWith("section:"))
        await community.actions.assignRoomToSection(
          item.id,
          action.slice("section:".length) || undefined,
        );
      if (action === "create-section") {
        sectionEditorMode = "create";
        sectionName = "";
        sectionEditorOpen = true;
      }
      if (action === "settings") {
        setDestination(item.id, false);
        openSidePanel("details");
      }
      if (action === "leave" || action === "delete") {
        setDestination(item.id, false);
        confirmation = action;
      }
    };
    void run().catch((cause) =>
      toast.error(cause instanceof Error ? cause.message : "The action failed"),
    );
  }

  async function confirmRoomAction(): Promise<void> {
    const action = confirmation;
    confirmation = null;
    try {
      await runAuthenticated(async () => {
        if (action === "leave") await community.actions.leave(activeRoom.id);
        if (action === "delete")
          await community.actions.deleteRoom(activeRoom.id);
      });
      toast.success(action === "leave" ? "You left the room" : "Room deleted");
      closeSidePanel();
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message
          : "The relay rejected this action",
      );
    }
  }

  async function saveRoom(
    update: Parameters<CommunityController["actions"]["updateRoom"]>[1],
  ): Promise<void> {
    await runAuthenticated(async () => {
      if (roomEditorMode === "create")
        await community.actions.createRoom(roomEditorKind, update);
      else await community.actions.updateRoom(activeRoom.id, update);
    });
    toast.success(
      roomEditorMode === "create"
        ? `${roomEditorKind === "forum" ? "Forum" : "Channel"} created`
        : "Room settings saved",
    );
    closeSidePanel();
  }

  function selectMember(member: CommunityMemberModel): void {
    if (memberCommandMode === "select") {
      selectedRecipientIds = selectedRecipientIds.includes(member.id)
        ? selectedRecipientIds.filter((id) => id !== member.id)
        : selectedRecipientIds.length < 8
          ? [...selectedRecipientIds, member.id]
          : selectedRecipientIds;
      return;
    }
    if (memberCommandMode === "manage") {
      void runAuthenticated(() =>
        community.actions.addMember(activeRoom.id, member.id),
      ).then(
        () => toast.success(`${member.name} added`),
        (cause) =>
          toast.error(
            cause instanceof Error
              ? cause.message
              : "The relay rejected this member change",
          ),
      );
      return;
    }
    selectedRecipientIds = [member.id];
    memberCommandOpen = false;
    setDestination("new-direct-message", true);
  }

  function startDirectMessage(): void {
    if (!selectedRecipientIds.length) return;
    memberCommandOpen = false;
    if (activeDestination !== "new-direct-message") {
      community.actions.openDirectMessage(selectedRecipientIds);
      setDestination(`dm:${selectedRecipientIds.join(",")}`, true);
    }
  }

  async function saveStatus(): Promise<void> {
    try {
      await runAuthenticated(() => community.actions.updateStatus(statusDraft));
      statusOpen = false;
      toast.success("Status updated");
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Status could not be updated",
      );
    }
  }

  async function sendThreadReply(
    rootMessageId: string,
    content: string,
  ): Promise<void> {
    try {
      await runAuthenticated(() =>
        community.actions.sendReply(rootMessageId, content),
      );
      community.actions.clearReplyTarget();
      lastAction = "sent-reply";
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Reply could not be sent",
      );
      throw cause;
    }
  }

  async function sendNewDirectMessage(content: string): Promise<void> {
    try {
      await runAuthenticated(() =>
        community.actions.sendDirectMessage(selectedRecipientIds, content),
      );
      community.actions.openDirectMessage(selectedRecipientIds);
      setDestination(`dm:${selectedRecipientIds.join(",")}`, true);
      toast.success("Message sent");
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Message could not be sent",
      );
      throw cause;
    }
  }

  async function saveSection(): Promise<void> {
    try {
      if (sectionEditorMode === "create")
        await community.actions.createNavigationSection(sectionName);
      else
        await community.actions.renameNavigationSection(
          sectionEditorId,
          sectionName,
        );
      sectionEditorOpen = false;
      toast.success(
        sectionEditorMode === "create" ? "Section created" : "Section renamed",
      );
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Section could not be saved",
      );
    }
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
    selectedProfile = null;
    community.actions.closeSidePanel();
    shell.right.close();
    lastAction = "closed-side-panel";
  }

  async function sendWorkspaceMessage(
    roomId: string,
    content: string,
  ): Promise<void> {
    try {
      await runAuthenticated(async () => {
        if (activeRoom.kind === "direct") {
          const recipients = roomId
            .replace(/^dm:/u, "")
            .split(",")
            .filter(Boolean);
          await community.actions.sendDirectMessage(
            recipients,
            content,
            community.state.replyTarget?.eventId,
          );
        } else if (community.state.replyTarget) {
          await community.actions.sendReply(
            community.state.replyTarget.eventId,
            content,
          );
        } else {
          await community.actions.sendMessage(roomId, content);
        }
      });
      community.actions.clearReplyTarget();
      lastAction = "sent-message";
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Message could not be sent",
      );
      throw cause;
    }
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
        onSearch={(query) => {
          appSearchQuery = query;
          searchOpen = query.trim() !== "";
          void community.actions.search(query);
        }}
        onSectionAction={handleSectionAction}
        onItemAction={handleItemAction}
        customSections={community.state.navigation.sections.map((section) => ({
          id: section.id,
          label: section.name,
        }))}
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
                  <Alert.Title>
                    {hasCachedCommunityData
                      ? `Offline — showing data${community.state.cache.lastSynchronizedAt === undefined ? "" : ` from ${new Date(community.state.cache.lastSynchronizedAt * 1_000).toLocaleString()}`}`
                      : "Connection lost"}
                  </Alert.Title>
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
            canSendFeedback={extensions.feedback !== undefined}
            onAction={(action) => {
              if (action === "settings") openSettings();
              if (action === "community-settings") relaySettingsOpen = true;
              if (action === "update-status")
                void runAuthenticated(() => {
                  statusOpen = true;
                });
              if (action === "manage-members") {
                void runAuthenticated(() => {
                  memberCommandMode = "manage";
                  memberCommandOpen = true;
                });
              }
              if (action === "send-feedback") void extensions.feedback?.();
            }}
          />
        {/snippet}
      </CommunityNavigation>
    {/if}
  </AppShell.Sidebar>

  <AppShell.Main>
    {#if isRegistryDestination}
      {#if registry}
        <AppShell.Body layout="regions" label="Plugin registry">
          <AppShell.Body.Content label="Registry content">
            {@render registry()}
          </AppShell.Body.Content>
        </AppShell.Body>
      {:else if registryOptions}
        <RegistryBrowser
          {...registryOptions}
          bind:route={registryRoute}
          onRouteChange={navigateRegistry}
        />
      {:else}
        <AppShell.Body layout="regions" label="Plugin registry">
          <AppShell.Body.Content label="Registry content">
            <section class="community-application__registry-empty">
              <PackageSearchIcon aria-hidden="true" />
              <h1>Plugin registry is not configured</h1>
              <p>
                Provide <code>registryOptions</code> with a catalog source, or
                use the legacy <code>registry</code> snippet override.
              </p>
            </section>
          </AppShell.Body.Content>
        </AppShell.Body>
      {/if}
    {:else if !hasCommunitySurface}
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
              runAuthenticated(() => community.actions.updateProfile(profile))}
            onAddCustomEmoji={(shortcode, url) =>
              runAuthenticated(() =>
                community.actions.setCustomEmoji(shortcode, url),
              )}
            onRemoveCustomEmoji={(shortcode) =>
              runAuthenticated(() =>
                community.actions.removeCustomEmoji(shortcode),
              )}
          />
        </AppShell.Body.Content>
      </AppShell.Body>
    {:else if activeDestination === "inbox"}
      <CommunityInbox
        model={inbox}
        onSelect={() => void community.actions.markRead(inbox.room.id)}
        onSend={(content) => sendThreadReply(inbox.activeItemId, content)}
        onMarkAllRead={() => void community.actions.markAllRead()}
        onOpenChannelSettings={() => {
          openSidePanel("details");
          lastAction = "opened-details";
        }}
        onOpenChannel={() => setDestination(inbox.room.id, true)}
        onViewParticipants={() => {
          memberCommandMode = "view";
          memberCommandOpen = true;
        }}
        {...extensions.huddle === undefined
          ? {}
          : { onHuddle: () => extensions.huddle?.(inbox.room.id) }}
        onReply={(messageId) => community.actions.setReplyTarget(messageId)}
        onToggleReaction={react}
        onOpenProfile={openProfile}
        {...inbox.room.kind === "direct"
          ? {}
          : { onCopyMessageLink: copyMessageLink }}
        onCopyMessage={copyMessage}
        {...extensions.editMessage === undefined
          ? {}
          : { onEditMessage: extensions.editMessage }}
        onDeleteMessage={(messageId) =>
          void runAuthenticated(() =>
            community.actions.deleteEvent(messageId),
          ).then(
            () => toast.success("Message deleted"),
            (cause) =>
              toast.error(
                cause instanceof Error
                  ? cause.message
                  : "The relay rejected this deletion",
              ),
          )}
        {...community.state.replyTarget === undefined
          ? {}
          : { replyTarget: community.state.replyTarget }}
        communityEmojis={community.state.settings.customEmojis}
        onCancelReply={() => community.actions.clearReplyTarget()}
      />
    {:else if activeDestination === "new-direct-message"}
      <AppShell.Body layout="regions" label="New direct message">
        <AppShell.Body.Content>
          <CommunityDirectMessageComposer
            recipients={selectedRecipients}
            communityEmojis={community.state.settings.customEmojis}
            onChooseRecipients={() => {
              memberCommandMode = "select";
              memberCommandOpen = true;
            }}
            onRemoveRecipient={(member) =>
              (selectedRecipientIds = selectedRecipientIds.filter(
                (id) => id !== member.id,
              ))}
            onSend={sendNewDirectMessage}
          />
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
          {#if extensions.terminal}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Open terminal"
              title="Open terminal"
              onclick={() => extensions.terminal?.()}
            >
              <SquareTerminalIcon aria-hidden="true" />
            </Button>
          {/if}
          {#if activeRoom.memberCount}
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={`View ${activeRoom.kind === "forum" ? "forum" : activeRoom.kind === "direct" ? "conversation" : "channel"} members (${activeRoom.memberCount})`}
              onclick={() => {
                memberCommandMode = "view";
                memberCommandOpen = true;
              }}
            >
              <UsersIcon data-icon="inline-start" aria-hidden="true" />
              {activeRoom.memberCount}
            </Button>
          {/if}
          {#if extensions.huddle}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Start huddle"
              title="Start huddle"
              onclick={() => extensions.huddle?.(activeRoom.id)}
            >
              <HeadphonesIcon aria-hidden="true" />
            </Button>
          {/if}
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
        <AppShell.Body.Content
          class="community-application__workspace-content"
          label={`${activeRoom.name} content`}
        >
          <CommunityWorkspaceSurface
            model={workspace}
            readOnly={community.state.status !== "connected"}
            {...community.state.replyTarget === undefined
              ? {}
              : { replyTarget: community.state.replyTarget }}
            communityEmojis={community.state.settings.customEmojis}
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
                selectedProfile = null;
                community.actions.openThread(messageId);
                community.actions.setReplyTarget(messageId);
                openSidePanel("thread");
                lastAction = `opened-thread:${messageId}`;
              },
              onToggleReaction: react,
              onAddReaction: react,
              onOpenProfile: openProfile,
              ...(activeRoom.kind === "direct"
                ? {}
                : { onCopyMessageLink: copyMessageLink }),
              onCopyMessage: copyMessage,
              ...(extensions.editMessage === undefined
                ? {}
                : { onEditMessage: extensions.editMessage }),
              onDeleteMessage: (messageId) => {
                void runAuthenticated(() =>
                  community.actions.deleteEvent(messageId),
                ).then(
                  () => toast.success("Message deleted"),
                  (cause) =>
                    toast.error(
                      cause instanceof Error
                        ? cause.message
                        : "The relay rejected this deletion",
                    ),
                );
                lastAction = `deleted-message:${messageId}`;
              },
              onBrowseRooms: openRoomBrowser,
              onCreateRoom: (kind) =>
                void runAuthenticated(() => openRoomEditor(kind, "create")),
              ...(extensions.agents === undefined
                ? {}
                : { onCreateAgent: extensions.agents }),
              onCreateTopic: () =>
                void runAuthenticated(() => {
                  topicComposerOpen = true;
                }),
              onTopicAction: (topicId, action) => {
                const topic = workspace.topics.find(
                  (candidate) => candidate.id === topicId,
                );
                if (action === "copy-link" && topic && activeConnection)
                  void copyText(
                    `nostr:${nip19.neventEncode({ id: topic.id, author: topic.authorId, relays: [activeConnection.relayUrl] })}`,
                    "Topic link copied",
                  );
                if (action === "mark-read")
                  void community.actions.markRead(activeRoom.id);
                if (action === "star")
                  void community.actions.setRoomStarred(topicId, true);
                if (action === "mute")
                  void community.actions.setRoomMuted(topicId, true);
                if (action === "delete")
                  void runAuthenticated(() =>
                    community.actions.deleteEvent(topicId),
                  ).catch((cause) =>
                    toast.error(
                      cause instanceof Error
                        ? cause.message
                        : "The relay rejected this deletion",
                    ),
                  );
              },
              onClearReplyTarget: () => community.actions.clearReplyTarget(),
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
    {#if selectedProfile}
      <AppShell.Sidebar.Header>
        <strong>Profile</strong>
        <AppShell.Sidebar.Close onclick={closeSidePanel} />
      </AppShell.Sidebar.Header>
      <AppShell.Sidebar.Body>
        <CommunityMemberProfile
          member={selectedProfile}
          onMessage={() => {
            selectedRecipientIds = [selectedProfile!.id];
            community.actions.openDirectMessage(selectedRecipientIds);
            setDestination(`dm:${selectedProfile!.id}`, true);
          }}
          onWave={() => toast.success(`Waved to ${selectedProfile!.name}`)}
          onFollow={() => toast.success(`Following ${selectedProfile!.name}`)}
        />
      </AppShell.Sidebar.Body>
    {:else if activeDestination !== "inbox" && workspaceSidePanel === "thread" && workspace.thread}
      <AppShell.Sidebar.Header>
        <AppShell.Sidebar.Toggle
          side="right"
          sidebarName={sidePanelTitle.toLowerCase()}
        />
        <strong>{sidePanelTitle}</strong>
        <AppShell.Sidebar.Close onclick={closeSidePanel} />
      </AppShell.Sidebar.Header>
      <AppShell.Sidebar.Body>
        <CommunityThreadPanel
          thread={workspace.thread}
          members={workspace.members}
          onSendReply={sendThreadReply}
          {...community.state.replyTarget === undefined
            ? {}
            : { replyTarget: community.state.replyTarget }}
          communityEmojis={community.state.settings.customEmojis}
          onCancelReply={() => community.actions.clearReplyTarget()}
          onToggleReaction={react}
          onAddReaction={react}
          onCopyMessageLink={copyMessageLink}
          onCopyMessage={copyMessage}
          {...extensions.editMessage === undefined
            ? {}
            : { onEditMessage: extensions.editMessage }}
          onDeleteMessage={(messageId) => {
            void runAuthenticated(() =>
              community.actions.deleteEvent(messageId),
            ).then(
              () => toast.success("Message deleted"),
              (cause) =>
                toast.error(
                  cause instanceof Error
                    ? cause.message
                    : "The relay rejected this deletion",
                ),
            );
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
        canArchive={extensions.archive !== undefined}
        onAction={(action) => {
          lastAction = `channel-settings:${action}`;
          if (action === "edit-type" || action === "edit-visibility")
            openRoomEditor(
              detailsRoom.kind === "forum" ? "forum" : "channel",
              "edit",
            );
          if (action === "members") {
            memberCommandMode =
              detailsRoom.permissions?.manageMembers.state === "enabled"
                ? "manage"
                : "view";
            memberCommandOpen = true;
          }
          if (action === "copy-channel-id")
            void copyText(
              detailsRoom.id,
              `${detailsRoom.kind === "forum" ? "Forum" : "Channel"} ID copied`,
            );
          if (action === "leave-channel") confirmation = "leave";
          if (action === "delete-channel") confirmation = "delete";
          if (action === "archive-channel")
            void extensions.archive?.(detailsRoom.id);
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
    cache={community.state.cache}
    {...relayOperation === undefined ? {} : { operation: relayOperation }}
    onSave={(relayUrl) =>
      community.actions.updateRelayUrl(activeConnection.communityId, relayUrl)}
    onClearCache={() =>
      community.actions.clearCache(activeConnection.communityId)}
  />
{/if}

<CommunityRoomEditor
  bind:open={roomEditorOpen}
  mode={roomEditorMode}
  roomKind={roomEditorKind}
  retentionSupported={community.state.capabilities.configurableRetention ??
    false}
  {...roomEditorMode === "edit"
    ? {
        initial: {
          name: activeRoom.name,
          description: activeRoom.description ?? "",
          visibility: activeRoom.private
            ? ("private" as const)
            : ("public" as const),
          lifecycle: activeRoom.lifecycle ?? ("ongoing" as const),
        },
      }
    : {}}
  onSave={saveRoom}
/>

<CommunityRoomBrowser
  bind:open={roomBrowserOpen}
  rooms={allRooms}
  initialKind={roomBrowserKind}
  canCreate={hasCommunityConnection}
  onSelect={(room) => {
    roomBrowserOpen = false;
    setDestination(room.id, true);
  }}
  onJoin={(room) =>
    void runAuthenticated(() => community.actions.join(room.id)).then(
      () => toast.success(`Joined ${room.name}`),
      (cause) =>
        toast.error(
          cause instanceof Error ? cause.message : "Could not join room",
        ),
    )}
  onCreate={(kind) => {
    void runAuthenticated(() => {
      roomBrowserOpen = false;
      openRoomEditor(kind, "create");
    });
  }}
/>

<CommunityMemberCommand
  bind:open={memberCommandOpen}
  title={memberCommandMode === "select"
    ? "New direct message"
    : `${activeRoom.name} members`}
  mode={memberCommandMode}
  members={workspace.members}
  results={community.state.memberDirectory.results}
  selectedIds={selectedRecipientIds}
  completeness={activeRoom.memberListCompleteness ?? "unavailable"}
  onSearch={(query) => void community.actions.searchMembers(query)}
  onSelect={selectMember}
  onRemove={(member) => {
    if (memberCommandMode === "select")
      selectedRecipientIds = selectedRecipientIds.filter(
        (id) => id !== member.id,
      );
    else
      void runAuthenticated(() =>
        community.actions.removeMember(activeRoom.id, member.id),
      ).then(
        () => toast.success(`${member.name} removed`),
        (cause) =>
          toast.error(
            cause instanceof Error
              ? cause.message
              : "The relay rejected this member change",
          ),
      );
  }}
  onConfirm={memberCommandMode === "select"
    ? startDirectMessage
    : () => (memberCommandOpen = false)}
/>

<CommunityTopicComposer
  bind:open={topicComposerOpen}
  forumName={activeRoom.name}
  onPublish={(draft) =>
    runAuthenticated(() => community.actions.createTopic(activeRoom.id, draft))}
/>

<CommunitySearchCommand
  bind:open={searchOpen}
  query={appSearchQuery}
  rooms={searchRooms}
  messages={searchMessages}
  members={searchMembers}
  onQueryChange={(query) => {
    appSearchQuery = query;
    void community.actions.search(query);
  }}
  onSelectRoom={(room) => {
    searchOpen = false;
    setDestination(room.id, true);
  }}
  onSelectMessage={(message) => {
    searchOpen = false;
    selectedProfile = null;
    community.actions.openThread(message.id);
    community.actions.setReplyTarget(message.id);
    openSidePanel("thread");
  }}
  onSelectMember={(member) => {
    searchOpen = false;
    selectedRecipientIds = [member.id];
    startDirectMessage();
  }}
/>

<AlertDialog.Root
  open={confirmation !== null}
  onOpenChange={(open) => {
    if (!open) confirmation = null;
  }}
>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title
        >{confirmation === "delete"
          ? `Delete ${activeRoom.name}?`
          : `Leave ${activeRoom.name}?`}</AlertDialog.Title
      >
      <AlertDialog.Description>
        {confirmation === "delete"
          ? "The relay will remove this room if your identity has permission. This cannot be undone."
          : "You can rejoin later if the room remains public."}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action onclick={confirmRoomAction}
        >{confirmation === "delete" ? "Delete" : "Leave"}</AlertDialog.Action
      >
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<Dialog.Root bind:open={statusOpen}>
  <Dialog.Content class="community-application__status-dialog">
    <Dialog.Header
      ><Dialog.Title>Update your status</Dialog.Title><Dialog.Description
        >Publish a portable NIP-38 status to your connected identity.</Dialog.Description
      ></Dialog.Header
    >
    <Field.Field>
      <Field.Label for="community-status">Status</Field.Label>
      <div class="community-application__status-input">
        <Input
          id="community-status"
          bind:value={statusDraft}
          placeholder="What are you working on?"
        /><CommunityEmojiPicker
          communityEmojis={community.state.settings.customEmojis}
          label="Add emoji to status"
          onSelect={(emoji) => (statusDraft += emoji)}
        />
      </div>
    </Field.Field>
    <Dialog.Footer
      ><Button
        type="button"
        variant="outline"
        onclick={() => (statusOpen = false)}>Cancel</Button
      ><Button type="button" onclick={saveStatus}>Save status</Button
      ></Dialog.Footer
    >
  </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={sectionEditorOpen}>
  <Dialog.Content class="community-application__section-dialog">
    <Dialog.Header
      ><Dialog.Title
        >{sectionEditorMode === "create"
          ? "New section"
          : "Rename section"}</Dialog.Title
      ><Dialog.Description
        >Organize rooms in a personal section. This preference is stored locally
        and through NIP-78 when signed in.</Dialog.Description
      ></Dialog.Header
    >
    <Field.Field
      ><Field.Label for="community-section-name">Name</Field.Label><Input
        id="community-section-name"
        bind:value={sectionName}
        required
      /></Field.Field
    >
    <Dialog.Footer
      ><Button
        type="button"
        variant="outline"
        onclick={() => (sectionEditorOpen = false)}>Cancel</Button
      ><Button
        type="button"
        disabled={!sectionName.trim()}
        onclick={saveSection}>Save section</Button
      ></Dialog.Footer
    >
  </Dialog.Content>
</Dialog.Root>

<Toaster position="bottom-right" richColors />

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

  .community-application__status-input {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }
  .community-application__status-input :global(input) {
    min-width: 0;
    flex: 1;
  }

  :global(.community-application__section-dialog) {
    width: min(22rem, calc(100vw - 2rem));
    max-width: 22rem;
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

  :global(
      .community-application__workspace-content
        > [data-ui-part="scroll-area"]
        > [data-ui-part="scroll-area-viewport"]
    ) {
    overflow: hidden;
  }

  :global(
      .community-application__workspace-content
        > [data-ui-part="scroll-area"]
        > [data-ui-part="scroll-area-viewport"]
        > div
    ) {
    display: flex;
    height: 100%;
    min-height: 0;
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
