<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";

  import type { ProjectForgeRepositoryCapabilities } from "../../projects/model.js";
  import type { OwnersDocument } from "../../projects/owners.js";
  import CommunityProjectsBranchProtection from "./CommunityProjectsBranchProtection.svelte";
  import {
    ownersFileHelp,
    ownersSummary,
    peopleChannelAction,
  } from "./community-projects-settings.js";

  let {
    capabilities,
    owners,
    peopleChannelName,
    onOpenPeople,
  }: {
    capabilities?: ProjectForgeRepositoryCapabilities | undefined;
    owners?: OwnersDocument | undefined;
    peopleChannelName?: string | undefined;
    onOpenPeople?: (() => void) | undefined;
  } = $props();

  const peopleAction = $derived(peopleChannelAction(peopleChannelName));
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
  {#if peopleAction && onOpenPeople}
    <Button type="button" variant="outline" size="sm" onclick={onOpenPeople}>
      {peopleAction}
    </Button>
  {/if}
  <h2>Branch protection</h2>
  <CommunityProjectsBranchProtection {capabilities} />
  <h2>OWNERS.md</h2>
  <p>{ownersFileHelp()}</p>
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

  p {
    margin: 0;
    color: var(--muted-foreground);
  }
</style>
