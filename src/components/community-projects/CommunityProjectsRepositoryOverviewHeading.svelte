<script lang="ts">
  import type { Snippet } from "svelte";

  import CommunityEntityCopyButton from "../community-entity-chip/CommunityEntityCopyButton.svelte";
  import { projectSurfaceTitle } from "../../projects/project-rail.js";
  import CommunityProjectsRepositoryLogRail from "./CommunityProjectsRepositoryLogRail.svelte";

  let {
    surface,
    name,
    plus,
  }: { surface: string; name: string; plus?: Snippet } = $props();
</script>

{#if surface === "log"}
  <CommunityProjectsRepositoryLogRail />
{:else}
  <div class="community-application__project-overview-heading">
    <strong>{projectSurfaceTitle(surface, name)}</strong
    ><CommunityEntityCopyButton success="Link copied" />
    {@render plus?.()}
  </div>
{/if}

<style>
  .community-application__project-overview-heading {
    display: grid;
    min-height: 2rem;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.5rem;
    padding: 0 0.4rem 0.55rem;
    font-size: var(--community-text-secondary);
    font-weight: 500;
  }

  .community-application__project-overview-heading > strong {
    font-weight: 500;
  }

  .community-application__project-overview-heading
    :global(> [data-ui-component="button"]) {
    width: 1.75rem;
    min-width: 1.75rem;
    height: 1.75rem;
    min-height: 1.75rem;
    margin-inline-end: -0.4rem;
  }
</style>
