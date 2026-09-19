<script lang="ts">
  import type { Component } from "svelte";
  import { Button } from "@lapismd/design-core/shadcn/button";

  import CommunityProjectsRevisionGraphIds from "./CommunityProjectsRevisionGraphIds.svelte";

  let {
    icon: Icon,
    sha = "",
    onSelect,
  }: {
    icon: Component;
    sha?: string | undefined;
    onSelect?: (() => void) | undefined;
  } = $props();
</script>

<div class="community-projects-repository-rail-latest">
  {#if onSelect}
    <Button
      type="button"
      variant="ghost"
      class="community-application__project-overview-item community-projects-repository-rail-latest__label"
      onclick={onSelect}
    >
      <Icon data-icon="inline-start" aria-hidden="true" />
      <span>Latest</span>
    </Button>
  {:else}
    <div
      class="community-application__project-overview-item community-projects-repository-rail-latest__label"
    >
      <Icon data-icon="inline-start" aria-hidden="true" />
      <span>Latest</span>
    </div>
  {/if}
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

  .community-projects-repository-rail-latest__label:not(
      [data-ui-component="button"]
    ) {
    display: grid;
    width: 100%;
    height: 1.75rem;
    grid-template-columns: 0.875rem minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.75rem;
    padding-inline: 0.5rem;
    color: var(--muted-foreground);
    font-size: var(--community-text-body);
    font-weight: 400;
    line-height: 1.25rem;
    background-color: transparent;
  }

  .community-projects-repository-rail-latest__label:not(
      [data-ui-component="button"]
    )
    :global(svg) {
    width: 0.875rem;
    height: 0.875rem;
  }

  :global(
      .community-projects-repository-rail-latest
        .community-projects-repository-rail-latest__label[data-ui-component="button"]
    ),
  :global(
      .community-projects-repository-rail-latest
        .community-projects-repository-rail-latest__label[data-ui-component="button"]:hover
    ),
  :global(
      .community-projects-repository-rail-latest
        .community-projects-repository-rail-latest__label[data-ui-component="button"]:focus-visible
    ) {
    background-color: transparent;
  }
</style>
