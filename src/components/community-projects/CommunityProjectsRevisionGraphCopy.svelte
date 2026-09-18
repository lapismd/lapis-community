<script lang="ts">
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityRelativeTime from "../community-relative-time/CommunityRelativeTime.svelte";
  import type { RepositoryLogGraphRow } from "../../projects/repository-log-graph.js";
  import CommunityProjectsGitAuthorAvatar from "./CommunityProjectsGitAuthorAvatar.svelte";
  import CommunityProjectsRevisionGraphMessage from "./CommunityProjectsRevisionGraphMessage.svelte";

  let { row }: { row: RepositoryLogGraphRow } = $props();
</script>

<span class="community-revision-graph-copy">
  <CommunityProjectsGitAuthorAvatar
    email={row.revision.authorEmail}
    name={row.revision.author}
    size="small"
  />
  <span class="community-revision-graph-copy__body">
    <CommunityProjectsRevisionGraphMessage message={row.revision.message} />
    <span class="community-revision-graph-copy__meta">
      <CommunityRelativeTime timestamp={row.revision.createdAt} />
    </span>
    {#if row.revision.reason === "merge" || row.deviceAliases.length > 0}
      <span class="community-revision-graph-copy__chips">
        {#if row.revision.reason === "merge"}
          <CommunityChip size="compact" variant="muted" ariaHidden
            >Merge</CommunityChip
          >
        {/if}
        {#each row.deviceAliases as alias (alias)}
          <CommunityChip size="compact" variant="outline" ariaHidden
            >{alias}</CommunityChip
          >
        {/each}
      </span>
    {/if}
  </span>
</span>

<style>
  .community-revision-graph-copy {
    display: flex;
    min-width: 0;
    flex: 1 1 auto;
    align-items: center;
    gap: 0.55rem;
  }

  .community-revision-graph-copy__body {
    display: flex;
    min-width: 0;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 0.15rem;
  }

  .community-revision-graph-copy__meta {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
  }

  .community-revision-graph-copy__chips {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3rem;
  }
</style>
