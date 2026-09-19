<script lang="ts">
  import type { Component } from "svelte";
  import { Button } from "@lapismd/design-core/shadcn/button";

  import CommunityProjectsRevisionGraphIds from "./CommunityProjectsRevisionGraphIds.svelte";

  let {
    icon: Icon,
    sha = "",
    active = false,
    onSelect,
  }: {
    icon: Component;
    sha?: string | undefined;
    active?: boolean | undefined;
    onSelect: () => void;
  } = $props();
</script>

<div class="community-projects-repository-rail-latest">
  <Button
    type="button"
    variant="ghost"
    class="community-application__project-overview-item"
    data-active={active ? "" : undefined}
    aria-current={active ? "page" : undefined}
    onclick={onSelect}
  >
    <Icon data-icon="inline-start" aria-hidden="true" />
    <span>Latest</span>
  </Button>
  {#if sha}
    <CommunityProjectsRevisionGraphIds
      commitId={sha}
      commitLabel="commit ID"
      placement="inline"
    />
  {:else}
    <span class="community-application__project-overview-count">—</span>
  {/if}
</div>

<style>
  .community-projects-repository-rail-latest {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    min-width: 0;
  }

  .community-projects-repository-rail-latest
    :global(.community-revision-graph-ids) {
    flex-shrink: 0;
  }
</style>
