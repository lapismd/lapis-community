<script lang="ts">
  import {
    FileChangeStats,
    FileDiffComposer,
    FileListing,
    FileListingViewModeToggle,
    resolveDiffLanguage,
    type FileDiffComposerFileContext,
    type FileDiffFileScrollTarget,
    type FileDiffLineContext,
    type FileDiffViewMode,
    type FileListingViewMode,
  } from "@lapismd/design-core/diff";
  import { AppShell } from "@lapismd/design-core/shell";
  import * as Alert from "@lapismd/design-core/shadcn/alert";
  import * as AlertDialog from "@lapismd/design-core/shadcn/alert-dialog";
  import * as Breadcrumb from "@lapismd/design-core/shadcn/breadcrumb";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as ButtonGroup from "@lapismd/design-core/shadcn/button-group";
  import { Checkbox } from "@lapismd/design-core/shadcn/checkbox";
  import { CodeBlock } from "@lapismd/design-core/shadcn/code-block";
  import * as Collapsible from "@lapismd/design-core/shadcn/collapsible";
  import * as Command from "@lapismd/design-core/shadcn/command";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import * as Empty from "@lapismd/design-core/shadcn/empty";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import * as Select from "@lapismd/design-core/shadcn/select";
  import { Skeleton } from "@lapismd/design-core/shadcn/skeleton";
  import * as Tabs from "@lapismd/design-core/shadcn/tabs";
  import * as Tooltip from "@lapismd/design-core/shadcn/tooltip";
  import * as ToggleGroup from "@lapismd/design-core/shadcn/toggle-group";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import CheckIcon from "@lucide/svelte/icons/check";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import CircleIcon from "@lucide/svelte/icons/circle";
  import CircleCheckIcon from "@lucide/svelte/icons/circle-check";
  import CircleDashedIcon from "@lucide/svelte/icons/circle-dashed";
  import CircleXIcon from "@lucide/svelte/icons/circle-x";
  import CodeXmlIcon from "@lucide/svelte/icons/code-xml";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
  import EyeIcon from "@lucide/svelte/icons/eye";
  import FileIcon from "@lucide/svelte/icons/file";
  import FolderIcon from "@lucide/svelte/icons/folder";
  import FolderGit2Icon from "@lucide/svelte/icons/folder-git-2";
  import FolderKanbanIcon from "@lucide/svelte/icons/folder-kanban";
  import FolderPlusIcon from "@lucide/svelte/icons/folder-plus";
  import GitBranchIcon from "@lucide/svelte/icons/git-branch";
  import GitCommitHorizontalIcon from "@lucide/svelte/icons/git-commit-horizontal";
  import GitForkIcon from "@lucide/svelte/icons/git-fork";
  import GitMergeIcon from "@lucide/svelte/icons/git-merge";
  import GitPullRequestIcon from "@lucide/svelte/icons/git-pull-request";
  import HistoryIcon from "@lucide/svelte/icons/history";
  import HashIcon from "@lucide/svelte/icons/hash";
  import LayoutGridIcon from "@lucide/svelte/icons/layout-grid";
  import ListIcon from "@lucide/svelte/icons/list";
  import ListTodoIcon from "@lucide/svelte/icons/list-todo";
  import LinkIcon from "@lucide/svelte/icons/link";
  import MessageSquareIcon from "@lucide/svelte/icons/message-square";
  import MessageSquarePlusIcon from "@lucide/svelte/icons/message-square-plus";
  import EllipsisVerticalIcon from "@lucide/svelte/icons/ellipsis-vertical";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import Settings2Icon from "@lucide/svelte/icons/settings-2";
  import UnlinkIcon from "@lucide/svelte/icons/unlink";
  import UserIcon from "@lucide/svelte/icons/user";
  import UserRoundPlusIcon from "@lucide/svelte/icons/user-round-plus";

  import {
    GITHUB_REVIEW_COMMENT_REACTIONS,
    projectForgeBranchName,
    projectForgeBranchRefs,
    splitProjectForgePatch,
    projectForgeBoundChannels,
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
    type PullRequestLifecycleEvent,
    type PullRequestReviewKind,
  } from "../../projects/index.js";
  import CommunitySidebarToggleIcon from "../community-app-shell/CommunitySidebarToggleIcon.svelte";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityMemberHoverCard from "../community-member-hover-card/CommunityMemberHoverCard.svelte";
  import CommunityMarkdownContent from "../community-markdown-content/CommunityMarkdownContent.svelte";
  import CommunityMessage from "../community-message/CommunityMessage.svelte";
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
  import {
    isMarkdownRepositoryPath,
    repositoryBreadcrumbSegments,
    repositoryBrowserEntries,
    repositoryParentPath,
  } from "./repository-browser.js";
  import "../community-confirm-dialog.css";
  import "./CommunityProjects.css";

  type ReviewTimelineEntry =
    | { kind: "opened"; event: PullRequestState["root"] }
    | {
        kind: "lifecycle";
        event: PullRequestLifecycleEvent["event"];
        lifecycle: PullRequestLifecycleEvent["lifecycle"];
        mergeCommit: string;
      }
    | {
        kind: "review-request";
        event: PullRequestComment["event"];
        comment: PullRequestComment;
      }
    | {
        kind: "comment";
        event: PullRequestComment["event"];
        comment: PullRequestComment;
      };

  let {
    view,
    projects,
    selectedProject,
    repositories = [],
    repositoryOptions = [],
    selectedRepository,
    repositoryCapabilities = {},
    activity = [],
    tasks = [],
    selectedTask,
    pullRequests = [],
    selectedPullRequest,
    commits = [],
    commitBranch = "",
    selectedCommit,
    selectedCommitDetail,
    sourceError = "",
    selectedCommitError = "",
    tree,
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
    onSelectChannel,
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
    onMergePullRequest,
    onUpdatePullRequestLifecycle,
    onAddPullRequestComment,
    onAddInlineComment,
    onTogglePullRequestCommentReaction,
    onLoadRepositoryRefs,
    onSelectCommit,
    onCloseCommit,
    onSelectPath,
    onRetry,
  }: CommunityProjectsProps = $props();

  let projectDialogOpen = $state(false);
  let projectDialogMode = $state<"create" | "edit">("create");
  let projectDialogProject = $state<ProjectForgeProject>();
  let handledDialogRequestId = 0;
  let projectChannelCommandOpen = $state(false);
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

  function openRepositoryFile(path: string): void {
    if (!path || path === selectedPath) return;
    onSelectPath?.(path);
  }

  function formatRepositoryFileSize(size: number | undefined): string {
    if (size === undefined) return "";
    if (size < 1_000) return `${size} B`;
    if (size < 1_000_000) return `${(size / 1_000).toFixed(1)} KB`;
    return `${(size / 1_000_000).toFixed(1)} MB`;
  }

  $effect(() => {
    const nextTreeKey = tree ? `${tree.ref}:${tree.sha}` : "";
    if (repositoryTreeKey === nextTreeKey) return;
    repositoryTreeKey = nextTreeKey;
    repositoryCurrentPath = "";
    repositoryPreviewPath = "";
    repositoryMarkdownView = "preview";
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
    selectedRepository
      ? tasks.filter(
          (task) =>
            task.repository.coordinate ===
            selectedRepository.address.coordinate,
        )
      : selectedProject
        ? tasks.filter((task) =>
            selectedProject.repositories.some(
              (repository) =>
                repository.coordinate === task.repository.coordinate,
            ),
          )
        : tasks,
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
  const visibleActivity = $derived(
    activity.filter((item) => {
      if (item.kind === "project") return false;
      if (item.kind !== "repository" || !item.repositoryCoordinate) return true;
      return (
        repositories.find(
          (repository) =>
            repository.address.coordinate === item.repositoryCoordinate,
        )?.repositoryClass !== "task-anchor"
      );
    }),
  );
  const weekActivity = $derived(
    visibleActivity.filter(
      (item) => item.createdAt >= Math.floor(Date.now() / 1_000) - 604_800,
    ),
  );
  const weekActivityCount = $derived(weekActivity.length);
  const weekTaskCount = $derived(
    weekActivity.filter((item) => item.kind === "task").length,
  );
  const weekProjectCount = $derived(
    new Set(weekActivity.map((item) => item.projectCoordinate)).size,
  );
  const overviewTabs = [
    { value: "activity", label: "Activity" },
    { value: "projects", label: "Projects" },
    { value: "repositories", label: "Repositories" },
    { value: "tasks", label: "Tasks" },
    { value: "reviews", label: "Reviews" },
    { value: "channels", label: "Channels" },
  ] as const;
  const projectTabs = [
    { value: "overview", label: "Overview" },
    { value: "files", label: "Files" },
    { value: "commits", label: "Commits" },
    { value: "tasks", label: "Tasks" },
    { value: "reviews", label: "Review" },
    { value: "channels", label: "Channels" },
    { value: "contributors", label: "Contributors" },
  ] as const;
  const reviewGroups = [
    { lifecycle: "open", label: "Open" },
    { lifecycle: "draft", label: "Draft" },
    { lifecycle: "merged", label: "Merged" },
    { lifecycle: "closed", label: "Closed" },
  ] as const;
  const reviewTimeline: readonly ReviewTimelineEntry[] = $derived.by(() => {
    if (!selectedPullRequest) return [];
    const entries: ReviewTimelineEntry[] = [
      { kind: "opened", event: selectedPullRequest.root },
      ...selectedPullRequest.lifecycleEvents.map((entry) => ({
        kind: "lifecycle" as const,
        event: entry.event,
        lifecycle: entry.lifecycle,
        mergeCommit: entry.mergeCommit,
      })),
      ...selectedPullRequest.comments
        .filter(conversationComment)
        .map((comment) => ({
          kind: comment.isReviewRequest
            ? ("review-request" as const)
            : ("comment" as const),
          event: comment.event,
          comment,
        })),
    ];
    return entries.toSorted(
      (left, right) =>
        left.event.created_at - right.event.created_at ||
        left.event.id.localeCompare(right.event.id),
    );
  });
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

  function normalizedGitHubRepositoryUrl(value: string): string {
    try {
      const url = new URL(value);
      if (url.hostname.toLowerCase() !== "github.com") return "";
      return `${url.hostname.toLowerCase()}${url.pathname
        .replace(/\.git$/iu, "")
        .replace(/\/+$/u, "")
        .toLowerCase()}`;
    } catch {
      return "";
    }
  }

  function repositoryMatchesGitHubAnnouncement(
    repository: ProjectForgeRepository,
    providerRepository: ProjectForgeGitHubRepository,
  ): boolean {
    const clone = normalizedGitHubRepositoryUrl(providerRepository.clone_url);
    const web = normalizedGitHubRepositoryUrl(providerRepository.html_url);
    return (
      clone !== "" &&
      web !== "" &&
      repository.cloneUrls.some(
        (value) => normalizedGitHubRepositoryUrl(value) === clone,
      ) &&
      repository.webUrls.some(
        (value) => normalizedGitHubRepositoryUrl(value) === web,
      )
    );
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

  function taskIsMine(task: ProjectTaskState, memberId: string): boolean {
    return task.root.pubkey === memberId || task.assignees.includes(memberId);
  }

  function projectPullRequestsFor(project: (typeof projects)[number]) {
    const coordinates = new Set(
      project.repositories.map((repository) => repository.coordinate),
    );
    return pullRequests.filter((pullRequest) =>
      coordinates.has(pullRequest.repository.coordinate),
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

  function activityStatusLabel(value: string): string {
    if (value === "open") return "Backlog";
    if (value === "applied" || value === "closed") return "Completed";
    return value[0]!.toUpperCase() + value.slice(1);
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

  function conversationComment(comment: PullRequestComment): boolean {
    return !comment.isInlineComment || comment.inlineStatus !== "current";
  }

  function eventTagValue(
    event: PullRequestState["root"],
    name: string,
  ): string {
    return event.tags.find((tag) => tag[0] === name)?.[1]?.trim() ?? "";
  }

  function reviewTimelineActor(event: PullRequestState["root"]): string {
    const external = eventTagValue(event, "external-author");
    if (external) return `@${external}`;
    if (eventTagValue(event, "external-provider") === "github") return "GitHub";
    return memberForPubkey(event.pubkey).name;
  }

  function reviewTimelineActorMember(
    event: PullRequestState["root"],
  ): CommunityMemberModel | undefined {
    if (
      eventTagValue(event, "external-author") ||
      eventTagValue(event, "external-provider")
    )
      return undefined;
    return memberForPubkey(event.pubkey);
  }

  function reviewRequestTarget(comment: PullRequestComment): string {
    const external = eventTagValue(comment.event, "external-reviewer");
    if (external) return `@${external}`;
    const reviewer = comment.reviewerPubkeys[0];
    return reviewer ? memberForPubkey(reviewer).name : "a reviewer";
  }

  function reviewRequestTargetMember(
    comment: PullRequestComment,
  ): CommunityMemberModel | undefined {
    if (eventTagValue(comment.event, "external-reviewer")) return undefined;
    const reviewer = comment.reviewerPubkeys[0];
    return reviewer ? memberForPubkey(reviewer) : undefined;
  }

  function reviewLifecycleAction(
    entry: Extract<ReviewTimelineEntry, { kind: "lifecycle" }>,
  ): string {
    if (entry.lifecycle === "merged") return "merged this review";
    if (entry.lifecycle === "closed") return "closed this review";
    if (entry.lifecycle === "draft") return "converted this review to draft";
    return "reopened this review";
  }

  function isExternalReviewDecision(comment: PullRequestComment): boolean {
    return comment.event.tags.some((tag) => tag[0] === "external-decision");
  }

  function reviewCommentDecision(
    comment: PullRequestComment,
  ): "approved" | "changes-requested" | undefined {
    if (comment.decision) return comment.decision;
    const external = eventTagValue(comment.event, "external-decision")
      .toLocaleLowerCase()
      .replaceAll("_", "-");
    if (external === "approved") return "approved";
    if (external === "changes-requested") return "changes-requested";
    return undefined;
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

  function canMergePullRequest(pullRequest: PullRequestState): boolean {
    return (
      pullRequest.lifecycle === "open" &&
      repositoryCapabilities[pullRequest.repository.coordinate]?.merge ===
        true &&
      onMergePullRequest !== undefined
    );
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
    const known = members.find((member) => member.id === pubkey);
    if (known) return known;
    const shortened = pubkey.slice(0, 12);
    return {
      id: pubkey,
      name: shortened,
      handle: `@${shortened}`,
      initials: shortened.slice(0, 2).toUpperCase(),
    };
  }

  function commitAuthorMember(
    commit: (typeof commits)[number],
  ): CommunityMemberModel {
    const name =
      commit.author_name?.trim() ||
      commit.author_email?.trim() ||
      "Unknown author";
    const words = name.split(/\s+/).filter(Boolean);
    const initials =
      words.length > 1
        ? `${words[0]![0] ?? ""}${words[1]![0] ?? ""}`.toUpperCase()
        : name.slice(0, 2).toUpperCase();
    return {
      id: `git:${commit.author_email ?? commit.sha}`,
      name,
      handle: commit.author_email ?? name,
      initials,
    };
  }

  function commitDate(value: string | undefined): string {
    if (!value) return "Unknown date";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("en", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
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
</script>

{#snippet statusChip(value: string)}
  <CommunityChip
    size="compact"
    tone={value === "merged" || value === "closed"
      ? "success"
      : value === "draft"
        ? "warning"
        : "accent"}>{value}</CommunityChip
  >
{/snippet}

{#snippet reviewStatusIcon(
  lifecycle: (typeof pullRequests)[number]["lifecycle"],
)}
  <span
    class="community-projects__review-status-icon"
    data-status={lifecycle}
    title={reviewGroups.find((group) => group.lifecycle === lifecycle)?.label ??
      lifecycle}
  >
    {#if lifecycle === "closed"}
      <CircleXIcon aria-hidden="true" />
    {:else if lifecycle === "merged"}
      <GitMergeIcon aria-hidden="true" />
    {:else if lifecycle === "draft"}
      <CircleDashedIcon aria-hidden="true" />
    {:else}
      <CircleIcon aria-hidden="true" />
    {/if}
  </span>
{/snippet}

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

{#snippet memberHoverMention(member: CommunityMemberModel, label: string)}
  <CommunityMemberHoverCard
    {member}
    trigger="mention"
    triggerLabel={label}
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
            title={selectedProject
              ? "Channel attachment is not available yet"
              : "Select a project to add a channel"}
            disabled
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
  <AppShell.Body
    layout="regions"
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
        </div>
      {/if}

      {#if cachedCatalogAt !== undefined}
        <Alert.Root class="community-projects__alert">
          <Alert.Title>Showing cached project catalog</Alert.Title>
          <Alert.Description>
            Last verified <CommunityRelativeTime
              timestamp={Math.floor(cachedCatalogAt / 1_000)}
            />. Live project data is being refreshed from this community's
            relay.
          </Alert.Description>
        </Alert.Root>
      {/if}

      {#if error}
        <Alert.Root
          variant={cachedCatalogAt === undefined ? "destructive" : "default"}
          class="community-projects__alert"
        >
          <Alert.Title>
            {cachedCatalogAt === undefined
              ? "Projects could not be loaded"
              : "Live project refresh failed"}
          </Alert.Title>
          <Alert.Description>{error}</Alert.Description>
          {#if onRetry}
            <Button type="button" variant="outline" size="sm" onclick={onRetry}>
              <RotateCcwIcon data-icon="inline-start" aria-hidden="true" /> Retry
            </Button>
          {/if}
        </Alert.Root>
      {/if}

      {#if view === "activity"}
        <div class="community-projects__workspace">
          <header class="community-projects__page-heading">
            <h1>Projects Activity</h1>
            <p>
              This week: {weekTaskCount}
              {weekTaskCount === 1 ? "task" : "tasks"} opened, and {weekProjectCount}
              active {weekProjectCount === 1 ? "project" : "projects"}.
            </p>
          </header>
          <div class="community-projects__section-divider">
            <span
              >{loading || weekActivityCount > 0
                ? "This week"
                : "Earlier"}</span
            >
          </div>
          <div class="community-projects__activity">
            {#if loading && visibleActivity.length === 0}
              <div
                class="community-projects__activity-loading"
                role="status"
                aria-label="Loading project activity"
              >
                {#each [0, 1, 2, 3] as row (row)}
                  <div
                    class="community-projects__activity-item community-projects__activity-item--skeleton"
                    aria-hidden="true"
                  >
                    <Skeleton
                      class="community-projects__activity-skeleton-avatar"
                    />
                    <span class="community-projects__activity-line"></span>
                    <div class="community-projects__activity-copy">
                      <div>
                        <Skeleton
                          class="community-projects__activity-skeleton-actor"
                        />
                        <Skeleton
                          class="community-projects__activity-skeleton-action"
                        />
                      </div>
                      <Skeleton
                        class="community-projects__activity-skeleton-time"
                      />
                      <div class="community-projects__activity-skeleton-card">
                        <Skeleton
                          class="community-projects__activity-skeleton-title"
                        />
                        <Skeleton
                          class="community-projects__activity-skeleton-body"
                        />
                      </div>
                    </div>
                  </div>
                {/each}
              </div>
            {:else}
              {#each visibleActivity as item (item.id)}
                {@const actor = activityMember(item.actorPubkey)}
                <article class="community-projects__activity-item">
                  {@render memberHoverAvatar(actor, "medium")}
                  <span
                    class="community-projects__activity-line"
                    aria-hidden="true"
                  ></span>
                  <div class="community-projects__activity-copy">
                    <div>
                      <strong>{actor.name}</strong>
                      <span
                        >{item.action}
                        {projectName(item.projectCoordinate)}</span
                      >
                    </div>
                    <CommunityRelativeTime timestamp={item.createdAt} />
                    <button
                      type="button"
                      class="community-projects__activity-card"
                      onclick={() => openActivityItem(item)}
                    >
                      <span class="community-projects__activity-title">
                        {#if item.kind === "review" || item.kind === "approval" || item.kind === "changes-requested"}
                          <GitPullRequestIcon aria-hidden="true" />
                        {:else if item.kind === "commit"}
                          <GitCommitHorizontalIcon aria-hidden="true" />
                        {:else if item.kind === "repository"}
                          <FolderGit2Icon aria-hidden="true" />
                        {:else if item.kind === "project"}
                          <FolderKanbanIcon aria-hidden="true" />
                        {:else if item.kind === "task"}
                          <CircleIcon aria-hidden="true" />
                        {:else if item.kind === "comment" || item.kind === "assignment"}
                          <MessageSquareIcon aria-hidden="true" />
                        {:else}
                          <CodeXmlIcon aria-hidden="true" />
                        {/if}
                        <strong>{item.title}</strong>
                      </span>
                      {#if item.body}
                        <CommunityMarkdownContent
                          class="community-projects__activity-body"
                          content={item.body}
                          {members}
                          {rooms}
                          {communityEmojis}
                        />
                      {/if}
                      {#if item.detail && (item.kind === "task" || item.kind === "review")}
                        <span class="community-projects__activity-status">
                          <CommunityChip
                            size="compact"
                            tone={item.detail === "closed" ||
                            item.detail === "applied"
                              ? "success"
                              : "warning"}
                            >{activityStatusLabel(item.detail)}</CommunityChip
                          >
                        </span>
                      {/if}
                    </button>
                  </div>
                </article>
              {:else}
                <p class="community-projects__status">
                  No project activity yet.
                </p>
              {/each}
            {/if}
          </div>
        </div>
      {:else if view === "directory" || view === "projects"}
        <header class="community-projects__directory-header">
          <div>
            <FolderKanbanIcon aria-hidden="true" />
            <h1>Projects</h1>
          </div>
          {@render directoryActions()}
        </header>

        {#if loading && projects.length === 0}
          <div class="community-projects__status" role="status">
            Loading projects…
          </div>
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
      {:else if view === "overview"}
        <article
          class="community-projects__workspace community-projects__readme"
        >
          {#if tree?.readme}
            <CommunityMarkdownContent
              content={tree.readme}
              {members}
              {rooms}
              {communityEmojis}
            />
          {:else if loading}
            <div
              class="community-projects__overview-skeleton"
              role="status"
              aria-label="Loading repository overview"
            >
              <div aria-hidden="true">
                <Skeleton class="community-projects__overview-skeleton-title" />
                <div class="community-projects__overview-skeleton-paragraph">
                  <Skeleton />
                  <Skeleton />
                  <Skeleton />
                </div>
                <Skeleton
                  class="community-projects__overview-skeleton-heading"
                />
                <div class="community-projects__overview-skeleton-paragraph">
                  <Skeleton />
                  <Skeleton />
                </div>
                <div class="community-projects__overview-skeleton-code">
                  <Skeleton />
                  <Skeleton />
                  <Skeleton />
                  <Skeleton />
                </div>
              </div>
            </div>
          {:else if !canCollaborate && repositorySources.length > 0}
            <Empty.Root class="community-projects__empty">
              <Empty.Header>
                <Empty.Media variant="icon"
                  ><FileIcon aria-hidden="true" /></Empty.Media
                >
                <Empty.Title>Sign in to view repository files</Empty.Title>
                <Empty.Description>
                  Repository source reads use your Nostr identity to enforce the
                  project's channel access at the relay gateway.
                </Empty.Description>
              </Empty.Header>
            </Empty.Root>
          {:else if effectiveSourceError}
            {@render projectSourceError(effectiveSourceError)}
          {:else}
            <Empty.Root class="community-projects__empty">
              <Empty.Header>
                <Empty.Media variant="icon"
                  ><FileIcon aria-hidden="true" /></Empty.Media
                >
                <Empty.Title>No repository overview yet</Empty.Title>
                <Empty.Description>
                  Add a README to a repository with relay-advertised browsing to
                  show it here. Community does not assume local Git access.
                </Empty.Description>
              </Empty.Header>
            </Empty.Root>
          {/if}
        </article>
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
                <dt>{@render taskStatusIcon(selectedTask.lifecycle)} Status</dt>
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
          {#if mineTasks.length > 0 || otherTasks.length > 0}
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
        {#if selectedPullRequest}
          {#if showReviewHeader}
            <header class="community-projects__review-header">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                class="community-projects__review-back"
                aria-label="Back to reviews"
                title="Back to reviews"
                onclick={onClosePullRequest}
              >
                <ArrowLeftIcon aria-hidden="true" />
              </Button>
              <div>
                <div class="community-projects__review-title">
                  <h2 id="community-project-review-title">
                    {selectedPullRequest.title}
                    <span>#{selectedPullRequest.root.id.slice(0, 8)}</span>
                  </h2>
                </div>
                <p>
                  Review opened <CommunityRelativeTime
                    timestamp={selectedPullRequest.createdAt}
                  />
                </p>
              </div>
            </header>
          {/if}
          <article
            class="community-projects__review-detail"
            aria-label={showReviewHeader
              ? undefined
              : selectedPullRequest.title}
            aria-labelledby={showReviewHeader
              ? "community-project-review-title"
              : undefined}
          >
            <dl class="community-projects__review-meta">
              <div>
                <dt><GitBranchIcon aria-hidden="true" /><span>Branch</span></dt>
                <dd class="community-projects__review-branch">
                  <span
                    >{selectedPullRequest.branchName || "unknown branch"}</span
                  >
                  <span aria-hidden="true">→</span>
                  <span
                    >{selectedPullRequest.targetBranch ||
                      "default branch"}</span
                  >
                  {#if pullRequestDiff}
                    <span class="community-projects__review-stats">
                      <span
                        >+{pullRequestDiff.files.reduce(
                          (total, file) => total + file.additions,
                          0,
                        )}</span
                      >
                      <span
                        >-{pullRequestDiff.files.reduce(
                          (total, file) => total + file.deletions,
                          0,
                        )}</span
                      >
                    </span>
                  {/if}
                  <code title={selectedPullRequest.currentCommit}
                    >{selectedPullRequest.currentCommit.slice(0, 7)}</code
                  >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    class="community-projects__copy-control"
                    aria-label="Copy commit hash"
                    title="Copy commit hash"
                    onclick={() =>
                      void copyCommitHash(selectedPullRequest.currentCommit)}
                    ><CopyIcon aria-hidden="true" /></Button
                  >
                </dd>
              </div>
              <div>
                <dt><UserIcon aria-hidden="true" /><span>Reviewers</span></dt>
                <dd class="community-projects__review-reviewers">
                  {#each selectedPullRequest.reviewers as reviewer (reviewer)}
                    {@const reviewerMember = memberForPubkey(reviewer)}
                    {@render memberHoverAvatar(reviewerMember)}
                    <span>{reviewerMember.name}</span>
                  {:else}
                    <span class="community-projects__muted">No reviewers</span>
                  {/each}
                </dd>
              </div>
              <div>
                <dt>
                  {#if selectedPullRequest.lifecycle === "merged"}
                    <GitMergeIcon aria-hidden="true" />
                  {:else}
                    <GitPullRequestIcon aria-hidden="true" />
                  {/if}
                  <span>Status</span>
                </dt>
                <dd
                  class="community-projects__review-status"
                  data-status={selectedPullRequest.lifecycle}
                >
                  {reviewGroups.find(
                    (group) =>
                      group.lifecycle === selectedPullRequest.lifecycle,
                  )?.label ?? selectedPullRequest.lifecycle}
                </dd>
              </div>
            </dl>
            {#if selectedPullRequest.content}
              <Collapsible.Root
                class="community-projects__review-section"
                bind:open={reviewDescriptionOpen}
              >
                <Collapsible.Trigger
                  class="community-projects__review-section-trigger"
                >
                  <span>Description</span>
                  {#if reviewDescriptionOpen}
                    <ChevronDownIcon aria-hidden="true" />
                  {:else}
                    <ChevronRightIcon aria-hidden="true" />
                  {/if}
                </Collapsible.Trigger>
                <Collapsible.Content
                  class="community-projects__review-section-content"
                >
                  <CommunityMarkdownContent
                    content={selectedPullRequest.content}
                    {members}
                    {rooms}
                    {communityEmojis}
                  />
                </Collapsible.Content>
              </Collapsible.Root>
            {/if}
            <Collapsible.Root
              class="community-projects__review-section community-projects__review-section--files"
              bind:open={reviewFilesOpen}
            >
              <Collapsible.Trigger
                class="community-projects__review-section-trigger community-projects__review-section-trigger--files"
              >
                <span>Files changed</span>
                {#if reviewFilesOpen}
                  <ChevronDownIcon aria-hidden="true" />
                  {#if pullRequestDiff}<span
                      class="community-projects__review-section-count"
                      >{pullRequestDiff.files.length}</span
                    >{/if}
                {:else}
                  <ChevronRightIcon aria-hidden="true" />
                {/if}
              </Collapsible.Trigger>
              <Collapsible.Content
                class="community-projects__review-files-content"
              >
                {#if loading && !pullRequestDiff}
                  <p class="community-projects__status" role="status">
                    Loading repository diff…
                  </p>
                {:else if pullRequestDiffError}
                  {@render projectSourceError(pullRequestDiffError)}
                {:else if pullRequestDiff}
                  <div class="community-projects__diff-summary">
                    <span class="community-projects__diff-summary-copy">
                      <strong
                        >{pullRequestDiff.files.length} changed files</strong
                      >
                      <span
                        >{viewedReviewFileCount} of {pullRequestDiff.files
                          .length}
                        viewed</span
                      >
                    </span>
                    <span class="community-projects__diff-summary-actions">
                      <FileChangeStats
                        additions={pullRequestDiff.files.reduce(
                          (total, file) => total + file.additions,
                          0,
                        )}
                        deletions={pullRequestDiff.files.reduce(
                          (total, file) => total + file.deletions,
                          0,
                        )}
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
                            value={reviewDiffViewMode}
                            onValueChange={setReviewDiffViewMode}
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
                    data-file-list-open={reviewFileListOpen}
                  >
                    {#if reviewFileListOpen}
                      <aside aria-label="Changed files">
                        <Input
                          type="search"
                          bind:value={reviewFileFilter}
                          class="community-projects__changed-files-filter"
                          aria-label="Filter changed files"
                          placeholder="Filter changed files"
                        />
                        <div class="community-projects__changed-files-toolbar">
                          <span>Files</span>
                          <FileListingViewModeToggle
                            bind:mode={diffFileListMode}
                          />
                        </div>
                        <FileListing
                          files={visibleProjectDiffFiles}
                          mode={diffFileListMode}
                          selectedPath={selectedReviewFilePath}
                          onSelectPath={selectReviewFile}
                        />
                      </aside>
                    {/if}
                    <div class="community-projects__diff-content">
                      {#snippet reviewFileHeaderLeading(
                        _context: FileDiffComposerFileContext,
                      )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          class="community-projects__diff-sidebar-toggle"
                          aria-label={reviewFileListOpen
                            ? "Hide changed files"
                            : "Show changed files"}
                          aria-expanded={reviewFileListOpen}
                          data-ui-part="sidebar-toggle"
                          data-side="left"
                          data-state={reviewFileListOpen
                            ? "expanded"
                            : "collapsed"}
                          title={reviewFileListOpen
                            ? "Hide changed files"
                            : "Show changed files"}
                          onclick={() =>
                            (reviewFileListOpen = !reviewFileListOpen)}
                        >
                          <CommunitySidebarToggleIcon
                            expanded={reviewFileListOpen}
                          />
                        </Button>
                      {/snippet}
                      {#snippet reviewFileHeader(
                        context: FileDiffComposerFileContext,
                      )}
                        <label class="community-projects__viewed-file">
                          <Checkbox
                            checked={viewedReviewFilePaths.includes(
                              context.path,
                            )}
                            onCheckedChange={(checked) =>
                              setReviewFileViewed(
                                context.path,
                                checked === true,
                              )}
                            aria-label={"Mark " + context.path + " as viewed"}
                          />
                          <span>Viewed</span>
                        </label>
                      {/snippet}
                      {#snippet lineComment(context: FileDiffLineContext)}
                        {#if context.lineNumber !== null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            class="community-projects__line-comment"
                            aria-label={`Comment on ${context.path} line ${context.lineNumber}`}
                            title="Add inline comment"
                            onclick={() => addLineComment(context)}
                          >
                            <MessageSquarePlusIcon aria-hidden="true" />
                          </Button>
                        {/if}
                      {/snippet}
                      {#snippet inlineDiscussion(context: FileDiffLineContext)}
                        {@const inlineComments =
                          selectedPullRequest.comments.filter((comment) =>
                            inlineCommentMatches(comment, context),
                          )}
                        {#if inlineComments.length > 0 || inlineComposerMatches(context)}
                          <div
                            class="community-projects__inline-thread"
                            aria-label={`Discussion on ${context.path} line ${context.lineNumber}`}
                          >
                            {#each inlineComments as comment (comment.event.id)}
                              {@const commentReactionOptions =
                                pullRequestReactionOptions(comment)}
                              {#snippet inlineLabels()}
                                <div class="community-projects__message-labels">
                                  {#if comment.decision}<CommunityChip
                                      size="compact"
                                      tone={comment.decision === "approved"
                                        ? "success"
                                        : "warning"}
                                      >{comment.decision}</CommunityChip
                                    >{/if}
                                </div>
                              {/snippet}
                              <CommunityMessage
                                message={commentMessage(comment)}
                                author={memberForPubkey(comment.event.pubkey)}
                                {members}
                                {rooms}
                                {communityEmojis}
                                {...currentMemberId === undefined
                                  ? {}
                                  : { currentMemberId }}
                                supplement={inlineLabels}
                                density="compact"
                                {...canReactToPullRequestComment(comment)
                                  ? {
                                      onAddReaction: (
                                        _messageId: string,
                                        emoji: string,
                                      ) =>
                                        onTogglePullRequestCommentReaction!(
                                          selectedPullRequest,
                                          comment,
                                          emoji,
                                        ),
                                      onToggleReaction: (
                                        _messageId: string,
                                        emoji: string,
                                      ) =>
                                        onTogglePullRequestCommentReaction!(
                                          selectedPullRequest,
                                          comment,
                                          emoji,
                                        ),
                                    }
                                  : {}}
                                {...commentReactionOptions === undefined
                                  ? {}
                                  : {
                                      reactionOptions: commentReactionOptions,
                                    }}
                              />
                            {/each}
                            {#if inlineComposerMatches(context)}
                              <div class="community-projects__inline-context">
                                <FileIcon aria-hidden="true" />
                                <span>{context.path}</span>
                                <CommunityChip size="compact">
                                  {lineSide(context) === "new"
                                    ? "+"
                                    : "-"}{context.lineNumber}
                                </CommunityChip>
                              </div>
                              <CommunityChatComposer
                                class="community-projects__inline-composer"
                                bind:value={inlineCommentContent}
                                placeholder="Leave a comment on this line…"
                                ariaLabel={`Comment on ${context.path} line ${context.lineNumber}`}
                                submitLabel="Comment"
                                {members}
                                {rooms}
                                {communityEmojis}
                                {...currentMemberId === undefined
                                  ? {}
                                  : { currentMemberId }}
                                {busy}
                                disabled={!canCollaborate}
                                disabledReason="Sign in to comment on this review"
                                onCancel={() => {
                                  inlineCommentAnchor = undefined;
                                  inlineCommentContent = "";
                                }}
                                onSubmit={(submission) =>
                                  submitInlineComment(submission.content)}
                              />
                            {/if}
                          </div>
                        {/if}
                      {/snippet}
                      <FileDiffComposer
                        files={visibleProjectDiffFiles}
                        viewMode={reviewDiffViewMode}
                        selectedPath={selectedReviewFilePath}
                        collapsedFilePaths={collapsedReviewFilePaths}
                        scrollToFile={reviewFileScrollTarget}
                        stickyHeaders
                        onFileToggle={toggleReviewFile}
                        fileHeaderLeading={reviewFileHeaderLeading}
                        fileHeaderTrailing={reviewFileHeader}
                        lineAccessory={lineComment}
                        lineAnnotation={inlineDiscussion}
                      />
                    </div>
                  </div>
                {:else}
                  <p class="community-projects__status">
                    This comparison is unavailable through the relay. Community
                    does not assume local Git access.
                  </p>
                {/if}
              </Collapsible.Content>
            </Collapsible.Root>

            <Collapsible.Root
              class="community-projects__review-section"
              bind:open={reviewCommitsOpen}
            >
              <Collapsible.Trigger
                class="community-projects__review-section-trigger"
              >
                <span>Commits</span>
                {#if reviewCommitsOpen}
                  <ChevronDownIcon aria-hidden="true" />
                  <span class="community-projects__review-section-count"
                    >{selectedPullRequest.updates.length + 1}</span
                  >
                {:else}
                  <ChevronRightIcon aria-hidden="true" />
                {/if}
              </Collapsible.Trigger>
              <Collapsible.Content
                class="community-projects__review-commit-list"
              >
                <button
                  type="button"
                  class="community-projects__review-commit-row"
                  onclick={() =>
                    onSelectCommit?.(
                      reviewCommitSummary(
                        selectedPullRequest.initialCommit,
                        selectedPullRequest.title,
                        selectedPullRequest.content,
                        selectedPullRequest.createdAt,
                        selectedPullRequest.root.pubkey,
                      ),
                    )}
                >
                  <GitCommitHorizontalIcon aria-hidden="true" />
                  <strong>{selectedPullRequest.title}</strong>
                  <code>{selectedPullRequest.initialCommit.slice(0, 7)}</code>
                </button>
                {#each selectedPullRequest.updates as update (update.event.id)}
                  <button
                    type="button"
                    class="community-projects__review-commit-row"
                    onclick={() =>
                      onSelectCommit?.(
                        reviewCommitSummary(
                          update.commit,
                          update.event.content.trim() ||
                            "Updated review branch",
                          update.event.content,
                          update.event.created_at,
                          update.event.pubkey,
                        ),
                      )}
                  >
                    <GitCommitHorizontalIcon aria-hidden="true" />
                    <strong
                      >{update.event.content.trim() ||
                        "Updated review branch"}</strong
                    >
                    <code>{update.commit.slice(0, 7)}</code>
                  </button>
                {/each}
              </Collapsible.Content>
            </Collapsible.Root>

            <Collapsible.Root
              class="community-projects__review-section"
              bind:open={reviewChecksOpen}
            >
              <Collapsible.Trigger
                class="community-projects__review-section-trigger"
              >
                <span>Checks</span>
                {#if reviewChecksOpen}
                  <ChevronDownIcon aria-hidden="true" />
                {:else}
                  <ChevronRightIcon aria-hidden="true" />
                {/if}
              </Collapsible.Trigger>
              <Collapsible.Content
                class="community-projects__review-section-content"
              >
                <p class="community-projects__muted">
                  No checks have been reported for this review yet.
                </p>
              </Collapsible.Content>
            </Collapsible.Root>

            <Collapsible.Root
              class="community-projects__review-section"
              bind:open={reviewActivityOpen}
            >
              <Collapsible.Trigger
                class="community-projects__review-section-trigger"
              >
                <span>Activity</span>
                {#if reviewActivityOpen}
                  <ChevronDownIcon aria-hidden="true" />
                {:else}
                  <ChevronRightIcon aria-hidden="true" />
                {/if}
              </Collapsible.Trigger>
              <Collapsible.Content>
                <section
                  class="community-projects__review-conversation"
                  aria-label="Pull request conversation"
                >
                  <div class="community-projects__review-timeline">
                    {#each reviewTimeline as entry (`${entry.kind}:${entry.event.id}`)}
                      <article
                        class="community-projects__review-timeline-item"
                        data-kind={entry.kind}
                      >
                        <span
                          class="community-projects__review-timeline-marker"
                          data-status={entry.kind === "lifecycle"
                            ? entry.lifecycle
                            : entry.kind}
                        >
                          {#if entry.kind === "opened"}
                            <GitPullRequestIcon aria-hidden="true" />
                          {:else if entry.kind === "review-request"}
                            <UserRoundPlusIcon aria-hidden="true" />
                          {:else if entry.kind === "lifecycle" && entry.lifecycle === "merged"}
                            <GitMergeIcon aria-hidden="true" />
                          {:else if entry.kind === "lifecycle" && entry.lifecycle === "closed"}
                            <CircleXIcon aria-hidden="true" />
                          {:else if entry.kind === "lifecycle" && entry.lifecycle === "draft"}
                            <CircleDashedIcon aria-hidden="true" />
                          {:else if entry.kind === "lifecycle"}
                            <RotateCcwIcon aria-hidden="true" />
                          {:else if reviewCommentDecision(entry.comment) === "approved"}
                            <CheckIcon aria-hidden="true" />
                          {:else if reviewCommentDecision(entry.comment) === "changes-requested"}
                            <CircleXIcon aria-hidden="true" />
                          {:else}
                            <MessageSquareIcon aria-hidden="true" />
                          {/if}
                        </span>
                        <div
                          class="community-projects__review-timeline-content"
                        >
                          {#if entry.kind === "opened"}
                            {@const actorMember = reviewTimelineActorMember(
                              entry.event,
                            )}
                            <div
                              class="community-projects__review-timeline-summary"
                            >
                              <span
                                class="community-projects__review-timeline-sentence"
                              >
                                {#if actorMember}
                                  {@render memberHoverMention(
                                    actorMember,
                                    reviewTimelineActor(entry.event),
                                  )}
                                {:else}
                                  <strong
                                    >{reviewTimelineActor(entry.event)}</strong
                                  >
                                {/if}
                                <span>opened this review</span>
                              </span>
                              <CommunityRelativeTime
                                timestamp={entry.event.created_at}
                              />
                            </div>
                          {:else if entry.kind === "review-request"}
                            {@const actorMember = reviewTimelineActorMember(
                              entry.event,
                            )}
                            {@const targetMember = reviewRequestTargetMember(
                              entry.comment,
                            )}
                            <div
                              class="community-projects__review-timeline-summary"
                            >
                              <span
                                class="community-projects__review-timeline-sentence"
                              >
                                {#if actorMember}
                                  {@render memberHoverMention(
                                    actorMember,
                                    reviewTimelineActor(entry.event),
                                  )}
                                {:else}
                                  <strong
                                    >{reviewTimelineActor(entry.event)}</strong
                                  >
                                {/if}
                                <span>requested a review from</span>
                                {#if targetMember}
                                  {@render memberHoverMention(
                                    targetMember,
                                    reviewRequestTarget(entry.comment),
                                  )}
                                {:else}
                                  <strong
                                    >{reviewRequestTarget(
                                      entry.comment,
                                    )}</strong
                                  >
                                {/if}
                              </span>
                              <CommunityRelativeTime
                                timestamp={entry.event.created_at}
                              />
                            </div>
                          {:else if entry.kind === "lifecycle"}
                            {@const actorMember = reviewTimelineActorMember(
                              entry.event,
                            )}
                            <div
                              class="community-projects__review-timeline-summary"
                            >
                              <span
                                class="community-projects__review-timeline-sentence"
                              >
                                {#if actorMember}
                                  {@render memberHoverMention(
                                    actorMember,
                                    reviewTimelineActor(entry.event),
                                  )}
                                {:else}
                                  <strong
                                    >{reviewTimelineActor(entry.event)}</strong
                                  >
                                {/if}
                                <span>{reviewLifecycleAction(entry)}</span>
                              </span>
                              <CommunityRelativeTime
                                timestamp={entry.event.created_at}
                              />
                            </div>
                            {#if entry.mergeCommit}
                              <code
                                class="community-projects__review-timeline-commit"
                                >{entry.mergeCommit.slice(0, 8)}</code
                              >
                            {/if}
                          {:else}
                            {@const comment = entry.comment}
                            {@const timelineDecision =
                              reviewCommentDecision(comment)}
                            {@const commentReactionOptions =
                              pullRequestReactionOptions(comment)}
                            {#snippet reviewLabels()}
                              <div class="community-projects__message-labels">
                                {#if timelineDecision}<CommunityChip
                                    size="compact"
                                    tone={timelineDecision === "approved"
                                      ? "success"
                                      : "warning"}
                                    >{timelineDecision}</CommunityChip
                                  >{/if}
                                {#if comment.inlineStatus}<CommunityChip
                                    size="compact"
                                    >{comment.inlineStatus}</CommunityChip
                                  >{/if}
                              </div>
                            {/snippet}
                            <CommunityMessage
                              message={commentMessage(comment)}
                              author={memberForPubkey(comment.event.pubkey)}
                              {members}
                              {rooms}
                              {communityEmojis}
                              {...currentMemberId === undefined
                                ? {}
                                : { currentMemberId }}
                              supplement={reviewLabels}
                              density="compact"
                              {...canReactToPullRequestComment(comment)
                                ? {
                                    onAddReaction: (
                                      _messageId: string,
                                      emoji: string,
                                    ) =>
                                      onTogglePullRequestCommentReaction!(
                                        selectedPullRequest,
                                        comment,
                                        emoji,
                                      ),
                                    onToggleReaction: (
                                      _messageId: string,
                                      emoji: string,
                                    ) =>
                                      onTogglePullRequestCommentReaction!(
                                        selectedPullRequest,
                                        comment,
                                        emoji,
                                      ),
                                  }
                                : {}}
                              {...commentReactionOptions === undefined
                                ? {}
                                : { reactionOptions: commentReactionOptions }}
                            />
                          {/if}
                        </div>
                      </article>
                    {/each}
                  </div>
                  {#if selectedPullRequest.lifecycle !== "merged"}
                    <div class="community-projects__review-actions">
                      <Button
                        type="button"
                        size="sm"
                        disabled={!canCollaborate ||
                          busy ||
                          !canMergePullRequest(selectedPullRequest)}
                        title={canMergePullRequest(selectedPullRequest)
                          ? "Merge this pull request through the repository provider"
                          : "The repository does not advertise merge capability"}
                        onclick={() =>
                          void mergeSelectedPullRequest(selectedPullRequest)}
                      >
                        <GitMergeIcon
                          data-icon="inline-start"
                          aria-hidden="true"
                        />
                        {canMergePullRequest(selectedPullRequest)
                          ? "Merge pull request"
                          : "Merge unavailable"}
                      </Button>
                      <span class="community-projects__review-action-spacer"
                      ></span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!canCollaborate ||
                          busy ||
                          (!onSubmitPullRequestReview &&
                            !onAddPullRequestComment &&
                            !onApprovePullRequest &&
                            !onRequestChanges)}
                        onclick={openReviewSubmission}
                      >
                        <CheckIcon
                          data-icon="inline-start"
                          aria-hidden="true"
                        />
                        Submit review
                      </Button>
                      {#if onUpdatePullRequestLifecycle}
                        <Button
                          type="button"
                          variant={selectedPullRequest.lifecycle === "closed"
                            ? "outline"
                            : "destructive"}
                          size="sm"
                          disabled={!canCollaborate || busy}
                          onclick={updateSelectedPullRequestLifecycle}
                          >{selectedPullRequest.lifecycle === "closed"
                            ? "Reopen"
                            : "Close"}</Button
                        >
                      {/if}
                    </div>
                    {#if pullRequestMergeError}
                      <p
                        class="community-projects__review-merge-error"
                        role="alert"
                      >
                        {pullRequestMergeError}
                      </p>
                    {:else if pullRequestMergeStatus}
                      <p
                        class="community-projects__review-merge-status"
                        role="status"
                      >
                        {pullRequestMergeStatus}
                      </p>
                    {/if}
                    {#if onAddPullRequestComment}
                      <CommunityChatComposer
                        class="community-projects__conversation-composer"
                        bind:value={pullRequestComment}
                        placeholder="Add to the review conversation"
                        ariaLabel="Pull request comment"
                        submitLabel="Comment"
                        {members}
                        {rooms}
                        {communityEmojis}
                        {...currentMemberId === undefined
                          ? {}
                          : { currentMemberId }}
                        {busy}
                        disabled={!canCollaborate}
                        disabledReason="Sign in to comment on this review"
                        onSubmit={(submission) =>
                          submitPullRequestComment(submission.content)}
                      />
                    {/if}
                  {/if}
                </section>
              </Collapsible.Content>
            </Collapsible.Root>
          </article>
        {:else}
          {@render surfaceHeader(
            "Reviews",
            "Buzz-compatible NIP-34 pull requests and trusted review decisions.",
          )}
          {#if pullRequests.length === 0}
            <Empty.Root
              class="community-projects__empty community-projects__review-empty"
            >
              <Empty.Header>
                <Empty.Media variant="icon"
                  ><CircleDashedIcon aria-hidden="true" /></Empty.Media
                >
                <Empty.Title>No reviews yet</Empty.Title>
              </Empty.Header>
            </Empty.Root>
          {:else}
            <div
              class="community-projects__review-groups"
              data-layout={listLayout}
            >
              {#each reviewGroups as group (group.lifecycle)}
                {@const groupedReviews = pullRequests.filter(
                  (pullRequest) =>
                    pullRequest.lifecycle === group.lifecycle &&
                    (!selectedProject ||
                      projectPullRequestsFor(selectedProject).some(
                        (candidate) =>
                          candidate.root.id === pullRequest.root.id,
                      )),
                )}
                {#if groupedReviews.length > 0}
                  <Collapsible.Root
                    open={reviewGroupOpen[group.lifecycle] ?? false}
                    onOpenChange={(open) =>
                      (reviewGroupOpen[group.lifecycle] = open)}
                  >
                    <Collapsible.Trigger
                      class="community-projects__review-group-heading"
                    >
                      {@render reviewStatusIcon(group.lifecycle)}
                      <span>{group.label}</span>
                      {#if !reviewGroupOpen[group.lifecycle]}
                        <span>{groupedReviews.length}</span>
                      {/if}
                    </Collapsible.Trigger>
                    <Collapsible.Content
                      class="community-projects__review-group-list"
                    >
                      {#each groupedReviews as pullRequest (pullRequest.root.id)}
                        {@const author = memberForPubkey(
                          pullRequest.root.pubkey,
                        )}
                        <article class="community-projects__review-row">
                          {@render reviewStatusIcon(pullRequest.lifecycle)}
                          <button
                            type="button"
                            class="community-projects__review-row-title"
                            onclick={() => onSelectPullRequest?.(pullRequest)}
                            >{pullRequest.title}</button
                          >
                          <button
                            type="button"
                            class="community-projects__review-row-id"
                            title="View review"
                            onclick={() => onSelectPullRequest?.(pullRequest)}
                            >#{pullRequest.root.id.slice(0, 8)}</button
                          >
                          <span class="community-projects__review-row-branch">
                            <span aria-hidden="true">›</span>
                            <GitBranchIcon aria-hidden="true" />
                            <span
                              >{pullRequest.branchName ||
                                pullRequest.currentCommit.slice(0, 7)}</span
                            >
                          </span>
                          <span
                            class="community-projects__review-row-comments"
                            title={`${pullRequest.comments.length} comments`}
                          >
                            <MessageSquareIcon aria-hidden="true" />
                            {pullRequest.comments.length}
                          </span>
                          {@render memberHoverAvatar(author)}
                          <CommunityRelativeTime
                            timestamp={pullRequest.updatedAt}
                          />
                        </article>
                      {/each}
                    </Collapsible.Content>
                  </Collapsible.Root>
                {/if}
              {/each}
            </div>
          {/if}
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
                <p>Committed {commitDate(selectedCommitValue.author_date)}</p>
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
                <dd>{commitDate(selectedCommitValue.author_date)}</dd>
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
                  <p class="community-projects__status" role="status">
                    Loading commit diff…
                  </p>
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
                        <Input
                          type="search"
                          bind:value={commitFileFilter}
                          class="community-projects__changed-files-filter"
                          aria-label="Filter changed files"
                          placeholder="Filter changed files"
                        />
                        <div class="community-projects__changed-files-toolbar">
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
                  <p class="community-projects__status" role="status">
                    Loading commit diff…
                  </p>
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
            <div class="community-projects__commit-list">
              {#if effectiveSourceError}
                {@render projectSourceError(effectiveSourceError)}
              {:else}
                {#each commits as commit (commit.sha)}
                  {@const author = commitAuthorMember(commit)}
                  <article class="community-projects__commit-row">
                    <GitCommitHorizontalIcon
                      class="community-projects__commit-row-icon"
                      aria-hidden="true"
                    />
                    <button
                      type="button"
                      class="community-projects__commit-row-title"
                      onclick={() => onSelectCommit?.(commit)}
                      >{commit.subject}</button
                    >
                    <button
                      type="button"
                      class="community-projects__commit-row-hash"
                      title={`View commit ${commit.sha.slice(0, 7)}`}
                      onclick={() => onSelectCommit?.(commit)}
                      >{commit.sha.slice(0, 7)}</button
                    >
                    {#if commitBranch}
                      <span class="community-projects__commit-row-branch">
                        <span aria-hidden="true">›</span>
                        <GitBranchIcon aria-hidden="true" />
                        <span>{commitBranch}</span>
                      </span>
                    {/if}
                    <span
                      class="community-projects__commit-row-author"
                      title={`Committed by ${author.name}`}
                    >
                      {@render memberHoverAvatar(author)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      class="community-projects__copy-control"
                      aria-label={`Copy commit ${commit.sha.slice(0, 7)}`}
                      title="Copy commit hash"
                      onclick={() => void copyCommitHash(commit.sha)}
                      ><CopyIcon aria-hidden="true" /></Button
                    >
                    {#if commit.author_date}<CommunityRelativeTime
                        timestamp={Math.floor(
                          new Date(commit.author_date).getTime() / 1_000,
                        )}
                      />{/if}
                  </article>
                {:else}<p class="community-projects__status">
                    No repository commit history is available.
                  </p>{/each}
              {/if}
            </div>
          </div>
        {/if}
      {:else if view === "files"}
        {@render surfaceHeader(
          "Files",
          "Repository files loaded through the relay gateway.",
        )}
        <div class="community-projects__files-surface">
          {#if loading && !tree}
            <div
              class="community-projects__files-loading"
              role="status"
              aria-label="Loading repository files"
            >
              <div
                class="community-projects__files-loading-breadcrumb"
                aria-hidden="true"
              >
                <Skeleton />
                <Skeleton />
                <Skeleton />
              </div>
              <div
                class="community-projects__files-loading-commit"
                aria-hidden="true"
              >
                <Skeleton />
                <Skeleton />
                <Skeleton />
              </div>
              <div
                class="community-projects__files-loading-list"
                aria-hidden="true"
              >
                {#each [0, 1, 2, 3, 4] as row (row)}
                  <div>
                    <Skeleton />
                    <Skeleton />
                    <Skeleton />
                  </div>
                {/each}
              </div>
            </div>
          {:else if !canCollaborate && repositorySources.length > 0}
            <Empty.Root class="community-projects__empty">
              <Empty.Header>
                <Empty.Media variant="icon"
                  ><FileIcon aria-hidden="true" /></Empty.Media
                >
                <Empty.Title>Sign in to view repository files</Empty.Title>
                <Empty.Description>
                  Repository source reads use your Nostr identity to enforce the
                  project's channel access at the relay gateway.
                </Empty.Description>
              </Empty.Header>
            </Empty.Root>
          {:else if effectiveSourceError}
            {@render projectSourceError(effectiveSourceError)}
          {:else if tree && selectedPath}
            <section class="community-projects__file-panel">
              <header class="community-projects__file-header">
                <Breadcrumb.Root aria-label="Repository file path">
                  <Breadcrumb.List>
                    <Breadcrumb.Item>
                      <Breadcrumb.Link
                        href="#"
                        onclick={(event) => {
                          event.preventDefault();
                          openRepositoryDirectory("");
                        }}>Files</Breadcrumb.Link
                      >
                    </Breadcrumb.Item>
                    {#each repositorySelectedBreadcrumbs as segment (segment.path)}
                      <Breadcrumb.Separator />
                      <Breadcrumb.Item>
                        <Breadcrumb.Link
                          href="#"
                          onclick={(event) => {
                            event.preventDefault();
                            openRepositoryDirectory(segment.path);
                          }}>{segment.name}</Breadcrumb.Link
                        >
                      </Breadcrumb.Item>
                    {/each}
                    <Breadcrumb.Separator />
                    <Breadcrumb.Item>
                      <Breadcrumb.Page
                        >{repositorySelectedPath.split("/").at(-1) ??
                          repositorySelectedPath}</Breadcrumb.Page
                      >
                    </Breadcrumb.Item>
                  </Breadcrumb.List>
                </Breadcrumb.Root>
                {#if repositorySelectedIsMarkdown}
                  <ButtonGroup.Root
                    class="community-projects__file-view-toggle"
                    aria-label="Markdown display"
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-selected={repositoryMarkdownView === "preview"}
                      aria-pressed={repositoryMarkdownView === "preview"}
                      onclick={() => (repositoryMarkdownView = "preview")}
                    >
                      <EyeIcon data-icon="inline-start" aria-hidden="true" />
                      Preview
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-selected={repositoryMarkdownView === "source"}
                      aria-pressed={repositoryMarkdownView === "source"}
                      onclick={() => (repositoryMarkdownView = "source")}
                    >
                      <CodeXmlIcon
                        data-icon="inline-start"
                        aria-hidden="true"
                      />
                      Source
                    </Button>
                  </ButtonGroup.Root>
                {/if}
              </header>
              <div class="community-projects__file-body">
                {#if loading && !repositorySelectedBlob}
                  <div
                    class="community-projects__blob-skeleton"
                    role="status"
                    aria-label={`Loading ${selectedPath}`}
                  >
                    {#if repositorySelectedIsMarkdown}
                      <Skeleton
                        class="community-projects__markdown-skeleton-title"
                      />
                      <Skeleton
                        class="community-projects__markdown-skeleton-copy"
                      />
                      <Skeleton
                        class="community-projects__markdown-skeleton-copy"
                      />
                      <Skeleton
                        class="community-projects__markdown-skeleton-heading"
                      />
                      <Skeleton
                        class="community-projects__markdown-skeleton-copy"
                      />
                      <Skeleton
                        class="community-projects__markdown-skeleton-code"
                      />
                    {:else}
                      <div class="community-projects__files-loading-code">
                        {#each [0, 1, 2, 3, 4, 5, 6] as row (row)}
                          <div>
                            <Skeleton />
                            <Skeleton />
                          </div>
                        {/each}
                      </div>
                    {/if}
                  </div>
                {:else if repositorySelectedBlob?.binary}
                  <Empty.Root>
                    <Empty.Header>
                      <Empty.Media variant="icon"
                        ><FileIcon aria-hidden="true" /></Empty.Media
                      >
                      <Empty.Title>Binary file</Empty.Title>
                      <Empty.Description
                        >{repositorySelectedBlob.path} cannot be previewed as text.</Empty.Description
                      >
                    </Empty.Header>
                  </Empty.Root>
                {:else if repositorySelectedBlob?.too_large}
                  <p class="community-projects__status">
                    {repositorySelectedBlob.path} is too large to preview.
                  </p>
                {:else if repositorySelectedBlob && repositorySelectedIsMarkdown && repositoryMarkdownView === "preview"}
                  <CommunityMarkdownContent
                    class="community-projects__markdown-file"
                    content={repositorySelectedBlob.contents ?? ""}
                    {members}
                    {rooms}
                    {communityEmojis}
                  />
                {:else if repositorySelectedBlob}
                  <CodeBlock
                    code={repositorySelectedBlob.contents ?? ""}
                    language={resolveDiffLanguage(
                      repositorySelectedBlob.path,
                    ) ?? "plaintext"}
                    hasLanguageLabel={false}
                    hasCopyButton={false}
                    hasLineNumbers
                    width="100%"
                    container="section"
                  />
                {:else}
                  <p class="community-projects__status">
                    Select a file to preview it.
                  </p>
                {/if}
              </div>
            </section>
          {:else if tree}
            <section class="community-projects__file-browser">
              <header class="community-projects__file-browser-breadcrumb">
                <Breadcrumb.Root aria-label="Repository directory path">
                  <Breadcrumb.List>
                    <Breadcrumb.Item>
                      {#if repositoryDirectoryBreadcrumbs.length === 0}
                        <Breadcrumb.Page>Files</Breadcrumb.Page>
                      {:else}
                        <Breadcrumb.Link
                          href="#"
                          onclick={(event) => {
                            event.preventDefault();
                            openRepositoryDirectory("");
                          }}>Files</Breadcrumb.Link
                        >
                      {/if}
                    </Breadcrumb.Item>
                    {#each repositoryDirectoryBreadcrumbs as segment, index (segment.path)}
                      <Breadcrumb.Separator />
                      <Breadcrumb.Item>
                        {#if index === repositoryDirectoryBreadcrumbs.length - 1}
                          <Breadcrumb.Page>{segment.name}</Breadcrumb.Page>
                        {:else}
                          <Breadcrumb.Link
                            href="#"
                            onclick={(event) => {
                              event.preventDefault();
                              openRepositoryDirectory(segment.path);
                            }}>{segment.name}</Breadcrumb.Link
                          >
                        {/if}
                      </Breadcrumb.Item>
                    {/each}
                  </Breadcrumb.List>
                </Breadcrumb.Root>
              </header>
              {#if tree.commit}
                <div class="community-projects__file-browser-commit">
                  <GitCommitHorizontalIcon aria-hidden="true" />
                  <span>
                    {#if tree.commit.author_name}<strong
                        >{tree.commit.author_name}</strong
                      >{" committed "}
                    {/if}<span>{tree.commit.subject}</span>
                  </span>
                  <code>{tree.commit.sha.slice(0, 7)}</code>
                  {#if tree.commit.author_date}
                    <CommunityRelativeTime
                      timestamp={Math.floor(
                        new Date(tree.commit.author_date).getTime() / 1_000,
                      )}
                    />
                  {/if}
                </div>
              {/if}
              <div
                class="community-projects__file-browser-list"
                aria-label={repositoryCurrentPath
                  ? `Files in ${repositoryCurrentPath}`
                  : "Repository files"}
              >
                {#each repositoryEntries as entry (entry.path)}
                  <button
                    type="button"
                    class="community-projects__file-browser-row"
                    aria-label={`${entry.type === "tree" ? "Open directory" : "Open file"} ${entry.name}`}
                    onclick={() =>
                      entry.type === "tree"
                        ? openRepositoryDirectory(entry.path)
                        : openRepositoryFile(entry.path)}
                  >
                    {#if entry.type === "tree"}
                      <FolderIcon aria-hidden="true" />
                    {:else}
                      <FileIcon aria-hidden="true" />
                    {/if}
                    <strong>{entry.name}</strong>
                    {#if entry.type === "blob" && entry.size !== undefined}
                      <span>{formatRepositoryFileSize(entry.size)}</span>
                    {/if}
                    <ChevronRightIcon aria-hidden="true" />
                  </button>
                {:else}
                  <p class="community-projects__status">
                    This directory does not contain any files.
                  </p>
                {/each}
              </div>
            </section>
          {:else}
            <Empty.Root class="community-projects__empty">
              <Empty.Header>
                <Empty.Media variant="icon"
                  ><FileIcon aria-hidden="true" /></Empty.Media
                >
                <Empty.Title
                  >{browsableRepositories.length === 0
                    ? "No browsable repository files"
                    : "No repository files"}</Empty.Title
                >
                <Empty.Description>
                  {browsableRepositories.length === 0
                    ? "Attach a repository whose relay capabilities include browsing."
                    : "The repository does not contain any files yet."}
                </Empty.Description>
              </Empty.Header>
            </Empty.Root>
          {/if}
        </div>
      {:else if view === "people" || view === "contributors"}
        {@render surfaceHeader(
          "Contributors",
          "Project collaborators are inherited from the project's NIP-29 channel.",
        )}
        <div class="community-projects__people" data-layout={listLayout}>
          {#each members as member (member.id)}
            <article
              data-interactive={onOpenProfile === undefined
                ? undefined
                : "true"}
            >
              {#if onOpenProfile}
                <button
                  type="button"
                  class="community-projects__person-target"
                  aria-label={`Open ${member.name}'s profile`}
                  onclick={() => onOpenProfile?.(member)}
                ></button>
              {/if}
              <span class="community-projects__person-avatar">
                {@render memberHoverAvatar(member, "medium")}
              </span>
              <div class="community-projects__person-copy">
                <strong>{member.name}</strong><span>{member.handle}</span>
              </div>
              {#if member.role}
                <CommunityChip
                  class="community-projects__person-role"
                  size="compact"
                  tone="accent">{member.role}</CommunityChip
                >
              {/if}
            </article>
          {:else}<p class="community-projects__status">
              The project channel roster is unavailable.
            </p>{/each}
        </div>
      {/if}
    </section>
  </AppShell.Body>
{/if}

<Dialog.Root bind:open={reviewSubmissionOpen}>
  <Dialog.Content class="community-projects__review-submission-dialog">
    <div class="community-projects__review-submission-form">
      <Dialog.Header>
        <Dialog.Title>Submit review</Dialog.Title>
        <Dialog.Description>
          Publish one signed review decision to the relay. Connected providers
          can mirror it as a native review.
        </Dialog.Description>
      </Dialog.Header>
      <Field.Group class="community-projects__review-submission-fields">
        <Field.Field data-invalid={reviewSubmissionError ? "" : undefined}>
          <Field.Label>
            Review
            {#if reviewSubmissionDecision === "approved"}
              <span>Optional</span>
            {/if}
          </Field.Label>
          <CommunityChatComposer
            class="community-projects__review-submission-composer"
            bind:value={reviewSubmissionBody}
            ariaLabel="Review"
            placeholder={reviewSubmissionDecision === "approved"
              ? "Leave an optional approval note…"
              : reviewSubmissionDecision === "changes-requested"
                ? "Explain what needs to change…"
                : "Leave a review comment…"}
            {members}
            {rooms}
            {communityEmojis}
            {...currentMemberId === undefined ? {} : { currentMemberId }}
            {busy}
            disabled={!canCollaborate}
            disabledReason="Sign in to submit a review"
            showSubmitButton={false}
          />
          <Field.Description>
            {reviewSubmissionDecision === "approved"
              ? "An approval can be submitted without a message."
              : "A message is required for this review decision."}
          </Field.Description>
          {#if reviewSubmissionError}
            <Field.Error>{reviewSubmissionError}</Field.Error>
          {/if}
        </Field.Field>
        <fieldset class="community-projects__review-decision">
          <legend>Review decision</legend>
          <label class="community-projects__review-decision-option">
            <input
              type="radio"
              name="project-review-decision"
              value="comment"
              aria-label="Comment"
              bind:group={reviewSubmissionDecision}
              onchange={() => (reviewSubmissionError = "")}
            />
            <span>
              <strong>Comment</strong>
              <small>Submit general feedback without explicit approval.</small>
            </span>
          </label>
          <label class="community-projects__review-decision-option">
            <input
              type="radio"
              name="project-review-decision"
              value="approved"
              aria-label="Approve"
              bind:group={reviewSubmissionDecision}
              onchange={() => (reviewSubmissionError = "")}
            />
            <span>
              <strong>Approve</strong>
              <small>Submit feedback and approve these changes.</small>
            </span>
          </label>
          <label class="community-projects__review-decision-option">
            <input
              type="radio"
              name="project-review-decision"
              value="changes-requested"
              aria-label="Request changes"
              bind:group={reviewSubmissionDecision}
              onchange={() => (reviewSubmissionError = "")}
            />
            <span>
              <strong>Request changes</strong>
              <small>
                Submit feedback that must be addressed before merging.
              </small>
            </span>
          </label>
        </fieldset>
      </Field.Group>
      <Dialog.Footer>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onclick={() => (reviewSubmissionOpen = false)}>Cancel</Button
        >
        <Button
          type="button"
          disabled={busy ||
            (reviewSubmissionDecision !== "approved" &&
              reviewSubmissionBody.trim() === "")}
          onclick={submitPullRequestReview}
        >
          {busy
            ? operation
            : reviewSubmissionDecision === "approved"
              ? "Submit approval"
              : reviewSubmissionDecision === "changes-requested"
                ? "Request changes"
                : "Submit comment"}
        </Button>
      </Dialog.Footer>
    </div>
  </Dialog.Content>
</Dialog.Root>

<AlertDialog.Root bind:open={reviewCloseConfirmationOpen}>
  <AlertDialog.Content class="community-confirm-dialog">
    <AlertDialog.Header>
      <AlertDialog.Title>Close pull request?</AlertDialog.Title>
      <AlertDialog.Description>
        This closes {selectedPullRequest?.title ?? "the pull request"} without merging
        it. It can be reopened later.
      </AlertDialog.Description>
    </AlertDialog.Header>
    {#if reviewCloseError}
      <p class="community-projects__review-merge-error" role="alert">
        {reviewCloseError}
      </p>
    {/if}
    <AlertDialog.Footer>
      <AlertDialog.Cancel disabled={busy}>Cancel</AlertDialog.Cancel>
      <Button
        type="button"
        variant="destructive"
        disabled={busy}
        onclick={confirmClosePullRequest}
      >
        {busy ? "Closing…" : "Close pull request"}
      </Button>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

<Dialog.Root bind:open={projectDialogOpen} onOpenChange={resetError}>
  <Dialog.Content class="community-projects__project-dialog">
    <Dialog.Header class="community-projects__project-dialog-header">
      <Dialog.Title>
        {projectDialogMode === "edit"
          ? "Project settings"
          : "Create a new project"}
      </Dialog.Title>
      <Dialog.Description>
        {projectDialogMode === "edit"
          ? "Change the project details shared through its signed announcement."
          : "Bring an existing Community channel together with repositories, tasks, and reviews."}
      </Dialog.Description>
    </Dialog.Header>
    <form class="community-projects__project-form" onsubmit={submitProject}>
      <Field.Group class="community-projects__project-fields">
        <Field.Field>
          <Field.Label for="project-name">Name</Field.Label>
          <Input
            id="project-name"
            bind:value={projectDraft.name}
            placeholder="relay-forge-sandbox"
            required
          />
        </Field.Field>
        <Field.Field>
          <Field.Label for="project-description">
            Description <span>Optional</span>
          </Field.Label>
          <CommunityChatComposer
            class="community-projects__project-description"
            bind:value={projectDraft.description}
            placeholder="What this project should become"
            ariaLabel="Project description"
            {members}
            {rooms}
            {communityEmojis}
            {...currentMemberId === undefined ? {} : { currentMemberId }}
            showSubmitButton={false}
          />
        </Field.Field>

        <div class="community-projects__project-options">
          <div
            class="community-projects__project-option"
            aria-label="Project visibility"
          >
            <span>Visibility</span>
            <span class="community-projects__project-option-choice">
              {projectDraft.visibility === "private" ? "Private" : "Public"}
            </span>
          </div>

          <button
            type="button"
            class="community-projects__project-option community-projects__project-channel-trigger"
            aria-haspopup="dialog"
            aria-expanded={projectChannelCommandOpen}
            onclick={() => (projectChannelCommandOpen = true)}
          >
            <span>Project channel</span>
            <span class="community-projects__project-option-choice">
              {availableProjectChannels.find(
                (channel) =>
                  (channel.groupId ?? channel.id) === projectDraft.channelId,
              )?.name ?? "Choose channel"}
              <ChevronDownIcon aria-hidden="true" />
            </span>
          </button>

          <div class="community-projects__project-option">
            <span>Project list</span>
            <Select.Root
              type="single"
              value={projectDraft.listing}
              onValueChange={(value) => {
                if (value === "listed" || value === "unlisted")
                  projectDraft.listing = value;
              }}
            >
              <Select.Trigger aria-label="Project list">
                {projectDraft.listing === "unlisted" ? "Unlisted" : "Listed"}
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="listed" label="Listed">Listed</Select.Item>
                <Select.Item value="unlisted" label="Unlisted"
                  >Unlisted</Select.Item
                >
              </Select.Content>
            </Select.Root>
          </div>
        </div>

        {#if localError}<Field.Error>{localError}</Field.Error>{/if}
      </Field.Group>
      <Dialog.Footer class="community-projects__project-footer">
        <Button
          type="submit"
          disabled={busy ||
            !projectDraft.name.trim() ||
            !projectDraft.channelId}
        >
          {busy
            ? operation
            : projectDialogMode === "edit"
              ? "Save changes"
              : "Create project"}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<Command.Dialog
  bind:open={projectChannelCommandOpen}
  class="community-projects__channel-command"
  title="Choose a project channel"
  description="Search the Community channels available to this project."
>
  <Command.Input
    placeholder="Search channels"
    aria-label="Search channels"
    aria-controls="community-project-channel-command-list"
  />
  <Command.List id="community-project-channel-command-list">
    <Command.Empty>No channels found.</Command.Empty>
    <Command.Group heading="Channels">
      {#each availableProjectChannels as channel (channel.id)}
        <Command.Item
          value={`${channel.name} ${channel.groupId ?? channel.id}`}
          onSelect={() => selectProjectChannel(channel)}
        >
          <HashIcon aria-hidden="true" />
          <span class="community-projects__channel-command-copy">
            <strong>#{channel.name}</strong>
            <small>{channel.private ? "Private" : "Public"}</small>
          </span>
        </Command.Item>
      {/each}
    </Command.Group>
  </Command.List>
</Command.Dialog>

<Dialog.Root bind:open={repositoryDialogOpen} onOpenChange={resetError}>
  <Dialog.Content class="community-projects__project-dialog">
    <Dialog.Header class="community-projects__project-dialog-header">
      <Dialog.Title>Create a new repository</Dialog.Title>
      <Dialog.Description>
        Add a relay-hosted repository or connect an existing external Git
        repository. You can optionally add it to a project.
      </Dialog.Description>
    </Dialog.Header>
    <form class="community-projects__project-form" onsubmit={submitRepository}>
      <Field.Group class="community-projects__project-fields">
        <Field.Field>
          <Field.Label for="repository-name">Name</Field.Label>
          <Input
            id="repository-name"
            bind:value={repositoryDraft.name}
            placeholder="repository-name"
            required
          />
        </Field.Field>
        <Field.Field>
          <Field.Label for="repository-description">
            Description <span>Optional</span>
          </Field.Label>
          <CommunityChatComposer
            class="community-projects__project-description"
            bind:value={repositoryDraft.description}
            placeholder="What this repository is for"
            ariaLabel="Repository description"
            {members}
            {rooms}
            {communityEmojis}
            {...currentMemberId === undefined ? {} : { currentMemberId }}
            showSubmitButton={false}
          />
        </Field.Field>

        <div class="community-projects__project-options">
          <div class="community-projects__project-option">
            <span>Project <small>Optional</small></span>
            {#if selectedProject}
              <span class="community-projects__project-option-value">
                {selectedProject.name}
              </span>
            {:else}
              <Select.Root
                type="single"
                value={repositoryDraft.project || "none"}
                onValueChange={(value) => {
                  if (value) selectRepositoryProject(value);
                }}
              >
                <Select.Trigger aria-label="Repository project">
                  {projects.find(
                    (project) =>
                      project.address.coordinate === repositoryDraft.project,
                  )?.name ?? "No project"}
                </Select.Trigger>
                <Select.Content>
                  <Select.Group>
                    <Select.Item value="none" label="No project">
                      No project
                    </Select.Item>
                    {#each projects as project (project.address.coordinate)}
                      <Select.Item
                        value={project.address.coordinate}
                        label={project.name}>{project.name}</Select.Item
                      >
                    {/each}
                  </Select.Group>
                </Select.Content>
              </Select.Root>
            {/if}
          </div>

          {#if !repositoryDraft.project}
            <div class="community-projects__project-option">
              <span>Repository channel</span>
              <Select.Root
                type="single"
                value={repositoryDraft.channelId}
                onValueChange={(value) => {
                  if (value) repositoryDraft.channelId = value;
                }}
              >
                <Select.Trigger aria-label="Repository channel">
                  {availableProjectChannels.find(
                    (channel) =>
                      (channel.groupId ?? channel.id) ===
                      repositoryDraft.channelId,
                  )?.name ?? "Choose channel"}
                </Select.Trigger>
                <Select.Content>
                  <Select.Group>
                    {#each availableProjectChannels as channel (channel.id)}
                      <Select.Item
                        value={channel.groupId ?? channel.id}
                        label={`#${channel.name}`}>#{channel.name}</Select.Item
                      >
                    {/each}
                  </Select.Group>
                </Select.Content>
              </Select.Root>
            </div>
          {/if}

          <div class="community-projects__project-option">
            <span>Backing</span>
            <Select.Root
              type="single"
              value={repositoryDraft.mode}
              onValueChange={(value) => {
                if (value === "hosted" || value === "external")
                  repositoryDraft.mode = value;
              }}
            >
              <Select.Trigger aria-label="Repository backing">
                {repositoryDraft.mode === "hosted"
                  ? "Hosted by relay"
                  : "External Git"}
              </Select.Trigger>
              <Select.Content>
                <Select.Group>
                  <Select.Item value="hosted" label="Hosted by relay">
                    Hosted by relay
                  </Select.Item>
                  <Select.Item value="external" label="External Git">
                    External Git
                  </Select.Item>
                </Select.Group>
              </Select.Content>
            </Select.Root>
          </div>
        </div>

        {#if repositoryDraft.mode === "external"}
          <Field.Field>
            <Field.Label for="repository-clone">Clone URL</Field.Label>
            <Input
              id="repository-clone"
              type="url"
              bind:value={repositoryDraft.cloneUrl}
              placeholder="https://github.com/owner/repository.git"
              required
            />
          </Field.Field>
          <Field.Field>
            <Field.Label for="repository-web">
              Web URL <span>Optional</span>
            </Field.Label>
            <Input
              id="repository-web"
              type="url"
              bind:value={repositoryDraft.webUrl}
              placeholder="https://github.com/owner/repository"
            />
          </Field.Field>
        {/if}
        {#if localError}<Field.Error>{localError}</Field.Error>{/if}
      </Field.Group>
      <Dialog.Footer class="community-projects__project-footer">
        <Button
          type="submit"
          disabled={busy ||
            !repositoryDraft.channelId ||
            !repositoryDraft.name.trim()}
        >
          {busy ? operation : "Create repository"}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<Command.Dialog
  bind:open={repositoryCommandOpen}
  class="community-projects__repository-command"
  title={repositoryCommandStep === "repository"
    ? "Select an existing repository"
    : "Choose a project"}
  description={repositoryCommandStep === "repository"
    ? "Search repository announcements that can be attached to a project."
    : "Choose the project that should include this repository."}
>
  <Command.Input
    placeholder={repositoryCommandStep === "repository"
      ? "Search repositories"
      : "Search projects"}
    aria-label={repositoryCommandStep === "repository"
      ? "Search repositories"
      : "Search projects"}
    aria-controls="community-project-repository-command-list"
  />
  <Command.List id="community-project-repository-command-list">
    <Command.Empty>
      {repositoryCommandStep === "repository"
        ? "No repositories are available to attach."
        : "No projects are available for this repository."}
    </Command.Empty>
    {#if repositoryCommandStep === "repository"}
      <Command.Group heading="Repositories">
        {#each attachableRepositories as repository (repository.address.coordinate)}
          <Command.Item
            value={`${repository.name} ${repository.description} ${repository.address.identifier}`}
            onSelect={() => selectExistingRepository(repository)}
          >
            <GitBranchIcon aria-hidden="true" />
            <span class="community-projects__channel-command-copy">
              <strong>{repository.name}</strong>
              <small>
                {repository.description || repository.address.identifier}
              </small>
            </span>
          </Command.Item>
        {/each}
      </Command.Group>
    {:else}
      <Command.Group heading="Navigation">
        <Command.Item
          value="Back to repositories"
          onSelect={() => {
            repositoryCommandStep = "repository";
            repositoryCommandCoordinate = "";
          }}
        >
          <ArrowLeftIcon aria-hidden="true" />
          <span>Back to repositories</span>
        </Command.Item>
      </Command.Group>
      <Command.Group heading="Projects">
        {#each repositoryAttachmentProjects(repositoryCommandCoordinate) as project (project.address.coordinate)}
          <Command.Item
            value={`${project.name} ${project.description}`}
            onSelect={() =>
              void attachExistingRepository(
                project.address.coordinate,
                repositoryCommandCoordinate,
              )}
          >
            <FolderKanbanIcon aria-hidden="true" />
            <span class="community-projects__channel-command-copy">
              <strong>{project.name}</strong>
              <small>{project.description || project.address.identifier}</small>
            </span>
          </Command.Item>
        {/each}
      </Command.Group>
    {/if}
  </Command.List>
  {#if localError}
    <p class="community-projects__command-error" role="alert">{localError}</p>
  {/if}
</Command.Dialog>

<Command.Dialog
  bind:open={githubCommandOpen}
  class="community-projects__repository-command"
  title={githubCommandStep === "connection"
    ? "Connect to a GitHub App"
    : `Choose a repository from @${githubConnection?.account_login ?? "GitHub"}`}
  description={githubCommandStep === "connection"
    ? `Choose the GitHub App installation that should manage ${selectedRepository?.name ?? "this repository"}.`
    : "Only the GitHub repository matching this signed repository announcement can be connected."}
>
  <Command.Input
    placeholder={githubCommandStep === "connection"
      ? "Search GitHub App connections"
      : "Search GitHub repositories"}
    aria-label={githubCommandStep === "connection"
      ? "Search GitHub App connections"
      : "Search GitHub repositories"}
    aria-controls="community-project-github-command-list"
  />
  <Command.List id="community-project-github-command-list">
    {#if githubCommandLoading}
      <p class="community-projects__command-status" role="status">
        {githubCommandStep === "connection"
          ? "Loading GitHub App connections…"
          : "Loading GitHub repositories…"}
      </p>
    {:else if githubCommandStep === "connection"}
      <Command.Empty>No active GitHub App connections found.</Command.Empty>
      <Command.Group heading="GitHub App connections">
        {#each activeGitHubConnections as connection (connection.id)}
          <Command.Item
            value={`${connection.account_login} ${connection.host} ${connection.installation_id}`}
            onSelect={() => void selectGitHubConnection(connection)}
          >
            <GitForkIcon aria-hidden="true" />
            <span class="community-projects__channel-command-copy">
              <strong>@{connection.account_login}</strong>
              <small
                >{connection.host} · installation {connection.installation_id}</small
              >
            </span>
          </Command.Item>
        {/each}
      </Command.Group>
    {:else}
      <Command.Group heading="Navigation">
        <Command.Item
          value="Back to GitHub App connections"
          onSelect={() => {
            githubCommandStep = "connection";
            githubConnection = undefined;
            githubRepositories = [];
            githubCommandError = "";
          }}
        >
          <ArrowLeftIcon aria-hidden="true" />
          <span>Back to GitHub App connections</span>
        </Command.Item>
      </Command.Group>
      {#if matchingGitHubRepositories.length > 0}
        <Command.Group heading="Matching repository">
          {#each matchingGitHubRepositories as repository (repository.id)}
            <Command.Item
              value={`${repository.full_name} ${repository.default_branch}`}
              disabled={repository.archived || repository.disabled}
              onSelect={() => void attachGitHubRepository(repository)}
            >
              <GitForkIcon aria-hidden="true" />
              <span class="community-projects__channel-command-copy">
                <strong>{repository.full_name}</strong>
                <small
                  >{repository.private ? "Private" : "Public"} · {repository.default_branch}</small
                >
              </span>
            </Command.Item>
          {/each}
        </Command.Group>
      {:else if !githubCommandError}
        <p class="community-projects__command-status">
          No repository in this installation matches both the signed clone and
          web URLs.
        </p>
      {/if}
    {/if}
  </Command.List>
  {#if githubCommandError}
    <p class="community-projects__command-error" role="alert">
      {githubCommandError}
    </p>
  {/if}
  {#if githubCommandStep === "connection" && canManageForge}
    <div class="community-projects__github-command-footer">
      <Button type="button" variant="outline" onclick={openGitHubManager}>
        <GitForkIcon data-icon="inline-start" aria-hidden="true" />
        Manage GitHub App connections
      </Button>
    </div>
  {/if}
</Command.Dialog>

<Dialog.Root bind:open={githubManagerOpen}>
  <Dialog.Content
    class="community-projects__project-dialog community-projects__github-manager"
  >
    <Dialog.Header class="community-projects__project-dialog-header">
      <Dialog.Title>GitHub App connections</Dialog.Title>
      <Dialog.Description>
        Relay administrators can add installations, check their health, or
        replace the complete mounted-credential configuration.
      </Dialog.Description>
    </Dialog.Header>

    {#if githubManagerError}
      <Alert.Root variant="destructive" class="community-projects__alert">
        <Alert.Title>GitHub App action failed</Alert.Title>
        <Alert.Description>{githubManagerError}</Alert.Description>
      </Alert.Root>
    {/if}
    {#if githubManagerOperation}
      <p class="community-projects__github-manager-updated" role="status">
        {githubManagerOperation}
      </p>
    {/if}

    {#if githubManagerLoading}
      <div class="community-projects__github-manager-loading" role="status">
        <Skeleton />
        <Skeleton />
      </div>
    {:else if githubManagerFormOpen}
      <form
        class="community-projects__project-form"
        onsubmit={submitGitHubConnection}
      >
        <p class="community-projects__github-manager-note">
          {githubManagerConnection
            ? "For security, the relay never returns App IDs or credential references. Enter the complete replacement configuration."
            : "Enter references to credentials already mounted on the relay. Secret values never pass through this form."}
        </p>
        <Field.Group class="community-projects__project-fields">
          <div class="community-projects__github-manager-field-grid">
            <Field.Field>
              <Field.Label for="github-app-id">GitHub App ID</Field.Label>
              <Input
                id="github-app-id"
                bind:value={githubDraft.appId}
                autocomplete="off"
                placeholder="12345"
                required
              />
            </Field.Field>
            <Field.Field>
              <Field.Label for="github-installation-id"
                >Installation ID</Field.Label
              >
              <Input
                id="github-installation-id"
                type="number"
                min="1"
                step="1"
                bind:value={githubDraft.installationId}
                placeholder="67890"
                required
              />
            </Field.Field>
          </div>
          <Field.Field>
            <Field.Label for="github-app-credential"
              >App private-key reference</Field.Label
            >
            <Input
              id="github-app-credential"
              type="password"
              bind:value={githubDraft.credentialRef}
              autocomplete="new-password"
              placeholder="file:github-app.pem"
              required
            />
          </Field.Field>
          <Field.Field>
            <Field.Label for="github-webhook-credential"
              >Webhook-secret reference</Field.Label
            >
            <Input
              id="github-webhook-credential"
              type="password"
              bind:value={githubDraft.webhookSecretRef}
              autocomplete="new-password"
              placeholder="file:github-webhook"
              required
            />
          </Field.Field>
          <Field.Field>
            <Field.Label for="github-bridge-credential"
              >Bridge-key reference</Field.Label
            >
            <Input
              id="github-bridge-credential"
              type="password"
              bind:value={githubDraft.bridgeCredentialRef}
              autocomplete="new-password"
              placeholder="file:github-bridge-secret"
              required
            />
          </Field.Field>
          <Field.Field>
            <Field.Label for="github-bridge-pubkey"
              >Bridge public key</Field.Label
            >
            <Input
              id="github-bridge-pubkey"
              bind:value={githubDraft.bridgePubkey}
              autocomplete="off"
              minlength={64}
              maxlength={64}
              placeholder="64-character hexadecimal public key"
              required
            />
          </Field.Field>
        </Field.Group>
        <Dialog.Footer class="community-projects__project-footer">
          <Button
            type="button"
            variant="ghost"
            disabled={githubManagerOperation !== ""}
            onclick={() => {
              githubManagerFormOpen = false;
              githubManagerConnection = undefined;
              githubManagerError = "";
            }}
          >
            Back
          </Button>
          <Button type="submit" disabled={githubManagerOperation !== ""}>
            {githubManagerOperation ||
              (githubManagerConnection
                ? "Replace configuration"
                : "Add connection")}
          </Button>
        </Dialog.Footer>
      </form>
    {:else}
      <div class="community-projects__github-manager-list">
        {#each githubConnections as connection (connection.id)}
          <article class="community-projects__github-manager-row">
            <div class="community-projects__github-manager-copy">
              <GitForkIcon aria-hidden="true" />
              <div>
                <strong>
                  {connection.account_login
                    ? `@${connection.account_login}`
                    : `Installation ${connection.installation_id}`}
                </strong>
                <span>
                  {connection.host} · installation {connection.installation_id}
                </span>
              </div>
              <CommunityChip
                size="compact"
                tone={connection.status === "active" ? "success" : "danger"}
              >
                {connection.status}
              </CommunityChip>
            </div>
            {#if connection.detail}
              <p class="community-projects__github-manager-detail">
                {connection.detail}
              </p>
            {/if}
            {#if connection.updated_at}
              <p class="community-projects__github-manager-updated">
                Checked <CommunityRelativeTime
                  timestamp={Math.floor(
                    new Date(connection.updated_at).getTime() / 1_000,
                  )}
                />
              </p>
            {/if}
            <div class="community-projects__github-manager-actions">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={githubManagerOperation !== ""}
                onclick={() => void revalidateGitHubConnection(connection)}
              >
                <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
                Revalidate
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={githubManagerOperation !== ""}
                onclick={() => openGitHubConnectionForm(connection)}
              >
                Replace configuration
              </Button>
            </div>
          </article>
        {:else}
          <Empty.Root class="community-projects__empty">
            <Empty.Header>
              <Empty.Media variant="icon"
                ><GitForkIcon aria-hidden="true" /></Empty.Media
              >
              <Empty.Title>No GitHub App connections</Empty.Title>
              <Empty.Description>
                Add an installation after its credentials are mounted on the
                relay.
              </Empty.Description>
            </Empty.Header>
          </Empty.Root>
        {/each}
      </div>
      <Dialog.Footer class="community-projects__project-footer">
        <Button
          type="button"
          variant="outline"
          disabled={githubManagerOperation !== ""}
          onclick={() => void refreshGitHubConnections()}
        >
          <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
          Refresh
        </Button>
        <Button
          type="button"
          disabled={githubManagerOperation !== ""}
          onclick={() => openGitHubConnectionForm()}
        >
          <PlusIcon data-icon="inline-start" aria-hidden="true" />
          Add connection
        </Button>
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={taskDialogOpen} onOpenChange={resetError}>
  <Dialog.Content class="community-projects__project-dialog">
    <Dialog.Header class="community-projects__project-dialog-header">
      <Dialog.Title>Create a task</Dialog.Title>
      <Dialog.Description>
        {selectedRepository
          ? `Add this task to ${selectedRepository.name}.`
          : selectedProject
            ? `Add this task to ${selectedProject.name}.`
            : "Track work against a project or a repository."}
      </Dialog.Description>
    </Dialog.Header>
    <form class="community-projects__project-form" onsubmit={submitTask}>
      <Field.Group class="community-projects__project-fields">
        <div class="community-projects__project-options">
          <div class="community-projects__project-option">
            <span>Category</span>
            <Select.Root
              type="single"
              value={taskDraft.category}
              onValueChange={(value) => {
                if (
                  value === "issue" ||
                  value === "change-request" ||
                  value === "improvement"
                )
                  taskDraft.category = value;
              }}
            >
              <Select.Trigger aria-label="Task category">
                {taskDraft.category === "change-request"
                  ? "Change request"
                  : taskDraft.category === "improvement"
                    ? "Improvement"
                    : "Issue"}
              </Select.Trigger>
              <Select.Content>
                <Select.Group>
                  <Select.Item value="issue" label="Issue">Issue</Select.Item>
                  <Select.Item value="change-request" label="Change request">
                    Change request
                  </Select.Item>
                  <Select.Item value="improvement" label="Improvement">
                    Improvement
                  </Select.Item>
                </Select.Group>
              </Select.Content>
            </Select.Root>
          </div>

          {#if selectedRepository}
            <div class="community-projects__project-option">
              <span>Repository</span>
              <span class="community-projects__project-option-value">
                {selectedRepository.name}
              </span>
            </div>
          {:else if selectedProject}
            <div class="community-projects__project-option">
              <span>Project</span>
              <span class="community-projects__project-option-value">
                {selectedProject.name}
              </span>
            </div>
          {:else}
            <div class="community-projects__project-option">
              <span>Project <small>Optional</small></span>
              <Select.Root
                type="single"
                value={taskDraft.project || "none"}
                onValueChange={(value) => {
                  if (value) selectTaskProject(value);
                }}
              >
                <Select.Trigger aria-label="Task project">
                  {taskProject?.name ?? "No project"}
                </Select.Trigger>
                <Select.Content>
                  <Select.Group>
                    <Select.Item value="none" label="No project">
                      No project
                    </Select.Item>
                    {#each projects as project (project.address.coordinate)}
                      <Select.Item
                        value={project.address.coordinate}
                        label={project.name}>{project.name}</Select.Item
                      >
                    {/each}
                  </Select.Group>
                </Select.Content>
              </Select.Root>
            </div>

            <div class="community-projects__project-option">
              <span>Repository</span>
              <Select.Root
                type="single"
                value={taskDraft.repository}
                onValueChange={(value) => {
                  if (value) selectTaskRepository(value);
                }}
              >
                <Select.Trigger aria-label="Task repository scope">
                  {taskDraft.repository === "project"
                    ? "Project-wide"
                    : (taskRepositoryOptions.find(
                        (repository) =>
                          repository.address.coordinate ===
                          taskDraft.repository,
                      )?.name ?? "Choose repository")}
                </Select.Trigger>
                <Select.Content>
                  <Select.Group>
                    {#if taskDraft.project}
                      <Select.Item value="project" label="Project-wide">
                        Project-wide
                      </Select.Item>
                    {/if}
                    {#each taskRepositoryOptions as repository (repository.address.coordinate)}
                      <Select.Item
                        value={repository.address.coordinate}
                        label={repository.name}>{repository.name}</Select.Item
                      >
                    {/each}
                  </Select.Group>
                </Select.Content>
              </Select.Root>
            </div>
          {/if}
        </div>

        <Field.Field>
          <Field.Label for="task-title">Title</Field.Label>
          <Input
            id="task-title"
            bind:value={taskDraft.title}
            placeholder="Describe the task"
            required
          />
        </Field.Field>
        <Field.Field>
          <Field.Label for="task-description">
            Description <span>Optional</span>
          </Field.Label>
          <CommunityChatComposer
            class="community-projects__project-description"
            bind:value={taskDraft.content}
            placeholder="Add context, expected behaviour, or reproduction steps"
            ariaLabel="Task description"
            {members}
            {rooms}
            {communityEmojis}
            {...currentMemberId === undefined ? {} : { currentMemberId }}
            showSubmitButton={false}
          />
        </Field.Field>
        {#if localError}<Field.Error>{localError}</Field.Error>{/if}
      </Field.Group>
      <Dialog.Footer class="community-projects__project-footer">
        <Button
          type="submit"
          disabled={busy || !taskHasScope || !taskDraft.title.trim()}
        >
          {busy ? operation : "Create task"}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={pullRequestDialogOpen} onOpenChange={resetError}>
  <Dialog.Content
    class="community-projects__project-dialog community-projects__review-dialog"
  >
    <Dialog.Header class="community-projects__project-dialog-header">
      <Dialog.Title>Open a review</Dialog.Title>
      <Dialog.Description>
        Compare an existing branch and publish a NIP-34 pull request.
      </Dialog.Description>
    </Dialog.Header>
    <form class="community-projects__project-form" onsubmit={submitPullRequest}>
      <Field.Group class="community-projects__project-fields">
        <div class="community-projects__review-source-options">
          <Field.Field>
            <Field.Label for="pr-repository">Repository</Field.Label>
            <Select.Root
              type="single"
              value={pullRequestDraft.repository}
              onValueChange={(value) => {
                if (value) void selectPullRequestRepository(value);
              }}
            >
              <Select.Trigger id="pr-repository" role="combobox">
                {reviewableRepositories.find(
                  (repository) =>
                    repository.address.coordinate ===
                    pullRequestDraft.repository,
                )?.name ?? "Select repository"}
              </Select.Trigger>
              <Select.Content>
                <Select.Group>
                  {#each reviewableRepositories as repository (repository.address.coordinate)}
                    <Select.Item
                      value={repository.address.coordinate}
                      label={repository.name}>{repository.name}</Select.Item
                    >
                  {/each}
                </Select.Group>
              </Select.Content>
            </Select.Root>
          </Field.Field>

          <div class="community-projects__form-columns">
            <Field.Field>
              <Field.Label for="pr-target">Base</Field.Label>
              <Select.Root
                type="single"
                value={pullRequestDraft.targetBranch}
                onValueChange={(value) => {
                  if (!value) return;
                  pullRequestDraft.targetBranch = value;
                  if (pullRequestDraft.branchName === value)
                    pullRequestDraft.branchName = "";
                }}
              >
                <Select.Trigger
                  id="pr-target"
                  aria-label="Base branch"
                  disabled={pullRequestRefsLoading ||
                    pullRequestBranches.length === 0}
                >
                  {pullRequestRefsLoading
                    ? "Loading branches…"
                    : pullRequestDraft.targetBranch || "Select base branch"}
                </Select.Trigger>
                <Select.Content>
                  <Select.Group>
                    {#each pullRequestBranches as branch (branch.name)}
                      <Select.Item value={branch.name} label={branch.name}
                        >{branch.name}</Select.Item
                      >
                    {/each}
                  </Select.Group>
                </Select.Content>
              </Select.Root>
            </Field.Field>
            <Field.Field>
              <Field.Label for="pr-branch">Compare</Field.Label>
              <Select.Root
                type="single"
                value={pullRequestDraft.branchName}
                onValueChange={(value) => {
                  if (value) pullRequestDraft.branchName = value;
                }}
              >
                <Select.Trigger
                  id="pr-branch"
                  aria-label="Compare branch"
                  disabled={pullRequestRefsLoading ||
                    pullRequestCompareBranches.length === 0}
                >
                  {pullRequestRefsLoading
                    ? "Loading branches…"
                    : pullRequestDraft.branchName || "Select compare branch"}
                </Select.Trigger>
                <Select.Content>
                  <Select.Group>
                    {#each pullRequestCompareBranches as branch (branch.name)}
                      <Select.Item value={branch.name} label={branch.name}
                        >{branch.name}</Select.Item
                      >
                    {/each}
                  </Select.Group>
                </Select.Content>
              </Select.Root>
            </Field.Field>
          </div>
          {#if pullRequestRefsError}
            <Field.Error>{pullRequestRefsError}</Field.Error>
          {/if}
        </div>

        <Field.Field>
          <Field.Label for="pr-title">Title</Field.Label>
          <Input
            id="pr-title"
            bind:value={pullRequestDraft.title}
            placeholder="Describe the change"
            required
          />
        </Field.Field>
        <Field.Field>
          <Field.Label for="pr-description">
            Description <span>Optional</span>
          </Field.Label>
          <CommunityChatComposer
            class="community-projects__project-description"
            bind:value={pullRequestDraft.content}
            placeholder="Add context for reviewers"
            ariaLabel="Review description"
            {members}
            {rooms}
            {communityEmojis}
            {...currentMemberId === undefined ? {} : { currentMemberId }}
            showSubmitButton={false}
          />
        </Field.Field>
        {#if localError}<Field.Error>{localError}</Field.Error>{/if}
      </Field.Group>
      <Dialog.Footer class="community-projects__project-footer">
        <Button
          type="submit"
          disabled={busy ||
            !pullRequestDraft.repository ||
            !pullRequestDraft.title.trim() ||
            !pullRequestDraft.targetBranch ||
            !pullRequestDraft.branchName ||
            pullRequestDraft.targetBranch === pullRequestDraft.branchName ||
            pullRequestRefsLoading ||
            !!pullRequestRefsError}
        >
          {busy ? operation : "Create review"}
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
