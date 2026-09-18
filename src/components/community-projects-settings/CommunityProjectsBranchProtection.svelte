<script lang="ts">
  import type { ProjectForgeRepositoryCapabilities } from "../../projects/model.js";
  import { protectedRefPatternsHelp } from "../../projects/protected-refs.js";
  import { repositoryProtectionSummary } from "./community-projects-settings.js";

  let {
    capabilities,
  }: {
    capabilities?: ProjectForgeRepositoryCapabilities | undefined;
  } = $props();

  const protection = $derived(repositoryProtectionSummary(capabilities));
</script>

{#if protection.githubAuthoritative}
  <p>
    Clone, push, and branch protection stay on GitHub for this repository. The
    relay still requires a channel maintainer to create, review, and merge Nostr
    collaboration events.
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
      <dt>Extra protected refs</dt>
      <dd>
        {#if protection.protectedPatterns.length > 0}
          {protection.protectedPatterns.join(", ")}
        {:else}
          None. The live default branch stays protected.
        {/if}
      </dd>
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
  <p>{protectedRefPatternsHelp()}</p>
{/if}

<style>
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
