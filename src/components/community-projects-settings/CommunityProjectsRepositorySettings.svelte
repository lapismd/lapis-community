<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import UserPlusIcon from "@lucide/svelte/icons/user-plus";

  import type { ProjectForgeRepositoryCapabilities } from "../../projects/model.js";
  import type { ProjectForgeProtectionDocumentInput } from "../../projects/protection-document.js";
  import type { OwnersDocument } from "../../projects/owners.js";
  import CommunityProjectsBranchProtection from "./CommunityProjectsBranchProtection.svelte";
  import {
    ownersSummary,
    peopleChannelAction,
  } from "./community-projects-settings.js";

  let {
    capabilities,
    owners,
    members = [],
    peopleChannelName,
    canMaintain = false,
    onOpenPeople,
    onSaveProtection,
  }: {
    capabilities?: ProjectForgeRepositoryCapabilities | undefined;
    owners?: OwnersDocument | undefined;
    members?: readonly import("../community-workspace/model.js").CommunityMemberModel[] | undefined;
    peopleChannelName?: string | undefined;
    canMaintain?: boolean | undefined;
    onOpenPeople?: (() => void) | undefined;
    onSaveProtection?:
      | ((input: ProjectForgeProtectionDocumentInput) => Promise<void>)
      | undefined;
  } = $props();

  const peopleAction = $derived(peopleChannelAction(peopleChannelName));
</script>

<section
  class="community-projects-settings"
  aria-label="Repository permissions"
>
  <h2>Permissions</h2>
  {#if peopleAction && onOpenPeople}
    <Button type="button" variant="outline" size="sm" onclick={onOpenPeople}
      ><UserPlusIcon data-icon="inline-start" aria-hidden="true" />{peopleAction}</Button>
  {/if}
  <h2>Branch protection</h2>
  {#key JSON.stringify(capabilities?.protection)}
    <CommunityProjectsBranchProtection
      {capabilities}
      {members}
      {canMaintain}
      {onSaveProtection}
    />
  {/key}
  <h2>OWNERS.md</h2>
  <p>{ownersSummary(owners)}</p>
</section>

<style>
  .community-projects-settings {
    display: grid;
    justify-items: start;
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
