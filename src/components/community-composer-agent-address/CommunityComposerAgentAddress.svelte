<script lang="ts">
  import BriefcaseIcon from "@lucide/svelte/icons/briefcase";
  import XIcon from "@lucide/svelte/icons/x";

  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import type { CommunityMemberModel } from "../community-workspace/model.js";

  let {
    members,
    onDismiss,
  }: {
    members: readonly CommunityMemberModel[];
    onDismiss: (pubkey: string) => void;
  } = $props();
</script>

{#if members.length > 0}
  <div
    class="community-composer-agent-address"
    data-ui-component="community-composer-agent-address"
    data-ui-part="agent-address"
  >
    {#each members as member (member.id)}
      <CommunityChip
        size="compact"
        variant="muted"
        ariaLabel={`Addressed agent ${member.name}`}
      >
        {#snippet leading()}
          <BriefcaseIcon aria-hidden="true" />
        {/snippet}
        {member.name}
        <button
          type="button"
          class="community-composer-agent-address__dismiss"
          aria-label={`Stop addressing ${member.name}`}
          onclick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDismiss(member.id);
          }}
        >
          <XIcon aria-hidden="true" />
        </button>
      </CommunityChip>
    {/each}
  </div>
{/if}

<style>
  .community-composer-agent-address {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    padding-inline: 0.15rem;
  }

  .community-composer-agent-address__dismiss {
    display: inline-grid;
    width: 1.1rem;
    height: 1.1rem;
    margin-inline-start: 0.1rem;
    place-items: center;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: inherit;
    cursor: pointer;
  }

  .community-composer-agent-address__dismiss :global(svg) {
    width: 0.75rem;
    height: 0.75rem;
  }
</style>
