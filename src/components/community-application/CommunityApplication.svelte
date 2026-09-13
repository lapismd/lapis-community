<script lang="ts">
  import CommunitySkeleton from "../community-skeleton/CommunitySkeleton.svelte";
  import { DialogFrame } from "@lapismd/design-core/forms/dialog";

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
  import CircleDotIcon from "@lucide/svelte/icons/circle-dot";
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
  import MessageCircleIcon from "@lucide/svelte/icons/message-circle";
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
  import type { CommunityAccountSession } from "../../auth/index.js";
  import { LAPIS_GROUPS, lapisGroupId } from "../../protocol/index.js";
  import {
    addRepositoryToProjectTemplate,
    buildProjectForgeActivity,
    buzzWorkItemFilters,
    createAssignmentTemplate,
    createBrowserProjectForgeCatalogStore,
    createBrowserProjectReviewPreferenceStore,
    createBuzzCommentTemplate,
    createDeletionTemplate,
    createProjectTaskAnchorTemplate,
    createProjectTemplate,
    createProjectReactionTemplate,
    createPullRequestTemplate,
    createPullRequestReviewTemplate,
    createRepositoryTemplate,
    createTaskTemplate,
    createWorkItemStatusTemplate,
    projectForgeBranchRefs,
    projectForgeBoundChannels,
    projectForgeChildChannels,
    projectForgeCatalogCacheKey,
    loadProjectRepositoryFileTree,
    updateProjectTemplate,
    GITHUB_REVIEW_COMMENT_REACTIONS,
    PROJECT_FORGE_KINDS,
    type ProjectForgeBlobResponse,
    type ProjectForgeCatalog,
    type ProjectForgeCatalogCacheScope,
    type ProjectForgeCommit,
    type ProjectForgeCommitResponse,
    type ProjectForgeCommitActivity,
    type ProjectForgeDataSource,
    type ProjectForgeGitHubConnection,
    type ProjectForgeGitHubConnectionInput,
    type ProjectForgeGitHubConnectionsResponse,
    type ProjectForgeGitHubRepositoriesResponse,
    type ProjectForgeGitHubRepository,
    type ProjectForgePullRequestDiff,
    type ProjectForgeProject,
    type ProjectForgeRepository,
    type ProjectForgeRepositoryCapabilities,
    type ProjectForgeRepositoryCapabilitiesByCoordinate,
    type ProjectForgeRef,
    type ProjectForgeRefsResponse,
    type ProjectForgeSession,
    type ProjectForgeSurface,
    type ProjectForgeOverviewSurface,
    type ProjectForgeTreeResponse,
    type ProjectForgeWorkItems,
    type ProjectTaskState,
    type PullRequestComment,
    type PullRequestReviewKind,
    type PullRequestState,
  } from "../../projects/index.js";
  import {
    registryRouteFromDestination,
    registryRouteFromHash,
    registryRouteToDestination,
    registryRouteToHash,
    type RegistryCatalogEntry,
    type RegistryReleaseReviewEntry,
    type RegistryRoute,
  } from "../../registry/index.js";
  import CommunityAppShell from "../community-app-shell/CommunityAppShell.svelte";
  import CommunityChannelSettings from "../community-channel-settings/CommunityChannelSettings.svelte";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityEmojiPicker from "../community-emoji-picker/CommunityEmojiPicker.svelte";
  import CommunityDetails from "../community-details/CommunityDetails.svelte";
  import CommunityDirectMessageComposer from "../community-direct-message-composer/CommunityDirectMessageComposer.svelte";
  import CommunityInbox from "../community-inbox/CommunityInbox.svelte";
  import type { CommunityInboxModel } from "../community-inbox/model.js";
  import CommunityGroupInviteDialog from "../community-group-invite-dialog/CommunityGroupInviteDialog.svelte";
  import CommunityNavigation from "../community-navigation/CommunityNavigation.svelte";
  import CommunityMemberCommand from "../community-member-command/CommunityMemberCommand.svelte";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import { provideCommunityMemberPresence } from "../community-member-hover-card/presence-context.js";
  import CommunityAgents from "../community-agents/CommunityAgents.svelte";
  import CommunityAgentProfile from "../community-agent-profile/CommunityAgentProfile.svelte";
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
  import { withStarredCommunityNavigationSection } from "../community-navigation/model.js";
  import CommunityProfileMenu from "../community-profile-menu/CommunityProfileMenu.svelte";
  import CommunityPulse from "../community-pulse/CommunityPulse.svelte";
  import CommunityProjects from "../community-projects/CommunityProjects.svelte";
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
  import CommunitySettings from "../community-settings/CommunitySettings.svelte";
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
    COMMUNITY_APPLICATION_SHELL_LAYOUT_STORAGE_KEY,
    COMMUNITY_APPLICATION_RELEASE_OVERVIEW_PANEL_ID,
    COMMUNITY_APPLICATION_PROJECT_OVERVIEW_PANEL_ID,
    agentLocationFromHash,
    agentLocationToHash,
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
    projectRouteFromHash,
    projectRouteToHash,
    type CommunityApplicationDestination,
    type CommunityApplicationHistory,
    type CommunityApplicationLocation,
    type CommunityApplicationMainSurface,
    type CommunityApplicationPanel,
    type CommunityApplicationProjectRoute,
  } from "./navigation.js";
  import { provideCommunityApplicationComposer } from "./composer-context.js";
  import { useCommunityApplicationAuthentication } from "./authentication-context.js";

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

  function repositorySupportsBrowsing(
    repository: ProjectForgeRepository,
    capabilities: ProjectForgeRepositoryCapabilities | undefined,
  ): boolean {
    if (capabilities !== undefined) return capabilities.browse;
    // Preserve compatibility with relays that predate capability discovery.
    return repository.repositoryClass === "hosted";
  }

  function repositorySourceLabel(repository: ProjectForgeRepository): string {
    const backend =
      projectRepositoryCapabilities[repository.address.coordinate]
        ?.content_backend;
    if (backend === "github") return "GitHub";
    if (backend === "walgit" || repository.repositoryClass === "hosted")
      return "Relay hosted";
    return "Remote";
  }

  const pluginReleaseGroupId = lapisGroupId(LAPIS_GROUPS.pluginReleases);

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
      shell.getPanel(COMMUNITY_APPLICATION_PROJECT_OVERVIEW_PANEL_ID) ??
      shell.createSidebar(
        COMMUNITY_APPLICATION_PROJECT_OVERVIEW_PANEL_ID,
        "right",
        {
          collapsed: initialShellLayout.projectOverview?.collapsed ?? false,
          closed: initialShellLayout.projectOverview?.closed ?? true,
          width: initialShellLayout.projectOverview?.width ?? 280,
          minWidth: 220,
          maxWidth: 440,
        },
      ),
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
      const agentRoute =
        typeof window === "undefined"
          ? null
          : agentLocationFromHash(window.location.hash);
      if (agentRoute) return agentRoute;
      const persisted = loadCommunityApplicationLocation(browserStorage);
      const projectHashRoute =
        typeof window === "undefined"
          ? null
          : projectRouteFromHash(window.location.hash);
      if (
        hasProjects &&
        typeof window !== "undefined" &&
        window.location.hash === "#/projects"
      ) {
        return {
          destination: "projects",
          panel: noCommunityApplicationPanel(),
        };
      }
      if (hasProjects && projectHashRoute !== null) {
        return locationForProjectRoute(projectHashRoute);
      }
      const registryHashRoute =
        typeof window === "undefined"
          ? null
          : registryRouteFromHash(window.location.hash);
      if (hasRegistry && registryHashRoute !== null) {
        return {
          destination: registryRouteToDestination(registryHashRoute),
          panel: noCommunityApplicationPanel(),
        };
      }
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
  let selectedRepositoryCoordinate = $state(
    initialApplicationLocation.projectRoute?.kind === "repository"
      ? initialApplicationLocation.projectRoute.coordinate
      : "",
  );
  let activeRepositorySurface = $state<ProjectForgeSurface>(
    initialApplicationLocation.projectRoute?.kind === "repository"
      ? initialApplicationLocation.projectRoute.surface
      : "overview",
  );
  let selectedPullRequestId = $state("");
  let selectedTaskId = $state("");
  let projectDialogRequest = $state<CommunityProjectsDialogRequest>();
  let projectDialogSequence = 0;
  let projectCommits = $state.raw<readonly ProjectForgeCommit[]>([]);
  let projectCommitBranch = $state("");
  let projectRepositoryBranches = $state.raw<readonly ProjectForgeRef[]>([]);
  let projectSelectedRepositoryBranch = $state("");
  let projectSelectedRepositoryBranchOwner = $state("");
  let projectCommitActivity = $state.raw<readonly ProjectForgeCommitActivity[]>(
    [],
  );
  let selectedProjectCommit = $state.raw<ProjectForgeCommit>();
  let projectCommitDetail = $state.raw<ProjectForgeCommitResponse>();
  let projectRepositoryCapabilities =
    $state.raw<ProjectForgeRepositoryCapabilitiesByCoordinate>({});
  let projectSourceError = $state("");
  let projectTree = $state.raw<ProjectForgeTreeResponse>();
  let projectBlob = $state.raw<ProjectForgeBlobResponse>();
  let selectedProjectPath = $state("");
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
      : projectCatalog.projects.find((project) =>
          project.repositories.some(
            (reference) =>
              reference.coordinate === selectedRepository.address.coordinate,
          ),
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
    selectedProjectSurface ?? "overview",
  );
  const projectActivity = $derived(
    buildProjectForgeActivity(
      projectCatalog,
      projectWorkItems,
      projectCommitActivity,
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
  const selectedTask = $derived(
    projectWorkItems.tasks.find((task) => task.root.id === selectedTaskId),
  );
  const projectOverviewTabs = [
    { value: "activity", label: "Activity" },
    { value: "projects", label: "Projects" },
    { value: "repositories", label: "Repositories" },
    { value: "tasks", label: "Tasks" },
    { value: "reviews", label: "Reviews" },
    { value: "channels", label: "Channels" },
  ] as const;
  const selectedProjectTabs = [
    { value: "overview", label: "Overview" },
    { value: "files", label: "Files" },
    { value: "commits", label: "Commits" },
    { value: "tasks", label: "Tasks" },
    { value: "reviews", label: "Review" },
    { value: "channels", label: "Channels" },
    { value: "contributors", label: "Contributors" },
  ] as const;
  const selectedRepositoryTabs = [
    { value: "overview", label: "Overview" },
    { value: "files", label: "Files" },
    { value: "commits", label: "Commits" },
    { value: "tasks", label: "Tasks" },
    { value: "reviews", label: "Review" },
  ] as const;
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
    members: () => workspace.members,
    rooms: () => allRooms,
    emojis: () => community.state.settings.customEmojis,
    onOpenMember: () => openProfile,
    onMessageMember: () => messageMember,
    onWaveMember: () => waveMember,
  });
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
  const projectSheetOpen = $derived(
    selectedProject !== undefined && selectedProjectSurface !== undefined,
  );
  const projectOverviewShown = $derived(
    !projectOverviewSidebar.closed && !projectOverviewSidebar.collapsed,
  );
  const releaseOverviewShown = $derived(
    activeMainSurface === undefined &&
      !releaseOverviewSidebar.closed &&
      !releaseOverviewSidebar.collapsed,
  );
  const workspaceSurfaceModel = $derived(
    selectedProjectRoom !== undefined
      ? {
          ...workspace,
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
  const applicationAccount = $derived(applicationAuthentication?.account?.());
  const activeRoomMemberIds = $derived(
    activeRoom.kind === "direct"
      ? (activeRoom.participantIds ?? [])
      : workspace.members
          .filter((member) => member.role !== undefined)
          .map((member) => member.id),
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
        ? [{ id: "inbox", label: "Inbox", kind: "inbox" as const }]
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
    sections: withStarredCommunityNavigationSection([
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
  const searchRooms = $derived(allRooms);
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
          activePanel.channelId,
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
    openPanel({ kind: "profile", memberId: member.id });
    lastAction = `opened-profile:${member.id}`;
  }

  function openAgentProfile(pubkey: string): void {
    const agent = community.state.agents?.agents.find(
      (entry) => entry.pubkey === pubkey,
    );
    if (agent) openProfile(communityAgentMember(agent));
    else closeSidePanel();
  }
  function openAgentActivity(pubkey: string, channelId?: string): void {
    openPanel({
      kind: "agent-activity",
      agentPubkey: pubkey,
      ...(channelId ? { channelId } : {}),
    });
  }

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
    if (!isPluginReleaseRoom || releaseOverviewInitialized) return;
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
    const lifecycleKey = [
      reloadRevision,
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
          if (catalogReady && event.type === "event")
            projectReloadRevision += 1;
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

  $effect(() => {
    const session = projectSession;
    const catalog = projectCatalog;
    const catalogSettled = projectCatalogSettled;
    const identity = projectIdentity ?? applicationAuthentication?.identity();
    const channelProjectCoordinate = isProjectsDestination
      ? undefined
      : activeChannelProjectCoordinate;
    const destinationActive =
      isProjectsDestination || channelProjectCoordinate !== undefined;
    const projectCoordinate =
      selectedProjectCoordinate ?? channelProjectCoordinate;
    const repositoryCoordinate = selectedRepositoryCoordinate;
    const surface = repositoryCoordinate
      ? activeRepositorySurface
      : selectedProjectSurface;
    const overviewSurface = projectsOverviewSurface;
    const pullRequestSurface = repositoryCoordinate
      ? activeRepositorySurface
      : (selectedProjectSurface ?? overviewSurface);
    const pullRequestId = selectedPullRequestId;
    const selectedCommitSha = selectedProjectCommit?.sha;
    const requestedRepositoryBranch = projectSelectedRepositoryBranch;
    const requestedRepositoryBranchOwner = projectSelectedRepositoryBranchOwner;
    if (!session || !catalogSettled) return;

    const openedSession = session;
    const controller = new AbortController();
    let unsubscribeWorkItems: (() => void) | undefined;
    let projectLoadStage = "Project work items";
    projectLoading = true;
    projectError = "";
    projectSourceError = "";
    projectRepositoryCapabilities = {};
    projectSourceRepositoryCoordinate = "";
    projectRepositoryRevision = "";
    projectBlob = undefined;
    projectPullRequestDiff = undefined;
    projectPullRequestDiffError = "";

    void (async () => {
      if (!destinationActive) return;

      const project = catalog.projects.find(
        (candidate) => candidate.address.coordinate === projectCoordinate,
      );
      const requestedRepository = catalog.repositories.find(
        (repository) => repository.address.coordinate === repositoryCoordinate,
      );
      const projectsToLoad = project ? [project] : catalog.projects;
      const repositoryCoordinates = new Set(
        projectsToLoad.flatMap((candidate) =>
          candidate.repositories.map((reference) => reference.coordinate),
        ),
      );
      const repositories = requestedRepository
        ? [requestedRepository]
        : project
          ? catalog.repositories.filter((repository) =>
              repositoryCoordinates.has(repository.address.coordinate),
            )
          : catalog.repositories;
      projectLoadStage = "Project work items";
      const workItemBundles = await Promise.all(
        repositories.map((repository) =>
          openedSession!.loadWorkItems(repository.event, controller.signal),
        ),
      );
      projectWorkItems = {
        tasks: workItemBundles.flatMap((bundle) => bundle.tasks),
        pullRequests: workItemBundles.flatMap((bundle) => bundle.pullRequests),
        events: workItemBundles.flatMap((bundle) => bundle.events),
      };

      const filters = repositories.flatMap((repository) =>
        buzzWorkItemFilters(repository.address.coordinate),
      );
      if (filters.length > 0) {
        let eoseCount = 0;
        projectLoadStage = "Live project work-item updates";
        unsubscribeWorkItems = await openedSession.subscribe(
          filters,
          (event) => {
            if (event.type === "eose") eoseCount += 1;
            if (eoseCount >= filters.length && event.type === "event") {
              projectReloadRevision += 1;
            }
          },
          controller.signal,
        );
      }

      const capabilityFailures: unknown[] = [];
      const capabilities: Record<string, ProjectForgeRepositoryCapabilities> =
        {};
      if (identity !== undefined) {
        await Promise.all(
          repositories
            .filter(
              (repository) => repository.repositoryClass !== "task-anchor",
            )
            .map(async (repository) => {
              try {
                const response = await openedSession!.loadCapabilities(
                  repository.address.coordinate,
                  controller.signal,
                );
                if (!controller.signal.aborted) {
                  capabilities[repository.address.coordinate] =
                    response.capabilities;
                }
              } catch (cause) {
                if (controller.signal.aborted) throw cause;
                capabilityFailures.push(cause);
              }
            }),
        );
      }
      if (controller.signal.aborted) return;
      projectRepositoryCapabilities = capabilities;
      const browsableRepositories = repositories.filter((repository) =>
        repositorySupportsBrowsing(
          repository,
          capabilities[repository.address.coordinate],
        ),
      );
      if (
        !project &&
        !requestedRepository &&
        (overviewSurface === "activity" || overviewSurface === "repositories")
      ) {
        const activityCommits = await Promise.all(
          browsableRepositories.map(async (repository) => {
            const owner = catalog.projects.find((candidate) =>
              candidate.repositories.some(
                (reference) =>
                  reference.coordinate === repository.address.coordinate,
              ),
            );
            if (!owner) return [];
            try {
              const response = await openedSession!.loadCommits(
                repository.address.coordinate,
                undefined,
                controller.signal,
              );
              return response.commits.map((commit) => ({
                projectCoordinate: owner.address.coordinate,
                repositoryCoordinate: repository.address.coordinate,
                commit,
              }));
            } catch {
              return [];
            }
          }),
        );
        projectCommitActivity = activityCommits.flat();
      } else if (!project && !requestedRepository) {
        projectCommitActivity = [];
      }

      const sourceRepository = requestedRepository
        ? browsableRepositories.find(
            (repository) =>
              repository.address.coordinate ===
              requestedRepository.address.coordinate,
          )
        : project
          ? browsableRepositories[0]
          : undefined;
      if (!sourceRepository) {
        projectCommits = [];
        projectCommitBranch = "";
        projectRepositoryBranches = [];
        projectCommitDetail = undefined;
        const capabilityFailure = capabilityFailures[0];
        projectSourceError =
          identity !== undefined &&
          (project !== undefined || requestedRepository !== undefined) &&
          repositories.some(
            (repository) => repository.repositoryClass !== "task-anchor",
          ) &&
          capabilityFailure !== undefined
            ? capabilityFailure instanceof Error
              ? capabilityFailure.message
              : "Repository capabilities could not be loaded"
            : "";
        projectTree = undefined;
        projectBlob = undefined;
      } else {
        const repository = sourceRepository.address.coordinate;
        projectSourceRepositoryCoordinate = repository;
        const readsRepository =
          surface === undefined ||
          surface === "overview" ||
          surface === "files" ||
          surface === "commits";

        if (
          surface === undefined ||
          surface === "overview" ||
          surface === "commits"
        ) {
          try {
            const commits = await openedSession.loadCommits(
              repository,
              undefined,
              controller.signal,
            );
            projectCommits = commits.commits;
          } catch (cause) {
            if (controller.signal.aborted) throw cause;
            projectCommits = [];
            if (surface === "commits") {
              projectSourceError =
                cause instanceof Error
                  ? cause.message
                  : "The commit history could not be loaded";
            }
          }
        }

        if (surface === "commits" && selectedCommitSha) {
          try {
            projectCommitDetail = await openedSession.loadCommit(
              repository,
              selectedCommitSha,
              controller.signal,
            );
          } catch (cause) {
            if (controller.signal.aborted) throw cause;
            projectCommitDetail = undefined;
            projectSourceError =
              cause instanceof Error
                ? cause.message
                : "The commit diff could not be loaded";
          }
        } else {
          projectCommitDetail = undefined;
          if (surface !== "commits") projectSourceError = "";
        }

        if (readsRepository) {
          try {
            const refs = await openedSession.loadRefs(
              repository,
              controller.signal,
            );
            const branches = projectForgeBranchRefs(refs);
            const requestedBranch =
              requestedRepositoryBranchOwner === repository
                ? branches.find(
                    (branch) => branch.name === requestedRepositoryBranch,
                  )
                : undefined;
            const selectedBranch = requestedBranch ?? branches[0];
            projectRepositoryBranches = branches;
            projectCommitBranch = selectedBranch?.name ?? refs.head?.name ?? "";
            if (
              projectSelectedRepositoryBranchOwner !== repository ||
              projectSelectedRepositoryBranch !== projectCommitBranch
            ) {
              projectSelectedRepositoryBranchOwner = repository;
              projectSelectedRepositoryBranch = projectCommitBranch;
            }
            const revision =
              selectedBranch?.name ??
              selectedBranch?.sha ??
              refs.head?.name ??
              refs.head?.sha;
            projectRepositoryRevision = revision ?? "";
            if (
              revision &&
              (surface === undefined ||
                surface === "overview" ||
                surface === "files")
            ) {
              let tree =
                surface === "files"
                  ? await loadProjectRepositoryFileTree(
                      openedSession,
                      repository,
                      revision,
                      controller.signal,
                    )
                  : await openedSession.loadTree(
                      repository,
                      revision,
                      "",
                      controller.signal,
                    );
              if (surface === "files") {
                const commits = await openedSession.loadCommits(
                  repository,
                  revision,
                  controller.signal,
                  { limit: 1 },
                );
                projectCommits = commits.commits;
                if (commits.commits[0]) {
                  tree = { ...tree, commit: commits.commits[0] };
                }
              }
              if (
                (surface === undefined || surface === "overview") &&
                !tree.readme?.trim()
              ) {
                const readme = tree.entries.find(
                  (entry) =>
                    entry.type === "blob" &&
                    /^readme(?:\.(?:md|markdown|mdown|rst|txt))?$/iu.test(
                      entry.name,
                    ),
                );
                if (readme) {
                  try {
                    const blob = await openedSession.loadBlob(
                      repository,
                      revision,
                      readme.path ?? readme.name,
                      controller.signal,
                    );
                    if (!blob.binary && !blob.too_large && blob.contents) {
                      tree = { ...tree, readme: blob.contents };
                    }
                  } catch (cause) {
                    if (controller.signal.aborted) throw cause;
                  }
                }
              }
              projectTree = tree;
            }
          } catch (cause) {
            if (controller.signal.aborted) throw cause;
            projectCommitBranch = "";
            projectRepositoryBranches = [];
            projectRepositoryRevision = "";
            projectTree = undefined;
            projectBlob = undefined;
            projectSourceError =
              cause instanceof Error
                ? cause.message
                : "The repository source could not be loaded";
          }
        }
      }

      if (pullRequestSurface === "reviews" && pullRequestId) {
        try {
          projectPullRequestDiff = await openedSession.loadPullRequestDiff(
            pullRequestId,
            { signal: controller.signal },
          );
        } catch (cause) {
          if (controller.signal.aborted) throw cause;
          projectPullRequestDiff = undefined;
          projectPullRequestDiffError =
            cause instanceof Error
              ? cause.message
              : "The pull request diff could not be loaded";
        }
      }
    })()
      .catch((cause) => {
        if (controller.signal.aborted) return;
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
        if (!controller.signal.aborted) projectLoading = false;
      });

    return () => {
      controller.abort();
      unsubscribeWorkItems?.();
    };
  });

  $effect(() => {
    const session = projectSession;
    const repository = projectSourceRepositoryCoordinate;
    const revision = projectRepositoryRevision;
    const path = selectedProjectPath;
    const surface = selectedRepositoryCoordinate
      ? activeRepositorySurface
      : selectedProjectSurface;
    if (surface !== "files" || !session || !repository || !revision || !path) {
      projectBlob = undefined;
      return;
    }

    const controller = new AbortController();
    projectBlob = undefined;
    void session
      .loadBlob(repository, revision, path, controller.signal)
      .then((blob) => {
        if (!controller.signal.aborted) projectBlob = blob;
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        projectSourceError =
          cause instanceof Error
            ? cause.message
            : "The selected file could not be loaded";
      });

    return () => controller.abort();
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
      (activePanel.kind === "thread" &&
        workspace.activeRoomId === activePanel.roomId &&
        workspace.sidePanel === "thread");
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

  function applyLocation(
    next: CommunityApplicationLocation,
    previous: CommunityApplicationLocation,
  ): void {
    const nextRegistryRoute = registryRouteFromDestination(next.destination);
    if (nextRegistryRoute !== null) registryRoute = nextRegistryRoute;

    if (next.projectRoute?.kind === "repository") {
      selectedRepositoryCoordinate = next.projectRoute.coordinate;
      activeRepositorySurface = next.projectRoute.surface;
    } else if (previous.projectRoute?.kind === "repository") {
      selectedRepositoryCoordinate = "";
      activeRepositorySurface = "overview";
    }

    const roomId =
      next.destination === "inbox"
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

  function pushBrowserLocation(location: CommunityApplicationLocation): void {
    if (typeof window === "undefined") return;
    const agentHash = agentLocationToHash(location);
    if (agentHash !== null) {
      if (window.location.hash !== agentHash)
        window.history.pushState(null, "", agentHash);
      return;
    }
    if (location.projectRoute !== undefined) {
      const hash = projectRouteToHash(location.projectRoute);
      if (window.location.hash !== hash)
        window.history.pushState(null, "", hash);
      return;
    }
    if (location.destination === "projects") {
      if (window.location.hash !== "#/projects")
        window.history.pushState(null, "", "#/projects");
      return;
    }
    const route = registryRouteFromDestination(location.destination);
    if (route === null) {
      clearBrowserApplicationLocation("push");
      return;
    }
    const hash = registryRouteToHash(route);
    if (window.location.hash !== hash) window.history.pushState(null, "", hash);
  }

  function replaceBrowserLocation(
    location: CommunityApplicationLocation,
  ): void {
    if (typeof window === "undefined") return;
    const agentHash = agentLocationToHash(location);
    if (agentHash !== null) {
      if (window.location.hash !== agentHash)
        window.history.replaceState(null, "", agentHash);
      return;
    }
    if (location.projectRoute !== undefined) {
      const hash = projectRouteToHash(location.projectRoute);
      if (window.location.hash !== hash)
        window.history.replaceState(null, "", hash);
      return;
    }
    if (location.destination === "projects") {
      if (window.location.hash !== "#/projects")
        window.history.replaceState(null, "", "#/projects");
      return;
    }
    const route = registryRouteFromDestination(location.destination);
    if (route === null) {
      clearBrowserApplicationLocation("replace");
      return;
    }
    const hash = registryRouteToHash(route);
    if (window.location.hash !== hash)
      window.history.replaceState(null, "", hash);
  }

  function clearBrowserApplicationLocation(mode: "push" | "replace"): void {
    if (
      agentLocationFromHash(window.location.hash) === null &&
      registryRouteFromHash(window.location.hash) === null &&
      projectRouteFromHash(window.location.hash) === null &&
      window.location.hash !== "#/projects" &&
      !window.location.hash.startsWith("#post-")
    ) {
      return;
    }
    const url = `${window.location.pathname}${window.location.search}`;
    if (mode === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  }

  onMount(() => {
    if (activeDestination === "agents")
      replaceBrowserLocation(applicationLocation);
    const applyBrowserLocation = () => {
      const agentRoute = agentLocationFromHash(window.location.hash);
      if (agentRoute) {
        replaceLocation(agentRoute);
        return;
      }
      if (window.location.hash === "#/projects" && hasProjects) {
        const location = {
          destination: "projects",
          panel: noCommunityApplicationPanel(),
        } satisfies CommunityApplicationLocation;
        if (
          !communityApplicationLocationsEqual(location, applicationLocation)
        ) {
          replaceLocation(location);
        }
        return;
      }
      const projectRoute = projectRouteFromHash(window.location.hash);
      if (projectRoute !== null && hasProjects) {
        const location = locationForProjectRoute(projectRoute);
        if (
          !communityApplicationLocationsEqual(location, applicationLocation)
        ) {
          replaceLocation(location);
        }
        return;
      }
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
    projectDialogRequest = undefined;
    selectedRepositoryCoordinate = "";
    activeRepositorySurface = "overview";
    if (destinationId === "projects") {
      selectedTaskId = "";
      selectedPullRequestId = "";
    }
    const next = {
      destination: destinationId,
      panel: noCommunityApplicationPanel(),
    } satisfies CommunityApplicationLocation;
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

  function locationForProjectRoute(
    route: CommunityApplicationProjectRoute,
  ): CommunityApplicationLocation {
    return {
      destination:
        route.kind === "project"
          ? projectDestinationFromCoordinate(route.coordinate)
          : "projects",
      panel: noCommunityApplicationPanel(),
      ...(route.kind === "project" && route.surface !== "overview"
        ? { mainSurface: `project-${route.surface}` as const }
        : {}),
      projectRoute: route,
    };
  }

  function selectProject(
    project: ProjectForgeCatalog["projects"][number],
  ): void {
    projectOverviewInitialized = false;
    selectedRepositoryCoordinate = "";
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
        surface: "overview",
      }),
    });
    lastAction = `selected-project:${project.address.coordinate}`;
  }

  function selectRepository(repository: ProjectForgeRepository): void {
    const project = projectCatalog.projects.find((candidate) =>
      candidate.repositories.some(
        (reference) => reference.coordinate === repository.address.coordinate,
      ),
    );
    selectedRepositoryCoordinate = repository.address.coordinate;
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
            surface: "overview",
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
    pushLocation({
      destination: selectedRepositoryProject
        ? projectDestinationFromCoordinate(
            selectedRepositoryProject.address.coordinate,
          )
        : "projects",
      panel: activePanel,
      projectRoute: {
        kind: "repository",
        coordinate: selectedRepository.address.coordinate,
        surface,
      },
    });
    lastAction = `opened-repository-${surface}`;
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
    projectOverviewInitialized = true;
    pushLocation({
      destination: activeDestination,
      panel: activePanel,
      mainSurface: `project-${surface}`,
      projectRoute: {
        kind: "project",
        coordinate: selectedProject.address.coordinate,
        surface,
      },
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
    const pullRequestRepository =
      selectedRepository === undefined && selectedProject === undefined
        ? projectCatalog.repositories.find(
            (repository) =>
              repository.address.coordinate ===
              selectedPullRequest?.repository.coordinate,
          )
        : undefined;
    if (
      selectedRepository === undefined &&
      selectedProject === undefined &&
      pullRequestRepository === undefined
    )
      return;
    selectedProjectCommit = commit;
    projectCommitDetail = undefined;
    projectSourceError = "";
    selectedPullRequestId = "";
    projectPullRequestDiff = undefined;
    if (selectedRepository) {
      activateRepositorySurface("commits");
    } else if (selectedProject) {
      activateProjectSurface("commits");
    } else if (pullRequestRepository) {
      const owningProject = projectCatalog.projects.find((project) =>
        project.repositories.some(
          (reference) =>
            reference.coordinate === pullRequestRepository.address.coordinate,
        ),
      );
      selectedRepositoryCoordinate = pullRequestRepository.address.coordinate;
      activeRepositorySurface = "commits";
      projectOverviewInitialized = true;
      pushLocation({
        destination:
          owningProject === undefined
            ? "projects"
            : projectDestinationFromCoordinate(
                owningProject.address.coordinate,
              ),
        panel: noCommunityApplicationPanel(),
        projectRoute: {
          kind: "repository",
          coordinate: pullRequestRepository.address.coordinate,
          surface: "commits",
        },
      });
      lastAction = `selected-review-commit:${commit.sha}`;
    }
  }

  function selectProjectCommit(commit: ProjectForgeCommit): void {
    requestProjectSourceAccess(() => activateProjectCommit(commit));
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
    if (surface === "reviews") return "Reviews";
    if (surface === "people") return "Contributors";
    return surface[0]!.toUpperCase() + surface.slice(1);
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
    if (selectedRepository) {
      if (label === "Latest" || label === "Commits") return "commits";
      if (label === "Files") return "files";
      if (label === "Tasks" || label === "Active" || label === "Completed")
        return "tasks";
      if (label === "Reviews" || label === "Open" || label === "Merged")
        return "reviews";
      return activeRepositorySurface;
    }
    if (selectedProject) {
      if (label === "Latest" || label === "Commits") return "commits";
      if (label === "Files") return "files";
      if (label === "Contributors") return "contributors";
      if (label === "Channels") return "channels";
      if (label === "Tasks" || label === "Active" || label === "Completed")
        return "tasks";
      if (label === "Reviews" || label === "Open" || label === "Merged")
        return "reviews";
      if (label === "Repositories") return "overview";
      return activeProjectSurface;
    }
    if (label === "Projects") return "projects";
    if (label === "Repositories") return "repositories";
    if (label === "Channels") return "channels";
    if (
      label === "Tasks" ||
      label === "Active" ||
      label === "Completed" ||
      label === "Active tasks"
    )
      return "tasks";
    if (
      label === "Reviews" ||
      label === "Open" ||
      label === "Merged" ||
      label === "Open reviews"
    )
      return "reviews";
    return projectsOverviewSurface;
  }

  function projectRailItemActive(label: string): boolean {
    const target = projectRailTarget(label);
    return selectedRepository
      ? activeRepositorySurface === target
      : selectedProject
        ? activeProjectSurface === target
        : projectsOverviewSurface === target;
  }

  function selectProjectRailItem(label: string): void {
    const target = projectRailTarget(label);
    if (selectedRepository) {
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
    pushLocation({
      destination: projectDestinationFromCoordinate(project.address.coordinate),
      panel: noCommunityApplicationPanel(),
      mainSurface: `project-${surface}`,
      projectRoute: {
        kind: "project",
        coordinate: project.address.coordinate,
        surface,
      },
    });
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
    selectedPullRequestId = "";
    selectedTaskId = "";
    projectPullRequestDiff = undefined;
    if (selectedProject) {
      pushLocation(
        locationForProjectRoute({
          kind: "project",
          coordinate: selectedProject.address.coordinate,
          surface: "overview",
        }),
      );
    } else {
      pushLocation({ destination: activeDestination, panel: activePanel });
    }
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

  async function loadGitHubConnections(): Promise<ProjectForgeGitHubConnectionsResponse> {
    return await withProjectRequest("Loading GitHub connections…", (session) =>
      session.loadGitHubConnections(),
    );
  }

  async function createGitHubConnection(
    input: ProjectForgeGitHubConnectionInput,
  ): Promise<ProjectForgeGitHubConnection> {
    return await withProjectRequest(
      "Adding GitHub App connection…",
      (session) => session.createGitHubConnection(input),
    );
  }

  async function updateGitHubConnection(
    connectionId: string,
    input: ProjectForgeGitHubConnectionInput,
  ): Promise<ProjectForgeGitHubConnection> {
    return await withProjectRequest(
      "Replacing GitHub App connection…",
      (session) => session.updateGitHubConnection(connectionId, input),
    );
  }

  async function revalidateGitHubConnection(
    connectionId: string,
  ): Promise<ProjectForgeGitHubConnection> {
    return await withProjectRequest(
      "Revalidating GitHub App connection…",
      (session) => session.revalidateGitHubConnection(connectionId),
    );
  }

  async function loadGitHubRepositories(
    connectionId: string,
  ): Promise<ProjectForgeGitHubRepositoriesResponse> {
    return await withProjectRequest("Loading GitHub repositories…", (session) =>
      session.loadGitHubRepositories(connectionId),
    );
  }

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
        : "Channel removed from project",
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
    const owner = input.repository.split(":")[1];
    if (!owner) throw new Error("Repository owner is missing");
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
    await withProjectMutation("Creating pull request…", async (session) => {
      const refs = await session.loadRefs(input.repository);
      const branches = projectForgeBranchRefs(refs);
      const base = branches.find(
        (branch) => branch.name === input.targetBranch,
      );
      if (!base) throw new Error("The selected base branch no longer exists");
      const compare = branches.find(
        (branch) => branch.name === input.branchName,
      );
      if (!compare)
        throw new Error("The selected compare branch no longer exists");
      await session.publish(
        createPullRequestTemplate({
          repository: input.repository,
          repositoryOwner: owner,
          title: input.title,
          content: input.content,
          commit: compare.sha,
          cloneUrls: [cloneUrl],
          ...(input.branchName ? { branchName: input.branchName } : {}),
          ...(input.targetBranch ? { targetBranch: input.targetBranch } : {}),
        }),
      );
    });
    toast.success("Pull request created");
  }

  async function loadReviewRepositoryRefs(
    repositoryCoordinate: string,
  ): Promise<ProjectForgeRefsResponse> {
    const session = projectSession;
    if (!session) throw new Error("Repository source is not ready");
    return await session.loadRefs(repositoryCoordinate);
  }

  async function loadRepositoryPathCommit(
    path: string,
    signal?: AbortSignal,
  ): Promise<ProjectForgeCommit | undefined> {
    const session = projectSession;
    const repository = projectSourceRepositoryCoordinate;
    const revision = projectRepositoryRevision;
    if (!session || !repository || !revision) return undefined;
    const response = await session.loadCommits(repository, revision, signal, {
      path,
      limit: 1,
    });
    return response.commits[0];
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
      await session.mergePullRequest(
        pullRequest.root.id,
        pullRequest.currentCommit,
      );
    });
    toast.success("Pull request merged");
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
    await runAuthenticated(() => action(activeRoom.id, member.id, roles));
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
    shell.right.close();
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
      label={releaseOverviewShown
        ? "Hide plugin release overview"
        : "Show plugin release overview"}
      class="community-application__release-overview-toggle"
      onclick={() => {
        releaseOverviewInitialized = true;
        if (releaseOverviewSidebar.collapsed) releaseOverviewSidebar.close();
        lastAction = releaseOverviewSidebar.closed
          ? "closed-release-overview"
          : "opened-release-overview";
      }}
    />
  {/if}
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
      </nav>
    </AppShell.Sidebar.Body>
  </AppShell.Sidebar>
{/snippet}

{#snippet releaseSheet()}
  <AppShell.SurfaceLayer
    open={releaseSheetOpen}
    label={activeMainSurface === "release-people" ? "People" : "Reviews"}
    coverPanelIds={["right"]}
    suspendPanelIds={[COMMUNITY_APPLICATION_RELEASE_OVERVIEW_PANEL_ID]}
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
            {#if activeProjectSurface === "overview" && !selectedRepository && !selectedTask && !selectedPullRequest}
              <Breadcrumb.Page
                ><span>{selectedProject.name}</span></Breadcrumb.Page
              >
            {:else}
              <Breadcrumb.Link
                href={projectRouteToHash({
                  kind: "project",
                  coordinate: selectedProject.address.coordinate,
                  surface: "overview",
                })}
                onclick={(event) => {
                  event.preventDefault();
                  if (selectedRepository) closeRepository();
                  else openProjectBreadcrumbSurface("overview");
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
          {:else if activeProjectSurface !== "overview"}
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
                surface: "overview",
              })}
              onclick={(event) => {
                event.preventDefault();
                openChannelProjectSurface("overview");
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
    label={projectOverviewShown
      ? "Hide project overview"
      : "Show project overview"}
    onclick={() => {
      projectOverviewInitialized = true;
      if (projectOverviewSidebar.collapsed) projectOverviewSidebar.close();
      lastAction = projectOverviewSidebar.closed
        ? "closed-project-overview"
        : "opened-project-overview";
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
          {@render projectRailStat(
            CircleDotIcon,
            "Status",
            selectedTask.lifecycle === "applied"
              ? "Done"
              : selectedTask.lifecycle[0]!.toUpperCase() +
                  selectedTask.lifecycle.slice(1),
          )}
          {@render projectRailStat(
            UsersIcon,
            "Assignees",
            selectedTask.assignees.length,
          )}
          {@render projectRailStat(
            MessageCircleIcon,
            "Comments",
            selectedTask.activity.filter(
              (entry) => !entry.assignment && entry.event.content.trim() !== "",
            ).length,
          )}
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
          {@render projectRailStat(
            GitBranchIcon,
            "Branch",
            `${selectedPullRequest.branchName || "unknown"} → ${selectedPullRequest.targetBranch || "default"}`,
          )}
          {@render projectRailStat(
            GitPullRequestIcon,
            "Status",
            selectedPullRequest.lifecycle[0]!.toUpperCase() +
              selectedPullRequest.lifecycle.slice(1),
          )}
          {@render projectRailStat(
            UsersIcon,
            "Reviewers",
            selectedPullRequest.reviewers.length,
          )}
          {@render projectRailStat(
            CircleCheckIcon,
            "Approvals",
            selectedPullRequest.approvals.length,
          )}
        {:else if selectedRepository}
          <div class="community-application__project-overview-heading">
            <strong
              >{activeRepositorySurface === "overview"
                ? selectedRepository.name
                : activeRepositorySurface === "reviews"
                  ? "Reviews"
                  : activeRepositorySurface[0]!.toUpperCase() +
                    activeRepositorySurface.slice(1)}</strong
            >
            {@render repositoryActionMenu()}
          </div>
          {#if activeRepositorySurface === "overview"}
            <div class="community-application__project-overview-repository">
              <strong>{selectedRepository.name}</strong>
              <span>{repositorySourceLabel(selectedRepository)}</span>
            </div>
            {#if selectedRepository.repositoryClass === "external" && canManageForge}
              <Button
                type="button"
                variant="ghost"
                class="community-application__project-overview-action"
                title={selectedRepositoryGitHubConnected
                  ? "Manage this repository's GitHub App connection"
                  : "Connect this repository to a GitHub App installation"}
                disabled={projectOperation !== ""}
                onclick={() =>
                  requestProjectDialog(
                    selectedRepositoryGitHubConnected
                      ? "manage-github"
                      : "connect-github",
                  )}
              >
                <svg
                  data-icon="inline-start"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.3c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.4 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3Z"
                  />
                </svg>
                {selectedRepositoryGitHubConnected
                  ? "Manage GitHub App"
                  : "Connect GitHub App"}
              </Button>
            {/if}
            <p class="community-application__project-overview-label">Details</p>
            {@render projectRailStat(
              GitCommitHorizontalIcon,
              "Latest",
              projectCommits[0]?.sha.slice(0, 7) ?? "—",
            )}
            {@render projectRailStat(
              FilesIcon,
              "Files",
              projectTree?.entries.length ?? 0,
            )}
            {@render projectRailStat(
              ListTodoIcon,
              "Tasks",
              selectedRepositoryTasks.length,
            )}
            {@render projectRailStat(
              GitPullRequestIcon,
              "Reviews",
              selectedRepositoryPullRequests.length,
            )}
          {:else if activeRepositorySurface === "files"}
            {@render projectRailStat(
              FilesIcon,
              "Files",
              projectTree?.entries.length ?? 0,
            )}
          {:else if activeRepositorySurface === "commits"}
            {@render projectRailStat(
              GitCommitHorizontalIcon,
              "Commits",
              projectCommits.length,
            )}
            {@render projectRailStat(
              GitBranchIcon,
              "Latest",
              projectCommits[0]?.sha.slice(0, 7) ?? "—",
            )}
          {:else if activeRepositorySurface === "tasks"}
            {@render projectRailStat(
              ListTodoIcon,
              "Tasks",
              selectedRepositoryTasks.length,
            )}
            {@render projectRailStat(
              CircleDotIcon,
              "Active",
              selectedRepositoryTasks.filter(
                (task) =>
                  task.lifecycle !== "closed" && task.lifecycle !== "applied",
              ).length,
            )}
            {@render projectRailStat(
              CircleCheckIcon,
              "Completed",
              selectedRepositoryTasks.filter(
                (task) =>
                  task.lifecycle === "closed" || task.lifecycle === "applied",
              ).length,
            )}
          {:else if activeRepositorySurface === "reviews"}
            {@render projectRailStat(
              GitPullRequestIcon,
              "Reviews",
              selectedRepositoryPullRequests.length,
            )}
            {@render projectRailStat(
              CircleDotIcon,
              "Open",
              selectedRepositoryPullRequests.filter(
                (review) =>
                  review.lifecycle === "open" || review.lifecycle === "draft",
              ).length,
            )}
            {@render projectRailStat(
              CircleCheckIcon,
              "Merged",
              selectedRepositoryPullRequests.filter(
                (review) => review.lifecycle === "merged",
              ).length,
            )}
          {/if}
        {:else if selectedProject}
          <div class="community-application__project-overview-heading">
            <strong
              >{activeProjectSurface === "overview"
                ? selectedProject.name
                : activeProjectSurface === "reviews"
                  ? "Reviews"
                  : activeProjectSurface[0]!.toUpperCase() +
                    activeProjectSurface.slice(1)}</strong
            >
            {#if activeProjectSurface === "overview"}
              {@render repositoryActionMenu()}
            {:else if activeProjectSurface === "tasks"}
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
            {/if}
          </div>
          {#if activeProjectSurface === "overview"}
            {#each selectedProjectRepositories.filter((repository) => repository.repositoryClass !== "task-anchor") as repository (repository.address.coordinate)}
              <div class="community-application__project-overview-repository">
                <strong>{repository.name}</strong>
                <span>{repositorySourceLabel(repository)}</span>
              </div>
            {/each}
            <p class="community-application__project-overview-label">Details</p>
            {@render projectRailStat(
              GitCommitHorizontalIcon,
              "Latest",
              projectCommits[0]?.sha.slice(0, 7) ?? "—",
            )}
            {@render projectRailStat(
              FilesIcon,
              "Files",
              projectTree?.entries.length ?? 0,
            )}
            {@render projectRailStat(
              UsersIcon,
              "Contributors",
              selectedProjectRoom?.memberCount ?? activeRoomMemberIds.length,
            )}
          {:else if activeProjectSurface === "files"}
            {@render projectRailStat(
              GitBranchIcon,
              "Repositories",
              selectedProjectRepositories.filter(
                (repository) => repository.repositoryClass !== "task-anchor",
              ).length,
            )}
            {@render projectRailStat(
              FilesIcon,
              "Files",
              projectTree?.entries.length ?? 0,
            )}
          {:else if activeProjectSurface === "commits"}
            {@render projectRailStat(
              GitCommitHorizontalIcon,
              "Commits",
              projectCommits.length,
            )}
            {@render projectRailStat(
              GitBranchIcon,
              "Latest",
              projectCommits[0]?.sha.slice(0, 7) ?? "—",
            )}
          {:else if activeProjectSurface === "tasks"}
            {@render projectRailStat(
              ListTodoIcon,
              "Tasks",
              projectWorkItems.tasks.length,
            )}
            {@render projectRailStat(
              CircleDotIcon,
              "Active",
              projectWorkItems.tasks.filter(
                (task) =>
                  task.lifecycle !== "closed" && task.lifecycle !== "applied",
              ).length,
            )}
            {@render projectRailStat(
              CircleCheckIcon,
              "Completed",
              projectWorkItems.tasks.filter(
                (task) =>
                  task.lifecycle === "closed" || task.lifecycle === "applied",
              ).length,
            )}
          {:else if activeProjectSurface === "reviews"}
            {@render projectRailStat(
              GitPullRequestIcon,
              "Reviews",
              projectWorkItems.pullRequests.length,
            )}
            {@render projectRailStat(
              CircleDotIcon,
              "Open",
              projectWorkItems.pullRequests.filter(
                (review) =>
                  review.lifecycle === "open" || review.lifecycle === "draft",
              ).length,
            )}
            {@render projectRailStat(
              CircleCheckIcon,
              "Merged",
              projectWorkItems.pullRequests.filter(
                (review) => review.lifecycle === "merged",
              ).length,
            )}
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
              HashIcon,
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
                title="Select a project to add a channel"
                disabled><PlusIcon aria-hidden="true" /></Button
              >
            {/if}
          </div>
          {#if projectsOverviewSurface === "tasks"}
            {@render projectRailStat(
              ListTodoIcon,
              "Tasks",
              projectWorkItems.tasks.length,
            )}
            {@render projectRailStat(
              CircleDotIcon,
              "Active",
              projectWorkItems.tasks.filter(
                (task) =>
                  task.lifecycle !== "closed" && task.lifecycle !== "applied",
              ).length,
            )}
            {@render projectRailStat(
              CircleCheckIcon,
              "Completed",
              projectWorkItems.tasks.filter(
                (task) =>
                  task.lifecycle === "closed" || task.lifecycle === "applied",
              ).length,
            )}
          {:else if projectsOverviewSurface === "reviews"}
            {@render projectRailStat(
              GitPullRequestIcon,
              "Reviews",
              projectWorkItems.pullRequests.length,
            )}
            {@render projectRailStat(
              CircleDotIcon,
              "Open",
              projectWorkItems.pullRequests.filter(
                (review) =>
                  review.lifecycle === "open" || review.lifecycle === "draft",
              ).length,
            )}
            {@render projectRailStat(
              CircleCheckIcon,
              "Merged",
              projectWorkItems.pullRequests.filter(
                (review) => review.lifecycle === "merged",
              ).length,
            )}
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
    suspendPanelIds={[COMMUNITY_APPLICATION_PROJECT_OVERVIEW_PANEL_ID]}
    dismissLabel={`Back to ${selectedProject?.name ?? "project"}`}
    onDismiss={closeProjectSurface}
    class="community-application__project-sheet-layer"
    style="--ui-shell-surface-layer-main-start-allowance: 7rem; --ui-shell-surface-layer-inline-end-inset: 0px"
  >
    <AppShell.SurfaceLayer.Header
      class="community-application__project-sheet-header"
    >
      <h1>
        {selectedProjectSurface === "tasks"
          ? "Tasks"
          : selectedProjectSurface === "reviews"
            ? "Reviews"
            : selectedProjectSurface === "commits"
              ? "Commits"
              : selectedProjectSurface === "files"
                ? "Files"
                : "People"}
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
          {...selectedProject === undefined ? {} : { selectedProject }}
          {...selectedRepository === undefined ? {} : { selectedRepository }}
          repositories={selectedProjectRepositories}
          repositoryOptions={projectCatalog.repositories}
          repositoryCapabilities={projectRepositoryCapabilities}
          tasks={projectWorkItems.tasks}
          pullRequests={projectWorkItems.pullRequests}
          {...selectedPullRequest === undefined ? {} : { selectedPullRequest }}
          commits={projectCommits}
          commitBranch={projectCommitBranch}
          repositoryBranches={projectRepositoryBranches}
          selectedRepositoryBranch={projectCommitBranch}
          {...selectedProjectCommit === undefined
            ? {}
            : { selectedCommit: selectedProjectCommit }}
          {...projectCommitDetail === undefined
            ? {}
            : { selectedCommitDetail: projectCommitDetail }}
          sourceError={projectSourceError}
          {...projectTree === undefined ? {} : { tree: projectTree }}
          selectedPath={selectedProjectPath}
          {...projectBlob === undefined ? {} : { blob: projectBlob }}
          {...projectPullRequestDiff === undefined
            ? {}
            : { pullRequestDiff: projectPullRequestDiff }}
          pullRequestDiffError={projectPullRequestDiffError}
          members={selectedProjectRoom === undefined
            ? []
            : workspace.members.filter((member) =>
                activeRoomMemberIds.includes(member.id),
              )}
          rooms={allRooms}
          communityEmojis={community.state.settings.customEmojis}
          {...workspace.currentMemberId === undefined
            ? {}
            : { currentMemberId: workspace.currentMemberId }}
          reviewPreferenceStore={defaultProjectReviewPreferenceStore}
          {...projectReviewPreferenceScope === undefined
            ? {}
            : { reviewPreferenceScope: projectReviewPreferenceScope }}
          loading={projectLoading}
          {...cachedProjectCatalogAt === undefined
            ? {}
            : { cachedCatalogAt: cachedProjectCatalogAt }}
          error={projectError}
          operation={projectOperation}
          canCollaborate={authenticated}
          onOpenProfile={openProfile}
          onMessageMember={messageMember}
          onWaveMember={waveMember}
          onCreateRepository={createRepository}
          onUpdateProject={updateProject}
          onAttachRepository={attachRepository}
          onSelectRepository={selectRepository}
          onCreateTask={createTask}
          onUpdateTaskLifecycle={updateTaskLifecycle}
          onCreatePullRequest={createPullRequest}
          onLoadRepositoryRefs={loadReviewRepositoryRefs}
          onSelectRepositoryBranch={(branch) => {
            if (branch === projectSelectedRepositoryBranch) return;
            projectSelectedRepositoryBranchOwner =
              projectSourceRepositoryCoordinate;
            projectSelectedRepositoryBranch = branch;
            selectedProjectPath = "";
            projectBlob = undefined;
            projectTree = undefined;
          }}
          onLoadRepositoryPathCommit={loadRepositoryPathCommit}
          onSelectPullRequest={(pullRequest) => {
            selectedPullRequestId = pullRequest.root.id;
            projectPullRequestDiff = undefined;
          }}
          onClosePullRequest={closeProjectPullRequest}
          onSubmitPullRequestReview={publishPullRequestReview}
          onMergePullRequest={mergePullRequest}
          onUpdatePullRequestLifecycle={updatePullRequestLifecycle}
          onAddPullRequestComment={publishPullRequestComment}
          onAddInlineComment={publishInlineComment}
          onTogglePullRequestCommentReaction={togglePullRequestCommentReaction}
          onSelectCommit={selectProjectCommit}
          onCloseCommit={closeProjectCommit}
          onSelectPath={(path) => {
            selectedProjectPath = path;
            projectBlob = undefined;
          }}
          onRetry={repairProjectMembership}
        />
      {/if}
    </AppShell.SurfaceLayer.Body>
  </AppShell.SurfaceLayer>
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
          searchOpen = true;
          updateAppSearchInput(query);
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
            member={displayMember}
            presence={community.state.presence?.members[displayMember.id]
              ?.status ?? "unknown"}
            presencePreference={community.state.presence?.preference ?? "auto"}
            presenceDisabled={!community.actions.setPresencePreference ||
              !community.state.presence ||
              community.state.presence.status === "unavailable" ||
              community.state.presence.status === "loading" ||
              community.state.presence.pending}
            communityName={currentCommunity?.name ?? "Community"}
            {...activeConnection?.relayUrl === undefined
              ? {}
              : { communityUrl: activeConnection.relayUrl }}
            authenticated={signedIn}
            {signingOut}
            compact={navigationCompact}
            connectionStatus={community.state.status}
            canManageCommunity={activeRoom.permissions?.manageMembers.state ===
              "enabled"}
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

  <AppShell.Main class="community-application__main">
    {#if shell.mobile.resolvedMode === "mobile" && !usesRoomToolbar}
      <AppShell.Toolbar label="Application navigation">
        {@render mobileNavigationControls()}
      </AppShell.Toolbar>
    {/if}

    {#if activeDestination === "agents"}
      <AppShell.Toolbar
        label="Agents page header"
        class="community-application__agents-toolbar"
      >
        <div class="community-application__agents-heading">
          <h1>Agents</h1>
          <p>Your registered agents in this community.</p>
        </div>
        {#if community.state.agents && community.actions.agents}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={community.state.agents.status === "loading"}
            onclick={() => void community.actions.agents!.refresh()}
          >
            <RefreshIcon aria-hidden="true" />
            Refresh agents
          </Button>
        {/if}
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
        {#if selectedRepository}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            class="community-application__project-toolbar-back"
            aria-label={`Back to ${selectedProject?.name ?? "project"}`}
            title={`Back to ${selectedProject?.name ?? "project"}`}
            onclick={closeRepository}
          >
            <ArrowLeftIcon aria-hidden="true" />
          </Button>
        {:else if selectedProject}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            class="community-application__project-toolbar-back"
            aria-label="Back to projects"
            title="Back to projects"
            onclick={() => setDestination("projects", true)}
          >
            <ArrowLeftIcon aria-hidden="true" />
          </Button>
        {:else}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            class="community-application__project-toolbar-search"
            aria-label="Search projects"
            title="Search projects"
            onclick={() => (searchOpen = true)}
          >
            <SearchIcon aria-hidden="true" />
          </Button>
        {/if}
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
              The requested {unavailableProjectRoute.kind} was not found after the
              project catalog finished loading. Its address remains in the URL so
              the link can be retried.
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
          ? activeRepositorySurface
          : selectedProject
            ? activeProjectSurface
            : projectsOverviewSurface}
        projects={selectedRepositoryProject
          ? [selectedRepositoryProject]
          : selectedProject
            ? projectCatalog.projects
            : listedProjects}
        {...selectedProject === undefined ? {} : { selectedProject }}
        {...selectedRepository === undefined ? {} : { selectedRepository }}
        repositories={selectedRepository
          ? [selectedRepository]
          : selectedProject
            ? selectedProjectRepositories
            : projectCatalog.repositories}
        repositoryOptions={projectCatalog.repositories}
        repositoryCapabilities={projectRepositoryCapabilities}
        activity={projectActivity}
        tasks={selectedRepository
          ? selectedRepositoryTasks
          : projectWorkItems.tasks}
        {...selectedTask === undefined ? {} : { selectedTask }}
        pullRequests={selectedRepository
          ? selectedRepositoryPullRequests
          : projectWorkItems.pullRequests}
        {...selectedPullRequest === undefined ? {} : { selectedPullRequest }}
        commits={projectCommits}
        commitBranch={projectCommitBranch}
        repositoryBranches={projectRepositoryBranches}
        selectedRepositoryBranch={projectCommitBranch}
        {...selectedProjectCommit === undefined
          ? {}
          : { selectedCommit: selectedProjectCommit }}
        {...projectCommitDetail === undefined
          ? {}
          : { selectedCommitDetail: projectCommitDetail }}
        sourceError={projectSourceError}
        {...projectTree === undefined ? {} : { tree: projectTree }}
        selectedPath={selectedProjectPath}
        {...projectBlob === undefined ? {} : { blob: projectBlob }}
        {...projectPullRequestDiff === undefined
          ? {}
          : { pullRequestDiff: projectPullRequestDiff }}
        pullRequestDiffError={projectPullRequestDiffError}
        members={selectedProjectRoom === undefined
          ? workspace.members
          : workspace.members.filter((member) =>
              activeRoomMemberIds.includes(member.id),
            )}
        rooms={allRooms}
        communityEmojis={community.state.settings.customEmojis}
        {...workspace.currentMemberId === undefined
          ? {}
          : { currentMemberId: workspace.currentMemberId }}
        reviewPreferenceStore={defaultProjectReviewPreferenceStore}
        {...projectReviewPreferenceScope === undefined
          ? {}
          : { reviewPreferenceScope: projectReviewPreferenceScope }}
        loading={projectLoading}
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
            openProjectsOverviewSurface(surface as ProjectForgeOverviewSurface);
        }}
        onBack={() => {
          if (selectedRepository) closeRepository();
          else setDestination("projects", true);
        }}
        onSelectProject={selectProject}
        onSelectRepository={selectRepository}
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
        onSelectRepositoryBranch={(branch) => {
          if (branch === projectSelectedRepositoryBranch) return;
          projectSelectedRepositoryBranchOwner =
            projectSourceRepositoryCoordinate;
          projectSelectedRepositoryBranch = branch;
          selectedProjectPath = "";
          projectBlob = undefined;
          projectTree = undefined;
        }}
        onLoadRepositoryPathCommit={loadRepositoryPathCommit}
        onSelectPullRequest={(pullRequest) => {
          selectedPullRequestId = pullRequest.root.id;
          projectPullRequestDiff = undefined;
        }}
        onClosePullRequest={closeProjectPullRequest}
        onSubmitPullRequestReview={publishPullRequestReview}
        onMergePullRequest={mergePullRequest}
        onUpdatePullRequestLifecycle={updatePullRequestLifecycle}
        onAddPullRequestComment={publishPullRequestComment}
        onAddInlineComment={publishInlineComment}
        onTogglePullRequestCommentReaction={togglePullRequestCommentReaction}
        onSelectCommit={selectProjectCommit}
        onCloseCommit={closeProjectCommit}
        onSelectPath={(path) => {
          selectedProjectPath = path;
          projectBlob = undefined;
        }}
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
                Provide <code>registryOptions</code> with a catalog source, or
                use the legacy <code>registry</code> snippet override.
              </p>
            </section>
          </AppShell.Body.Content>
        </AppShell.Body>
      {/if}
    {:else if activeDestination === "agents"}
      <AppShell.Body layout="regions" label="Agents">
        <AppShell.Body.Content label="Agents directory">
          {#if community.state.agents && community.actions.agents}
            <CommunityAgents
              bind:adding={agentCreatorOpen}
              model={community.state.agents}
              onProfile={openAgentProfile}
              onActivity={openAgentActivity}
              onSavePersona={(input) =>
                community.actions.agents!.savePersona(input)}
              onSaveAgent={(input) =>
                community.actions.agents!.saveAgent(input)}
              onDeletePersona={(slug) =>
                community.actions.agents!.deletePersona(slug)}
              onCreateManagedAgent={(input) =>
                community.actions.agents!.createManagedAgent(input)}
              onClearManagedAgentDraft={() =>
                community.actions.agents!.clearManagedAgentDraft()}
              onCreateReplacement={(pubkey) =>
                community.actions.agents!.createManagedAgentReplacement(pubkey)}
              onRevokeManagedAgent={(pubkey) =>
                community.actions.agents!.revokeManagedAgent(pubkey)}
              onDeleteManagedAgent={(pubkey) =>
                community.actions.agents!.deleteManagedAgent(pubkey)}
              rooms={allRooms.map((room) => ({
                id: room.id,
                name: room.name,
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
            />
          {:else}<div class="community-application__panel-status" role="status">
              Sign in to a community with agent support to view your agents.
            </div>{/if}
        </AppShell.Body.Content>
      </AppShell.Body>
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
        </AppShell.Body.Content>
      </AppShell.Body>
    {:else if activeDestination === "pulse" && community.state.pulse && community.actions.pulse}
      <AppShell.Body layout="regions" label="Pulse">
        <AppShell.Body.Content label="Pulse feed">
          <CommunityPulse
            model={community.state.pulse}
            currentMember={displayMember}
            rooms={allRooms}
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
          ? community.actions.editEvent === undefined
            ? {}
            : { onSaveMessageEdit: editMessage }
          : { onEditMessage: extensions.editMessage }}
        onDeleteMessage={deleteMessage}
        {...community.actions.reportEvent === undefined
          ? {}
          : { onReportMessage: reportMessage }}
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
          {#if isPluginReleaseRoom && shell.mobile.resolvedMode === "mobile"}
            <AppShell.Sidebar.Toggle
              side="right"
              sidebarController={releaseOverviewSidebar}
              sidebarName="plugin release overview"
              onclick={() => {
                lastAction = "toggled-release-overview";
              }}
            />
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
                model={workspaceSurfaceModel}
                historyLoading={activeRoomHistoryLoading}
                historyUpdating={community.state.contentSync?.phase ===
                  "background" ||
                  community.state.contentSync?.phase === "partial-error"}
                messageSupplement={releaseMessageSupplement}
                {...activeChannelProject === undefined
                  ? {}
                  : { channelActions: projectChannelRepositoryAction }}
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
                agent={selectedAgent}
                personas={community.state.agents?.personas ?? []}
                ownerName={memberById(
                  workspace.members,
                  selectedAgent.ownerPubkey,
                ).name}
                onOpenOwner={(pubkey) =>
                  openProfile(memberById(workspace.members, pubkey))}
                rooms={allRooms}
                {...community.state.agents?.presence[selectedAgent.pubkey]
                  ? {
                      presence:
                        community.state.agents.presence[selectedAgent.pubkey],
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
                  await community.actions.addMember(id, selectedAgent.pubkey);
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
              <div class="community-application__panel-status" role="status">
                Profile unavailable
              </div>
            {/if}
          </AppShell.Sidebar.Body>
        {:else if activePanel.kind === "agent-activity"}
          <AppShell.Sidebar.Header
            ><strong>Agent activity</strong><AppShell.Sidebar.Close
              onclick={closeSidePanel}
            /></AppShell.Sidebar.Header
          >
          <AppShell.Sidebar.Body>
            {#if community.state.agents && community.actions.agents}
              <CommunityAgentActivity
                model={community.state.agents}
                rooms={allRooms}
                onBack={() => {
                  if (activePanel.kind === "agent-activity")
                    openAgentProfile(activePanel.agentPubkey);
                }}
                onSelectAgent={(pubkey) => openAgentActivity(pubkey)}
                onSelectChannel={(channelId) => {
                  if (activePanel.kind === "agent-activity")
                    openAgentActivity(activePanel.agentPubkey, channelId);
                }}
                onLatest={() => {
                  if (activePanel.kind === "agent-activity")
                    return community.actions.agents!.openActivity(
                      activePanel.agentPubkey,
                      activePanel.channelId,
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
                onCancelTurn={(pubkey, scopeKey, channelId) =>
                  community.actions.agents!.cancelTurn(
                    pubkey,
                    scopeKey,
                    channelId,
                  )}
                onResetConversation={(pubkey, scopeKey, channelId) =>
                  community.actions.agents!.resetConversation(
                    pubkey,
                    scopeKey,
                    channelId,
                  )}
                onRespondPermission={(pubkey, requestId, decision, channelId) =>
                  community.actions.agents!.respondPermission(
                    pubkey,
                    requestId,
                    decision,
                    channelId,
                  )}
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
              <CommunitySkeleton layout="messages" label="Loading thread" />
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
            writerPolicySupported={community.state.capabilities
              .writeRestrictedRooms === true}
            groupInvitesSupported={community.state.capabilities.groupInvites ===
              true && community.actions.createGroupInvite !== undefined}
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
  {#if isPluginReleaseRoom && !activeChannelProject}
    {@render releaseOverviewRail()}
    {@render releaseSheet()}
  {/if}
  {#if isProjectsDestination || (activeChannelProject && usesRoomToolbar)}
    {@render projectOverviewRail()}
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
    members={workspace.members}
    rooms={allRooms}
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
      community.actions.updateRelayUrl(activeConnection.communityId, relayUrl)}
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
  writerPolicySupported={community.state.capabilities.writeRestrictedRooms ===
    true}
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
  rooms={allRooms}
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

<CommunityMemberCommand
  bind:open={memberCommandOpen}
  title={memberCommandMode === "select" && memberCommandTask
    ? `Assign ${memberCommandTask.title}`
    : memberCommandMode === "select"
      ? "New direct message"
      : `${activeRoom.kind === "forum" ? "Forum" : activeRoom.kind === "direct" ? "Conversation" : "Channel"} members`}
  mode={memberCommandMode}
  members={workspace.members}
  results={community.state.memberDirectory.results}
  groupMemberIds={activeRoomMemberIds}
  {...workspace.currentMemberId === undefined
    ? {}
    : { currentMemberId: workspace.currentMemberId }}
  roomKind={activeRoom.kind === "direct" ? "conversation" : activeRoom.kind}
  selectedIds={selectedRecipientIds}
  selectionLabel={memberCommandMode === "select" && memberCommandTask
    ? "Selected assignees"
    : "Selected recipients"}
  confirmLabel={memberCommandMode === "select" && memberCommandTask
    ? "Update assignees"
    : "Start message"}
  allowEmptySelection={memberCommandMode === "select" &&
    memberCommandTask !== undefined}
  completeness={activeRoom.memberListCompleteness ?? "unavailable"}
  roleDefinitions={activeRoom.roleDefinitions ?? []}
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
  {...community.state.capabilities.memberRoles === true &&
  community.actions.setMemberRoles !== undefined
    ? { onSetRoles: setMemberRoles }
    : {}}
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
    {pendingParticipation?.actionKind ?? "action"} is sent. The original action will
    continue automatically after membership is confirmed.
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
        error: statusOperation.failure?.relayReason ?? statusOperation.message!,
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

  :global(.community-application__agents-toolbar[data-ui-part="toolbar"]) {
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem clamp(1.25rem, 3vw, 3rem);
  }

  .community-application__agents-heading {
    display: grid;
    min-width: 0;
    gap: 0.25rem;
  }

  .community-application__agents-heading h1,
  .community-application__agents-heading p {
    margin: 0;
  }

  .community-application__agents-heading h1 {
    font-size: var(--community-text-page);
    font-weight: 650;
    letter-spacing: -0.035em;
  }

  .community-application__agents-heading p {
    color: var(--muted-foreground);
    font-size: var(--community-text-body);
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

  .community-application__project-overview-repository {
    display: grid;
    gap: 0.08rem;
    padding: 0.3rem 0.4rem;
    font-size: var(--community-text-secondary);
  }

  .community-application__project-overview-repository span,
  .community-application__project-overview-label {
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
  }

  .community-application__project-overview-label {
    margin: 0.9rem 0.4rem 0.3rem;
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
    ) {
    color: var(--foreground);
    background: color-mix(in srgb, var(--muted) 62%, transparent);
  }

  :global(
      .community-application__project-overview-item[data-ui-component="button"]:hover:not(
          :disabled
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
