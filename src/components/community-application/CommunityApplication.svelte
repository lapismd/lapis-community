<script lang="ts">
  import "../community-confirm-dialog.css";
  import type { ComposerStatus } from "@lapismd/design-core/ai/chat";
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
    createLocalStorageAppShellLayoutPersistence,
    type AppShellDisplayMode,
  } from "@lapismd/design-core/shell";
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
  import HashIcon from "@lucide/svelte/icons/hash";
  import HeadphonesIcon from "@lucide/svelte/icons/headphones";
  import LockIcon from "@lucide/svelte/icons/lock";
  import LogInIcon from "@lucide/svelte/icons/log-in";
  import MessagesSquareIcon from "@lucide/svelte/icons/messages-square";
  import PackageSearchIcon from "@lucide/svelte/icons/package-search";
  import SquareTerminalIcon from "@lucide/svelte/icons/square-terminal";
  import UsersIcon from "@lucide/svelte/icons/users";
  import WifiOffIcon from "@lucide/svelte/icons/wifi-off";
  import XIcon from "@lucide/svelte/icons/x";
  import { nip19 } from "nostr-tools";
  import { toast, Toaster } from "svelte-sonner";
  import { onMount, tick, untrack, type Snippet } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  import type {
    CommunityApplicationExtensions,
    CommunityController,
    CommunityLinkBuilder,
    CommunityReplyTarget,
  } from "../../community/index.js";
  import {
    registryRouteFromDestination,
    registryRouteFromHash,
    registryRouteToDestination,
    registryRouteToHash,
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
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import CommunityMemberProfile from "../community-member-profile/CommunityMemberProfile.svelte";
  import type {
    CommunityNavigationItemModel,
    CommunityNavigationItemAction,
    CommunityNavigationModel,
    CommunityNavigationSectionActionModel,
    CommunityNavigationSectionModel,
  } from "../community-navigation/model.js";
  import { withStarredCommunityNavigationSection } from "../community-navigation/model.js";
  import CommunityProfileMenu from "../community-profile-menu/CommunityProfileMenu.svelte";
  import CommunityRelaySettings from "../community-relay-settings/CommunityRelaySettings.svelte";
  import CommunityRoomBrowser from "../community-room-browser/CommunityRoomBrowser.svelte";
  import CommunityRoomEditor from "../community-room-editor/CommunityRoomEditor.svelte";
  import CommunitySearchCommand from "../community-search-command/CommunitySearchCommand.svelte";
  import {
    projectCommunitySearchResults,
    type CommunitySearchMessageModel,
  } from "../community-search-command/model.js";
  import CommunitySettingsNavigation from "../community-settings-navigation/CommunitySettingsNavigation.svelte";
  import CommunitySettings from "../community-settings/CommunitySettings.svelte";
  import CommunityStatusDialog from "../community-status-dialog/CommunityStatusDialog.svelte";
  import CommunityThreadPanel from "../community-thread-panel/CommunityThreadPanel.svelte";
  import CommunityWorkspaceSurface from "../community-workspace/CommunityWorkspaceSurface.svelte";
  import RegistryBrowser from "../registry-browser/RegistryBrowser.svelte";
  import RegistryReleaseDisclosure from "../registry-release-disclosure/RegistryReleaseDisclosure.svelte";
  import type { RegistryBrowserOptions } from "../registry-browser/model.js";
  import {
    findCommunityRoom,
    memberById,
    rootCommunityMessageId,
    type CommunityPresence,
    type CommunityRoomModel,
    type CommunityMemberModel,
    type CommunityMessageModel,
  } from "../community-workspace/model.js";
  import { formatCommunityEventCopy } from "../community-message/copy-event.js";
  import {
    COMMUNITY_APPLICATION_SHELL_LAYOUT_STORAGE_KEY,
    communityApplicationPanelKey,
    createCommunityApplicationHistory,
    currentCommunityApplicationLocation,
    loadCommunityApplicationDestination,
    loadCommunityApplicationInitialShellLayout,
    moveCommunityApplicationHistory,
    noCommunityApplicationPanel,
    normalizeCommunityApplicationLocation,
    pushCommunityApplicationLocation,
    replaceCommunityApplicationLocation,
    saveCommunityApplicationDestination,
    type CommunityApplicationDestination,
    type CommunityApplicationHistory,
    type CommunityApplicationLocation,
    type CommunityApplicationPanel,
  } from "./navigation.js";

  type CommunityAuthenticatedAction = () => void | Promise<void>;
  type CommunityParticipationAction = "message" | "post" | "reaction" | "reply";
  type PendingCommunityParticipation = {
    roomId: string;
    roomName: string;
    roomKind: "channel" | "forum";
    actionKind: CommunityParticipationAction;
    action: CommunityAuthenticatedAction;
    resolve: () => void;
    reject: (cause: unknown) => void;
  };

  let {
    controller: community,
    shellController,
    initialDestination = "registry",
    displayMode = "auto",
    mobileBreakpoint = 1024,
    desktopMinMainWidth,
    registry,
    registryOptions,
    registryEnabled,
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
    registryEnabled?: boolean;
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

  const browserStorage = untrack(() => {
    try {
      return typeof window === "undefined" ? undefined : window.localStorage;
    } catch {
      return undefined;
    }
  });
  const initialShellLayout = untrack(() =>
    loadCommunityApplicationInitialShellLayout(browserStorage),
  );
  const internalShellController = untrack(
    () =>
      new AppShellController({
        leftCollapsed: initialShellLayout.left?.collapsed ?? true,
        leftClosed: initialShellLayout.left?.closed ?? false,
        ...(initialShellLayout.left?.width === undefined
          ? {}
          : { leftWidth: initialShellLayout.left.width }),
        rightCollapsed: initialShellLayout.right?.collapsed ?? false,
        rightClosed: initialShellLayout.right?.closed ?? true,
        rightWidth: initialShellLayout.right?.width ?? 320,
        sidebarMinWidth: 48,
        sidebarMaxWidth: 440,
        persistence: createLocalStorageAppShellLayoutPersistence(
          COMMUNITY_APPLICATION_SHELL_LAYOUT_STORAGE_KEY,
          browserStorage,
        ),
      }),
  );
  const shell = $derived(shellController ?? internalShellController);
  const hasRegistry = $derived(
    registryEnabled ??
      (registry !== undefined || registryOptions !== undefined),
  );
  const initialApplicationDestination = untrack(() => {
    const fallback =
      !hasRegistry && registryRouteFromDestination(initialDestination) !== null
        ? "inbox"
        : initialDestination;
    const persisted = loadCommunityApplicationDestination(browserStorage);
    const hashRoute =
      typeof window === "undefined"
        ? null
        : registryRouteFromHash(window.location.hash);
    if (hasRegistry && hashRoute !== null) {
      return registryRouteToDestination(hashRoute);
    }
    return persisted !== null &&
      (hasRegistry || registryRouteFromDestination(persisted) === null)
      ? persisted
      : fallback;
  });
  let navigationHistory = $state<CommunityApplicationHistory>(
    createCommunityApplicationHistory(initialApplicationDestination),
  );
  let registryRoute = $state<RegistryRoute>(
    registryRouteFromDestination(initialApplicationDestination) ?? {
      page: "landing",
    },
  );
  let settingsSection = $state<"profile" | "custom-emoji">("profile");
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
  let confirmation = $state<"leave" | "delete" | null>(null);
  let pendingParticipation = $state.raw<PendingCommunityParticipation>();
  let membershipJoinState = $state<"idle" | "pending" | "accepted">("idle");
  let membershipJoinError = $state("");
  let statusOpen = $state(false);
  let presencePreference = $state<CommunityPresence>("online");
  let searchOpen = $state(false);
  let appSearchQuery = $state("");
  let sectionEditorOpen = $state(false);
  let sectionEditorMode = $state<"create" | "rename">("create");
  let sectionEditorId = $state("");
  let sectionName = $state("");
  let initialLocationApplied = $state(false);

  const workspace = $derived(community.state.workspace);
  const applicationLocation = $derived(
    currentCommunityApplicationLocation(navigationHistory),
  );
  const activeDestination = $derived(applicationLocation.destination);
  const activePanel = $derived(applicationLocation.panel);
  const communityStartupPending = $derived(
    community.state.status === "idle" ||
      community.state.status === "restoring" ||
      community.state.status === "connecting" ||
      community.state.status === "synchronizing",
  );
  const allRooms = $derived(
    workspace.navigationSections.flatMap((section) => section.rooms),
  );
  const startupDestinationRoom = $derived(
    communityStartupPending
      ? allRooms.find((room) => room.id === activeDestination)
      : undefined,
  );
  const activeRoom = $derived(
    startupDestinationRoom ??
      findCommunityRoom(workspace) ??
      fallbackRoom(workspace.activeRoomId || activeDestination),
  );
  const workspaceSurfaceModel = $derived(
    startupDestinationRoom === undefined
      ? workspace
      : {
          ...workspace,
          activeRoomId: startupDestinationRoom.id,
          view:
            startupDestinationRoom.kind === "forum"
              ? ("forum-index" as const)
              : ("channel" as const),
          messages: [],
          topics: [],
        },
  );
  const activeDirectMember = $derived(
    directMemberForRoom(
      activeRoom,
      workspace.members,
      workspace.currentMemberId,
    ),
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
  const authenticated = $derived(
    community.state.authentication.status === "connected",
  );
  const statusOperation = $derived(
    community.state.operations["settings:status"],
  );
  const activePublishAvailability = $derived(
    activeRoom.permissions?.publish ??
      (authenticated
        ? ({ state: "enabled" } as const)
        : ({
            state: "requires-authentication",
            reason: "Connect a NIP-07 identity to participate",
          } as const)),
  );
  const activeRoomKnownNonmember = $derived(
    activeRoom.kind !== "direct" && activeRoom.membership === "not-joined",
  );
  const activeRoomJoinVisible = $derived(
    community.state.status === "connected" &&
      activeRoomKnownNonmember &&
      activeRoom.permissions?.join.state !== "denied" &&
      activeRoom.permissions?.join.state !== "unsupported",
  );
  const navigationModel = $derived<CommunityNavigationModel>({
    searchPlaceholder: "Search everything",
    primaryItems: [
      ...(authenticated && hasCommunityConnection
        ? [{ id: "inbox", label: "Inbox", kind: "inbox" as const }]
        : []),
      ...(hasRegistry
        ? [
            {
              id: "registry",
              label: "Registry",
              kind: "registry" as const,
              icon: "package-search" as const,
            },
          ]
        : []),
    ],
    sections: withStarredCommunityNavigationSection([
      ...workspace.navigationSections.map((section) => ({
        id: section.id,
        label: section.label,
        kind:
          section.id === "channels"
            ? ("channels" as const)
            : section.id === "forums"
              ? ("forums" as const)
              : section.id === "direct-messages"
                ? ("direct-messages" as const)
                : ("section" as const),
        ...(section.id === "channels" && community.state.capabilities.channels
          ? {
              ...(authenticated && community.state.capabilities.manageGroup
                ? {
                    primaryAction: {
                      id: "create",
                      label: "Create channel",
                      icon: "create" as const,
                    },
                  }
                : {}),
              actions: [
                {
                  id: "browse",
                  label: "Browse channels",
                  icon: "browse-channels" as const,
                },
                ...(authenticated
                  ? [
                      {
                        id: "new-section",
                        label: "New section",
                        icon: "new-section" as const,
                      },
                    ]
                  : []),
              ],
            }
          : {}),
        ...(section.id === "forums" && community.state.capabilities.forums
          ? {
              ...(authenticated && community.state.capabilities.manageGroup
                ? {
                    primaryAction: {
                      id: "create",
                      label: "Create forum",
                      icon: "create" as const,
                    },
                  }
                : {}),
              actions: [
                {
                  id: "browse",
                  label: "Browse forums",
                  icon: "browse-forums" as const,
                },
                ...(authenticated
                  ? [
                      {
                        id: "new-section",
                        label: "New section",
                        icon: "new-section" as const,
                      },
                    ]
                  : []),
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
        items: (hasCommunitySurface || communityStartupPending
          ? section.rooms
          : []
        )
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
            ...(room.kind === "direct"
              ? {
                  member: directMemberForRoom(
                    room,
                    workspace.members,
                    workspace.currentMemberId,
                  )!,
                }
              : {}),
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
            archiveAvailable:
              extensions.archive !== undefined &&
              room.permissions?.update.state === "enabled",
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
        kind: "section" as const,
        actions: [
          {
            id: "rename-section",
            label: "Rename section",
            icon: "rename" as const,
          },
          {
            id: "delete-section",
            label: "Delete section",
            icon: "delete" as const,
          },
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
            ...(room.kind === "direct"
              ? {
                  member: directMemberForRoom(
                    room,
                    workspace.members,
                    workspace.currentMemberId,
                  )!,
                }
              : {}),
            ...(room.private === undefined ? {} : { restricted: room.private }),
            ...(room.mentionCount === undefined &&
            room.unreadCount === undefined
              ? {}
              : { unreadCount: room.mentionCount ?? room.unreadCount }),
            starred: community.state.navigation.starredRoomIds.includes(
              room.id,
            ),
            muted: community.state.navigation.mutedRoomIds.includes(room.id),
          })),
      })),
    ]),
  });
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
  const searchMessages = $derived<readonly CommunitySearchMessageModel[]>(
    [
      ...workspace.messages
        .filter((message) =>
          message.content
            .toLocaleLowerCase()
            .includes(appSearchQuery.toLocaleLowerCase()),
        )
        .map((message) => ({
          ...message,
          roomId: activeRoom.id,
          ...(activeRoom.kind === "forum"
            ? {
                topicId: rootCommunityMessageId(workspace.messages, message.id),
              }
            : {}),
        })),
      ...projectedSearchResults.messages,
    ]
      .filter(
        (message) =>
          message.roomId !== undefined &&
          allRooms.some((room) => room.id === message.roomId),
      )
      .filter(
        (message, index, values) =>
          values.findIndex((candidate) => candidate.id === message.id) ===
          index,
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
  const searchScopeRoom = $derived(
    activeRoom.id === activeDestination &&
      (activeRoom.kind === "channel" || activeRoom.kind === "forum")
      ? activeRoom
      : undefined,
  );
  const selectedRecipients = $derived(
    selectedRecipientIds
      .map((id) => workspace.members.find((member) => member.id === id))
      .filter((member) => member !== undefined),
  );
  const isRegistryDestination = $derived(
    hasRegistry && registryRouteFromDestination(activeDestination) !== null,
  );
  const usesRoomToolbar = $derived(
    !isRegistryDestination &&
      (hasCommunitySurface || communityStartupPending) &&
      activeDestination !== "settings" &&
      activeDestination !== "inbox" &&
      activeDestination !== "new-direct-message",
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
  const canNavigateBack = $derived(navigationHistory.index > 0);
  const canNavigateForward = $derived(
    navigationHistory.index < navigationHistory.entries.length - 1,
  );
  const selectedProfile = $derived(
    activePanel.kind === "profile"
      ? workspace.members.find((member) => member.id === activePanel.memberId)
      : undefined,
  );
  const panelRoom = $derived(
    activePanel.kind === "details" || activePanel.kind === "thread"
      ? activePanel.roomId === inbox.room.id
        ? inbox.room
        : allRooms.find((room) => room.id === activePanel.roomId)
      : undefined,
  );
  const detailsRoom = $derived(
    activePanel.kind === "details" ? panelRoom : undefined,
  );
  const visibleThread = $derived(
    activePanel.kind === "thread" &&
      workspace.activeRoomId === activePanel.roomId &&
      workspace.thread?.rootMessageId === activePanel.rootMessageId
      ? workspace.thread
      : undefined,
  );
  const threadReplyTarget = $derived.by(
    (): CommunityReplyTarget | undefined => {
      if (activePanel.kind !== "thread" || !activePanel.replyTargetId) {
        return undefined;
      }
      const message = visibleThread?.messages.find(
        (candidate) => candidate.id === activePanel.replyTargetId,
      );
      if (!message) return undefined;
      const author = workspace.members.find(
        (member) => member.id === message.authorId,
      );
      return {
        eventId: message.id,
        roomId: activePanel.roomId,
        authorId: message.authorId,
        authorName: author?.name ?? message.authorId.slice(0, 12),
        content: message.content,
        kind: panelRoom?.kind ?? activeRoom.kind,
      };
    },
  );
  const sidePanelTitle = $derived(
    activePanel.kind === "profile"
      ? "Profile"
      : activePanel.kind === "thread"
        ? "Thread"
        : detailsRoom?.kind === "channel"
          ? "Channel settings"
          : detailsRoom?.kind === "forum"
            ? "Forum settings"
            : "Conversation details",
  );

  function openProfile(member: CommunityMemberModel): void {
    openPanel({ kind: "profile", memberId: member.id });
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
  const activeParticipationOperationEntry = $derived.by(() => {
    const targets = new Set([
      activeRoom.id,
      ...workspace.messages.map((message) => message.id),
      ...(workspace.thread?.messages.map((message) => message.id) ?? []),
      ...workspace.topics.map((topic) => topic.id),
    ]);
    return Object.entries(community.state.operations)
      .filter(
        ([key, operation]) =>
          operation.status !== "idle" &&
          /^(send|reply|reaction|topic|join|leave|delete|direct):/u.test(key) &&
          [...targets].some((target) => key.includes(target)),
      )
      .toReversed()[0];
  });
  const activeParticipationOperation = $derived(
    activeParticipationOperationEntry?.[1],
  );
  const participationReadOnly = $derived(
    community.state.status !== "connected" ||
      activePublishAvailability.state === "denied" ||
      activePublishAvailability.state === "unsupported" ||
      activeParticipationOperation?.status === "pending",
  );
  const participationReadOnlyReason = $derived(
    community.state.status !== "connected"
      ? "Reconnect to participate"
      : activeParticipationOperation?.status === "pending"
        ? "This action is still being published"
        : (activePublishAvailability.reason ?? "Participation is unavailable"),
  );
  const participationComposerStatus = $derived<ComposerStatus | undefined>(
    activeParticipationOperation?.status === "failed"
      ? {
          type: "error",
          message:
            activeParticipationOperation.message ??
            activeParticipationOperation.failure?.message ??
            "Action did not complete",
        }
      : activeParticipationOperation?.status === "accepted"
        ? {
            type: "warning",
            message:
              activeParticipationOperation.message ??
              "Accepted by relay, still syncing",
          }
        : participationReadOnly
          ? { type: "warning", message: participationReadOnlyReason }
          : undefined,
  );

  $effect(() => {
    if (community.state.status === "connecting") relayNoticeDismissed = false;
  });

  $effect(() => {
    const authenticationSettledWithoutIdentity =
      community.state.authentication.status === "anonymous" ||
      community.state.authentication.status === "error";
    if (
      authenticationSettledWithoutIdentity &&
      (activeDestination === "settings" || activeDestination === "inbox")
    ) {
      setDestination("registry", false);
    }
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

  function roomByWorkspaceId(roomId: string): CommunityRoomModel | undefined {
    return (
      allRooms.find((room) => room.id === roomId) ??
      (activeRoom.id === roomId ? activeRoom : undefined)
    );
  }

  function requestRoomMembership(
    room: CommunityRoomModel,
    actionKind: CommunityParticipationAction,
    action: CommunityAuthenticatedAction,
  ): Promise<void> {
    membershipJoinState = "idle";
    membershipJoinError = "";
    return new Promise((resolve, reject) => {
      pendingParticipation?.reject(
        new Error("A newer participation action replaced this one"),
      );
      pendingParticipation = {
        roomId: room.id,
        roomName: room.name,
        roomKind: room.kind === "forum" ? "forum" : "channel",
        actionKind,
        action,
        resolve,
        reject,
      };
    });
  }

  async function runParticipationAction(
    roomId: string,
    actionKind: CommunityParticipationAction,
    action: CommunityAuthenticatedAction,
  ): Promise<void> {
    await runAuthenticated(async () => {
      const room = roomByWorkspaceId(roomId);
      const availability =
        actionKind === "reaction"
          ? (room?.permissions?.react ?? room?.permissions?.publish)
          : room?.permissions?.publish;
      if (
        room === undefined ||
        room.kind === "direct" ||
        room.membership !== "not-joined" ||
        availability?.requirement !== "membership"
      ) {
        await action();
        return;
      }
      if (
        room.permissions?.join.state === "denied" ||
        room.permissions?.join.state === "unsupported"
      ) {
        throw new Error(
          room.permissions.join.reason ??
            `You cannot join this ${room.kind === "forum" ? "forum" : "channel"}`,
        );
      }
      await requestRoomMembership(room, actionKind, action);
    });
  }

  function cancelPendingParticipation(): void {
    const pending = pendingParticipation;
    if (pending === undefined) return;
    pendingParticipation = undefined;
    membershipJoinState = "idle";
    membershipJoinError = "";
    pending.reject(
      new Error(
        `Join this ${pending.roomKind} before sending your ${pending.actionKind}`,
      ),
    );
  }

  async function resumePendingParticipation(
    pending: PendingCommunityParticipation,
  ): Promise<void> {
    if (pendingParticipation !== pending) return;
    pendingParticipation = undefined;
    membershipJoinState = "idle";
    membershipJoinError = "";
    try {
      await pending.action();
      pending.resolve();
    } catch (cause) {
      pending.reject(cause);
    }
  }

  async function joinForPendingParticipation(): Promise<void> {
    const pending = pendingParticipation;
    if (pending === undefined || membershipJoinState !== "idle") return;
    membershipJoinState = "pending";
    membershipJoinError = "";
    try {
      await community.actions.join(pending.roomId);
      if (pendingParticipation !== pending) return;
      if (roomByWorkspaceId(pending.roomId)?.membership === "joined") {
        await resumePendingParticipation(pending);
      } else {
        membershipJoinState = "accepted";
      }
    } catch (cause) {
      if (pendingParticipation !== pending) return;
      membershipJoinState = "idle";
      membershipJoinError =
        cause instanceof Error ? cause.message : "The join request failed";
    }
  }

  $effect(() => {
    const pending = pendingParticipation;
    const membership =
      pending === undefined
        ? undefined
        : roomByWorkspaceId(pending.roomId)?.membership;
    if (pending !== undefined && membership === "joined") {
      queueMicrotask(() => void resumePendingParticipation(pending));
    }
  });

  $effect(() => {
    saveCommunityApplicationDestination(browserStorage, activeDestination);
  });

  $effect(() => {
    if (initialLocationApplied || !hasCommunitySurface) return;

    const destination = activeDestination;
    const registryDestination =
      registryRouteFromDestination(destination) !== null;
    const applicationDestination =
      destination === "inbox" ||
      destination === "settings" ||
      destination === "new-direct-message" ||
      registryDestination;
    const room = applicationDestination
      ? undefined
      : allRooms.find((candidate) => candidate.id === destination);

    initialLocationApplied = true;
    if (!applicationDestination && !room) {
      replaceLocation({
        destination: hasRegistry
          ? "registry"
          : workspace.activeRoomId || "inbox",
        panel: noCommunityApplicationPanel(),
      });
      return;
    }
    if (room && workspace.activeRoomId !== room.id) {
      community.actions.selectRoom(room.id);
    }
  });

  $effect(() => {
    if (
      hasCachedCommunityData &&
      activeDestination === "inbox" &&
      workspace.activeRoomId !== ""
    ) {
      replaceLocation({
        destination: workspace.activeRoomId,
        panel: noCommunityApplicationPanel(),
      });
    }
  });

  $effect(() => {
    if (activePanel.kind === "none") {
      if (shell.right.collapsed) shell.right.expand();
      shell.right.close();
      return;
    }
    shell.right.expand();
  });

  $effect(() => {
    const projectionSettled =
      activePanel.kind === "none" ||
      (activePanel.kind === "profile" && workspace.sidePanel === "none") ||
      (activePanel.kind === "details" &&
        (activePanel.roomId === inbox.room.id ||
          workspace.sidePanel === "details")) ||
      (activePanel.kind === "thread" &&
        workspace.activeRoomId === activePanel.roomId &&
        workspace.sidePanel === "thread");
    if (!projectionSettled) return;

    const normalized = normalizeCommunityApplicationLocation(
      applicationLocation,
      {
        roomIds: [inbox.room.id, ...allRooms.map((room) => room.id)],
        memberIds: workspace.members.map((member) => member.id),
        ...(activePanel.kind === "thread"
          ? {
              messageIds:
                workspace.thread?.messages.map((message) => message.id) ?? [],
            }
          : {}),
      },
    );
    if (normalized.panel.kind === "none" && activePanel.kind !== "none") {
      normalizeMissingPanel();
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

  function applyLocation(
    next: CommunityApplicationLocation,
    previous: CommunityApplicationLocation,
  ): void {
    const nextRegistryRoute = registryRouteFromDestination(next.destination);
    if (nextRegistryRoute !== null) registryRoute = nextRegistryRoute;

    const roomId =
      next.destination === "inbox"
        ? inbox.room.id
        : nextRegistryRoute === null &&
            next.destination !== "settings" &&
            next.destination !== "new-direct-message"
          ? next.destination
          : undefined;
    if (roomId !== undefined && workspace.activeRoomId !== roomId) {
      community.actions.selectRoom(roomId);
    }

    if (next.panel.kind === "thread") {
      community.actions.clearReplyTarget();
      community.actions.openThread(next.panel.rootMessageId);
    } else if (
      next.panel.kind === "details" &&
      next.panel.roomId !== inbox.room.id
    ) {
      community.actions.clearReplyTarget();
      community.actions.openDetails();
    } else {
      community.actions.closeSidePanel();
    }

    if (next.panel.kind === "none") shell.mobile.showMain();
    else if (shell.mobile.resolvedMode === "mobile") {
      const returnFocus =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : undefined;
      const expectedPanelKey = communityApplicationPanelKey(next.panel);
      void tick().then(() => {
        const current = currentCommunityApplicationLocation(navigationHistory);
        if (
          shell.mobile.resolvedMode === "mobile" &&
          communityApplicationPanelKey(current.panel) === expectedPanelKey
        ) {
          shell.mobile.show("right", "right", returnFocus);
        }
      });
    }

    if (next.destination !== previous.destination) {
      onDestinationChange(next.destination);
    }
  }

  function pushLocation(next: CommunityApplicationLocation): void {
    const previous = currentCommunityApplicationLocation(navigationHistory);
    const updated = pushCommunityApplicationLocation(navigationHistory, next);
    if (updated === navigationHistory) return;
    navigationHistory = updated;
    applyLocation(next, previous);
    pushBrowserRegistryLocation(next.destination);
  }

  function replaceLocation(next: CommunityApplicationLocation): void {
    const previous = currentCommunityApplicationLocation(navigationHistory);
    const updated = replaceCommunityApplicationLocation(
      navigationHistory,
      next,
    );
    if (updated === navigationHistory) return;
    navigationHistory = updated;
    applyLocation(next, previous);
    replaceBrowserRegistryLocation(next.destination);
  }

  function pushBrowserRegistryLocation(destination: string): void {
    if (typeof window === "undefined") return;
    const route = registryRouteFromDestination(destination);
    if (route === null) {
      clearBrowserRegistryLocation("push");
      return;
    }
    const hash = registryRouteToHash(route);
    if (window.location.hash !== hash) window.history.pushState(null, "", hash);
  }

  function replaceBrowserRegistryLocation(destination: string): void {
    if (typeof window === "undefined") return;
    const route = registryRouteFromDestination(destination);
    if (route === null) {
      clearBrowserRegistryLocation("replace");
      return;
    }
    const hash = registryRouteToHash(route);
    if (window.location.hash !== hash)
      window.history.replaceState(null, "", hash);
  }

  function clearBrowserRegistryLocation(mode: "push" | "replace"): void {
    if (
      registryRouteFromHash(window.location.hash) === null &&
      !window.location.hash.startsWith("#post-")
    ) {
      return;
    }
    const url = `${window.location.pathname}${window.location.search}`;
    if (mode === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }

  onMount(() => {
    const applyBrowserLocation = () => {
      let route = registryRouteFromHash(window.location.hash);
      if (route === null && window.location.hash.startsWith("#post-")) {
        const postId = window.location.hash.slice("#post-".length);
        route =
          registryRoute.page === "plugin" && /^[0-9a-f]{64}$/u.test(postId)
            ? { ...registryRoute, view: "reviews", postId }
            : null;
      }
      if (route === null || !hasRegistry) return;
      const destination = registryRouteToDestination(route);
      if (destination === activeDestination) return;
      setDestination(destination, false);
    };
    window.addEventListener("hashchange", applyBrowserLocation);
    window.addEventListener("popstate", applyBrowserLocation);
    return () => {
      window.removeEventListener("hashchange", applyBrowserLocation);
      window.removeEventListener("popstate", applyBrowserLocation);
    };
  });

  function setDestination(
    destinationId: CommunityApplicationDestination,
    recordHistory: boolean,
  ): void {
    const next = {
      destination: destinationId,
      panel: noCommunityApplicationPanel(),
    } satisfies CommunityApplicationLocation;
    if (recordHistory) pushLocation(next);
    else replaceLocation(next);
    lastAction = `selected:${destinationId}`;
  }

  function openPanel(panel: CommunityApplicationPanel): void {
    pushLocation({ destination: activeDestination, panel });
  }

  function openPanelForDestination(
    destination: CommunityApplicationDestination,
    panel: CommunityApplicationPanel,
  ): void {
    pushLocation({ destination, panel });
  }

  function normalizeMissingPanel(): void {
    replaceLocation({
      destination: activeDestination,
      panel: noCommunityApplicationPanel(),
    });
    lastAction = "unavailable-side-panel";
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
    const previous = currentCommunityApplicationLocation(navigationHistory);
    const updated = moveCommunityApplicationHistory(navigationHistory, offset);
    if (updated === navigationHistory) return;
    const next = currentCommunityApplicationLocation(updated);
    navigationHistory = updated;
    applyLocation(next, previous);
    replaceBrowserRegistryLocation(next.destination);
    lastAction = offset === -1 ? "navigated-back" : "navigated-forward";
  }

  async function react(
    messageId: string,
    emoji: string,
    custom?: { shortcode: string; url: string },
  ): Promise<void> {
    try {
      await runParticipationAction(activeRoom.id, "reaction", () =>
        community.actions.toggleReaction(messageId, emoji, custom),
      );
      lastAction = `reaction:${messageId}:${emoji}`;
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Reaction could not be saved",
      );
      throw cause;
    }
  }

  async function joinRoom(room: CommunityRoomModel): Promise<void> {
    let joinRequested = false;
    await runAuthenticated(async () => {
      if (roomByWorkspaceId(room.id)?.membership === "joined") return;
      await community.actions.join(room.id);
      joinRequested = true;
    });
    lastAction = joinRequested
      ? `join-requested:${room.id}`
      : `already-joined:${room.id}`;
  }

  function requestRoomJoin(room: CommunityRoomModel): void {
    void joinRoom(room).catch((cause) => {
      toast.error(
        cause instanceof Error ? cause.message : "Could not join room",
      );
    });
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

  function copyEvent(messageId: string): void {
    const message =
      workspace.messages.find((candidate) => candidate.id === messageId) ??
      workspace.thread?.messages.find(
        (candidate) => candidate.id === messageId,
      );
    if (message?.sourceEvent === undefined) return;
    void copyText(
      formatCommunityEventCopy(message.content, message.sourceEvent),
      "Event copied",
    );
    lastAction = `copied-event:${messageId}`;
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
      void runAuthenticated(() => {
        memberCommandMode = "select";
        selectedRecipientIds = [];
        setDestination("new-direct-message", true);
        memberCommandOpen = true;
      });
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
        openPanelForDestination(item.id, {
          kind: "details",
          roomId: item.id,
        });
        lastAction = "opened-details";
      }
      if (action === "leave" || action === "delete") {
        setDestination(item.id, true);
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
      if (action === "delete") toast.success("Room deleted");
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

  async function messageMember(member: CommunityMemberModel): Promise<void> {
    await runAuthenticated(() => {
      selectedRecipientIds = [member.id];
      community.actions.openDirectMessage(selectedRecipientIds);
      setDestination(`dm:${member.id}`, true);
    });
  }

  async function deleteMessage(messageId: string): Promise<void> {
    await runAuthenticated(() => community.actions.deleteEvent(messageId));
    toast.success("Message deleted");
    lastAction = `deleted-message:${messageId}`;
  }

  async function handleTopicAction(
    topicId: string,
    action: "copy-link" | "mark-read" | "star" | "mute" | "delete",
  ): Promise<void> {
    const topic = workspace.topics.find(
      (candidate) => candidate.id === topicId,
    );
    if (action === "copy-link" && topic && activeConnection) {
      await copyText(
        `nostr:${nip19.neventEncode({ id: topic.id, author: topic.authorId, relays: [activeConnection.relayUrl] })}`,
        "Topic link copied",
      );
    }
    if (action === "mark-read") await community.actions.markRead(activeRoom.id);
    if (action === "star")
      await community.actions.setRoomStarred(topicId, true);
    if (action === "mute") await community.actions.setRoomMuted(topicId, true);
    if (action === "delete") await deleteMessage(topicId);
  }

  function viewMemberActivity(member: CommunityMemberModel): void {
    if (extensions.activityLog === undefined) return;
    const result = extensions.activityLog(member.id);
    if (result instanceof Promise) {
      void result.catch((cause) =>
        toast.error(
          cause instanceof Error
            ? cause.message
            : "The activity log could not be opened",
        ),
      );
    }
    lastAction = `viewed-activity:${member.id}`;
  }

  function runMemberExtension(
    action: "wave" | "follow",
    member: CommunityMemberModel,
  ): void {
    const handler = extensions[action];
    if (handler === undefined) return;
    void Promise.resolve(handler(member.id)).catch((cause) =>
      toast.error(
        cause instanceof Error
          ? cause.message
          : `${action === "wave" ? "Wave" : "Follow"} could not be completed`,
      ),
    );
    lastAction = `${action}:${member.id}`;
  }

  async function saveStatus(status: string): Promise<void> {
    try {
      await runAuthenticated(() => community.actions.updateStatus(status));
      if (
        community.state.operations["settings:status"]?.status !== "accepted"
      ) {
        statusOpen = false;
      }
    } catch {
      // The controller operation is rendered persistently inside the dialog.
    }
  }

  async function retryStatus(): Promise<void> {
    try {
      await community.retry("settings:status");
      if (
        community.state.operations["settings:status"]?.status !== "accepted"
      ) {
        statusOpen = false;
      }
    } catch {
      // The refreshed controller failure remains visible inside the dialog.
    }
  }

  async function sendThreadReply(
    rootMessageId: string,
    content: string,
  ): Promise<void> {
    try {
      const replyTargetId =
        activePanel.kind === "thread"
          ? (activePanel.replyTargetId ?? rootMessageId)
          : rootMessageId;
      await runParticipationAction(
        activePanel.kind === "thread" ? activePanel.roomId : activeRoom.id,
        "reply",
        () => community.actions.sendReply(replyTargetId, content),
      );
      if (activePanel.kind === "thread") {
        openPanel({
          kind: "thread",
          roomId: activePanel.roomId,
          rootMessageId: activePanel.rootMessageId,
        });
      } else {
        community.actions.clearReplyTarget();
      }
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

  function closeSidePanel(): void {
    openPanel(noCommunityApplicationPanel());
    lastAction = "closed-side-panel";
  }

  async function sendWorkspaceMessage(
    roomId: string,
    content: string,
  ): Promise<void> {
    try {
      await runParticipationAction(roomId, "message", async () => {
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

  function directMemberForRoom(
    room: CommunityRoomModel,
    members: readonly CommunityMemberModel[],
    currentMemberId: string | undefined,
  ): CommunityMemberModel | undefined {
    if (room.kind !== "direct") return undefined;
    const peerId = room.participantIds?.find((id) => id !== currentMemberId);
    const matchedMember =
      (peerId === undefined
        ? undefined
        : members.find((member) => member.id === peerId)) ??
      members.find((member) => member.name === room.name);
    if (matchedMember) return matchedMember;

    const name = room.name || "Direct message";
    return {
      id: peerId ?? room.id,
      name,
      handle: peerId?.slice(0, 12) ?? room.id,
      initials:
        name
          .split(/\s+/u)
          .filter(Boolean)
          .slice(0, 2)
          .map((part) => part[0]?.toLocaleUpperCase() ?? "")
          .join("") || "?",
      presence: "offline",
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

{#snippet mobileNavigationControls()}
  <div class="community-application__mobile-navigation">
    <AppShell.Sidebar.Toggle side="left" sidebarName="navigation" />
    <div
      class="community-application__mobile-history"
      role="group"
      aria-label="Navigation history"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Back"
        title="Back"
        disabled={!canNavigateBack}
        onclick={() => navigateHistory(-1)}
      >
        <ChevronLeftIcon aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Forward"
        title="Forward"
        disabled={!canNavigateForward}
        onclick={() => navigateHistory(1)}
      >
        <ChevronRightIcon aria-hidden="true" />
      </Button>
    </div>
  </div>
{/snippet}

{#snippet releaseMessageSupplement(message: CommunityMessageModel)}
  {#if hasRegistry && message.parentMessageId === undefined && registryOptions?.source.loadReleaseInspection}
    <RegistryReleaseDisclosure
      eventId={message.id}
      source={registryOptions.source}
      onOpenPlugin={(pluginId) =>
        navigateRegistry({ page: "plugin", pluginId })}
    />
  {/if}
{/snippet}

<CommunityAppShell
  controller={shell}
  {displayMode}
  {mobileBreakpoint}
  {...desktopMinMainWidth === undefined ? {} : { desktopMinMainWidth }}
  {canNavigateBack}
  {canNavigateForward}
  onNavigateBack={() => navigateHistory(-1)}
  onNavigateForward={() => navigateHistory(1)}
  data-last-action={lastAction}
  data-community-status={community.state.status}
  data-community-cache-freshness={community.state.cache.freshness}
  data-community-content-sync={community.state.contentSync?.phase ?? "legacy"}
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
        countsUpdating={community.state.contentSync?.phase === "background" ||
          community.state.contentSync?.phase === "partial-error"}
        onSelect={select}
        onSearch={(query) => {
          appSearchQuery = query;
          searchOpen = true;
          void community.actions.search(query);
        }}
        onSectionAction={handleSectionAction}
        onItemAction={handleItemAction}
        customSections={community.state.navigation.sections.map((section) => ({
          id: section.id,
          label: section.name,
        }))}
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
                community.state.status === "connected"
                  ? presencePreference
                  : "offline",
            }}
            communityName={currentCommunity?.name ?? "Community"}
            {...activeConnection?.relayUrl === undefined
              ? {}
              : { communityUrl: activeConnection.relayUrl }}
            {authenticated}
            compact={navigationCompact}
            connectionStatus={community.state.status}
            canManageCommunity={activeRoom.permissions?.manageMembers.state ===
              "enabled"}
            canSendFeedback={extensions.feedback !== undefined}
            onPresenceChange={(presence) => {
              presencePreference = presence;
              lastAction = `presence:${presence}`;
            }}
            onAction={(action) => {
              if (action === "sign-in") void runAuthenticated(() => {});
              if (action === "sign-out")
                void community.actions
                  .disconnectIdentity()
                  .catch((cause) =>
                    toast.error(
                      cause instanceof Error
                        ? cause.message
                        : "Could not finish signing out",
                    ),
                  );
              if (action === "settings") openSettings();
              if (action === "copy-community-url" && activeConnection)
                void copyText(
                  activeConnection.relayUrl,
                  "Community URL copied",
                );
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
    {#if shell.mobile.resolvedMode === "mobile" && !usesRoomToolbar}
      <AppShell.Toolbar label="Application navigation">
        {@render mobileNavigationControls()}
      </AppShell.Toolbar>
    {/if}

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
    {:else if !hasCommunitySurface && !communityStartupPending}
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
        rooms={workspace.navigationSections.flatMap((section) => section.rooms)}
        disabled={participationReadOnly}
        disabledReason={participationReadOnlyReason}
        {...workspace.currentMemberId === undefined
          ? {}
          : { currentMemberId: workspace.currentMemberId }}
        canDeleteAny={inbox.room.permissions?.delete.state === "enabled"}
        historyUpdating={community.state.contentSync?.phase === "background" ||
          community.state.contentSync?.phase === "partial-error"}
        onSelect={() => void community.actions.markRead(inbox.room.id)}
        onSend={(content) => sendThreadReply(inbox.activeItemId, content)}
        onMarkAllRead={() => void community.actions.markAllRead()}
        onOpenChannelSettings={() => {
          openPanel({ kind: "details", roomId: inbox.room.id });
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
        onOpenRoom={(roomId) => setDestination(roomId, true)}
        onMessageMember={messageMember}
        {...extensions.activityLog === undefined
          ? {}
          : { onViewMemberActivity: viewMemberActivity }}
        {...inbox.room.kind === "direct"
          ? {}
          : { onCopyMessageLink: copyMessageLink }}
        onCopyMessage={copyMessage}
        onCopyEvent={copyEvent}
        {...extensions.editMessage === undefined
          ? {}
          : { onEditMessage: extensions.editMessage }}
        onDeleteMessage={deleteMessage}
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
      <AppShell.Toolbar
        label={`${activeRoom.name} toolbar`}
        class="community-application__room-toolbar"
      >
        <div class="community-application__toolbar-start">
          {#if shell.mobile.resolvedMode === "mobile"}
            {@render mobileNavigationControls()}
          {:else if navigationCompact}
            <AppShell.Sidebar.Toggle side="left" sidebarName="navigation" />
          {/if}
          <div class="community-application__room-title">
            <strong data-ui-part="room-title">
              {#if activeRoom.kind === "direct" && activeDirectMember}
                <CommunityMemberAvatar
                  member={activeDirectMember}
                  showPresence
                  decorative
                />
              {:else if activeRoom.private}
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
          {#if activeRoomJoinVisible}
            <Button
              type="button"
              size="sm"
              disabled={activeParticipationOperation?.status === "pending" ||
                activeParticipationOperation?.status === "accepted"}
              onclick={() => requestRoomJoin(activeRoom)}
            >
              <LogInIcon data-icon="inline-start" aria-hidden="true" />
              {activeParticipationOperation?.status === "accepted"
                ? "Join requested"
                : activeParticipationOperation?.status === "pending"
                  ? "Joining…"
                  : "Join"}
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
              openPanel({ kind: "details", roomId: activeRoom.id });
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
            model={workspaceSurfaceModel}
            historyLoading={communityStartupPending ||
              community.state.contentSync?.rooms[activeRoom.id] === "unloaded"}
            historyUpdating={community.state.contentSync?.phase ===
              "background" ||
              community.state.contentSync?.phase === "partial-error"}
            messageSupplement={releaseMessageSupplement}
            readOnly={participationReadOnly}
            readOnlyReason={participationReadOnlyReason}
            showJoinAction={activeRoomJoinVisible}
            {...activeParticipationOperation === undefined
              ? {}
              : { operation: activeParticipationOperation }}
            {...activeParticipationOperationEntry === undefined
              ? {}
              : {
                  onRetryOperation: () =>
                    community.retry(activeParticipationOperationEntry[0]),
                  onDismissOperation: () =>
                    community.dismissOperation(
                      activeParticipationOperationEntry[0],
                    ),
                }}
            {...community.state.replyTarget === undefined ||
            activePanel.kind === "thread"
              ? {}
              : { replyTarget: community.state.replyTarget }}
            communityEmojis={community.state.settings.customEmojis}
            handlers={{
              ...community.handlers,
              onSelectRoom: (roomId) => {
                if (
                  roomId === activeRoom.id &&
                  workspace.view === "forum-thread"
                ) {
                  community.actions.selectRoom(roomId);
                  lastAction = `selected:${roomId}`;
                } else setDestination(roomId, true);
              },
              onSendMessage: sendWorkspaceMessage,
              onOpenTopic: (topicId) => {
                community.actions.openTopic(topicId);
                if (activePanel.kind !== "none") closeSidePanel();
                lastAction = `opened-topic:${topicId}`;
              },
              onReply: (messageId) => {
                if (activeRoom.kind === "direct" || activeRoom.kind === "forum")
                  community.actions.setReplyTarget(messageId);
                else
                  openPanel({
                    kind: "thread",
                    roomId: activeRoom.id,
                    rootMessageId: rootCommunityMessageId(
                      workspace.messages,
                      messageId,
                    ),
                    replyTargetId: messageId,
                  });
                lastAction = `replying-to:${messageId}`;
              },
              onOpenThread: (messageId) => {
                openPanel({
                  kind: "thread",
                  roomId: activeRoom.id,
                  rootMessageId: messageId,
                });
                lastAction = `opened-thread:${messageId}`;
              },
              onToggleReaction: react,
              onAddReaction: react,
              onOpenProfile: openProfile,
              onMessageMember: messageMember,
              ...(extensions.activityLog === undefined
                ? {}
                : { onViewMemberActivity: viewMemberActivity }),
              ...(activeRoom.kind === "direct"
                ? {}
                : { onCopyMessageLink: copyMessageLink }),
              onCopyMessage: copyMessage,
              onCopyEvent: copyEvent,
              ...(extensions.editMessage === undefined
                ? {}
                : { onEditMessage: extensions.editMessage }),
              onDeleteMessage: deleteMessage,
              onBrowseRooms: openRoomBrowser,
              ...(activeRoomJoinVisible
                ? {
                    onJoinRoom: (roomId: string) =>
                      requestRoomJoin({ ...activeRoom, id: roomId }),
                  }
                : {}),
              ...(authenticated && community.state.capabilities.manageGroup
                ? {
                    onCreateRoom: (kind: "channel" | "forum") =>
                      openRoomEditor(kind, "create"),
                  }
                : {}),
              ...(!authenticated || extensions.agents === undefined
                ? {}
                : { onCreateAgent: extensions.agents }),
              onCreateTopic: (_roomId, draft) =>
                runParticipationAction(activeRoom.id, "post", () =>
                  community.actions.createTopic(activeRoom.id, draft),
                ),
              onTopicAction: handleTopicAction,
              onClearReplyTarget: () => community.actions.clearReplyTarget(),
            }}
          />
        </AppShell.Body.Content>
      </AppShell.Body>
    {/if}
  </AppShell.Main>

  {#if activePanel.kind !== "none"}
    {#key communityApplicationPanelKey(activePanel)}
      <AppShell.Sidebar
        side="right"
        label={`${sidePanelTitle} sidebar`}
        mobileLabel={sidePanelTitle}
        resizeLabel={`Resize ${sidePanelTitle.toLowerCase()} sidebar`}
        closeable
      >
        {#if activePanel.kind === "profile"}
          <AppShell.Sidebar.Header>
            <strong>Profile</strong>
            <AppShell.Sidebar.Close onclick={closeSidePanel} />
          </AppShell.Sidebar.Header>
          <AppShell.Sidebar.Body>
            {#if selectedProfile}
              <CommunityMemberProfile
                member={selectedProfile}
                onMessage={() => messageMember(selectedProfile)}
                {...extensions.wave === undefined
                  ? {}
                  : {
                      onWave: () => runMemberExtension("wave", selectedProfile),
                    }}
                {...extensions.follow === undefined
                  ? {}
                  : {
                      onFollow: () =>
                        runMemberExtension("follow", selectedProfile),
                    }}
              />
            {:else}
              <div class="community-application__panel-status" role="status">
                Profile unavailable
              </div>
            {/if}
          </AppShell.Sidebar.Body>
        {:else if activePanel.kind === "thread"}
          <AppShell.Sidebar.Header>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              data-ui-part="sidebar-toggle"
              data-side="right"
              data-state="expanded"
              aria-label="Close thread sidebar"
              title="Close thread sidebar"
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
            {#if visibleThread}
              <CommunityThreadPanel
                thread={visibleThread}
                members={workspace.members}
                rooms={workspace.navigationSections.flatMap(
                  (section) => section.rooms,
                )}
                disabled={participationReadOnly}
                disabledReason={participationReadOnlyReason}
                {...participationComposerStatus === undefined
                  ? {}
                  : { composerStatus: participationComposerStatus }}
                {...activeParticipationOperation?.status === "failed" &&
                activeParticipationOperation.failure?.retryable &&
                activeParticipationOperationEntry !== undefined
                  ? {
                      onRetryComposerStatus: () =>
                        community.retry(activeParticipationOperationEntry[0]),
                    }
                  : {}}
                {...activeParticipationOperationEntry === undefined
                  ? {}
                  : {
                      onDismissComposerStatus: () =>
                        community.dismissOperation(
                          activeParticipationOperationEntry[0],
                        ),
                    }}
                {...workspace.currentMemberId === undefined
                  ? {}
                  : { currentMemberId: workspace.currentMemberId }}
                canDeleteAny={activeRoom.permissions?.delete.state ===
                  "enabled"}
                onSendReply={sendThreadReply}
                onReply={(messageId) =>
                  openPanel({ ...activePanel, replyTargetId: messageId })}
                onOpenProfile={openProfile}
                onOpenRoom={(roomId) => setDestination(roomId, true)}
                onMessageMember={messageMember}
                {...extensions.activityLog === undefined
                  ? {}
                  : { onViewMemberActivity: viewMemberActivity }}
                {...threadReplyTarget === undefined
                  ? {}
                  : { replyTarget: threadReplyTarget }}
                communityEmojis={community.state.settings.customEmojis}
                onCancelReply={() =>
                  openPanel({
                    kind: "thread",
                    roomId: activePanel.roomId,
                    rootMessageId: activePanel.rootMessageId,
                  })}
                {...participationReadOnly
                  ? {}
                  : { onToggleReaction: react, onAddReaction: react }}
                onCopyMessageLink={copyMessageLink}
                onCopyMessage={copyMessage}
                onCopyEvent={copyEvent}
                {...extensions.editMessage === undefined
                  ? {}
                  : { onEditMessage: extensions.editMessage }}
                onDeleteMessage={deleteMessage}
              />
            {:else}
              <div class="community-application__panel-status" role="status">
                Loading thread…
              </div>
            {/if}
          </AppShell.Sidebar.Body>
        {:else if detailsRoom?.kind === "channel" || detailsRoom?.kind === "forum"}
          <CommunityChannelSettings
            room={detailsRoom}
            members={workspace.members}
            description={activeDestination === "inbox"
              ? (inbox.room.description ?? "Community channel")
              : (workspace.details?.description ??
                detailsRoom.description ??
                "Community channel")}
            canArchive={extensions.archive !== undefined}
            onClose={closeSidePanel}
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
        {:else}
          <AppShell.Sidebar.Header>
            <strong>{sidePanelTitle}</strong>
            <AppShell.Sidebar.Close onclick={closeSidePanel} />
          </AppShell.Sidebar.Header>
          <AppShell.Sidebar.Body>
            {#if detailsRoom && workspace.details}
              <CommunityDetails
                room={detailsRoom}
                details={workspace.details}
                members={workspace.members}
              />
            {:else}
              <div class="community-application__panel-status" role="status">
                Loading details…
              </div>
            {/if}
          </AppShell.Sidebar.Body>
        {/if}
      </AppShell.Sidebar>
    {/key}
  {/if}
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
  canCreate={authenticated &&
    hasCommunityConnection &&
    community.state.capabilities.manageGroup}
  onSelect={(room) => {
    roomBrowserOpen = false;
    setDestination(room.id, true);
  }}
  onJoin={(room) =>
    void joinRoom(room).catch((cause) =>
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

<CommunitySearchCommand
  bind:open={searchOpen}
  query={appSearchQuery}
  rooms={searchRooms}
  messages={searchMessages}
  members={searchMembers}
  updating={community.state.contentSync?.phase === "background" ||
    community.state.contentSync?.phase === "partial-error"}
  {...searchScopeRoom === undefined ? {} : { scopeRoom: searchScopeRoom }}
  onQueryChange={(query) => {
    appSearchQuery = query;
    void community.actions.search(query);
  }}
  onSelectRoom={(room) => {
    searchOpen = false;
    setDestination(room.id, true);
  }}
  onSelectMessage={(message) => {
    const roomId = message.roomId ?? activeRoom.id;
    const room = allRooms.find((candidate) => candidate.id === roomId);
    searchOpen = false;
    if (room?.kind === "direct") {
      setDestination(roomId, true);
      return;
    }
    if (room?.kind === "forum") {
      setDestination(roomId, true);
      community.actions.openTopic(message.topicId ?? message.id);
      return;
    }
    openPanelForDestination(roomId, {
      kind: "thread",
      roomId,
      rootMessageId: rootCommunityMessageId(searchMessages, message.id),
    });
  }}
  onSelectMember={(member) => {
    searchOpen = false;
    messageMember(member);
  }}
  onBrowseChannels={() => {
    searchOpen = false;
    openRoomBrowser("channel");
  }}
  canCreateChannel={authenticated &&
    hasCommunityConnection &&
    community.state.capabilities.manageGroup}
  onCreateChannel={() => {
    searchOpen = false;
    void runAuthenticated(() => openRoomEditor("channel", "create"));
  }}
/>

<AlertDialog.Root
  open={pendingParticipation !== undefined}
  onOpenChange={(open) => {
    if (!open && membershipJoinState !== "pending")
      cancelPendingParticipation();
  }}
>
  <AlertDialog.Content
    class="community-application__alert-dialog community-confirm-dialog"
  >
    <AlertDialog.Header>
      <AlertDialog.Title>
        Join {pendingParticipation?.roomName ?? "this room"} to continue?
      </AlertDialog.Title>
      <AlertDialog.Description>
        Join this {pendingParticipation?.roomKind ?? "room"} before your
        {pendingParticipation?.actionKind ?? "action"} is sent. The original action
        will continue automatically after membership is confirmed.
      </AlertDialog.Description>
    </AlertDialog.Header>
    {#if membershipJoinError}
      <p class="community-application__membership-error" role="alert">
        {membershipJoinError}
      </p>
    {:else if membershipJoinState === "accepted"}
      <p class="community-application__membership-status" role="status">
        Join requested. Waiting for membership confirmation before sending the
        original action.
      </p>
    {/if}
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={membershipJoinState === "pending"}>
        {#snippet child({ props })}
          <Button {...props} variant="outline">Cancel</Button>
        {/snippet}
      </AlertDialog.Cancel>
      <Button
        type="button"
        disabled={membershipJoinState !== "idle"}
        onclick={joinForPendingParticipation}
      >
        {membershipJoinState === "pending"
          ? "Joining…"
          : membershipJoinState === "accepted"
            ? "Join requested"
            : `Join ${pendingParticipation?.roomKind === "forum" ? "Forum" : "Channel"}`}
      </Button>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<AlertDialog.Root
  open={confirmation !== null}
  onOpenChange={(open) => {
    if (!open) confirmation = null;
  }}
>
  <AlertDialog.Content
    class="community-application__alert-dialog community-confirm-dialog"
  >
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
      <AlertDialog.Cancel>
        {#snippet child({ props })}
          <Button {...props} variant="outline">Cancel</Button>
        {/snippet}
      </AlertDialog.Cancel>
      <AlertDialog.Action onclick={confirmRoomAction}>
        {#snippet child({ props })}
          <Button {...props} variant="destructive">
            {confirmation === "delete" ? "Delete" : "Leave"}
          </Button>
        {/snippet}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<CommunityStatusDialog
  bind:open={statusOpen}
  value={displayMember.status ?? ""}
  pending={statusOperation?.status === "pending"}
  {...statusOperation?.status === "accepted" && statusOperation.message
    ? { operationMessage: statusOperation.message }
    : {}}
  {...statusOperation?.status === "failed" &&
  (statusOperation.failure?.relayReason ?? statusOperation.message)
    ? {
        error: statusOperation.failure?.relayReason ?? statusOperation.message!,
      }
    : {}}
  retryable={statusOperation?.failure?.retryable ?? false}
  onSave={saveStatus}
  onRetry={retryStatus}
  onDismissError={() => community.dismissOperation("settings:status")}
/>

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
  .community-application__toolbar-actions,
  .community-application__mobile-navigation,
  .community-application__mobile-history {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.5rem;
  }

  .community-application__mobile-navigation,
  .community-application__mobile-history {
    gap: 0.125rem;
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

  .community-application__membership-error,
  .community-application__membership-status {
    margin: 0;
    font-size: 0.875rem;
  }

  .community-application__membership-error {
    color: var(--destructive);
  }

  .community-application__membership-status {
    color: var(--muted-foreground);
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

  :global(.community-application__room-toolbar[data-ui-part="toolbar"]) {
    padding-block: 0.625rem 0.375rem;
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

  .community-application__panel-status {
    padding: 1rem;
    color: var(--muted-foreground);
    font-size: 0.875rem;
  }
</style>
