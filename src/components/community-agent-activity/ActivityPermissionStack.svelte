<script lang="ts">
  import { untrack } from "svelte";
  import { SvelteSet } from "svelte/reactivity";
  import { toast } from "svelte-sonner";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import type {
    CommunityAgentIdentity,
    CommunityAgentsState,
  } from "../../community/agent-contracts.js";
  import AgentPermissionCard from "./AgentPermissionCard.svelte";
  import type { AgentRuntimeActions } from "./runtime-actions.js";

  let {
    agent,
    permissions,
    onRespondPermission,
  }: {
    agent: CommunityAgentIdentity;
    permissions: CommunityAgentsState["pendingPermissions"][string];
    onRespondPermission?: AgentRuntimeActions["onRespondPermission"];
  } = $props();
  const announced = new SvelteSet<string>();
  let error = $state("");

  $effect(() => {
    const waiting = permissions.map((permission) => permission.requestId);
    const name = agent.name;
    untrack(() => {
      for (const requestId of waiting) {
        if (announced.has(requestId)) continue;
        announced.add(requestId);
        toast.message(`${name} is waiting for your permission`);
      }
    });
  });

  async function decide(
    permission: (typeof permissions)[number],
    decision: string,
  ) {
    if (!onRespondPermission) return;
    error = "";
    try {
      await onRespondPermission(
        agent.pubkey,
        permission.requestId,
        decision,
        permission.channelId,
      );
    } catch (cause) {
      error = cause instanceof Error ? cause.message : "Agent control failed";
    }
  }
</script>

{#if permissions.length > 0}
  <section class="activity-permissions" aria-label="Permission requests">
    <CommunityChip size="compact" tone="warning">Waiting for approval</CommunityChip>
    {#each permissions as permission (permission.requestId)}
      <AgentPermissionCard
        agentName={agent.name}
        {permission}
        disabled={!onRespondPermission}
        onDecide={(decision) => decide(permission, decision)}
      />
    {/each}
    {#if error}<p role="alert">{error}</p>{/if}
  </section>
{/if}

<style>
  .activity-permissions {
    display: grid;
    gap: 0.75rem;
  }
</style>
