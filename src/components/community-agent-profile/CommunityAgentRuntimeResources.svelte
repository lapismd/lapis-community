<script lang="ts">
  import type { CommunityAgentRuntimeState } from "../../community/agent-runtime-contracts.js";
  import CommunityChip from "../community-chip/CommunityChip.svelte";

  let { runtime }: { runtime: CommunityAgentRuntimeState } = $props();
  const resources = $derived(runtime.resources);
  const available = $derived(
    resources?.status !== "unavailable" && resources !== undefined,
  );
  const total = $derived(
    resources
      ? Object.values(resources.workers).reduce((sum, count) => sum + count, 0)
      : 0,
  );
  const ram = $derived(
    resources?.rssBytes === null || resources?.rssBytes === undefined
      ? null
      : `${(resources.rssBytes / 1024 / 1024).toFixed(1)} MiB`,
  );
</script>

<div class="resource-row">
  <dt>Workers (shared)</dt>
  <dd>
    {#if available && resources}
      {total} · {resources.workers.busy} busy, {resources.workers.idle} idle,
      {resources.workers.starting} starting, {resources.workers.stopping} stopping
    {:else}
      <CommunityChip size="compact" tone="warning">Unavailable</CommunityChip>
    {/if}
  </dd>
</div>
<div class="resource-row">
  <dt>Worker RAM (shared)</dt>
  <dd>
    {#if ram}{ram}{:else}<CommunityChip size="compact" tone="warning"
        >Unavailable</CommunityChip
      >{/if}
    {#if resources?.status === "partial"}
      <CommunityChip size="compact" tone="warning">Partial sample</CommunityChip
      >
    {/if}
  </dd>
</div>
<div class="resource-row">
  <dt>Retained sessions (shared)</dt>
  <dd>{available && resources ? resources.sessions : "Unavailable"}</dd>
</div>
<div class="resource-row">
  <dt>Saved memory candidates</dt>
  <dd>
    {runtime.memory.enabled
      ? `${runtime.memory.candidates} candidate${runtime.memory.candidates === 1 ? "" : "s"}`
      : "Disabled"}
  </dd>
</div>

<style>
  .resource-row {
    display: grid;
    grid-template-columns: minmax(5rem, 0.7fr) minmax(0, 1.3fr);
    gap: 1rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--border);
  }
  dt {
    color: var(--muted-foreground);
  }
  dd {
    min-width: 0;
    margin: 0;
    text-align: right;
    overflow-wrap: anywhere;
  }
  dd :global([data-ui-component="community-chip"]) {
    margin-left: 0.35rem;
  }
</style>
