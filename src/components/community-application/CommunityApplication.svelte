<script lang="ts">
  import { provideApplicationNotifications } from "./application-notifications.svelte.js";
  import { agentRuntimeActions } from "../community-agent-activity/runtime-actions.js";
  import { createMessageReactionAction } from "./message-reaction-action.js";
  import { createCommunityApplicationSend } from "./application-send.js";
  import { communityComposerAgentsFromState } from "../community-chat-composer/composer-agent-model.js";
  import {
    repositoryFilesPathLocation,
    repositorySurfaceLocation,
    reviewCommitLocation,
    locationForProjectRoute,
    locationForProjectDestination,
  } from "./project-commit-route.js";
  // prettier-ignore
  import { projectRouteCommit, repositoryRouteState, taskForProjectRoute } from "./project-route.js";
  import {
    applicationRoomKind,
    locationFromHash,
    syncBrowserApplicationLocation,
  } from "./application-location-hash.js";
  import { provideForumTopicSync } from "./application-forum-hash.svelte.js";
  import {
    repositoryFilePermalink,
    repositoryFilesLoadKey,
  } from "./project-route-files.js";
  import * as communityCopy from "../../community/community-copy-links.js";
  import { preferredProjectFilesRepository } from "./project-files-selection.js";
  import { projectViewForSurface } from "./project-log-route.js";
  import { parseNip29ReleaseEvent } from "../../protocol/index.js";
  import {
    conversationHash,
    directConversationHash,
  } from "../../community/conversations.js";
  import { provideAgentComposerActivity } from "../community-agent-composer-activity/context.js";
  import type {
    CommunityAgentActivityContext,
    CommunityAgentActivitySyncContext,
  } from "../../community/agent-contracts.js";
  import CommunitySkeleton from "../community-skeleton/CommunitySkeleton.svelte";
  import { DialogFrame } from "@lapismd/design-core/forms/dialog";
  import {
    createQuery,
    keepPreviousData,
    QueryClientProvider,
  } from "@tanstack/svelte-query";

  import type { ComposerStatus } from "@lapismd/design-core/ai/chat";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Alert from "@lapismd/design-core/shadcn/alert";
  import { ConfirmDialog } from "@lapismd/design-core/forms/dialog";
  import * as Breadcrumb from "@lapismd/design-core/shadcn/breadcrumb";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import * as Empty from "@lapismd/design-core/shadcn/empty";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import * as Tabs from "@lapismd/design-core/shadcn/tabs";
  import {
    AppShell,
    AppShellController,
    createLocalStorageAppShellLayoutPersistence,
    type AppShellDisplayMode,
  } from "@lapismd/design-core/shell";
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import CircleCheckIcon from "@lucide/svelte/icons/circle-check";
  import CodeXmlIcon from "@lucide/svelte/icons/code-xml";
  import EllipsisIcon from "@lucide/svelte/icons/ellipsis";
  import HashIcon from "@lucide/svelte/icons/hash";
  import HeadphonesIcon from "@lucide/svelte/icons/headphones";
  import GitPullRequestIcon from "@lucide/svelte/icons/git-pull-request";
  import GitBranchIcon from "@lucide/svelte/icons/git-branch";
  import GitCommitHorizontalIcon from "@lucide/svelte/icons/git-commit-horizontal";
  import FilesIcon from "@lucide/svelte/icons/files";
  import FolderKanbanIcon from "@lucide/svelte/icons/folder-kanban";
  import FolderPlusIcon from "@lucide/svelte/icons/folder-plus";
  import ListTodoIcon from "@lucide/svelte/icons/list-todo";
  import LinkIcon from "@lucide/svelte/icons/link";
  import LockIcon from "@lucide/svelte/icons/lock";
  import LogInIcon from "@lucide/svelte/icons/log-in";
  import MessagesSquareIcon from "@lucide/svelte/icons/messages-square";
  import PackageSearchIcon from "@lucide/svelte/icons/package-search";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import SearchIcon from "@lucide/svelte/icons/search";
  import RefreshIcon from "@lucide/svelte/icons/refresh-cw";
  import SquareTerminalIcon from "@lucide/svelte/icons/square-terminal";
  import UsersIcon from "@lucide/svelte/icons/users";
  import UserRoundPlusIcon from "@lucide/svelte/icons/user-round-plus";
  import WifiOffIcon from "@lucide/svelte/icons/wifi-off";
  import XIcon from "@lucide/svelte/icons/x";
  import { nip19 } from "nostr-tools";
  import { toast, Toaster } from "svelte-sonner";
  import {
    onDestroy,
    onMount,
    tick,
    untrack,
    type Component,
    type Snippet,
  } from "svelte";
  import type { HTMLAttributes } from "svelte/elements";

  import type {
    CommunityApplicationExtensions,
    CommunityController,
    CommunityLinkBuilder,
    CommunityMessageReport,
    CommunityReplyTarget,
  } from "../../community/index.js";
  import {
    communityIdentityMembersFromState,
    presentCommunityIdentityModel,
  } from "../../community/member-identity.js";
  import { presentCommunityWorkspace } from "./workspace-identity.js";
  import { createProjectWorkItemResources } from "../../projects/work-item-resources.js";
  import type { CommunityAccountSession } from "../../auth/index.js";
  import {
    channelCanvasKey,
    type CommunityChannelCanvasModel,
  } from "../../community/channel-canvas.js";
  import { LAPIS_GROUPS, lapisGroupId } from "../../protocol/index.js";
  import {
    addRepositoryToProjectTemplate,
    applySavedProtection,
    mergeHostedPullRequest,
    buildRepositoryActivity,
    repositoryCommitActivity,
    createAssignmentTemplate,
    createBrowserProjectForgeCatalogStore,
    createBrowserProjectReviewPreferenceStore,
    createBuzzCommentTemplate,
    createDeletionTemplate,
    createProjectTaskAnchorTemplate,
    createProjectTemplate,
    createProjectReactionTemplate,
    createPullRequestReviewTemplate,
    createReviewRequestTemplate,
    createRepositoryTemplate,
    createTaskTemplate,
    createWorkItemStatusTemplate,
    projectForgeBoundChannels,
    projectForgeChildChannels,
    projectForgeCatalogCacheKey,
    PROJECT_DIRECTORY_TABS,
    PROJECT_REPOSITORY_TABS,
    PROJECT_WORKSPACE_TABS,
    preferredProjectForRepository,
    updateProjectTemplate,
    GITHUB_REVIEW_COMMENT_REACTIONS,
    PROJECT_FORGE_KINDS,
    decodeProjectListCursor,
    encodeProjectListCursor,
    type ProjectForgeBlobResponse,
    type ProjectForgeCatalog,
    type ProjectForgeCatalogCacheScope,
    type ProjectForgeCommit,
    type ProjectForgeCommitResponse,
    type ProjectForgeCommitActivity,
    type ProjectForgeDataSource,
    type ProjectForgeGitHubConnection,
    type ProjectForgeGitHubRepository,
    type ProjectForgePullRequestDiff,
    type ProjectForgeProject,
    type ProjectForgeProtectionDocumentInput,
    type ProjectForgeRepository,
    type ProjectForgeRepositoryCapabilitiesByCoordinate,
    type ProjectForgeRef,
    type ProjectForgeSession,
    type ProjectForgeSurface,
    type ProjectForgeOverviewSurface,
    type ProjectForgeTreeResponse,
    type OwnersDocument,
    type ProjectForgeWorkItems,
    type ProjectListCursor,
    type ProjectTaskState,
    type PullRequestComment,
    type PullRequestReviewKind,
    type PullRequestState,
  } from "../../projects/index.js";
  import { canMaintainRepository } from "../community-projects/community-projects-permissions.js";
  import { submitRepositoryPullRequest } from "../../projects/pull-request-publish.js";
  import {
    logReviewRequest,
    type LogReviewSubmitInput,
  } from "../../projects/log-review.js";
  import CommunityProjectsReviewDetails from "../community-projects/CommunityProjectsReviewDetails.svelte";
  import CommunityProjectsTaskDetails from "../community-projects/CommunityProjectsTaskDetails.svelte";
  import {
    registryRouteFromDestination,
    registryRouteToDestination,
    registryRouteToHash,
    type RegistryCatalogEntry,
    type RegistryReleaseReviewEntry,
    type RegistryRoute,
  } from "../../registry/index.js";
  import CommunityAppShell from "../community-app-shell/CommunityAppShell.svelte";
  import { projectCanvasStarterForChannel } from "../community-channel-canvas/project-canvas-template.js";
  import CommunityChannelSettings from "../community-channel-settings/CommunityChannelSettings.svelte";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityEmojiPicker from "../community-emoji-picker/CommunityEmojiPicker.svelte";
  import CommunityDetails from "../community-details/CommunityDetails.svelte";
  import type { CommunityInboxModel } from "../community-inbox/model.js";
  import CommunityGroupInviteDialog from "../community-group-invite-dialog/CommunityGroupInviteDialog.svelte";
  import CommunityProjectChannelIcon from "../community-project-channel-icon/CommunityProjectChannelIcon.svelte";
  import CommunityNavigation from "../community-navigation/CommunityNavigation.svelte";
  import CommunityApplicationMemberCommand from "./CommunityApplicationMemberCommand.svelte";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import { provideCommunityMemberPresence } from "../community-member-hover-card/presence-context.js";
  import CommunityAgentProfile from "../community-agent-profile/CommunityAgentProfile.svelte";
  import { agentThreadPanel } from "./agent-thread-panel.js";
  import { provideAgentConversation } from "../community-agent-conversation/context.svelte.js";
  import { provideAgentContextNavigation } from "../community-agent-context-references/context.js";
  import CommunityAgentActivity from "../community-agent-activity/CommunityAgentActivity.svelte";
  import { communityAgentMember } from "../community-agents/model.js";
  import CommunityMemberProfile from "../community-member-profile/CommunityMemberProfile.svelte";
  import CommunityRelativeTime from "../community-relative-time/CommunityRelativeTime.svelte";
  import type {
    CommunityNavigationItemModel,
    CommunityNavigationItemAction,
    CommunityNavigationModel,
    CommunityNavigationSectionActionModel,
    CommunityNavigationSectionModel,
  } from "../community-navigation/model.js";
  import CommunityProfileMenu from "../community-profile-menu/CommunityProfileMenu.svelte";
  import CommunityProjects from "../community-projects/CommunityProjects.svelte";
  import CommunityApplicationProjectToolbarNav from "./CommunityApplicationProjectToolbarNav.svelte";
  import {
    PROJECT_REVIEW_LIST_FILTER_DEFAULT,
    PROJECT_TASK_LIST_FILTER_DEFAULT,
    projectRailCollectionFilter,
    projectRailLabelIsCurrentPage,
    type ProjectReviewListFilter,
    type ProjectTaskListFilter,
  } from "../../projects/collection-filters.js";
  import {
    projectRailSurface,
    projectSurfaceTitle,
  } from "../../projects/project-rail.js";
  import CommunityProjectsProjectRepositoriesRail from "../community-projects/CommunityProjectsProjectRepositoriesRail.svelte";
  import CommunityProjectsRailStatusFilters from "../community-projects/CommunityProjectsRailStatusFilters.svelte";
  import CommunityProjectsRepositoryRail from "../community-projects/CommunityProjectsRepositoryRail.svelte";
  import { provideProjectLogNavigation } from "./project-log-navigation.svelte.js";
  import {
    memberCommandGroupIds,
    resolveMemberCommandRoom,
  } from "./member-command-room.js";
  import type {
    CommunityProjectsCreateProject,
    CommunityProjectsCreatePullRequest,
    CommunityProjectsCreateRepository,
    CommunityProjectsCreateTask,
    CommunityProjectsDialogRequest,
    CommunityProjectsOptions,
    CommunityProjectsUpdateProject,
  } from "../community-projects/model.js";
  import CommunityReleasePeople from "../community-release-people/CommunityReleasePeople.svelte";
  import CommunityReleaseReviews from "../community-release-reviews/CommunityReleaseReviews.svelte";
  import CommunityRelaySettings from "../community-relay-settings/CommunityRelaySettings.svelte";
  import CommunityRoomBrowser from "../community-room-browser/CommunityRoomBrowser.svelte";
  import CommunityRoomEditor from "../community-room-editor/CommunityRoomEditor.svelte";
  import CommunitySearchCommand from "../community-search-command/CommunitySearchCommand.svelte";
  import {
    projectCommunitySearchResults,
    type CommunitySearchMessageModel,
    type CommunitySearchScope,
  } from "../community-search-command/model.js";
  import CommunitySettingsNavigation from "../community-settings-navigation/CommunitySettingsNavigation.svelte";
  import type { CommunitySettingsSection } from "../community-settings/model.js";
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
    loadNavigationSections,
    navigationSectionStorageKey,
    orderNavigationSections,
    saveNavigationSections,
    sectionsForDestination,
    type NavigationSectionState,
  } from "./navigation-sections.js";
  import {
    COMMUNITY_APPLICATION_SHELL_LAYOUT_STORAGE_KEY,
    COMMUNITY_APPLICATION_RELEASE_OVERVIEW_PANEL_ID,
    COMMUNITY_APPLICATION_PROJECT_OVERVIEW_PANEL_ID as PROJECT_OVERVIEW_PANEL_ID,
    communityApplicationLocationsEqual,
    communityApplicationPanelKey,
    createCommunityApplicationHistory,
    currentCommunityApplicationLocation,
    loadCommunityApplicationLocation,
    loadCommunityApplicationInitialShellLayout,
    moveCommunityApplicationHistory,
    noCommunityApplicationPanel,
    normalizeCommunityApplicationLocation,
    pushCommunityApplicationLocation,
    replaceCommunityApplicationLocation,
    saveCommunityApplicationLocation,
    isProjectDestination,
    projectCoordinateFromDestination,
    projectDestinationFromCoordinate,
    projectRouteToHash,
    type CommunityApplicationDestination,
    type CommunityApplicationHistory,
    type CommunityApplicationLocation,
    type CommunityApplicationMainSurface,
    type CommunityApplicationPanel,
    type CommunityApplicationProjectRoute,
  } from "./navigation.js";
  import {
    communityApplicationThreadProjectionMatches,
    communityApplicationThreadProjectionSettled,
  } from "./thread-panel-projection.js";
  import { provideCommunityApplicationComposer } from "./composer-context.js";
  import { useCommunityApplicationAuthentication } from "./authentication-context.js";
  import CommunityApplicationAgentsHost from "./CommunityApplicationAgentsHost.svelte";
  import { ownedAgentDirectoryActions } from "./owned-agent-directory-actions.js";
  import CommunityApplicationDirectMessageHost from "./CommunityApplicationDirectMessageHost.svelte";
  import CommunityApplicationInboxHost from "./CommunityApplicationInboxHost.svelte";
  import CommunityApplicationPulseHost from "./CommunityApplicationPulseHost.svelte";
  import CommunityApplicationSettings from "./CommunityApplicationSettings.svelte";
  import { projectRepositoriesForView } from "./project-repository-view-selection.js";
  import {
    createCommunityQueryClient,
    PROJECT_CHANNEL_READ_STALE_TIME_MS,
    PROJECT_REPOSITORY_READ_GC_TIME_MS,
    PROJECT_REPOSITORY_READ_STALE_TIME_MS,
  } from "./project-query-client.js";
  import {
    communityProjectQueryKeys,
    communityQueryRelayUrls,
    communityQueryScopeStorageKey,
    invalidateCommunityProjectQueries,
    type CommunityQueryScope,
  } from "./project-query-keys.js";
  import {
    loadProjectRepositoryView,
    type ProjectRepositoryViewInput,
    type ProjectRepositoryViewResult,
  } from "./project-repository-view-query.js";
  import { projectRepositoryViewQueryTarget } from "./project-repository-view-target.js";
  import { loadRepositoryPathCommitFromQuery } from "./project-repository-path-commit-query.js";
  import { loadRepositoryCommitsFromQuery } from "./project-repository-read-query.js";
  import { createProjectApplicationQueryActions } from "./project-application-query-actions.js";

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

  import { findWorkspaceRoom } from "./repository-browsing.js";

  const pluginReleaseGroupId = lapisGroupId(LAPIS_GROUPS.pluginReleases);

  function projectQueryErrorMessage(cause: unknown, fallback: string): string {
    return cause instanceof Error ? cause.message : fallback;
  }

  let releaseOverviewToggleElement = $state<HTMLButtonElement | null>(null);
  let projectOverviewToggleElement = $state<HTMLButtonElement | null>(null);

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
    projectsOptions,
    extensions = {},
    linkBuilder,
    onAuthenticationRequired = async (action) => void (await action()),
    onDestinationChange,
    onSectionAction,
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
    projectsOptions?: CommunityProjectsOptions;
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
  let navigationSectionOpen = $state<NavigationSectionState>({});
  let loadedNavigationSectionKey = $state("");
  let pendingNavigationReveal = $state<string>();
  const defaultProjectCatalogStore = untrack(() =>
    createBrowserProjectForgeCatalogStore(
      browserStorage === undefined ? {} : { storage: browserStorage },
    ),
  );
  const defaultProjectReviewPreferenceStore = untrack(() =>
    createBrowserProjectReviewPreferenceStore(
      browserStorage === undefined ? {} : { storage: browserStorage },
    ),
  );
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
  const applicationAuthentication = useCommunityApplicationAuthentication();
  const releaseOverviewSidebar = untrack(
    () =>
      shell.getPanel(COMMUNITY_APPLICATION_RELEASE_OVERVIEW_PANEL_ID) ??
      shell.createSidebar(
        COMMUNITY_APPLICATION_RELEASE_OVERVIEW_PANEL_ID,
        "right",
        {
          collapsed: initialShellLayout.releaseOverview?.collapsed ?? false,
          closed: initialShellLayout.releaseOverview?.closed ?? true,
          width: initialShellLayout.releaseOverview?.width ?? 320,
          minWidth: 220,
          maxWidth: 440,
        },
      ),
  );
  const projectOverviewSidebar = untrack(
    () =>
      shell.getPanel(PROJECT_OVERVIEW_PANEL_ID) ??
      shell.createSidebar(PROJECT_OVERVIEW_PANEL_ID, "right", {
        collapsed: initialShellLayout.projectOverview?.collapsed ?? false,
        closed: initialShellLayout.projectOverview?.closed ?? true,
        width: initialShellLayout.projectOverview?.width ?? 280,
        minWidth: 220,
        maxWidth: 440,
      }),
  );
  const hasProjects = $derived(projectsOptions !== undefined);
  const hasRegistry = $derived(
    registryEnabled ??
      (registry !== undefined || registryOptions !== undefined),
  );
  const initialApplicationLocation = untrack<CommunityApplicationLocation>(
    () => {
      const fallback =
        !hasRegistry &&
        registryRouteFromDestination(initialDestination) !== null
          ? "inbox"
          : initialDestination;
      const persisted = loadCommunityApplicationLocation(browserStorage);
      const hashLocation =
        typeof window === "undefined"
          ? null
          : locationFromHash(window.location.hash, {
              hasProjects,
              hasRegistry,
            });
      if (hashLocation) return hashLocation;
      if (
        persisted !== null &&
        (hasRegistry ||
          registryRouteFromDestination(persisted.destination) === null) &&
        (hasProjects || persisted.projectRoute === undefined)
      ) {
        return persisted;
      }
      return { destination: fallback, panel: noCommunityApplicationPanel() };
    },
  );
  let navigationHistory = $state<CommunityApplicationHistory>(
    createCommunityApplicationHistory(initialApplicationLocation),
  );
  let registryRoute = $state<RegistryRoute>(
    registryRouteFromDestination(initialApplicationLocation.destination) ?? {
      page: "landing",
    },
  );
  let registryBreadcrumbEntry = $state<RegistryCatalogEntry>();
  let settingsSection = $state<CommunitySettingsSection>("profile");
  let lastAction = $state("ready");
  let relayNoticeDismissed = $state(false);
  let relaySettingsOpen = $state(false);
  let inlineRelayUrl = $state("");
  let inlineRelayCommunityId = $state("");
  let inlineRelayError = $state("");
  let roomEditorOpen = $state(false);
  let roomEditorMode = $state<"create" | "edit">("edit");
  let roomEditorKind = $state<"channel" | "forum">("channel");
  let roomEditorInitialName = $state("");
  let roomBrowserOpen = $state(false);
  let roomBrowserKind = $state<"all" | "channel" | "forum">("all");
  let memberCommandOpen = $state(false);
  let memberCommandMode = $state<"view" | "manage" | "select">("view");
  let memberCommandRoomId = $state<string | undefined>();
  let selectedRecipientIds = $state<string[]>([]);
  let memberCommandTask = $state<ProjectTaskState>();
  let groupInviteOpen = $state(false);
  let groupInviteMode = $state<"create" | "join">("join");
  let profileOverride = $state<CommunityMemberModel>();
  let confirmation = $state<"leave" | "delete" | null>(null);
  let pendingParticipation = $state.raw<PendingCommunityParticipation>();
  let membershipJoinState = $state<"idle" | "pending" | "accepted">("idle");
  let membershipJoinError = $state("");
  let statusOpen = $state(false);
  let searchOpen = $state(false);
  let appSearchInput = $state("");
  let appSearchQuery = $state("");
  let appSearchTimer: ReturnType<typeof setTimeout> | undefined;
  const appSearchDebounceMs = 250;
  let agentCreatorOpen = $state(false);
  let sectionEditorOpen = $state(false);
  let sectionEditorMode = $state<"create" | "rename">("create");
  let sectionEditorId = $state("");
  let sectionName = $state("");
  let initialLocationApplied = $state(false);
  let releaseOverviewInitialized = $state(false);
  let releaseReviewEntries = $state.raw<readonly RegistryReleaseReviewEntry[]>(
    [],
  );
  let releaseReviewsLoading = $state(false);
  let releaseReviewsError = $state("");
  let releaseReviewRevision = $state.raw({});
  let projectCatalog = $state.raw<ProjectForgeCatalog>({
    projects: [],
    repositories: [],
    events: [],
  });
  let projectWorkItems = $state.raw<ProjectForgeWorkItems>({
    tasks: [],
    pullRequests: [],
    events: [],
  });
  let projectSession = $state.raw<ProjectForgeSession>();
  const projectWorkItemResources = $derived(
    projectSession ? createProjectWorkItemResources(projectSession) : undefined,
  );
  $effect(() => {
    const resources = projectWorkItemResources;
    projectWorkItems = { tasks: [], pullRequests: [], events: [] };
    return () => resources?.dispose();
  });
  $effect(() => {
    projectWorkItemResources?.retain(
      projectCatalog.repositories.map((repository) => repository.event),
    );
  });
  type ProjectSessionLifecycle = {
    key: readonly unknown[];
    dispose: () => void;
  };
  let activeProjectSessionLifecycle: ProjectSessionLifecycle | undefined;
  const projectSessionKeysMatch = (
    current: readonly unknown[],
    next: readonly unknown[],
  ) =>
    current.length === next.length &&
    current.every((value, index) => Object.is(value, next[index]));
  let projectLoading = $state(false);
  let projectCatalogSettled = $state(false);
  let projectCatalogScopeKey = "";
  let projectCatalogVerifiedAt = $state<number>();
  let cachedProjectCatalogAt = $state<number>();
  let projectError = $state("");
  let projectOperation = $state("");
  let projectReloadRevision = $state(0);
  let projectWorkItemsLoading = $state(false);
  let communityQueryClient = $state.raw(createCommunityQueryClient());
  let communityQueryClientScopeKey = $state("");

  onDestroy(() => {
    if (appSearchTimer !== undefined) clearTimeout(appSearchTimer);
    const lifecycle = activeProjectSessionLifecycle;
    activeProjectSessionLifecycle = undefined;
    lifecycle?.dispose();
  });

  function updateAppSearchInput(query: string): void {
    appSearchInput = query;
    if (appSearchTimer !== undefined) clearTimeout(appSearchTimer);
    appSearchTimer = undefined;

    if (query.trim() === "") {
      appSearchQuery = "";
      void community.actions.search("");
      return;
    }

    appSearchTimer = setTimeout(() => {
      appSearchTimer = undefined;
      appSearchQuery = query;
      void community.actions.search(query);
    }, appSearchDebounceMs);
  }

  $effect(() => {
    if (searchOpen || (appSearchInput === "" && appSearchQuery === "")) return;
    if (appSearchTimer !== undefined) clearTimeout(appSearchTimer);
    appSearchTimer = undefined;
    appSearchInput = "";
    appSearchQuery = "";
    void community.actions.search("");
  });
  let projectOverviewInitialized = $state(false);
  const initializedChannelProjectOverviews = new Set<string>();
  const initialRepositoryRoute = repositoryRouteState(
    initialApplicationLocation.projectRoute,
  );
  let selectedRepositoryCoordinate = $state(initialRepositoryRoute.coordinate);
  let selectedRepositoryProjectCoordinate = $state("");
  let activeRepositorySurface = $state<ProjectForgeSurface>(
    initialRepositoryRoute.surface,
  );
  let selectedPullRequestId = $state("");
  let selectedTaskId = $state("");
  let taskListFilter = $state<ProjectTaskListFilter>(
    PROJECT_TASK_LIST_FILTER_DEFAULT,
  );
  let reviewListFilter = $state<ProjectReviewListFilter>(
    PROJECT_REVIEW_LIST_FILTER_DEFAULT,
  );
  let projectDialogRequest = $state<CommunityProjectsDialogRequest>();
  let projectDialogSequence = 0;
  let projectRouteCursorTimer: ReturnType<typeof setTimeout> | undefined;
  let projectCommits = $state.raw<readonly ProjectForgeCommit[]>([]);
  let projectCommitsMore = $state(false);
  let projectCommitsLoadingMore = $state(false);
  let projectCommitBranch = $state("");
  let projectRepositoryBranches = $state.raw<readonly ProjectForgeRef[]>([]);
  let projectSelectedRepositoryBranch = $state(
    initialApplicationLocation.projectRoute?.surface === "files"
      ? (initialApplicationLocation.projectRoute.revision ?? "")
      : "",
  );
  let projectSelectedRepositoryBranchOwner = $state(
    initialApplicationLocation.projectRoute?.surface === "files"
      ? initialApplicationLocation.projectRoute.kind === "repository"
        ? initialApplicationLocation.projectRoute.coordinate
        : (initialApplicationLocation.projectRoute.repositoryCoordinate ?? "")
      : "",
  );
  const projectVisibleRepositoryBranch = $derived(
    projectSelectedRepositoryBranch &&
      projectSelectedRepositoryBranchOwner === selectedRepositoryCoordinate
      ? projectSelectedRepositoryBranch
      : projectCommitBranch,
  );
  let projectCommitActivity = $state.raw<readonly ProjectForgeCommitActivity[]>(
    [],
  );
  let selectedProjectCommit = $state.raw<ProjectForgeCommit | undefined>(
    projectRouteCommit(initialApplicationLocation.projectRoute),
  );
  let projectCommitDetail = $state.raw<ProjectForgeCommitResponse>();
  let projectRepositoryCapabilities =
    $state.raw<ProjectForgeRepositoryCapabilitiesByCoordinate>({});
  let projectSourceError = $state("");
  let projectTree = $state.raw<ProjectForgeTreeResponse>();
  let projectOwners = $state.raw<OwnersDocument>();
  let projectBlob = $state.raw<ProjectForgeBlobResponse>();
  let selectedProjectPath = $state(
    initialApplicationLocation.projectRoute?.surface === "files"
      ? (initialApplicationLocation.projectRoute.path ?? "")
      : "",
  );
  let projectFilesRepositoryCoordinate = $state("");
  let projectSourceRepositoryCoordinate = $state("");
  let projectRepositoryRevision = $state("");
  let projectPullRequestDiff = $state.raw<ProjectForgePullRequestDiff>();
  let projectPullRequestDiffError = $state("");
  let pendingProjectMembership = $state.raw<{
    project: import("../../protocol/index.js").NostrEvent;
    repositoryCoordinate: string;
  }>();

  const workspace = $derived(community.state.workspace);
  provideCommunityMemberPresence(
    (member) =>
      community.state.presence?.members[member.id]?.status ?? "unknown",
  );
  const applicationLocation = $derived(
    currentCommunityApplicationLocation(navigationHistory),
  );
  const activeDestination = $derived(applicationLocation.destination);
  const activePanel = $derived(applicationLocation.panel);
  const activeMainSurface = $derived(applicationLocation.mainSurface);
  const selectedProjectCoordinate = $derived(
    applicationLocation.projectRoute?.kind === "project"
      ? applicationLocation.projectRoute.coordinate
      : projectCoordinateFromDestination(activeDestination),
  );
  $effect(() => {
    void selectedProjectCoordinate;
    void selectedRepositoryCoordinate;
    taskListFilter = PROJECT_TASK_LIST_FILTER_DEFAULT;
    reviewListFilter = PROJECT_REVIEW_LIST_FILTER_DEFAULT;
  });
  const isProjectsDestination = $derived(
    hasProjects && isProjectDestination(activeDestination),
  );
  const isProjectDirectory = $derived(
    hasProjects && activeDestination === "projects",
  );
  const selectedProject = $derived(
    selectedProjectCoordinate === undefined
      ? undefined
      : projectCatalog.projects.find(
          (project) => project.address.coordinate === selectedProjectCoordinate,
        ),
  );
  const listedProjects = $derived(
    projectCatalog.projects.filter((project) => project.listing === "listed"),
  );
  const selectedProjectRepositories = $derived(
    selectedProject === undefined
      ? []
      : selectedProject.repositories
          .map((reference) =>
            projectCatalog.repositories.find(
              (repository) =>
                repository.address.coordinate === reference.coordinate,
            ),
          )
          .filter((repository) => repository !== undefined),
  );
  const selectedRepository = $derived(
    projectCatalog.repositories.find(
      (repository) =>
        repository.address.coordinate === selectedRepositoryCoordinate,
    ),
  );
  const selectedRepositoryGitHubConnected = $derived(
    selectedRepository === undefined
      ? false
      : projectRepositoryCapabilities[selectedRepository.address.coordinate]
          ?.git_authority_backend === "github",
  );
  const selectedRepositoryProject = $derived(
    selectedRepository === undefined
      ? undefined
      : preferredProjectForRepository(
          projectCatalog.projects,
          selectedRepository.address.coordinate,
          selectedRepositoryProjectCoordinate ||
            projectCoordinateFromDestination(activeDestination) ||
            "",
        ),
  );
  const unavailableProjectRoute = $derived.by(() => {
    const route = applicationLocation.projectRoute;
    if (!projectCatalogSettled || route === undefined) return undefined;
    const exists =
      route.kind === "project"
        ? projectCatalog.projects.some(
            (project) => project.address.coordinate === route.coordinate,
          )
        : projectCatalog.repositories.some(
            (repository) => repository.address.coordinate === route.coordinate,
          );
    return exists ? undefined : route;
  });
  const selectedRepositoryTasks = $derived(
    selectedRepository === undefined
      ? []
      : projectWorkItems.tasks.filter(
          (task) =>
            task.repository.coordinate ===
            selectedRepository.address.coordinate,
        ),
  );
  const selectedRepositoryPullRequests = $derived(
    selectedRepository === undefined
      ? []
      : projectWorkItems.pullRequests.filter(
          (pullRequest) =>
            pullRequest.repository.coordinate ===
            selectedRepository.address.coordinate,
        ),
  );
  const selectedProjectSurface = $derived<ProjectForgeSurface | undefined>(
    applicationLocation.projectRoute?.kind === "project"
      ? applicationLocation.projectRoute.surface
      : activeMainSurface?.startsWith("project-")
        ? (activeMainSurface.slice("project-".length) as ProjectForgeSurface)
        : undefined,
  );
  const projectsOverviewSurface = $derived<ProjectForgeOverviewSurface>(
    activeMainSurface?.startsWith("projects-")
      ? (activeMainSurface.slice(
          "projects-".length,
        ) as ProjectForgeOverviewSurface)
      : "activity",
  );
  const activeProjectSurface = $derived<ProjectForgeSurface>(
    selectedProjectSurface ?? "activity",
  );
  const projectActivity = $derived(
    buildRepositoryActivity(
      projectCatalog,
      projectWorkItems,
      repositoryCommitActivity(
        selectedRepository,
        (selectedRepositoryProject ?? selectedProject)?.address.coordinate,
        projectCommits,
        projectCommitActivity,
      ),
    ),
  );
  const projectChannelCount = $derived(
    new Set(
      listedProjects.flatMap((project) =>
        projectForgeBoundChannels(project, projectCatalog.repositories).map(
          (binding) => binding.channelId,
        ),
      ),
    ).size,
  );
  const selectedPullRequest = $derived(
    projectWorkItems.pullRequests.find(
      (pullRequest) => pullRequest.root.id === selectedPullRequestId,
    ),
  );
  // prettier-ignore
  const selectedTask = $derived(taskForProjectRoute(projectWorkItems.tasks, applicationLocation.projectRoute, selectedTaskId));
  const projectOverviewTabs = PROJECT_DIRECTORY_TABS;
  const selectedProjectTabs = PROJECT_WORKSPACE_TABS;
  const selectedRepositoryTabs = PROJECT_REPOSITORY_TABS;
  const communityStartupPending = $derived(
    community.state.status === "idle" ||
      community.state.status === "restoring" ||
      community.state.status === "connecting" ||
      community.state.status === "synchronizing",
  );
  const allRooms = $derived(
    workspace.navigationSections.flatMap((section) => section.rooms),
  );
  const selectedProjectRoom = $derived(
    (selectedRepositoryProject ?? selectedProject) === undefined
      ? undefined
      : roomForProjectChannel(
          (selectedRepositoryProject ?? selectedProject)!.channelId,
        ),
  );
  provideCommunityApplicationComposer({
    members: () => presentationWorkspace.members,
    rooms: () => presentationRooms,
    emojis: () => community.state.settings.customEmojis,
    onOpenMember: () => openProfile,
    onMessageMember: () => messageMember,
    onWaveMember: () => waveMember,
  });
  provideProjectLogNavigation(() => applicationLocation, pushLocation);
  // prettier-ignore
  provideForumTopicSync(() => applicationLocation, () => allRooms, (topicId) => community.actions.openTopic(topicId), (value, success) => void copyText(value, success), pushLocation, () => ({ rooms: allRooms, catalog: projectCatalog, workItems: projectWorkItems, commits: projectCommits, activity: projectCommitActivity, repositoryCoordinate: selectedRepositoryCoordinate, events: [...projectCatalog.events, ...projectWorkItems.events] }));
  const startupDestinationRoom = $derived(
    communityStartupPending
      ? allRooms.find((room) => room.id === activeDestination)
      : undefined,
  );
  const activeRoom = $derived(
    selectedProjectRoom ??
      startupDestinationRoom ??
      findCommunityRoom(workspace) ??
      fallbackRoom(workspace.activeRoomId || activeDestination),
  );
  const activeRoomHasProjectedHistory = $derived(
    workspace.activeRoomId === activeRoom.id &&
      (workspace.view === "forum-index"
        ? workspace.topics.length > 0
        : workspace.messages.length > 0),
  );
  const activeRoomHistoryLoading = $derived(
    !activeRoomHasProjectedHistory &&
      (communityStartupPending ||
        community.state.contentSync?.rooms[activeRoom.id] === "unloaded"),
  );
  const activeChannelProjectContext = $derived.by(() => {
    if (isProjectsDestination || activeRoom.kind !== "channel")
      return undefined;
    const roomIds = new Set(
      [activeRoom.id, activeRoom.groupId].filter(
        (value): value is string => typeof value === "string" && value !== "",
      ),
    );
    for (const project of projectCatalog.projects) {
      const repositories = project.repositories
        .map((reference) =>
          projectCatalog.repositories.find(
            (repository) =>
              repository.address.coordinate === reference.coordinate,
          ),
        )
        .filter((repository) => repository !== undefined);
      const binding = projectForgeBoundChannels(project, repositories).find(
        (candidate) => {
          const room = roomForProjectChannel(candidate.channelId);
          return (
            room !== undefined &&
            (roomIds.has(room.id) ||
              (room.groupId !== undefined && roomIds.has(room.groupId)))
          );
        },
      );
      if (binding) return { project, repositories, binding };
    }
    return undefined;
  });
  const activeChannelProject = $derived(activeChannelProjectContext?.project);
  const activeChannelProjectCoordinate = $derived(
    activeChannelProject?.address.coordinate,
  );
  const activeChannelProjectRepositories = $derived(
    activeChannelProjectContext?.repositories ?? [],
  );
  const activeChannelProjectBindings = $derived(
    activeChannelProject === undefined
      ? []
      : projectForgeBoundChannels(
          activeChannelProject,
          activeChannelProjectRepositories,
        ),
  );
  const activeChannelProjectRepositoryCoordinates = $derived(
    new Set(
      activeChannelProject?.repositories.map(
        (reference) => reference.coordinate,
      ) ?? [],
    ),
  );
  const activeChannelProjectTasks = $derived(
    projectWorkItems.tasks.filter((task) =>
      activeChannelProjectRepositoryCoordinates.has(task.repository.coordinate),
    ),
  );
  const activeChannelProjectPullRequests = $derived(
    projectWorkItems.pullRequests.filter((pullRequest) =>
      activeChannelProjectRepositoryCoordinates.has(
        pullRequest.repository.coordinate,
      ),
    ),
  );
  const isPluginReleaseRoom = $derived(
    activeRoom.groupId === pluginReleaseGroupId &&
      activeDestination === activeRoom.id,
  );
  const releaseSheetOpen = $derived(
    isPluginReleaseRoom && activeMainSurface !== undefined,
  );
  const projectSheetProject = $derived(
    selectedProjectSurface !== undefined &&
      applicationLocation.projectRoute === undefined
      ? activeChannelProject
      : undefined,
  );
  const projectSheetRepositories = $derived(
    projectSheetProject === activeChannelProject
      ? activeChannelProjectRepositories
      : selectedProjectRepositories,
  );
  const selectedProjectFilesRoute = $derived(
    applicationLocation.projectRoute?.kind === "project" &&
      applicationLocation.projectRoute.surface === "files"
      ? applicationLocation.projectRoute
      : undefined,
  );
  const projectFilesRepositories = $derived(
    (selectedProjectFilesRoute || selectedProjectSurface === "files"
      ? projectSheetProject
        ? projectSheetRepositories
        : selectedProjectRepositories
      : []
    ).filter((repository) => repository.repositoryClass !== "task-anchor"),
  );
  const selectedProjectFilesRepository = $derived.by(() =>
    preferredProjectFilesRepository(projectFilesRepositories, {
      selectedCoordinate:
        selectedProjectFilesRoute?.repositoryCoordinate ||
        projectFilesRepositoryCoordinate,
      channelRepositoryCoordinate:
        projectSheetProject === activeChannelProject
          ? activeChannelProjectContext?.binding.repositoryCoordinate
          : undefined,
    }),
  );
  const communityProjectsSelectedRepository = $derived(
    selectedRepository ??
      (selectedProjectSurface === "files"
        ? selectedProjectFilesRepository
        : undefined),
  );
  const projectSheetOpen = $derived(
    projectSheetProject !== undefined && selectedProjectSurface !== undefined,
  );
  const projectOverviewShown = $derived(
    !projectOverviewSidebar.closed && !projectOverviewSidebar.collapsed,
  );
  const projectOverviewMobileActive = $derived(
    shell.mobile.resolvedMode === "mobile" &&
      shell.mobile.stage === "right" &&
      shell.mobile.activePanelId("right") === PROJECT_OVERVIEW_PANEL_ID,
  );
  const projectSheetMobileRoot = $derived(
    projectSheetOpen && shell.mobile.resolvedMode === "mobile",
  );
  const projectSheetLayerStyle = $derived(
    projectSheetMobileRoot
      ? "--ui-shell-surface-layer-main-start-allowance: 0.5rem; --ui-shell-surface-layer-inline-end-inset: 0.5rem"
      : "--ui-shell-surface-layer-main-start-allowance: 7rem; --ui-shell-surface-layer-inline-end-inset: 0px",
  );
  const keepLane = $derived(projectSheetOpen && projectOverviewMobileActive);
  const releaseOverviewShown = $derived(
    activeMainSurface === undefined &&
      !releaseOverviewSidebar.closed &&
      !releaseOverviewSidebar.collapsed,
  );
  const releaseOverviewMobileActive = $derived(
    shell.mobile.resolvedMode === "mobile" &&
      shell.mobile.stage === "right" &&
      shell.mobile.activePanelId("right") ===
        COMMUNITY_APPLICATION_RELEASE_OVERVIEW_PANEL_ID,
  );
  const projectChannelRoomIds = $derived.by(() => {
    const ids = new Set<string>();
    for (const project of projectCatalog.projects) {
      for (const binding of projectForgeBoundChannels(
        project,
        projectCatalog.repositories,
      )) {
        const room = roomForProjectChannel(binding.channelId);
        if (room?.kind === "channel") ids.add(room.id);
      }
    }
    return ids;
  });
  // Cache decorated rooms by their source object so presentation updates retain
  // unchanged room references. Association removal restores the original room.
  const projectRoomPresentationCache = new WeakMap<
    CommunityRoomModel,
    CommunityRoomModel
  >();
  function presentProjectRoom(room: CommunityRoomModel): CommunityRoomModel {
    if (!projectChannelRoomIds.has(room.id)) return room;
    let presentation = projectRoomPresentationCache.get(room);
    if (!presentation) {
      presentation = { ...room, isProjectChannel: true };
      projectRoomPresentationCache.set(room, presentation);
    }
    return presentation;
  }
  const presentationRooms = $derived(allRooms.map(presentProjectRoom));
  const presentationWorkspace = $derived(
    presentCommunityWorkspace(
      workspace,
      presentProjectRoom,
      community.state.agents,
    ),
  );
  const workspaceSurfaceModel = $derived(
    selectedProjectRoom !== undefined
      ? {
          ...presentationWorkspace,
          activeRoomId: selectedProjectRoom.id,
          view:
            selectedProjectRoom.kind === "forum"
              ? ("forum-index" as const)
              : ("channel" as const),
          messages:
            workspace.activeRoomId === selectedProjectRoom.id
              ? workspace.messages
              : [],
          topics:
            workspace.activeRoomId === selectedProjectRoom.id
              ? workspace.topics
              : [],
        }
      : startupDestinationRoom === undefined
        ? presentationWorkspace
        : {
            ...presentationWorkspace,
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
      presentationWorkspace.members,
      workspace.currentMemberId,
    ),
  );
  const composerAgents = $derived(
    communityComposerAgentsFromState(community.state.agents),
  );
  const agentMemberIds = $derived(composerAgents.map((agent) => agent.pubkey));
  const inbox = $derived(
    presentCommunityIdentityModel(
      community.state.inbox ?? fallbackInbox(activeRoom, workspace.members),
      community.state.agents,
    ),
  );
  let readyInboxVisit = $state<string>();
  const inboxFocusKey = $derived(
    activeDestination === "inbox"
      ? `${workspace.currentMemberId ?? ""}:${inbox.activeItemId}`
      : "",
  );
  $effect(() => {
    const key = inboxFocusKey;
    if (key && inboxReady)
      untrack(() => {
        if (community.actions.selectInboxItem) {
          if (inbox.activeItemId)
            void community.actions.selectInboxItem(inbox.activeItemId);
          else community.actions.closeSidePanel();
        } else {
          // Preserve unpaged/custom controllers without Inbox selection actions.
          if (workspace.activeRoomId !== inbox.room.id)
            community.actions.selectRoom(inbox.room.id);
          community.actions.closeSidePanel();
        }
        if (activePanel.kind === "thread")
          community.actions.openThread(activePanel.rootMessageId);
        else if (
          activePanel.kind === "details" &&
          activePanel.roomId !== inbox.room.id
        )
          community.actions.openDetails();
      });
  });

  const currentMember = $derived(
    workspace.currentMemberId
      ? memberById(workspace.members, workspace.currentMemberId)
      : undefined,
  );
  const applicationAccount = $derived(applicationAuthentication?.account?.());
  const reconnectAccountId = $derived(
    applicationAuthentication?.status?.() === "reconnect-required"
      ? applicationAccount?.account.id
      : undefined,
  );
  const notificationScope = $props.id();
  provideApplicationNotifications({
    scope: notificationScope,
    reconnectAccountId: () => reconnectAccountId,
    reconnect: () => {
      void runAuthenticated(() => {});
    },
    agents: () => community.state.agents,
    take: () => community.actions.agents?.takePermissionNotifications?.() ?? [],
    open: openAgentActivity,
  });
  const memberCommandRoom = $derived(
    resolveMemberCommandRoom(
      presentationRooms,
      activeRoom,
      memberCommandRoomId,
    ),
  );
  const activeRoomMemberIds = $derived(
    activeRoom.kind === "direct"
      ? (activeRoom.participantIds ?? [])
      : workspace.members
          .filter((member) => member.role !== undefined)
          .map((member) => member.id),
  );
  const memberCommandMemberIds = $derived(
    memberCommandGroupIds(memberCommandRoom, workspace.members),
  );
  const releaseRoomMembers = $derived(
    isPluginReleaseRoom
      ? activeRoomMemberIds.length === 0
        ? workspace.members
        : workspace.members.filter((member) =>
            activeRoomMemberIds.includes(member.id),
          )
      : [],
  );
  const pendingReleaseReviewCount = $derived(
    releaseReviewEntries.filter((entry) => entry.inspection.state === "pending")
      .length,
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
  const activeConnectionRelayUrl = $derived(activeConnection?.relayUrl);
  const activeConnectionCommunityId = $derived(activeConnection?.communityId);
  const inboxVisit = $derived(
    activeDestination === "inbox"
      ? JSON.stringify([
          activeConnection?.communityId,
          activeConnection?.relayUrl,
          workspace.currentMemberId,
        ])
      : undefined,
  );
  const inboxReady = $derived(
    inboxVisit !== undefined && readyInboxVisit === inboxVisit,
  );
  $effect(() => {
    const visit = inboxVisit;
    readyInboxVisit = undefined;
    if (visit === undefined) return;
    // Effects and promise continuations run before paint. Leave one frame for
    // the Inbox regions before mounting the editor or starting projections.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        readyInboxVisit = visit;
      });
    });
    return () => cancelAnimationFrame(frame);
  });

  const projectDataSource = $derived(projectsOptions?.source);
  const projectCatalogStore = $derived(projectsOptions?.catalogStore);
  const projectConfiguredRelayUrl = $derived(projectsOptions?.relayUrl);
  const projectHttpBaseUrl = $derived(projectsOptions?.httpBaseUrl);
  const projectIdentity = $derived(projectsOptions?.identity);
  const projectChannelId = $derived(projectsOptions?.channelId);
  const projectReviewPreferenceScope = $derived.by(() => {
    const relayUrl = projectConfiguredRelayUrl ?? activeConnectionRelayUrl;
    const communityId =
      activeConnectionCommunityId ?? projectChannelId ?? "projects";
    const memberId = workspace.currentMemberId;
    return relayUrl && memberId
      ? { relayUrl, communityId, memberId }
      : undefined;
  });
  const communityQueryScope = $derived<CommunityQueryScope>({
    communityId:
      activeConnectionCommunityId ?? workspace.activeCommunityId ?? "projects",
    identityPubkey:
      community.state.authentication.pubkey ??
      workspace.currentMemberId ??
      "anonymous",
    relayUrls: communityQueryRelayUrls(
      projectConfiguredRelayUrl,
      activeConnectionRelayUrl,
    ),
  });
  const communityQueryScopeKey = $derived(
    communityQueryScopeStorageKey(communityQueryScope),
  );
  const communityQueryProviderKey = $derived(
    communityQueryClientScopeKey || communityQueryScopeKey,
  );
  $effect.pre(() => {
    const nextScopeKey = communityQueryScopeKey;
    if (!communityQueryClientScopeKey) {
      communityQueryClientScopeKey = nextScopeKey;
      return;
    }
    if (communityQueryClientScopeKey === nextScopeKey) return;
    const previousClient = communityQueryClient;
    communityQueryClient = createCommunityQueryClient();
    communityQueryClientScopeKey = nextScopeKey;
    previousClient.clear();
  });
  const hasCommunityConnection = $derived(
    community.state.status === "connected",
  );
  const hasRestoredCommunityData = $derived(
    community.state.cache.freshness !== "empty" &&
      workspace.navigationSections.some((section) => section.rooms.length > 0),
  );
  const hasCachedCommunityData = $derived(
    community.state.status === "offline" &&
      community.state.cache.freshness === "offline" &&
      hasRestoredCommunityData,
  );
  const hasCommunitySurface = $derived(
    hasCommunityConnection || hasRestoredCommunityData,
  );
  const displayMember = $derived<CommunityMemberModel>(
    currentMember ??
      (applicationAccount === undefined
        ? fallbackMember(community.state.settings)
        : accountSessionMember(applicationAccount, community.state.settings)),
  );
  const authenticated = $derived(
    community.state.authentication.status === "connected",
  );
  const signedIn = $derived(authenticated || applicationAccount !== undefined);
  const signingOut = $derived(
    applicationAuthentication?.signingOut?.() ?? false,
  );
  const canManageForge = $derived(authenticated);
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
        ? [
            {
              id: "inbox",
              label: "Inbox",
              kind: "inbox" as const,
              unreadCount: inbox.unreadCount ?? 0,
              ...(inbox.unreadComplete === undefined
                ? {}
                : { unreadComplete: inbox.unreadComplete }),
            },
          ]
        : []),
      ...(community.state.capabilities.pulse === true &&
      community.state.pulse !== undefined &&
      community.actions.pulse !== undefined
        ? [{ id: "pulse", label: "Pulse", kind: "pulse" as const }]
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
      ...(hasProjects
        ? [{ id: "projects", label: "Projects", kind: "projects" as const }]
        : []),
      ...(authenticated &&
      community.state.agents &&
      community.actions.agents &&
      (community.state.agents.status !== "unsupported" ||
        community.state.agents.archivedAgents.length > 0)
        ? [{ id: "agents", label: "Agents", kind: "agents" as const }]
        : []),
    ],
    sections: orderNavigationSections([
      ...(hasProjects && listedProjects.length > 0
        ? [
            {
              id: "projects",
              label: "Projects",
              kind: "projects" as const,
              ...(authenticated
                ? {
                    primaryAction: {
                      id: "create",
                      label: "Create project",
                      icon: "create" as const,
                    },
                  }
                : {}),
              actions: [
                {
                  id: "browse",
                  label: "Browse projects",
                  icon: "browse" as const,
                },
              ],
              sortable: true,
              items: listedProjects.map((project) => ({
                id: projectDestinationFromCoordinate(
                  project.address.coordinate,
                ),
                label: project.name,
                kind: "projects" as const,
                initiallyExpanded:
                  selectedProjectCoordinate === project.address.coordinate,
                children: projectForgeChildChannels(
                  project,
                  projectCatalog.repositories,
                ).flatMap((binding) => {
                  const room = roomForProjectChannel(binding.channelId);
                  if (!room) return [];
                  return [
                    {
                      id: room.id,
                      ...(projectChannelRoomIds.has(room.id)
                        ? { icon: "project-channel" }
                        : {}),
                      label: room.name,
                      kind:
                        room.kind === "direct"
                          ? ("direct-message" as const)
                          : room.kind,
                      ...(room.private === undefined
                        ? {}
                        : { restricted: room.private }),
                    },
                  ];
                }),
              })),
            },
          ]
        : []),
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
              ...(authenticated
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
                ...(community.state.capabilities.groupInvites === true &&
                community.actions.joinWithInvite !== undefined
                  ? [
                      {
                        id: "join-invite",
                        label: "Join with invite",
                        icon: "join-invite" as const,
                      },
                    ]
                  : []),
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
                ...(community.state.capabilities.groupInvites === true &&
                community.actions.joinWithInvite !== undefined
                  ? [
                      {
                        id: "join-invite",
                        label: "Join with invite",
                        icon: "join-invite" as const,
                      },
                    ]
                  : []),
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
            ...(projectChannelRoomIds.has(room.id)
              ? { icon: "project-channel" }
              : {}),
            label: room.name,
            kind:
              room.kind === "direct" ? ("direct-message" as const) : room.kind,
            ...(room.kind === "direct"
              ? {
                  member: directMemberForRoom(
                    room,
                    presentationWorkspace.members,
                    workspace.currentMemberId,
                  )!,
                }
              : {}),
            ...(room.unreadComplete === undefined
              ? {}
              : { unreadComplete: room.unreadComplete }),
            ...(room.private === undefined ? {} : { restricted: room.private }),
            ...(room.mentionCount === undefined &&
            room.unreadCount === undefined
              ? {}
              : { unreadCount: room.unreadCount ?? room.mentionCount }),
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
            ...(projectChannelRoomIds.has(room.id)
              ? { icon: "project-channel" }
              : {}),
            label: room.name,
            kind:
              room.kind === "direct" ? ("direct-message" as const) : room.kind,
            ...(room.kind === "direct"
              ? {
                  member: directMemberForRoom(
                    room,
                    presentationWorkspace.members,
                    workspace.currentMemberId,
                  )!,
                }
              : {}),
            ...(room.unreadComplete === undefined
              ? {}
              : { unreadComplete: room.unreadComplete }),
            ...(room.private === undefined ? {} : { restricted: room.private }),
            ...(room.mentionCount === undefined &&
            room.unreadCount === undefined
              ? {}
              : { unreadCount: room.unreadCount ?? room.mentionCount }),
            starred: community.state.navigation.starredRoomIds.includes(
              room.id,
            ),
            muted: community.state.navigation.mutedRoomIds.includes(room.id),
          })),
      })),
    ]),
  });
  const searchRooms = $derived(presentationRooms);
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
  const knownSearchMembers = $derived(
    [...workspace.members, ...projectedSearchResults.members].filter(
      (member, index, values) =>
        values.findIndex((candidate) => candidate.id === member.id) === index,
    ),
  );
  const searchMembers = $derived(
    knownSearchMembers.filter((member) =>
      `${member.name} ${member.handle}`
        .toLocaleLowerCase()
        .includes(appSearchQuery.toLocaleLowerCase()),
    ),
  );
  const searchScope = $derived.by((): CommunitySearchScope | undefined => {
    const roomIdsFor = (channelIds: readonly string[]): string[] => {
      const roomIds = new Set<string>();
      for (const channelId of channelIds) {
        roomIds.add(channelId);
        const room = roomForProjectChannel(channelId);
        if (room === undefined) continue;
        roomIds.add(room.id);
        if (room.groupId) roomIds.add(room.groupId);
      }
      return [...roomIds];
    };

    if (selectedRepository !== undefined) {
      return {
        id: `repository:${selectedRepository.address.coordinate}`,
        kind: "repository",
        label: selectedRepository.name,
        roomIds: roomIdsFor([selectedRepository.channelId]),
      };
    }

    if (selectedProject !== undefined) {
      return {
        id: `project:${selectedProject.address.coordinate}`,
        kind: "project",
        label: selectedProject.name,
        roomIds: roomIdsFor(
          projectForgeBoundChannels(
            selectedProject,
            selectedProjectRepositories,
          ).map((binding) => binding.channelId),
        ),
      };
    }

    if (isProjectDirectory) {
      return {
        id: "projects",
        kind: "projects",
        label: "Projects",
        roomIds: roomIdsFor(
          projectCatalog.projects.flatMap((project) =>
            projectForgeBoundChannels(
              project,
              project.repositories
                .map((reference) =>
                  projectCatalog.repositories.find(
                    (repository) =>
                      repository.address.coordinate === reference.coordinate,
                  ),
                )
                .filter((repository) => repository !== undefined),
            ).map((binding) => binding.channelId),
          ),
        ),
      };
    }

    if (
      hasRegistry &&
      registryRouteFromDestination(activeDestination) !== null
    ) {
      return {
        id: "registry",
        kind: "registry",
        label: "Registry",
        roomIds: roomIdsFor([pluginReleaseGroupId]),
      };
    }

    if (activeRoom.id !== activeDestination) return undefined;
    return {
      id: `room:${activeRoom.id}`,
      kind: activeRoom.kind === "direct" ? "conversation" : activeRoom.kind,
      label:
        activeRoom.kind === "direct" ? activeRoom.name : `#${activeRoom.name}`,
      roomIds: [activeRoom.id, activeRoom.groupId].filter(
        (value): value is string => value !== undefined && value !== "",
      ),
    };
  });
  const selectedRecipients = $derived(
    selectedRecipientIds
      .map((id) => workspace.members.find((member) => member.id === id))
      .filter((member) => member !== undefined),
  );
  const isRegistryDestination = $derived(
    hasRegistry && registryRouteFromDestination(activeDestination) !== null,
  );
  const registryBreadcrumbPluginName = $derived(
    registryRoute.page === "plugin" &&
      registryBreadcrumbEntry?.id === registryRoute.pluginId
      ? registryBreadcrumbEntry.name
      : undefined,
  );
  const usesRoomToolbar = $derived(
    !isRegistryDestination &&
      !isProjectsDestination &&
      (hasCommunitySurface || communityStartupPending) &&
      activeDestination !== "settings" &&
      activeDestination !== "inbox" &&
      activeDestination !== "pulse" &&
      activeDestination !== "agents" &&
      activeDestination !== "new-direct-message",
  );
  const activeItemId = $derived(
    activeDestination === "inbox" ||
      activeDestination === "pulse" ||
      activeDestination === "agents" ||
      isRegistryDestination ||
      isProjectsDestination
      ? activeDestination === "inbox"
        ? "inbox"
        : activeDestination === "pulse"
          ? "pulse"
          : activeDestination === "agents"
            ? "agents"
            : isProjectsDestination
              ? selectedProjectCoordinate === undefined
                ? "projects"
                : activeDestination
              : "registry"
      : activeDestination === "settings"
        ? undefined
        : workspace.activeRoomId,
  );
  const navigationSectionKey = $derived(
    activeConnection
      ? navigationSectionStorageKey(
          activeConnection.communityId,
          activeConnection.relayUrl,
          applicationAccount?.account.nostr_pubkey ??
            workspace.currentMemberId ??
            "anonymous",
        )
      : undefined,
  );
  $effect(() => {
    const key = navigationSectionKey;
    if (key === undefined) return;
    untrack(() => {
      navigationSectionOpen = loadNavigationSections(browserStorage, key);
      loadedNavigationSectionKey = key;
      pendingNavigationReveal = undefined;
    });
  });
  $effect(() => {
    const key = navigationSectionKey;
    if (key === undefined || loadedNavigationSectionKey !== key) return;
    saveNavigationSections(browserStorage, key, navigationSectionOpen);
  });
  $effect(() => {
    const destination = pendingNavigationReveal;
    if (
      destination === undefined ||
      loadedNavigationSectionKey !== navigationSectionKey
    )
      return;
    const sections = sectionsForDestination(
      navigationModel.sections,
      destination,
    );
    if (sections.length === 0) return;
    untrack(() => {
      const closed = sections.filter(
        (id) => navigationSectionOpen[id] !== true,
      );
      if (closed.length > 0) {
        navigationSectionOpen = {
          ...navigationSectionOpen,
          ...Object.fromEntries(closed.map((id) => [id, true])),
        };
      }
      pendingNavigationReveal = undefined;
    });
  });
  const navigationCompact = $derived(
    shell.mobile.resolvedMode === "desktop" &&
      shell.left.collapsed &&
      !shell.left.previewed,
  );
  const canNavigateBack = $derived(navigationHistory.index > 0);
  const canNavigateForward = $derived(
    navigationHistory.index < navigationHistory.entries.length - 1,
  );
  const selectedAgent = $derived(
    activePanel.kind === "profile"
      ? community.state.agents?.agents.find(
          (agent) => agent.pubkey === activePanel.memberId,
        )
      : undefined,
  );
  const knownAgentIds = $derived([
    ...new Set([
      ...(community.state.agents?.agents.map((agent) => agent.pubkey) ?? []),
      ...(community.state.agents?.archivedAgents.map((agent) => agent.pubkey) ??
        []),
    ]),
  ]);
  const activityRouteKey = $derived(
    activePanel.kind === "agent-activity" &&
      knownAgentIds.includes(activePanel.agentPubkey)
      ? `${workspace.activeCommunityId}:${community.state.authentication.pubkey ?? ""}:${communityApplicationPanelKey(activePanel)}`
      : "",
  );
  $effect(() => {
    if (!activityRouteKey) return;
    untrack(() => {
      if (activePanel.kind === "agent-activity")
        void community.actions.agents?.openActivity(
          activePanel.agentPubkey,
          activePanel.activityContext ?? activePanel.channelId,
        );
    });
  });
  const selectedProfile = $derived(
    activePanel.kind === "profile"
      ? (workspace.members.find(
          (member) => member.id === activePanel.memberId,
        ) ??
          (profileOverride?.id === activePanel.memberId
            ? profileOverride
            : undefined))
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
  const detailsCanvasInitialContent = $derived(
    detailsRoom
      ? projectCanvasStarterForChannel(projectCatalog, detailsRoom)
      : undefined,
  );
  const detailsCanvas = $derived<CommunityChannelCanvasModel | undefined>(
    detailsRoom &&
      detailsCanvasInitialContent !== undefined &&
      community.actions.loadCanvas &&
      community.actions.saveCanvas
      ? (community.state.canvases?.[
          channelCanvasKey(workspace.activeCommunityId, detailsRoom.id)
        ] ?? {
          roomId: detailsRoom.id,
          groupId: detailsRoom.groupId ?? detailsRoom.id,
          content: "",
          eventId: null,
          author: null,
          updatedAt: null,
          loading: true,
          canEdit: false,
        })
      : undefined,
  );
  const detailsCanvasLoadKey = $derived(
    detailsRoom && detailsCanvasInitialContent !== undefined
      ? JSON.stringify([
          workspace.activeCommunityId,
          workspace.currentMemberId,
          detailsRoom.id,
        ])
      : "",
  );
  const channelCanvasQuery = createQuery<
    CommunityChannelCanvasModel | null,
    Error
  >(
    () => {
      const room = detailsRoom;
      const roomId = room?.id ?? "";
      const enabled = Boolean(
        detailsCanvasLoadKey && community.actions.loadCanvas,
      );
      return {
        queryKey: roomId
          ? communityProjectQueryKeys.channelCanvas(communityQueryScope, roomId)
          : [
              ...communityProjectQueryKeys.root(communityQueryScope),
              "channel-canvas",
              "idle",
            ],
        enabled,
        staleTime: PROJECT_CHANNEL_READ_STALE_TIME_MS,
        gcTime: PROJECT_REPOSITORY_READ_GC_TIME_MS,
        queryFn: async () => {
          if (!roomId || !community.actions.loadCanvas) return null;
          await community.actions.loadCanvas(roomId);
          return (
            community.state.canvases?.[
              channelCanvasKey(workspace.activeCommunityId, roomId)
            ] ?? null
          );
        },
      };
    },
    () => communityQueryClient,
  );
  $effect(() => {
    if (channelCanvasQuery.isError) void channelCanvasQuery.error;
  });
  const visibleThread = $derived(
    communityApplicationThreadProjectionMatches(activePanel, workspace)
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
      : activePanel.kind === "agent-activity"
        ? "Agent activity"
        : activePanel.kind === "thread"
          ? "Thread"
          : detailsRoom?.kind === "channel"
            ? "Channel settings"
            : detailsRoom?.kind === "forum"
              ? "Forum settings"
              : "Conversation details",
  );

  function openProfile(member: CommunityMemberModel): void {
    profileOverride = member;
    openPanel({
      kind: "profile",
      memberId: member.id,
      activityContext: activityOrigin(),
    });
    lastAction = `opened-profile:${member.id}`;
  }

  function openAgentProfile(
    pubkey: string,
    context?: CommunityAgentActivityContext,
  ): void {
    const agent = community.state.agents?.agents.find(
      (entry) => entry.pubkey === pubkey,
    );
    if (agent) {
      profileOverride = communityAgentMember(agent);
      openPanel({
        kind: "profile",
        memberId: pubkey,
        activityContext: context ?? activityOrigin(),
      });
    } else closeSidePanel();
  }
  function activityOrigin(): CommunityAgentActivityContext {
    if (activePanel.kind === "profile" || activePanel.kind === "agent-activity")
      return activePanel.activityContext ?? { kind: "overview" };
    if (activePanel.kind === "thread") {
      const room = allRooms.find((room) => room.id === activePanel.roomId);
      return {
        kind: room?.kind === "forum" ? "forum-topic" : "thread",
        channelId: room?.groupId ?? activePanel.roomId,
        threadRootId: activePanel.rootMessageId,
      };
    }
    if (activeDestination !== activeRoom.id) return { kind: "overview" };
    if (activeRoom.kind === "direct")
      return {
        kind: "dm",
        ...(activeRoom.conversation
          ? { conversationId: conversationHash(activeRoom.conversation) }
          : activeRoom.participantIds
            ? {
                conversationId: directConversationHash(
                  activeRoom.participantIds,
                ),
              }
            : {}),
      };
    if (workspace.view === "forum-thread" && workspace.messages[0])
      return {
        kind: "forum-topic",
        channelId: activeRoom.groupId ?? activeRoom.id,
        threadRootId:
          workspace.messages.find((message) => message.sourceEvent?.kind === 11)
            ?.id ?? workspace.messages[0].id,
      };
    return { kind: "channel", channelId: activeRoom.groupId ?? activeRoom.id };
  }
  const visibleAgentSyncKey = $derived.by(() => {
    if (!community.actions.agents || activeDestination !== activeRoom.id)
      return "";
    const origin = activityOrigin();
    if (origin.kind === "overview") return "";
    const context: CommunityAgentActivitySyncContext =
      origin.kind === "dm"
        ? { kind: "dm" }
        : origin.kind === "channel"
          ? { kind: "channel", channelId: origin.channelId }
          : {
              kind: origin.kind,
              channelId: origin.channelId,
              threadRootId: origin.threadRootId,
            };
    const owned = community.state.agents?.agents ?? [];
    const agentPubkeys = owned
      .filter((agent) =>
        context.kind === "dm"
          ? (activeRoom.participantIds ?? []).includes(agent.pubkey)
          : agent.channelIds.includes(context.channelId),
      )
      .map((agent) => agent.pubkey)
      .sort();
    return agentPubkeys.length
      ? JSON.stringify([
          workspace.activeCommunityId,
          community.state.authentication.pubkey ?? "",
          context,
          agentPubkeys,
        ])
      : "";
  });
  $effect(() => {
    const key = visibleAgentSyncKey;
    if (!key) {
      untrack(() => community.actions.agents?.cancelActivitySync());
      return;
    }
    untrack(() => {
      const [, , context, agentPubkeys] = JSON.parse(key) as [
        string,
        string,
        CommunityAgentActivitySyncContext,
        string[],
      ];
      void community.actions.agents?.syncActivity(context, agentPubkeys);
    });
    return () => {
      untrack(() => community.actions.agents?.cancelActivitySync());
    };
  });
  function openAgentActivity(
    pubkey: string,
    context?: string | CommunityAgentActivityContext,
  ): void {
    const activityContext =
      typeof context === "string"
        ? { kind: "channel" as const, channelId: context }
        : (context ?? activityOrigin());
    openPanel({
      kind: "agent-activity",
      agentPubkey: pubkey,
      activityContext,
      ...("channelId" in activityContext
        ? { channelId: activityContext.channelId }
        : {}),
    });
  }
  provideAgentComposerActivity({
    model: () => community.state.agents,
    rooms: () => presentationRooms,
    open: openAgentActivity,
  });

  provideAgentConversation({
    session: () => projectSession,
    memberId: () => workspace.currentMemberId,
    members: () => presentationWorkspace.members,
    rooms: () => allRooms,
    openThread: (roomId, rootMessageId, replyTargetId) =>
      openPanel(agentThreadPanel(roomId, rootMessageId, replyTargetId)),
  });
  const agentContextNavigation = provideAgentContextNavigation({
    rooms: () => allRooms,
    messages: () => searchMessages,
    selectRoom: (roomId) => setDestination(roomId, true),
    openPanel: openPanelForDestination,
    openTopic: (topicId) => community.actions.openTopic(topicId),
    openDirectMessage: (agent) => {
      community.actions.openDirectMessage([agent]);
      closeSidePanel();
    },
  });

  function openReleaseProfile(member: CommunityMemberModel): void {
    profileOverride = member;
    pushLocation({
      destination: activeDestination,
      panel: { kind: "profile", memberId: member.id },
    });
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
  const pulsePublishOperationEntry = $derived.by(
    () =>
      Object.entries(community.state.operations)
        .filter(
          ([key, operation]) =>
            key.startsWith("pulse:publish:") && operation.status !== "idle",
        )
        .toReversed()[0],
  );
  const pulsePublishOperation = $derived(pulsePublishOperationEntry?.[1]);
  const pulseComposerStatus = $derived<ComposerStatus | undefined>(
    pulsePublishOperation?.status === "failed"
      ? {
          type: "error",
          message:
            pulsePublishOperation.message ??
            pulsePublishOperation.failure?.message ??
            "The note could not be published",
        }
      : pulsePublishOperation?.status === "accepted"
        ? {
            type: "warning",
            message:
              pulsePublishOperation.message ??
              "Accepted by relay, still syncing",
          }
        : undefined,
  );

  $effect(() => {
    if (community.state.status === "connecting") relayNoticeDismissed = false;
  });

  $effect(() => {
    const active = activeDestination === "pulse";
    untrack(() => community.actions.pulse?.setActive(active));
  });

  $effect(() => {
    const authenticationSettledWithoutIdentity =
      community.state.authentication.status === "anonymous" ||
      community.state.authentication.status === "error";
    if (
      authenticationSettledWithoutIdentity &&
      applicationAuthentication?.status?.() !== "restoring" &&
      !signedIn &&
      (activeDestination === "settings" || activeDestination === "inbox")
    ) {
      setDestination("registry", false);
    }
  });

  async function runAuthenticated(
    action: CommunityAuthenticatedAction,
  ): Promise<void> {
    await onAuthenticationRequired(action);
  }

  async function signOutCurrentIdentity(): Promise<void> {
    if (applicationAuthentication?.signOut) {
      await applicationAuthentication.signOut();
      return;
    }
    await community.actions.disconnectIdentity();
  }

  const roomByWorkspaceId = (roomId: string) =>
    findWorkspaceRoom(allRooms, activeRoom, roomId);

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
    saveCommunityApplicationLocation(browserStorage, applicationLocation);
  });

  $effect(() => {
    if (initialLocationApplied || !hasCommunitySurface) return;

    const destination = activeDestination;
    const registryDestination =
      registryRouteFromDestination(destination) !== null;
    const applicationDestination =
      destination === "inbox" ||
      destination === "pulse" ||
      destination === "agents" ||
      destination === "settings" ||
      destination === "new-direct-message" ||
      (hasProjects && isProjectDestination(destination)) ||
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
    if (
      !isPluginReleaseRoom ||
      activeChannelProject ||
      releaseOverviewInitialized
    )
      return;
    releaseOverviewInitialized = true;
    if (activeMainSurface !== undefined) return;
    if (initialShellLayout.releaseOverview === undefined) {
      releaseOverviewSidebar.expand();
    }
  });

  $effect(() => {
    if (!isProjectsDestination || projectOverviewInitialized) return;
    projectOverviewInitialized = true;
    if (selectedProjectSurface !== undefined) return;
    if (initialShellLayout.projectOverview === undefined) {
      projectOverviewSidebar.expand();
    }
  });

  $effect(() => {
    const coordinate = activeChannelProject?.address.coordinate;
    if (!coordinate || initializedChannelProjectOverviews.has(coordinate))
      return;
    initializedChannelProjectOverviews.add(coordinate);
    if (initialShellLayout.projectOverview === undefined) {
      projectOverviewSidebar.expand();
    }
  });

  $effect(() => {
    if (!selectedRepository || !selectedRepositoryProject) return;
    if (applicationLocation.projectRoute?.kind === "repository") return;
    if (
      selectedProjectCoordinate === selectedRepositoryProject.address.coordinate
    )
      return;
    selectedRepositoryCoordinate = "";
    activeRepositorySurface = "overview";
    selectedProjectCommit = undefined;
    projectCommitDetail = undefined;
    selectedProjectPath = "";
    projectBlob = undefined;
  });

  $effect(() => {
    const route = applicationLocation.projectRoute;
    if (route?.kind !== "repository" || !selectedRepositoryProject) return;
    const destination = projectDestinationFromCoordinate(
      selectedRepositoryProject.address.coordinate,
    );
    if (activeDestination === destination) return;
    replaceLocation({ ...applicationLocation, destination });
  });

  $effect(() => {
    const route = selectedProjectFilesRoute;
    if (!route) {
      if (selectedProjectSurface !== "files") {
        projectFilesRepositoryCoordinate = "";
      }
      return;
    }
    const repository = selectedProjectFilesRepository;
    if (!repository) return;
    projectFilesRepositoryCoordinate = repository.address.coordinate;
    if (route.repositoryCoordinate === repository.address.coordinate) return;
    replaceLocation({
      ...applicationLocation,
      projectRoute: {
        ...route,
        repositoryCoordinate: repository.address.coordinate,
      },
    });
  });

  $effect(() => {
    const reloadRevision = projectReloadRevision;
    const source = projectDataSource;
    const catalogStoreOption = projectCatalogStore;
    const configuredRelayUrl = projectConfiguredRelayUrl;
    const httpBaseUrl = projectHttpBaseUrl;
    const configuredIdentity = projectIdentity;
    const channelId = projectChannelId;
    const usesActiveCommunityRelay = configuredRelayUrl === undefined;
    const relayUrl = configuredRelayUrl ?? activeConnectionRelayUrl;
    const communityId = activeConnectionCommunityId ?? channelId ?? "projects";
    const identity =
      configuredIdentity ?? applicationAuthentication?.identity();
    const communityStatus = community.state.status;
    const authenticationStatus = community.state.authentication.status;
    const queryClient = communityQueryClient;
    const queryScope = communityQueryScope;
    const queryScopeKey = communityQueryScopeKey;
    const lifecycleKey = [
      reloadRevision,
      queryScopeKey,
      source,
      catalogStoreOption,
      configuredRelayUrl,
      httpBaseUrl,
      configuredIdentity,
      channelId,
      relayUrl,
      communityId,
      identity,
      communityStatus,
      authenticationStatus,
    ] as const;
    if (
      activeProjectSessionLifecycle &&
      projectSessionKeysMatch(activeProjectSessionLifecycle.key, lifecycleKey)
    )
      return;

    const previousLifecycle = activeProjectSessionLifecycle;
    activeProjectSessionLifecycle = undefined;
    previousLifecycle?.dispose();
    if (
      !source ||
      !relayUrl ||
      (usesActiveCommunityRelay && communityStatus !== "connected") ||
      (configuredIdentity === undefined &&
        authenticationStatus === "connecting")
    )
      return;

    const catalogScope = {
      relayUrl,
      communityId,
      ...(channelId === undefined ? {} : { channelId }),
    } satisfies ProjectForgeCatalogCacheScope;
    const catalogScopeKey = projectForgeCatalogCacheKey(catalogScope);
    if (catalogScopeKey !== untrack(() => projectCatalogScopeKey)) {
      projectCatalogScopeKey = catalogScopeKey;
      projectCatalog = { projects: [], repositories: [], events: [] };
      projectWorkItems = { tasks: [], pullRequests: [], events: [] };
      projectCatalogVerifiedAt = undefined;
      cachedProjectCatalogAt = undefined;
    }

    const controller = new AbortController();
    let openedSession: ProjectForgeSession | undefined;
    let unsubscribeCatalog: (() => void) | undefined;
    let projectLoadStage = "Project catalog cache";
    let disposed = false;
    const lifecycle: ProjectSessionLifecycle = {
      key: lifecycleKey,
      dispose: () => {
        if (disposed) return;
        disposed = true;
        // Close owned observers before the transport so deliberate teardown is silent.
        if (untrack(() => projectSession) === openedSession) {
          untrack(() => projectWorkItemResources)?.dispose();
        }
        controller.abort();
        unsubscribeCatalog?.();
        openedSession?.close();
        if (untrack(() => projectSession) === openedSession) {
          projectSession = undefined;
        }
      },
    };
    activeProjectSessionLifecycle = lifecycle;
    projectLoading = true;
    projectCatalogSettled = false;
    projectError = "";
    projectSourceError = "";
    projectRepositoryCapabilities = {};
    projectSourceRepositoryCoordinate = "";
    projectRepositoryRevision = "";
    projectBlob = undefined;
    projectPullRequestDiffError = "";

    void (async () => {
      const catalogStore = catalogStoreOption ?? defaultProjectCatalogStore;
      if (untrack(() => projectCatalog.events.length) === 0) {
        projectLoadStage = "Project catalog cache";
        const cached = await catalogStore.load(catalogScope);
        if (controller.signal.aborted) return;
        if (cached !== undefined) {
          projectCatalog = cached.catalog;
          queryClient.setQueryData(
            communityProjectQueryKeys.catalog(queryScope),
            cached.catalog,
          );
          projectCatalogVerifiedAt = cached.cachedAt;
          cachedProjectCatalogAt = cached.cachedAt;
        }
      }
      projectLoadStage = "Project relay connection";
      const candidateSession = await source.open(
        {
          relayUrl,
          ...(httpBaseUrl === undefined ? {} : { httpBaseUrl }),
          ...(identity === undefined ? {} : { identity }),
        },
        controller.signal,
      );
      if (controller.signal.aborted) {
        candidateSession.close();
        return;
      }
      openedSession = candidateSession;
      projectSession = openedSession;
      projectLoadStage = "Project catalog";
      const catalog = await openedSession.loadCatalog(
        channelId,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      projectCatalog = catalog;
      queryClient.setQueryData(
        communityProjectQueryKeys.catalog(queryScope),
        catalog,
      );
      projectCatalogVerifiedAt = Date.now();
      cachedProjectCatalogAt = undefined;
      projectCatalogSettled = true;
      projectLoadStage = "Project catalog cache";
      await catalogStore.save(catalogScope, catalog);

      let catalogReady = false;
      projectLoadStage = "Live project catalog updates";
      unsubscribeCatalog = await openedSession.subscribe(
        [
          {
            kinds: [5, 30_617, 30_621],
            ...(channelId ? { "#buzz-channel": [channelId] } : {}),
          } as import("../../nostr/index.js").RelayFilter,
        ],
        (event) => {
          if (event.type === "eose") catalogReady = true;
          if (catalogReady && event.type === "event") {
            projectReloadRevision += 1;
            void invalidateCommunityProjectQueries(queryClient, queryScope);
          }
        },
        controller.signal,
      );
    })()
      .catch((cause) => {
        if (
          controller.signal.aborted ||
          activeProjectSessionLifecycle !== lifecycle
        )
          return;
        if (
          projectCatalog.events.length > 0 &&
          projectCatalogVerifiedAt !== undefined
        ) {
          cachedProjectCatalogAt = projectCatalogVerifiedAt;
        }
        projectError =
          cause instanceof Error
            ? cause.message
            : `${projectLoadStage} could not be loaded`;
      })
      .finally(() => {
        if (
          !controller.signal.aborted &&
          activeProjectSessionLifecycle === lifecycle &&
          !untrack(() => projectCatalogSettled)
        ) {
          projectLoading = false;
        }
      });
  });

  const filesLoadKey = $derived(
    repositoryFilesLoadKey(
      applicationLocation.projectRoute,
      projectRepositoryRevision,
      projectTree?.commit?.sha,
    ),
  );

  const projectRepositoryViewInput = $derived.by<
    ProjectRepositoryViewInput | undefined
  >(() => {
    const session = projectSession;
    const catalog = projectCatalog;
    if (!session || !projectCatalogSettled) return undefined;
    const channelProjectCoordinate = isProjectsDestination
      ? undefined
      : activeChannelProjectCoordinate;
    const destinationActive =
      isProjectsDestination || channelProjectCoordinate !== undefined;
    if (!destinationActive) return undefined;
    const activeProjectFilesRepositoryCoordinate =
      selectedProjectSurface === "files"
        ? (selectedProjectFilesRepository?.address.coordinate ?? "")
        : "";
    const identity = projectIdentity ?? applicationAuthentication?.identity();
    const surface = selectedRepositoryCoordinate
      ? activeRepositorySurface
      : selectedProjectSurface;
    const overviewSurface = projectsOverviewSurface;
    const routeRevision =
      applicationLocation.projectRoute?.surface === "files"
        ? applicationLocation.projectRoute.revision
        : undefined;
    const input: ProjectRepositoryViewInput = {
      catalog,
      session,
      identityAvailable: identity !== undefined,
      overviewSurface,
      pullRequestId: selectedPullRequestId,
      requestedRepositoryBranch: projectSelectedRepositoryBranch,
      requestedRepositoryBranchOwner: projectSelectedRepositoryBranchOwner,
      inlineProjectFilesSheetOpen: projectSheetProject !== undefined,
      ...((selectedProjectCoordinate ?? channelProjectCoordinate)
        ? {
            projectCoordinate:
              selectedProjectCoordinate ?? channelProjectCoordinate,
          }
        : {}),
      ...(selectedRepositoryCoordinate || activeProjectFilesRepositoryCoordinate
        ? {
            repositoryCoordinate:
              selectedRepositoryCoordinate ||
              activeProjectFilesRepositoryCoordinate,
          }
        : {}),
      ...(surface === undefined ? {} : { surface }),
      ...(selectedRepositoryCoordinate
        ? { pullRequestSurface: activeRepositorySurface }
        : { pullRequestSurface: selectedProjectSurface ?? overviewSurface }),
      ...(selectedProjectCommit?.sha
        ? { selectedCommitSha: selectedProjectCommit.sha }
        : {}),
      ...(routeRevision ? { filesRouteRevision: routeRevision } : {}),
      ...(selectedProjectPath ? { selectedPath: selectedProjectPath } : {}),
    };
    filesLoadKey;
    return input;
  });

  const projectRepositoryViewQuery = createQuery<
    ProjectRepositoryViewResult,
    Error
  >(
    () => {
      const input = projectRepositoryViewInput;
      const queryKey = input
        ? communityProjectQueryKeys.repositoryView(
            communityQueryScope,
            projectRepositoryViewQueryTarget(input),
          )
        : [
            ...communityProjectQueryKeys.projects(communityQueryScope),
            "view",
            "idle",
          ];
      return {
        queryKey,
        enabled: input !== undefined,
        staleTime: PROJECT_REPOSITORY_READ_STALE_TIME_MS,
        gcTime: PROJECT_REPOSITORY_READ_GC_TIME_MS,
        placeholderData: keepPreviousData,
        queryFn: ({ signal }) => {
          if (!input) throw new Error("Project view is not ready");
          return loadProjectRepositoryView(input, signal, {
            queryClient: communityQueryClient,
            scope: communityQueryScope,
          });
        },
      };
    },
    () => communityQueryClient,
  );

  $effect(() => {
    const input = projectRepositoryViewInput;
    const resources = projectWorkItemResources;
    if (!input || !resources) {
      projectWorkItemsLoading = false;
      return;
    }

    const repositories = projectRepositoriesForView({
      catalog: input.catalog,
      projectCoordinate: input.projectCoordinate,
      repositoryCoordinate: input.repositoryCoordinate,
    });
    const controller = new AbortController();
    let unsubscribeWorkItems: (() => void) | undefined;
    projectWorkItemsLoading = true;
    projectLoading = true;
    projectError = "";

    const updateWorkItems = (error?: unknown) => {
      if (controller.signal.aborted) return;
      if (error) {
        projectError = projectQueryErrorMessage(
          error,
          "Project updates failed",
        );
        return;
      }
      const bundles = repositories.map((repository) =>
        resources.peek(repository.event),
      );
      if (bundles.some((bundle) => bundle === undefined)) return;
      projectWorkItems = {
        tasks: bundles.flatMap((bundle) => bundle!.tasks),
        pullRequests: bundles.flatMap((bundle) => bundle!.pullRequests),
        events: bundles.flatMap((bundle) => bundle!.events),
      };
    };

    unsubscribeWorkItems = resources.subscribe(
      repositories.map((repository) => repository.event.id),
      updateWorkItems,
    );
    updateWorkItems();
    void Promise.all(
      repositories.map((repository) =>
        resources.load(repository.event, controller.signal),
      ),
    )
      .then(() => updateWorkItems())
      .catch((cause) => {
        if (controller.signal.aborted) return;
        projectError = projectQueryErrorMessage(
          cause,
          "Project work items could not be loaded",
        );
      })
      .finally(() => {
        if (controller.signal.aborted) return;
        projectWorkItemsLoading = false;
        if (!projectRepositoryViewQuery.isFetching) projectLoading = false;
      });

    return () => {
      controller.abort();
      unsubscribeWorkItems?.();
    };
  });

  $effect(() => {
    const input = projectRepositoryViewInput;
    const result = projectRepositoryViewQuery.data;
    const pendingWithoutData =
      projectRepositoryViewQuery.isFetching && result === undefined;
    if (pendingWithoutData) projectLoading = true;
    if (!input) return;
    if (projectRepositoryViewQuery.isError) {
      if (
        projectCatalog.events.length > 0 &&
        projectCatalogVerifiedAt !== undefined
      ) {
        cachedProjectCatalogAt = projectCatalogVerifiedAt;
      }
      projectError = projectQueryErrorMessage(
        projectRepositoryViewQuery.error,
        "Project repository view could not be loaded",
      );
      if (!result) {
        projectLoading = projectWorkItemsLoading;
        return;
      }
    }
    if (!result) return;

    projectRepositoryCapabilities = result.capabilities;
    projectCommitActivity = result.commitActivity;
    projectCommits = result.commits;
    projectCommitsMore = result.commitsMore;
    projectCommitBranch = result.commitBranch;
    projectRepositoryBranches = result.branches;
    projectCommitDetail = result.selectedCommitDetail;
    projectSourceRepositoryCoordinate = result.sourceRepositoryCoordinate;
    projectRepositoryRevision = result.revision;
    projectTree = result.tree;
    projectOwners = result.owners;
    projectSourceError = result.sourceError;
    projectPullRequestDiff = result.pullRequestDiff;
    projectPullRequestDiffError = result.pullRequestDiffError;

    if (
      !projectRepositoryViewQuery.isPlaceholderData &&
      result.sourceRepositoryCoordinate &&
      result.commitBranch
    ) {
      if (
        projectSelectedRepositoryBranchOwner !==
          result.sourceRepositoryCoordinate ||
        projectSelectedRepositoryBranch !== result.commitBranch
      ) {
        projectSelectedRepositoryBranchOwner =
          result.sourceRepositoryCoordinate;
        projectSelectedRepositoryBranch = result.commitBranch;
      }
      if (
        input.surface === "files" &&
        !input.filesRouteRevision &&
        result.commitBranch
      ) {
        const route = applicationLocation.projectRoute;
        const nextLocation =
          route?.kind === "project" && route.surface === "files"
            ? {
                ...applicationLocation,
                projectRoute: {
                  ...route,
                  repositoryCoordinate: result.sourceRepositoryCoordinate,
                  revision: result.commitBranch,
                },
              }
            : route?.kind === "repository" && route.surface === "files"
              ? repositorySurfaceLocation(
                  result.sourceRepositoryCoordinate,
                  "files",
                  activePanel,
                  selectedRepositoryProject?.address.coordinate,
                  result.commitBranch,
                )
              : undefined;
        if (nextLocation) replaceLocation(nextLocation);
      }
    }

    projectLoading =
      projectWorkItemsLoading ||
      (projectRepositoryViewQuery.isFetching && result === undefined);
  });

  const projectBlobQuery = createQuery<ProjectForgeBlobResponse, Error>(
    () => {
      const session = projectSession;
      const repository = projectSourceRepositoryCoordinate;
      const revision = projectRepositoryRevision;
      const path = selectedProjectPath;
      const surface = selectedRepositoryCoordinate
        ? activeRepositorySurface
        : selectedProjectSurface;
      const enabled =
        surface === "files" &&
        session !== undefined &&
        Boolean(repository) &&
        Boolean(revision) &&
        Boolean(path);
      return {
        queryKey:
          enabled && session
            ? communityProjectQueryKeys.repositoryBlob(communityQueryScope, {
                repository,
                revision,
                path,
              })
            : [
                ...communityProjectQueryKeys.projects(communityQueryScope),
                "blob",
                "idle",
              ],
        enabled,
        staleTime: PROJECT_REPOSITORY_READ_STALE_TIME_MS,
        gcTime: PROJECT_REPOSITORY_READ_GC_TIME_MS,
        placeholderData: keepPreviousData,
        queryFn: ({ signal }) => {
          if (!session || !repository || !revision || !path)
            throw new Error("Project file is not ready");
          return session.loadBlob(repository, revision, path, signal);
        },
      };
    },
    () => communityQueryClient,
  );

  $effect(() => {
    const surface = selectedRepositoryCoordinate
      ? activeRepositorySurface
      : selectedProjectSurface;
    if (surface !== "files" || !selectedProjectPath) {
      projectBlob = undefined;
      return;
    }
    if (projectBlobQuery.data) {
      projectBlob = projectBlobQuery.data;
    }
    if (projectBlobQuery.isError) {
      projectSourceError = projectQueryErrorMessage(
        projectBlobQuery.error,
        "The selected file could not be loaded",
      );
    }
  });

  $effect(() => {
    if (!isPluginReleaseRoom || registryOptions?.source.subscribe === undefined)
      return;
    return registryOptions.source.subscribe((event) => {
      if (event.type === "revision") releaseReviewRevision = {};
    });
  });

  $effect(() => {
    const source = registryOptions?.source;
    if (
      !isPluginReleaseRoom ||
      source?.loadReleaseReviewEntries === undefined
    ) {
      releaseReviewEntries = [];
      releaseReviewsLoading = false;
      releaseReviewsError = "";
      return;
    }
    releaseReviewRevision;
    const controller = new AbortController();
    let active = true;
    releaseReviewsLoading = true;
    releaseReviewsError = "";
    void source
      .loadReleaseReviewEntries({ signal: controller.signal })
      .then((entries) => {
        if (active) releaseReviewEntries = entries;
      })
      .catch((cause: unknown) => {
        if (
          active &&
          (!(cause instanceof DOMException) || cause.name !== "AbortError")
        ) {
          releaseReviewsError =
            cause instanceof Error
              ? cause.message
              : "Plugin release reviews are unavailable.";
        }
      })
      .finally(() => {
        if (active) releaseReviewsLoading = false;
      });
    return () => {
      active = false;
      controller.abort();
    };
  });

  $effect(() => {
    if (
      (activePanel.kind === "profile" ||
        activePanel.kind === "agent-activity") &&
      (community.state.agents?.status === "loading" || communityStartupPending)
    )
      return;
    const projectionSettled =
      activePanel.kind === "none" ||
      ((activePanel.kind === "profile" ||
        activePanel.kind === "agent-activity") &&
        workspace.sidePanel === "none") ||
      (activePanel.kind === "details" &&
        (activePanel.roomId === inbox.room.id ||
          workspace.sidePanel === "details")) ||
      communityApplicationThreadProjectionSettled(activePanel, workspace);
    if (!projectionSettled) return;

    const normalized = normalizeCommunityApplicationLocation(
      applicationLocation,
      {
        roomIds: [inbox.room.id, ...allRooms.map((room) => room.id)],
        releaseRoomIds: allRooms
          .filter((room) => room.groupId === pluginReleaseGroupId)
          .map((room) => room.id),
        projectDestinationIds: projectCatalog.projects.map((project) =>
          projectDestinationFromCoordinate(project.address.coordinate),
        ),
        projectChannelDestinationIds: [...projectChannelRoomIds],
        agentIds: knownAgentIds,
        memberIds: [
          ...knownAgentIds,
          ...workspace.members.map((member) => member.id),
          ...(profileOverride === undefined ? [] : [profileOverride.id]),
        ],
        ...(activePanel.kind === "thread"
          ? {
              messageIds:
                workspace.thread?.messages.map((message) => message.id) ?? [],
            }
          : {}),
      },
    );
    if (!communityApplicationLocationsEqual(normalized, applicationLocation)) {
      replaceLocation(normalized);
      lastAction =
        normalized.mainSurface === activeMainSurface
          ? "unavailable-side-panel"
          : "unavailable-main-surface";
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

  function revealNavigationDestination(destination: string): void {
    pendingNavigationReveal =
      ["inbox", "pulse", "agents", "settings", "new-direct-message"].includes(
        destination,
      ) || registryRouteFromDestination(destination) !== null
        ? undefined
        : destination;
  }

  function applyLocation(
    next: CommunityApplicationLocation,
    previous: CommunityApplicationLocation,
  ): void {
    if (next.destination !== previous.destination) {
      revealNavigationDestination(next.destination);
    }
    const nextRegistryRoute = registryRouteFromDestination(next.destination);
    if (nextRegistryRoute !== null) registryRoute = nextRegistryRoute;

    if (next.projectRoute?.kind === "repository") {
      selectedRepositoryCoordinate = next.projectRoute.coordinate;
      activeRepositorySurface = next.projectRoute.surface;
      selectedProjectCommit = projectRouteCommit(next.projectRoute);
      if (next.projectRoute.surface === "files" && next.projectRoute.revision) {
        projectSelectedRepositoryBranchOwner = next.projectRoute.coordinate;
        projectSelectedRepositoryBranch = next.projectRoute.revision;
        selectedProjectPath = next.projectRoute.path ?? "";
      }
      if (
        next.projectRoute.surface === "reviews" &&
        next.projectRoute.commitSha
      )
        selectedPullRequestId = next.projectRoute.commitSha;
      if (next.projectRoute.surface === "tasks" && next.projectRoute.commitSha)
        selectedTaskId = next.projectRoute.commitSha;
    } else if (
      next.projectRoute?.kind === "project" &&
      next.projectRoute.surface === "files"
    ) {
      selectedRepositoryCoordinate = "";
      activeRepositorySurface = "overview";
      selectedProjectCommit = undefined;
      projectFilesRepositoryCoordinate =
        next.projectRoute.repositoryCoordinate ?? "";
      selectedProjectPath = next.projectRoute.path ?? "";
      if (
        next.projectRoute.revision &&
        next.projectRoute.repositoryCoordinate
      ) {
        projectSelectedRepositoryBranchOwner =
          next.projectRoute.repositoryCoordinate;
        projectSelectedRepositoryBranch = next.projectRoute.revision;
      }
    } else if (previous.projectRoute?.kind === "repository") {
      selectedRepositoryCoordinate = "";
      selectedRepositoryProjectCoordinate = "";
      activeRepositorySurface = "overview";
    }
    if (
      previous.projectRoute?.surface === "files" &&
      next.projectRoute?.surface !== "files"
    ) {
      selectedProjectPath = "";
      projectBlob = undefined;
      projectFilesRepositoryCoordinate = "";
    }

    // Inbox activates its selected conversation after its shell has painted.
    // Selecting the room here would start a duplicate projection/history load.
    const enteringInbox =
      next.destination === "inbox" && previous.destination !== "inbox";
    if (!enteringInbox) {
      const roomId =
        next.panel.kind === "thread"
          ? next.panel.roomId
          : next.destination === "inbox"
            ? inbox.room.id
            : nextRegistryRoute === null &&
                next.destination !== "pulse" &&
                next.destination !== "agents" &&
                next.destination !== "settings" &&
                next.destination !== "new-direct-message"
              ? next.destination
              : undefined;
      if (roomId !== undefined && workspace.activeRoomId !== roomId) {
        community.actions.selectRoom(roomId);
      }

      if (next.panel.kind === "thread") {
        community.actions.clearReplyTarget();
        const forum =
          allRooms.find((room) => room.id === roomId)?.kind === "forum";
        if (forum) community.actions.openTopic(next.panel.rootMessageId);
        else community.actions.openThread(next.panel.rootMessageId);
      } else if (
        next.panel.kind === "details" &&
        next.panel.roomId !== inbox.room.id
      ) {
        community.actions.clearReplyTarget();
        community.actions.openDetails();
      } else {
        community.actions.closeSidePanel();
      }
    }

    if (next.panel.kind === "none")
      void tick().then(() => keepLane || shell.mobile.showMain());
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
      onDestinationChange?.(next.destination);
    }
  }

  function pushLocation(next: CommunityApplicationLocation): void {
    const previous = currentCommunityApplicationLocation(navigationHistory);
    const updated = pushCommunityApplicationLocation(navigationHistory, next);
    if (updated === navigationHistory) return;
    navigationHistory = updated;
    applyLocation(next, previous);
    pushBrowserLocation(next);
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
    replaceBrowserLocation(next);
  }

  function browserHashContext() {
    return {
      roomKind: (destination: string) =>
        applicationRoomKind(destination, allRooms),
    };
  }

  function pushBrowserLocation(location: CommunityApplicationLocation): void {
    syncBrowserApplicationLocation(location, "push", browserHashContext());
  }

  function replaceBrowserLocation(
    location: CommunityApplicationLocation,
  ): void {
    syncBrowserApplicationLocation(location, "replace", browserHashContext());
  }

  onMount(() => {
    replaceBrowserLocation(applicationLocation);
    const applyBrowserLocation = () => {
      const next = locationFromHash(window.location.hash, {
        hasProjects,
        hasRegistry,
        legacyRegistryRoute: registryRoute,
      });
      if (
        !next ||
        communityApplicationLocationsEqual(next, applicationLocation)
      )
        return;
      if (registryRouteFromDestination(next.destination))
        setDestination(next.destination, false);
      else replaceLocation(next);
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
    revealNavigationDestination(destinationId);
    projectDialogRequest = undefined;
    selectedRepositoryCoordinate = "";
    activeRepositorySurface = "overview";
    if (destinationId === "projects") {
      selectedTaskId = "";
      selectedPullRequestId = "";
    }
    const next =
      locationForProjectDestination(destinationId) ??
      ({
        destination: destinationId,
        panel: noCommunityApplicationPanel(),
      } satisfies CommunityApplicationLocation);
    if (recordHistory) pushLocation(next);
    else replaceLocation(next);
    lastAction = `selected:${destinationId}`;
  }

  function openPanel(panel: CommunityApplicationPanel): void {
    pushLocation({
      destination: activeDestination,
      panel,
      ...(activeMainSurface === undefined
        ? {}
        : { mainSurface: activeMainSurface }),
      ...(applicationLocation.projectRoute === undefined
        ? {}
        : { projectRoute: applicationLocation.projectRoute }),
    });
  }

  function openPanelForDestination(
    destination: CommunityApplicationDestination,
    panel: CommunityApplicationPanel,
  ): void {
    pushLocation({ destination, panel });
  }

  function openReleaseSurface(surface: CommunityApplicationMainSurface): void {
    if (!isPluginReleaseRoom) return;
    releaseOverviewInitialized = true;
    pushLocation({
      destination: activeDestination,
      panel: activePanel,
      mainSurface: surface,
    });
    lastAction = `opened-${surface}`;
  }

  function closeReleaseSurface(): void {
    if (activeMainSurface === undefined) return;
    pushLocation({ destination: activeDestination, panel: activePanel });
    lastAction = "closed-release-surface";
  }

  function selectProject(
    project: ProjectForgeCatalog["projects"][number],
  ): void {
    projectOverviewInitialized = false;
    selectedRepositoryCoordinate = "";
    selectedRepositoryProjectCoordinate = "";
    activeRepositorySurface = "overview";
    selectedPullRequestId = "";
    selectedTaskId = "";
    selectedProjectCommit = undefined;
    projectCommitDetail = undefined;
    projectSourceError = "";
    selectedProjectPath = "";
    pushLocation({
      ...locationForProjectRoute({
        kind: "project",
        coordinate: project.address.coordinate,
        surface: "activity",
      }),
    });
    lastAction = `selected-project:${project.address.coordinate}`;
  }

  function selectRepository(repository: ProjectForgeRepository): void {
    const project =
      selectedProject ??
      selectedRepositoryProject ??
      preferredProjectForRepository(
        projectCatalog.projects,
        repository.address.coordinate,
      );
    selectedRepositoryCoordinate = repository.address.coordinate;
    selectedRepositoryProjectCoordinate = project?.address.coordinate ?? "";
    activeRepositorySurface = "overview";
    selectedPullRequestId = "";
    selectedTaskId = "";
    selectedProjectCommit = undefined;
    projectCommitDetail = undefined;
    projectSourceError = "";
    selectedProjectPath = "";
    projectBlob = undefined;
    projectOverviewInitialized = true;
    pushLocation({
      destination:
        project === undefined
          ? "projects"
          : projectDestinationFromCoordinate(project.address.coordinate),
      panel: noCommunityApplicationPanel(),
      projectRoute: {
        kind: "repository",
        coordinate: repository.address.coordinate,
        surface: "overview",
      },
    });
    lastAction = `selected-repository:${repository.address.coordinate}`;
  }

  function selectProjectFilesRepository(
    repository: ProjectForgeRepository,
  ): void {
    projectFilesRepositoryCoordinate = repository.address.coordinate;
    selectedProjectPath = "";
    projectBlob = undefined;
    projectTree = undefined;
    projectOwners = undefined;
    projectRepositoryBranches = [];
    projectRepositoryRevision = "";
    projectSourceError = "";
    const route = selectedProjectFilesRoute;
    if (route) {
      pushLocation({
        ...applicationLocation,
        projectRoute: {
          kind: "project",
          coordinate: route.coordinate,
          surface: "files",
          repositoryCoordinate: repository.address.coordinate,
        },
      });
      lastAction = `selected-project-files-repository:${repository.address.coordinate}`;
    }
  }

  function closeRepository(): void {
    const project = selectedRepositoryProject;
    selectedRepositoryCoordinate = "";
    activeRepositorySurface = "overview";
    selectedPullRequestId = "";
    selectedTaskId = "";
    selectedProjectCommit = undefined;
    projectCommitDetail = undefined;
    projectSourceError = "";
    selectedProjectPath = "";
    projectBlob = undefined;
    pushLocation(
      project === undefined
        ? { destination: "projects", panel: noCommunityApplicationPanel() }
        : locationForProjectRoute({
            kind: "project",
            coordinate: project.address.coordinate,
            surface: "activity",
          }),
    );
    lastAction = "closed-repository";
  }

  function activateRepositorySurface(surface: ProjectForgeSurface): void {
    if (!selectedRepository) return;
    if (surface !== "tasks") selectedTaskId = "";
    if (surface !== "reviews") {
      selectedPullRequestId = "";
      projectPullRequestDiff = undefined;
    }
    if (surface !== "commits") {
      selectedProjectCommit = undefined;
      projectCommitDetail = undefined;
    }
    if (surface !== "files") {
      selectedProjectPath = "";
      projectBlob = undefined;
    }
    projectSourceError = "";
    activeRepositorySurface = surface;
    projectOverviewInitialized = true;
    pushLocation(
      repositorySurfaceLocation(
        selectedRepository.address.coordinate,
        surface,
        activePanel,
        selectedRepositoryProject?.address.coordinate,
        surface === "files"
          ? projectSelectedRepositoryBranch
          : selectedProjectCommit?.sha,
      ),
    );
    lastAction = `opened-repository-${surface}`;
  }

  function selectRepositoryBranch(branch: string | undefined): void {
    if (!branch || branch === projectSelectedRepositoryBranch) return;
    const keepTree = projectRepositoryBranches.some(
      (item) =>
        item.name === branch && item.sha === projectSelectedRepositoryBranch,
    );
    projectSelectedRepositoryBranchOwner = projectSourceRepositoryCoordinate;
    projectSelectedRepositoryBranch = branch;
    selectedProjectPath = "";
    projectBlob = undefined;
    if (!keepTree) {
      projectTree = undefined;
      projectOwners = undefined;
    }
    const route = applicationLocation.projectRoute;
    if (route?.kind === "repository" && route.surface === "files")
      pushLocation(
        repositorySurfaceLocation(
          route.coordinate,
          "files",
          activePanel,
          selectedRepositoryProject?.address.coordinate,
          branch,
        ),
      );
    if (route?.kind === "project" && route.surface === "files") {
      const { path: _previousPath, ...baseRoute } = route;
      const repositoryCoordinate =
        route.repositoryCoordinate ||
        selectedProjectFilesRepository?.address.coordinate;
      if (!repositoryCoordinate) return;
      pushLocation({
        ...applicationLocation,
        projectRoute: {
          ...baseRoute,
          repositoryCoordinate,
          revision: branch,
        },
      });
    }
  }

  function selectRepositoryPath(path: string): void {
    selectedProjectPath = path;
    projectBlob = undefined;
    const current =
      applicationLocation.projectRoute?.surface === "files"
        ? applicationLocation.projectRoute.revision
        : undefined;
    const revision = path
      ? repositoryFilePermalink(
          current,
          projectRepositoryBranches,
          projectTree?.commit?.sha,
        )
      : projectRepositoryBranches.find((item) => item.sha === current)?.name;
    const next = repositoryFilesPathLocation(
      applicationLocation,
      path,
      revision,
    );
    if (next) pushLocation(next);
  }

  function openRepositorySurface(surface: ProjectForgeSurface): void {
    if (
      (surface === "files" || surface === "commits") &&
      !hasProjectSourceIdentity()
    ) {
      requestProjectSourceAccess(() => activateRepositorySurface(surface));
      return;
    }
    activateRepositorySurface(surface);
  }

  function activateProjectSurface(surface: ProjectForgeSurface): void {
    if (!selectedProject) return;
    if (surface !== "tasks") selectedTaskId = "";
    if (surface !== "commits") {
      selectedProjectCommit = undefined;
      projectCommitDetail = undefined;
      projectSourceError = "";
    }
    if (surface !== "files") {
      selectedProjectPath = "";
      projectBlob = undefined;
      projectFilesRepositoryCoordinate = "";
    }
    projectOverviewInitialized = true;
    pushLocation({
      ...locationForProjectRoute({
        kind: "project",
        coordinate: selectedProject.address.coordinate,
        surface,
      }),
      destination: activeDestination,
      panel: activePanel,
    });
    lastAction = `opened-project-${surface}`;
  }

  function hasProjectSourceIdentity(): boolean {
    return Boolean(
      projectsOptions?.identity ?? applicationAuthentication?.identity(),
    );
  }

  function requestProjectSourceAccess(action: () => void): void {
    if (hasProjectSourceIdentity()) {
      action();
      return;
    }
    void runAuthenticated(action).catch((cause) => {
      projectError =
        cause instanceof Error
          ? cause.message
          : "Connect a Nostr identity to view hosted source";
    });
  }

  function openProjectSurface(surface: ProjectForgeSurface): void {
    if (
      (surface === "files" || surface === "commits") &&
      !hasProjectSourceIdentity()
    ) {
      requestProjectSourceAccess(() => activateProjectSurface(surface));
      return;
    }
    activateProjectSurface(surface);
  }

  function activateProjectCommit(commit: ProjectForgeCommit): void {
    const reviewRoute =
      selectedRepository === undefined && selectedProject === undefined
        ? reviewCommitLocation(
            projectCatalog,
            selectedPullRequest?.repository.coordinate,
            commit.sha,
          )
        : undefined;
    if (
      selectedRepository === undefined &&
      selectedProject === undefined &&
      reviewRoute === undefined
    )
      return;
    selectedProjectCommit = commit;
    const commitSource = projectCommitActivity.find(
      (entry) => entry.commit.sha === commit.sha,
    );
    if (commitSource)
      projectSourceRepositoryCoordinate = commitSource.repositoryCoordinate;
    projectCommitDetail = undefined;
    projectSourceError = "";
    selectedPullRequestId = "";
    projectPullRequestDiff = undefined;
    if (selectedRepository) {
      activateRepositorySurface("commits");
    } else if (selectedProject) {
      activateProjectSurface("commits");
    } else if (reviewRoute) {
      selectedRepositoryCoordinate = reviewRoute.coordinate;
      activeRepositorySurface = "commits";
      projectOverviewInitialized = true;
      pushLocation(reviewRoute.location);
      lastAction = `selected-review-commit:${commit.sha}`;
    }
  }

  function selectProjectCommit(commit: ProjectForgeCommit): void {
    requestProjectSourceAccess(() => activateProjectCommit(commit));
  }

  function replaceVisibleProjectRouteCursor(
    encodedCursor: string | undefined,
  ): void {
    const cursor = decodeProjectListCursor(encodedCursor);
    const route = applicationLocation.projectRoute;
    if (!route || !cursor) return;
    clearTimeout(projectRouteCursorTimer);
    projectRouteCursorTimer = setTimeout(() => {
      const current = applicationLocation.projectRoute;
      if (!current) return;
      if (
        encodeProjectListCursor(current.cursor) ===
        encodeProjectListCursor(cursor)
      )
        return;
      replaceLocation({
        ...applicationLocation,
        projectRoute: projectRouteWithCursor(current, cursor),
      });
    }, 250);
  }

  function projectRouteWithCursor(
    route: CommunityApplicationProjectRoute,
    cursor: ProjectListCursor,
  ): CommunityApplicationProjectRoute {
    return { ...route, cursor } as CommunityApplicationProjectRoute;
  }

  async function loadMoreProjectCommits(): Promise<void> {
    const session = projectSession;
    const repository = projectSourceRepositoryCoordinate;
    const from = projectCommits.at(-1)?.sha;
    if (
      !session ||
      !repository ||
      !from ||
      !projectCommitsMore ||
      projectCommitsLoadingMore
    )
      return;
    projectCommitsLoadingMore = true;
    try {
      const result = await loadRepositoryCommitsFromQuery({
        queryClient: communityQueryClient,
        scope: communityQueryScope,
        session,
        repository,
        revision: projectCommitBranch || undefined,
        options: { limit: 50, from },
      });
      const seen = new Set(projectCommits.map((commit) => commit.sha));
      projectCommits = [
        ...projectCommits,
        ...result.commits.filter((commit) => !seen.has(commit.sha)),
      ];
      projectCommitsMore = result.more;
    } catch (cause) {
      projectError = projectQueryErrorMessage(
        cause,
        "Older commit history could not be loaded",
      );
    } finally {
      projectCommitsLoadingMore = false;
    }
  }

  function closeProjectCommit(): void {
    selectedProjectCommit = undefined;
    projectCommitDetail = undefined;
    projectSourceError = "";
    lastAction = "closed-project-commit";
  }

  function closeProjectPullRequest(): void {
    selectedPullRequestId = "";
    projectPullRequestDiff = undefined;
    lastAction = "closed-project-review";
  }

  function selectProjectSheetTask(task: ProjectTaskState): void {
    selectedTaskId = task.root.id;
    selectedPullRequestId = "";
    selectedProjectCommit = undefined;
    projectCommitDetail = undefined;
    lastAction = `selected-channel-project-task:${task.root.id}`;
  }

  function selectProjectTask(task: ProjectTaskState): void {
    if (selectedRepository?.address.coordinate === task.repository.coordinate) {
      selectedTaskId = task.root.id;
      activateRepositorySurface("tasks");
      lastAction = `selected-repository-task:${task.root.id}`;
      return;
    }
    const project = projectCatalog.projects.find((candidate) =>
      candidate.repositories.some(
        (reference) => reference.coordinate === task.repository.coordinate,
      ),
    );
    if (!project) return;
    selectedTaskId = task.root.id;
    projectOverviewInitialized = true;
    pushLocation({
      destination: projectDestinationFromCoordinate(project.address.coordinate),
      panel: noCommunityApplicationPanel(),
      mainSurface: "project-tasks",
      projectRoute: {
        kind: "project",
        coordinate: project.address.coordinate,
        surface: "tasks",
      },
    });
    lastAction = `selected-project-task:${task.root.id}`;
  }

  function openProjectsOverviewSurface(
    surface: ProjectForgeOverviewSurface,
  ): void {
    if (!isProjectDirectory) return;
    selectedRepositoryCoordinate = "";
    activeRepositorySurface = "overview";
    selectedTaskId = "";
    selectedPullRequestId = "";
    pushLocation({
      destination: "projects",
      panel: activePanel,
      mainSurface: `projects-${surface}`,
    });
    lastAction = `opened-projects-${surface}`;
  }

  function projectBreadcrumbSurfaceLabel(surface: ProjectForgeSurface): string {
    return projectSurfaceTitle(surface);
  }

  function projectsBreadcrumbSurfaceLabel(
    surface: ProjectForgeOverviewSurface,
  ): string {
    return surface[0]!.toUpperCase() + surface.slice(1);
  }

  function openProjectBreadcrumbSurface(surface: ProjectForgeSurface): void {
    selectedTaskId = "";
    selectedPullRequestId = "";
    projectPullRequestDiff = undefined;
    selectedProjectCommit = undefined;
    projectCommitDetail = undefined;
    selectedProjectPath = "";
    projectBlob = undefined;
    openProjectSurface(surface);
  }

  function projectRailTarget(
    label: string,
  ): ProjectForgeOverviewSurface | ProjectForgeSurface {
    if (selectedTask) return "tasks";
    if (selectedPullRequest) return "reviews";
    const scope = selectedRepository
      ? "repository"
      : selectedProject
        ? "project"
        : "directory";
    return (
      projectRailSurface(label, scope) ??
      (selectedRepository
        ? activeRepositorySurface
        : selectedProject
          ? activeProjectSurface
          : projectsOverviewSurface)
    );
  }

  function projectRailItemActive(label: string): boolean {
    if (!projectRailLabelIsCurrentPage(label)) return false;
    const target = projectRailTarget(label);
    return selectedRepository
      ? activeRepositorySurface === target
      : selectedProject
        ? activeProjectSurface === target
        : projectsOverviewSurface === target;
  }

  function selectProjectRailItem(label: string): void {
    const collection = projectRailCollectionFilter(label);
    if (collection?.kind === "tasks") taskListFilter = collection.value;
    if (collection?.kind === "reviews") reviewListFilter = collection.value;
    const target = projectRailTarget(label);
    if (selectedRepository) {
      if (
        label ===
        (
          roomForProjectChannel(selectedRepository.channelId)?.name ??
          selectedRepository.channelId
        ).replace(/^#/, "")
      ) {
        selectProjectChannelDestination(selectedRepository.channelId);
        return;
      }
      if (activeRepositorySurface !== target)
        openRepositorySurface(target as ProjectForgeSurface);
      return;
    }
    if (selectedProject) {
      if (activeProjectSurface !== target)
        openProjectSurface(target as ProjectForgeSurface);
      return;
    }
    if (projectsOverviewSurface !== target)
      openProjectsOverviewSurface(target as ProjectForgeOverviewSurface);
  }

  function roomForProjectChannel(
    channelId: string,
  ): CommunityRoomModel | undefined {
    const exact = allRooms.find(
      (room) => room.id === channelId || room.groupId === channelId,
    );
    if (exact !== undefined) return exact;

    // Older project events sometimes persisted the display name instead of the
    // NIP-29 group ID. Resolve that legacy value only when it is unambiguous;
    // channel names are not globally unique.
    const normalizedName = channelId.replace(/^#/, "");
    const namedRooms = allRooms.filter((room) => room.name === normalizedName);
    return namedRooms.length === 1 ? namedRooms[0] : undefined;
  }

  function selectProjectChannelDestination(channelId: string): void {
    const room = roomForProjectChannel(channelId);
    if (room === undefined) {
      toast.error("This project channel is not available in the community");
      return;
    }
    setDestination(room.id, true);
  }

  function activateChannelProjectSurface(surface: ProjectForgeSurface): void {
    const project = activeChannelProject;
    if (!project) return;
    selectedRepositoryCoordinate = "";
    activeRepositorySurface = "overview";
    selectedTaskId = "";
    selectedPullRequestId = "";
    selectedProjectCommit = undefined;
    projectCommitDetail = undefined;
    selectedProjectPath = "";
    projectBlob = undefined;
    projectPullRequestDiff = undefined;
    projectSourceError = "";
    projectOverviewInitialized = true;
    const mobile = shell.mobile.resolvedMode === "mobile";
    pushLocation({
      destination: activeDestination,
      panel: mobile ? noCommunityApplicationPanel() : activePanel,
      mainSurface: `project-${surface}`,
    });
    if (mobile)
      void tick().then(() =>
        shell.mobile.show("right", PROJECT_OVERVIEW_PANEL_ID),
      );
    lastAction = `opened-channel-project-${surface}`;
  }

  function openChannelProjectSurface(surface: ProjectForgeSurface): void {
    if (
      (surface === "files" || surface === "commits") &&
      !hasProjectSourceIdentity()
    ) {
      requestProjectSourceAccess(() => activateChannelProjectSurface(surface));
      return;
    }
    activateChannelProjectSurface(surface);
  }

  function requestProjectDialog(
    kind: CommunityProjectsDialogRequest["kind"],
    projectCoordinate?: string,
  ): void {
    projectDialogSequence += 1;
    projectDialogRequest = {
      id: projectDialogSequence,
      kind,
      ...(projectCoordinate ? { projectCoordinate } : {}),
    };
  }

  function closeProjectSurface(): void {
    if (selectedProjectSurface === undefined) return;
    const restoreProjectOverviewLane =
      projectSheetProject !== undefined && projectOverviewMobileActive;
    selectedPullRequestId = "";
    selectedTaskId = "";
    projectPullRequestDiff = undefined;
    if (projectSheetProject === undefined && selectedProject) {
      pushLocation(
        locationForProjectRoute({
          kind: "project",
          coordinate: selectedProject.address.coordinate,
          surface: "activity",
        }),
      );
    } else pushLocation({ destination: activeDestination, panel: activePanel });
    if (restoreProjectOverviewLane)
      void tick().then(() =>
        shell.mobile.show("right", PROJECT_OVERVIEW_PANEL_ID),
      );
    lastAction = "closed-project-surface";
  }

  async function withProjectMutation(
    label: string,
    action: (
      session: ProjectForgeSession,
      identity: NonNullable<CommunityProjectsOptions["identity"]>,
    ) => Promise<void>,
  ): Promise<void> {
    await withProjectRequest(label, action);
    projectReloadRevision += 1;
    void invalidateCommunityProjectQueries(
      communityQueryClient,
      communityQueryScope,
    );
  }

  async function withProjectRequest<T>(
    label: string,
    action: (
      session: ProjectForgeSession,
      identity: NonNullable<CommunityProjectsOptions["identity"]>,
    ) => Promise<T>,
  ): Promise<T> {
    const options = projectsOptions;
    const relayUrl = options?.relayUrl ?? activeConnection?.relayUrl;
    if (!options || !relayUrl) throw new Error("Projects are not configured");
    let result: T | undefined;
    let completed = false;
    await runAuthenticated(async () => {
      const identity =
        options.identity ?? applicationAuthentication?.identity();
      if (!identity) throw new Error("Connect a Nostr identity to collaborate");
      projectOperation = label;
      const session = await options.source.open({
        relayUrl,
        identity,
        ...(options.httpBaseUrl === undefined
          ? {}
          : { httpBaseUrl: options.httpBaseUrl }),
      });
      try {
        result = await action(session, identity);
        completed = true;
      } finally {
        session.close();
        projectOperation = "";
      }
    });
    if (!completed)
      throw new Error("The authenticated project action did not complete");
    return result as T;
  }

  const projectQueryActions = createProjectApplicationQueryActions({
    queryClient: () => communityQueryClient,
    scope: () => communityQueryScope,
    projectSession: () => projectSession,
    selectedRepository: () => selectedRepositoryCoordinate,
    sourceRepository: () => projectSourceRepositoryCoordinate,
    request: (label, action) =>
      withProjectRequest(label, async (session) => action(session)),
  });
  const {
    loadGitHubConnections,
    createGitHubConnection,
    updateGitHubConnection,
    revalidateGitHubConnection,
    loadGitHubRepositories,
    loadReviewRepositoryRefs,
    loadRepositoryCommit,
  } = projectQueryActions;

  async function attachGitHubRepository(
    repository: ProjectForgeRepository,
    connection: ProjectForgeGitHubConnection,
    providerRepository: ProjectForgeGitHubRepository,
  ): Promise<void> {
    if (repository.repositoryClass !== "external") {
      throw new Error("Only external repositories can be connected to GitHub");
    }
    await withProjectMutation(
      "Connecting GitHub repository…",
      async (session) => {
        await session.attachGitHubRepository(repository.address.coordinate, {
          expectedAnnouncementId: repository.event.id,
          connectionId: connection.id,
          externalRepositoryId: String(providerRepository.id),
        });
      },
    );
    toast.success(
      `${repository.name} connected to @${connection.account_login}`,
    );
  }

  async function createProject(
    input: CommunityProjectsCreateProject,
  ): Promise<void> {
    await withProjectMutation("Creating project…", async (session) => {
      const created = await session.publish(createProjectTemplate(input));
      pendingProjectMembership = undefined;
      setDestination(
        projectDestinationFromCoordinate(
          `${created.kind}:${created.pubkey}:${input.identifier}`,
        ),
        true,
      );
    });
    toast.success("Project created");
  }

  async function updateProject(
    project: ProjectForgeProject,
    input: CommunityProjectsUpdateProject,
  ): Promise<void> {
    await withProjectMutation(
      "Saving project settings…",
      async (session, identity) => {
        if ((await identity.getPublicKey()) !== project.event.pubkey) {
          throw new Error("Only the project owner can change these settings");
        }
        await session.publish(updateProjectTemplate(project.event, input));
      },
    );
    toast.success(
      input.relatedChannelIds === undefined
        ? "Project settings saved"
        : "Project channels updated",
    );
  }

  async function createRepository(
    input: CommunityProjectsCreateRepository,
  ): Promise<void> {
    const targetProject =
      selectedProject ??
      projectCatalog.projects.find(
        (project) => project.address.coordinate === input.project,
      );
    const channelId = targetProject?.channelId ?? input.channelId;
    if (!channelId) throw new Error("Choose a repository channel");
    await withProjectMutation("Adding repository…", async (session) => {
      const repository = await session.publish(
        createRepositoryTemplate({
          identifier: input.identifier,
          name: input.name,
          description: input.description,
          channelId,
          ...(input.mode === "external" && input.cloneUrl
            ? { cloneUrls: [input.cloneUrl] }
            : {}),
          ...(input.mode === "external" && input.webUrl
            ? { webUrls: [input.webUrl] }
            : {}),
        }),
      );
      const coordinate = `${repository.kind}:${repository.pubkey}:${input.identifier}`;
      if (!targetProject) {
        pendingProjectMembership = undefined;
        return;
      }
      try {
        await session.publish(
          addRepositoryToProjectTemplate(
            targetProject.event,
            coordinate,
            activeConnection?.relayUrl,
          ),
        );
        pendingProjectMembership = undefined;
      } catch (cause) {
        pendingProjectMembership = {
          project: targetProject.event,
          repositoryCoordinate: coordinate,
        };
        throw new Error(
          `Repository created, but project membership still needs repair: ${cause instanceof Error ? cause.message : "relay rejected the project update"}`,
        );
      }
    });
    toast.success(targetProject ? "Repository added" : "Repository created");
  }

  async function attachRepository(
    projectCoordinate: string,
    repositoryCoordinate: string,
  ): Promise<void> {
    const project = projectCatalog.projects.find(
      (candidate) => candidate.address.coordinate === projectCoordinate,
    );
    const repository = projectCatalog.repositories.find(
      (candidate) =>
        candidate.address.coordinate === repositoryCoordinate &&
        candidate.repositoryClass !== "task-anchor",
    );
    if (!project) throw new Error("Select a project first");
    if (!repository) throw new Error("Repository is no longer available");
    if (
      project.repositories.some(
        (reference) => reference.coordinate === repositoryCoordinate,
      )
    )
      return;
    await withProjectMutation("Adding repository…", async (session) => {
      await session.publish(
        addRepositoryToProjectTemplate(
          project.event,
          repositoryCoordinate,
          activeConnection?.relayUrl,
        ),
      );
    });
    toast.success(`${repository.name} added to ${project.name}`);
  }

  async function repairProjectMembership(): Promise<void> {
    const repair = pendingProjectMembership;
    if (!repair) {
      projectReloadRevision += 1;
      return;
    }
    await withProjectMutation("Repairing project…", async (session) => {
      await session.publish(
        addRepositoryToProjectTemplate(
          repair.project,
          repair.repositoryCoordinate,
          activeConnection?.relayUrl,
        ),
      );
      pendingProjectMembership = undefined;
    });
    toast.success("Project membership repaired");
  }

  async function createTask(input: CommunityProjectsCreateTask): Promise<void> {
    const project =
      input.repository === "project"
        ? (selectedProject ??
          projectCatalog.projects.find(
            (candidate) => candidate.address.coordinate === input.project,
          ))
        : undefined;
    if (input.repository === "project" && !project)
      throw new Error("Choose a project for a project-wide task");
    const repository =
      input.repository === "project"
        ? undefined
        : projectCatalog.repositories.find(
            (candidate) =>
              candidate.address.coordinate === input.repository &&
              candidate.repositoryClass !== "task-anchor",
          );
    if (input.repository !== "project" && !repository)
      throw new Error("Choose a repository or a project");
    const projectRepositories =
      project?.repositories
        .map((reference) =>
          projectCatalog.repositories.find(
            (candidate) =>
              candidate.address.coordinate === reference.coordinate,
          ),
        )
        .filter((candidate) => candidate !== undefined) ?? [];
    await withProjectMutation("Creating task…", async (session) => {
      let coordinate = input.repository;
      if (coordinate === "project") {
        if (!project) throw new Error("Choose a project for this task");
        const existingAnchor = projectRepositories.find(
          (repository) => repository.repositoryClass === "task-anchor",
        );
        if (existingAnchor) {
          coordinate = existingAnchor.address.coordinate;
        } else {
          const anchor = createProjectTaskAnchorTemplate(
            project.event,
            projectCatalog.repositories,
          );
          await session.publish(anchor.template);
          try {
            await session.publish(
              addRepositoryToProjectTemplate(
                project.event,
                anchor.coordinate,
                activeConnection?.relayUrl,
              ),
            );
            pendingProjectMembership = undefined;
          } catch (cause) {
            pendingProjectMembership = {
              project: project.event,
              repositoryCoordinate: anchor.coordinate,
            };
            throw new Error(
              `Task anchor created, but project membership still needs repair: ${cause instanceof Error ? cause.message : "relay rejected the project update"}`,
            );
          }
          coordinate = anchor.coordinate;
        }
      }
      const owner = coordinate.split(":")[1];
      if (!owner) throw new Error("Repository owner is missing");
      await session.publish(
        createTaskTemplate({
          repository: coordinate,
          repositoryOwner: owner,
          title: input.title,
          content: input.content,
          labels: [input.category],
        }),
      );
    });
    toast.success("Task created");
  }

  async function createPullRequest(
    input: CommunityProjectsCreatePullRequest,
  ): Promise<void> {
    const repository = projectCatalog.repositories.find(
      (candidate) => candidate.address.coordinate === input.repository,
    );
    if (!repository) throw new Error("Repository could not be found");
    const capabilities =
      projectRepositoryCapabilities[repository.address.coordinate];
    const cloneUrl =
      repository.cloneUrls.find((url) => url.trim() !== "") ??
      (capabilities?.clone.available ? capabilities.clone.url : undefined);
    if (!cloneUrl) throw new Error("Repository clone information is missing");
    await submitRepositoryPullRequest({
      repository: input.repository,
      title: input.title,
      content: input.content,
      cloneUrl,
      ...(input.commit ? { commit: input.commit } : {}),
      branchName: input.branchName,
      targetBranch: input.targetBranch,
      mutate: withProjectMutation,
    });
    toast.success("Pull request created");
  }

  function createReviewFromLog(input: LogReviewSubmitInput): Promise<void> {
    return createPullRequest(
      logReviewRequest(
        input,
        workspace.currentMemberId,
        selectedRepository?.address.coordinate ?? "",
      ),
    );
  }

  async function loadRepositoryPathCommit(path: string, signal?: AbortSignal) {
    return loadRepositoryPathCommitFromQuery({
      queryClient: communityQueryClient,
      scope: communityQueryScope,
      session: projectSession,
      repository: projectSourceRepositoryCoordinate,
      revision: projectRepositoryRevision,
      path,
      signal,
    });
  }

  async function publishPullRequestReview(
    pullRequest: PullRequestState,
    review: { decision: PullRequestReviewKind; content: string },
  ): Promise<void> {
    await withProjectMutation(
      review.decision === "approved"
        ? "Publishing approval…"
        : review.decision === "changes-requested"
          ? "Requesting changes…"
          : "Publishing review…",
      async (session) => {
        await session.publish(
          createPullRequestReviewTemplate(
            pullRequest.root,
            pullRequest.repository.coordinate,
            review.decision,
            pullRequest.currentCommit,
            review.content,
          ),
        );
      },
    );
    toast.success(
      review.decision === "approved"
        ? "Review approved"
        : review.decision === "changes-requested"
          ? "Changes requested"
          : "Review submitted",
    );
  }

  async function mergePullRequest(
    pullRequest: PullRequestState,
  ): Promise<void> {
    await withProjectMutation("Merging pull request…", async (session) => {
      await mergeHostedPullRequest(
        session,
        pullRequest,
        projectRepositoryCapabilities[pullRequest.repository.coordinate]
          ?.collaboration_backend,
      );
    });
    toast.success("Pull request merged");
  }

  async function saveRepositoryProtection(
    repository: string,
    input: ProjectForgeProtectionDocumentInput,
  ): Promise<void> {
    await withProjectMutation("Saving branch protection…", async (session) => {
      projectRepositoryCapabilities = applySavedProtection(
        projectRepositoryCapabilities,
        repository,
        await session.updateRepositoryProtection(repository, input),
      );
    });
    toast.success("Branch protection saved");
  }

  async function requestPullRequestReview(
    pullRequest: PullRequestState,
    reviewer: string,
  ): Promise<void> {
    await withProjectMutation("Requesting review…", async (session) => {
      await session.publish(
        createReviewRequestTemplate(
          pullRequest.root,
          pullRequest.repository.coordinate,
          [reviewer],
        ),
      );
    });
    toast.success("Review requested");
  }

  async function updateTaskLifecycle(
    task: ProjectForgeWorkItems["tasks"][number],
    lifecycle: "open" | "closed",
  ): Promise<void> {
    await withProjectMutation(
      lifecycle === "closed" ? "Closing task…" : "Reopening task…",
      async (session) => {
        await session.publish(
          createWorkItemStatusTemplate(
            task.root,
            task.repository.coordinate,
            lifecycle,
          ),
        );
      },
    );
    toast.success(lifecycle === "closed" ? "Task closed" : "Task reopened");
  }

  async function updateTaskAssignment(
    task: ProjectTaskState,
    assignee: string,
    assigned: boolean,
  ): Promise<void> {
    await withProjectMutation(
      assigned ? "Assigning task…" : "Removing assignment…",
      async (session) => {
        await session.publish(
          createAssignmentTemplate(
            task.root,
            task.repository.coordinate,
            [assignee],
            assigned,
          ),
        );
      },
    );
    toast.success(assigned ? "Task assigned" : "Assignment removed");
  }

  async function publishTaskComment(
    task: ProjectTaskState,
    content: string,
  ): Promise<void> {
    await withProjectMutation("Publishing comment…", async (session) => {
      await session.publish(
        createBuzzCommentTemplate(
          task.root,
          task.repository.coordinate,
          content,
        ),
      );
    });
    toast.success("Comment published");
  }

  async function updatePullRequestLifecycle(
    pullRequest: PullRequestState,
    lifecycle: "open" | "closed" | "draft",
  ): Promise<void> {
    await withProjectMutation(
      lifecycle === "open"
        ? "Reopening pull request…"
        : lifecycle === "draft"
          ? "Marking pull request as draft…"
          : "Closing pull request…",
      async (session) => {
        await session.publish(
          createWorkItemStatusTemplate(
            pullRequest.root,
            pullRequest.repository.coordinate,
            lifecycle,
          ),
        );
      },
    );
    toast.success(
      lifecycle === "open"
        ? "Pull request reopened"
        : lifecycle === "draft"
          ? "Pull request marked as draft"
          : "Pull request closed",
    );
  }

  async function publishPullRequestComment(
    pullRequest: PullRequestState,
    content: string,
  ): Promise<void> {
    await withProjectMutation("Publishing comment…", async (session) => {
      await session.publish(
        createBuzzCommentTemplate(
          pullRequest.root,
          pullRequest.repository.coordinate,
          content,
          { commit: pullRequest.currentCommit },
        ),
      );
    });
    toast.success("Comment published");
  }

  async function togglePullRequestCommentReaction(
    pullRequest: PullRequestState,
    comment: PullRequestComment,
    emoji: string,
  ): Promise<void> {
    const capabilities =
      projectRepositoryCapabilities[pullRequest.repository.coordinate];
    if (
      (capabilities?.collaboration_backend === "github" ||
        comment.event.tags.some(
          (tag) => tag[0] === "external-provider" && tag[1] === "github",
        )) &&
      !GITHUB_REVIEW_COMMENT_REACTIONS.some((supported) => supported === emoji)
    ) {
      throw new Error("GitHub does not support that reaction");
    }
    await withProjectMutation(
      "Updating reaction…",
      async (session, identity) => {
        const pubkey = await identity.getPublicKey();
        const existing = projectWorkItems.events.find(
          (event) =>
            event.kind === PROJECT_FORGE_KINDS.reaction &&
            event.pubkey === pubkey &&
            event.content === emoji &&
            event.tags.some(
              (tag) => tag[0] === "e" && tag[1] === comment.event.id,
            ) &&
            event.tags.some(
              (tag) => tag[0] === "p" && tag[1] === comment.event.pubkey,
            ) &&
            event.tags.some(
              (tag) => tag[0] === "k" && tag[1] === String(comment.event.kind),
            ) &&
            event.tags.some(
              (tag) =>
                tag[0] === "a" && tag[1] === pullRequest.repository.coordinate,
            ),
        );
        await session.publish(
          existing
            ? createDeletionTemplate(existing)
            : createProjectReactionTemplate(
                comment.event,
                pullRequest.repository.coordinate,
                emoji,
              ),
        );
      },
    );
  }

  async function publishInlineComment(
    pullRequest: PullRequestState,
    input: {
      path: string;
      side: "old" | "new";
      line: number;
      content: string;
    },
  ): Promise<void> {
    await withProjectMutation("Publishing comment…", async (session) => {
      await session.publish(
        createBuzzCommentTemplate(
          pullRequest.root,
          pullRequest.repository.coordinate,
          input.content,
          {
            commit: pullRequest.currentCommit,
            anchor: input,
          },
        ),
      );
    });
    toast.success("Inline comment published");
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
    replaceBrowserLocation(next);
    lastAction = offset === -1 ? "navigated-back" : "navigated-forward";
  }

  const react = createMessageReactionAction({
    run: (id, emoji, custom) =>
      runParticipationAction(activeRoom.id, "reaction", () =>
        community.actions.toggleReaction(id, emoji, custom),
      ),
    done: (action) => (lastAction = action),
    error: (message) => toast.error(message),
  });

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

  async function leaveRoom(room: CommunityRoomModel): Promise<void> {
    await runAuthenticated(() => community.actions.leave(room.id));
    lastAction = `left-room:${room.id}`;
    toast.success(`Left ${room.name}`);
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
    const url = communityCopy.communityCopiedMessageLinkFromMessages({
      roomKind: activeRoom.kind,
      roomId: activeRoom.id,
      messageId,
      messages: [...workspace.messages, ...(workspace.thread?.messages ?? [])],
      relayUrl: activeConnection?.relayUrl,
      ...(linkBuilder === undefined ? {} : { linkBuilder }),
    });
    if (url) void copyText(url, "Message link copied");
    lastAction = `copied-message-link:${messageId}`;
  }

  function copyPulseLink(noteId: string): void {
    const note = community.state.pulse?.notes.find(
      (candidate) => candidate.id === noteId,
    );
    if (!note) {
      toast.error("The note is no longer available");
      return;
    }
    const relays = activeConnection ? [activeConnection.relayUrl] : undefined;
    const url = `nostr:${nip19.neventEncode({
      id: note.id,
      author: note.author.id,
      ...(relays === undefined ? {} : { relays }),
    })}`;
    void copyText(url, "Note link copied");
    lastAction = `copied-pulse-link:${noteId}`;
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
    initialName = "",
  ): void {
    roomEditorKind = kind;
    roomEditorMode = mode;
    roomEditorInitialName = mode === "create" ? initialName : "";
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
    if (action.id === "browse" && section.id === "projects")
      setDestination("projects", true);
    else if (action.id === "browse")
      openRoomBrowser(section.id === "forums" ? "forum" : "channel");
    else if (action.id === "create" && section.id === "projects")
      void runAuthenticated(() => requestProjectDialog("project"));
    else if (action.id === "create")
      void runAuthenticated(() =>
        openRoomEditor(section.id === "forums" ? "forum" : "channel", "create"),
      );
    else if (action.id === "new") {
      void runAuthenticated(() => {
        memberCommandTask = undefined;
        memberCommandMode = "select";
        selectedRecipientIds = [];
        setDestination("new-direct-message", true);
        memberCommandOpen = true;
      });
    } else if (action.id === "join-invite") {
      groupInviteMode = "join";
      groupInviteOpen = true;
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
    onSectionAction?.(section, action);
  }

  function handleItemAction(
    item: CommunityNavigationItemModel,
    action: CommunityNavigationItemAction,
  ): void {
    const run = async (): Promise<void> => {
      if (action === "copy-link")
        await copyText(
          communityCopy.communityCopiedRoomLink({ roomId: item.id }),
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
        if (item.kind === "projects") {
          requestProjectDialog(
            "edit-project",
            projectCoordinateFromDestination(item.id),
          );
          lastAction = "opened-project-settings";
          return;
        }
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
    try {
      await runAuthenticated(async () => {
        if (action === "leave") await community.actions.leave(activeRoom.id);
        if (action === "delete")
          await community.actions.deleteRoom(activeRoom.id);
      });
      if (action === "delete") toast.success("Room deleted");
      confirmation = null;
      closeSidePanel();
    } catch (cause) {
      throw new Error(
        cause instanceof Error
          ? cause.message
          : "The relay rejected this action",
      );
    }
  }

  async function saveRoom(
    update: Parameters<CommunityController["actions"]["updateRoom"]>[1],
  ): Promise<void> {
    let createdRoomId: string | undefined;
    await runAuthenticated(async () => {
      if (roomEditorMode === "create") {
        await community.actions.createRoom(roomEditorKind, update);
        createdRoomId = community.state.workspace.activeRoomId;
      } else {
        await community.actions.updateRoom(activeRoom.id, update);
      }
    });
    if (createdRoomId !== undefined) setDestination(createdRoomId, true);
    toast.success(
      roomEditorMode === "create"
        ? `${roomEditorKind === "forum" ? "Forum" : "Channel"} created`
        : "Room settings saved",
    );
    closeSidePanel();
  }

  async function setMemberRoles(
    member: CommunityMemberModel,
    roles: readonly string[],
  ): Promise<void> {
    const action = community.actions.setMemberRoles;
    if (action === undefined) throw new Error("Member roles are unavailable");
    await runAuthenticated(() =>
      action(memberCommandRoom.id, member.id, roles),
    );
    toast.success(`${member.name}'s roles updated`);
  }

  async function createGroupInvite() {
    const action = community.actions.createGroupInvite;
    if (action === undefined) throw new Error("Group invites are unavailable");
    let invite: Awaited<ReturnType<typeof action>> | undefined;
    await runAuthenticated(async () => {
      invite = await action(activeRoom.id);
    });
    if (invite === undefined) throw new Error("Invite creation was cancelled");
    toast.success("Invite created");
    return invite;
  }

  async function joinWithInvite(value: string): Promise<void> {
    const action = community.actions.joinWithInvite;
    if (action === undefined) throw new Error("Invite joining is unavailable");
    await runAuthenticated(() => action(value));
    toast.success("Join request accepted");
  }

  async function copyInvite(value: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Invite link copied");
    } catch (cause) {
      toast.error("Could not copy to the clipboard");
      throw cause instanceof Error
        ? cause
        : new Error("Invite link could not be copied");
    }
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
        community.actions.addMember(memberCommandRoom.id, member.id),
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

  function openRepositoryPeople(roomId: string): void {
    memberCommandRoomId = roomId;
    memberCommandMode = "manage";
    memberCommandOpen = true;
  }
  function startDirectMessage(): void {
    if (!selectedRecipientIds.length) return;
    memberCommandOpen = false;
    if (activeDestination !== "new-direct-message") {
      community.actions.openDirectMessage(selectedRecipientIds);
      setDestination(`dm:${selectedRecipientIds.join(",")}`, true);
    }
  }

  function openTaskAssignmentCommand(task: ProjectTaskState): void {
    memberCommandTask = task;
    memberCommandMode = "select";
    selectedRecipientIds = [...task.assignees];
    memberCommandOpen = true;
  }

  async function updateSelectedTaskAssignments(): Promise<void> {
    const task = memberCommandTask;
    if (!task) {
      startDirectMessage();
      return;
    }

    const previous = new Set(task.assignees);
    const selected = new Set(selectedRecipientIds);
    const added = selectedRecipientIds.filter((id) => !previous.has(id));
    const removed = task.assignees.filter((id) => !selected.has(id));
    if (added.length === 0 && removed.length === 0) {
      memberCommandOpen = false;
      memberCommandTask = undefined;
      return;
    }

    await withProjectMutation("Updating task assignees…", async (session) => {
      if (removed.length > 0) {
        await session.publish(
          createAssignmentTemplate(
            task.root,
            task.repository.coordinate,
            removed,
            false,
          ),
        );
      }
      if (added.length > 0) {
        await session.publish(
          createAssignmentTemplate(
            task.root,
            task.repository.coordinate,
            added,
            true,
          ),
        );
      }
    });
    memberCommandOpen = false;
    memberCommandTask = undefined;
    toast.success("Task assignees updated");
  }

  async function messageMember(member: CommunityMemberModel): Promise<void> {
    await runAuthenticated(() => {
      selectedRecipientIds = [member.id];
      community.actions.openDirectMessage(selectedRecipientIds);
      setDestination(`dm:${member.id}`, true);
    });
  }

  async function deleteMessage(messageId: string): Promise<void> {
    try {
      await runAuthenticated(() => community.actions.deleteEvent(messageId));
      toast.success("Message deleted");
      lastAction = `deleted-message:${messageId}`;
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Message could not be deleted",
      );
      throw cause;
    }
  }

  async function editMessage(
    messageId: string,
    content: string,
  ): Promise<void> {
    try {
      const editEvent = community.actions.editEvent;
      if (editEvent === undefined) {
        throw new Error(
          "This community source does not support message editing",
        );
      }
      await runAuthenticated(() => editEvent(messageId, content));
      toast.success("Message updated");
      lastAction = `edited-message:${messageId}`;
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Message could not be updated",
      );
      throw cause;
    }
  }

  async function reportMessage(
    messageId: string,
    report: CommunityMessageReport,
  ): Promise<void> {
    try {
      const reportEvent = community.actions.reportEvent;
      if (reportEvent === undefined) {
        throw new Error(
          "This community source does not support message reports",
        );
      }
      await runAuthenticated(() => reportEvent(messageId, report));
      toast.success("Report sent privately to the community curators");
      lastAction = `reported-message:${messageId}`;
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Report could not be sent",
      );
      throw cause;
    }
  }

  async function handleTopicAction(
    topicId: string,
    action: "copy-link" | "mark-read" | "star" | "mute" | "delete",
  ): Promise<void> {
    const topic = workspace.topics.find(
      (candidate) => candidate.id === topicId,
    );
    if (action === "copy-link" && topic) {
      await copyText(
        communityCopy.communityCopiedMessageLink({
          roomId: activeRoom.id,
          eventId: topic.id,
          authorPubkey: topic.authorId,
          relayUrl: activeConnection?.relayUrl ?? "",
          ...(linkBuilder === undefined ? {} : { linkBuilder }),
        }),
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
    if (knownAgentIds.includes(member.id) && community.actions.agents) {
      openAgentActivity(member.id);
      return;
    }
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
    action: "follow",
    member: CommunityMemberModel,
  ): void {
    const handler = extensions[action];
    if (handler === undefined) return;
    void Promise.resolve(handler(member.id)).catch((cause) =>
      toast.error(
        cause instanceof Error
          ? cause.message
          : "Follow could not be completed",
      ),
    );
    lastAction = `${action}:${member.id}`;
  }

  async function waveMember(member: CommunityMemberModel): Promise<void> {
    try {
      if (extensions.wave === undefined) {
        await runAuthenticated(() =>
          community.actions.sendDirectMessage([member.id], "👋"),
        );
        community.actions.openDirectMessage([member.id]);
        setDestination(`dm:${member.id}`, true);
      } else {
        const wave = extensions.wave;
        await runAuthenticated(() => Promise.resolve(wave(member.id)));
      }
      toast.success(`Waved to ${member.name}`);
      lastAction = `wave:${member.id}`;
    } catch (cause) {
      toast.error(
        cause instanceof Error ? cause.message : "Wave could not be sent",
      );
      throw cause;
    }
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

  const participationSend = createCommunityApplicationSend({
    sendReply: (rootMessageId, content, mentionPubkeys) =>
      community.actions.sendReply(rootMessageId, content, mentionPubkeys),
    sendMessage: (roomId, content, mentionPubkeys) =>
      community.actions.sendMessage(roomId, content, mentionPubkeys),
    sendDirectMessage: (recipients, content, replyToEventId) =>
      community.actions.sendDirectMessage(recipients, content, replyToEventId),
    clearReplyTarget: () => community.actions.clearReplyTarget(),
    replyTarget: () => community.state.replyTarget,
    activePanel: () => activePanel,
    activeRoom: () => activeRoom,
    workspace: () => workspace,
    runParticipationAction,
    openPanel,
    setLastAction: (action) => {
      lastAction = action;
    },
    error: (message) => toast.error(message),
  });
  const sendThreadReply = participationSend.sendThreadReply;
  const sendWorkspaceMessage = participationSend.sendWorkspaceMessage;

  async function sendNewDirectMessage(
    content: string,
    transport: "nip17" | "buzz-dm" = "nip17",
  ): Promise<void> {
    try {
      if (transport === "buzz-dm") {
        const roomId =
          await community.actions.openBuzzDirectMessage?.(selectedRecipientIds);
        if (!roomId) throw new Error("Buzz direct messaging is unavailable");
        await community.actions.sendMessage(roomId, content);
        setDestination(roomId, true);
        return;
      }
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
    shell.right.close();
    openPanel(noCommunityApplicationPanel());
    lastAction = "closed-side-panel";
  }

  async function reconnect(): Promise<void> {
    relayNoticeDismissed = false;
    try {
      await community.reconnect();
    } catch {
      // The controller exposes the failure through reactive state and the alert.
    }
  }

  async function clearCommunityCaches(communityId: string): Promise<void> {
    await community.actions.clearCache(communityId);
    const options = projectsOptions;
    const relayUrl = options?.relayUrl ?? activeConnection?.relayUrl;
    if (!options || !relayUrl) return;
    await (options.catalogStore ?? defaultProjectCatalogStore).clear({
      relayUrl,
      communityId,
      ...(options.channelId === undefined
        ? {}
        : { channelId: options.channelId }),
    });
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

  function accountSessionMember(
    account: CommunityAccountSession,
    settings: CommunityController["state"]["settings"],
  ): CommunityMemberModel {
    const pubkey = account.account.nostr_pubkey;
    const storedProfile =
      settings.profile.pubkey === pubkey ? settings.profile : undefined;
    const identity =
      account.identities.find(
        (candidate) => candidate.provider === account.auth_provider,
      ) ?? account.identities[0];
    const shortKey = `${pubkey.slice(0, 8)}…${pubkey.slice(-5)}`;
    const name =
      storedProfile?.displayName.trim() ||
      identity?.display_name.trim() ||
      identity?.login.trim() ||
      shortKey;
    const initials =
      name
        .split(/\s+/u)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toLocaleUpperCase() ?? "")
        .join("") || "?";
    return {
      id: pubkey,
      name,
      handle: storedProfile?.username || identity?.login || shortKey,
      initials,
      ...(storedProfile?.picture ? { avatarUrl: storedProfile.picture } : {}),
      presence: "offline",
    };
  }

  // Resolve optional props once per dependency change, rather than on every child prop read.
  const workspaceSurfaceOptions = $derived({
    virtualize: true,
    ...(community.state.history ? { history: community.state.history } : {}),
    ...(community.state.timelinePresentation
      ? { presentation: community.state.timelinePresentation }
      : {}),
    ...(community.actions.updateTimelinePresentation
      ? {
          onPresentationChange: community.actions.updateTimelinePresentation,
        }
      : {}),
    ...(community.actions.loadOlderHistory
      ? { onLoadOlder: () => community.actions.loadOlderHistory!() }
      : {}),
    ...(community.actions.loadNewerHistory
      ? {
          onLoadLatest: () => community.actions.loadNewerHistory!(),
        }
      : {}),
    ...(community.state.directHistory && community.actions.loadDirectHistory
      ? {
          directHistory: community.state.directHistory,
          onLoadOlderDirectMessages: community.actions.loadDirectHistory,
        }
      : {}),
    ...(activeChannelProject === undefined
      ? {}
      : { channelActions: projectChannelRepositoryAction }),
    ...(activeParticipationOperation === undefined
      ? {}
      : { operation: activeParticipationOperation }),
    ...(activeParticipationOperationEntry === undefined
      ? {}
      : {
          onRetryOperation: () =>
            community.retry(activeParticipationOperationEntry[0]),
          onDismissOperation: () =>
            community.dismissOperation(activeParticipationOperationEntry[0]),
        }),
    ...(community.state.replyTarget === undefined ||
    activePanel.kind === "thread"
      ? {}
      : { replyTarget: community.state.replyTarget }),
    agents: composerAgents,
    agentMemberIds,
  });

  // Inbox uses the same memoized prop boundary as channel surfaces.
  const inboxSurfaceOptions = $derived({
    virtualize: true,
    ...(community.state.inboxHistory
      ? { listHistory: community.state.inboxHistory }
      : {}),
    ...(community.actions.loadOlderInbox
      ? { onLoadOlderItems: community.actions.loadOlderInbox }
      : {}),
    ...(community.state.inboxConversationHistory
      ? { history: community.state.inboxConversationHistory }
      : {}),
    ...(community.state.inboxPresentation
      ? { presentation: community.state.inboxPresentation }
      : {}),
    ...(community.actions.updateTimelinePresentation
      ? {
          onPresentationChange: community.actions.updateTimelinePresentation,
        }
      : {}),
    ...(community.actions.loadOlderHistory
      ? {
          onLoadOlder: () => {
            const selected =
              inbox.selectedItem ??
              inbox.items.find((item) => item.id === inbox.activeItemId);
            return community.actions.loadOlderHistory!({
              roomId: selected?.roomId ?? inbox.room.id,
              ...(selected?.scopeId ? { scopeId: selected.scopeId } : {}),
              ...(selected?.rootEventId
                ? { rootEventId: selected.rootEventId }
                : {}),
            });
          },
        }
      : {}),
    ...(community.actions.loadNewerHistory
      ? {
          onLoadLatest: () => {
            const selected =
              inbox.selectedItem ??
              inbox.items.find((item) => item.id === inbox.activeItemId);
            return community.actions.loadNewerHistory!({
              roomId: selected?.roomId ?? inbox.room.id,
              ...(selected?.scopeId ? { scopeId: selected.scopeId } : {}),
              ...(selected?.rootEventId
                ? { rootEventId: selected.rootEventId }
                : {}),
            });
          },
        }
      : {}),
    ...(community.state.directHistory && community.actions.loadDirectHistory
      ? {
          directHistory: community.state.directHistory,
          onLoadOlderDirectMessages: community.actions.loadDirectHistory,
        }
      : {}),
    ...(workspace.currentMemberId === undefined
      ? {}
      : { currentMemberId: workspace.currentMemberId }),
    ...(extensions.huddle === undefined
      ? {}
      : { onHuddle: () => extensions.huddle?.(inbox.room.id) }),
    ...(extensions.activityLog === undefined
      ? {}
      : { onViewMemberActivity: viewMemberActivity }),
    ...(inbox.room.kind === "direct"
      ? {}
      : { onCopyMessageLink: copyMessageLink }),
    ...(extensions.editMessage === undefined
      ? community.actions.editEvent === undefined
        ? {}
        : { onSaveMessageEdit: editMessage }
      : { onEditMessage: extensions.editMessage }),
    ...(community.actions.reportEvent === undefined
      ? {}
      : { onReportMessage: reportMessage }),
    ...(community.state.replyTarget === undefined
      ? {}
      : { replyTarget: community.state.replyTarget }),
  });
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

{#snippet mobileRightSidebarToggle()}
  {#if isProjectsDestination || (activeChannelProject && usesRoomToolbar)}
    {@render projectOverviewToggle()}
  {:else if isPluginReleaseRoom}
    {@render releaseOverviewToggle()}
  {/if}
{/snippet}

{#snippet releaseOverviewToggle()}
  {#if activeMainSurface !== undefined}
    <Button
      bind:ref={releaseOverviewToggleElement}
      type="button"
      variant="ghost"
      size="icon-sm"
      class="community-application__release-overview-toggle"
      aria-label="Show plugin release overview"
      title="Show plugin release overview"
      onclick={() => {
        closeReleaseSurface();
        releaseOverviewSidebar.expand();
        lastAction = "opened-release-overview";
      }}
    >
      <svg
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
        <rect x="18" y="5" width="2" height="14" rx="2" fill="currentColor"
        ></rect>
      </svg>
    </Button>
  {:else}
    <AppShell.Sidebar.Toggle
      bind:ref={releaseOverviewToggleElement}
      shellController={shell}
      side="right"
      sidebarController={releaseOverviewSidebar}
      sidebarName="plugin release overview"
      label={shell.mobile.resolvedMode === "mobile"
        ? releaseOverviewMobileActive
          ? "Close plugin release overview sidebar"
          : "Open plugin release overview sidebar"
        : releaseOverviewShown
          ? "Hide plugin release overview"
          : "Show plugin release overview"}
      class="community-application__release-overview-toggle"
      onclick={() => {
        releaseOverviewInitialized = true;
        if (shell.mobile.resolvedMode === "mobile") {
          releaseOverviewSidebar.expand();
          lastAction = releaseOverviewMobileActive
            ? "closed-release-overview"
            : "opened-release-overview";
          return;
        }
        if (releaseOverviewSidebar.collapsed) releaseOverviewSidebar.close();
        lastAction = releaseOverviewSidebar.closed
          ? "closed-release-overview"
          : "opened-release-overview";
      }}
    />
  {/if}
{/snippet}

{#snippet releaseOverviewItems()}
  <Button
    type="button"
    variant="ghost"
    class="community-application__release-overview-item"
    onclick={() => openReleaseSurface("release-reviews")}
  >
    <GitPullRequestIcon data-icon="inline-start" aria-hidden="true" />
    <span>Reviews</span>
    {#if registryOptions?.source.loadReleaseReviewEntries !== undefined}
      <small aria-label={`${pendingReleaseReviewCount} pending reviews`}>
        {pendingReleaseReviewCount}
      </small>
    {/if}
  </Button>
  <Button
    type="button"
    variant="ghost"
    class="community-application__release-overview-item"
    onclick={() => openReleaseSurface("release-people")}
  >
    <UsersIcon data-icon="inline-start" aria-hidden="true" />
    <span>People</span>
    <small
      aria-label={`${activeRoom.memberCount ?? releaseRoomMembers.length} people`}
    >
      {activeRoom.memberCount ?? releaseRoomMembers.length}
    </small>
  </Button>
{/snippet}

{#snippet releaseOverviewRail()}
  <AppShell.Sidebar
    side="right"
    sidebarController={releaseOverviewSidebar}
    class="community-application__release-overview-sidebar"
    variant="rail"
    constraintPriority={100}
    label="Plugin release overview sidebar"
    mobileLabel="Plugin release overview"
    resizeLabel="Resize plugin release overview sidebar"
  >
    <AppShell.Sidebar.Body>
      <nav
        class="community-application__release-overview"
        aria-label="Plugin release overview"
      >
        {@render releaseOverviewItems()}
      </nav>
    </AppShell.Sidebar.Body>
  </AppShell.Sidebar>
{/snippet}

{#snippet releaseSheet()}
  <AppShell.SurfaceLayer
    open={releaseSheetOpen}
    label={activeMainSurface === "release-people" ? "People" : "Reviews"}
    coverPanelIds={["right"]}
    suspendPanelIds={[
      activeChannelProject
        ? PROJECT_OVERVIEW_PANEL_ID
        : COMMUNITY_APPLICATION_RELEASE_OVERVIEW_PANEL_ID,
    ]}
    dismissLabel={`Back to ${activeRoom.name}`}
    onDismiss={closeReleaseSurface}
    class="community-application__release-sheet-layer"
    style="--ui-shell-surface-layer-main-start-allowance: 7rem; --ui-shell-surface-layer-inline-end-inset: 0px"
  >
    <AppShell.SurfaceLayer.Header
      class="community-application__release-sheet-header"
    >
      <h1 id="community-application-release-sheet-title">
        {activeMainSurface === "release-people" ? "People" : "Reviews"}
      </h1>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Close ${activeMainSurface === "release-people" ? "People" : "Reviews"}`}
        title={`Close ${activeMainSurface === "release-people" ? "People" : "Reviews"}`}
        onclick={closeReleaseSurface}
      >
        <XIcon aria-hidden="true" />
      </Button>
    </AppShell.SurfaceLayer.Header>
    <AppShell.SurfaceLayer.Body
      class="community-application__release-sheet-body"
    >
      {#if activeMainSurface === "release-people"}
        <CommunityReleasePeople
          members={releaseRoomMembers}
          entries={releaseReviewEntries}
          activityLoading={releaseReviewsLoading}
          activityUnavailable={registryOptions?.source
            .loadReleaseReviewEntries === undefined}
          completeness={activeRoom.memberListCompleteness ?? "unavailable"}
          onOpenProfile={openReleaseProfile}
        />
      {:else if registryOptions}
        <CommunityReleaseReviews
          onOpenProfile={openReleaseProfile}
          onMessageMember={messageMember}
          onWaveMember={waveMember}
          entries={releaseReviewEntries}
          source={registryOptions.source}
          members={releaseRoomMembers}
          loading={releaseReviewsLoading}
          error={releaseReviewsError}
          onOpenPlugin={(pluginId) =>
            navigateRegistry({ page: "plugin", pluginId })}
        />
      {:else}
        <p class="community-application__release-unavailable" role="status">
          Reviews are unavailable because no registry data source was provided.
        </p>
      {/if}
    </AppShell.SurfaceLayer.Body>
  </AppShell.SurfaceLayer>
{/snippet}

{#snippet projectBreadcrumb()}
  <div class="community-application__project-breadcrumb">
    <Breadcrumb.Root aria-label="Project breadcrumb">
      <Breadcrumb.List>
        <Breadcrumb.Item>
          {#if isProjectDirectory && projectsOverviewSurface === "projects"}
            <Breadcrumb.Page>
              <FolderKanbanIcon aria-hidden="true" />
              <span>Projects</span>
            </Breadcrumb.Page>
          {:else}
            <Breadcrumb.Link
              href="#/projects"
              onclick={(event) => {
                event.preventDefault();
                setDestination("projects", true);
              }}
            >
              <FolderKanbanIcon aria-hidden="true" />
              <span>Projects</span>
            </Breadcrumb.Link>
          {/if}
        </Breadcrumb.Item>
        {#if selectedProject}
          <Breadcrumb.Separator />
          <Breadcrumb.Item>
            {#if activeProjectSurface === "activity" && !selectedRepository && !selectedTask && !selectedPullRequest}
              <Breadcrumb.Page
                ><span>{selectedProject.name}</span></Breadcrumb.Page
              >
            {:else}
              <Breadcrumb.Link
                href={projectRouteToHash({
                  kind: "project",
                  coordinate: selectedProject.address.coordinate,
                  surface: "activity",
                })}
                onclick={(event) => {
                  event.preventDefault();
                  if (selectedRepository) closeRepository();
                  else openProjectBreadcrumbSurface("activity");
                }}><span>{selectedProject.name}</span></Breadcrumb.Link
              >
            {/if}
          </Breadcrumb.Item>
          {#if selectedRepository}
            <Breadcrumb.Separator />
            <Breadcrumb.Item>
              {#if activeRepositorySurface === "overview" && !selectedTask && !selectedPullRequest && !selectedProjectCommit && !selectedProjectPath}
                <Breadcrumb.Page
                  ><span>{selectedRepository.name}</span></Breadcrumb.Page
                >
              {:else}
                <Breadcrumb.Link
                  href={projectRouteToHash({
                    kind: "repository",
                    coordinate: selectedRepository.address.coordinate,
                    surface: "overview",
                  })}
                  onclick={(event) => {
                    event.preventDefault();
                    activateRepositorySurface("overview");
                  }}><span>{selectedRepository.name}</span></Breadcrumb.Link
                >
              {/if}
            </Breadcrumb.Item>
            {#if activeRepositorySurface !== "overview"}
              <Breadcrumb.Separator />
              <Breadcrumb.Item>
                {#if selectedTask || selectedPullRequest || selectedProjectCommit || selectedProjectPath}
                  <Breadcrumb.Link
                    href={projectRouteToHash({
                      kind: "repository",
                      coordinate: selectedRepository.address.coordinate,
                      surface: activeRepositorySurface,
                    })}
                    onclick={(event) => {
                      event.preventDefault();
                      activateRepositorySurface(activeRepositorySurface);
                    }}
                    ><span
                      >{projectBreadcrumbSurfaceLabel(
                        activeRepositorySurface,
                      )}</span
                    ></Breadcrumb.Link
                  >
                {:else}
                  <Breadcrumb.Page
                    ><span
                      >{projectBreadcrumbSurfaceLabel(
                        activeRepositorySurface,
                      )}</span
                    ></Breadcrumb.Page
                  >
                {/if}
              </Breadcrumb.Item>
            {/if}
          {:else if activeProjectSurface !== "activity"}
            <Breadcrumb.Separator />
            <Breadcrumb.Item>
              {#if selectedTask || selectedPullRequest || selectedProjectCommit || selectedProjectPath}
                <Breadcrumb.Link
                  href={projectRouteToHash({
                    kind: "project",
                    coordinate: selectedProject.address.coordinate,
                    surface: activeProjectSurface,
                  })}
                  onclick={(event) => {
                    event.preventDefault();
                    openProjectBreadcrumbSurface(activeProjectSurface);
                  }}
                  ><span
                    >{projectBreadcrumbSurfaceLabel(activeProjectSurface)}</span
                  ></Breadcrumb.Link
                >
              {:else}
                <Breadcrumb.Page
                  ><span
                    >{projectBreadcrumbSurfaceLabel(activeProjectSurface)}</span
                  ></Breadcrumb.Page
                >
              {/if}
            </Breadcrumb.Item>
          {/if}
          {#if selectedTask}
            <Breadcrumb.Separator />
            <Breadcrumb.Item>
              <Breadcrumb.Page
                ><span>{selectedTask.title}</span></Breadcrumb.Page
              >
            </Breadcrumb.Item>
          {:else if selectedPullRequest}
            <Breadcrumb.Separator />
            <Breadcrumb.Item>
              <Breadcrumb.Page
                ><span>{selectedPullRequest.title}</span></Breadcrumb.Page
              >
            </Breadcrumb.Item>
          {:else if selectedProjectCommit}
            <Breadcrumb.Separator />
            <Breadcrumb.Item>
              <Breadcrumb.Page
                ><span>{selectedProjectCommit.subject}</span></Breadcrumb.Page
              >
            </Breadcrumb.Item>
          {:else if selectedProjectPath}
            <Breadcrumb.Separator />
            <Breadcrumb.Item>
              <Breadcrumb.Page
                ><span>{selectedProjectPath}</span></Breadcrumb.Page
              >
            </Breadcrumb.Item>
          {/if}
        {:else if projectsOverviewSurface !== "projects"}
          <Breadcrumb.Separator />
          <Breadcrumb.Item>
            <Breadcrumb.Page
              ><span
                >{projectsBreadcrumbSurfaceLabel(projectsOverviewSurface)}</span
              ></Breadcrumb.Page
            >
          </Breadcrumb.Item>
        {/if}
      </Breadcrumb.List>
    </Breadcrumb.Root>
  </div>
{/snippet}

{#snippet registryBreadcrumb()}
  <div class="community-application__project-breadcrumb">
    <Breadcrumb.Root aria-label="Registry breadcrumb">
      <Breadcrumb.List>
        <Breadcrumb.Item>
          {#if registryRoute.page === "landing"}
            <Breadcrumb.Page>
              <PackageSearchIcon aria-hidden="true" />
              <span>Registry</span>
            </Breadcrumb.Page>
          {:else}
            <Breadcrumb.Link
              href={registryRouteToHash({ page: "landing" })}
              onclick={(event) => {
                event.preventDefault();
                navigateRegistry({ page: "landing" });
              }}
            >
              <PackageSearchIcon aria-hidden="true" />
              <span>Registry</span>
            </Breadcrumb.Link>
          {/if}
        </Breadcrumb.Item>
        {#if registryRoute.page !== "landing"}
          <Breadcrumb.Separator />
          <Breadcrumb.Item>
            {#if registryRoute.page === "directory"}
              <Breadcrumb.Page><span>Plugins</span></Breadcrumb.Page>
            {:else}
              <Breadcrumb.Link
                href={registryRouteToHash({ page: "directory" })}
                onclick={(event) => {
                  event.preventDefault();
                  navigateRegistry({ page: "directory" });
                }}><span>Plugins</span></Breadcrumb.Link
              >
            {/if}
          </Breadcrumb.Item>
        {/if}
        {#if registryRoute.page === "plugin"}
          {@const pluginRoute = registryRoute}
          <Breadcrumb.Separator />
          <Breadcrumb.Item>
            {#if pluginRoute.view === "reviews" || pluginRoute.version !== undefined}
              <Breadcrumb.Link
                href={registryRouteToHash({
                  page: "plugin",
                  pluginId: pluginRoute.pluginId,
                  ...(pluginRoute.version === undefined
                    ? {}
                    : { version: pluginRoute.version }),
                })}
                onclick={(event) => {
                  event.preventDefault();
                  navigateRegistry({
                    page: "plugin",
                    pluginId: pluginRoute.pluginId,
                    ...(pluginRoute.version === undefined
                      ? {}
                      : { version: pluginRoute.version }),
                  });
                }}
                ><span
                  >{registryBreadcrumbPluginName ?? pluginRoute.pluginId}</span
                ></Breadcrumb.Link
              >
            {:else}
              <Breadcrumb.Page
                ><span
                  >{registryBreadcrumbPluginName ?? pluginRoute.pluginId}</span
                ></Breadcrumb.Page
              >
            {/if}
          </Breadcrumb.Item>
          {#if pluginRoute.version !== undefined}
            {@const pluginVersion = pluginRoute.version}
            <Breadcrumb.Separator />
            <Breadcrumb.Item>
              {#if pluginRoute.view === "reviews"}
                <Breadcrumb.Link
                  href={registryRouteToHash({
                    page: "plugin",
                    pluginId: pluginRoute.pluginId,
                    version: pluginVersion,
                  })}
                  onclick={(event) => {
                    event.preventDefault();
                    navigateRegistry({
                      page: "plugin",
                      pluginId: pluginRoute.pluginId,
                      version: pluginVersion,
                    });
                  }}><span>{pluginVersion}</span></Breadcrumb.Link
                >
              {:else}
                <Breadcrumb.Page><span>{pluginVersion}</span></Breadcrumb.Page>
              {/if}
            </Breadcrumb.Item>
          {/if}
          {#if pluginRoute.view === "reviews"}
            <Breadcrumb.Separator />
            <Breadcrumb.Item>
              <Breadcrumb.Page
                ><span>Reactions &amp; reviews</span></Breadcrumb.Page
              >
            </Breadcrumb.Item>
          {/if}
        {/if}
      </Breadcrumb.List>
    </Breadcrumb.Root>
  </div>
{/snippet}

{#snippet projectChannelBreadcrumb()}
  {#if activeChannelProject}
    <div class="community-application__project-breadcrumb">
      <Breadcrumb.Root aria-label="Project channel breadcrumb">
        <Breadcrumb.List>
          <Breadcrumb.Item>
            <Breadcrumb.Link
              href="#/projects"
              onclick={(event) => {
                event.preventDefault();
                setDestination("projects", true);
              }}
            >
              <FolderKanbanIcon aria-hidden="true" />
              <span>Projects</span>
            </Breadcrumb.Link>
          </Breadcrumb.Item>
          <Breadcrumb.Separator />
          <Breadcrumb.Item>
            <Breadcrumb.Link
              href={projectRouteToHash({
                kind: "project",
                coordinate: activeChannelProject.address.coordinate,
                surface: "activity",
              })}
              onclick={(event) => {
                event.preventDefault();
                openChannelProjectSurface("activity");
              }}
            >
              <span>{activeChannelProject.name}</span>
            </Breadcrumb.Link>
          </Breadcrumb.Item>
          <Breadcrumb.Separator />
          <Breadcrumb.Item>
            <Breadcrumb.Page><span>#{activeRoom.name}</span></Breadcrumb.Page>
          </Breadcrumb.Item>
        </Breadcrumb.List>
      </Breadcrumb.Root>
    </div>
  {/if}
{/snippet}

{#snippet projectOverviewToggle()}
  <AppShell.Sidebar.Toggle
    bind:ref={projectOverviewToggleElement}
    shellController={shell}
    side="right"
    sidebarController={projectOverviewSidebar}
    sidebarName="project overview"
    label={shell.mobile.resolvedMode === "mobile"
      ? projectOverviewMobileActive
        ? "Close project overview sidebar"
        : "Open project overview sidebar"
      : projectOverviewShown && !releaseSheetOpen
        ? "Hide project overview"
        : "Show project overview"}
    onclick={() => {
      projectOverviewInitialized = true;
      if (releaseSheetOpen) {
        closeReleaseSurface();
        projectOverviewSidebar.expand();
        return;
      }
      if (projectOverviewSidebar.collapsed && !projectOverviewMobileActive)
        projectOverviewSidebar.close();
      lastAction = `${projectOverviewSidebar.closed ? "closed" : "opened"}-project-overview`;
    }}
  />
{/snippet}

{#snippet repositoryActionItems()}
  <DropdownMenu.Group>
    <DropdownMenu.Item onSelect={() => requestProjectDialog("repository")}>
      <FolderPlusIcon aria-hidden="true" />
      <span>Create new repository</span>
    </DropdownMenu.Item>
    <DropdownMenu.Item
      disabled={projectCatalog.projects.length === 0 ||
        projectCatalog.repositories.every(
          (repository) => repository.repositoryClass === "task-anchor",
        )}
      onSelect={() => requestProjectDialog("select-repository")}
    >
      <LinkIcon aria-hidden="true" />
      <span>Select existing repository</span>
    </DropdownMenu.Item>
  </DropdownMenu.Group>
{/snippet}

{#snippet repositoryActionMenu()}
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button
          {...props}
          type="button"
          variant="ghost"
          size="icon-sm"
          class="community-application__repository-add-trigger"
          aria-label="Add repository"
          title="Add repository"
          disabled={!authenticated || projectOperation !== ""}
        >
          <PlusIcon aria-hidden="true" />
        </Button>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content
      align="end"
      sideOffset={6}
      class="community-application__repository-add-menu"
    >
      {@render repositoryActionItems()}
    </DropdownMenu.Content>
  </DropdownMenu.Root>
{/snippet}

{#snippet projectChannelRepositoryAction()}
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button
          {...props}
          type="button"
          variant="outline"
          class="community-application__project-channel-repository-action"
          disabled={!authenticated || projectOperation !== ""}
        >
          <span class="community-application__project-channel-action-icon">
            <FolderPlusIcon aria-hidden="true" />
          </span>
          <span class="community-application__project-channel-action-copy">
            <strong>Add files</strong>
            <small>Add a repo.</small>
          </span>
        </Button>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content
      align="start"
      sideOffset={6}
      class="community-application__repository-add-menu"
    >
      {@render repositoryActionItems()}
    </DropdownMenu.Content>
  </DropdownMenu.Root>
{/snippet}

{#snippet projectRailStat(
  Icon: Component,
  label: string,
  value: string | number,
)}
  <Button
    type="button"
    variant="ghost"
    class="community-application__project-overview-item"
    data-active={projectRailItemActive(label) ? "" : undefined}
    aria-current={projectRailItemActive(label) ? "page" : undefined}
    onclick={() => selectProjectRailItem(label)}
  >
    <Icon data-icon="inline-start" aria-hidden="true" />
    <span>{label}</span>
    <span
      class="community-application__project-overview-count"
      title={String(value)}>{value}</span
    >
  </Button>
{/snippet}

{#snippet projectChannelRailItem(
  Icon: Component,
  label: string,
  value: string | number | undefined,
  onclick: () => void,
  active = false,
)}
  <Button
    type="button"
    variant="ghost"
    class="community-application__project-overview-item"
    data-active={active ? "" : undefined}
    aria-current={active ? "page" : undefined}
    {onclick}
  >
    <Icon data-icon="inline-start" aria-hidden="true" />
    <span>{label}</span>
    {#if value !== undefined}
      <span
        class="community-application__project-overview-count"
        title={String(value)}>{value}</span
      >
    {/if}
  </Button>
{/snippet}

{#snippet projectRepositoriesRail(selectedCoordinate: string)}
  <CommunityProjectsProjectRepositoriesRail
    repositories={projectCatalog.repositories}
    references={(selectedProject ?? selectedRepositoryProject)?.repositories ??
      []}
    {selectedCoordinate}
    channelName={(repository) =>
      (
        roomForProjectChannel(repository.channelId)?.name ??
        repository.channelId
      ).replace(/^#/, "")}
    plus={repositoryActionMenu}
    onSelectRepository={selectRepository}
    onSelectChannel={(repository) =>
      selectProjectChannelDestination(repository.channelId)}
  />
{/snippet}

{#snippet projectOverviewRail()}
  <AppShell.Sidebar
    side="right"
    sidebarController={projectOverviewSidebar}
    class="community-application__project-overview-sidebar"
    variant="rail"
    constraintPriority={100}
    label="Project overview sidebar"
    mobileLabel="Project overview"
    resizeLabel="Resize project overview sidebar"
  >
    <AppShell.Sidebar.Body>
      <nav
        class="community-application__project-overview"
        aria-label="Project overview"
      >
        {#if selectedTask}
          <div class="community-application__project-overview-heading">
            <strong>{selectedTask.title}</strong>
          </div>
          {#if workspace.currentMemberId}
            <Button
              type="button"
              variant="ghost"
              class="community-application__project-overview-action"
              disabled={!authenticated || projectOperation !== ""}
              onclick={() =>
                updateTaskAssignment(
                  selectedTask,
                  workspace.currentMemberId!,
                  !selectedTask.assignees.includes(workspace.currentMemberId!),
                )}
            >
              <UserRoundPlusIcon data-icon="inline-start" aria-hidden="true" />
              {selectedTask.assignees.includes(workspace.currentMemberId)
                ? "Unassign me"
                : "Assign to me"}
            </Button>
          {/if}
          <Button
            type="button"
            variant="ghost"
            class="community-application__project-overview-action"
            disabled={!authenticated || projectOperation !== ""}
            onclick={() =>
              updateTaskLifecycle(
                selectedTask,
                selectedTask.lifecycle === "closed" ? "open" : "closed",
              )}
          >
            <CircleCheckIcon data-icon="inline-start" aria-hidden="true" />
            {selectedTask.lifecycle === "closed" ? "Reopen task" : "Close task"}
          </Button>
          <p class="community-application__project-overview-label">Details</p>
          <CommunityProjectsTaskDetails task={selectedTask} />
        {:else if selectedPullRequest}
          <div class="community-application__project-overview-heading">
            <strong>{selectedPullRequest.title}</strong>
          </div>
          <Button
            type="button"
            variant="ghost"
            class="community-application__project-overview-action"
            disabled={!authenticated || projectOperation !== ""}
            onclick={() => requestProjectDialog("review")}
          >
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            Create review
          </Button>
          <p class="community-application__project-overview-label">Details</p>
          <CommunityProjectsReviewDetails pullRequest={selectedPullRequest} />
        {:else if selectedRepository}
          {@render projectRepositoriesRail(
            selectedRepository.address.coordinate,
          )}
          <CommunityProjectsRepositoryRail
            canMaintain={canMaintainRepository(
              allRooms,
              selectedRepository.channelId,
            )}
            onCreateReview={createReviewFromLog}
            defaultBranch={projectRepositoryCapabilities[
              selectedRepository.address.coordinate
            ]?.protection?.default_branch}
            branches={projectRepositoryBranches}
            surface={activeRepositorySurface}
            channel={roomForProjectChannel(selectedRepository.channelId)
              ?.name ?? selectedRepository.channelId}
            files={projectTree?.entries.length ?? 0}
            commits={projectCommits}
            tasks={selectedRepositoryTasks}
            reviews={selectedRepositoryPullRequests}
            taskFilter={taskListFilter}
            reviewFilter={reviewListFilter}
            showGitHub={selectedRepository.repositoryClass === "external" &&
              canManageForge}
            githubConnected={selectedRepositoryGitHubConnected}
            githubDisabled={projectOperation !== ""}
            onGitHub={() =>
              requestProjectDialog(
                selectedRepositoryGitHubConnected
                  ? "manage-github"
                  : "connect-github",
              )}
            onSelect={selectProjectRailItem}
          />
        {:else if selectedProject}
          <div class="community-application__project-overview-heading">
            <strong
              >{activeProjectSurface === "activity"
                ? selectedProject.name
                : activeProjectSurface === "reviews"
                  ? "Reviews"
                  : activeProjectSurface[0]!.toUpperCase() +
                    activeProjectSurface.slice(1)}</strong
            >
            {#if activeProjectSurface === "tasks"}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Create task"
                title="Create task"
                disabled={!authenticated || projectOperation !== ""}
                onclick={() => requestProjectDialog("task")}
                ><PlusIcon aria-hidden="true" /></Button
              >
            {:else if activeProjectSurface === "reviews"}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                class="community-application__project-overview-review-create"
                aria-label="Create review"
                title="Create review"
                disabled={!authenticated ||
                  projectOperation !== "" ||
                  selectedProjectRepositories.every(
                    (repository) =>
                      repository.repositoryClass === "task-anchor",
                  )}
                onclick={() => requestProjectDialog("review")}
                ><PlusIcon aria-hidden="true" /></Button
              >
            {:else if activeProjectSurface === "channels"}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Add channel"
                title="Add channel to project"
                disabled={!authenticated ||
                  projectOperation !== "" ||
                  selectedProject.event.pubkey !== workspace.currentMemberId}
                onclick={() =>
                  requestProjectDialog(
                    "channel",
                    selectedProject.address.coordinate,
                  )}><PlusIcon aria-hidden="true" /></Button
              >
            {/if}
          </div>
          {@render projectRepositoriesRail("")}
          {#if activeProjectSurface === "activity"}
            <p class="community-application__project-overview-label">Details</p>
            {@render projectRailStat(
              ListTodoIcon,
              "Tasks",
              projectWorkItems.tasks.length,
            )}
            {@render projectRailStat(
              GitPullRequestIcon,
              "Reviews",
              projectWorkItems.pullRequests.length,
            )}
          {:else if activeProjectSurface === "commits"}
            {@render projectRailStat(
              GitCommitHorizontalIcon,
              "Commits",
              projectCommitActivity.length,
            )}
          {:else if activeProjectSurface === "tasks"}
            {@render projectRailStat(
              ListTodoIcon,
              "Tasks",
              projectWorkItems.tasks.length,
            )}
            <CommunityProjectsRailStatusFilters
              kind="tasks"
              items={projectWorkItems.tasks}
              value={taskListFilter}
              onSelect={selectProjectRailItem}
            />
          {:else if activeProjectSurface === "reviews"}
            {@render projectRailStat(
              GitPullRequestIcon,
              "Reviews",
              projectWorkItems.pullRequests.length,
            )}
            <CommunityProjectsRailStatusFilters
              kind="reviews"
              items={projectWorkItems.pullRequests}
              value={reviewListFilter}
              onSelect={selectProjectRailItem}
            />
          {:else if activeProjectSurface === "channels"}
            {@render projectRailStat(
              HashIcon,
              "Channels",
              projectForgeBoundChannels(
                selectedProject,
                selectedProjectRepositories,
              ).length,
            )}
            {@render projectRailStat(
              GitBranchIcon,
              "Repositories",
              selectedProjectRepositories.filter(
                (repository) => repository.repositoryClass !== "task-anchor",
              ).length,
            )}
          {:else}
            {@render projectRailStat(
              UsersIcon,
              "Contributors",
              selectedProjectRoom?.memberCount ?? activeRoomMemberIds.length,
            )}
          {/if}
        {:else if activeChannelProject}
          {#if isPluginReleaseRoom}
            <div role="group" aria-label="Plugins">
              <div class="community-application__project-overview-heading">
                <strong>Plugins</strong>
              </div>
              {@render releaseOverviewItems()}
            </div>
          {/if}
          <div class="community-application__project-overview-heading">
            <strong>{activeChannelProject.name}</strong>
            {@render repositoryActionMenu()}
          </div>
          {@render projectChannelRailItem(
            ListTodoIcon,
            "Tasks",
            activeChannelProjectTasks.length,
            () => openChannelProjectSurface("tasks"),
          )}
          {@render projectChannelRailItem(
            GitPullRequestIcon,
            "Reviews",
            activeChannelProjectPullRequests.length,
            () => openChannelProjectSurface("reviews"),
          )}
          {@render projectChannelRailItem(
            GitCommitHorizontalIcon,
            "Commits",
            projectCommits.length,
            () => openChannelProjectSurface("commits"),
          )}
          {@render projectChannelRailItem(
            FilesIcon,
            "Files",
            projectTree?.entries.length ?? 0,
            () => openChannelProjectSurface("files"),
          )}
          {@render projectChannelRailItem(
            UsersIcon,
            "People",
            activeRoom.memberCount ?? activeRoomMemberIds.length,
            () => openChannelProjectSurface("contributors"),
          )}
          <p class="community-application__project-overview-label">Channels</p>
          {#each activeChannelProjectBindings as binding (binding.channelId)}
            {@const room = roomForProjectChannel(binding.channelId)}
            {@render projectChannelRailItem(
              CommunityProjectChannelIcon,
              room?.name ?? binding.channelId,
              undefined,
              () => selectProjectChannelDestination(binding.channelId),
              room?.id === activeRoom.id ||
                binding.channelId === activeRoom.groupId,
            )}
          {/each}
          {#if activeChannelProjectRepositories.some((repository) => repository.repositoryClass !== "task-anchor")}
            <p class="community-application__project-overview-label">
              Codebase
            </p>
            {#each activeChannelProjectRepositories.filter((repository) => repository.repositoryClass !== "task-anchor") as repository (repository.address.coordinate)}
              {@render projectChannelRailItem(
                GitBranchIcon,
                repository.name,
                undefined,
                () => selectRepository(repository),
              )}
            {/each}
          {/if}
        {:else}
          <div class="community-application__project-overview-heading">
            <strong
              >{projectsOverviewSurface === "activity"
                ? "Activity"
                : projectsOverviewSurface === "reviews"
                  ? "Reviews"
                  : projectsOverviewSurface[0]!.toUpperCase() +
                    projectsOverviewSurface.slice(1)}</strong
            >
            {#if projectsOverviewSurface === "projects"}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                class="community-application__project-overview-create"
                aria-label="Create project"
                title="Create project"
                disabled={!authenticated || projectOperation !== ""}
                onclick={() => requestProjectDialog("project")}
                ><PlusIcon aria-hidden="true" /></Button
              >
            {:else if projectsOverviewSurface === "repositories"}
              {@render repositoryActionMenu()}
            {:else if projectsOverviewSurface === "tasks"}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Create task"
                title="Create task"
                disabled={!authenticated ||
                  projectOperation !== "" ||
                  (projectCatalog.projects.length === 0 &&
                    projectCatalog.repositories.every(
                      (repository) =>
                        repository.repositoryClass === "task-anchor",
                    ))}
                onclick={() => requestProjectDialog("task")}
                ><PlusIcon aria-hidden="true" /></Button
              >
            {:else if projectsOverviewSurface === "reviews"}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Create review"
                title="Create review"
                disabled={!authenticated ||
                  projectOperation !== "" ||
                  projectCatalog.repositories.every(
                    (repository) =>
                      repository.repositoryClass === "task-anchor",
                  )}
                onclick={() => requestProjectDialog("review")}
                ><PlusIcon aria-hidden="true" /></Button
              >
            {:else if projectsOverviewSurface === "channels"}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Add channel"
                title="Add channel to project"
                disabled={!authenticated ||
                  projectOperation !== "" ||
                  !projectCatalog.projects.some(
                    (project) =>
                      project.event.pubkey === workspace.currentMemberId,
                  )}
                onclick={() => requestProjectDialog("channel")}
                ><PlusIcon aria-hidden="true" /></Button
              >
            {/if}
          </div>
          {#if projectsOverviewSurface === "tasks"}
            {@render projectRailStat(
              ListTodoIcon,
              "Tasks",
              projectWorkItems.tasks.length,
            )}
            <CommunityProjectsRailStatusFilters
              kind="tasks"
              items={projectWorkItems.tasks}
              value={taskListFilter}
              onSelect={selectProjectRailItem}
            />
          {:else if projectsOverviewSurface === "reviews"}
            {@render projectRailStat(
              GitPullRequestIcon,
              "Reviews",
              projectWorkItems.pullRequests.length,
            )}
            <CommunityProjectsRailStatusFilters
              kind="reviews"
              items={projectWorkItems.pullRequests}
              value={reviewListFilter}
              onSelect={selectProjectRailItem}
            />
          {:else if projectsOverviewSurface === "repositories"}
            {@render projectRailStat(
              GitBranchIcon,
              "Repositories",
              projectCatalog.repositories.length,
            )}
            {@render projectRailStat(
              ListTodoIcon,
              "Active tasks",
              projectWorkItems.tasks.filter(
                (task) =>
                  task.lifecycle !== "closed" && task.lifecycle !== "applied",
              ).length,
            )}
            {@render projectRailStat(
              GitPullRequestIcon,
              "Open reviews",
              projectWorkItems.pullRequests.filter(
                (review) =>
                  review.lifecycle === "open" || review.lifecycle === "draft",
              ).length,
            )}
          {:else if projectsOverviewSurface === "channels"}
            {@render projectRailStat(HashIcon, "Channels", projectChannelCount)}
            {@render projectRailStat(
              FolderKanbanIcon,
              "Projects",
              listedProjects.length,
            )}
            {@render projectRailStat(
              GitBranchIcon,
              "Repositories",
              projectCatalog.repositories.length,
            )}
          {:else if projectsOverviewSurface === "projects"}
            {@render projectRailStat(
              FolderKanbanIcon,
              "Projects",
              listedProjects.length,
            )}
            {@render projectRailStat(
              GitBranchIcon,
              "Repositories",
              projectCatalog.repositories.length,
            )}
            {@render projectRailStat(HashIcon, "Channels", projectChannelCount)}
          {:else}
            {@render projectRailStat(
              FolderKanbanIcon,
              "Projects",
              listedProjects.length,
            )}
            {@render projectRailStat(
              GitBranchIcon,
              "Repositories",
              projectCatalog.repositories.length,
            )}
            {@render projectRailStat(HashIcon, "Channels", projectChannelCount)}
            {@render projectRailStat(
              ListTodoIcon,
              "Tasks",
              projectWorkItems.tasks.length,
            )}
            {@render projectRailStat(
              GitPullRequestIcon,
              "Reviews",
              projectWorkItems.pullRequests.length,
            )}
          {/if}
        {/if}
      </nav>
    </AppShell.Sidebar.Body>
  </AppShell.Sidebar>
{/snippet}

{#snippet projectSheet()}
  <AppShell.SurfaceLayer
    open={projectSheetOpen}
    label={selectedProjectSurface ?? "Project"}
    coverPanelIds={["right"]}
    suspendPanelIds={shell.mobile.resolvedMode === "mobile"
      ? []
      : [PROJECT_OVERVIEW_PANEL_ID]}
    mobilePlacement={projectSheetMobileRoot ? "root" : "active-lane"}
    dismissLabel={`Back to ${projectSheetProject?.name ?? "project"}`}
    onDismiss={closeProjectSurface}
    class="community-application__project-sheet-layer"
    style={projectSheetLayerStyle}
  >
    <AppShell.SurfaceLayer.Header
      class="community-application__project-sheet-header"
    >
      <h1>
        {projectSurfaceTitle(selectedProjectSurface ?? "people")}
      </h1>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Close project surface"
        title="Close project surface"
        onclick={closeProjectSurface}
      >
        <XIcon aria-hidden="true" />
      </Button>
    </AppShell.SurfaceLayer.Header>
    <AppShell.SurfaceLayer.Body
      class="community-application__project-sheet-body"
    >
      {#if selectedProjectSurface}
        <CommunityProjects
          view={selectedProjectSurface}
          projects={projectCatalog.projects}
          {...projectSheetProject === undefined
            ? {}
            : { selectedProject: projectSheetProject }}
          {...communityProjectsSelectedRepository === undefined
            ? {}
            : { selectedRepository: communityProjectsSelectedRepository }}
          repositories={projectSheetRepositories}
          repositoryOptions={projectCatalog.repositories}
          repositoryCapabilities={projectRepositoryCapabilities}
          tasks={projectWorkItems.tasks}
          {taskListFilter}
          pullRequests={projectWorkItems.pullRequests}
          {reviewListFilter}
          {...selectedTask === undefined ? {} : { selectedTask }}
          {...selectedPullRequest === undefined ? {} : { selectedPullRequest }}
          commits={projectCommits}
          commitActivity={projectCommitActivity}
          commitBranch={projectCommitBranch}
          commitsMore={projectCommitsMore}
          commitsLoadingMore={projectCommitsLoadingMore}
          onLoadMoreCommits={loadMoreProjectCommits}
          onVisibleCommitCursorChange={replaceVisibleProjectRouteCursor}
          repositoryBranches={projectRepositoryBranches}
          selectedRepositoryBranch={projectVisibleRepositoryBranch}
          {...selectedProjectCommit === undefined
            ? {}
            : { selectedCommit: selectedProjectCommit }}
          {...projectCommitDetail === undefined
            ? {}
            : { selectedCommitDetail: projectCommitDetail }}
          sourceError={projectSourceError}
          {...projectTree === undefined ? {} : { tree: projectTree }}
          {...projectOwners === undefined ? {} : { owners: projectOwners }}
          selectedPath={selectedProjectPath}
          {...projectBlob === undefined ? {} : { blob: projectBlob }}
          {...projectPullRequestDiff === undefined
            ? {}
            : { pullRequestDiff: projectPullRequestDiff }}
          pullRequestDiffError={projectPullRequestDiffError}
          members={communityIdentityMembersFromState(
            workspace.members,
            community.state.agents,
          )}
          rooms={presentationRooms}
          communityEmojis={community.state.settings.customEmojis}
          {...workspace.currentMemberId === undefined
            ? {}
            : { currentMemberId: workspace.currentMemberId }}
          reviewPreferenceStore={defaultProjectReviewPreferenceStore}
          {...projectReviewPreferenceScope === undefined
            ? {}
            : { reviewPreferenceScope: projectReviewPreferenceScope }}
          loading={projectLoading || communityStartupPending}
          {...cachedProjectCatalogAt === undefined
            ? {}
            : { cachedCatalogAt: cachedProjectCatalogAt }}
          error={projectError}
          operation={projectOperation}
          canCollaborate={authenticated}
          showNavigation={false}
          bodyElement="section"
          onOpenProfile={openProfile}
          onMessageMember={messageMember}
          onWaveMember={waveMember}
          onCreateRepository={createRepository}
          onUpdateProject={updateProject}
          onAttachRepository={attachRepository}
          onSelectRepository={selectRepository}
          onSelectFilesRepository={selectProjectFilesRepository}
          onCreateTask={createTask}
          onSelectTask={selectProjectSheetTask}
          onCloseTask={() => (selectedTaskId = "")}
          onUpdateTaskLifecycle={updateTaskLifecycle}
          onCreatePullRequest={createPullRequest}
          onLoadRepositoryRefs={loadReviewRepositoryRefs}
          onSelectRepositoryBranch={selectRepositoryBranch}
          onLoadRepositoryPathCommit={loadRepositoryPathCommit}
          onLoadRepositoryCommit={loadRepositoryCommit}
          onSelectPullRequest={(pullRequest) => {
            selectedPullRequestId = pullRequest.root.id;
            projectPullRequestDiff = undefined;
          }}
          onClosePullRequest={closeProjectPullRequest}
          onSubmitPullRequestReview={publishPullRequestReview}
          onRequestPullRequestReview={requestPullRequestReview}
          onMergePullRequest={mergePullRequest}
          onOpenPeople={openRepositoryPeople}
          onSaveProtection={saveRepositoryProtection}
          onUpdatePullRequestLifecycle={updatePullRequestLifecycle}
          onAddPullRequestComment={publishPullRequestComment}
          onAddInlineComment={publishInlineComment}
          onTogglePullRequestCommentReaction={togglePullRequestCommentReaction}
          onSelectCommit={selectProjectCommit}
          onCloseCommit={closeProjectCommit}
          onSelectPath={selectRepositoryPath}
          onRetry={repairProjectMembership}
        />
      {/if}
    </AppShell.SurfaceLayer.Body>
  </AppShell.SurfaceLayer>
{/snippet}

{#snippet releaseMessageSupplement(message: CommunityMessageModel)}
  {#if hasRegistry && message.sourceEvent && parseNip29ReleaseEvent(message.sourceEvent) && registryOptions?.source.loadReleaseInspection}
    <RegistryReleaseDisclosure
      eventId={message.id}
      source={registryOptions.source}
      onOpenPlugin={(pluginId) =>
        navigateRegistry({ page: "plugin", pluginId })}
    />
  {/if}
{/snippet}

{#key communityQueryProviderKey}
  <QueryClientProvider client={communityQueryClient}>
    <CommunityAppShell
      controller={shell}
      {displayMode}
      {mobileBreakpoint}
      {...desktopMinMainWidth === undefined ? {} : { desktopMinMainWidth }}
      {canNavigateBack}
      {canNavigateForward}
      onNavigateBack={() => navigateHistory(-1)}
      onNavigateForward={() => navigateHistory(1)}
      {...isRegistryDestination
        ? { headerCenter: registryBreadcrumb }
        : isProjectsDestination
          ? {
              headerCenter: projectBreadcrumb,
              headerEnd: projectOverviewToggle,
            }
          : activeChannelProject && usesRoomToolbar
            ? {
                headerCenter: projectChannelBreadcrumb,
                headerEnd: projectOverviewToggle,
              }
            : isPluginReleaseRoom
              ? { headerEnd: releaseOverviewToggle }
              : {}}
      data-last-action={lastAction}
      data-community-status={community.state.status}
      data-community-cache-freshness={community.state.cache.freshness}
      data-community-content-sync={community.state.contentSync?.phase ??
        "legacy"}
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
            bind:sectionOpen={navigationSectionOpen}
            {...activeItemId === undefined ? {} : { activeItemId }}
            compact={navigationCompact}
            countsUpdating={community.state.contentSync?.phase ===
              "background" ||
              community.state.contentSync?.phase === "partial-error"}
            onSelect={select}
            onSearch={(query) => {
              searchOpen = true;
              updateAppSearchInput(query);
            }}
            onSectionAction={handleSectionAction}
            onItemAction={handleItemAction}
            customSections={community.state.navigation.sections.map(
              (section) => ({
                id: section.id,
                label: section.name,
              }),
            )}
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
                member={displayMember}
                presence={community.state.presence?.members[displayMember.id]
                  ?.status ?? "unknown"}
                presencePreference={community.state.presence?.preference ??
                  "auto"}
                presenceDisabled={!authenticated ||
                  !community.actions.setPresencePreference ||
                  !community.state.presence ||
                  community.state.presence.status === "unavailable" ||
                  community.state.presence.status === "loading" ||
                  community.state.presence.pending}
                communityName={currentCommunity?.name ?? "Community"}
                {...activeConnection?.relayUrl === undefined
                  ? {}
                  : { communityUrl: activeConnection.relayUrl }}
                {authenticated}
                accountRemembered={applicationAccount !== undefined}
                {signingOut}
                compact={navigationCompact}
                connectionStatus={community.state.status}
                canManageCommunity={activeRoom.permissions?.manageMembers
                  .state === "enabled"}
                canSendFeedback={extensions.feedback !== undefined}
                onPresenceChange={async (presence) => {
                  await community.actions.setPresencePreference?.(
                    presence === "online" ? "auto" : presence,
                  );
                  lastAction = `presence:${presence}`;
                }}
                onAction={(action) => {
                  if (action === "sign-in") void runAuthenticated(() => {});
                  if (action === "sign-out")
                    void signOutCurrentIdentity().catch((cause) =>
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
                    void runAuthenticated(() =>
                      openRepositoryPeople(activeRoom.id),
                    );
                  }
                  if (action === "send-feedback") void extensions.feedback?.();
                }}
              />
            {/snippet}
          </CommunityNavigation>
        {/if}
      </AppShell.Sidebar>

      <AppShell.Main class="community-application__main">
        {#if shell.mobile.resolvedMode === "mobile" && !usesRoomToolbar}
          <AppShell.Toolbar role="group" label="Application navigation">
            {@render mobileNavigationControls()}
            {#if isProjectsDestination || isPluginReleaseRoom}
              <div class="community-application__mobile-toolbar-end">
                {@render mobileRightSidebarToggle()}
              </div>
            {/if}
          </AppShell.Toolbar>
        {/if}

        {#if activeDestination === "agents"}
          <AppShell.Toolbar
            label="Agents page header"
            class="community-application__agents-toolbar"
          >
            <div class="community-application__toolbar-start">
              {#if shell.mobile.resolvedMode === "mobile"}
                {@render mobileNavigationControls()}
              {:else if navigationCompact}
                <AppShell.Sidebar.Toggle side="left" sidebarName="navigation" />
              {/if}
              <h1 class="community-application__toolbar-title">Agents</h1>
            </div>
            <div class="community-application__toolbar-actions">
              {#if community.state.agents && community.actions.agents}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Refresh agents"
                  title="Refresh agents"
                  disabled={community.state.agents.status === "loading"}
                  onclick={() => void community.actions.agents!.refresh()}
                >
                  <RefreshIcon aria-hidden="true" />
                </Button>
              {/if}
            </div>
          </AppShell.Toolbar>
        {/if}

        {#if isProjectsDestination && selectedPullRequest}
          <AppShell.Toolbar
            label="Review navigation"
            class="community-application__project-review-toolbar"
          >
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              class="community-application__project-review-back"
              aria-label="Back to reviews"
              title="Back to reviews"
              onclick={closeProjectPullRequest}
            >
              <ArrowLeftIcon aria-hidden="true" />
            </Button>
            <div class="community-application__project-review-heading">
              <h1>
                {selectedPullRequest.title}
                <span>#{selectedPullRequest.root.id.slice(0, 8)}</span>
              </h1>
              <p>
                Review opened <CommunityRelativeTime
                  timestamp={selectedPullRequest.createdAt}
                />
              </p>
            </div>
          </AppShell.Toolbar>
        {/if}

        {#if isProjectsDestination && !selectedTask && !selectedPullRequest}
          <AppShell.Toolbar
            label="Project sections"
            class="community-application__project-toolbar"
          >
            <CommunityApplicationProjectToolbarNav
              scope={selectedRepository
                ? "repository"
                : selectedProject
                  ? "project"
                  : "overview"}
              {canNavigateBack}
              onHistoryBack={() => navigateHistory(-1)}
              onCloseRepository={closeRepository}
              onBackToProjects={() => setDestination("projects", true)}
              onSearch={() => (searchOpen = true)}
            />
            <Tabs.Root
              value={selectedRepository
                ? activeRepositorySurface
                : selectedProject
                  ? activeProjectSurface
                  : projectsOverviewSurface}
            >
              <Tabs.List
                class="community-application__project-tab-list"
                aria-label={selectedRepository
                  ? `${selectedRepository.name} sections`
                  : selectedProject
                    ? `${selectedProject.name} sections`
                    : "Project sections"}
              >
                {#each selectedRepository ? selectedRepositoryTabs : selectedProject ? selectedProjectTabs : projectOverviewTabs as tab (tab.value)}
                  <Tabs.Trigger
                    class="community-application__project-tab-trigger"
                    value={tab.value}
                    onclick={() => {
                      if (selectedRepository)
                        openRepositorySurface(tab.value as ProjectForgeSurface);
                      else if (selectedProject)
                        openProjectSurface(tab.value as ProjectForgeSurface);
                      else
                        openProjectsOverviewSurface(
                          tab.value as ProjectForgeOverviewSurface,
                        );
                    }}
                  >
                    {tab.label}
                  </Tabs.Trigger>
                {/each}
              </Tabs.List>
            </Tabs.Root>
          </AppShell.Toolbar>
        {/if}

        {#if isProjectsDestination && unavailableProjectRoute}
          <section class="community-application__project-route-unavailable">
            <Empty.Root role="status">
              <Empty.Header>
                <Empty.Media variant="icon">
                  <FolderKanbanIcon aria-hidden="true" />
                </Empty.Media>
                <Empty.Title>
                  {unavailableProjectRoute.kind === "project"
                    ? "Project is unavailable"
                    : "Repository is unavailable"}
                </Empty.Title>
                <Empty.Description>
                  The requested {unavailableProjectRoute.kind} was not found after
                  the project catalog finished loading. Its address remains in the
                  URL so the link can be retried.
                </Empty.Description>
              </Empty.Header>
              <Empty.Content>
                <Button
                  type="button"
                  variant="outline"
                  onclick={() => setDestination("projects", true)}
                >
                  Browse projects
                </Button>
              </Empty.Content>
            </Empty.Root>
          </section>
        {:else if isProjectsDestination}
          <CommunityProjects
            view={selectedRepository
              ? projectViewForSurface(activeRepositorySurface)
              : selectedProject
                ? activeProjectSurface
                : projectsOverviewSurface}
            projects={selectedRepositoryProject
              ? [selectedRepositoryProject]
              : selectedProject
                ? projectCatalog.projects
                : listedProjects}
            {...selectedProject === undefined ? {} : { selectedProject }}
            {...communityProjectsSelectedRepository === undefined
              ? {}
              : { selectedRepository: communityProjectsSelectedRepository }}
            repositories={selectedRepository
              ? [selectedRepository]
              : selectedProject
                ? selectedProjectRepositories
                : projectCatalog.repositories}
            repositoryOptions={projectCatalog.repositories}
            repositoryCapabilities={projectRepositoryCapabilities}
            activity={projectActivity}
            workItemEvents={projectWorkItems.events}
            tasks={selectedRepository
              ? selectedRepositoryTasks
              : projectWorkItems.tasks}
            {taskListFilter}
            {...selectedTask === undefined ? {} : { selectedTask }}
            pullRequests={selectedRepository
              ? selectedRepositoryPullRequests
              : projectWorkItems.pullRequests}
            {reviewListFilter}
            {...selectedPullRequest === undefined
              ? {}
              : { selectedPullRequest }}
            commits={projectCommits}
            commitActivity={projectCommitActivity}
            commitBranch={projectCommitBranch}
            commitsMore={projectCommitsMore}
            commitsLoadingMore={projectCommitsLoadingMore}
            onLoadMoreCommits={loadMoreProjectCommits}
            onVisibleCommitCursorChange={replaceVisibleProjectRouteCursor}
            repositoryBranches={projectRepositoryBranches}
            selectedRepositoryBranch={projectVisibleRepositoryBranch}
            {...selectedProjectCommit === undefined
              ? {}
              : { selectedCommit: selectedProjectCommit }}
            {...projectCommitDetail === undefined
              ? {}
              : { selectedCommitDetail: projectCommitDetail }}
            sourceError={projectSourceError}
            {...projectTree === undefined ? {} : { tree: projectTree }}
            {...projectOwners === undefined ? {} : { owners: projectOwners }}
            selectedPath={selectedProjectPath}
            {...projectBlob === undefined ? {} : { blob: projectBlob }}
            {...projectPullRequestDiff === undefined
              ? {}
              : { pullRequestDiff: projectPullRequestDiff }}
            pullRequestDiffError={projectPullRequestDiffError}
            members={communityIdentityMembersFromState(
              workspace.members,
              community.state.agents,
            )}
            rooms={presentationRooms}
            communityEmojis={community.state.settings.customEmojis}
            {...workspace.currentMemberId === undefined
              ? {}
              : { currentMemberId: workspace.currentMemberId }}
            reviewPreferenceStore={defaultProjectReviewPreferenceStore}
            {...projectReviewPreferenceScope === undefined
              ? {}
              : { reviewPreferenceScope: projectReviewPreferenceScope }}
            loading={projectLoading || communityStartupPending}
            {...cachedProjectCatalogAt === undefined
              ? {}
              : { cachedCatalogAt: cachedProjectCatalogAt }}
            error={projectError}
            operation={projectOperation}
            canCollaborate={authenticated}
            {canManageForge}
            {...projectDialogRequest === undefined
              ? {}
              : { dialogRequest: projectDialogRequest }}
            showNavigation={false}
            showReviewHeader={false}
            onSelectView={(surface) => {
              if (selectedRepository)
                openRepositorySurface(surface as ProjectForgeSurface);
              else if (selectedProject)
                openProjectSurface(surface as ProjectForgeSurface);
              else
                openProjectsOverviewSurface(
                  surface as ProjectForgeOverviewSurface,
                );
            }}
            onBack={() => {
              if (canNavigateBack) navigateHistory(-1);
              else if (selectedRepository) closeRepository();
              else setDestination("projects", true);
            }}
            onSelectProject={selectProject}
            onSelectRepository={selectRepository}
            onSelectFilesRepository={selectProjectFilesRepository}
            onSelectChannel={selectProjectChannelDestination}
            onOpenProfile={openProfile}
            onMessageMember={messageMember}
            onWaveMember={waveMember}
            onCreateProject={createProject}
            onUpdateProject={updateProject}
            onCreateRepository={createRepository}
            onAttachRepository={attachRepository}
            onLoadGitHubConnections={loadGitHubConnections}
            onCreateGitHubConnection={createGitHubConnection}
            onUpdateGitHubConnection={updateGitHubConnection}
            onRevalidateGitHubConnection={revalidateGitHubConnection}
            onLoadGitHubRepositories={loadGitHubRepositories}
            onAttachGitHubRepository={attachGitHubRepository}
            onCreateTask={createTask}
            onSelectTask={selectProjectTask}
            onCloseTask={() => (selectedTaskId = "")}
            onUpdateTaskAssignment={updateTaskAssignment}
            onManageTaskAssignments={openTaskAssignmentCommand}
            onAddTaskComment={publishTaskComment}
            onUpdateTaskLifecycle={updateTaskLifecycle}
            onCreatePullRequest={createPullRequest}
            onLoadRepositoryRefs={loadReviewRepositoryRefs}
            onSelectRepositoryBranch={selectRepositoryBranch}
            onLoadRepositoryPathCommit={loadRepositoryPathCommit}
            onLoadRepositoryCommit={loadRepositoryCommit}
            onSelectPullRequest={(pullRequest) => {
              selectedPullRequestId = pullRequest.root.id;
              projectPullRequestDiff = undefined;
            }}
            onClosePullRequest={closeProjectPullRequest}
            onSubmitPullRequestReview={publishPullRequestReview}
            onRequestPullRequestReview={requestPullRequestReview}
            onMergePullRequest={mergePullRequest}
            onOpenPeople={openRepositoryPeople}
            onSaveProtection={saveRepositoryProtection}
            onUpdatePullRequestLifecycle={updatePullRequestLifecycle}
            onAddPullRequestComment={publishPullRequestComment}
            onAddInlineComment={publishInlineComment}
            onTogglePullRequestCommentReaction={togglePullRequestCommentReaction}
            onSelectCommit={selectProjectCommit}
            onCloseCommit={closeProjectCommit}
            onSelectPath={selectRepositoryPath}
            onRetry={repairProjectMembership}
          />
        {:else if isRegistryDestination}
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
              showBreadcrumb={false}
              onRouteChange={navigateRegistry}
              onActiveEntryChange={(entry) => (registryBreadcrumbEntry = entry)}
              onOpenMemberProfile={openProfile}
              onMessageMember={messageMember}
              onWaveMember={waveMember}
            />
          {:else}
            <AppShell.Body layout="regions" label="Plugin registry">
              <AppShell.Body.Content label="Registry content">
                <section class="community-application__registry-empty">
                  <PackageSearchIcon aria-hidden="true" />
                  <h1>Plugin registry is not configured</h1>
                  <p>
                    Provide <code>registryOptions</code> with a catalog source,
                    or use the legacy <code>registry</code> snippet override.
                  </p>
                </section>
              </AppShell.Body.Content>
            </AppShell.Body>
          {/if}
        {:else if activeDestination === "agents"}
          <CommunityApplicationAgentsHost
            agentsAvailable={Boolean(
              community.state.agents && community.actions.agents,
            )}
            members={workspace.members}
            memberResults={community.state.memberDirectory.results}
            onSearchMembers={(query) =>
              void community.actions.searchMembers(query)}
            bind:adding={agentCreatorOpen}
            model={community.state.agents}
            onProfile={(pubkey) =>
              openAgentProfile(pubkey, { kind: "overview" })}
            onActivity={(pubkey) =>
              openAgentActivity(pubkey, { kind: "overview" })}
            {...ownedAgentDirectoryActions(community.actions.agents!)}
            rooms={presentationRooms.map((room) => ({
              id: room.id,
              ...(room.groupId ? { groupId: room.groupId } : {}),
              name: room.name,
              isProjectChannel: room.isProjectChannel === true,
              canManage: room.permissions?.manageMembers.state === "enabled",
            }))}
            onAddAgentToRoom={async (roomId, pubkey) => {
              await community.actions.addMember(roomId, pubkey);
              await community.actions.agents!.refresh();
            }}
            ownerPubkey={community.state.authentication.pubkey ?? ""}
            onRefresh={() => community.actions.agents!.refresh()}
            onClearHistory={() => community.actions.agents!.clearHistory()}
            showPageHeader={false}
            showBodyDescription
          />
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
          <CommunityApplicationSettings
            model={community.state.settings}
            section={settingsSection}
            account={applicationAuthentication?.account?.()}
            accountConfig={applicationAuthentication?.config?.()}
            accountActions={applicationAuthentication?.accountActions?.()}
            accountResumeAction={applicationAuthentication?.resumeAccountAction?.()}
            accountAuthenticationState={applicationAuthentication?.status?.()}
            accountActiveExternalSigner={applicationAuthentication?.activeExternalSigner?.()}
            accountBusy={applicationAuthentication?.status?.() ===
              "restoring" ||
              applicationAuthentication?.status?.() === "redirecting"}
            accountMessage={applicationAuthentication?.status?.() ===
            "reconnect-required"
              ? "Reconnect the Nostr signer before an action needs a signature."
              : ""}
            onCopyPublicKey={(pubkey) => copyText(pubkey, "Public key copied")}
            onConnectGitHub={applicationAuthentication?.connectGitHub ===
            undefined
              ? undefined
              : () => applicationAuthentication.connectGitHub?.()}
            onSignOut={signOutCurrentIdentity}
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
        {:else if activeDestination === "pulse" && community.state.pulse && community.actions.pulse}
          <CommunityApplicationPulseHost
            model={community.state.pulse}
            currentMember={displayMember}
            rooms={presentationRooms}
            communityEmojis={community.state.settings.customEmojis}
            {...pulsePublishOperation === undefined
              ? {}
              : { publishOperation: pulsePublishOperation }}
            {...pulseComposerStatus === undefined
              ? {}
              : { composerStatus: pulseComposerStatus }}
            onSelectTab={(tab) => {
              const selectTab = () => community.actions.pulse!.selectTab(tab);
              return tab === "following" || tab === "liked" || tab === "mine"
                ? runAuthenticated(selectTab)
                : selectTab();
            }}
            onPublish={(submission, replyToEventId) =>
              runAuthenticated(() =>
                community.actions.pulse!.publish(submission, replyToEventId),
              )}
            onToggleLike={(eventId) =>
              runAuthenticated(() =>
                community.actions.pulse!.toggleLike(eventId),
              )}
            onShare={copyPulseLink}
            onOpenProfile={openProfile}
            onMessageMember={(member) => messageMember(member)}
            onRetry={() => {
              if (pulsePublishOperationEntry)
                return community.retry(pulsePublishOperationEntry[0]);
              return community.actions.pulse!.refresh();
            }}
            {...pulsePublishOperationEntry === undefined
              ? {}
              : {
                  onDismissError: () =>
                    community.dismissOperation(pulsePublishOperationEntry[0]),
                }}
          />
        {:else if activeDestination === "inbox"}
          <CommunityApplicationInboxHost
            model={inbox}
            conversationLoading={!inboxReady}
            {...inboxSurfaceOptions}
            readBoundary={{
              key: JSON.stringify([
                workspace.currentMemberId,
                inbox.activeItemId,
                inbox.messages.at(-1)?.id,
              ]),
              onRead: () => {
                const eventId = inbox.messages.findLast(
                  (message) =>
                    message.authorId !== workspace.currentMemberId &&
                    !message.activity,
                )?.id;
                const selected =
                  inbox.selectedItem ??
                  inbox.items.find((item) => item.id === inbox.activeItemId);
                if (eventId)
                  void community.actions.markRead(inbox.room.id, {
                    eventId,
                    ...(selected?.rootEventId
                      ? { threadId: selected.rootEventId }
                      : {}),
                  });
              },
            }}
            loading={community.state.contentSync?.phase === "initial"}
            rooms={presentationRooms}
            disabled={participationReadOnly}
            disabledReason={participationReadOnlyReason}
            canDeleteAny={inbox.room.permissions?.delete.state === "enabled"}
            historyUpdating={community.state.contentSync?.phase ===
              "background" ||
              community.state.contentSync?.phase === "partial-error"}
            onSelect={(id) => void community.actions.selectInboxItem?.(id)}
            onFilterChange={(filter, unreadOnly) =>
              community.actions.setInboxFilter?.(filter, unreadOnly)}
            onSend={(content) =>
              community.actions.sendInboxMessage
                ? community.actions.sendInboxMessage(content)
                : sendThreadReply(inbox.activeItemId, content)}
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
            onReply={(messageId) => community.actions.setReplyTarget(messageId)}
            onToggleReaction={react}
            onOpenProfile={openProfile}
            onOpenRoom={(roomId) => setDestination(roomId, true)}
            onMessageMember={messageMember}
            onCopyMessage={copyMessage}
            onCopyEvent={copyEvent}
            onDeleteMessage={deleteMessage}
            communityEmojis={community.state.settings.customEmojis}
            onCancelReply={() => community.actions.clearReplyTarget()}
          />
        {:else if activeDestination === "new-direct-message"}
          <CommunityApplicationDirectMessageHost
            recipients={selectedRecipients}
            buzzSupported={community.state.capabilities.buzzDirectMessages ??
              false}
            communityEmojis={community.state.settings.customEmojis}
            onChooseRecipients={() => {
              memberCommandTask = undefined;
              memberCommandMode = "select";
              memberCommandOpen = true;
            }}
            onRemoveRecipient={(member) =>
              (selectedRecipientIds = selectedRecipientIds.filter(
                (id) => id !== member.id,
              ))}
            onSend={sendNewDirectMessage}
          />
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
                {#if activeRoom.kind === "direct" && activeDirectMember}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="community-application__room-title-button"
                    aria-label={`View ${activeDirectMember.name}'s profile`}
                    onclick={() => openProfile(activeDirectMember)}
                  >
                    <CommunityMemberAvatar
                      member={activeDirectMember}
                      showPresence
                      decorative
                    />
                    <strong data-ui-part="room-title">{activeRoom.name}</strong>
                  </Button>
                {:else}
                  <strong data-ui-part="room-title">
                    {#if activeRoom.private}
                      <LockIcon data-icon="inline-start" aria-hidden="true" />
                    {:else if activeRoom.kind === "channel"}
                      {#if projectChannelRoomIds.has(activeRoom.id)}
                        <CommunityProjectChannelIcon data-icon="inline-start" />
                      {:else}
                        <HashIcon data-icon="inline-start" aria-hidden="true" />
                      {/if}
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
                {/if}
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
                  disabled={activeParticipationOperation?.status ===
                    "pending" ||
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
                    memberCommandMode =
                      activeRoom.kind !== "direct" &&
                      activeRoom.permissions?.manageMembers.state === "enabled"
                        ? "manage"
                        : "view";
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
              {#if shell.mobile.resolvedMode === "mobile"}
                {@render mobileRightSidebarToggle()}
              {/if}
            </div>
          </AppShell.Toolbar>

          <AppShell.Body layout="regions" label="Community workspace">
            <AppShell.Body.Content
              class="community-application__workspace-content"
              label={`${activeRoom.name} content`}
            >
              <div class="community-application__workspace-stack">
                <div class="community-application__workspace-layer">
                  <CommunityWorkspaceSurface
                    {...workspaceSurfaceOptions}
                    model={workspaceSurfaceModel}
                    historyLoading={activeRoomHistoryLoading}
                    historyUpdating={community.state.contentSync?.phase ===
                      "background" ||
                      community.state.contentSync?.phase === "partial-error"}
                    messageSupplement={releaseMessageSupplement}
                    readOnly={participationReadOnly}
                    readOnlyReason={participationReadOnlyReason}
                    showJoinAction={activeRoomJoinVisible}
                    communityEmojis={community.state.settings.customEmojis}
                    handlers={{
                      ...community.handlers,
                      onReadRoom: (roomId, through) => {
                        void community.actions
                          .markRead(roomId, through)
                          .catch((error) =>
                            toast.error(
                              error instanceof Error
                                ? error.message
                                : "Could not save read status",
                            ),
                          );
                      },
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
                        if (
                          activeRoom.kind === "direct" ||
                          activeRoom.kind === "forum"
                        )
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
                      onWaveMember: waveMember,
                      ...(extensions.activityLog === undefined
                        ? {}
                        : { onViewMemberActivity: viewMemberActivity }),
                      ...(activeRoom.kind === "direct"
                        ? {}
                        : { onCopyMessageLink: copyMessageLink }),
                      onCopyMessage: copyMessage,
                      onCopyEvent: copyEvent,
                      ...(extensions.editMessage === undefined
                        ? community.actions.editEvent === undefined
                          ? {}
                          : { onSaveMessageEdit: editMessage }
                        : { onEditMessage: extensions.editMessage }),
                      onDeleteMessage: deleteMessage,
                      ...(community.actions.reportEvent === undefined
                        ? {}
                        : { onReportMessage: reportMessage }),
                      onBrowseRooms: openRoomBrowser,
                      ...(activeRoomJoinVisible
                        ? {
                            onJoinRoom: (roomId: string) =>
                              requestRoomJoin({ ...activeRoom, id: roomId }),
                          }
                        : {}),
                      ...(authenticated &&
                      community.state.capabilities.manageGroup
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
                      onClearReplyTarget: () =>
                        community.actions.clearReplyTarget(),
                    }}
                  />
                </div>
              </div>
            </AppShell.Body.Content>
          </AppShell.Body>
        {/if}
      </AppShell.Main>

      <AppShell.Sidebar
        side="right"
        class="community-application__standard-right-sidebar"
        constraintPriority={0}
        constrainedPresentation="replace-main"
        label={`${sidePanelTitle} sidebar`}
        mobileLabel={sidePanelTitle}
        resizeLabel={`Resize ${sidePanelTitle.toLowerCase()} sidebar`}
        closeable
        hidden={activePanel.kind === "none"}
      >
        {#key communityApplicationPanelKey(activePanel)}
          {#if activePanel.kind !== "none"}
            {#if activePanel.kind === "profile"}
              <AppShell.Sidebar.Header>
                <strong>Profile</strong>
                <AppShell.Sidebar.Close onclick={closeSidePanel} />
              </AppShell.Sidebar.Header>
              <AppShell.Sidebar.Body>
                {#if selectedAgent && community.actions.agents}
                  <CommunityAgentProfile
                    members={workspace.members}
                    memberResults={community.state.memberDirectory.results}
                    onSearchMembers={(query) =>
                      void community.actions.searchMembers(query)}
                    agent={selectedAgent}
                    personas={community.state.agents?.personas ?? []}
                    ownerName={memberById(
                      workspace.members,
                      selectedAgent.ownerPubkey,
                    ).name}
                    onOpenOwner={(pubkey) =>
                      openProfile(memberById(workspace.members, pubkey))}
                    rooms={presentationRooms}
                    {...community.state.agents?.presence[selectedAgent.pubkey]
                      ? {
                          presence:
                            community.state.agents.presence[
                              selectedAgent.pubkey
                            ],
                        }
                      : {}}
                    working={community.state.agents?.working[
                      selectedAgent.pubkey
                    ] === true}
                    canMessage={community.state.capabilities.directMessages}
                    connected={community.state.status === "connected"}
                    onMessage={() =>
                      messageMember(communityAgentMember(selectedAgent))}
                    onFollow={(following) =>
                      community.actions.agents!.setFollow(
                        selectedAgent.pubkey,
                        following,
                      )}
                    onActivity={() => openAgentActivity(selectedAgent.pubkey)}
                    onCopy={() =>
                      copyText(selectedAgent.pubkey, "Public key copied")}
                    onOpenChannel={(id) => setDestination(id, true)}
                    onAddChannel={async (id) => {
                      await community.actions.addMember(
                        id,
                        selectedAgent.pubkey,
                      );
                      await community.actions.agents!.refresh();
                    }}
                    onRemoveChannel={async (id) => {
                      await community.actions.removeMember(
                        id,
                        selectedAgent.pubkey,
                      );
                      await community.actions.agents!.refresh();
                    }}
                    onSaveAgent={(input) =>
                      community.actions.agents!.saveAgent(input)}
                    onUnlinkPersona={(fallbackName) =>
                      community.actions.agents!.unlinkAgent(
                        selectedAgent.pubkey,
                        fallbackName,
                      )}
                    onDeletePersona={(slug) =>
                      community.actions.agents!.deletePersona(slug)}
                    runtime={community.state.agents?.runtime?.[
                      selectedAgent.pubkey
                    ]}
                    memories={community.state.agents?.memories?.[
                      selectedAgent.pubkey
                    ]}
                    processing={community.state.agents?.processing?.[
                      selectedAgent.pubkey
                    ]}
                    onLoadProcessing={community.actions.agents?.loadProcessing
                      ? () =>
                          community.actions.agents!.loadProcessing!(
                            selectedAgent.pubkey,
                          )
                      : undefined}
                    onSetProcessing={community.actions.agents?.setProcessing
                      ? (enabled, revision) =>
                          community.actions.agents!.setProcessing!(
                            selectedAgent.pubkey,
                            enabled,
                            revision,
                          )
                      : undefined}
                    onLoadRuntime={() =>
                      community.actions.agents!.loadRuntime(
                        selectedAgent.pubkey,
                      )}
                    onSaveRuntime={(defaults) =>
                      community.actions.agents!.saveRuntime(
                        selectedAgent.pubkey,
                        defaults,
                      )}
                    onLoadMemories={(filter) =>
                      community.actions.agents!.loadMemories(
                        selectedAgent.pubkey,
                        filter.channelId,
                        filter,
                      )}
                    onActOnMemory={(input) =>
                      community.actions.agents!.actOnMemory(
                        selectedAgent.pubkey,
                        input,
                      )}
                  />
                {:else if selectedProfile}
                  <CommunityMemberProfile
                    member={selectedProfile}
                    onCopyPublicKey={() =>
                      copyText(selectedProfile.id, "Public key copied")}
                    onMessage={() => messageMember(selectedProfile)}
                    onWave={() => waveMember(selectedProfile)}
                    {...extensions.follow === undefined
                      ? {}
                      : {
                          onFollow: () =>
                            runMemberExtension("follow", selectedProfile),
                        }}
                  />
                {:else}
                  <div
                    class="community-application__panel-status"
                    role="status"
                  >
                    Profile unavailable
                  </div>
                {/if}
              </AppShell.Sidebar.Body>
            {:else if activePanel.kind === "agent-activity"}
              <AppShell.Sidebar.Header>
                <Button
                  variant="ghost"
                  size="sm"
                  onclick={() => {
                    if (canNavigateBack) navigateHistory(-1);
                    else if (activePanel.kind === "agent-activity")
                      openAgentProfile(activePanel.agentPubkey);
                  }}><ArrowLeftIcon aria-hidden="true" />Back to profile</Button
                >
                <AppShell.Sidebar.Close onclick={closeSidePanel} />
              </AppShell.Sidebar.Header>
              <AppShell.Sidebar.Body scrollable={false}>
                {#if community.state.agents && community.actions.agents}
                  <CommunityAgentActivity
                    model={community.state.agents}
                    rooms={presentationRooms}
                    members={workspace.members}
                    onOpenRequest={agentContextNavigation.openActivityRequest}
                    onLatest={() => {
                      if (activePanel.kind === "agent-activity")
                        return community.actions.agents!.openActivity(
                          activePanel.agentPubkey,
                          activePanel.activityContext ?? activePanel.channelId,
                        );
                    }}
                    onLoadOlder={() =>
                      community.actions.agents!.loadOlderActivity()}
                    onClearHistory={async () => {
                      if (activePanel.kind === "agent-activity")
                        await community.actions.agents!.clearHistory(
                          activePanel.agentPubkey,
                        );
                    }}
                    {...agentRuntimeActions(community.actions.agents!)}
                  />
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
              <AppShell.Sidebar.Body scrollable={false}>
                {#if visibleThread}
                  <CommunityThreadPanel
                    virtualize
                    thread={visibleThread}
                    {...community.state.threadHistory
                      ? { history: community.state.threadHistory }
                      : {}}
                    {...community.state.threadPresentation
                      ? { presentation: community.state.threadPresentation }
                      : {}}
                    {...community.actions.updateTimelinePresentation
                      ? {
                          onPresentationChange:
                            community.actions.updateTimelinePresentation,
                        }
                      : {}}
                    {...community.actions.loadOlderHistory
                      ? {
                          onLoadOlder: () =>
                            community.actions.loadOlderHistory!({
                              roomId: activeRoom.id,
                              rootEventId: visibleThread!.rootMessageId,
                            }),
                        }
                      : {}}
                    {...community.actions.loadNewerHistory
                      ? {
                          onLoadLatest: () =>
                            community.actions.loadNewerHistory!({
                              roomId: activeRoom.id,
                              rootEventId: visibleThread!.rootMessageId,
                            }),
                        }
                      : {}}
                    readBoundary={{
                      key: JSON.stringify([
                        workspace.currentMemberId,
                        activeRoom.id,
                        visibleThread.rootMessageId,
                        visibleThread.messages.at(-1)?.id,
                      ]),
                      onRead: () => {
                        const eventId = visibleThread?.messages.findLast(
                          (message) =>
                            message.authorId !== workspace.currentMemberId,
                        )?.sourceEvent?.id;
                        if (eventId && visibleThread)
                          void community.actions.markRead(activeRoom.id, {
                            eventId,
                            threadId: visibleThread.rootMessageId,
                          });
                      },
                    }}
                    activityContext={activityOrigin()}
                    members={presentationWorkspace.members}
                    agents={composerAgents}
                    rooms={presentationRooms}
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
                            community.retry(
                              activeParticipationOperationEntry[0],
                            ),
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
                    onWaveMember={waveMember}
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
                      ? community.actions.editEvent === undefined
                        ? {}
                        : { onSaveMessageEdit: editMessage }
                      : { onEditMessage: extensions.editMessage }}
                    onDeleteMessage={deleteMessage}
                    {...community.actions.reportEvent === undefined
                      ? {}
                      : { onReportMessage: reportMessage }}
                  />
                {:else}
                  <CommunitySkeleton
                    layout="messages"
                    label="Loading thread"
                    padded
                  />
                {/if}
              </AppShell.Sidebar.Body>
            {:else if detailsRoom?.kind === "channel" || detailsRoom?.kind === "forum"}
              {#key `${workspace.activeCommunityId}:${workspace.currentMemberId}:${detailsRoom.id}`}
                <CommunityChannelSettings
                  room={detailsRoom}
                  members={workspace.members}
                  {...detailsCanvas && detailsRoom
                    ? {
                        canvas: detailsCanvas,
                        initialCanvasContent: detailsCanvasInitialContent ?? "",
                        onLoadCanvas: () =>
                          community.actions.loadCanvas!(detailsRoom.id),
                        onSaveCanvas: async (
                          content: string,
                          expectedEventId: string | null,
                        ) => {
                          await community.actions.saveCanvas!(
                            detailsRoom.id,
                            content,
                            expectedEventId,
                          );
                          void communityQueryClient.invalidateQueries({
                            queryKey: communityProjectQueryKeys.channelCanvas(
                              communityQueryScope,
                              detailsRoom.id,
                            ),
                          });
                        },
                      }
                    : {}}
                  description={activeDestination === "inbox"
                    ? (inbox.room.description ?? "Community channel")
                    : (workspace.details?.description ??
                      detailsRoom.description ??
                      "Community channel")}
                  canArchive={extensions.archive !== undefined}
                  writerPolicySupported={community.state.capabilities
                    .writeRestrictedRooms === true}
                  groupInvitesSupported={community.state.capabilities
                    .groupInvites === true &&
                    community.actions.createGroupInvite !== undefined}
                  onClose={closeSidePanel}
                  onAction={(action) => {
                    lastAction = `channel-settings:${action}`;
                    if (
                      action === "edit-type" ||
                      action === "edit-visibility" ||
                      action === "edit-posting"
                    )
                      openRoomEditor(
                        detailsRoom.kind === "forum" ? "forum" : "channel",
                        "edit",
                      );
                    if (action === "members") {
                      memberCommandMode =
                        detailsRoom.permissions?.manageMembers.state ===
                        "enabled"
                          ? "manage"
                          : "view";
                      memberCommandOpen = true;
                    }
                    if (action === "copy-channel-id")
                      void copyText(
                        detailsRoom.id,
                        `${detailsRoom.kind === "forum" ? "Forum" : "Channel"} ID copied`,
                      );
                    if (action === "create-invite") {
                      groupInviteMode = "create";
                      groupInviteOpen = true;
                    }
                    if (action === "leave-channel") confirmation = "leave";
                    if (action === "delete-channel") confirmation = "delete";
                    if (action === "archive-channel")
                      void extensions.archive?.(detailsRoom.id);
                  }}
                />
              {/key}
            {:else}
              <AppShell.Sidebar.Header>
                <strong>{sidePanelTitle}</strong>
                <AppShell.Sidebar.Close onclick={closeSidePanel} />
              </AppShell.Sidebar.Header>
              <AppShell.Sidebar.Body>
                {#if detailsRoom && workspace.details}
                  <CommunityDetails
                    onOpenProfile={openProfile}
                    onMessageMember={messageMember}
                    onWaveMember={waveMember}
                    room={detailsRoom}
                    details={workspace.details}
                    members={workspace.members}
                  />
                {:else}
                  <CommunitySkeleton layout="details" label="Loading details" />
                {/if}
              </AppShell.Sidebar.Body>
            {/if}
          {/if}
        {/key}
      </AppShell.Sidebar>
      {#if isPluginReleaseRoom}
        {#if !activeChannelProject}
          {@render releaseOverviewRail()}
        {/if}
        {@render releaseSheet()}
      {/if}
      {#if isProjectsDestination || (activeChannelProject && usesRoomToolbar)}
        {@render projectOverviewRail()}
        {@render projectSheet()}
      {/if}
    </CommunityAppShell>

    {#if !isProjectsDestination && activeChannelProject && usesRoomToolbar}
      <CommunityProjects
        view="overview"
        projects={[activeChannelProject]}
        selectedProject={activeChannelProject}
        repositories={activeChannelProjectRepositories}
        repositoryOptions={projectCatalog.repositories}
        repositoryCapabilities={projectRepositoryCapabilities}
        members={communityIdentityMembersFromState(
          workspace.members,
          community.state.agents,
        )}
        rooms={presentationRooms}
        communityEmojis={community.state.settings.customEmojis}
        {...workspace.currentMemberId === undefined
          ? {}
          : { currentMemberId: workspace.currentMemberId }}
        operation={projectOperation}
        canCollaborate={authenticated}
        {...projectDialogRequest === undefined
          ? {}
          : { dialogRequest: projectDialogRequest }}
        showNavigation={false}
        showContent={false}
        onCreateRepository={createRepository}
        onUpdateProject={updateProject}
        onAttachRepository={attachRepository}
      />
    {/if}

    {#if activeConnection}
      <CommunityRelaySettings
        bind:open={relaySettingsOpen}
        connection={activeConnection}
        cache={community.state.cache}
        {...relayOperation === undefined ? {} : { operation: relayOperation }}
        onSave={(relayUrl) =>
          community.actions.updateRelayUrl(
            activeConnection.communityId,
            relayUrl,
          )}
        onReset={() =>
          community.actions.resetRelayUrl(activeConnection.communityId)}
        onClearCache={() => clearCommunityCaches(activeConnection.communityId)}
      />
    {/if}

    <CommunityRoomEditor
      bind:open={roomEditorOpen}
      mode={roomEditorMode}
      roomKind={roomEditorKind}
      retentionSupported={community.state.capabilities.configurableRetention ??
        false}
      writerPolicySupported={community.state.capabilities
        .writeRestrictedRooms === true}
      initial={roomEditorMode === "edit"
        ? {
            name: activeRoom.name,
            description: activeRoom.description ?? "",
            visibility: activeRoom.private
              ? ("private" as const)
              : ("public" as const),
            lifecycle: activeRoom.lifecycle ?? ("ongoing" as const),
            postingPolicy: activeRoom.postingPolicy ?? ("standard" as const),
          }
        : { name: roomEditorInitialName }}
      onSave={saveRoom}
    />

    <CommunityRoomBrowser
      bind:open={roomBrowserOpen}
      rooms={presentationRooms}
      initialKind={roomBrowserKind}
      canCreate={authenticated &&
        hasCommunityConnection &&
        (roomBrowserKind === "forum"
          ? community.state.capabilities.forums
          : community.state.capabilities.channels)}
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
      onLeave={(room) =>
        void leaveRoom(room).catch((cause) =>
          toast.error(
            cause instanceof Error ? cause.message : "Could not leave room",
          ),
        )}
      onCreate={(kind, name) => {
        void runAuthenticated(() => {
          roomBrowserOpen = false;
          openRoomEditor(kind, "create", name);
        });
      }}
    />

    <CommunityApplicationMemberCommand
      bind:open={memberCommandOpen}
      mode={memberCommandMode}
      room={memberCommandRoom}
      members={workspace.members}
      results={community.state.memberDirectory.results}
      groupMemberIds={memberCommandMemberIds}
      currentMemberId={workspace.currentMemberId}
      selectedIds={selectedRecipientIds}
      task={memberCommandTask}
      canSetRoles={community.state.capabilities.memberRoles === true &&
        community.actions.setMemberRoles !== undefined}
      onSearch={(query) => void community.actions.searchMembers(query)}
      onSelect={selectMember}
      onRemove={(member) => {
        if (memberCommandMode === "select")
          selectedRecipientIds = selectedRecipientIds.filter(
            (id) => id !== member.id,
          );
        else
          void runAuthenticated(() =>
            community.actions.removeMember(memberCommandRoom.id, member.id),
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
      onSetRoles={setMemberRoles}
      onConfirm={memberCommandMode === "select"
        ? () => void updateSelectedTaskAssignments()
        : () => (memberCommandOpen = false)}
    />

    <CommunityGroupInviteDialog
      bind:open={groupInviteOpen}
      mode={groupInviteMode}
      {...groupInviteMode === "create" ? { roomName: activeRoom.name } : {}}
      onCreate={createGroupInvite}
      onJoin={joinWithInvite}
      onCopy={copyInvite}
    />

    <CommunitySearchCommand
      bind:open={searchOpen}
      query={appSearchInput}
      rooms={searchRooms}
      messages={searchMessages}
      members={searchMembers}
      authors={knownSearchMembers}
      {...searchScope === undefined ? {} : { scope: searchScope }}
      onQueryChange={updateAppSearchInput}
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
      canCreateChannel={hasCommunityConnection &&
        (!authenticated || community.state.capabilities.manageGroup)}
      onCreateChannel={() => {
        searchOpen = false;
        void runAuthenticated(() => openRoomEditor("channel", "create"));
      }}
      onCreateAgent={() => {
        searchOpen = false;
        void runAuthenticated(async () => {
          agentCreatorOpen = true;
          setDestination("agents", true);
        });
      }}
    />

    <ConfirmDialog
      open={pendingParticipation !== undefined}
      onOpenChange={(open) => {
        if (!open && membershipJoinState !== "pending")
          cancelPendingParticipation();
      }}
      pending={membershipJoinState === "pending"}
      confirmDisabled={membershipJoinState !== "idle"}
      onConfirm={async () => {
        await joinForPendingParticipation();
        return false;
      }}
    >
      {#snippet title()}
        Join {pendingParticipation?.roomName ?? "this room"} to continue?
      {/snippet}
      {#snippet description()}
        Join this {pendingParticipation?.roomKind ?? "room"} before your
        {pendingParticipation?.actionKind ?? "action"} is sent. The original action
        will continue automatically after membership is confirmed.
      {/snippet}
      {#snippet confirmLabel()}
        {membershipJoinState === "pending"
          ? "Joining…"
          : membershipJoinState === "accepted"
            ? "Join requested"
            : `Join ${pendingParticipation?.roomKind === "forum" ? "Forum" : "Channel"}`}
      {/snippet}

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
    </ConfirmDialog>

    <ConfirmDialog
      open={confirmation !== null}
      onOpenChange={(open) => {
        if (!open) confirmation = null;
      }}
      destructive
      onConfirm={confirmRoomAction}
    >
      {#snippet title()}{confirmation === "delete"
          ? `Delete ${activeRoom.name}?`
          : `Leave ${activeRoom.name}?`}{/snippet}
      {#snippet description()}
        {confirmation === "delete"
          ? "The relay will remove this room if your identity has permission. This cannot be undone."
          : "You can rejoin later if the room remains public."}
      {/snippet}
      {#snippet confirmLabel()}
        {confirmation === "delete" ? "Delete" : "Leave"}
      {/snippet}
    </ConfirmDialog>

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
            error:
              statusOperation.failure?.relayReason ?? statusOperation.message!,
          }
        : {}}
      retryable={statusOperation?.failure?.retryable ?? false}
      onSave={saveStatus}
      onRetry={retryStatus}
      onDismissError={() => community.dismissOperation("settings:status")}
    />

    <Dialog.Root bind:open={sectionEditorOpen}>
      <DialogFrame size="form">
        {#snippet title()}{sectionEditorMode === "create"
            ? "New section"
            : "Rename section"}{/snippet}
        {#snippet description()}Organize rooms in a personal section. This
          preference is stored locally and through NIP-78 when signed in.{/snippet}

        <Field.Field
          ><Field.Label for="community-section-name">Name</Field.Label><Input
            id="community-section-name"
            bind:value={sectionName}
            required
          /></Field.Field
        >

        {#snippet footer()}<Button
            type="button"
            variant="outline"
            onclick={() => (sectionEditorOpen = false)}>Cancel</Button
          ><Button
            type="button"
            disabled={!sectionName.trim()}
            onclick={saveSection}>Save section</Button
          >{/snippet}
      </DialogFrame>
    </Dialog.Root>

    <Toaster position="bottom-right" />
  </QueryClientProvider>
{/key}

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

  .community-application__mobile-toolbar-end {
    display: flex;
    align-items: center;
    margin-inline-start: auto;
  }

  :global(.community-application__agents-toolbar[data-ui-part="toolbar"]) {
    gap: 0.5rem;
    min-height: 3.25rem;
    padding: 0.55rem 1rem;
    border-block-end: 0;
    background: color-mix(in srgb, var(--background) 97%, transparent);
  }

  .community-application__toolbar-title {
    margin: 0;
    font-size: var(--community-text-section);
    font-weight: 650;
    line-height: 1.35;
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
    font-size: var(--community-text-body);
  }

  .community-application__membership-error {
    color: var(--destructive);
  }

  .community-application__membership-status {
    color: var(--muted-foreground);
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
    min-width: min(100%, 13.125rem);
    flex: 1 1 13.125rem;
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
    font-size: var(--community-text-secondary);
  }

  .community-application__relay-action-label {
    margin-block-start: 0.25rem;
    font-size: var(--community-text-secondary);
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
    font-size: var(--community-text-body);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(
      .community-application__room-title-button[data-ui-component="button"]
    ) {
    min-width: 0;
    height: auto;
    justify-content: flex-start;
    gap: 0.35rem;
    padding: 0.125rem 0.375rem 0.125rem 0.125rem;
    border-radius: var(--radius-md, 0.5rem);
    font-weight: 550;
  }

  :global(.community-application__room-title-button[data-ui-component="button"])
    strong {
    min-width: 0;
  }

  .community-application__room-title strong :global(svg) {
    width: 0.875rem;
    height: 0.875rem;
    flex: none;
  }

  .community-application__toolbar-actions {
    margin-inline-start: auto;
  }

  :global(.community-application__main[data-ui-part="main"]) {
    position: relative;
  }

  .community-application__project-route-unavailable {
    display: grid;
    min-height: 100%;
    place-items: center;
    padding: 2rem;
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

  .community-application__workspace-stack,
  .community-application__workspace-layer {
    display: flex;
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
  }

  .community-application__workspace-stack {
    position: relative;
    flex: 1;
  }

  :global(.community-application__release-sheet-header h1) {
    margin: 0;
    font-size: var(--community-text-section);
    font-weight: 650;
  }

  :global(.community-application__project-sheet-header h1) {
    margin: 0;
    font-size: var(--community-text-section);
    font-weight: 650;
    text-transform: capitalize;
  }

  :global(
      .community-application__project-sheet-layer[data-mobile-placement="root"]
        [data-ui-part="surface-layer-surface"]
    ) {
    inset-block-start: var(--ui-shell-main-block-inset);
    inset-block-end: var(--ui-shell-main-block-inset);
  }

  :global(
      .community-application__project-sheet-body
        [data-ui-part="scroll-area-viewport"]
    ) {
    padding: 0;
  }

  :global(
      .community-application__release-sheet-body
        [data-ui-part="scroll-area-viewport"]
    ) {
    padding: 1rem;
  }

  .community-application__release-unavailable {
    margin: 0;
    padding: 1rem;
    color: var(--muted-foreground);
    font-size: var(--community-text-body);
  }

  .community-application__release-overview {
    display: grid;
    width: 100%;
    gap: 0.25rem;
    padding: 1rem 0.75rem;
  }

  .community-application__project-overview {
    display: grid;
    width: 100%;
    gap: 0.15rem;
    padding: 0.85rem 0.75rem;
  }

  :global(.community-application__project-overview-sidebar[data-side="right"]) {
    border-inline-start-color: transparent !important;
  }

  :global(
      .community-application__project-overview-sidebar
        [data-ui-part="sidebar-resize-indicator"]
    ) {
    background: transparent !important;
  }

  :global(.community-application__project-toolbar[data-ui-part="toolbar"]) {
    min-height: 3.25rem;
    gap: 0.45rem;
    border-block-end: 0;
    padding: 0.55rem 1rem;
    overflow: hidden;
    background: color-mix(in srgb, var(--background) 97%, transparent);
  }

  .community-application__project-breadcrumb {
    display: flex;
    width: 100%;
    min-width: 0;
    align-items: center;
    overflow: hidden;
    color: var(--muted-foreground);
  }

  :global(
      .community-application__project-breadcrumb [data-ui-part="breadcrumb"]
    ),
  :global(
      .community-application__project-breadcrumb
        [data-ui-part="breadcrumb-list"]
    ) {
    min-width: 0;
  }

  :global(
      .community-application__project-breadcrumb [data-ui-part="breadcrumb"]
    ) {
    width: 100%;
  }

  :global(
      .community-application__project-breadcrumb
        [data-ui-part="breadcrumb-list"]
    ) {
    width: 100%;
    flex-wrap: nowrap;
    justify-content: center;
    gap: 0.25rem;
    margin: 0;
    padding: 0;
    overflow: hidden;
  }

  :global(
      .community-application__project-breadcrumb
        [data-ui-part="breadcrumb-item"]
    ) {
    min-width: 0;
    flex: 0 1 auto;
  }

  :global(
      .community-application__project-breadcrumb
        [data-ui-part="breadcrumb-link"]
    ),
  :global(
      .community-application__project-breadcrumb
        [data-ui-part="breadcrumb-page"]
    ) {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.35rem;
    overflow: hidden;
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
    font-weight: 400;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(
      .community-application__project-breadcrumb
        [data-ui-part="breadcrumb-link"]
        > span
    ),
  :global(
      .community-application__project-breadcrumb
        [data-ui-part="breadcrumb-page"]
        > span
    ) {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(
      .community-application__project-breadcrumb
        [data-ui-part="breadcrumb-link"]:hover
    ) {
    color: var(--foreground);
  }

  :global(
      .community-application__project-breadcrumb
        [data-ui-part="breadcrumb-link"]
        svg
    ),
  :global(
      .community-application__project-breadcrumb
        [data-ui-part="breadcrumb-page"]
        svg
    ) {
    width: 0.85rem;
    height: 0.85rem;
    flex: none;
  }

  :global(
      .community-application__project-breadcrumb
        [data-ui-part="breadcrumb-separator"]
        svg
    ) {
    width: 0.7rem;
    height: 0.7rem;
  }

  :global(
      .community-application__project-review-toolbar[data-ui-part="toolbar"]
    ) {
    min-height: 4.75rem;
    flex: none;
    align-items: center;
    gap: 0.55rem;
    border-block-end: 1px solid var(--border);
    padding: 0.55rem 0.75rem;
    overflow: hidden;
    background: color-mix(in srgb, var(--background) 97%, transparent);
  }

  :global(
      .community-application__project-review-back[data-ui-component="button"]
    ) {
    flex: none;
    margin: 0;
    border-radius: 999px;
  }

  .community-application__project-review-heading {
    min-width: 0;
  }

  .community-application__project-review-heading h1,
  .community-application__project-review-heading p {
    margin: 0;
  }

  .community-application__project-review-heading h1 {
    overflow: hidden;
    font-size: var(--community-text-section);
    font-weight: 600;
    line-height: 1.4;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .community-application__project-review-heading h1 span {
    color: var(--muted-foreground);
    font-weight: 400;
  }

  .community-application__project-review-heading p {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    margin-top: 0.15rem;
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
  }

  :global(.community-application__project-toolbar [data-slot="tabs-root"]) {
    min-width: 0;
    overflow-x: auto;
  }

  :global(
      .community-application__project-toolbar
        .community-application__project-tab-list[data-slot="tabs-list"]
    ) {
    display: flex;
    width: max-content;
    height: auto;
    gap: 0.4rem;
    border-radius: 0;
    padding: 0;
    background: transparent;
    box-shadow: none;
  }

  :global(
      .community-application__project-toolbar
        .community-application__project-tab-trigger[data-slot="tabs-trigger"]
    ) {
    min-height: 1.75rem;
    flex: none;
    border: 0;
    border-radius: 999px;
    padding: 0.22rem 0.75rem;
    color: var(--muted-foreground);
    background: color-mix(in srgb, var(--muted) 35%, transparent);
    box-shadow: none;
    font-size: var(--community-text-secondary);
    font-weight: 500;
  }

  :global(
      .community-application__project-toolbar
        .community-application__project-tab-trigger[data-slot="tabs-trigger"][data-state="active"]
    ) {
    color: var(--foreground);
    background: var(--muted);
    box-shadow: none;
  }

  :global(
      .community-application__project-toolbar-back[data-ui-component="button"]
    ),
  :global(
      .community-application__project-toolbar-search[data-ui-component="button"]
    ) {
    border-radius: 999px;
    background: color-mix(in srgb, var(--muted) 35%, transparent);
  }

  .community-application__project-overview-heading {
    display: grid;
    min-height: 2rem;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.5rem;
    padding: 0 0.4rem 0.55rem;
    font-size: var(--community-text-secondary);
    font-weight: 500;
  }

  .community-application__project-overview-heading > strong {
    font-weight: 500;
  }

  :global(
      .community-application__project-overview-heading
        > [data-ui-component="button"]
    ) {
    width: 1.75rem;
    min-width: 1.75rem;
    height: 1.75rem;
    min-height: 1.75rem;
    margin-inline-end: -0.4rem;
  }

  :global(
      .community-application__project-overview-heading
        > [data-ui-component="button"]:hover:not(:disabled)
    ),
  :global(
      .community-application__project-overview-heading
        > [data-ui-component="button"]:focus-visible
    ) {
    color: var(--foreground);
    background: var(--muted);
  }

  .community-application__project-overview-label {
    margin: 0.9rem 0.4rem 0.3rem;
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
  }

  :global(
      .community-application__project-channel-repository-action[data-ui-component="button"]
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
      .community-application__repository-add-menu[data-ui-part="dropdown-menu-content"]
    ) {
    width: max-content;
    min-width: 15.5rem;
  }

  :global(
      .community-application__repository-add-menu
        [data-ui-part="dropdown-menu-item"]
    ) {
    white-space: nowrap;
  }

  .community-application__project-channel-action-icon {
    display: grid;
    width: 2.6rem;
    height: 2.6rem;
    place-items: center;
    border-radius: 50%;
    background: var(--muted);
  }

  .community-application__project-channel-action-icon :global(svg) {
    width: 1.15rem;
    height: 1.15rem;
  }

  .community-application__project-channel-action-copy {
    display: grid;
    gap: 0.15rem;
  }

  .community-application__project-channel-action-copy strong {
    font-size: var(--community-text-body);
    font-weight: 550;
  }

  .community-application__project-channel-action-copy small {
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
    font-weight: 400;
  }

  :global(
      .community-application__project-channel-repository-action[data-ui-component="button"]:hover:not(
          :disabled
        )
    )
    .community-application__project-channel-action-icon,
  :global(
      .community-application__project-channel-repository-action[data-ui-component="button"]:focus-visible
    )
    .community-application__project-channel-action-icon {
    color: var(--primary);
    background: color-mix(in srgb, var(--primary) 14%, var(--background));
  }

  :global(.community-application__project-overview-item code) {
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
  }

  .community-application__project-overview-count {
    max-width: 9rem;
    overflow: hidden;
    color: var(--muted-foreground);
    font-weight: 400;
    font-variant-numeric: tabular-nums;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(
      .community-application__project-overview-action[data-ui-component="button"]
    ) {
    width: 100%;
    justify-content: flex-start;
    color: var(--foreground);
    font-size: var(--community-text-secondary);
    font-weight: 450;
  }

  :global(
      .community-application__project-overview-action[data-ui-component="button"]:hover:not(
          :disabled
        )
    ),
  :global(
      .community-application__project-overview-action[data-ui-component="button"]:focus-visible
    ) {
    background-color: color-mix(in oklab, currentColor 10%, transparent);
  }

  :global(
      .community-application__project-overview-item[data-ui-component="button"]
    ) {
    display: grid;
    width: 100%;
    height: 1.75rem;
    grid-template-columns: 0.875rem minmax(0, 1fr) auto;
    justify-content: stretch;
    gap: 0.75rem;
    padding-inline: 0.5rem;
    color: var(--muted-foreground);
    font-size: var(--community-text-body);
    font-weight: 400;
    line-height: 1.25rem;
    text-align: start;
  }

  :global(
      .community-application__project-overview-item[data-ui-component="button"][data-active]
    ),
  :global(
      .community-application__project-overview-item[data-ui-component="button"]:hover:not(
          :disabled
        ):not(.community-projects-rail-status-filter):not(
          .community-projects-repository-rail-latest__label
        )
    ),
  :global(
      .community-application__project-overview-item[data-ui-component="button"]:focus-visible
    ) {
    background-color: color-mix(in oklab, currentColor 10%, transparent);
  }

  :global(.community-application__project-overview-item > span) {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  :global(.community-application__project-overview-item > svg) {
    width: 0.875rem;
    height: 0.875rem;
  }

  :global(
      .community-application__release-overview-item[data-ui-component="button"]
    ) {
    display: grid;
    width: 100%;
    height: 1.75rem;
    grid-template-columns: 0.875rem minmax(0, 1fr) auto;
    justify-content: stretch;
    gap: 0.75rem;
    padding-inline: 0.5rem;
    color: var(--muted-foreground);
    font-size: var(--community-text-body);
    font-weight: 400;
    line-height: 1.25rem;
    text-align: start;
    transition:
      background-color 120ms ease,
      color 120ms ease;
  }

  :global(
      .community-application__release-overview-item[data-ui-component="button"]:hover:not(
          :disabled
        )
    ),
  :global(
      .community-application__release-overview-item[data-ui-component="button"]:focus-visible
    ) {
    background-color: color-mix(in oklab, currentColor 10%, transparent);
  }

  :global(
      .community-application__release-overview-item[data-ui-component="button"][data-active="true"]
    ) {
    background: var(--accent);
    color: var(--accent-foreground);
  }

  :global(.community-application__release-overview-item > span) {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  :global(.community-application__release-overview-item > svg) {
    width: 0.875rem;
    height: 0.875rem;
  }

  :global(.community-application__release-overview-item > small) {
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
    font-variant-numeric: tabular-nums;
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
    font-size: var(--community-text-body);
  }

  @media (max-width: 64rem) {
    :global(
        .community-application__release-sheet-body
          [data-ui-part="scroll-area-viewport"]
      ) {
      padding: 0.75rem;
    }
  }
</style>
