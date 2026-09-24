<script lang="ts">
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import type {
    CommunityAgentIdentity,
    CommunityAgentPermissionDecision,
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
  let error = $state("");

  async function decide(
    permission: (typeof permissions)[number],
    decision: CommunityAgentPermissionDecision,
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
    <CommunityChip size="compact" tone="warning"
      >Waiting for approval</CommunityChip
    >
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
  .activity-permissions > :global(.community-chip) {
    justify-self: end;
  }
</style>
