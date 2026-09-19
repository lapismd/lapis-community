<script lang="ts">
  import type { Component } from "svelte";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import CircleCheckIcon from "@lucide/svelte/icons/circle-check";
  import CircleDotIcon from "@lucide/svelte/icons/circle-dot";

  import {
    isActiveProjectTask,
    isCompletedProjectTask,
    isMergedProjectReview,
    isOpenProjectReview,
    type ProjectReviewListFilter,
    type ProjectTaskListFilter,
  } from "../../projects/collection-filters.js";

  let {
    kind,
    items,
    value,
    onSelect,
  }: {
    kind: "tasks" | "reviews";
    items: readonly { lifecycle: string }[];
    value: ProjectTaskListFilter | ProjectReviewListFilter;
    onSelect: (label: string) => void;
  } = $props();

  const options = $derived(
    kind === "tasks"
      ? [
          {
            label: "Active",
            value: "active",
            count: items.filter((item) => isActiveProjectTask(item.lifecycle))
              .length,
            Icon: CircleDotIcon,
          },
          {
            label: "Completed",
            value: "completed",
            count: items.filter((item) =>
              isCompletedProjectTask(item.lifecycle),
            ).length,
            Icon: CircleCheckIcon,
          },
        ]
      : [
          {
            label: "Open",
            value: "open",
            count: items.filter((item) => isOpenProjectReview(item.lifecycle))
              .length,
            Icon: CircleDotIcon,
          },
          {
            label: "Merged",
            value: "merged",
            count: items.filter((item) => isMergedProjectReview(item.lifecycle))
              .length,
            Icon: CircleCheckIcon,
          },
        ],
  );
</script>

{#each options as option (option.label)}
  {@const pressed = value === option.value}
  {@const Icon = option.Icon as Component}
  <Button
    type="button"
    variant="ghost"
    class="community-application__project-overview-item community-projects-rail-status-filter"
    data-active={pressed ? "" : undefined}
    aria-pressed={pressed}
    onclick={() => onSelect(option.label)}
  >
    <Icon data-icon="inline-start" aria-hidden="true" />
    <span>{option.label}</span>
    <span class="community-application__project-overview-count">{option.count}</span>
  </Button>
{/each}

<style>
  :global(
      .community-application__project-overview-item.community-projects-rail-status-filter[data-ui-component="button"]:hover:not(
          :disabled
        ):not([aria-pressed="true"])
    ) {
    background-color: transparent;
  }
</style>
