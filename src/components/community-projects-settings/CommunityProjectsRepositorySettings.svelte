<script lang="ts">
  import type { ProjectForgeRepositoryCapabilities } from "../../projects/model.js";
  import type { OwnersDocument } from "../../projects/owners.js";
  import {
    ownersSummary,
    repositoryProtectionSummary,
  } from "./community-projects-settings.js";

  let {
    capabilities,
    owners,
  }: {
    capabilities?: ProjectForgeRepositoryCapabilities | undefined;
    owners?: OwnersDocument | undefined;
  } = $props();

  const protection = $derived(repositoryProtectionSummary(capabilities));
</script>

<section
  class="community-projects-settings"
  aria-label="Repository permissions"
>
  <h2>Permissions</h2>
  <p>
    Channel creator, administrators, and members with the Maintainer role can
    create repositories and review or merge pull requests. Assign those roles
    from channel People.
  </p>
  <h2>Branch protection</h2>
  {#if protection.githubAuthoritative}
    <p>
      Clone, push, and branch protection stay on GitHub for this repository. The
      relay still requires a channel maintainer to create, review, and merge
      Nostr collaboration events.
    </p>
  {:else}
    <dl>
      <div>
        <dt>Default branch</dt>
        <dd>{protection.defaultBranch}</dd>
      </div>
      <div>
        <dt>Protected ref</dt>
        <dd>{protection.protectedRef}</dd>
      </div>
      <div>
        <dt>Pull requests required</dt>
        <dd>{protection.pullRequestsRequired ? "Yes" : "No"}</dd>
      </div>
      <div>
        <dt>Who can merge</dt>
        <dd>{protection.mergeActors}</dd>
      </div>
    </dl>
  {/if}
  <h2>OWNERS.md</h2>
  <p>{ownersSummary(owners)}</p>
</section>

<style>
  .community-projects-settings {
    display: grid;
    gap: 0.75rem;
    margin-block-end: 1.5rem;
    max-width: 48rem;
    text-align: start;
  }

  h2 {
    margin: 0;
    font: inherit;
    font-weight: 600;
  }

  p,
  dd {
    margin: 0;
    color: var(--muted-foreground);
  }

  dl {
    display: grid;
    gap: 0.5rem;
    margin: 0;
  }

  dt {
    font-weight: 600;
  }
</style>
