<script lang="ts">
  import type { Component } from "svelte";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as CommandView from "@lapismd/design-core/shadcn/command-view";
  import * as Popover from "@lapismd/design-core/shadcn/popover";
  import CheckIcon from "@lucide/svelte/icons/check";
  import CircleDotIcon from "@lucide/svelte/icons/circle-dot";
  import FolderGit2Icon from "@lucide/svelte/icons/folder-git-2";
  import FolderKanbanIcon from "@lucide/svelte/icons/folder-kanban";
  import GitCommitHorizontalIcon from "@lucide/svelte/icons/git-commit-horizontal";
  import GitPullRequestIcon from "@lucide/svelte/icons/git-pull-request";
  import ListFilterIcon from "@lucide/svelte/icons/list-filter";
  import MessageSquareIcon from "@lucide/svelte/icons/message-square";
  import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";
  import UserPlusIcon from "@lucide/svelte/icons/user-plus";
  import XIcon from "@lucide/svelte/icons/x";

  import {
    PROJECT_ACTIVITY_FILTER_DEFAULT,
    PROJECT_ACTIVITY_FILTERS,
    type ProjectActivityFilterId,
  } from "../../projects/activity-filters.js";

  const filterIcons = {
    all: ListFilterIcon,
    project: FolderKanbanIcon,
    repository: FolderGit2Icon,
    task: CircleDotIcon,
    assignment: UserPlusIcon,
    comment: MessageSquareIcon,
    review: GitPullRequestIcon,
    "review-update": GitCommitHorizontalIcon,
    approval: CheckIcon,
    "changes-requested": TriangleAlertIcon,
    "review-request": UserPlusIcon,
    commit: GitCommitHorizontalIcon,
  } satisfies Record<ProjectActivityFilterId, Component>;

  let {
    value = PROJECT_ACTIVITY_FILTER_DEFAULT,
    onSelect,
  }: {
    value?: ProjectActivityFilterId | undefined;
    onSelect: (value: ProjectActivityFilterId) => void;
  } = $props();

  let open = $state(false);
  let query = $state("");

  function handleOpen(next: boolean): void {
    open = next;
    if (next) query = "";
  }

  function choose(id: ProjectActivityFilterId): void {
    handleOpen(false);
    onSelect(id);
  }
</script>

<Popover.Root {open} onOpenChange={handleOpen}>
  <Popover.Trigger>
    {#snippet child({ props })}
      <Button
        {...props}
        type="button"
        variant="ghost"
        size="icon-sm"
        class="community-projects__activity-filter"
        aria-label="Filter activity"
        title="Filter activity"
        data-active={value === PROJECT_ACTIVITY_FILTER_DEFAULT ? undefined : ""}
        aria-pressed={value !== PROJECT_ACTIVITY_FILTER_DEFAULT}
      >
        <ListFilterIcon aria-hidden="true" />
      </Button>
    {/snippet}
  </Popover.Trigger>
  <Popover.Content
    class="community-projects-activity-filter"
    align="end"
    style="--ui-popover-width: 22rem; --ui-popover-padding: 0.5rem 0.75rem 0.625rem; --ui-popover-gap: 0.25rem"
  >
    <Popover.Header class="community-projects-activity-filter__header">
      <Popover.Title
        class="community-projects-activity-filter__title"
        role="heading"
        aria-level={2}>Filter activity</Popover.Title
      >
      <Popover.Close>
        {#snippet child({ props })}
          <Button
            {...props}
            variant="ghost"
            size="icon-sm"
            aria-label="Close activity filter"
          >
            <XIcon />
            <span class="sr-only">Close</span>
          </Button>
        {/snippet}
      </Popover.Close>
    </Popover.Header>
    <CommandView.Root label="Filter activity">
      <CommandView.Input
        bind:value={query}
        placeholder="Find an event type..."
        aria-label="Find an event type"
      />
      <CommandView.List>
        <CommandView.Empty>No matching event types</CommandView.Empty>
        <CommandView.Group heading="Relay event types">
          {#each PROJECT_ACTIVITY_FILTERS as option (option.id)}
            {@const Icon = filterIcons[option.id]}
            <CommandView.Item
              value={`${option.label} ${option.description}`}
              onSelect={() => choose(option.id)}
            >
              <CommandView.ItemIcon data-activity-kind={option.id}>
                <Icon aria-hidden="true" />
              </CommandView.ItemIcon>
              <CommandView.ItemLabel>{option.label}</CommandView.ItemLabel>
              <CommandView.ItemDescription
                >{option.description}</CommandView.ItemDescription
              >
              {#if option.id === value}
                <span data-ui-component="command-view" data-ui-part="trailing">
                  <CheckIcon aria-hidden="true" />
                </span>
              {/if}
            </CommandView.Item>
          {/each}
        </CommandView.Group>
      </CommandView.List>
    </CommandView.Root>
  </Popover.Content>
</Popover.Root>

<style>
  :global(
      .community-projects-activity-filter__header[data-ui-part="popover-header"]
    ) {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 0.25rem;
    min-height: 0;
    padding: 0;
    margin: 0;
  }

  :global(
      .community-projects-activity-filter__title[data-ui-part="popover-title"]
    ) {
    margin: 0;
    font-weight: var(--font-weight-bold, 700);
    line-height: 1.2;
  }

  :global(.community-projects-activity-filter[data-ui-part="popover-content"]) {
    --ui-command-view-list-max-height: min(22rem, 50dvh);
    --ui-command-view-list-padding: 0.25rem;
    --ui-command-view-gap: 0.25rem;
  }

  :global(
      .community-projects-activity-filter
        [data-activity-kind="project"]
        > svg,
      .community-projects-activity-filter
        [data-activity-kind="repository"]
        > svg,
      .community-projects-activity-filter [data-activity-kind="commit"] > svg,
      .community-projects-activity-filter
        [data-activity-kind="review-update"]
        > svg
    ) {
    color: var(--primary);
  }

  :global(
      .community-projects-activity-filter [data-activity-kind="review"] > svg,
      .community-projects-activity-filter [data-activity-kind="approval"] > svg
    ) {
    color: var(--success, #16a34a);
  }

  :global(.community-projects-activity-filter [data-activity-kind="task"] > svg) {
    color: var(--warning, #f97316);
  }

  :global(
      .community-projects-activity-filter
        [data-activity-kind="changes-requested"]
        > svg
    ) {
    color: #d97706;
  }

  :global(
      .community-projects-activity-filter
        [data-activity-kind="review-request"]
        > svg,
      .community-projects-activity-filter
        [data-activity-kind="assignment"]
        > svg
    ) {
    color: #2563eb;
  }

  :global(
      .community-projects-activity-filter [data-activity-kind="comment"] > svg
    ) {
    color: var(--muted-foreground);
  }
</style>
