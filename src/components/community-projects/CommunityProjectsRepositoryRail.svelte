<script lang="ts">
  import type { Component } from "svelte";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import FilesIcon from "@lucide/svelte/icons/files";
  import GitBranchIcon from "@lucide/svelte/icons/git-branch";
  import GitCommitHorizontalIcon from "@lucide/svelte/icons/git-commit-horizontal";
  import GitPullRequestIcon from "@lucide/svelte/icons/git-pull-request";
  import ListTodoIcon from "@lucide/svelte/icons/list-todo";
  import SettingsIcon from "@lucide/svelte/icons/settings";

  import CommunityProjectChannelIcon from "../community-project-channel-icon/CommunityProjectChannelIcon.svelte";
  import {
    PROJECT_REVIEW_LIST_FILTER_DEFAULT,
    PROJECT_TASK_LIST_FILTER_DEFAULT,
    projectRailLabelIsCurrentPage,
    type ProjectReviewListFilter,
    type ProjectTaskListFilter,
  } from "../../projects/collection-filters.js";
  import { projectRailSurface } from "../../projects/project-rail.js";
  import type { ProjectForgeSurface } from "../../projects/surfaces.js";
  import CommunityProjectsRailStatusFilters from "./CommunityProjectsRailStatusFilters.svelte";
  import CommunityProjectsRepositoryLogRail from "./CommunityProjectsRepositoryLogRail.svelte";
  import CommunityProjectsRepositoryRailLatest from "./CommunityProjectsRepositoryRailLatest.svelte";

  let {
    surface,
    channel = "",
    files = 0,
    commits = [],
    tasks = [],
    reviews = [],
    taskFilter = PROJECT_TASK_LIST_FILTER_DEFAULT,
    reviewFilter = PROJECT_REVIEW_LIST_FILTER_DEFAULT,
    showGitHub = false,
    githubConnected = false,
    githubDisabled = false,
    onGitHub,
    onSelect,
  }: {
    surface: ProjectForgeSurface;
    channel?: string | undefined;
    files?: number | undefined;
    commits?: readonly { sha: string }[] | undefined;
    tasks?: readonly { lifecycle: string }[] | undefined;
    reviews?: readonly { lifecycle: string }[] | undefined;
    taskFilter?: ProjectTaskListFilter | undefined;
    reviewFilter?: ProjectReviewListFilter | undefined;
    showGitHub?: boolean | undefined;
    githubConnected?: boolean | undefined;
    githubDisabled?: boolean | undefined;
    onGitHub?: (() => void) | undefined;
    onSelect: (label: string) => void;
  } = $props();

  const latestSha = $derived(commits[0]?.sha ?? "");
  const detailsOpen = $derived(surface === "overview" || surface === "options");

  function itemActive(label: string): boolean {
    return (
      projectRailLabelIsCurrentPage(label) &&
      projectRailSurface(label, "repository") === surface
    );
  }
</script>

{#snippet railStat(Icon: Component, label: string, value: string | number, part?: string)}
  <Button
    type="button"
    variant="ghost"
    class="community-application__project-overview-item"
    data-ui-part={part}
    data-active={itemActive(label) ? "" : undefined}
    aria-current={itemActive(label) ? "page" : undefined}
    onclick={() => onSelect(label)}
  >
    <Icon data-icon="inline-start" aria-hidden="true" />
    <span>{label}</span>
    <span class="community-application__project-overview-count" title={String(value)}
      >{value}</span
    >
  </Button>
{/snippet}

{#if surface === "log" || surface === "oplog"}
  <CommunityProjectsRepositoryLogRail />
{/if}
{#if detailsOpen}
  {#if surface === "overview"}
    {#if showGitHub}
      <Button
        type="button"
        variant="ghost"
        class="community-application__project-overview-action"
        title={githubConnected
          ? "Manage this repository's GitHub App connection"
          : "Connect this repository to a GitHub App installation"}
        disabled={githubDisabled}
        onclick={() => onGitHub?.()}
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
        {githubConnected ? "Manage GitHub App" : "Connect GitHub App"}
      </Button>
    {/if}
  {/if}
  {#if channel}
    <p class="community-application__project-overview-label">Channel</p>
    {@render railStat(CommunityProjectChannelIcon, channel.replace(/^#/, ""), "")}
  {/if}
  <p class="community-application__project-overview-label">Details</p>
  <CommunityProjectsRepositoryRailLatest
    icon={GitCommitHorizontalIcon}
    sha={latestSha}
    onSelect={() => onSelect("Latest")}
  />
  {@render railStat(FilesIcon, "Files", files)}
  {@render railStat(ListTodoIcon, "Tasks", tasks.length)}
  {@render railStat(GitPullRequestIcon, "Reviews", reviews.length)}
{:else if surface === "files"}
  {@render railStat(FilesIcon, "Files", files)}
{:else if surface === "commits"}
  {@render railStat(GitCommitHorizontalIcon, "Commits", commits.length)}
  <CommunityProjectsRepositoryRailLatest icon={GitBranchIcon} sha={latestSha} />
{:else if surface === "tasks"}
  {@render railStat(ListTodoIcon, "Tasks", tasks.length)}
  <CommunityProjectsRailStatusFilters
    kind="tasks"
    items={tasks}
    value={taskFilter}
    {onSelect}
  />
{:else if surface === "reviews"}
  {@render railStat(GitPullRequestIcon, "Reviews", reviews.length)}
  <CommunityProjectsRailStatusFilters
    kind="reviews"
    items={reviews}
    value={reviewFilter}
    {onSelect}
  />
{/if}
{#if detailsOpen}
  {@render railStat(SettingsIcon, "Options", "", "repository-options")}
{/if}

<style>
  .community-application__project-overview-label {
    margin: 0.9rem 0.4rem 0.3rem;
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
  }

  :global(.community-application__project-overview-item[data-ui-component="button"][data-active]),
  :global(.community-application__project-overview-item[data-ui-component="button"]:hover:not(:disabled):not(.community-projects-rail-status-filter):not(.community-projects-repository-rail-latest__label)) { color: var(--muted-foreground); background-color: color-mix(in oklab, currentColor 10%, transparent); }
  :global(.community-application__project-overview-count:empty) { display: none; }
</style>
