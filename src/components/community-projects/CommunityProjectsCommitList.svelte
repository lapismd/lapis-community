<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import GitBranchIcon from "@lucide/svelte/icons/git-branch";
  import GitCommitHorizontalIcon from "@lucide/svelte/icons/git-commit-horizontal";

  import {
    encodeProjectListCursor,
    groupItemsByProjectRepository,
    type ProjectForgeCommit,
    type ProjectForgeCommitActivity,
    type ProjectForgeProject,
    type ProjectForgeRepository,
  } from "../../projects/index.js";
  import CommunityRelativeTime from "../community-relative-time/CommunityRelativeTime.svelte";
  import CommunityProjectsGitAuthorAvatar from "./CommunityProjectsGitAuthorAvatar.svelte";
  import CommunityProjectsRepositorySections from "./CommunityProjectsRepositorySections.svelte";
  import type { CommunityMemberModel } from "../community-workspace/model.js";
  import CommunityProjectsVirtualRows from "./CommunityProjectsVirtualRows.svelte";
  import { estimateCommunityProjectRow } from "./virtual-project-row-estimates.js";

  let {
    commits = [],
    members = [],
    commitActivity = [],
    commitBranch = "",
    selectedProject,
    selectedRepository,
    repositories = [],
    onSelectCommit,
    onCopyCommit,
    onLoadMore,
    onVisibleCursorChange,
    hasMore = false,
    loading = false,
  }: {
    commits?: readonly ProjectForgeCommit[] | undefined;
    members?: readonly CommunityMemberModel[];
    commitActivity?: readonly ProjectForgeCommitActivity[] | undefined;
    commitBranch?: string | undefined;
    selectedProject?: ProjectForgeProject | undefined;
    selectedRepository?: ProjectForgeRepository | undefined;
    repositories?: readonly ProjectForgeRepository[] | undefined;
    onSelectCommit?: ((commit: ProjectForgeCommit) => void) | undefined;
    onCopyCommit?: ((sha: string) => void) | undefined;
    onLoadMore?: (() => void) | undefined;
    onVisibleCursorChange?: ((cursor: string | undefined) => void) | undefined;
    hasMore?: boolean | undefined;
    loading?: boolean | undefined;
  } = $props();

  function commitEstimate(commit: ProjectForgeCommit | undefined): number {
    return estimateCommunityProjectRow(
      commit
        ? { kind: "commit", text: commit.subject, detail: commit.body }
        : undefined,
    );
  }

  function commitCursor(commit: ProjectForgeCommit): string | undefined {
    return encodeProjectListCursor({ kind: "commit", sha: commit.sha });
  }

  function commitsForRepository(
    repository: ProjectForgeRepository,
  ): readonly ProjectForgeCommit[] {
    return (
      grouped
        .find(
          (group) =>
            group.repository.address.coordinate ===
            repository.address.coordinate,
        )
        ?.items.map((entry) => entry.commit) ?? []
    );
  }

  const grouped = $derived(
    selectedProject && !selectedRepository
      ? groupItemsByProjectRepository(
          commitActivity,
          repositories,
          (entry) => entry.repositoryCoordinate,
        )
      : [],
  );
</script>

{#snippet commitRow(commit: ProjectForgeCommit)}
  <article class="community-projects__commit-row">
    <GitCommitHorizontalIcon
      class="community-projects__commit-row-icon"
      aria-hidden="true"
    />
    <button
      type="button"
      class="community-projects__commit-row-title"
      onclick={() => onSelectCommit?.(commit)}>{commit.subject}</button
    >
    <button
      type="button"
      class="community-projects__commit-row-hash"
      title={`View commit ${commit.sha.slice(0, 7)}`}
      onclick={() => onSelectCommit?.(commit)}>{commit.sha.slice(0, 7)}</button
    >
    {#if commitBranch}
      <span class="community-projects__commit-row-branch">
        <span aria-hidden="true">›</span>
        <GitBranchIcon aria-hidden="true" />
        <span>{commitBranch}</span>
      </span>
    {/if}
    <span class="community-projects__commit-row-author">
      <CommunityProjectsGitAuthorAvatar
        {members}
        email={commit.author_email}
        name={commit.author ?? commit.author_name}
        size="xsmall"
      />
    </span>
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      class="community-projects__copy-control"
      aria-label={`Copy commit ${commit.sha.slice(0, 7)}`}
      title="Copy commit hash"
      onclick={() => onCopyCommit?.(commit.sha)}
      ><CopyIcon aria-hidden="true" /></Button
    >
    {#if commit.commit_date ?? commit.author_date}<CommunityRelativeTime
        timestamp={Math.floor(
          new Date(commit.commit_date ?? commit.author_date!).getTime() / 1_000,
        )}
      />{/if}
  </article>
{/snippet}

{#if grouped.length > 0}
  <CommunityProjectsRepositorySections
    sections={grouped.map((group) => ({
      repository: group.repository,
      count: group.items.length,
    }))}
    empty="No repository commit history is available."
  >
    {#snippet children(repository)}
      <div class="community-projects__commit-list">
        <CommunityProjectsVirtualRows
          rows={commitsForRepository(repository)}
          row={commitRow}
          estimateSize={commitEstimate}
          cursorForRow={commitCursor}
          getKey={(commit) => commit.sha}
          {loading}
          {hasMore}
          {onLoadMore}
          {onVisibleCursorChange}
        />
      </div>
    {/snippet}
  </CommunityProjectsRepositorySections>
{:else}
  <div class="community-projects__commit-list">
    {#if commits.length > 0}
      <CommunityProjectsVirtualRows
        rows={commits}
        row={commitRow}
        estimateSize={commitEstimate}
        cursorForRow={commitCursor}
        getKey={(commit) => commit.sha}
        {loading}
        {hasMore}
        {onLoadMore}
        {onVisibleCursorChange}
      />
    {:else}
      <p class="community-projects__status">
        No repository commit history is available.
      </p>
    {/if}
  </div>
{/if}
