<script lang="ts">
  import * as Empty from "@lapismd/design-core/shadcn/empty";
  import { Skeleton } from "@lapismd/design-core/shadcn/skeleton";
  import FileIcon from "@lucide/svelte/icons/file";

  import type { CommunityCustomEmoji } from "../../community/index.js";
  import type {
    ProjectForgeBlobResponse,
    ProjectForgeCommit,
    ProjectForgeRef,
    ProjectForgeTreeResponse,
  } from "../../projects/index.js";
  import type {
    CommunityMemberModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
  import type {
    RepositoryBreadcrumbSegment,
    RepositoryBrowserEntry,
  } from "./repository-browser.js";
  import CommunityProjectsRepositoryDirectory from "./CommunityProjectsRepositoryDirectory.svelte";
  import CommunityProjectsRepositoryFilePanel from "./CommunityProjectsRepositoryFilePanel.svelte";
  import CommunityProjectsRepositoryFileTree from "./CommunityProjectsRepositoryFileTree.svelte";
  import CommunityProjectsSourceError from "./CommunityProjectsSourceError.svelte";

  let {
    loading = false,
    canCollaborate = false,
    hasRepositorySources = false,
    sourceError = "",
    homeChannelId,
    homeChannelName,
    browsableCount = 0,
    tree,
    selectedPath = "",
    blob,
    fileTreeOpen = $bindable(false),
    markdownView = $bindable("preview"),
    fileTreeEntries,
    isMarkdown,
    fileBreadcrumbs,
    directoryBreadcrumbs,
    currentPath,
    directoryEntries,
    pathCommits,
    repositoryName,
    branch,
    branches = [],
    latestCommitAuthor,
    members = [],
    rooms = [],
    communityEmojis = [],
    onSelectChannel,
    onSelectBranch,
    onOpenDirectory,
    onOpenFile,
    onSelectCommit,
    onLoadPathCommit,
  }: {
    loading?: boolean | undefined;
    canCollaborate?: boolean | undefined;
    hasRepositorySources?: boolean | undefined;
    sourceError?: string | undefined;
    homeChannelId?: string | undefined;
    homeChannelName?: string | undefined;
    browsableCount?: number | undefined;
    tree?: ProjectForgeTreeResponse | undefined;
    selectedPath?: string | undefined;
    blob?: ProjectForgeBlobResponse | undefined;
    fileTreeOpen?: boolean | undefined;
    markdownView?: "preview" | "source" | undefined;
    fileTreeEntries: readonly { path: string }[];
    isMarkdown: boolean;
    fileBreadcrumbs: readonly RepositoryBreadcrumbSegment[];
    directoryBreadcrumbs: readonly RepositoryBreadcrumbSegment[];
    currentPath: string;
    directoryEntries: readonly RepositoryBrowserEntry[];
    pathCommits: Readonly<Record<string, ProjectForgeCommit | undefined>>;
    repositoryName: string;
    branch: string;
    branches?: readonly ProjectForgeRef[] | undefined;
    latestCommitAuthor?: CommunityMemberModel | undefined;
    members?: readonly CommunityMemberModel[] | undefined;
    rooms?: readonly CommunityRoomModel[] | undefined;
    communityEmojis?: readonly CommunityCustomEmoji[] | undefined;
    onSelectChannel?: ((roomId: string) => void) | undefined;
    onSelectBranch: (value: string | undefined) => void;
    onOpenDirectory: (path: string) => void;
    onOpenFile: (path: string) => void;
    onSelectCommit?: ((commit: ProjectForgeCommit) => void) | undefined;
    onLoadPathCommit?:
      | ((
          path: string,
          signal?: AbortSignal,
        ) => Promise<ProjectForgeCommit | undefined>)
      | undefined;
  } = $props();
</script>

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
      <div class="community-projects__files-loading-commit" aria-hidden="true">
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
      <div class="community-projects__files-loading-list" aria-hidden="true">
        {#each [0, 1, 2, 3, 4] as row (row)}
          <div>
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </div>
        {/each}
      </div>
    </div>
  {:else if !canCollaborate && hasRepositorySources}
    <Empty.Root class="community-projects__empty">
      <Empty.Header>
        <Empty.Media variant="icon"><FileIcon aria-hidden="true" /></Empty.Media
        >
        <Empty.Title>Sign in to view repository files</Empty.Title>
        <Empty.Description>
          Repository source reads use your Nostr identity to enforce the
          project's channel access at the relay gateway.
        </Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {:else if sourceError}
    <CommunityProjectsSourceError
      message={sourceError}
      {homeChannelId}
      {homeChannelName}
      {rooms}
      {onSelectChannel}
    />
  {:else if tree && selectedPath}
    <div
      class="community-projects__file-browser-layout"
      data-file-tree-open={fileTreeOpen}
    >
      {#if fileTreeOpen}
        <CommunityProjectsRepositoryFileTree
          bind:expanded={fileTreeOpen}
          {branch}
          {branches}
          files={fileTreeEntries}
          {selectedPath}
          {onSelectBranch}
          onSelectPath={onOpenFile}
        />
      {/if}
      <CommunityProjectsRepositoryFilePanel
        bind:fileTreeOpen
        bind:markdownView
        {loading}
        {selectedPath}
        {blob}
        {isMarkdown}
        breadcrumbs={fileBreadcrumbs}
        {branch}
        {branches}
        {members}
        {rooms}
        {communityEmojis}
        {onSelectBranch}
        {onOpenDirectory}
      />
    </div>
  {:else if tree}
    <div
      class="community-projects__file-browser-layout"
      data-file-tree-open={fileTreeOpen}
    >
      {#if fileTreeOpen}
        <CommunityProjectsRepositoryFileTree
          bind:expanded={fileTreeOpen}
          {branch}
          {branches}
          files={fileTreeEntries}
          {selectedPath}
          {onSelectBranch}
          onSelectPath={onOpenFile}
        />
      {/if}
      <CommunityProjectsRepositoryDirectory
        bind:fileTreeOpen
        {repositoryName}
        {currentPath}
        breadcrumbs={directoryBreadcrumbs}
        {branch}
        {branches}
        entries={directoryEntries}
        {pathCommits}
        latestCommit={tree.commit}
        {latestCommitAuthor}
        canLoadPathCommit={onLoadPathCommit !== undefined}
        {onSelectBranch}
        {onOpenDirectory}
        {onOpenFile}
        {onSelectCommit}
      />
    </div>
  {:else}
    <Empty.Root class="community-projects__empty">
      <Empty.Header>
        <Empty.Media variant="icon"><FileIcon aria-hidden="true" /></Empty.Media
        >
        <Empty.Title
          >{browsableCount === 0
            ? "No browsable repository files"
            : "No repository files"}</Empty.Title
        >
        <Empty.Description>
          {browsableCount === 0
            ? "Attach a repository whose relay capabilities include browsing."
            : "The repository does not contain any files yet."}
        </Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {/if}
</div>
