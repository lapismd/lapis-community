<script lang="ts">
  import type { CommunityAgentControllerScope } from "../../community/agent-contracts.js";
  import ActivityDeliveryStatus from "./ActivityDeliveryStatus.svelte";
  import ActivityExecutionPolicy from "./ActivityExecutionPolicy.svelte";

  let { scope }: { scope: CommunityAgentControllerScope } = $props();
</script>

{#if scope.executionPolicy}<ActivityExecutionPolicy
    policy={scope.executionPolicy}
  />{/if}
<ActivityDeliveryStatus {scope} />
