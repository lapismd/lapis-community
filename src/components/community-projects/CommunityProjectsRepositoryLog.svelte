<script lang="ts">
  import * as Empty from "@lapismd/design-core/shadcn/empty";
  import GitCommitHorizontalIcon from "@lucide/svelte/icons/git-commit-horizontal";
  import { Skeleton } from "@lapismd/design-core/shadcn/skeleton";

  import type { NostrEvent } from "../../protocol/index.js";
  import { buildRepositoryLog } from "../../projects/repository-log.js";
  import CommunityProjectsRevisionGraph from "./CommunityProjectsRevisionGraph.svelte";

  let {
    events = [],
    loading = false,
  }: {
    events?: readonly NostrEvent[] | undefined;
    loading?: boolean | undefined;
  } = $props();

  const graph = $derived(buildRepositoryLog(events));
</script>

<section class="community-projects-repository-log" aria-label="Repository log">
  {#if loading && graph.revisions.length === 0}
    <div class="community-projects-repository-log__skeleton" aria-busy="true">
      <span class="sr-only">Loading repository log</span>
      <Skeleton />
      <Skeleton />
      <Skeleton />
    </div>
  {:else if graph.revisions.length === 0}
    <Empty.Root class="community-projects__empty">
      <Empty.Header>
        <Empty.Media variant="icon"
          ><GitCommitHorizontalIcon aria-hidden="true" /></Empty.Media
        >
        <Empty.Title>No projection yet</Empty.Title>
        <Empty.Description>
          Repository Log appears after jj-nostr publishes kinds 3902 and 3903
          for this repository. Commits still shows dest-Git history.
        </Empty.Description>
      </Empty.Header>
    </Empty.Root>
  {:else}
    <CommunityProjectsRevisionGraph
      revisions={graph.revisions}
      devices={graph.devices}
    />
  {/if}
</section>

<style>
  .community-projects-repository-log {
    display: flex;
    min-height: 0;
    flex: 1 1 auto;
    flex-direction: column;
    overflow: auto;
  }

  .community-projects-repository-log__skeleton {
    display: grid;
    gap: 0.75rem;
    padding: 1rem;
  }
</style>
