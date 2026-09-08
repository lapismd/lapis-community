<script lang="ts">
  import {
    FileChangeStats,
    FileDiffComposer,
    FileListing,
    FileListingViewModeToggle,
    resolveDiffLanguage,
    type FileDiffLineContext,
    type FileListingViewMode,
  } from "@lapismd/design-core/diff";
  import { AppShell } from "@lapismd/design-core/shell";
  import * as Alert from "@lapismd/design-core/shadcn/alert";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { CodeBlock } from "@lapismd/design-core/shadcn/code-block";
  import * as Collapsible from "@lapismd/design-core/shadcn/collapsible";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as Empty from "@lapismd/design-core/shadcn/empty";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import * as Select from "@lapismd/design-core/shadcn/select";
  import * as Tabs from "@lapismd/design-core/shadcn/tabs";
  import { Textarea } from "@lapismd/design-core/shadcn/textarea";
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
  import FileIcon from "@lucide/svelte/icons/file";
  import FolderKanbanIcon from "@lucide/svelte/icons/folder-kanban";
  import GitBranchIcon from "@lucide/svelte/icons/git-branch";
  import GitCommitHorizontalIcon from "@lucide/svelte/icons/git-commit-horizontal";
  import GitMergeIcon from "@lucide/svelte/icons/git-merge";
  import GitPullRequestIcon from "@lucide/svelte/icons/git-pull-request";
  import HistoryIcon from "@lucide/svelte/icons/history";
  import HashIcon from "@lucide/svelte/icons/hash";
  import LayoutGridIcon from "@lucide/svelte/icons/layout-grid";
  import ListIcon from "@lucide/svelte/icons/list";
  import ListTodoIcon from "@lucide/svelte/icons/list-todo";
  import MessageSquareIcon from "@lucide/svelte/icons/message-square";
  import MessageSquarePlusIcon from "@lucide/svelte/icons/message-square-plus";
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import UserIcon from "@lucide/svelte/icons/user";
  import UserRoundPlusIcon from "@lucide/svelte/icons/user-round-plus";

  import {
    splitProjectForgePatch,
    projectForgeBoundChannels,
    type PullRequestComment,
  } from "../../projects/index.js";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import CommunityMemberHoverCard from "../community-member-hover-card/CommunityMemberHoverCard.svelte";
  import CommunityMarkdownContent from "../community-markdown-content/CommunityMarkdownContent.svelte";
  import CommunityMessage from "../community-message/CommunityMessage.svelte";
  import CommunityRelativeTime from "../community-relative-time/CommunityRelativeTime.svelte";
  import type {
    CommunityMemberModel,
    CommunityMessageModel,
  } from "../community-workspace/model.js";
  import type {
    CommunityProjectsCreateProject,
    CommunityProjectsCreatePullRequest,
    CommunityProjectsCreateRepository,
    CommunityProjectsCreateTask,
    CommunityProjectsProps,
  } from "./model.js";
  import "./CommunityProjects.css";

  let {
    view,
    projects,
    selectedProject,
    repositories = [],
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
    members = [],
    rooms = [],
    communityEmojis = [],
    currentMemberId,
    loading = false,
    error = "",
    operation = "",
    canCollaborate = false,
    dialogRequest,
    showNavigation = true,
    showReviewHeader = true,
    onSelectView,
    onBack,
    onSelectProject,
    onSelectChannel,
    onOpenProfile,
    onMessageMember,
    onWaveMember,
    onCreateProject,
    onCreateRepository,
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
    onUpdatePullRequestLifecycle,
    onAddPullRequestComment,
    onAddInlineComment,
    onSelectCommit,
    onCloseCommit,
    onSelectPath,
    onRetry,
  }: CommunityProjectsProps = $props();

  let projectDialogOpen = $state(false);
  let repositoryDialogOpen = $state(false);
  let taskDialogOpen = $state(false);
  let pullRequestDialogOpen = $state(false);
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
  let commitFilesOpen = $state(true);
  let commitFileFilter = $state("");
  let selectedCommitFilePath = $state("");
  let diffFileListMode = $state<FileListingViewMode>("tree");
  let repositoryFileListMode = $state<FileListingViewMode>("tree");
  let filesBodyElement = $state<HTMLElement | null>(null);
  let filesSidebarElement = $state<HTMLElement | null>(null);
  let filesSidebarWidth = $state<number>();
  let filesResizePointerId = $state<number | null>(null);
  let filesResizeStartX = 0;
  let filesResizeStartWidth = 0;
  let reviewGroupOpen = $state<Record<string, boolean>>({
    open: true,
    draft: true,
    merged: true,
    closed: true,
  });
  let selectedReviewStateId = $state("");
  let localError = $state("");
  let listLayout = $state<"grid" | "list">("list");
  const effectiveSourceError = $derived(sourceError || selectedCommitError);

  function setListLayout(next: string | undefined): void {
    if (next === "grid" || next === "list") listLayout = next;
  }

  function filesResizeBounds(): { min: number; max: number } {
    const min = 224;
    const available = (filesBodyElement?.clientWidth ?? 880) - 400;
    return { min, max: Math.max(min, Math.min(480, available)) };
  }

  function clampFilesSidebarWidth(width: number): number {
    const { min, max } = filesResizeBounds();
    return Math.min(max, Math.max(min, width));
  }

  function currentFilesSidebarWidth(): number {
    return (
      filesSidebarWidth ??
      filesSidebarElement?.getBoundingClientRect().width ??
      272
    );
  }

  function beginFilesResize(event: PointerEvent): void {
    if (event.button !== 0) return;
    filesResizePointerId = event.pointerId;
    filesResizeStartX = event.clientX;
    filesResizeStartWidth = currentFilesSidebarWidth();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function moveFilesResize(event: PointerEvent): void {
    if (event.pointerId !== filesResizePointerId) return;
    filesSidebarWidth = clampFilesSidebarWidth(
      filesResizeStartWidth + event.clientX - filesResizeStartX,
    );
  }

  function finishFilesResize(event: PointerEvent): void {
    if (event.pointerId !== filesResizePointerId) return;
    filesResizePointerId = null;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
  }

  function resizeFilesWithKeyboard(event: KeyboardEvent): void {
    const { min, max } = filesResizeBounds();
    let nextWidth = currentFilesSidebarWidth();
    if (event.key === "ArrowLeft") nextWidth -= 16;
    else if (event.key === "ArrowRight") nextWidth += 16;
    else if (event.key === "Home") nextWidth = min;
    else if (event.key === "End") nextWidth = max;
    else return;
    event.preventDefault();
    filesSidebarWidth = clampFilesSidebarWidth(nextWidth);
  }
  let projectDraft = $state<CommunityProjectsCreateProject>({
    name: "",
    identifier: "",
    description: "",
    channelId: "",
  });
  let repositoryDraft = $state<CommunityProjectsCreateRepository>({
    name: "",
    identifier: "",
    description: "",
    mode: "hosted",
    cloneUrl: "",
    webUrl: "",
  });
  let taskDraft = $state<CommunityProjectsCreateTask>({
    repository: "project",
    title: "",
    content: "",
  });
  let pullRequestDraft = $state<CommunityProjectsCreatePullRequest>({
    repository: "",
    title: "",
    content: "",
    commit: "",
    cloneUrl: "",
    branchName: "",
    targetBranch: "main",
  });

  const hostedRepositories = $derived(
    repositories.filter(
      (repository) => repository.repositoryClass === "hosted",
    ),
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
  const fileRows = $derived(
    tree?.entries
      .filter((entry) => entry.type === "blob")
      .map((entry) => ({
        path: entry.path ?? [tree.path, entry.name].filter(Boolean).join("/"),
      })) ?? [],
  );
  const busy = $derived(operation !== "");
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
    if (!request) return;
    if (request.kind === "project") projectDialogOpen = true;
    if (request.kind === "repository") repositoryDialogOpen = true;
    if (request.kind === "task") taskDialogOpen = true;
    if (request.kind === "review") pullRequestDialogOpen = true;
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

  async function submitProject(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    resetError();
    try {
      await onCreateProject?.(projectDraft);
      projectDialogOpen = false;
      projectDraft = {
        name: "",
        identifier: "",
        description: "",
        channelId: "",
      };
    } catch (cause) {
      localError =
        cause instanceof Error ? cause.message : "Project could not be created";
    }
  }

  async function submitRepository(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    resetError();
    try {
      await onCreateRepository?.(repositoryDraft);
      repositoryDialogOpen = false;
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
      taskDraft = { repository: "project", title: "", content: "" };
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

  function projectRepositoriesFor(project: (typeof projects)[number]) {
    const coordinates = new Set(
      project.repositories.map((repository) => repository.coordinate),
    );
    return repositories.filter((repository) =>
      coordinates.has(repository.address.coordinate),
    );
  }

  function projectTasksFor(project: (typeof projects)[number]) {
    const coordinates = new Set(
      project.repositories.map((repository) => repository.coordinate),
    );
    return tasks.filter((task) => coordinates.has(task.repository.coordinate));
  }

  function projectPullRequestsFor(project: (typeof projects)[number]) {
    const coordinates = new Set(
      project.repositories.map((repository) => repository.coordinate),
    );
    return pullRequests.filter((pullRequest) =>
      coordinates.has(pullRequest.repository.coordinate),
    );
  }

  function channelRepositoryCount(
    binding: (typeof projectChannels)[number],
  ): number {
    const project = projects.find(
      (candidate) => candidate.address.coordinate === binding.projectCoordinate,
    );
    return project ? projectRepositoriesFor(project).length : 0;
  }

  function taskStatusLabel(
    lifecycle: (typeof tasks)[number]["lifecycle"],
  ): string {
    if (lifecycle === "applied") return "Done";
    return lifecycle[0]!.toUpperCase() + lifecycle.slice(1);
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

  function sortedChannels(
    bindings: readonly (typeof projectChannels)[number][],
  ) {
    return [...bindings].sort((left, right) =>
      channelName(left).localeCompare(channelName(right)),
    );
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

{#snippet taskListRow(task: (typeof tasks)[number])}
  <button
    type="button"
    class="community-projects__task-row"
    onclick={() => onSelectTask?.(task)}
  >
    {@render taskStatusIcon(task.lifecycle)}
    <strong>{task.title}</strong>
    <span class="community-projects__task-repository">
      {taskRepositoryName(task)}
    </span>
    <span class="community-projects__task-row-assignees">
      <CommunityMemberAvatar
        member={memberForPubkey(task.root.pubkey)}
        size="xsmall"
        decorative
      />
      {#each task.assignees
        .filter((assignee) => assignee !== task.root.pubkey)
        .slice(0, 1) as assignee (assignee)}
        <CommunityMemberAvatar
          member={memberForPubkey(assignee)}
          size="xsmall"
          decorative
        />
      {/each}
    </span>
    <span class="community-projects__task-comments">
      <MessageSquareIcon aria-hidden="true" />
      {taskComments(task).length}
    </span>
    <CommunityRelativeTime timestamp={task.updatedAt} />
  </button>
{/snippet}

{#snippet channelListRow(binding: (typeof projectChannels)[number])}
  {@const room = rooms.find(
    (candidate) =>
      candidate.groupId === binding.channelId ||
      candidate.id === binding.channelId,
  )}
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
    <span class="community-projects__channel-role">
      {binding.role === "home"
        ? "Project channel"
        : `${channelRepositoryCount(binding)} repositories`}
    </span>
    {#if room?.memberCount !== undefined}
      <span class="community-projects__row-count"
        ><MessageSquareIcon aria-hidden="true" />{room.memberCount}</span
      >
    {/if}
  </button>
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
    {#if title !== "Commits" && title !== "Reviews" && title !== "Files"}
      {@render layoutControls()}
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

<AppShell.Body
  bind:ref={filesBodyElement}
  layout="regions"
  label={selectedProject ? `${selectedProject.name} projects` : "Projects"}
  class={view === "files" ? "community-projects__files-layout" : undefined}
  style={filesSidebarWidth === undefined
    ? undefined
    : `--ui-shell-body-sidebar-width: ${filesSidebarWidth}px`}
>
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <section
    class="community-projects"
    data-ui-component="community-projects"
    data-view={view}
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

    {#if error}
      <Alert.Root variant="destructive" class="community-projects__alert">
        <Alert.Title>Projects could not be loaded</Alert.Title>
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
          <span>{weekActivityCount > 0 ? "This week" : "Earlier"}</span>
        </div>
        <div class="community-projects__activity">
          {#each visibleActivity as item (item.id)}
            {@const actor = activityMember(item.actorPubkey)}
            <article class="community-projects__activity-item">
              <CommunityMemberAvatar member={actor} decorative />
              <span class="community-projects__activity-line" aria-hidden="true"
              ></span>
              <div class="community-projects__activity-copy">
                <div>
                  <strong>{actor.name}</strong>
                  <span
                    >{item.action} {projectName(item.projectCoordinate)}</span
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
                    {:else if item.kind === "task"}
                      <CircleIcon aria-hidden="true" />
                    {:else if item.kind === "comment" || item.kind === "assignment"}
                      <MessageSquareIcon aria-hidden="true" />
                    {:else}
                      <CodeXmlIcon aria-hidden="true" />
                    {/if}
                    <strong>{item.title}</strong>
                  </span>
                  {#if item.body}<span>{item.body}</span>{/if}
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
            <p class="community-projects__status">No project activity yet.</p>
          {/each}
        </div>
      </div>
    {:else if view === "directory" || view === "projects"}
      <header class="community-projects__directory-header">
        <div>
          <FolderKanbanIcon aria-hidden="true" />
          <h1>Projects</h1>
        </div>
        {@render layoutControls()}
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
        <div class="community-projects__list-group-heading">
          <FolderKanbanIcon aria-hidden="true" />
          <strong>Other projects</strong>
        </div>
        <div class="community-projects__grid" data-layout={listLayout}>
          {#each projects as project (project.address.coordinate)}
            <button
              type="button"
              class="community-projects__card"
              onclick={() => onSelectProject?.(project)}
            >
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
                  ><GitBranchIcon aria-hidden="true" />{project.repositories
                    .length}</span
                >
                <CommunityMemberAvatar
                  member={activityMember(project.event.pubkey)}
                  size="xsmall"
                  decorative
                />
                <CommunityRelativeTime timestamp={project.event.created_at} />
              </span>
            </button>
          {/each}
        </div>
      {/if}
    {:else if view === "overview"}
      <article class="community-projects__workspace community-projects__readme">
        {#if tree?.readme}
          <CommunityMarkdownContent
            content={tree.readme}
            {members}
            {rooms}
            {communityEmojis}
          />
        {:else if loading}
          <p class="community-projects__status" role="status">
            Loading repository overview…
          </p>
        {:else if !canCollaborate && hostedRepositories.length > 0}
          <Empty.Root class="community-projects__empty">
            <Empty.Header>
              <Empty.Media variant="icon"
                ><FileIcon aria-hidden="true" /></Empty.Media
              >
              <Empty.Title>Sign in to view repository files</Empty.Title>
              <Empty.Description>
                Hosted source reads use your Nostr identity to enforce the
                project's channel access.
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
                Add a README to a relay-hosted repository to show it here.
                External repositories remain linked without assuming local Git
                access.
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
      <div class="community-projects__list-group-heading">
        <FolderKanbanIcon aria-hidden="true" />
        <strong>{selectedProject?.name ?? "Other repositories"}</strong>
      </div>
      <div class="community-projects__list" data-layout={listLayout}>
        {#each repositories as repository (repository.address.coordinate)}
          <article class="community-projects__row">
            <span class="community-projects__row-icon"
              ><GitBranchIcon aria-hidden="true" /></span
            >
            <div class="community-projects__row-main">
              <span
                ><strong>{repository.name}</strong>
                {repository.description || repository.address.identifier}</span
              >
            </div>
            <div class="community-projects__row-meta">
              <CommunityMemberAvatar
                member={activityMember(repository.event.pubkey)}
                size="xsmall"
                decorative
              />
              <span class="community-projects__row-count"
                ><CircleIcon aria-hidden="true" />{repositoryTaskCount(
                  repository.address.coordinate,
                )}</span
              >
              {#if repositoryTaskCount(repository.address.coordinate) > 0}
                <span
                  class="community-projects__repository-activity"
                  aria-hidden="true"><span></span></span
                >
              {/if}
              <CommunityRelativeTime timestamp={repository.event.created_at} />
              {#if repository.webUrls[0]}
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
        {:else}
          <p class="community-projects__status">
            No repositories are attached.
          </p>
        {/each}
      </div>
    {:else if view === "channels"}
      {@render surfaceHeader(
        "Channels",
        selectedProject
          ? "The project home and attached Community channels."
          : "Community channels attached to your projects.",
      )}
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
              <dd>Issue</dd>
            </div>
            <div>
              <dt><UserIcon aria-hidden="true" /> Assignees</dt>
              <dd class="community-projects__task-assignees">
                {#each selectedTask.assignees as assignee (assignee)}
                  <CommunityMemberAvatar
                    member={memberForPubkey(assignee)}
                    size="small"
                    decorative
                  />
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
                  {...currentMemberId === undefined ? {} : { currentMemberId }}
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
        <div class="community-projects__task-list" data-layout={listLayout}>
          {#if selectedProject}
            <div
              class="community-projects__list-group-heading community-projects__list-group-heading--inset"
            >
              <FolderKanbanIcon aria-hidden="true" />
              <strong>{selectedProject.name}</strong>
            </div>
            {#each projectTasksFor(selectedProject) as task (task.root.id)}
              {@render taskListRow(task)}
            {:else}
              <p class="community-projects__status">
                No tasks in this project.
              </p>
            {/each}
          {:else}
            {#each projects as project (project.address.coordinate)}
              {@const projectTasks = projectTasksFor(project)}
              {#if projectTasks.length > 0}
                <div
                  class="community-projects__list-group-heading community-projects__list-group-heading--inset"
                >
                  <FolderKanbanIcon aria-hidden="true" />
                  <strong>{project.name}</strong>
                </div>
                {#each projectTasks as task (task.root.id)}
                  {@render taskListRow(task)}
                {/each}
              {/if}
            {:else}
              <p class="community-projects__status">
                No tasks in this project.
              </p>
            {/each}
          {/if}
        </div>
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
          aria-label={showReviewHeader ? undefined : selectedPullRequest.title}
          aria-labelledby={showReviewHeader
            ? "community-project-review-title"
            : undefined}
        >
          <dl class="community-projects__review-meta">
            <div>
              <dt><GitBranchIcon aria-hidden="true" /><span>Branch</span></dt>
              <dd class="community-projects__review-branch">
                <span>{selectedPullRequest.branchName || "unknown branch"}</span
                >
                <span aria-hidden="true">→</span>
                <span
                  >{selectedPullRequest.targetBranch || "default branch"}</span
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
                  <CommunityMemberAvatar
                    member={reviewerMember}
                    size="xsmall"
                    decorative
                  />
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
                  (group) => group.lifecycle === selectedPullRequest.lifecycle,
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
            class="community-projects__review-section"
            bind:open={reviewFilesOpen}
          >
            <Collapsible.Trigger
              class="community-projects__review-section-trigger"
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
                  Loading hosted diff…
                </p>
              {:else if pullRequestDiff}
                <div class="community-projects__diff-summary">
                  <strong>{pullRequestDiff.files.length} changed files</strong>
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
                </div>
                <div class="community-projects__diff-layout">
                  <aside aria-label="Changed files">
                    <div class="community-projects__changed-files-toolbar">
                      <span>Files</span>
                      <FileListingViewModeToggle bind:mode={diffFileListMode} />
                    </div>
                    <FileListing
                      files={projectDiffFiles}
                      mode={diffFileListMode}
                    />
                  </aside>
                  <div class="community-projects__diff-content">
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
                      files={projectDiffFiles}
                      lineAccessory={lineComment}
                      lineAnnotation={inlineDiscussion}
                    />
                  </div>
                </div>
              {:else}
                <p class="community-projects__status">
                  This comparison is unavailable. External repositories remain
                  visible, but Community does not assume local Git access.
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
            <Collapsible.Content class="community-projects__review-commit-list">
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
                        update.event.content.trim() || "Updated review branch",
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
                {#each selectedPullRequest.comments.filter(conversationComment) as comment (comment.event.id)}
                  {#snippet reviewLabels()}
                    <div class="community-projects__message-labels">
                      {#if comment.decision}<CommunityChip
                          size="compact"
                          tone={comment.decision === "approved"
                            ? "success"
                            : "warning"}>{comment.decision}</CommunityChip
                        >{/if}
                      {#if comment.inlineStatus}<CommunityChip size="compact"
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
                  />
                {:else}<p class="community-projects__status">
                    No review comments yet.
                  </p>{/each}
                <div class="community-projects__review-actions">
                  <Button
                    type="button"
                    size="sm"
                    disabled
                    title={selectedPullRequest.lifecycle === "merged"
                      ? "This pull request is already merged"
                      : "Merge execution requires relay-side merge coordination"}
                  >
                    <GitMergeIcon data-icon="inline-start" aria-hidden="true" />
                    {selectedPullRequest.lifecycle === "merged"
                      ? `Merged${selectedPullRequest.mergeCommit ? ` as ${selectedPullRequest.mergeCommit.slice(0, 8)}` : ""}`
                      : "Merge unavailable"}
                  </Button>
                  <span class="community-projects__review-action-spacer"></span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!canCollaborate || busy}
                    onclick={() => onRequestChanges?.(selectedPullRequest)}
                    >Request changes</Button
                  >
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!canCollaborate || busy}
                    onclick={() => onApprovePullRequest?.(selectedPullRequest)}
                    ><CheckIcon data-icon="inline-start" aria-hidden="true" /> Approve</Button
                  >
                  {#if onUpdatePullRequestLifecycle}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!canCollaborate ||
                        busy ||
                        selectedPullRequest.lifecycle === "merged"}
                      onclick={() =>
                        onUpdatePullRequestLifecycle?.(
                          selectedPullRequest,
                          selectedPullRequest.lifecycle === "closed"
                            ? "open"
                            : "closed",
                        )}
                      >{selectedPullRequest.lifecycle === "closed"
                        ? "Reopen"
                        : "Close"}</Button
                    >
                  {/if}
                </div>
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
                      (candidate) => candidate.root.id === pullRequest.root.id,
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
                      {@const author = memberForPubkey(pullRequest.root.pubkey)}
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
                        <CommunityMemberAvatar
                          member={author}
                          size="xsmall"
                          decorative
                        />
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
              class="community-projects__review-section-trigger community-projects__commit-files-trigger"
            >
              <span>Files changed</span>
              {#if commitFilesOpen}
                <ChevronDownIcon aria-hidden="true" />
              {:else}
                <ChevronRightIcon aria-hidden="true" />
              {/if}
            </Collapsible.Trigger>
            <Collapsible.Content
              class="community-projects__commit-files-content"
            >
              {#if loading && !selectedCommitDetail}
                <p class="community-projects__status" role="status">
                  Loading commit diff…
                </p>
              {:else if selectedCommitDetail && commitDiffFiles.length > 0}
                <div class="community-projects__commit-diff-layout">
                  <aside aria-label="Changed files">
                    <div class="community-projects__commit-file-summary">
                      <span>{commitDiffFiles.length} changed files</span>
                      <FileListingViewModeToggle bind:mode={diffFileListMode} />
                      <Input
                        bind:value={commitFileFilter}
                        aria-label="Filter changed files"
                        placeholder="Filter files…"
                      />
                    </div>
                    <FileListing
                      files={visibleCommitDiffFiles}
                      mode={diffFileListMode}
                      selectedPath={selectedCommitFilePath || null}
                      onSelectPath={(path) => {
                        selectedCommitFilePath = path;
                      }}
                    />
                  </aside>
                  <section
                    class="community-projects__commit-diff"
                    aria-label="Commit diff"
                  >
                    <header>
                      <span
                        >{selectedCommitValue.subject} · {selectedCommitValue.sha.slice(
                          0,
                          7,
                        )}</span
                      >
                      <span>
                        {commitDiffFiles.length} files changed
                        <FileChangeStats
                          additions={commitAdditions}
                          deletions={commitDeletions}
                        />
                      </span>
                    </header>
                    <FileDiffComposer files={commitDiffFiles} />
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
          "Hosted repository history loaded through the relay gateway.",
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
                    <CommunityMemberAvatar
                      member={author}
                      size="xsmall"
                      decorative
                    />
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
                  No hosted commit history is available.
                </p>{/each}
            {/if}
          </div>
        </div>
      {/if}
    {:else if view === "files"}
      {#if loading && !tree}
        <p class="community-projects__status" role="status">
          Loading repository files…
        </p>
      {:else if !canCollaborate && hostedRepositories.length > 0}
        <Empty.Root class="community-projects__empty">
          <Empty.Header>
            <Empty.Media variant="icon"
              ><FileIcon aria-hidden="true" /></Empty.Media
            >
            <Empty.Title>Sign in to view repository files</Empty.Title>
            <Empty.Description>
              Hosted source reads use your Nostr identity to enforce the
              project's channel access.
            </Empty.Description>
          </Empty.Header>
        </Empty.Root>
      {:else if effectiveSourceError}
        {@render projectSourceError(effectiveSourceError)}
      {:else if tree}
        <AppShell.Body.Sidebar
          bind:ref={filesSidebarElement}
          panelId="project-repository-files"
          side="left"
          label="Repository files"
          mobileLabel="Repository files"
          scrollbarVisibility="hover"
          class="community-projects__files-sidebar"
        >
          <div class="community-projects__files-list">
            <div class="community-projects__files-toolbar">
              <span>{fileRows.length} files</span>
              <FileListingViewModeToggle bind:mode={repositoryFileListMode} />
            </div>
            <FileListing
              files={fileRows}
              mode={repositoryFileListMode}
              selectedPath={selectedPath || null}
              {...onSelectPath === undefined ? {} : { onSelectPath }}
            />
          </div>
        </AppShell.Body.Sidebar>
        <button
          type="button"
          class="community-projects__files-resize-handle"
          data-resizing={filesResizePointerId === null ? undefined : ""}
          aria-label="Resize repository file list"
          title="Drag to resize. Double-click to reset width."
          onpointerdown={beginFilesResize}
          onpointermove={moveFilesResize}
          onpointerup={finishFilesResize}
          onpointercancel={finishFilesResize}
          ondblclick={() => (filesSidebarWidth = undefined)}
          onkeydown={resizeFilesWithKeyboard}
        >
          <span aria-hidden="true"></span>
        </button>
        <AppShell.Body.Content
          label="File contents"
          scrollbarVisibility="hover"
          class="community-projects__files-content"
        >
          <section class="community-projects__blob">
            {#if blob?.binary}<Empty.Root
                ><Empty.Header
                  ><Empty.Media variant="icon"
                    ><FileIcon aria-hidden="true" /></Empty.Media
                  ><Empty.Title>Binary file</Empty.Title><Empty.Description
                    >{blob.path} cannot be previewed as text.</Empty.Description
                  ></Empty.Header
                ></Empty.Root
              >
            {:else if blob?.too_large}<p class="community-projects__status">
                {blob.path} is too large to preview.
              </p>
            {:else if blob}<CodeBlock
                code={blob.contents ?? ""}
                language={resolveDiffLanguage(blob.path) ?? "plaintext"}
                title={blob.path}
                hasLineNumbers
              />
            {:else}<p class="community-projects__status">
                Select a file to preview it.
              </p>{/if}
          </section>
        </AppShell.Body.Content>
      {:else}
        <Empty.Root class="community-projects__empty">
          <Empty.Header>
            <Empty.Media variant="icon"
              ><FileIcon aria-hidden="true" /></Empty.Media
            >
            <Empty.Title>No hosted repository files</Empty.Title>
            <Empty.Description>
              Add a relay-hosted repository to browse its files here.
            </Empty.Description>
          </Empty.Header>
        </Empty.Root>
      {/if}
    {:else if view === "people" || view === "contributors"}
      {@render surfaceHeader(
        "Contributors",
        "Project collaborators are inherited from the project's NIP-29 channel.",
      )}
      <div class="community-projects__people" data-layout={listLayout}>
        {#each members as member (member.id)}
          <article
            data-interactive={onOpenProfile === undefined ? undefined : "true"}
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
              <CommunityMemberHoverCard
                {member}
                {...onOpenProfile === undefined ? {} : { onOpenProfile }}
                {...onMessageMember === undefined
                  ? {}
                  : { onMessage: onMessageMember }}
                {...onWaveMember === undefined ? {} : { onWave: onWaveMember }}
              />
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

<Dialog.Root bind:open={projectDialogOpen} onOpenChange={resetError}>
  <Dialog.Content>
    <Dialog.Header
      ><Dialog.Title>New project</Dialog.Title><Dialog.Description
        >Create a NIP-MP project in an existing Community channel. No repository
        is created automatically.</Dialog.Description
      ></Dialog.Header
    >
    <form onsubmit={submitProject}>
      <Field.Group>
        <Field.Field
          ><Field.Label for="project-name">Name</Field.Label><Input
            id="project-name"
            bind:value={projectDraft.name}
            required
          /></Field.Field
        >
        <Field.Field
          ><Field.Label for="project-id">Identifier</Field.Label><Input
            id="project-id"
            bind:value={projectDraft.identifier}
            required
            pattern="[A-Za-z0-9._-]+"
          /></Field.Field
        >
        <Field.Field
          ><Field.Label for="project-channel">Community channel ID</Field.Label
          ><Input
            id="project-channel"
            bind:value={projectDraft.channelId}
            required
          /></Field.Field
        >
        <Field.Field
          ><Field.Label for="project-description">Description</Field.Label
          ><Textarea
            id="project-description"
            bind:value={projectDraft.description}
            rows={3}
          /></Field.Field
        >
        {#if localError}<Field.Error>{localError}</Field.Error>{/if}
      </Field.Group><Dialog.Footer
        ><Button
          type="button"
          variant="outline"
          onclick={() => (projectDialogOpen = false)}>Cancel</Button
        ><Button type="submit" disabled={busy}
          >{busy ? operation : "Create project"}</Button
        ></Dialog.Footer
      >
    </form>
  </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={repositoryDialogOpen} onOpenChange={resetError}>
  <Dialog.Content>
    <Dialog.Header
      ><Dialog.Title>Add repository</Dialog.Title><Dialog.Description
        >Hosted repositories use the relay forge. External repositories retain
        their existing clone and web locations.</Dialog.Description
      ></Dialog.Header
    >
    <form onsubmit={submitRepository}>
      <Field.Group>
        <Field.Field
          ><Field.Label for="repository-name">Name</Field.Label><Input
            id="repository-name"
            bind:value={repositoryDraft.name}
            required
          /></Field.Field
        >
        <Field.Field
          ><Field.Label for="repository-id">Identifier</Field.Label><Input
            id="repository-id"
            bind:value={repositoryDraft.identifier}
            required
            pattern="[A-Za-z0-9._-]+"
          /></Field.Field
        >
        <Field.Field
          ><Field.Label for="repository-mode">Backing</Field.Label><Select.Root
            type="single"
            value={repositoryDraft.mode}
            onValueChange={(value) => {
              if (value === "hosted" || value === "external")
                repositoryDraft.mode = value;
            }}
            ><Select.Trigger id="repository-mode" role="combobox"
              >{repositoryDraft.mode === "hosted"
                ? "Hosted by relay"
                : "External Git"}</Select.Trigger
            ><Select.Content
              ><Select.Item value="hosted" label="Hosted by relay"
                >Hosted by relay</Select.Item
              ><Select.Item value="external" label="External Git"
                >External Git</Select.Item
              ></Select.Content
            ></Select.Root
          ></Field.Field
        >
        {#if repositoryDraft.mode === "external"}<Field.Field
            ><Field.Label for="repository-clone">Clone URL</Field.Label><Input
              id="repository-clone"
              type="url"
              bind:value={repositoryDraft.cloneUrl}
              required
            /></Field.Field
          ><Field.Field
            ><Field.Label for="repository-web">Web URL</Field.Label><Input
              id="repository-web"
              type="url"
              bind:value={repositoryDraft.webUrl}
            /></Field.Field
          >{/if}
        <Field.Field
          ><Field.Label for="repository-description">Description</Field.Label
          ><Textarea
            id="repository-description"
            bind:value={repositoryDraft.description}
            rows={3}
          /></Field.Field
        >
        {#if localError}<Field.Error>{localError}</Field.Error>{/if}
      </Field.Group><Dialog.Footer
        ><Button
          type="button"
          variant="outline"
          onclick={() => (repositoryDialogOpen = false)}>Cancel</Button
        ><Button type="submit" disabled={busy}
          >{busy ? operation : "Add repository"}</Button
        ></Dialog.Footer
      >
    </form>
  </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={taskDialogOpen} onOpenChange={resetError}>
  <Dialog.Content>
    <Dialog.Header
      ><Dialog.Title>New task</Dialog.Title><Dialog.Description
        >Choose a real repository or create the project's logical task anchor
        only when needed.</Dialog.Description
      ></Dialog.Header
    >
    <form onsubmit={submitTask}>
      <Field.Group>
        <Field.Field
          ><Field.Label for="task-repository">Repository scope</Field.Label
          ><Select.Root
            type="single"
            value={taskDraft.repository}
            onValueChange={(value) => {
              if (value) taskDraft.repository = value;
            }}
            ><Select.Trigger id="task-repository" role="combobox"
              >{taskDraft.repository === "project"
                ? "Project-wide task"
                : (repositories.find(
                    (repository) =>
                      repository.address.coordinate === taskDraft.repository,
                  )?.name ?? "Select repository")}</Select.Trigger
            ><Select.Content
              ><Select.Item value="project" label="Project-wide task"
                >Project-wide task</Select.Item
              >{#each repositories.filter((repository) => repository.repositoryClass !== "task-anchor") as repository}<Select.Item
                  value={repository.address.coordinate}
                  label={repository.name}>{repository.name}</Select.Item
                >{/each}</Select.Content
            ></Select.Root
          ></Field.Field
        >
        <Field.Field
          ><Field.Label for="task-title">Title</Field.Label><Input
            id="task-title"
            bind:value={taskDraft.title}
            required
          /></Field.Field
        >
        <Field.Field
          ><Field.Label for="task-description">Description</Field.Label
          ><Textarea
            id="task-description"
            bind:value={taskDraft.content}
            rows={5}
          /></Field.Field
        >
        {#if localError}<Field.Error>{localError}</Field.Error>{/if}
      </Field.Group><Dialog.Footer
        ><Button
          type="button"
          variant="outline"
          onclick={() => (taskDialogOpen = false)}>Cancel</Button
        ><Button type="submit" disabled={busy}
          >{busy ? operation : "Create task"}</Button
        ></Dialog.Footer
      >
    </form>
  </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={pullRequestDialogOpen} onOpenChange={resetError}>
  <Dialog.Content>
    <Dialog.Header
      ><Dialog.Title>New pull request</Dialog.Title><Dialog.Description
        >Create a Buzz-compatible NIP-34 pull request. Source and target commits
        must already exist in the hosted repository.</Dialog.Description
      ></Dialog.Header
    >
    <form onsubmit={submitPullRequest}>
      <Field.Group>
        <Field.Field
          ><Field.Label for="pr-repository">Hosted repository</Field.Label
          ><Select.Root
            type="single"
            value={pullRequestDraft.repository}
            onValueChange={(value) => {
              if (value) pullRequestDraft.repository = value;
            }}
            ><Select.Trigger id="pr-repository" role="combobox"
              >{hostedRepositories.find(
                (repository) =>
                  repository.address.coordinate === pullRequestDraft.repository,
              )?.name ?? "Select repository"}</Select.Trigger
            ><Select.Content
              >{#each hostedRepositories as repository}<Select.Item
                  value={repository.address.coordinate}
                  label={repository.name}>{repository.name}</Select.Item
                >{/each}</Select.Content
            ></Select.Root
          ></Field.Field
        >
        <Field.Field
          ><Field.Label for="pr-title">Title</Field.Label><Input
            id="pr-title"
            bind:value={pullRequestDraft.title}
            required
          /></Field.Field
        >
        <Field.Field
          ><Field.Label for="pr-commit">Head commit</Field.Label><Input
            id="pr-commit"
            bind:value={pullRequestDraft.commit}
            required
            minlength={40}
            maxlength={64}
          /></Field.Field
        >
        <Field.Field
          ><Field.Label for="pr-clone">Clone locator</Field.Label><Input
            id="pr-clone"
            bind:value={pullRequestDraft.cloneUrl}
            required
          /></Field.Field
        >
        <div class="community-projects__form-columns">
          <Field.Field
            ><Field.Label for="pr-branch">Branch</Field.Label><Input
              id="pr-branch"
              bind:value={pullRequestDraft.branchName}
            /></Field.Field
          ><Field.Field
            ><Field.Label for="pr-target">Target branch</Field.Label><Input
              id="pr-target"
              bind:value={pullRequestDraft.targetBranch}
            /></Field.Field
          >
        </div>
        <Field.Field
          ><Field.Label for="pr-description">Description</Field.Label><Textarea
            id="pr-description"
            bind:value={pullRequestDraft.content}
            rows={5}
          /></Field.Field
        >
        {#if localError}<Field.Error>{localError}</Field.Error>{/if}
      </Field.Group><Dialog.Footer
        ><Button
          type="button"
          variant="outline"
          onclick={() => (pullRequestDialogOpen = false)}>Cancel</Button
        ><Button type="submit" disabled={busy}
          >{busy ? operation : "Create pull request"}</Button
        ></Dialog.Footer
      >
    </form>
  </Dialog.Content>
</Dialog.Root>
