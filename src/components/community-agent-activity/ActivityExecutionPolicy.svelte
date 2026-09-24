<script lang="ts">
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import {
    approvalPolicyLabel,
    type AgentExecutionPolicy,
  } from "../../community/agent-execution-policy.js";
  let { policy }: { policy: AgentExecutionPolicy } = $props();
</script>

<div class="execution-policy" aria-label="Turn permission policy">
  <CommunityChip size="compact"
    >Requested: {approvalPolicyLabel(policy.requested)}</CommunityChip
  >
  <CommunityChip size="compact" tone={policy.restricted ? "warning" : "neutral"}
    >Effective: {approvalPolicyLabel(policy.effective)}{policy.restricted
      ? " (restricted session)"
      : ""}</CommunityChip
  >
  {#if policy.nativeMode}
    <CommunityChip
      size="compact"
      tone={policy.nativeMode.status === "applied" ? "neutral" : "warning"}
    >
      Provider mode {policy.nativeMode.requested}: {policy.nativeMode
        .status}{policy.nativeMode.effective
        ? ` (${policy.nativeMode.effective})`
        : ""}
    </CommunityChip>
  {/if}
</div>

<style>
  .execution-policy {
    display: flex;
    gap: 0.375rem;
    flex-wrap: wrap;
  }
</style>
