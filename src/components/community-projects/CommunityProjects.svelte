<script lang="ts">
  import {
    FileChangeStats,
    FileDiffComposer,
    FileListing,
    type FileDiffLineContext,
  } from "@lapismd/design-core/diff";
  import * as Alert from "@lapismd/design-core/shadcn/alert";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as Empty from "@lapismd/design-core/shadcn/empty";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import * as Select from "@lapismd/design-core/shadcn/select";
  import { Textarea } from "@lapismd/design-core/shadcn/textarea";
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import CheckIcon from "@lucide/svelte/icons/check";
  import CodeXmlIcon from "@lucide/svelte/icons/code-xml";
  import ExternalLinkIcon from "@lucide/svelte/icons/external-link";
  import FileIcon from "@lucide/svelte/icons/file";
  import GitBranchIcon from "@lucide/svelte/icons/git-branch";
  import GitCommitHorizontalIcon from "@lucide/svelte/icons/git-commit-horizontal";
  import GitPullRequestIcon from "@lucide/svelte/icons/git-pull-request";
  import MessageSquarePlusIcon from "@lucide/svelte/icons/message-square-plus";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import UserIcon from "@lucide/svelte/icons/user";

  import {
    splitProjectForgePatch,
    type PullRequestComment,
  } from "../../projects/index.js";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
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
    tasks = [],
    pullRequests = [],
    selectedPullRequest,
    commits = [],
    selectedCommit,
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
    onSelectProject,
    onCreateProject,
    onCreateRepository,
    onCreateTask,
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
  let localError = $state("");
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
  const fileRows = $derived(
    tree?.entries.map((entry) => ({
      path: [tree.path, entry.name].filter(Boolean).join("/"),
    })) ?? [],
  );
  const busy = $derived(operation !== "");

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

{#snippet surfaceHeader(title: string, description: string)}
  <header class="community-projects__surface-header">
    <div>
      <p class="community-projects__eyebrow">
        {selectedProject?.name ?? "Projects"}
      </p>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
    <div class="community-projects__surface-actions">
      {#if selectedProject && onCreateRepository}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onclick={() => (repositoryDialogOpen = true)}
        >
          <GitBranchIcon data-icon="inline-start" aria-hidden="true" /> Add repository
        </Button>
      {/if}
      {#if view === "tasks" && onCreateTask}
        <Button
          type="button"
          size="sm"
          onclick={() => (taskDialogOpen = true)}
          disabled={!canCollaborate}
        >
          <PlusIcon data-icon="inline-start" aria-hidden="true" /> New task
        </Button>
      {/if}
      {#if view === "reviews" && !selectedPullRequest && onCreatePullRequest}
        <Button
          type="button"
          size="sm"
          onclick={() => (pullRequestDialogOpen = true)}
          disabled={!canCollaborate || hostedRepositories.length === 0}
        >
          <GitPullRequestIcon data-icon="inline-start" aria-hidden="true" /> New
          pull request
        </Button>
      {/if}
    </div>
  </header>
{/snippet}

<section
  class="community-projects"
  data-ui-component="community-projects"
  data-view={view}
  aria-busy={loading}
>
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

  {#if view === "directory"}
    <header class="community-projects__directory-header">
      <div>
        <p class="community-projects__eyebrow">Nostr-native collaboration</p>
        <h1>Projects</h1>
        <p>
          Tasks, repositories, pull requests, files, and project conversations
          from your active Community relay.
        </p>
      </div>
      {#if onCreateProject}
        <Button
          type="button"
          onclick={() => (projectDialogOpen = true)}
          disabled={!canCollaborate}
        >
          <PlusIcon data-icon="inline-start" aria-hidden="true" /> New project
        </Button>
      {/if}
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
      <div class="community-projects__grid">
        {#each projects as project (project.address.coordinate)}
          <button
            type="button"
            class="community-projects__card"
            onclick={() => onSelectProject?.(project)}
          >
            <span class="community-projects__card-icon"
              ><CodeXmlIcon aria-hidden="true" /></span
            >
            <span class="community-projects__card-copy">
              <strong>{project.name}</strong>
              <span>{project.description || "No project description"}</span>
            </span>
            <span class="community-projects__card-meta">
              <CommunityChip size="compact" tone="neutral"
                >{project.repositories.length} repos</CommunityChip
              >
              <CommunityChip size="compact" tone="accent"
                >#{project.channelId || "unscoped"}</CommunityChip
              >
            </span>
          </button>
        {/each}
      </div>
    {/if}
  {:else if view === "tasks"}
    {@render surfaceHeader(
      "Tasks",
      "Repository-scoped NIP-34 tasks, including lazy project task anchors.",
    )}
    <div class="community-projects__list">
      {#each tasks as task (task.root.id)}
        <article class="community-projects__row">
          <div class="community-projects__row-main">
            <strong>{task.title}</strong>
            <p>{task.content}</p>
          </div>
          <div class="community-projects__row-meta">
            {@render statusChip(task.lifecycle)}
            {#if task.assignees.length > 0}<CommunityChip size="compact"
                >{task.assignees.length} assigned</CommunityChip
              >{/if}
            <CommunityRelativeTime timestamp={task.updatedAt} />
            {#if onUpdateTaskLifecycle}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={!canCollaborate || busy}
                onclick={() =>
                  onUpdateTaskLifecycle?.(
                    task,
                    task.lifecycle === "closed" ? "open" : "closed",
                  )}>{task.lifecycle === "closed" ? "Reopen" : "Close"}</Button
              >
            {/if}
          </div>
        </article>
      {:else}
        <p class="community-projects__status">No tasks in this project.</p>
      {/each}
    </div>
  {:else if view === "reviews"}
    {#if selectedPullRequest}
      <header class="community-projects__review-header">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onclick={onClosePullRequest}
        >
          <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" /> Reviews
        </Button>
        <div>
          <div class="community-projects__review-title">
            <h2>{selectedPullRequest.title}</h2>
            {@render statusChip(selectedPullRequest.lifecycle)}
          </div>
          <p>{selectedPullRequest.content}</p>
          <div class="community-projects__review-refs">
            <CommunityChip size="compact"
              ><GitCommitHorizontalIcon
                data-icon="inline-start"
                aria-hidden="true"
              />{selectedPullRequest.currentCommit.slice(0, 10)}</CommunityChip
            >
            {#if selectedPullRequest.branchName}<CommunityChip size="compact"
                >{selectedPullRequest.branchName}</CommunityChip
              >{/if}
            {#if selectedPullRequest.targetBranch}<span>into</span
              ><CommunityChip size="compact"
                >{selectedPullRequest.targetBranch}</CommunityChip
              >{/if}
          </div>
        </div>
        <div class="community-projects__review-actions">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canCollaborate || busy}
            onclick={() => onRequestChanges?.(selectedPullRequest)}
            >Request changes</Button
          >
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canCollaborate || busy}
            onclick={() => onApprovePullRequest?.(selectedPullRequest)}
            ><CheckIcon data-icon="inline-start" aria-hidden="true" /> Approve</Button
          >
          {#if onUpdatePullRequestLifecycle}
            <Button
              type="button"
              variant="outline"
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
          <Button
            type="button"
            size="sm"
            disabled
            title={selectedPullRequest.lifecycle === "merged"
              ? "This pull request is already merged"
              : "Merge execution requires relay-side merge coordination"}
          >
            {selectedPullRequest.lifecycle === "merged"
              ? `Merged${selectedPullRequest.mergeCommit ? ` as ${selectedPullRequest.mergeCommit.slice(0, 8)}` : ""}`
              : "Merge unavailable"}
          </Button>
        </div>
      </header>
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
            <FileListing files={projectDiffFiles} mode="tree" />
          </aside>
          <div class="community-projects__diff-content">
            {#snippet lineComment(context: FileDiffLineContext)}
              {#if context.lineNumber !== null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Comment on ${context.path} line ${context.lineNumber}`}
                  title="Add inline comment"
                  onclick={() => addLineComment(context)}
                >
                  <MessageSquarePlusIcon aria-hidden="true" />
                </Button>
              {/if}
            {/snippet}
            {#snippet inlineDiscussion(context: FileDiffLineContext)}
              {@const inlineComments = selectedPullRequest.comments.filter(
                (comment) => inlineCommentMatches(comment, context),
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
                              : "warning"}>{comment.decision}</CommunityChip
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
          This comparison is unavailable. External repositories remain visible,
          but Community does not assume local Git access.
        </p>
      {/if}
      <section
        class="community-projects__review-conversation"
        aria-label="Pull request conversation"
      >
        <h3>Conversation</h3>
        {#each selectedPullRequest.comments.filter(conversationComment) as comment (comment.event.id)}
          {#snippet reviewLabels()}
            <div class="community-projects__message-labels">
              {#if comment.decision}<CommunityChip
                  size="compact"
                  tone={comment.decision === "approved" ? "success" : "warning"}
                  >{comment.decision}</CommunityChip
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
            {...currentMemberId === undefined ? {} : { currentMemberId }}
            supplement={reviewLabels}
            density="compact"
          />
        {:else}<p class="community-projects__status">
            No review comments yet.
          </p>{/each}
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
            {...currentMemberId === undefined ? {} : { currentMemberId }}
            {busy}
            disabled={!canCollaborate}
            disabledReason="Sign in to comment on this review"
            onSubmit={(submission) =>
              submitPullRequestComment(submission.content)}
          />
        {/if}
      </section>
    {:else}
      {@render surfaceHeader(
        "Reviews",
        "Buzz-compatible NIP-34 pull requests and trusted review decisions.",
      )}
      <div class="community-projects__list">
        {#each pullRequests as pullRequest (pullRequest.root.id)}
          <button
            type="button"
            class="community-projects__row community-projects__row--button"
            onclick={() => onSelectPullRequest?.(pullRequest)}
          >
            <span class="community-projects__row-icon"
              ><GitPullRequestIcon aria-hidden="true" /></span
            >
            <span class="community-projects__row-main"
              ><strong>{pullRequest.title}</strong><span
                >{pullRequest.branchName ||
                  pullRequest.currentCommit.slice(0, 10)} → {pullRequest.targetBranch ||
                  "default"}</span
              ></span
            >
            <span class="community-projects__row-meta"
              >{@render statusChip(pullRequest.lifecycle)}<CommunityChip
                size="compact"
                tone="success"
                >{pullRequest.approvals.length} approvals</CommunityChip
              ><CommunityRelativeTime timestamp={pullRequest.updatedAt} /></span
            >
          </button>
        {:else}
          <p class="community-projects__status">
            No pull requests in this project.
          </p>
        {/each}
      </div>
    {/if}
  {:else if view === "commits"}
    {@render surfaceHeader(
      "Commits",
      "Hosted repository history loaded through the relay gateway.",
    )}
    <div class="community-projects__commit-layout">
      <div class="community-projects__list">
        {#each commits as commit (commit.sha)}
          <button
            type="button"
            class="community-projects__row community-projects__row--button"
            onclick={() => onSelectCommit?.(commit)}
          >
            <span class="community-projects__row-icon"
              ><GitCommitHorizontalIcon aria-hidden="true" /></span
            >
            <span class="community-projects__row-main"
              ><strong>{commit.subject}</strong><span
                >{commit.sha.slice(0, 12)}</span
              ></span
            >
            {#if commit.author_date}<CommunityRelativeTime
                timestamp={Math.floor(
                  new Date(commit.author_date).getTime() / 1_000,
                )}
              />{/if}
          </button>
        {:else}<p class="community-projects__status">
            No hosted commit history is available.
          </p>{/each}
      </div>
      {#if selectedCommit}<article class="community-projects__commit-detail">
          <h3>{selectedCommit.subject}</h3>
          <code>{selectedCommit.sha}</code>
          <p>{selectedCommit.body}</p>
        </article>{/if}
    </div>
  {:else if view === "files"}
    {@render surfaceHeader(
      "Files",
      "Browse hosted repository files without a local checkout or Git binary.",
    )}
    <div class="community-projects__files-layout">
      <aside aria-label="Repository files">
        <FileListing
          files={fileRows}
          mode="tree"
          selectedPath={selectedPath || null}
          {...onSelectPath === undefined ? {} : { onSelectPath }}
        />
      </aside>
      <section class="community-projects__blob" aria-label="File contents">
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
        {:else if blob}<header>
            <strong>{blob.path}</strong><CommunityChip size="compact"
              >{blob.size ?? blob.contents?.length ?? 0} bytes</CommunityChip
            >
          </header>
          <pre><code>{blob.contents ?? ""}</code></pre>
        {:else}<p class="community-projects__status">
            Select a file to preview it.
          </p>{/if}
      </section>
    </div>
  {:else if view === "people"}
    {@render surfaceHeader(
      "People",
      "Project collaborators are inherited from the project's NIP-29 channel.",
    )}
    <div class="community-projects__people">
      {#each members as member (member.id)}
        <article>
          <CommunityMemberAvatar {member} />
          <div><strong>{member.name}</strong><span>{member.handle}</span></div>
          {#if member.role}<CommunityChip size="compact" tone="accent"
              >{member.role}</CommunityChip
            >{/if}
        </article>
      {:else}<p class="community-projects__status">
          The project channel roster is unavailable.
        </p>{/each}
    </div>
  {/if}
</section>

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
