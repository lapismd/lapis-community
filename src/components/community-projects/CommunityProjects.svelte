<script lang="ts">
  import CommunityProjectChannelIcon from "../community-project-channel-icon/CommunityProjectChannelIcon.svelte";
  import { toast } from "svelte-sonner";
  import CommunitySkeleton from "../community-skeleton/CommunitySkeleton.svelte";
  import {
    FileChangeStats,
    FileDiffComposer,
    FileListing,
    FileListingViewModeToggle,
    type FileDiffComposerFileContext,
    type FileDiffFileScrollTarget,
    type FileDiffLineContext,
    type FileDiffViewMode,
    type FileListingViewMode,
  } from "@lapismd/design-core/diff";
  import { AppShell } from "@lapismd/design-core/shell";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Collapsible from "@lapismd/design-core/shadcn/collapsible";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import * as Empty from "@lapismd/design-core/shadcn/empty";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import { ScrollArea } from "@lapismd/design-core/shadcn/scroll-area";
  import * as Tabs from "@lapismd/design-core/shadcn/tabs";
  import * as Tooltip from "@lapismd/design-core/shadcn/tooltip";
  import * as ToggleGroup from "@lapismd/design-core/shadcn/toggle-group";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import CircleIcon from "@lucide/svelte/icons/circle";
  import CircleCheckIcon from "@lucide/svelte/icons/circle-check";
  import CircleDashedIcon from "@lucide/svelte/icons/circle-dashed";
  import CircleXIcon from "@lucide/svelte/icons/circle-x";
  import CodeXmlIcon from "@lucide/svelte/icons/code-xml";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
  import FileIcon from "@lucide/svelte/icons/file";
  import FolderGit2Icon from "@lucide/svelte/icons/folder-git-2";
  import FolderKanbanIcon from "@lucide/svelte/icons/folder-kanban";
  import FolderPlusIcon from "@lucide/svelte/icons/folder-plus";
  import GitBranchIcon from "@lucide/svelte/icons/git-branch";
  import GitCommitHorizontalIcon from "@lucide/svelte/icons/git-commit-horizontal";
  import GitPullRequestIcon from "@lucide/svelte/icons/git-pull-request";
  import HistoryIcon from "@lucide/svelte/icons/history";
  import HashIcon from "@lucide/svelte/icons/hash";
  import LayoutGridIcon from "@lucide/svelte/icons/layout-grid";
  import ListIcon from "@lucide/svelte/icons/list";
  import ListTodoIcon from "@lucide/svelte/icons/list-todo";
  import LinkIcon from "@lucide/svelte/icons/link";
  import MessageSquareIcon from "@lucide/svelte/icons/message-square";
  import EllipsisVerticalIcon from "@lucide/svelte/icons/ellipsis-vertical";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import Settings2Icon from "@lucide/svelte/icons/settings-2";
  import UnlinkIcon from "@lucide/svelte/icons/unlink";
  import UserIcon from "@lucide/svelte/icons/user";
  import UserRoundPlusIcon from "@lucide/svelte/icons/user-round-plus";

  import {
    GITHUB_REVIEW_COMMENT_REACTIONS,
    repositoryMatchesGitHubAnnouncement,
    projectForgeBranchName,
    projectForgeBranchRefs,
    groupItemsByProjectRepository,
    projectVisibleActivity,
    PROJECT_DIRECTORY_TABS,
    PROJECT_WORKSPACE_TABS,
    repositoryVisibleActivity,
    splitProjectForgePatch,
    projectForgeBoundChannels,
    type ProjectForgeCommit,
    type ProjectForgeProject,
    type ProjectForgeRepository,
    type ProjectTaskState,
    type ProjectForgeGitHubConnection,
    type ProjectForgeGitHubConnectionInput,
    type ProjectForgeGitHubRepository,
    type ProjectForgeRefsResponse,
    type ProjectReviewViewedFilesScope,
    type PullRequestState,
    type PullRequestComment,
    type PullRequestReviewKind,
  } from "../../projects/index.js";
  import { scopeProjectTasks } from "../../projects/collection-filters.js";
  import {
    pullRequestBelongsToProjectScope,
    projectPullRequestsFor,
    taskIsMine,
    type CommunityProjectsFilterProps,
  } from "./project-list-scope.js";
  import CommunitySidebarToggleIcon from "../community-app-shell/CommunitySidebarToggleIcon.svelte";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityMemberHoverCard from "../community-member-hover-card/CommunityMemberHoverCard.svelte";
  import CommunityMarkdownContent from "../community-markdown-content/CommunityMarkdownContent.svelte";
  import CommunityMessage from "../community-message/CommunityMessage.svelte";
  import CommunityProjectStatusToasts from "./CommunityProjectStatusToasts.svelte";
  import CommunityProjectsActivityFeed from "./CommunityProjectsActivityFeed.svelte";
  import CommunityProjectsCommitList from "./CommunityProjectsCommitList.svelte";
  import CommunityProjectsPeopleList from "./CommunityProjectsPeopleList.svelte";
  import CommunityProjectsPullRequestList from "./CommunityProjectsPullRequestList.svelte";
  import CommunityProjectsRepositorySections from "./CommunityProjectsRepositorySections.svelte";
  import { projectRepositoryContributorGroups } from "./project-contributor-groups.js";
  import CommunityProjectsCreateDialogs from "./CommunityProjectsCreateDialogs.svelte";
  import CommunityProjectsPullRequestReview from "./CommunityProjectsPullRequestReview.svelte";
  import CommunityProjectsPullRequestSubmitDialog from "./CommunityProjectsPullRequestSubmitDialog.svelte";
  import CommunityProjectsGitAuthorAvatar from "./CommunityProjectsGitAuthorAvatar.svelte";
  import CommunityProjectsRepositoryOverview from "../community-projects-settings/CommunityProjectsRepositoryOverview.svelte";
  import CommunityProjectsRepositoryPane from "./CommunityProjectsRepositoryPane.svelte";
  import CommunityProjectsRepositoryLog from "./CommunityProjectsRepositoryLog.svelte";
  import CommunityRelativeTime from "../community-relative-time/CommunityRelativeTime.svelte";
  import type {
    CommunityMemberModel,
    CommunityMessageModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
  import type {
    CommunityProjectsCreateProject,
    CommunityProjectsCreatePullRequest,
    CommunityProjectsCreateRepository,
    CommunityProjectsCreateTask,
    CommunityProjectsProps,
    CommunityProjectsUpdateProject,
  } from "./model.js";
  import { commitAuthorMember, commitDate } from "./commit-author.js";
  import {
    isMarkdownRepositoryPath,
    repositoryBreadcrumbSegments,
    repositoryBrowserEntries,
    repositoryParentPath,
  } from "./repository-browser.js";
  import { communityProjectsMemberForPubkey } from "./projects-member.js";
  import {
    canMaintainRepository,
    canMergeMaintainedPullRequest,
    canReviewPullRequest,
    channelIdForCoordinate,
  } from "./community-projects-permissions.js";

  import "./CommunityProjects.css";

  let {
    view,
    projects,
    selectedProject,
    repositories = [],
    repositoryOptions = [],
    selectedRepository,
    repositoryCapabilities = {},
    activity = [],
    workItemEvents = [],
    tasks = [],
    taskListFilter,
    selectedTask,
    pullRequests = [],
    reviewListFilter,
    selectedPullRequest,
    commits = [],
    commitActivity = [],
    commitBranch = "",
    repositoryBranches = [],
    selectedRepositoryBranch = "",
    selectedCommit,
    selectedCommitDetail,
    sourceError = "",
    selectedCommitError = "",
    tree,
    owners,
    selectedPath = "",
    blob,
    pullRequestDiff,
    pullRequestDiffError = "",
    members = [],
    rooms = [],
    communityEmojis = [],
    currentMemberId,
    reviewPreferenceStore,
    reviewPreferenceScope,
    loading = false,
    cachedCatalogAt,
    error = "",
    operation = "",
    canCollaborate = false,
    canManageForge = false,
    dialogRequest,
    showNavigation = true,
    showContent = true,
    showReviewHeader = true,
    onSelectView,
    onBack,
    onSelectProject,
    onSelectRepository,
    onSelectChannel, onOpenPeople,
    onOpenProfile,
    onMessageMember,
    onWaveMember,
    onCreateProject,
    onUpdateProject,
    onCreateRepository,
    onAttachRepository,
    onLoadGitHubConnections,
    onCreateGitHubConnection,
    onUpdateGitHubConnection,
    onRevalidateGitHubConnection,
    onLoadGitHubRepositories,
    onAttachGitHubRepository,
    onCreateTask,
    onSelectTask,
    onCloseTask,
    onUpdateTaskAssignment,
    onManageTaskAssignments,
    onAddTaskComment,
    onUpdateTaskLifecycle,
    onCreatePullRequest,
    onSelectPullRequest,
    onClosePullRequest,
    onApprovePullRequest,
    onRequestChanges,
    onSubmitPullRequestReview,
    onRequestPullRequestReview,
    onMergePullRequest,
    onSaveProtection,
    onUpdatePullRequestLifecycle,
    onAddPullRequestComment,
    onAddInlineComment,
    onTogglePullRequestCommentReaction,
    onLoadRepositoryRefs,
    onSelectRepositoryBranch,
    onLoadRepositoryPathCommit,
    onLoadRepositoryCommit,
    onSelectCommit,
    onCloseCommit,
    onSelectPath,
    onRetry,
  }: CommunityProjectsProps & CommunityProjectsFilterProps = $props();

  let projectDialogOpen = $state(false);
  let projectDialogMode = $state<"create" | "edit">("create");
  let projectDialogProject = $state<ProjectForgeProject>();
  let handledDialogRequestId = 0;
  let projectChannelCommandOpen = $state(false);
  let projectChannelCommandMode = $state<"home" | "attach">("home");
  let channelAttachmentProject = $state("");
  let channelAttachmentPending = $state("");
  const channelAttachmentToastId = $props.id();
  let mineProjectsOpen = $state(true);
  let otherProjectsOpen = $state(true);
  let mineRepositoriesOpen = $state(true);
  let otherRepositoriesOpen = $state(true);
  let mineTasksOpen = $state(true);
  let otherTasksOpen = $state(true);
  let repositoryDialogOpen = $state(false);
  let repositoryCommandOpen = $state(false);
  let repositoryCommandStep = $state<"repository" | "project">("repository");
  let repositoryCommandCoordinate = $state("");
  let githubCommandOpen = $state(false);
  let githubCommandStep = $state<"connection" | "repository">("connection");
  let githubConnections = $state.raw<readonly ProjectForgeGitHubConnection[]>(
    [],
  );
  let githubRepositories = $state.raw<readonly ProjectForgeGitHubRepository[]>(
    [],
  );
  let githubConnection = $state.raw<ProjectForgeGitHubConnection>();
  let githubCommandLoading = $state(false);
  let githubCommandError = $state("");
  let githubManagerOpen = $state(false);
  let githubManagerFormOpen = $state(false);
  let githubManagerConnection = $state.raw<ProjectForgeGitHubConnection>();
  let githubManagerLoading = $state(false);
  let githubManagerError = $state("");
  let githubManagerOperation = $state("");
  let githubDraft = $state({
    appId: "",
    installationId: "",
    credentialRef: "",
    webhookSecretRef: "",
    bridgeCredentialRef: "",
    bridgePubkey: "",
  });
  let taskDialogOpen = $state(false);
  let pullRequestDialogOpen = $state(false);
  let pullRequestRefs = $state.raw<ProjectForgeRefsResponse>();
  let pullRequestRefsLoading = $state(false);
  let pullRequestRefsError = $state("");
  let pullRequestRefsRequest = 0;
  let inlineCommentAnchor = $state<{
    path: string;
    side: "old" | "new";
    line: number;
  }>();
  let inlineCommentContent = $state("");
  let pullRequestComment = $state("");
  let taskComment = $state("");
  let taskDescriptionOpen = $state(true);
  let taskActivityOpen = $state(true);
  let reviewDescriptionOpen = $state(true);
  let reviewFilesOpen = $state(false);
  let reviewCommitsOpen = $state(false);
  let reviewChecksOpen = $state(false);
  let reviewActivityOpen = $state(true);
  let reviewFileFilter = $state("");
  let reviewFileListOpen = $state(true);
  let selectedReviewFilePath = $state("");
  let collapsedReviewFilePaths = $state<string[]>([]);
  let viewedReviewFilePaths = $state<string[]>([]);
  let reviewDiffViewMode = $state<FileDiffViewMode>("unified");
  let reviewFileScrollTarget = $state<FileDiffFileScrollTarget | null>(null);
  let reviewSubmissionOpen = $state(false);
  let reviewSubmissionDecision = $state<PullRequestReviewKind>("comment");
  let reviewSubmissionBody = $state("");
  let reviewSubmissionError = $state("");
  let reviewCloseConfirmationOpen = $state(false);
  let reviewCloseError = $state("");
  let selectedReviewPreferenceKey = "";
  const anonymousViewedReviewFiles = new Map<string, string[]>();
  let anonymousReviewDiffViewMode: FileDiffViewMode = "unified";
  let commitFilesOpen = $state(true);
  let commitFileFilter = $state("");
  let commitFileListOpen = $state(true);
  let selectedCommitFilePath = $state("");
  let collapsedCommitFilePaths = $state<string[]>([]);
  let commitDiffViewMode = $state<FileDiffViewMode>("unified");
  let commitFileScrollTarget = $state<FileDiffFileScrollTarget | null>(null);
  let selectedCommitStateKey = "";
  let diffFileListMode = $state<FileListingViewMode>("tree");
  let repositoryCurrentPath = $state("");
  let repositoryFileTreeOpen = $state(false);
  let repositoryPathCommits = $state.raw<
    Readonly<Record<string, ProjectForgeCommit | undefined>>
  >({});
  let repositoryCommitBatchKey = "";
  let repositoryMarkdownView = $state<"preview" | "source">("preview");
  let repositoryTreeKey = $state("");
  let repositoryPreviewPath = $state("");
  let reviewGroupOpen = $state<Record<string, boolean>>({
    open: true,
    draft: true,
    merged: true,
    closed: true,
  });
  let selectedReviewStateId = $state("");
  let pullRequestMergeError = $state("");
  let pullRequestMergeStatus = $state("");
  let localError = $state("");
  let listLayout = $state<"grid" | "list">("list");
  const effectiveSourceError = $derived(sourceError || selectedCommitError);

  function setListLayout(next: string | undefined): void {
    if (next === "grid" || next === "list") listLayout = next;
  }

  let projectDraft = $state<
    CommunityProjectsCreateProject & { visibility: "public" | "private" }
  >({
    name: "",
    identifier: "",
    description: "",
    channelId: "",
    visibility: "public",
    listing: "listed",
  });
  let repositoryDraft = $state<CommunityProjectsCreateRepository>({
    project: "",
    channelId: "",
    name: "",
    identifier: "",
    description: "",
    mode: "hosted",
    cloneUrl: "",
    webUrl: "",
  });
  let taskDraft = $state<CommunityProjectsCreateTask>({
    project: "",
    repository: "",
    category: "issue",
    title: "",
    content: "",
  });
  let pullRequestDraft = $state<CommunityProjectsCreatePullRequest>({
    repository: "",
    title: "",
    content: "",
    branchName: "",
    targetBranch: "",
  });

  const reviewableRepositories = $derived(
    repositories.filter(
      (repository) => repository.repositoryClass !== "task-anchor",
    ),
  );
  const pullRequestBranches = $derived(
    pullRequestRefs ? projectForgeBranchRefs(pullRequestRefs) : [],
  );
  const pullRequestCompareBranches = $derived(
    pullRequestBranches.filter(
      (branch) => branch.name !== pullRequestDraft.targetBranch,
    ),
  );
  const availableRepositoryOptions = $derived(
    repositoryOptions.length > 0 ? repositoryOptions : repositories,
  );
  const attachableRepositories = $derived(
    availableRepositoryOptions.filter(
      (repository) =>
        repository.repositoryClass !== "task-anchor" &&
        projects.some(
          (project) =>
            (!selectedProject ||
              project.address.coordinate ===
                selectedProject.address.coordinate) &&
            !project.repositories.some(
              (reference) =>
                reference.coordinate === repository.address.coordinate,
            ),
        ),
    ),
  );
  const taskProject = $derived(
    selectedProject ??
      projects.find(
        (project) => project.address.coordinate === taskDraft.project,
      ),
  );
  const taskRepositoryOptions = $derived(
    selectedProject === undefined
      ? availableRepositoryOptions.filter(
          (repository) => repository.repositoryClass !== "task-anchor",
        )
      : selectedProject.repositories
          .map((reference) =>
            availableRepositoryOptions.find(
              (repository) =>
                repository.address.coordinate === reference.coordinate,
            ),
          )
          .filter(
            (repository): repository is ProjectForgeRepository =>
              repository !== undefined &&
              repository.repositoryClass !== "task-anchor",
          ),
  );
  const taskHasScope = $derived(
    taskDraft.repository === "project"
      ? taskDraft.project !== ""
      : taskRepositoryOptions.some(
          (repository) =>
            repository.address.coordinate === taskDraft.repository,
        ),
  );
  const availableProjectChannels = $derived(
    rooms.filter((room) => room.kind === "channel" && !room.archived),
  );
  const channelAttachmentProjects = $derived(
    projects.filter((project) => project.event.pubkey === currentMemberId),
  );
  const channelAttachmentTarget = $derived(
    channelAttachmentProjects.find(
      (project) => project.address.coordinate === channelAttachmentProject,
    ),
  );
  const projectChannelIds = $derived(
    new Set(
      projects.flatMap((project) =>
        projectForgeBoundChannels(project, repositories).map(
          (binding) => binding.channelId,
        ),
      ),
    ),
  );
  const channelCommandOptions = $derived(
    projectChannelCommandMode === "attach" && channelAttachmentTarget
      ? availableProjectChannels.filter(
          (room) =>
            !projectForgeBoundChannels(
              channelAttachmentTarget,
              repositories,
            ).some(
              (binding) => binding.channelId === (room.groupId ?? room.id),
            ),
        )
      : availableProjectChannels,
  );
  const repositorySources = $derived(
    repositories.filter(
      (repository) => repository.repositoryClass !== "task-anchor",
    ),
  );
  const browsableRepositories = $derived(
    repositories.filter((repository) => {
      const capabilities =
        repositoryCapabilities[repository.address.coordinate];
      return capabilities === undefined
        ? repository.repositoryClass === "hosted"
        : capabilities.browse;
    }),
  );
  const matchingGitHubRepositories = $derived(
    selectedRepository === undefined
      ? []
      : githubRepositories.filter((repository) =>
          repositoryMatchesGitHubAnnouncement(selectedRepository, repository),
        ),
  );
  const activeGitHubConnections = $derived(
    githubConnections.filter((connection) => connection.status === "active"),
  );
  const projectDiffFiles = $derived(
    pullRequestDiff?.files.map((file) => ({
      ...file,
      patch:
        file.patch ??
        splitProjectForgePatch(pullRequestDiff.patch).find(
          (candidate) => candidate.path === file.path,
        )?.patch ??
        "",
    })) ?? [],
  );
  const visibleProjectDiffFiles = $derived(
    reviewFileFilter.trim()
      ? projectDiffFiles.filter((file) =>
          file.path
            .toLocaleLowerCase()
            .includes(reviewFileFilter.trim().toLocaleLowerCase()),
        )
      : projectDiffFiles,
  );
  const viewedReviewFileCount = $derived(
    projectDiffFiles.filter((file) => viewedReviewFilePaths.includes(file.path))
      .length,
  );
  const selectedCommitValue = $derived(
    selectedCommitDetail?.commit ?? selectedCommit,
  );
  const commitDiffFiles = $derived.by(() => {
    const parsed = selectedCommitDetail?.patch
      ? splitProjectForgePatch(selectedCommitDetail.patch)
      : [];
    const byPath = new Map(parsed.map((file) => [file.path, file]));
    const stats = selectedCommitDetail?.stats ?? [];
    if (stats.length === 0) return parsed;
    const fromStats = stats.map((stat) => {
      const file = byPath.get(stat.path);
      byPath.delete(stat.path);
      return {
        path: stat.path,
        ...(stat.old_path ? { old_path: stat.old_path } : {}),
        status: file?.status ?? "modified",
        additions: stat.additions,
        deletions: stat.deletions,
        ...(stat.binary || file?.binary ? { binary: true } : {}),
        patch: file?.patch ?? "",
      };
    });
    return [...fromStats, ...byPath.values()];
  });
  const visibleCommitDiffFiles = $derived(
    commitFileFilter.trim()
      ? commitDiffFiles.filter((file) =>
          file.path
            .toLocaleLowerCase()
            .includes(commitFileFilter.trim().toLocaleLowerCase()),
        )
      : commitDiffFiles,
  );
  const commitAdditions = $derived(
    commitDiffFiles.reduce((total, file) => total + file.additions, 0),
  );
  const commitDeletions = $derived(
    commitDiffFiles.reduce((total, file) => total + file.deletions, 0),
  );
  const repositoryEntries = $derived(
    repositoryBrowserEntries(tree?.entries ?? [], repositoryCurrentPath),
  );
  const repositoryFileTreeEntries = $derived(
    (tree?.entries ?? [])
      .filter((entry) => entry.type === "blob")
      .map((entry) => ({ path: entry.path ?? entry.name })),
  );
  const repositoryName = $derived(
    selectedRepository?.name ?? browsableRepositories[0]?.name ?? "Repository",
  );
  const activeRepositoryBranch = $derived(
    selectedRepositoryBranch || tree?.ref || commitBranch,
  );
  const repositoryDirectoryBreadcrumbs = $derived(
    repositoryBreadcrumbSegments(repositoryCurrentPath),
  );
  const repositorySelectedPath = $derived(selectedPath || blob?.path || "");
  const repositorySelectedBlob = $derived(
    blob?.path === repositorySelectedPath ? blob : undefined,
  );
  const repositorySelectedParentPath = $derived(
    repositoryParentPath(repositorySelectedPath),
  );
  const repositorySelectedBreadcrumbs = $derived(
    repositoryBreadcrumbSegments(repositorySelectedParentPath),
  );
  const repositorySelectedIsMarkdown = $derived(
    isMarkdownRepositoryPath(repositorySelectedPath),
  );

  function openRepositoryDirectory(path: string): void {
    repositoryCurrentPath = path;
    if (selectedPath) onSelectPath?.("");
  }

  function selectRepositoryBranch(value: string | undefined): void {
    if (!value || value === activeRepositoryBranch) return;
    repositoryCurrentPath = "";
    repositoryPreviewPath = "";
    repositoryPathCommits = {};
    repositoryCommitBatchKey = "";
    onSelectRepositoryBranch?.(value);
  }

  function openRepositoryFile(path: string): void {
    if (!path || path === selectedPath) return;
    onSelectPath?.(path);
  }

  $effect(() => {
    const nextTreeKey = tree ? `${tree.ref}:${tree.sha}` : "";
    if (repositoryTreeKey === nextTreeKey) return;
    repositoryTreeKey = nextTreeKey;
    repositoryCurrentPath = "";
    repositoryPreviewPath = "";
    repositoryPathCommits = {};
    repositoryCommitBatchKey = "";
    repositoryMarkdownView = "preview";
  });

  $effect(() => {
    const loadCommit = onLoadRepositoryPathCommit;
    const entries = repositoryEntries;
    const treeKey = tree ? `${tree.ref}:${tree.sha}` : "";
    const batchKey = `${treeKey}:${repositoryCurrentPath}:${entries
      .map((entry) => entry.path)
      .join("|")}`;
    if (!loadCommit || !treeKey || batchKey === repositoryCommitBatchKey)
      return;
    repositoryCommitBatchKey = batchKey;
    const controller = new AbortController();
    void Promise.all(
      entries.map(async (entry) => {
        try {
          const commit = await loadCommit(entry.path, controller.signal);
          return [entry.path, commit] as const;
        } catch {
          return [entry.path, undefined] as const;
        }
      }),
    ).then((results) => {
      if (controller.signal.aborted) return;
      repositoryPathCommits = {
        ...repositoryPathCommits,
        ...Object.fromEntries(results),
      };
    });
    return () => controller.abort();
  });

  $effect(() => {
    if (view !== "files") return;
    if (!selectedPath) {
      repositoryPreviewPath = "";
      return;
    }
    repositoryCurrentPath = repositoryParentPath(selectedPath);
    if (repositoryPreviewPath === selectedPath) return;
    repositoryPreviewPath = selectedPath;
    repositoryMarkdownView = "preview";
  });
  const busy = $derived(operation !== "");
  const listedProjects = $derived(
    projects.filter((project) => project.listing === "listed"),
  );
  const mineProjects = $derived(
    currentMemberId
      ? listedProjects.filter(
          (project) => project.event.pubkey === currentMemberId,
        )
      : [],
  );
  const otherProjects = $derived(
    currentMemberId
      ? listedProjects.filter(
          (project) => project.event.pubkey !== currentMemberId,
        )
      : listedProjects,
  );
  const visibleRepositories = $derived(
    repositories.filter(
      (repository) => repository.repositoryClass !== "task-anchor",
    ),
  );
  const mineRepositories = $derived(
    currentMemberId
      ? visibleRepositories.filter(
          (repository) => repository.event.pubkey === currentMemberId,
        )
      : [],
  );
  const otherRepositories = $derived(
    currentMemberId
      ? visibleRepositories.filter(
          (repository) => repository.event.pubkey !== currentMemberId,
        )
      : visibleRepositories,
  );
  const scopedTasks = $derived(
    scopeProjectTasks(tasks, {
      repositoryCoordinate: selectedRepository?.address.coordinate,
      projectRepositoryCoordinates: selectedProject
        ? selectedProject.repositories.map(
            (repository) => repository.coordinate,
          )
        : undefined,
      filter: taskListFilter,
    }),
  );
  const mineTasks = $derived(
    currentMemberId
      ? scopedTasks.filter((task) => taskIsMine(task, currentMemberId))
      : [],
  );
  const otherTasks = $derived(
    currentMemberId
      ? scopedTasks.filter((task) => !taskIsMine(task, currentMemberId))
      : scopedTasks,
  );
  const groupByRepository = $derived(
    Boolean(selectedProject && !selectedRepository),
  );
  const visibleActivity = $derived(
    selectedProject && !selectedRepository
      ? projectVisibleActivity(activity, selectedProject, repositories)
      : repositoryVisibleActivity(activity, repositories, selectedRepository),
  );
  const taskRepositorySections = $derived(
    groupItemsByProjectRepository(
      scopedTasks,
      repositories,
      (task) => task.repository.coordinate,
    ),
  );
  const reviewRepositorySections = $derived(
    groupItemsByProjectRepository(
      pullRequests.filter(pullRequestBelongsToSelectedProject),
      repositories,
      (pullRequest) => pullRequest.repository.coordinate,
    ),
  );
  const contributorRepositorySections = $derived(
    projectRepositoryContributorGroups(repositories, rooms, members),
  );
  const overviewTabs = PROJECT_DIRECTORY_TABS;
  const projectTabs = PROJECT_WORKSPACE_TABS;
  const projectChannels = $derived(
    selectedProject
      ? projectForgeBoundChannels(selectedProject, repositories).map(
          (binding) => ({
            ...binding,
            projectCoordinate: selectedProject.address.coordinate,
          }),
        )
      : projects.flatMap((project) =>
          projectForgeBoundChannels(project, repositories).map((binding) => ({
            ...binding,
            projectCoordinate: project.address.coordinate,
          })),
        ),
  );
  const projectHomeChannel = $derived(
    selectedProject
      ? projectChannels.find((binding) => binding.role === "home")
      : undefined,
  );

  $effect(() => {
    const request = dialogRequest;
    if (!request || request.id === handledDialogRequestId) return;
    handledDialogRequestId = request.id;
    if (request.kind === "project") openProjectDialog();
    if (request.kind === "channel")
      openChannelAttachment(request.projectCoordinate);
    if (request.kind === "edit-project")
      openProjectDialog(
        projects.find(
          (project) => project.address.coordinate === request.projectCoordinate,
        ) ?? selectedProject,
      );
    if (request.kind === "repository") openRepositoryDialog();
    if (request.kind === "select-repository") openRepositoryCommand();
    if (request.kind === "connect-github") void openGitHubCommand();
    if (request.kind === "manage-github") void openGitHubManager();
    if (request.kind === "task") openTaskDialog();
    if (request.kind === "review") openPullRequestDialog();
  });

  $effect(() => {
    const nextId = selectedPullRequest?.root.id ?? "";
    if (nextId === selectedReviewStateId) return;
    selectedReviewStateId = nextId;
    reviewDescriptionOpen = true;
    reviewFilesOpen = false;
    reviewCommitsOpen = false;
    reviewChecksOpen = false;
    reviewActivityOpen = true;
    reviewFileFilter = "";
    selectedReviewFilePath = "";
    collapsedReviewFilePaths = [];
    viewedReviewFilePaths = [];
    reviewFileScrollTarget = null;
    reviewSubmissionOpen = false;
    reviewSubmissionDecision = "comment";
    reviewSubmissionBody = "";
    reviewSubmissionError = "";
    reviewCloseConfirmationOpen = false;
    reviewCloseError = "";
    selectedReviewPreferenceKey = "";
    pullRequestMergeError = "";
    pullRequestMergeStatus = "";
  });

  $effect(() => {
    const pullRequest = selectedPullRequest;
    if (!pullRequest) return;
    const base = pullRequestDiff?.base || pullRequest.mergeBase;
    const head = pullRequestDiff?.head || pullRequest.currentCommit;
    const fileSignature = projectDiffFiles.map((file) => file.path).join("\0");
    const scopeKey = reviewPreferenceScope
      ? `${reviewPreferenceScope.relayUrl}:${reviewPreferenceScope.communityId}:${reviewPreferenceScope.memberId}`
      : "anonymous";
    const preferenceKey = [
      scopeKey,
      pullRequest.repository.coordinate,
      pullRequest.root.id,
      base,
      head,
      fileSignature,
    ].join(":");
    if (preferenceKey === selectedReviewPreferenceKey) return;
    selectedReviewPreferenceKey = preferenceKey;

    selectedReviewFilePath = projectDiffFiles[0]?.path ?? "";
    collapsedReviewFilePaths = [];
    const viewedScope = currentReviewViewedFilesScope();
    viewedReviewFilePaths = (
      viewedScope && reviewPreferenceStore
        ? reviewPreferenceStore.loadViewedFiles(viewedScope)
        : (anonymousViewedReviewFiles.get(anonymousReviewKey()) ?? [])
    ).filter((path) => projectDiffFiles.some((file) => file.path === path));
    reviewDiffViewMode =
      (reviewPreferenceScope && reviewPreferenceStore
        ? reviewPreferenceStore.loadDiffViewMode(reviewPreferenceScope)
        : anonymousReviewDiffViewMode) ?? "unified";
  });

  $effect(() => {
    const commit = selectedCommitValue;
    if (!commit) return;
    const fileSignature = commitDiffFiles.map((file) => file.path).join("\0");
    const stateKey = `${commit.sha}:${fileSignature}`;
    if (stateKey === selectedCommitStateKey) return;
    selectedCommitStateKey = stateKey;
    commitFilesOpen = true;
    commitFileFilter = "";
    commitFileListOpen = true;
    selectedCommitFilePath = commitDiffFiles[0]?.path ?? "";
    collapsedCommitFilePaths = [];
    commitFileScrollTarget = null;
    commitDiffViewMode =
      (reviewPreferenceScope && reviewPreferenceStore
        ? reviewPreferenceStore.loadDiffViewMode(reviewPreferenceScope)
        : anonymousReviewDiffViewMode) ?? "unified";
  });

  function projectName(coordinate: string): string {
    return (
      projects.find((project) => project.address.coordinate === coordinate)
        ?.name ?? "project"
    );
  }

  function activityMember(pubkey: string): CommunityMemberModel {
    return memberForPubkey(pubkey || "relay");
  }

  function resetError(): void {
    localError = "";
  }

  function projectIdentifier(name: string): string {
    return name
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 1_024);
  }

  function openProjectDialog(project?: ProjectForgeProject): void {
    resetError();
    projectDialogMode = project ? "edit" : "create";
    projectDialogProject = project;
    projectDraft = project
      ? {
          name: project.name,
          identifier: project.address.identifier,
          description: project.description,
          channelId: project.channelId,
          visibility: "public",
          listing: project.listing,
        }
      : {
          name: "",
          identifier: "",
          description: "",
          channelId: "",
          visibility: "public",
          listing: "listed",
        };
    if (!projectDraft.channelId) {
      const channel = availableProjectChannels[0];
      if (channel) {
        projectDraft.channelId = channel.groupId ?? channel.id;
        projectDraft.visibility = channel.private ? "private" : "public";
      }
    } else {
      const channel = availableProjectChannels.find(
        (candidate) =>
          (candidate.groupId ?? candidate.id) === projectDraft.channelId,
      );
      projectDraft.visibility = channel?.private ? "private" : "public";
    }
    projectDialogOpen = true;
  }

  function openRepositoryDialog(): void {
    resetError();
    if (selectedProject) {
      repositoryDraft.project = selectedProject.address.coordinate;
      repositoryDraft.channelId = selectedProject.channelId;
    } else if (
      !projects.some(
        (project) => project.address.coordinate === repositoryDraft.project,
      )
    ) {
      repositoryDraft.project = "";
    }
    repositoryDialogOpen = true;
  }

  function selectRepositoryProject(projectCoordinate: string): void {
    if (projectCoordinate === "none") {
      repositoryDraft.project = "";
      repositoryDraft.channelId = "";
      return;
    }
    const project = projects.find(
      (candidate) => candidate.address.coordinate === projectCoordinate,
    );
    if (!project) return;
    repositoryDraft.project = projectCoordinate;
    repositoryDraft.channelId = project.channelId;
  }

  function openRepositoryCommand(): void {
    resetError();
    repositoryCommandStep = "repository";
    repositoryCommandCoordinate = "";
    repositoryCommandOpen = true;
  }

  function openTaskDialog(): void {
    resetError();
    if (selectedRepository) {
      taskDraft.project = "";
      taskDraft.repository = selectedRepository.address.coordinate;
    } else if (selectedProject) {
      taskDraft.project = selectedProject.address.coordinate;
      taskDraft.repository = "project";
    } else {
      taskDraft.project = "";
      if (
        taskDraft.repository === "project" ||
        !taskRepositoryOptions.some(
          (repository) =>
            repository.address.coordinate === taskDraft.repository,
        )
      )
        taskDraft.repository = "";
    }
    taskDialogOpen = true;
  }

  function selectTaskProject(projectCoordinate: string): void {
    if (projectCoordinate === "none") {
      taskDraft.project = "";
      if (taskDraft.repository === "project") taskDraft.repository = "";
      return;
    }
    taskDraft.project = projectCoordinate;
    taskDraft.repository = "project";
  }

  function selectTaskRepository(repositoryCoordinate: string): void {
    taskDraft.repository = repositoryCoordinate;
    if (!selectedProject && repositoryCoordinate !== "project") {
      taskDraft.project = "";
    }
  }

  async function selectPullRequestRepository(
    repositoryCoordinate: string,
  ): Promise<void> {
    const repository = reviewableRepositories.find(
      (candidate) => candidate.address.coordinate === repositoryCoordinate,
    );
    if (!repository) return;
    const request = ++pullRequestRefsRequest;
    pullRequestDraft.repository = repositoryCoordinate;
    pullRequestDraft.branchName = "";
    pullRequestDraft.targetBranch = "";
    pullRequestRefs = undefined;
    pullRequestRefsError = "";
    pullRequestRefsLoading = true;
    try {
      if (!onLoadRepositoryRefs)
        throw new Error("Repository branches are unavailable");
      const refs = await onLoadRepositoryRefs(repositoryCoordinate);
      if (request !== pullRequestRefsRequest) return;
      pullRequestRefs = refs;
      const branches = projectForgeBranchRefs(refs);
      pullRequestDraft.targetBranch =
        (refs.head ? projectForgeBranchName(refs.head.name) : undefined) ??
        branches[0]?.name ??
        "";
    } catch (cause) {
      if (request !== pullRequestRefsRequest) return;
      pullRequestRefsError =
        cause instanceof Error
          ? cause.message
          : "Repository branches could not be loaded";
    } finally {
      if (request === pullRequestRefsRequest) pullRequestRefsLoading = false;
    }
  }

  function openPullRequestDialog(): void {
    resetError();
    const repository =
      selectedRepository !== undefined &&
      selectedRepository.repositoryClass !== "task-anchor"
        ? selectedRepository
        : reviewableRepositories[0];
    if (repository)
      void selectPullRequestRepository(repository.address.coordinate);
    pullRequestDialogOpen = true;
  }

  function repositoryAttachmentProjects(repositoryCoordinate: string) {
    return projects.filter(
      (project) =>
        (!selectedProject ||
          project.address.coordinate === selectedProject.address.coordinate) &&
        !project.repositories.some(
          (reference) => reference.coordinate === repositoryCoordinate,
        ),
    );
  }

  async function attachExistingRepository(
    projectCoordinate: string,
    repositoryCoordinate: string,
  ): Promise<void> {
    resetError();
    try {
      await onAttachRepository?.(projectCoordinate, repositoryCoordinate);
      repositoryCommandOpen = false;
      repositoryCommandStep = "repository";
      repositoryCommandCoordinate = "";
    } catch (cause) {
      localError =
        cause instanceof Error
          ? cause.message
          : "Repository could not be attached";
    }
  }

  function selectExistingRepository(
    repository: (typeof availableRepositoryOptions)[number],
  ): void {
    const targets = repositoryAttachmentProjects(repository.address.coordinate);
    if (selectedProject && targets[0]) {
      void attachExistingRepository(
        targets[0].address.coordinate,
        repository.address.coordinate,
      );
      return;
    }
    repositoryCommandCoordinate = repository.address.coordinate;
    repositoryCommandStep = "project";
  }

  async function openGitHubCommand(): Promise<void> {
    resetError();
    githubCommandError = "";
    githubCommandStep = "connection";
    githubConnection = undefined;
    githubRepositories = [];
    githubCommandOpen = true;
    if (!canManageForge) {
      githubCommandError =
        "Relay administrator access is required to connect a GitHub App.";
      return;
    }
    if (!selectedRepository || !onLoadGitHubConnections) {
      githubCommandError =
        "Open an external repository before connecting GitHub.";
      return;
    }
    githubCommandLoading = true;
    try {
      const response = await onLoadGitHubConnections();
      githubConnections = response.connections;
    } catch (cause) {
      githubCommandError =
        cause instanceof Error
          ? cause.message
          : "GitHub App connections could not be loaded";
    } finally {
      githubCommandLoading = false;
    }
  }

  async function refreshGitHubConnections(): Promise<void> {
    if (!onLoadGitHubConnections) {
      githubManagerError = "GitHub App connection management is unavailable.";
      return;
    }
    githubManagerLoading = true;
    githubManagerError = "";
    try {
      githubConnections = (await onLoadGitHubConnections()).connections;
    } catch (cause) {
      githubManagerError =
        cause instanceof Error
          ? cause.message
          : "GitHub App connections could not be loaded";
    } finally {
      githubManagerLoading = false;
    }
  }

  async function openGitHubManager(): Promise<void> {
    githubCommandOpen = false;
    githubManagerFormOpen = false;
    githubManagerConnection = undefined;
    githubManagerError = "";
    githubManagerOpen = true;
    if (!canManageForge) {
      githubManagerError =
        "Relay administrator access is required to manage GitHub App connections.";
      return;
    }
    await refreshGitHubConnections();
  }

  function openGitHubConnectionForm(
    connection?: ProjectForgeGitHubConnection,
  ): void {
    githubManagerConnection = connection;
    githubDraft = {
      appId: "",
      installationId: connection ? String(connection.installation_id) : "",
      credentialRef: "",
      webhookSecretRef: "",
      bridgeCredentialRef: "",
      bridgePubkey: connection?.bridge_pubkey ?? "",
    };
    githubManagerError = "";
    githubManagerFormOpen = true;
  }

  function githubConnectionInput(): ProjectForgeGitHubConnectionInput {
    return {
      appId: githubDraft.appId.trim(),
      installationId: Number(githubDraft.installationId),
      credentialRef: githubDraft.credentialRef.trim(),
      webhookSecretRef: githubDraft.webhookSecretRef.trim(),
      bridgeCredentialRef: githubDraft.bridgeCredentialRef.trim(),
      bridgePubkey: githubDraft.bridgePubkey.trim(),
    };
  }

  async function submitGitHubConnection(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const input = githubConnectionInput();
    if (
      !Number.isSafeInteger(input.installationId) ||
      input.installationId <= 0
    ) {
      githubManagerError = "Enter a valid GitHub installation ID.";
      return;
    }
    const update = githubManagerConnection;
    const action = update ? onUpdateGitHubConnection : onCreateGitHubConnection;
    if (!action) {
      githubManagerError = "GitHub App connection changes are unavailable.";
      return;
    }
    githubManagerOperation = update
      ? "Replacing configuration…"
      : "Adding connection…";
    githubManagerError = "";
    try {
      const connection = update
        ? await onUpdateGitHubConnection?.(update.id, input)
        : await onCreateGitHubConnection?.(input);
      if (!connection)
        throw new Error("The relay did not return the GitHub App connection");
      githubConnections = update
        ? githubConnections.map((candidate) =>
            candidate.id === connection.id ? connection : candidate,
          )
        : [...githubConnections, connection];
      githubManagerFormOpen = false;
      githubManagerConnection = undefined;
    } catch (cause) {
      githubManagerError =
        cause instanceof Error
          ? cause.message
          : "The GitHub App connection could not be saved";
    } finally {
      githubManagerOperation = "";
    }
  }

  async function revalidateGitHubConnection(
    connection: ProjectForgeGitHubConnection,
  ): Promise<void> {
    if (!onRevalidateGitHubConnection) {
      githubManagerError = "GitHub App revalidation is unavailable.";
      return;
    }
    githubManagerOperation = `Revalidating @${connection.account_login || "GitHub"}…`;
    githubManagerError = "";
    try {
      const refreshed = await onRevalidateGitHubConnection(connection.id);
      githubConnections = githubConnections.map((candidate) =>
        candidate.id === refreshed.id ? refreshed : candidate,
      );
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : "The GitHub App connection could not be revalidated";
      await refreshGitHubConnections();
      githubManagerError = message;
    } finally {
      githubManagerOperation = "";
    }
  }

  async function selectGitHubConnection(
    connection: ProjectForgeGitHubConnection,
  ): Promise<void> {
    githubConnection = connection;
    githubCommandStep = "repository";
    githubCommandError = "";
    githubRepositories = [];
    if (!onLoadGitHubRepositories) return;
    githubCommandLoading = true;
    try {
      const response = await onLoadGitHubRepositories(connection.id);
      githubRepositories = response.repositories;
    } catch (cause) {
      githubCommandError =
        cause instanceof Error
          ? cause.message
          : "GitHub repositories could not be loaded";
    } finally {
      githubCommandLoading = false;
    }
  }

  async function attachGitHubRepository(
    providerRepository: ProjectForgeGitHubRepository,
  ): Promise<void> {
    if (!selectedRepository || !githubConnection || !onAttachGitHubRepository)
      return;
    githubCommandError = "";
    try {
      await onAttachGitHubRepository(
        selectedRepository,
        githubConnection,
        providerRepository,
      );
      githubCommandOpen = false;
    } catch (cause) {
      githubCommandError =
        cause instanceof Error
          ? cause.message
          : "The repository could not be connected to GitHub";
    }
  }

  function openChannelAttachment(
    projectCoordinate = selectedProject?.address.coordinate,
  ): void {
    if (!canCollaborate || !onUpdateProject || busy || channelAttachmentPending)
      return;
    projectChannelCommandMode = "attach";
    channelAttachmentProject =
      channelAttachmentProjects.find(
        (project) => project.address.coordinate === projectCoordinate,
      )?.address.coordinate ??
      (channelAttachmentProjects.length === 1
        ? channelAttachmentProjects[0]!.address.coordinate
        : "");
    projectChannelCommandOpen = true;
  }

  async function attachProjectChannel(
    channel: CommunityRoomModel,
  ): Promise<void> {
    const project = channelAttachmentTarget;
    if (
      !project ||
      !onUpdateProject ||
      !canCollaborate ||
      busy ||
      channelAttachmentPending
    )
      return;
    channelAttachmentPending = channel.id;
    toast.dismiss(channelAttachmentToastId);
    try {
      await onUpdateProject(project, {
        name: project.name,
        description: project.description,
        channelId: project.channelId,
        listing: project.listing,
        relatedChannelIds: [
          ...new Set([
            ...project.relatedChannelIds,
            channel.groupId ?? channel.id,
          ]),
        ],
      });
      projectChannelCommandOpen = false;
    } catch (cause) {
      toast.error("Channel could not be added", {
        id: channelAttachmentToastId,
        description:
          cause instanceof Error ? cause.message : "Please try again.",
      });
    } finally {
      channelAttachmentPending = "";
    }
  }

  function selectProjectChannel(
    channel: (typeof availableProjectChannels)[number],
  ): void {
    projectDraft.channelId = channel.groupId ?? channel.id;
    projectDraft.visibility = channel.private ? "private" : "public";
    projectChannelCommandOpen = false;
  }

  async function submitProject(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    resetError();
    try {
      if (projectDialogMode === "edit" && projectDialogProject) {
        const update: CommunityProjectsUpdateProject = {
          name: projectDraft.name,
          description: projectDraft.description,
          channelId: projectDraft.channelId,
          listing: projectDraft.listing,
        };
        await onUpdateProject?.(projectDialogProject, update);
      } else {
        await onCreateProject?.({
          name: projectDraft.name,
          identifier: projectIdentifier(projectDraft.name),
          description: projectDraft.description,
          channelId: projectDraft.channelId,
          listing: projectDraft.listing,
        });
      }
      projectDialogOpen = false;
      projectDialogMode = "create";
      projectDialogProject = undefined;
      projectDraft = {
        name: "",
        identifier: "",
        description: "",
        channelId: "",
        visibility: "public",
        listing: "listed",
      };
    } catch (cause) {
      localError =
        cause instanceof Error
          ? cause.message
          : projectDialogMode === "edit"
            ? "Project settings could not be saved"
            : "Project could not be created";
    }
  }

  async function submitRepository(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    resetError();
    try {
      await onCreateRepository?.({
        ...repositoryDraft,
        identifier: projectIdentifier(repositoryDraft.name),
      });
      repositoryDialogOpen = false;
      repositoryDraft = {
        project: selectedProject?.address.coordinate ?? "",
        channelId: selectedProject?.channelId ?? "",
        name: "",
        identifier: "",
        description: "",
        mode: "hosted",
        cloneUrl: "",
        webUrl: "",
      };
    } catch (cause) {
      localError =
        cause instanceof Error
          ? cause.message
          : "Repository could not be added";
    }
  }

  async function submitTask(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    resetError();
    try {
      await onCreateTask?.(taskDraft);
      taskDialogOpen = false;
      taskDraft = {
        project: selectedProject?.address.coordinate ?? "",
        repository: selectedProject ? "project" : "",
        category: "issue",
        title: "",
        content: "",
      };
    } catch (cause) {
      localError =
        cause instanceof Error ? cause.message : "Task could not be created";
    }
  }

  async function submitPullRequest(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    resetError();
    try {
      await onCreatePullRequest?.(pullRequestDraft);
      pullRequestDialogOpen = false;
      pullRequestDraft = {
        repository: "",
        title: "",
        content: "",
        branchName: "",
        targetBranch: "",
      };
      pullRequestRefs = undefined;
      pullRequestRefsError = "";
    } catch (cause) {
      localError =
        cause instanceof Error
          ? cause.message
          : "Pull request could not be created";
    }
  }

  function addLineComment(context: FileDiffLineContext): void {
    if (!selectedPullRequest || context.lineNumber === null) return;
    inlineCommentAnchor = {
      path: context.path,
      side: context.variant === "removed" ? "old" : "new",
      line: context.lineNumber,
    };
    inlineCommentContent = "";
  }

  async function submitInlineComment(content: string): Promise<void> {
    if (!selectedPullRequest || !inlineCommentAnchor || !content.trim()) return;
    await onAddInlineComment?.(selectedPullRequest, {
      ...inlineCommentAnchor,
      content: content.trim(),
    });
    inlineCommentAnchor = undefined;
    inlineCommentContent = "";
  }

  async function submitPullRequestComment(content: string): Promise<void> {
    if (!selectedPullRequest || !content.trim()) return;
    await onAddPullRequestComment?.(selectedPullRequest, content.trim());
    pullRequestComment = "";
  }

  async function submitTaskComment(content: string): Promise<void> {
    if (!selectedTask || !content.trim()) return;
    await onAddTaskComment?.(selectedTask, content.trim());
    taskComment = "";
  }

  function taskComments(task: (typeof tasks)[number]) {
    return task.activity.filter(
      (entry) => !entry.assignment && entry.event.content.trim() !== "",
    );
  }

  function taskMessage(
    entry: (typeof tasks)[number]["activity"][number],
  ): CommunityMessageModel {
    const createdAt = new Date(entry.event.created_at * 1_000);
    return {
      id: entry.event.id,
      authorId: entry.event.pubkey,
      content: entry.event.content,
      sourceEvent: entry.event,
      timestamp: new Intl.DateTimeFormat("en", {
        hour: "numeric",
        minute: "2-digit",
      }).format(createdAt),
      createdAt: createdAt.toISOString(),
    };
  }

  function taskRepositoryName(task: (typeof tasks)[number]): string {
    return (
      repositories.find(
        (repository) =>
          repository.address.coordinate === task.repository.coordinate,
      )?.name ?? task.repository.identifier
    );
  }

  function repositoryTaskCount(coordinate: string): number {
    return tasks.filter((task) => task.repository.coordinate === coordinate)
      .length;
  }

  function repositoryReviewCount(coordinate: string): number {
    return pullRequests.filter(
      (pullRequest) => pullRequest.repository.coordinate === coordinate,
    ).length;
  }

  function repositoryCommitCount(coordinate: string): number {
    return new Set(
      activity
        .filter(
          (item) =>
            item.kind === "commit" && item.repositoryCoordinate === coordinate,
        )
        .map((item) => item.id),
    ).size;
  }

  function repositoryActivitySummary(coordinate: string) {
    const commits = repositoryCommitCount(coordinate);
    const reviews = repositoryReviewCount(coordinate);
    const taskCount = repositoryTaskCount(coordinate);
    return {
      commits,
      reviews,
      tasks: taskCount,
      total: commits + reviews + taskCount,
    };
  }

  function repositoryUpdatedAt(repository: ProjectForgeRepository): number {
    const coordinate = repository.address.coordinate;
    return Math.max(
      repository.event.created_at,
      ...tasks
        .filter((task) => task.repository.coordinate === coordinate)
        .map((task) => task.updatedAt),
      ...pullRequests
        .filter(
          (pullRequest) => pullRequest.repository.coordinate === coordinate,
        )
        .map((pullRequest) => pullRequest.updatedAt),
      ...activity
        .filter(
          (item) =>
            item.kind === "commit" && item.repositoryCoordinate === coordinate,
        )
        .map((item) => item.createdAt),
    );
  }

  function taskStatusLabel(
    lifecycle: (typeof tasks)[number]["lifecycle"],
  ): string {
    if (lifecycle === "applied") return "Done";
    return lifecycle[0]!.toUpperCase() + lifecycle.slice(1);
  }

  function taskCategoryLabel(task: (typeof tasks)[number]): string {
    if (task.labels.includes("change-request")) return "Change request";
    if (task.labels.includes("improvement")) return "Improvement";
    return "Issue";
  }

  function channelName(binding: (typeof projectChannels)[number]): string {
    return (
      rooms.find(
        (candidate) =>
          candidate.groupId === binding.channelId ||
          candidate.id === binding.channelId,
      )?.name ?? binding.channelId
    );
  }

  function channelProject(
    binding: (typeof projectChannels)[number],
  ): ProjectForgeProject | undefined {
    return (
      selectedProject ??
      projects.find(
        (project) => project.address.coordinate === binding.projectCoordinate,
      )
    );
  }

  function channelAttachedThroughRepository(
    project: ProjectForgeProject,
    channelId: string,
  ): boolean {
    return project.repositories.some((reference) =>
      repositories.some(
        (repository) =>
          repository.address.coordinate === reference.coordinate &&
          repository.channelId === channelId,
      ),
    );
  }

  function canRemoveProjectChannel(
    project: ProjectForgeProject,
    binding: (typeof projectChannels)[number],
  ): boolean {
    return (
      binding.role === "related" &&
      project.relatedChannelIds.includes(binding.channelId) &&
      !channelAttachedThroughRepository(project, binding.channelId)
    );
  }

  function channelRemovalLabel(
    project: ProjectForgeProject,
    binding: (typeof projectChannels)[number],
  ): string {
    if (binding.role === "home") return "Project home channel";
    if (channelAttachedThroughRepository(project, binding.channelId)) {
      return "Attached through repository";
    }
    return "Remove from project";
  }

  async function removeProjectChannel(
    project: ProjectForgeProject,
    binding: (typeof projectChannels)[number],
  ): Promise<void> {
    if (!canRemoveProjectChannel(project, binding) || !onUpdateProject) return;
    resetError();
    try {
      await onUpdateProject(project, {
        name: project.name,
        description: project.description,
        channelId: project.channelId,
        listing: project.listing,
        relatedChannelIds: project.relatedChannelIds.filter(
          (channelId) => channelId !== binding.channelId,
        ),
      });
    } catch (cause) {
      localError =
        cause instanceof Error
          ? cause.message
          : "The channel could not be removed from this project";
    }
  }

  function sortedChannels(
    bindings: readonly (typeof projectChannels)[number][],
  ) {
    return [...bindings].sort((left, right) =>
      channelName(left).localeCompare(channelName(right)),
    );
  }

  function roomActivityTimestamp(
    room: CommunityRoomModel | undefined,
  ): number | undefined {
    if (!room?.lastActivityAt) return undefined;
    const timestamp = Date.parse(room.lastActivityAt);
    return Number.isNaN(timestamp) ? undefined : Math.floor(timestamp / 1_000);
  }

  function openActivityItem(item: (typeof activity)[number]): void {
    if (
      item.kind === "task" ||
      item.kind === "comment" ||
      item.kind === "assignment"
    ) {
      const task = tasks.find(
        (candidate) =>
          candidate.repository.coordinate === item.repositoryCoordinate &&
          candidate.title === item.title,
      );
      if (task) {
        onSelectTask?.(task);
        return;
      }
    }
    const project = projects.find(
      (candidate) => candidate.address.coordinate === item.projectCoordinate,
    );
    if (project) onSelectProject?.(project);
  }

  function openActivityProject(coordinate: string): void {
    const project = projects.find(
      (candidate) => candidate.address.coordinate === coordinate,
    );
    if (project) onSelectProject?.(project);
  }

  function lineSide(context: FileDiffLineContext): "old" | "new" {
    return context.variant === "removed" ? "old" : "new";
  }

  function currentReviewViewedFilesScope():
    | ProjectReviewViewedFilesScope
    | undefined {
    if (!reviewPreferenceScope || !selectedPullRequest) return undefined;
    return {
      ...reviewPreferenceScope,
      repository: selectedPullRequest.repository.coordinate,
      pullRequestId: selectedPullRequest.root.id,
      base: pullRequestDiff?.base || selectedPullRequest.mergeBase,
      head: pullRequestDiff?.head || selectedPullRequest.currentCommit,
    };
  }

  function anonymousReviewKey(): string {
    if (!selectedPullRequest) return "";
    return [
      selectedPullRequest.repository.coordinate,
      selectedPullRequest.root.id,
      pullRequestDiff?.base || selectedPullRequest.mergeBase,
      pullRequestDiff?.head || selectedPullRequest.currentCommit,
    ].join(":");
  }

  function selectReviewFile(path: string): void {
    selectedReviewFilePath = path;
    collapsedReviewFilePaths = collapsedReviewFilePaths.filter(
      (candidate) => candidate !== path,
    );
    reviewFileScrollTarget = {
      path,
      requestId: Number(reviewFileScrollTarget?.requestId ?? 0) + 1,
    };
  }

  function toggleReviewFile(path: string, collapsed: boolean): void {
    collapsedReviewFilePaths = collapsed
      ? [...new Set([...collapsedReviewFilePaths, path])]
      : collapsedReviewFilePaths.filter((candidate) => candidate !== path);
  }

  function setReviewFileViewed(path: string, viewed: boolean): void {
    viewedReviewFilePaths = viewed
      ? [...new Set([...viewedReviewFilePaths, path])]
      : viewedReviewFilePaths.filter((candidate) => candidate !== path);
    const scope = currentReviewViewedFilesScope();
    if (scope && reviewPreferenceStore) {
      reviewPreferenceStore.saveViewedFiles(scope, viewedReviewFilePaths);
      return;
    }
    anonymousViewedReviewFiles.set(anonymousReviewKey(), viewedReviewFilePaths);
  }

  function setReviewDiffViewMode(value: string | undefined): void {
    if (value !== "unified" && value !== "split") return;
    reviewDiffViewMode = value;
    if (reviewPreferenceScope && reviewPreferenceStore) {
      reviewPreferenceStore.saveDiffViewMode(reviewPreferenceScope, value);
    } else {
      anonymousReviewDiffViewMode = value;
    }
  }

  function selectCommitFile(path: string): void {
    selectedCommitFilePath = path;
    collapsedCommitFilePaths = collapsedCommitFilePaths.filter(
      (candidate) => candidate !== path,
    );
    commitFileScrollTarget = {
      path,
      requestId: Number(commitFileScrollTarget?.requestId ?? 0) + 1,
    };
  }

  function toggleCommitFile(path: string, collapsed: boolean): void {
    collapsedCommitFilePaths = collapsed
      ? [...new Set([...collapsedCommitFilePaths, path])]
      : collapsedCommitFilePaths.filter((candidate) => candidate !== path);
  }

  function setCommitDiffViewMode(value: string | undefined): void {
    if (value !== "unified" && value !== "split") return;
    commitDiffViewMode = value;
    if (reviewPreferenceScope && reviewPreferenceStore) {
      reviewPreferenceStore.saveDiffViewMode(reviewPreferenceScope, value);
    } else {
      anonymousReviewDiffViewMode = value;
    }
  }

  function openReviewSubmission(): void {
    reviewSubmissionDecision = "comment";
    reviewSubmissionBody = "";
    reviewSubmissionError = "";
    reviewSubmissionOpen = true;
  }

  async function submitPullRequestReview(): Promise<void> {
    if (!selectedPullRequest) return;
    const content = reviewSubmissionBody.trim();
    if (reviewSubmissionDecision !== "approved" && content === "") {
      reviewSubmissionError =
        reviewSubmissionDecision === "comment"
          ? "Add a comment before submitting the review."
          : "Explain the changes you are requesting.";
      return;
    }
    reviewSubmissionError = "";
    try {
      if (onSubmitPullRequestReview) {
        await onSubmitPullRequestReview(selectedPullRequest, {
          decision: reviewSubmissionDecision,
          content,
        });
      } else if (reviewSubmissionDecision === "approved") {
        await onApprovePullRequest?.(selectedPullRequest);
      } else if (reviewSubmissionDecision === "changes-requested") {
        await onRequestChanges?.(selectedPullRequest);
      } else {
        await onAddPullRequestComment?.(selectedPullRequest, content);
      }
      reviewSubmissionOpen = false;
      reviewSubmissionBody = "";
    } catch (cause) {
      reviewSubmissionError =
        cause instanceof Error ? cause.message : "The review could not be sent";
    }
  }

  function updateSelectedPullRequestLifecycle(): void {
    if (!selectedPullRequest || !onUpdatePullRequestLifecycle) return;
    if (selectedPullRequest.lifecycle === "merged") return;
    if (selectedPullRequest.lifecycle === "closed") {
      void onUpdatePullRequestLifecycle(selectedPullRequest, "open");
      return;
    }
    reviewCloseError = "";
    reviewCloseConfirmationOpen = true;
  }

  async function confirmClosePullRequest(): Promise<void> {
    if (!selectedPullRequest || !onUpdatePullRequestLifecycle) return;
    reviewCloseError = "";
    try {
      await onUpdatePullRequestLifecycle(selectedPullRequest, "closed");
      reviewCloseConfirmationOpen = false;
    } catch (cause) {
      reviewCloseError =
        cause instanceof Error
          ? cause.message
          : "The pull request could not be closed";
    }
  }

  function inlineCommentMatches(
    comment: PullRequestComment,
    context: FileDiffLineContext,
  ): boolean {
    return (
      context.lineNumber !== null &&
      comment.inlineStatus === "current" &&
      comment.anchor?.path === context.path &&
      comment.anchor.side === lineSide(context) &&
      comment.anchor.line === context.lineNumber
    );
  }

  function inlineComposerMatches(context: FileDiffLineContext): boolean {
    return (
      context.lineNumber !== null &&
      inlineCommentAnchor?.path === context.path &&
      inlineCommentAnchor.side === lineSide(context) &&
      inlineCommentAnchor.line === context.lineNumber
    );
  }

  function isExternalReviewDecision(comment: PullRequestComment): boolean {
    return comment.event.tags.some((tag) => tag[0] === "external-decision");
  }

  function canReactToPullRequestComment(comment: PullRequestComment): boolean {
    return (
      canCollaborate &&
      onTogglePullRequestCommentReaction !== undefined &&
      !comment.isReviewRequest &&
      !isExternalReviewDecision(comment)
    );
  }

  function isGitHubReviewComment(comment: PullRequestComment): boolean {
    return (
      repositoryCapabilities[selectedPullRequest?.repository.coordinate ?? ""]
        ?.collaboration_backend === "github" ||
      comment.event.tags.some(
        (tag) => tag[0] === "external-provider" && tag[1] === "github",
      )
    );
  }

  const canMaintainSelectedRepository = $derived(
    canMaintainRepository(
      rooms,
      selectedRepository?.channelId ??
        channelIdForCoordinate(
          repositories,
          selectedPullRequest?.repository.coordinate,
        ),
    ),
  );

  function canMergePullRequest(pullRequest: PullRequestState): boolean {
    return canMergeMaintainedPullRequest({
      canCollaborate,
      canMaintain: canMaintainSelectedRepository,
      mergeAdvertised:
        repositoryCapabilities[pullRequest.repository.coordinate]?.merge ===
          true && onMergePullRequest !== undefined,
      pullRequest,
    });
  }

  async function mergeSelectedPullRequest(
    pullRequest: PullRequestState,
  ): Promise<void> {
    pullRequestMergeError = "";
    pullRequestMergeStatus = "";
    try {
      await onMergePullRequest?.(pullRequest);
      pullRequestMergeStatus = "Merge completed; updating the review state…";
    } catch (cause) {
      pullRequestMergeError =
        cause instanceof Error
          ? cause.message
          : "Pull request could not be merged";
    }
  }

  function pullRequestReactionOptions(
    comment: PullRequestComment,
  ): readonly string[] | undefined {
    if (
      !canReactToPullRequestComment(comment) ||
      !isGitHubReviewComment(comment)
    ) {
      return undefined;
    }
    return GITHUB_REVIEW_COMMENT_REACTIONS;
  }

  function memberForPubkey(pubkey: string): CommunityMemberModel {
    return communityProjectsMemberForPubkey(members, pubkey);
  }

  function reviewCommitSummary(
    sha: string,
    subject: string,
    body: string,
    createdAt: number,
    authorId: string,
  ): (typeof commits)[number] {
    const existing = commits.find((commit) => commit.sha === sha);
    if (existing) return existing;
    const author = memberForPubkey(authorId);
    const normalizedBody = body.trim();
    return {
      sha,
      subject: subject.trim() || `Commit ${sha.slice(0, 7)}`,
      ...(normalizedBody ? { body: normalizedBody } : {}),
      author_date: new Date(createdAt * 1_000).toISOString(),
      author_name: author.name,
    };
  }

  async function copyCommitHash(hash: string): Promise<void> {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(hash).catch(() => undefined);
  }

  function commentMessage(comment: PullRequestComment): CommunityMessageModel {
    const createdAt = new Date(comment.event.created_at * 1_000);
    return {
      id: comment.event.id,
      authorId: comment.event.pubkey,
      content:
        comment.event.content ||
        (comment.isReviewRequest ? "Review requested" : "Review activity"),
      sourceEvent: comment.event,
      timestamp: new Intl.DateTimeFormat("en", {
        hour: "numeric",
        minute: "2-digit",
      }).format(createdAt),
      createdAt: createdAt.toISOString(),
      reactions: comment.reactions
        .filter(
          (reaction) =>
            !isGitHubReviewComment(comment) ||
            GITHUB_REVIEW_COMMENT_REACTIONS.some(
              (supported) => supported === reaction.emoji,
            ),
        )
        .map((reaction) => ({ ...reaction })),
    };
  }

  function openProjectChannelPicker(): void {
    projectChannelCommandMode = "home";
    projectChannelCommandOpen = true;
  }

  function selectChannelAttachmentProject(coordinate: string): void {
    channelAttachmentProject = coordinate;
  }

  function selectProjectOrAttachChannel(channel: CommunityRoomModel): void {
    if (projectChannelCommandMode === "home") {
      selectProjectChannel(channel);
      return;
    }
    void attachProjectChannel(channel);
  }

  function backRepositoryPicker(): void {
    repositoryCommandStep = "repository";
    repositoryCommandCoordinate = "";
  }

  function backGitHubPicker(): void {
    githubCommandStep = "connection";
    githubConnection = undefined;
    githubRepositories = [];
    githubCommandError = "";
  }

  function backGitHubManagerForm(): void {
    githubManagerFormOpen = false;
    githubManagerConnection = undefined;
    githubManagerError = "";
  }

  function pullRequestBelongsToSelectedProject(
    pullRequest: PullRequestState,
  ): boolean {
    return pullRequestBelongsToProjectScope(
      pullRequest,
      selectedProject,
      selectedProject
        ? projectPullRequestsFor(selectedProject, pullRequests)
        : pullRequests,
      reviewListFilter,
    );
  }

  function inlineReviewComments(
    context: FileDiffLineContext,
  ): readonly PullRequestComment[] {
    return (
      selectedPullRequest?.comments.filter((comment) =>
        inlineCommentMatches(comment, context),
      ) ?? []
    );
  }

  function toggleSelectedPullRequestCommentReaction(
    comment: PullRequestComment,
    emoji: string,
  ): void {
    if (!selectedPullRequest || !onTogglePullRequestCommentReaction) return;
    onTogglePullRequestCommentReaction(selectedPullRequest, comment, emoji);
  }

  function mergeOpenPullRequest(): void {
    if (selectedPullRequest) void mergeSelectedPullRequest(selectedPullRequest);
  }
</script>

{#snippet taskStatusIcon(lifecycle: (typeof tasks)[number]["lifecycle"])}
  <span
    class="community-projects__task-status-icon"
    data-status={lifecycle}
    title={taskStatusLabel(lifecycle)}
  >
    {#if lifecycle === "closed"}
      <CircleXIcon aria-hidden="true" />
    {:else if lifecycle === "applied"}
      <CircleCheckIcon aria-hidden="true" />
    {:else if lifecycle === "draft"}
      <CircleDashedIcon aria-hidden="true" />
    {:else}
      <CircleIcon aria-hidden="true" />
    {/if}
    <span class="sr-only">{taskStatusLabel(lifecycle)}</span>
  </span>
{/snippet}

{#snippet repositoryActivitySegment(
  count: number,
  singular: "commit" | "review" | "task",
  className: string,
  total: number,
)}
  {#if count > 0}
    {@const label = `${count} ${singular}${count === 1 ? "" : "s"}`}
    <Tooltip.Root>
      <Tooltip.Trigger>
        {#snippet child({ props })}
          <span
            {...props}
            class={`community-projects__repository-activity-segment ${className}`}
            style:width={`${(count / total) * 100}%`}
            role="img"
            aria-label={label}
          ></span>
        {/snippet}
      </Tooltip.Trigger>
      <Tooltip.Content side="top" sideOffset={6}>
        <span class="community-projects__repository-activity-tooltip">
          <span
            class={`community-projects__repository-activity-tooltip-dot ${className}`}
          ></span>
          {label}
        </span>
      </Tooltip.Content>
    </Tooltip.Root>
  {/if}
{/snippet}

{#snippet repositoryActivityBar(repository: ProjectForgeRepository)}
  {@const summary = repositoryActivitySummary(repository.address.coordinate)}
  <Tooltip.Provider delayDuration={0}>
    <span
      class="community-projects__repository-activity"
      role="group"
      aria-label={`${summary.commits} commits, ${summary.reviews} reviews, ${summary.tasks} tasks`}
    >
      {@render repositoryActivitySegment(
        summary.commits,
        "commit",
        "community-projects__repository-activity-segment--commits",
        summary.total,
      )}
      {@render repositoryActivitySegment(
        summary.reviews,
        "review",
        "community-projects__repository-activity-segment--reviews",
        summary.total,
      )}
      {@render repositoryActivitySegment(
        summary.tasks,
        "task",
        "community-projects__repository-activity-segment--tasks",
        summary.total,
      )}
    </span>
  </Tooltip.Provider>
{/snippet}

{#snippet memberHoverAvatar(
  member: CommunityMemberModel,
  avatarSize: "xsmall" | "small" | "medium" = "xsmall",
)}
  <CommunityMemberHoverCard
    {member}
    {avatarSize}
    {...onOpenProfile === undefined ? {} : { onOpenProfile }}
    {...onMessageMember === undefined ? {} : { onMessage: onMessageMember }}
    {...onWaveMember === undefined ? {} : { onWave: onWaveMember }}
  />
{/snippet}

{#snippet repositoryListRow(repository: ProjectForgeRepository)}
  <article class="community-projects__row community-projects__repository-row">
    {#if repositoryCapabilities[repository.address.coordinate]?.content_backend === "github" && repository.webUrls[0]}
      <a
        class="community-projects__row-icon community-projects__repository-provider-link"
        aria-label={`Open ${repository.name} on GitHub`}
        title="Open repository on GitHub"
        href={repository.webUrls[0]}
        target="_blank"
        rel="noreferrer"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path
            d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.3c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.4 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.4 11.4 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3Z"
          />
        </svg>
      </a>
    {:else}
      <span class="community-projects__row-icon"
        ><GitBranchIcon aria-hidden="true" /></span
      >
    {/if}
    <button
      type="button"
      class="community-projects__row-main community-projects__repository-target"
      onclick={() => onSelectRepository?.(repository)}
    >
      <span
        ><strong>{repository.name}</strong>
        {repository.description || repository.address.identifier}</span
      >
    </button>
    <div class="community-projects__row-meta">
      {@render memberHoverAvatar(activityMember(repository.event.pubkey))}
      {@render repositoryActivityBar(repository)}
      <CommunityRelativeTime timestamp={repositoryUpdatedAt(repository)} />
      {#if repository.webUrls[0] && repositoryCapabilities[repository.address.coordinate] !== undefined && repositoryCapabilities[repository.address.coordinate]?.content_backend !== "github"}
        <a
          aria-label={`Open ${repository.name}`}
          title="Open repository"
          href={repository.webUrls[0]}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLinkIcon aria-hidden="true" />
        </a>
      {/if}
    </div>
  </article>
{/snippet}

{#snippet taskListRow(task: (typeof tasks)[number])}
  <article class="community-projects__task-row">
    <button
      type="button"
      class="community-projects__task-row-target"
      aria-label={`Open task ${task.title}`}
      onclick={() => onSelectTask?.(task)}
    ></button>
    {@render taskStatusIcon(task.lifecycle)}
    <strong>{task.title}</strong>
    <span class="community-projects__task-repository">
      {taskRepositoryName(task)}
    </span>
    <span class="community-projects__task-row-assignees">
      {@render memberHoverAvatar(memberForPubkey(task.root.pubkey))}
      {#each task.assignees
        .filter((assignee) => assignee !== task.root.pubkey)
        .slice(0, 1) as assignee (assignee)}
        {@render memberHoverAvatar(memberForPubkey(assignee))}
      {/each}
    </span>
    <span class="community-projects__task-comments">
      <MessageSquareIcon aria-hidden="true" />
      {taskComments(task).length}
    </span>
    <CommunityRelativeTime timestamp={task.updatedAt} />
  </article>
{/snippet}

{#snippet channelListRow(binding: (typeof projectChannels)[number])}
  {@const project = channelProject(binding)}
  {@const room = rooms.find(
    (candidate) =>
      candidate.groupId === binding.channelId ||
      candidate.id === binding.channelId,
  )}
  {@const lastActivityTimestamp = roomActivityTimestamp(room)}
  <div class="community-projects__channel-row-shell">
    <button
      type="button"
      class="community-projects__row community-projects__row--button community-projects__channel-row"
      onclick={() => onSelectChannel?.(room?.id ?? binding.channelId)}
    >
      <span class="community-projects__row-icon"
        ><HashIcon aria-hidden="true" /></span
      >
      <div class="community-projects__row-main">
        <strong>#{room?.name ?? binding.channelId}</strong>
      </div>
      <span class="community-projects__channel-description">
        {room?.description || "No channel description"}
      </span>
      <span
        class="community-projects__row-count"
        aria-label={`${room?.messageCount ?? 0} messages`}
        ><MessageSquareIcon aria-hidden="true" />{room?.messageCount ?? 0}</span
      >
      {#if lastActivityTimestamp !== undefined}
        <CommunityRelativeTime
          timestamp={lastActivityTimestamp}
          class="community-projects__channel-activity"
        />
      {:else}
        <span class="community-projects__channel-activity">No messages yet</span
        >
      {/if}
    </button>
    <span class="community-projects__channel-row-actions">
      {#if project && currentMemberId === project.event.pubkey && onUpdateProject}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            {#snippet child({ props })}
              <Button
                {...props}
                type="button"
                variant="ghost"
                size="icon-sm"
                class="community-projects__channel-row-menu-trigger"
                aria-label={`Open #${room?.name ?? binding.channelId} project menu`}
                title={`Open #${room?.name ?? binding.channelId} project menu`}
                disabled={busy}
              >
                <EllipsisVerticalIcon aria-hidden="true" />
              </Button>
            {/snippet}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end" sideOffset={4}>
            <DropdownMenu.Item
              variant="destructive"
              disabled={!canRemoveProjectChannel(project, binding)}
              onSelect={() => void removeProjectChannel(project, binding)}
            >
              <UnlinkIcon data-icon="inline-start" aria-hidden="true" />
              {channelRemovalLabel(project, binding)}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      {/if}
    </span>
  </div>
{/snippet}

{#snippet projectDirectoryCard(project: (typeof projects)[number])}
  <article class="community-projects__card">
    <button
      type="button"
      class="community-projects__card-target"
      aria-label={`Open project ${project.name}`}
      onclick={() => onSelectProject?.(project)}
    ></button>
    <span class="community-projects__card-icon"
      ><FolderKanbanIcon aria-hidden="true" /></span
    >
    <span class="community-projects__card-copy">
      <span
        ><strong>{project.name}</strong>
        {project.description || "No project description"}</span
      >
    </span>
    <span class="community-projects__card-meta">
      <span class="community-projects__row-count"
        ><GitBranchIcon aria-hidden="true" />{project.repositories.length}</span
      >
      {@render memberHoverAvatar(activityMember(project.event.pubkey))}
      <CommunityRelativeTime timestamp={project.event.created_at} />
    </span>
  </article>
{/snippet}

{#snippet layoutControls()}
  <ToggleGroup.Root
    type="single"
    value={listLayout}
    onValueChange={setListLayout}
    size="sm"
    spacing={1}
    class="community-projects__layout-controls"
    aria-label="Project layout"
  >
    <ToggleGroup.Item value="grid" aria-label="Grid layout" title="Grid layout">
      <LayoutGridIcon aria-hidden="true" />
    </ToggleGroup.Item>
    <ToggleGroup.Item value="list" aria-label="List layout" title="List layout">
      <ListIcon aria-hidden="true" />
    </ToggleGroup.Item>
  </ToggleGroup.Root>
{/snippet}

{#snippet directoryActions()}
  <div class="community-projects__directory-actions">
    {@render layoutControls()}
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      class="community-projects__directory-create"
      aria-label="Create project"
      title="Create project"
      disabled={!canCollaborate || busy}
      onclick={() => openProjectDialog()}
    >
      <PlusIcon aria-hidden="true" />
    </Button>
  </div>
{/snippet}

{#snippet repositoryAddMenu()}
  <DropdownMenu.Root>
    <DropdownMenu.Trigger>
      {#snippet child({ props })}
        <Button
          {...props}
          type="button"
          variant="ghost"
          size="icon-sm"
          class="community-projects__surface-create"
          aria-label="Add repository"
          title="Add repository"
          disabled={!canCollaborate || busy}
        >
          <PlusIcon aria-hidden="true" />
        </Button>
      {/snippet}
    </DropdownMenu.Trigger>
    <DropdownMenu.Content
      align="end"
      sideOffset={6}
      class="community-projects__repository-add-menu"
    >
      <DropdownMenu.Group>
        <DropdownMenu.Item
          disabled={!onCreateRepository}
          onSelect={openRepositoryDialog}
        >
          <FolderPlusIcon aria-hidden="true" />
          <span>Create new repository</span>
        </DropdownMenu.Item>
        <DropdownMenu.Item
          disabled={!onAttachRepository ||
            projects.length === 0 ||
            attachableRepositories.length === 0}
          onSelect={openRepositoryCommand}
        >
          <LinkIcon aria-hidden="true" />
          <span>Select existing repository</span>
        </DropdownMenu.Item>
      </DropdownMenu.Group>
    </DropdownMenu.Content>
  </DropdownMenu.Root>
{/snippet}

{#snippet surfaceHeader(title: string, description: string)}
  <header class="community-projects__surface-header">
    <div>
      {#if title === "Repositories"}
        <GitBranchIcon aria-hidden="true" />
      {:else if title === "Channels"}
        <HashIcon aria-hidden="true" />
      {:else if title === "Reviews"}
        <GitPullRequestIcon aria-hidden="true" />
      {:else if title === "Commits"}
        <GitCommitHorizontalIcon aria-hidden="true" />
      {:else if title === "Files"}
        <FileIcon aria-hidden="true" />
      {:else if title === "Tasks"}
        <CircleIcon aria-hidden="true" />
      {:else}
        <FolderKanbanIcon aria-hidden="true" />
      {/if}
      <h2>{title}</h2>
      <span class="sr-only">{description}</span>
    </div>
    {#if title !== "Commits" && title !== "Files"}
      <div class="community-projects__surface-actions">
        {#if title !== "Reviews"}
          {@render layoutControls()}
        {/if}
        {#if title === "Repositories"}
          {@render repositoryAddMenu()}
        {:else if title === "Tasks"}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            class="community-projects__surface-create"
            aria-label="Create task"
            title="Create task"
            disabled={(projects.length === 0 &&
              taskRepositoryOptions.length === 0) ||
              !canCollaborate ||
              busy ||
              !onCreateTask}
            onclick={openTaskDialog}
          >
            <PlusIcon aria-hidden="true" />
          </Button>
        {:else if title === "Reviews"}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            class="community-projects__surface-create"
            aria-label="Create review"
            title={reviewableRepositories.length > 0
              ? "Create review"
              : "Add a repository before creating a review"}
            disabled={!canCollaborate ||
              busy ||
              !onCreatePullRequest ||
              reviewableRepositories.length === 0}
            onclick={openPullRequestDialog}
          >
            <PlusIcon aria-hidden="true" />
          </Button>
        {:else if title === "Channels"}
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            class="community-projects__surface-create"
            aria-label="Add channel"
            title="Add channel to project"
            disabled={!canCollaborate ||
              busy ||
              !onUpdateProject ||
              channelAttachmentProjects.length === 0 ||
              (selectedProject !== undefined &&
                selectedProject.event.pubkey !== currentMemberId)}
            onclick={() => openChannelAttachment()}
          >
            <PlusIcon aria-hidden="true" />
          </Button>
        {/if}
      </div>
    {/if}
  </header>
{/snippet}

{#snippet projectSourceError(message: string)}
  <div class="community-projects__source-error" role="alert">
    <p>
      {message === "repository_access_denied"
        ? "Your current identity is not a member of this project's channel."
        : message}
    </p>
    {#if message === "repository_access_denied" && projectHomeChannel}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onclick={() => {
          const room = rooms.find(
            (candidate) =>
              candidate.groupId === projectHomeChannel.channelId ||
              candidate.id === projectHomeChannel.channelId,
          );
          onSelectChannel?.(room?.id ?? projectHomeChannel.channelId);
        }}
      >
        Open #{channelName(projectHomeChannel)} to join
      </Button>
    {/if}
  </div>
{/snippet}

{#if showContent}
  <CommunityProjectStatusToasts {cachedCatalogAt} {error} {onRetry} />
  <AppShell.Body
    layout={view === "log" ? "regions" : "scroll"}
    label={selectedProject ? `${selectedProject.name} projects` : "Projects"}
  >
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <section
      class="community-projects"
      data-ui-component="community-projects"
      data-view={view}
      data-detail={selectedPullRequest ? "review" : undefined}
      data-navigation={showNavigation ? "visible" : "hidden"}
      aria-busy={loading}
      aria-label={selectedProject
        ? `${selectedProject.name} project workspace`
        : "Projects workspace"}
      tabindex="0"
    >
      {#if showNavigation && !selectedTask && !selectedPullRequest}
        <div class="community-projects__tabs">
          {#if selectedProject && onBack}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              class="community-projects__tab-back"
              aria-label="Back to projects"
              title="Back to projects"
              onclick={onBack}
            >
              <ArrowLeftIcon aria-hidden="true" />
            </Button>
          {/if}
          <ScrollArea
            type="hover"
            orientation="horizontal"
            class="community-projects__tabs-scroll-area"
          >
            <Tabs.Root value={view === "directory" ? "projects" : view}>
              <Tabs.List
                class="community-projects__tab-list"
                aria-label={selectedProject
                  ? `${selectedProject.name} sections`
                  : "Project sections"}
              >
                {#each selectedProject ? projectTabs : overviewTabs as tab (tab.value)}
                  <Tabs.Trigger
                    class="community-projects__tab-trigger"
                    value={tab.value}
                    onclick={() => onSelectView?.(tab.value)}
                    >{tab.label}</Tabs.Trigger
                  >
                {/each}
              </Tabs.List>
            </Tabs.Root>
          </ScrollArea>
        </div>
      {/if}

      {#if view === "activity"}
        <CommunityProjectsActivityFeed
          {loading}
          activity={visibleActivity}
          {members}
          {rooms}
          {communityEmojis}
          {onOpenProfile}
          {onMessageMember}
          {onWaveMember}
          canSelectProject={onSelectProject !== undefined}
          {projectName}
          onOpenProject={openActivityProject}
          onOpenItem={openActivityItem} filterPage={selectedRepository ? "repositories" : selectedProject ? "project" : "projects"}
        />
      {:else if view === "log"}<CommunityProjectsRepositoryLog
          events={workItemEvents}
          {loading}
          {onLoadRepositoryCommit}
        />
      {:else if view === "directory" || view === "projects"}
        <header class="community-projects__directory-header">
          <div>
            <FolderKanbanIcon aria-hidden="true" />
            <h1>Projects</h1>
          </div>
          {@render directoryActions()}
        </header>

        {#if loading && projects.length === 0}
          <CommunitySkeleton layout="gallery" label="Loading projects" />
        {:else if projects.length === 0}
          <Empty.Root class="community-projects__empty">
            <Empty.Header>
              <Empty.Media variant="icon"
                ><CodeXmlIcon aria-hidden="true" /></Empty.Media
              >
              <Empty.Title>No projects yet</Empty.Title>
              <Empty.Description
                >Create a project in an existing Community channel. Repositories
                stay optional until you need one.</Empty.Description
              >
            </Empty.Header>
          </Empty.Root>
        {:else}
          {#if mineProjects.length > 0}
            <Collapsible.Root
              class="community-projects__directory-group"
              bind:open={mineProjectsOpen}
            >
              <Collapsible.Trigger
                class="community-projects__list-group-heading"
              >
                <FolderKanbanIcon aria-hidden="true" />
                <strong>Mine</strong>
                {#if !mineProjectsOpen}
                  <span class="community-projects__list-group-count"
                    >{mineProjects.length}</span
                  >
                {/if}
                {#if mineProjectsOpen}
                  <ChevronDownIcon
                    class="community-projects__list-group-chevron"
                    aria-hidden="true"
                  />
                {:else}
                  <ChevronRightIcon
                    class="community-projects__list-group-chevron"
                    aria-hidden="true"
                  />
                {/if}
              </Collapsible.Trigger>
              <Collapsible.Content>
                <div class="community-projects__grid" data-layout={listLayout}>
                  {#each mineProjects as project (project.address.coordinate)}
                    {@render projectDirectoryCard(project)}
                  {/each}
                </div>
              </Collapsible.Content>
            </Collapsible.Root>
          {/if}
          {#if otherProjects.length > 0}
            <Collapsible.Root
              class="community-projects__directory-group"
              bind:open={otherProjectsOpen}
            >
              <Collapsible.Trigger
                class="community-projects__list-group-heading"
              >
                <FolderKanbanIcon aria-hidden="true" />
                <strong>Other projects</strong>
                {#if !otherProjectsOpen}
                  <span class="community-projects__list-group-count"
                    >{otherProjects.length}</span
                  >
                {/if}
                {#if otherProjectsOpen}
                  <ChevronDownIcon
                    class="community-projects__list-group-chevron"
                    aria-hidden="true"
                  />
                {:else}
                  <ChevronRightIcon
                    class="community-projects__list-group-chevron"
                    aria-hidden="true"
                  />
                {/if}
              </Collapsible.Trigger>
              <Collapsible.Content>
                <div class="community-projects__grid" data-layout={listLayout}>
                  {#each otherProjects as project (project.address.coordinate)}
                    {@render projectDirectoryCard(project)}
                  {/each}
                </div>
              </Collapsible.Content>
            </Collapsible.Root>
          {/if}
        {/if}
      {:else if view === "overview" || view === "options"}
        <CommunityProjectsRepositoryOverview surface={view === "options" ? "options" : "overview"}
          {tree}
          {loading}
          {canCollaborate}
          hasSources={repositorySources.length > 0}
          sourceError={effectiveSourceError}
          capabilities={selectedRepository
            ? repositoryCapabilities[selectedRepository.address.coordinate]
            : undefined}
          {owners}
          {members}
          {rooms}
          {communityEmojis}
          homeChannelId={projectHomeChannel?.channelId}
          canMaintain={canMaintainSelectedRepository}
          {onOpenPeople}
          onSaveProtection={selectedRepository && onSaveProtection
            ? (input) => onSaveProtection(selectedRepository.address.coordinate, input)
            : undefined}
        >
          {#snippet sourceErrorSnippet()}
            {@render projectSourceError(effectiveSourceError)}
          {/snippet}
        </CommunityProjectsRepositoryOverview>
      {:else if view === "repositories"}
        {@render surfaceHeader(
          "Repositories",
          "Relay-hosted repositories and external repository announcements.",
        )}
        {#if mineRepositories.length > 0 || otherRepositories.length > 0}
          <div class="community-projects__collection-groups">
            {#if mineRepositories.length > 0}
              <Collapsible.Root
                class="community-projects__collection-group"
                bind:open={mineRepositoriesOpen}
              >
                <Collapsible.Trigger
                  class="community-projects__list-group-heading"
                >
                  <FolderGit2Icon aria-hidden="true" />
                  <strong>Mine</strong>
                  {#if !mineRepositoriesOpen}
                    <span class="community-projects__list-group-count"
                      >{mineRepositories.length}</span
                    >
                  {/if}
                  {#if mineRepositoriesOpen}
                    <ChevronDownIcon
                      class="community-projects__list-group-chevron"
                      aria-hidden="true"
                    />
                  {:else}
                    <ChevronRightIcon
                      class="community-projects__list-group-chevron"
                      aria-hidden="true"
                    />
                  {/if}
                </Collapsible.Trigger>
                <Collapsible.Content>
                  <div
                    class="community-projects__list"
                    data-layout={listLayout}
                  >
                    {#each mineRepositories as repository (repository.address.coordinate)}
                      {@render repositoryListRow(repository)}
                    {/each}
                  </div>
                </Collapsible.Content>
              </Collapsible.Root>
            {/if}
            {#if otherRepositories.length > 0}
              <Collapsible.Root
                class="community-projects__collection-group"
                bind:open={otherRepositoriesOpen}
              >
                <Collapsible.Trigger
                  class="community-projects__list-group-heading"
                >
                  <FolderGit2Icon aria-hidden="true" />
                  <strong>Other repositories</strong>
                  {#if !otherRepositoriesOpen}
                    <span class="community-projects__list-group-count"
                      >{otherRepositories.length}</span
                    >
                  {/if}
                  {#if otherRepositoriesOpen}
                    <ChevronDownIcon
                      class="community-projects__list-group-chevron"
                      aria-hidden="true"
                    />
                  {:else}
                    <ChevronRightIcon
                      class="community-projects__list-group-chevron"
                      aria-hidden="true"
                    />
                  {/if}
                </Collapsible.Trigger>
                <Collapsible.Content>
                  <div
                    class="community-projects__list"
                    data-layout={listLayout}
                  >
                    {#each otherRepositories as repository (repository.address.coordinate)}
                      {@render repositoryListRow(repository)}
                    {/each}
                  </div>
                </Collapsible.Content>
              </Collapsible.Root>
            {/if}
          </div>
        {:else}
          <p class="community-projects__status">
            No repositories are attached.
          </p>
        {/if}
      {:else if view === "channels"}
        {@render surfaceHeader(
          "Channels",
          selectedProject
            ? "The project home and attached Community channels."
            : "Community channels attached to your projects.",
        )}
        {#if localError}
          <p class="community-projects__command-error" role="alert">
            {localError}
          </p>
        {/if}
        <div class="community-projects__list" data-layout={listLayout}>
          {#if selectedProject}
            <div
              class="community-projects__list-group-heading community-projects__list-group-heading--inset"
            >
              <FolderKanbanIcon aria-hidden="true" />
              <strong>{selectedProject.name}</strong>
            </div>
            {#each sortedChannels(projectChannels) as binding (`${binding.channelId}:${binding.repositoryCoordinate ?? ""}`)}
              {@render channelListRow(binding)}
            {:else}
              <p class="community-projects__status">
                No project channels are available.
              </p>
            {/each}
          {:else}
            {#each projects as project (project.address.coordinate)}
              {@const channels = projectChannels.filter(
                (binding) =>
                  binding.projectCoordinate === project.address.coordinate,
              )}
              {#if channels.length > 0}
                <div
                  class="community-projects__list-group-heading community-projects__list-group-heading--inset"
                >
                  <FolderKanbanIcon aria-hidden="true" />
                  <strong>{project.name}</strong>
                </div>
                {#each sortedChannels(channels) as binding (`${binding.channelId}:${binding.repositoryCoordinate ?? ""}`)}
                  {@render channelListRow(binding)}
                {/each}
              {/if}
            {:else}
              <p class="community-projects__status">
                No project channels are available.
              </p>
            {/each}
          {/if}
        </div>
      {:else if view === "tasks"}
        {#if selectedTask}
          <article class="community-projects__task-detail">
            <header class="community-projects__task-detail-header">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Back to tasks"
                title="Back to tasks"
                onclick={onCloseTask}
              >
                <ArrowLeftIcon aria-hidden="true" />
              </Button>
              <div>
                <h2>
                  {selectedTask.title}
                  <span>#{selectedTask.root.id.slice(0, 8)}</span>
                </h2>
                <p>
                  Task created
                  <CommunityRelativeTime timestamp={selectedTask.createdAt} />
                </p>
              </div>
            </header>

            <dl class="community-projects__task-meta">
              <div>
                <dt>
                  {@render taskStatusIcon(selectedTask.lifecycle)} Status
                </dt>
                <dd>{taskStatusLabel(selectedTask.lifecycle)}</dd>
              </div>
              <div>
                <dt><ListTodoIcon aria-hidden="true" /> Category</dt>
                <dd>{taskCategoryLabel(selectedTask)}</dd>
              </div>
              <div>
                <dt><UserIcon aria-hidden="true" /> Assignees</dt>
                <dd class="community-projects__task-assignees">
                  {#each selectedTask.assignees as assignee (assignee)}
                    {@render memberHoverAvatar(
                      memberForPubkey(assignee),
                      "small",
                    )}
                  {/each}
                  {#if currentMemberId}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!canCollaborate || busy}
                      onclick={() =>
                        onUpdateTaskAssignment?.(
                          selectedTask,
                          currentMemberId,
                          !selectedTask.assignees.includes(currentMemberId),
                        )}
                    >
                      <UserRoundPlusIcon
                        data-icon="inline-start"
                        aria-hidden="true"
                      />
                      {selectedTask.assignees.includes(currentMemberId)
                        ? "Unassign me"
                        : "Assign to me"}
                    </Button>
                  {/if}
                  {#if members.length > 0 && onManageTaskAssignments}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!canCollaborate || busy}
                      onclick={() => onManageTaskAssignments(selectedTask)}
                    >
                      <UserRoundPlusIcon
                        data-icon="inline-start"
                        aria-hidden="true"
                      />
                      Assign
                    </Button>
                  {/if}
                </dd>
              </div>
            </dl>

            {#if selectedTask.content}
              <Collapsible.Root
                class="community-projects__task-description"
                bind:open={taskDescriptionOpen}
              >
                <Collapsible.Trigger
                  class="community-projects__task-section-trigger"
                >
                  <span>Description</span>
                  {#if taskDescriptionOpen}
                    <ChevronDownIcon
                      class="community-projects__task-section-chevron"
                      aria-hidden="true"
                    />
                  {:else}
                    <ChevronRightIcon
                      class="community-projects__task-section-chevron"
                      aria-hidden="true"
                    />
                  {/if}
                </Collapsible.Trigger>
                <Collapsible.Content
                  class="community-projects__task-description-content"
                >
                  <CommunityMarkdownContent
                    fullWidth
                    content={selectedTask.content}
                    {members}
                    {rooms}
                    {communityEmojis}
                  />
                </Collapsible.Content>
              </Collapsible.Root>
            {/if}

            <Collapsible.Root
              class="community-projects__task-activity"
              bind:open={taskActivityOpen}
            >
              <Collapsible.Trigger
                class="community-projects__task-section-trigger"
              >
                <HistoryIcon aria-hidden="true" />
                <span>Activity</span>
                {#if taskActivityOpen}
                  <ChevronDownIcon
                    class="community-projects__task-section-chevron"
                    aria-hidden="true"
                  />
                {:else}
                  <ChevronRightIcon
                    class="community-projects__task-section-chevron"
                    aria-hidden="true"
                  />
                {/if}
              </Collapsible.Trigger>
              <Collapsible.Content>
                <div class="community-projects__task-timeline">
                  {#each taskComments(selectedTask) as entry (entry.event.id)}
                    <CommunityMessage
                      message={taskMessage(entry)}
                      author={memberForPubkey(entry.event.pubkey)}
                      {members}
                      {rooms}
                      {communityEmojis}
                      {...currentMemberId === undefined
                        ? {}
                        : { currentMemberId }}
                      density="compact"
                    />
                  {:else}
                    <p class="community-projects__task-empty-activity">
                      No comments yet.
                    </p>
                  {/each}
                </div>
                {#if onAddTaskComment}
                  <CommunityChatComposer
                    class="community-projects__task-composer"
                    bind:value={taskComment}
                    placeholder="Add a comment…"
                    ariaLabel="Task comment"
                    submitLabel="Comment"
                    {members}
                    {rooms}
                    {communityEmojis}
                    {...currentMemberId === undefined
                      ? {}
                      : { currentMemberId }}
                    {busy}
                    disabled={!canCollaborate}
                    disabledReason="Sign in to comment on this task"
                    onSubmit={(submission) =>
                      submitTaskComment(submission.content)}
                  />
                {/if}
              </Collapsible.Content>
            </Collapsible.Root>
          </article>
        {:else}
          {@render surfaceHeader("Tasks", "Project tasks")}
          {#if groupByRepository}
            <CommunityProjectsRepositorySections
              sections={taskRepositorySections.map((group) => ({
                repository: group.repository,
                count: group.items.length,
              }))}
              empty="No tasks in this project."
            >
              {#snippet children(repository)}
                <div class="community-projects__task-list" data-layout={listLayout}>
                  {#each scopedTasks.filter((task) => task.repository.coordinate === repository.address.coordinate) as task (task.root.id)}
                    {@render taskListRow(task)}
                  {/each}
                </div>
              {/snippet}
            </CommunityProjectsRepositorySections>
          {:else if mineTasks.length > 0 || otherTasks.length > 0}
            <div class="community-projects__collection-groups">
              {#if mineTasks.length > 0}
                <Collapsible.Root
                  class="community-projects__collection-group"
                  bind:open={mineTasksOpen}
                >
                  <Collapsible.Trigger
                    class="community-projects__list-group-heading"
                  >
                    <ListTodoIcon aria-hidden="true" />
                    <strong>Mine</strong>
                    {#if !mineTasksOpen}
                      <span class="community-projects__list-group-count"
                        >{mineTasks.length}</span
                      >
                    {/if}
                    {#if mineTasksOpen}
                      <ChevronDownIcon
                        class="community-projects__list-group-chevron"
                        aria-hidden="true"
                      />
                    {:else}
                      <ChevronRightIcon
                        class="community-projects__list-group-chevron"
                        aria-hidden="true"
                      />
                    {/if}
                  </Collapsible.Trigger>
                  <Collapsible.Content>
                    <div
                      class="community-projects__task-list"
                      data-layout={listLayout}
                    >
                      {#each mineTasks as task (task.root.id)}
                        {@render taskListRow(task)}
                      {/each}
                    </div>
                  </Collapsible.Content>
                </Collapsible.Root>
              {/if}
              {#if otherTasks.length > 0}
                <Collapsible.Root
                  class="community-projects__collection-group"
                  bind:open={otherTasksOpen}
                >
                  <Collapsible.Trigger
                    class="community-projects__list-group-heading"
                  >
                    <ListTodoIcon aria-hidden="true" />
                    <strong>Other tasks</strong>
                    {#if !otherTasksOpen}
                      <span class="community-projects__list-group-count"
                        >{otherTasks.length}</span
                      >
                    {/if}
                    {#if otherTasksOpen}
                      <ChevronDownIcon
                        class="community-projects__list-group-chevron"
                        aria-hidden="true"
                      />
                    {:else}
                      <ChevronRightIcon
                        class="community-projects__list-group-chevron"
                        aria-hidden="true"
                      />
                    {/if}
                  </Collapsible.Trigger>
                  <Collapsible.Content>
                    <div
                      class="community-projects__task-list"
                      data-layout={listLayout}
                    >
                      {#each otherTasks as task (task.root.id)}
                        {@render taskListRow(task)}
                      {/each}
                    </div>
                  </Collapsible.Content>
                </Collapsible.Root>
              {/if}
            </div>
          {:else}
            <p class="community-projects__status">
              {selectedRepository
                ? "No tasks in this repository."
                : selectedProject
                  ? "No tasks in this project."
                  : "No project tasks are available."}
            </p>
          {/if}
        {/if}
      {:else if view === "reviews"}
        {#if groupByRepository && !selectedPullRequest}
          {@render surfaceHeader(
            "Reviews",
            "Buzz-compatible NIP-34 pull requests and trusted review decisions.",
          )}
          <CommunityProjectsRepositorySections
            sections={reviewRepositorySections.map((group) => ({
              repository: group.repository,
              count: group.items.length,
            }))}
            empty="No reviews in this project."
          >
            {#snippet children(repository)}
              <CommunityProjectsPullRequestList
                pullRequests={reviewRepositorySections.find(
                  (group) =>
                    group.repository.address.coordinate ===
                    repository.address.coordinate,
                )?.items ?? []}
                {listLayout}
                bind:groupOpen={reviewGroupOpen}
                {memberForPubkey}
                {onOpenProfile}
                {onMessageMember}
                {onWaveMember}
                {onSelectPullRequest}
              />
            {/snippet}
          </CommunityProjectsRepositorySections>
        {:else}
        <CommunityProjectsPullRequestReview
          pullRequest={selectedPullRequest}
          {pullRequests}
          {listLayout}
          bind:groupOpen={reviewGroupOpen}
          {onSelectPullRequest}
          projectFilter={pullRequestBelongsToSelectedProject}
          showHeader={showReviewHeader}
          onClose={onClosePullRequest}
          bind:descriptionOpen={reviewDescriptionOpen}
          bind:filesOpen={reviewFilesOpen}
          bind:commitsOpen={reviewCommitsOpen}
          bind:checksOpen={reviewChecksOpen}
          bind:activityOpen={reviewActivityOpen}
          bind:fileListOpen={reviewFileListOpen}
          bind:fileFilter={reviewFileFilter}
          bind:fileListMode={diffFileListMode}
          bind:selectedPath={selectedReviewFilePath}
          bind:collapsedPaths={collapsedReviewFilePaths}
          bind:viewedPaths={viewedReviewFilePaths}
          bind:viewMode={reviewDiffViewMode}
          bind:scrollTarget={reviewFileScrollTarget}
          bind:inlineContent={inlineCommentContent}
          bind:comment={pullRequestComment}
          {loading}
          diff={pullRequestDiff}
          diffError={pullRequestDiffError}
          visibleFiles={visibleProjectDiffFiles}
          viewedCount={viewedReviewFileCount}
          {busy}
          {canCollaborate}
          canMerge={selectedPullRequest
            ? canMergePullRequest(selectedPullRequest)
            : false}
          mergeError={pullRequestMergeError}
          mergeStatus={pullRequestMergeStatus}
          canSubmit={canReviewPullRequest({
            canCollaborate,
            canMaintain: canMaintainSelectedRepository,
            lifecycle: selectedPullRequest?.lifecycle ?? "open",
          }) &&
            Boolean(
              onSubmitPullRequestReview ||
                onAddPullRequestComment ||
                onApprovePullRequest ||
                onRequestChanges,
            )}
          canComment={onAddPullRequestComment !== undefined}
          canUpdateLifecycle={onUpdatePullRequestLifecycle !== undefined}
          {owners}
          {members}
          {rooms}
          {communityEmojis}
          {currentMemberId}
          homeChannelId={projectHomeChannel?.channelId}
          homeChannelName={projectHomeChannel
            ? channelName(projectHomeChannel)
            : undefined}
          {memberForPubkey}
          {commentMessage}
          canReact={canReactToPullRequestComment}
          reactionOptions={pullRequestReactionOptions}
          inlineComments={inlineReviewComments}
          showComposer={inlineComposerMatches}
          {onOpenProfile}
          {onMessageMember}
          {onWaveMember}
          onCopyCommit={(hash) => void copyCommitHash(hash)}
          {onSelectCommit}
          commitSummary={reviewCommitSummary}
          {onSelectChannel}
          onSelectPath={selectReviewFile}
          onToggleFile={toggleReviewFile}
          onViewedChange={setReviewFileViewed}
          onViewModeChange={setReviewDiffViewMode}
          onAddLineComment={addLineComment}
          onToggleReaction={toggleSelectedPullRequestCommentReaction}
          onCancelComposer={() => (inlineCommentAnchor = undefined)}
          onSubmitComposer={(content) => void submitInlineComment(content)}
          onMerge={mergeOpenPullRequest}
          onSubmitReview={openReviewSubmission}
          onRequestReview={(reviewer) => {
            if (selectedPullRequest)
              void onRequestPullRequestReview?.(selectedPullRequest, reviewer);
          }}
          onUpdateLifecycle={updateSelectedPullRequestLifecycle}
          onSubmitComment={(content) => void submitPullRequestComment(content)}
        >
          {#snippet listHeader()}
            {@render surfaceHeader(
              "Reviews",
              "Buzz-compatible NIP-34 pull requests and trusted review decisions.",
            )}
          {/snippet}
        </CommunityProjectsPullRequestReview>
        {/if}
      {:else if view === "commits"}
        {#if selectedCommitValue}
          {@const commitAuthor = commitAuthorMember(selectedCommitValue)}
          <article class="community-projects__commit-detail">
            <header class="community-projects__commit-detail-header">
              {#if onCloseCommit}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  class="community-projects__commit-back"
                  aria-label="Back to commits"
                  title="Back to commits"
                  onclick={onCloseCommit}
                >
                  <ArrowLeftIcon aria-hidden="true" />
                </Button>
              {/if}
              <div>
                <h1>{selectedCommitValue.subject}</h1>
                <p>
                  Committed {commitDate(
                    selectedCommitValue.commit_date ??
                      selectedCommitValue.author_date,
                  )}
                </p>
              </div>
            </header>

            <dl class="community-projects__commit-meta">
              <div>
                <dt><GitCommitHorizontalIcon aria-hidden="true" />Commit</dt>
                <dd>
                  <code>{selectedCommitValue.sha.slice(0, 7)}</code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    class="community-projects__copy-control"
                    aria-label={`Copy commit ${selectedCommitValue.sha.slice(0, 7)}`}
                    title="Copy commit hash"
                    onclick={() => void copyCommitHash(selectedCommitValue.sha)}
                  >
                    <CopyIcon aria-hidden="true" />
                  </Button>
                </dd>
              </div>
              <div>
                <dt><UserIcon aria-hidden="true" />Author</dt>
                <dd>{commitAuthor.name}</dd>
              </div>
              <div>
                <dt><HistoryIcon aria-hidden="true" />Date</dt>
                <dd>
                  {commitDate(
                    selectedCommitValue.commit_date ??
                      selectedCommitValue.author_date,
                  )}
                </dd>
              </div>
              <div>
                <dt><CodeXmlIcon aria-hidden="true" />Changes</dt>
                <dd>
                  <FileChangeStats
                    additions={commitAdditions}
                    deletions={commitDeletions}
                  />
                </dd>
              </div>
            </dl>

            {#if selectedCommitValue.body}
              <CommunityMarkdownContent
                content={selectedCommitValue.body}
                {members}
                {rooms}
                {communityEmojis}
              />
            {/if}

            <Collapsible.Root
              class="community-projects__commit-files"
              bind:open={commitFilesOpen}
            >
              <Collapsible.Trigger
                class="community-projects__review-section-trigger community-projects__review-section-trigger--files community-projects__commit-files-trigger"
              >
                <span>Files changed</span>
                {#if commitFilesOpen}
                  <ChevronDownIcon aria-hidden="true" />
                  {#if selectedCommitDetail}<span
                      class="community-projects__review-section-count"
                      >{commitDiffFiles.length}</span
                    >{/if}
                {:else}
                  <ChevronRightIcon aria-hidden="true" />
                {/if}
              </Collapsible.Trigger>
              <Collapsible.Content
                class="community-projects__review-files-content community-projects__commit-files-content"
              >
                {#if loading && !selectedCommitDetail}
                  <CommunitySkeleton
                    layout="repository"
                    label="Loading commit diff"
                  />
                {:else if selectedCommitDetail && commitDiffFiles.length > 0}
                  <div class="community-projects__diff-summary">
                    <span class="community-projects__diff-summary-copy">
                      <strong>{commitDiffFiles.length} changed files</strong>
                      <span
                        >{selectedCommitValue.subject} · {selectedCommitValue.sha.slice(
                          0,
                          7,
                        )}</span
                      >
                    </span>
                    <span class="community-projects__diff-summary-actions">
                      <FileChangeStats
                        additions={commitAdditions}
                        deletions={commitDeletions}
                      />
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger>
                          {#snippet child({ props })}
                            <Button
                              {...props}
                              type="button"
                              variant="outline"
                              size="icon-sm"
                              aria-label="Diff settings"
                              title="Diff settings"
                            >
                              <Settings2Icon aria-hidden="true" />
                            </Button>
                          {/snippet}
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Content align="end" sideOffset={4}>
                          <DropdownMenu.Label>Diff layout</DropdownMenu.Label>
                          <DropdownMenu.RadioGroup
                            value={commitDiffViewMode}
                            onValueChange={setCommitDiffViewMode}
                          >
                            <DropdownMenu.RadioItem value="unified">
                              Unified diff
                            </DropdownMenu.RadioItem>
                            <DropdownMenu.RadioItem value="split">
                              Split diff
                            </DropdownMenu.RadioItem>
                          </DropdownMenu.RadioGroup>
                        </DropdownMenu.Content>
                      </DropdownMenu.Root>
                    </span>
                  </div>
                  <div
                    class="community-projects__diff-layout"
                    data-file-list-open={commitFileListOpen}
                  >
                    {#if commitFileListOpen}
                      <aside aria-label="Changed files">
                        <ScrollArea
                          type="hover"
                          orientation="vertical"
                          class="community-projects__changed-files-scroll-area"
                        >
                          <Input
                            type="search"
                            bind:value={commitFileFilter}
                            class="community-projects__changed-files-filter"
                            aria-label="Filter changed files"
                            placeholder="Filter changed files"
                          />
                          <div
                            class="community-projects__changed-files-toolbar"
                          >
                            <span>Files</span>
                            <FileListingViewModeToggle
                              bind:mode={diffFileListMode}
                            />
                          </div>
                          <FileListing
                            files={visibleCommitDiffFiles}
                            mode={diffFileListMode}
                            selectedPath={selectedCommitFilePath || null}
                            onSelectPath={selectCommitFile}
                          />
                        </ScrollArea>
                      </aside>
                    {/if}
                    <section
                      class="community-projects__diff-content"
                      aria-label="Commit diff"
                    >
                      {#snippet commitFileHeaderLeading(
                        _context: FileDiffComposerFileContext,
                      )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          class="community-projects__diff-sidebar-toggle"
                          aria-label={commitFileListOpen
                            ? "Hide changed files"
                            : "Show changed files"}
                          aria-expanded={commitFileListOpen}
                          data-ui-part="sidebar-toggle"
                          data-side="left"
                          data-state={commitFileListOpen
                            ? "expanded"
                            : "collapsed"}
                          title={commitFileListOpen
                            ? "Hide changed files"
                            : "Show changed files"}
                          onclick={() =>
                            (commitFileListOpen = !commitFileListOpen)}
                        >
                          <CommunitySidebarToggleIcon
                            expanded={commitFileListOpen}
                          />
                        </Button>
                      {/snippet}
                      <FileDiffComposer
                        files={visibleCommitDiffFiles}
                        viewMode={commitDiffViewMode}
                        selectedPath={selectedCommitFilePath}
                        collapsedFilePaths={collapsedCommitFilePaths}
                        scrollToFile={commitFileScrollTarget}
                        stickyHeaders
                        onFileToggle={toggleCommitFile}
                        fileHeaderLeading={commitFileHeaderLeading}
                      />
                    </section>
                  </div>
                {:else if !canCollaborate}
                  <p class="community-projects__status">
                    Sign in to view the changed files for this commit.
                  </p>
                {:else if effectiveSourceError}
                  {@render projectSourceError(effectiveSourceError)}
                {:else if selectedCommitDetail}
                  <p class="community-projects__status">
                    This commit does not change any files.
                  </p>
                {:else}
                  <CommunitySkeleton
                    layout="repository"
                    label="Loading commit diff"
                  />
                {/if}
              </Collapsible.Content>
            </Collapsible.Root>
          </article>
        {:else}
          {@render surfaceHeader(
            "Commits",
            "Repository history loaded through the relay gateway.",
          )}
          <div class="community-projects__commit-layout">
            {#if effectiveSourceError}
              {@render projectSourceError(effectiveSourceError)}
            {:else}
              <CommunityProjectsCommitList
                {commits}
                {commitActivity}
                {commitBranch}
                {selectedProject}
                {selectedRepository}
                {repositories}
                {onSelectCommit}
                onCopyCommit={(hash) => void copyCommitHash(hash)}
              />
            {/if}
          </div>
        {/if}
      {:else if view === "files"}
        <CommunityProjectsRepositoryPane
          {loading}
          {canCollaborate}
          hasRepositorySources={repositorySources.length > 0}
          sourceError={effectiveSourceError}
          homeChannelId={projectHomeChannel?.channelId}
          homeChannelName={projectHomeChannel
            ? channelName(projectHomeChannel)
            : undefined}
          browsableCount={browsableRepositories.length}
          {tree}
          selectedPath={repositorySelectedPath}
          blob={repositorySelectedBlob}
          bind:fileTreeOpen={repositoryFileTreeOpen}
          bind:markdownView={repositoryMarkdownView}
          fileTreeEntries={repositoryFileTreeEntries}
          isMarkdown={repositorySelectedIsMarkdown}
          fileBreadcrumbs={repositorySelectedBreadcrumbs}
          directoryBreadcrumbs={repositoryDirectoryBreadcrumbs}
          currentPath={repositoryCurrentPath}
          directoryEntries={repositoryEntries}
          pathCommits={repositoryPathCommits}
          {repositoryName}
          branch={activeRepositoryBranch}
          branches={repositoryBranches}
          latestCommitAuthor={tree?.commit
            ? commitAuthorMember(tree.commit)
            : undefined}
          {members}
          {rooms}
          {communityEmojis}
          {onSelectChannel}
          onSelectBranch={selectRepositoryBranch}
          onOpenDirectory={openRepositoryDirectory}
          onOpenFile={openRepositoryFile}
          {onSelectCommit}
          onLoadPathCommit={onLoadRepositoryPathCommit}
        />
      {:else if view === "people" || view === "contributors"}
        {@render surfaceHeader(
          "Contributors",
          groupByRepository
            ? "Collaborators inherited from each repository channel."
            : "Project collaborators are inherited from the project's NIP-29 channel.",
        )}
        <CommunityProjectsPeopleList
          {members}
          groups={groupByRepository ? contributorRepositorySections : []}
          {listLayout}
          {onOpenProfile}
          {onMessageMember}
          {onWaveMember}
        />
      {/if}
    </section>
  </AppShell.Body>
{/if}

<CommunityProjectsPullRequestSubmitDialog
  bind:submissionOpen={reviewSubmissionOpen}
  bind:closeOpen={reviewCloseConfirmationOpen}
  bind:decision={reviewSubmissionDecision}
  bind:body={reviewSubmissionBody}
  bind:submissionError={reviewSubmissionError}
  closeError={reviewCloseError}
  {busy}
  {canCollaborate}
  {operation}
  pullRequestTitle={selectedPullRequest?.title ?? "the pull request"}
  {members}
  {rooms}
  {communityEmojis}
  {currentMemberId}
  onSubmit={() => void submitPullRequestReview()}
  onConfirmClose={confirmClosePullRequest}
/>
<CommunityProjectsCreateDialogs
  bind:projectOpen={projectDialogOpen}
  projectMode={projectDialogMode}
  bind:projectDraft
  bind:channelOpen={projectChannelCommandOpen}
  channelMode={projectChannelCommandMode}
  channelPending={channelAttachmentPending}
  channelTarget={channelAttachmentTarget}
  channelProjects={channelAttachmentProjects}
  channelOptions={channelCommandOptions}
  {projectChannelIds}
  bind:repositoryOpen={repositoryDialogOpen}
  bind:repositoryDraft
  bind:repositoryCommandOpen
  bind:repositoryCommandStep
  bind:repositoryCommandCoordinate
  {attachableRepositories}
  repositoryAttachmentProjects={repositoryAttachmentProjects(
    repositoryCommandCoordinate,
  )}
  bind:githubOpen={githubCommandOpen}
  bind:githubStep={githubCommandStep}
  bind:githubConnection
  githubConnections={activeGitHubConnections}
  githubRepositories={matchingGitHubRepositories}
  githubLoading={githubCommandLoading}
  githubError={githubCommandError}
  bind:githubManagerOpen
  bind:githubManagerFormOpen
  bind:githubDraft
  {githubManagerConnection}
  githubManagerConnections={githubConnections}
  {githubManagerLoading}
  {githubManagerError}
  {githubManagerOperation}
  bind:taskOpen={taskDialogOpen}
  bind:taskDraft
  {taskProject}
  taskRepositories={taskRepositoryOptions}
  {taskHasScope}
  bind:pullRequestOpen={pullRequestDialogOpen}
  bind:pullRequestDraft
  {pullRequestBranches}
  {pullRequestCompareBranches}
  {pullRequestRefsLoading}
  {pullRequestRefsError}
  {selectedProject}
  {selectedRepository}
  {projects}
  {reviewableRepositories}
  availableChannels={availableProjectChannels}
  {members}
  {rooms}
  {communityEmojis}
  {currentMemberId}
  {busy}
  {operation}
  {localError}
  {canManageForge}
  onResetError={resetError}
  onOpenChannelPicker={openProjectChannelPicker}
  onSelectChannelProject={selectChannelAttachmentProject}
  onSelectProjectChannel={selectProjectOrAttachChannel}
  onSubmitProject={submitProject}
  onSelectRepositoryProject={selectRepositoryProject}
  onSubmitRepository={submitRepository}
  onSelectExistingRepository={selectExistingRepository}
  onRepositoryPickerBack={backRepositoryPicker}
  onAttachExistingRepository={attachExistingRepository}
  onSelectGitHubConnection={selectGitHubConnection}
  onGitHubPickerBack={backGitHubPicker}
  onAttachGitHubRepository={attachGitHubRepository}
  onOpenGitHubManager={openGitHubManager}
  onSubmitGitHubConnection={submitGitHubConnection}
  onRefreshGitHubConnections={refreshGitHubConnections}
  onRevalidateGitHubConnection={revalidateGitHubConnection}
  onOpenGitHubConnectionForm={openGitHubConnectionForm}
  onGitHubManagerBack={backGitHubManagerForm}
  onSelectTaskProject={selectTaskProject}
  onSelectTaskRepository={selectTaskRepository}
  onSubmitTask={submitTask}
  onSelectPullRequestRepository={selectPullRequestRepository}
  onSubmitPullRequest={submitPullRequest}
/>
