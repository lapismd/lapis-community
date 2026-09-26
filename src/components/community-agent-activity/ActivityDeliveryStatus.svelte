<script lang="ts">
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import type { CommunityAgentControllerScope } from "../../community/agent-controller-turn.js";

  let { scope }: { scope: CommunityAgentControllerScope } = $props();
</script>

{#if scope.replyDelivery || scope.checkpointSync}
  <div class="delivery-status" aria-label="Turn delivery status">
    {#if scope.replyDelivery}<CommunityChip
        size="compact"
        tone={scope.replyDelivery === "pending" ? "warning" : "neutral"}
        >{scope.replyDelivery === "pending"
          ? "Reply delivery pending"
          : "Reply delivered"}</CommunityChip
      >{/if}
    {#if scope.checkpointSync}<CommunityChip
        size="compact"
        tone={scope.checkpointSync === "pending" ? "warning" : "neutral"}
        >{scope.checkpointSync === "pending"
          ? "Checkpoint sync pending"
          : "Checkpoint synced"}</CommunityChip
      >{/if}
  </div>
{/if}

<style>
  .delivery-status {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }
</style>
