<script lang="ts">
  import type { Snippet } from "svelte";
  import * as Collapsible from "@lapismd/design-core/shadcn/collapsible";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import ListTodoIcon from "@lucide/svelte/icons/list-todo";

  import {
    encodeProjectListCursor,
    type ProjectForgeRepository,
    type ProjectTaskState,
  } from "../../projects/index.js";
  import CommunityProjectsRepositorySections from "./CommunityProjectsRepositorySections.svelte";
  import CommunityProjectsVirtualRows from "./CommunityProjectsVirtualRows.svelte";
  import { estimateCommunityProjectRow } from "./virtual-project-row-estimates.js";

  let {
    scopedTasks = [],
    mineTasks = [],
    otherTasks = [],
    taskRepositorySections = [],
    groupByRepository = false,
    listLayout = "list",
    selectedRepository = false,
    selectedProject = false,
    mineTasksOpen = $bindable(true),
    otherTasksOpen = $bindable(true),
    row,
    loading = false,
    hasMore = false,
    onLoadMore,
    onVisibleCursorChange,
  }: {
    scopedTasks?: readonly ProjectTaskState[] | undefined;
    mineTasks?: readonly ProjectTaskState[] | undefined;
    otherTasks?: readonly ProjectTaskState[] | undefined;
    taskRepositorySections?: readonly {
      repository: ProjectForgeRepository;
      items: readonly ProjectTaskState[];
    }[];
    groupByRepository?: boolean | undefined;
    listLayout?: "grid" | "list" | undefined;
    selectedRepository?: boolean | undefined;
    selectedProject?: boolean | undefined;
    mineTasksOpen?: boolean | undefined;
    otherTasksOpen?: boolean | undefined;
    row: Snippet<[ProjectTaskState]>;
    loading?: boolean | undefined;
    hasMore?: boolean | undefined;
    onLoadMore?: (() => void) | undefined;
    onVisibleCursorChange?: ((cursor: string | undefined) => void) | undefined;
  } = $props();

  function taskEstimate(task: ProjectTaskState | undefined): number {
    return estimateCommunityProjectRow(
      task
        ? { kind: "task", text: task.title, detail: task.content }
        : undefined,
    );
  }

  function taskCursor(task: ProjectTaskState): string | undefined {
    return encodeProjectListCursor(
      /^[a-f0-9]{64}$/u.test(task.root.id)
        ? { kind: "event", createdAt: task.updatedAt, eventId: task.root.id }
        : { kind: "row", id: task.root.id },
    );
  }
</script>

{#snippet taskRows(tasks: readonly ProjectTaskState[])}
  <div class="community-projects__task-list" data-layout={listLayout}>
    <CommunityProjectsVirtualRows
      rows={tasks}
      {row}
      estimateSize={taskEstimate}
      cursorForRow={taskCursor}
      getKey={(task) => task.root.id}
      {loading}
      {hasMore}
      {onLoadMore}
      {onVisibleCursorChange}
    />
  </div>
{/snippet}

{#if groupByRepository}
  <CommunityProjectsRepositorySections
    sections={taskRepositorySections.map((group) => ({
      repository: group.repository,
      count: group.items.length,
    }))}
    empty="No tasks in this project."
  >
    {#snippet children(repository)}
      {@const tasks = scopedTasks.filter(
        (task) => task.repository.coordinate === repository.address.coordinate,
      )}
      {@render taskRows(tasks)}
    {/snippet}
  </CommunityProjectsRepositorySections>
{:else if mineTasks.length > 0 || otherTasks.length > 0}
  <div class="community-projects__collection-groups">
    {#if mineTasks.length > 0}
      <Collapsible.Root
        class="community-projects__collection-group"
        bind:open={mineTasksOpen}
      >
        <Collapsible.Trigger class="community-projects__list-group-heading">
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
        <Collapsible.Content>{@render taskRows(mineTasks)}</Collapsible.Content>
      </Collapsible.Root>
    {/if}
    {#if otherTasks.length > 0}
      <Collapsible.Root
        class="community-projects__collection-group"
        bind:open={otherTasksOpen}
      >
        <Collapsible.Trigger class="community-projects__list-group-heading">
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
        <Collapsible.Content>{@render taskRows(otherTasks)}</Collapsible.Content
        >
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
