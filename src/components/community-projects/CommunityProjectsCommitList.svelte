<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import GitBranchIcon from "@lucide/svelte/icons/git-branch";
  import GitCommitHorizontalIcon from "@lucide/svelte/icons/git-commit-horizontal";

  import {
    groupItemsByProjectRepository,
    type ProjectForgeCommit,
    type ProjectForgeCommitActivity,
    type ProjectForgeProject,
    type ProjectForgeRepository,
  } from "../../projects/index.js";
  import CommunityRelativeTime from "../community-relative-time/CommunityRelativeTime.svelte";
  import CommunityProjectsGitAuthorAvatar from "./CommunityProjectsGitAuthorAvatar.svelte";
  import CommunityProjectsRepositorySections from "./CommunityProjectsRepositorySections.svelte";

  let {
    commits = [],
    commitActivity = [],
    commitBranch = "",
    selectedProject,
    selectedRepository,
    repositories = [],
    onSelectCommit,
    onCopyCommit,
  }: {
    commits?: readonly ProjectForgeCommit[] | undefined;
    commitActivity?: readonly ProjectForgeCommitActivity[] | undefined;
    commitBranch?: string | undefined;
    selectedProject?: ProjectForgeProject | undefined;
    selectedRepository?: ProjectForgeRepository | undefined;
    repositories?: readonly ProjectForgeRepository[] | undefined;
    onSelectCommit?: ((commit: ProjectForgeCommit) => void) | undefined;
    onCopyCommit?: ((sha: string) => void) | undefined;
  } = $props();

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
      onclick={() => onCopyCommit?.(commit.sha)}><CopyIcon aria-hidden="true" /></Button
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
        {#each grouped.find((group) => group.repository.address.coordinate === repository.address.coordinate)?.items ?? [] as entry (entry.commit.sha)}
          {@render commitRow(entry.commit)}
        {/each}
      </div>
    {/snippet}
  </CommunityProjectsRepositorySections>
{:else}
  <div class="community-projects__commit-list">
    {#each commits as commit (commit.sha)}
      {@render commitRow(commit)}
    {:else}
      <p class="community-projects__status">
        No repository commit history is available.
      </p>
    {/each}
  </div>
{/if}
