<script lang="ts">
  import type { Component } from "svelte";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import CircleDotIcon from "@lucide/svelte/icons/circle-dot";
  import MessageCircleIcon from "@lucide/svelte/icons/message-circle";
  import UsersIcon from "@lucide/svelte/icons/users";

  import CommunityEntityCopyButton from "../community-entity-chip/CommunityEntityCopyButton.svelte";
  import { communityTaskLink } from "./task-link.js";

  let {
    task,
  }: {
    task: {
      lifecycle: string;
      assignees: readonly string[];
      activity: readonly { assignment?: string; event: { content: string } }[];
      repository: { coordinate: string };
      root: { id: string };
    };
  } = $props();

  const link = $derived(
    communityTaskLink(task.repository.coordinate, task.root.id),
  );
  const status = $derived(
    task.lifecycle === "applied"
      ? "Done"
      : task.lifecycle[0]!.toUpperCase() + task.lifecycle.slice(1),
  );
  const comments = $derived(
    task.activity.filter(
      (entry) => !entry.assignment && entry.event.content.trim() !== "",
    ).length,
  );
</script>

{#snippet detail(Icon: Component, label: string, value: string | number)}
  <Button
    type="button"
    variant="ghost"
    class="community-application__project-overview-item"
  >
    <Icon data-icon="inline-start" aria-hidden="true" />
    <span>{label}</span>
    <span
      class="community-application__project-overview-count"
      title={String(value)}>{value}</span
    >
  </Button>
{/snippet}

{@render detail(CircleDotIcon, "Status", status)}
{@render detail(UsersIcon, "Assignees", task.assignees.length)}
{@render detail(MessageCircleIcon, "Comments", comments)}
{#if link}
  <CommunityEntityCopyButton
    class="community-application__project-overview-item"
    label="Copy Link"
    success="Task link copied"
    href={link}
  />
{/if}
