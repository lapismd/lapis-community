<script lang="ts">
  import { Reasoning } from "@lapismd/design-core/ai/experimental";
  import CommunityRelativeTime from "../community-relative-time/CommunityRelativeTime.svelte";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import RotateCwIcon from "@lucide/svelte/icons/rotate-cw";
  import type { CommunityRuntimeRefreshState } from "../../community/agent-runtime-snapshot-protocol.js";
  let {
    state,
    pending = false,
    connected = true,
    onRefresh,
  }: {
    state?: CommunityRuntimeRefreshState | undefined;
    pending?: boolean;
    connected?: boolean;
    onRefresh: () => Promise<void>;
  } = $props();
  const refreshing = $derived(pending || state?.status === "pending");
</script>

<div class="runtime-refresh">
  <div>
    <h3>Runtime</h3>
    <p>Harness settings apply to the next agent session.</p>
  </div>
  <Button
    variant="outline"
    size="icon-sm"
    aria-label="Refresh runtime details"
    disabled={!connected || refreshing}
    onclick={onRefresh}><RotateCwIcon aria-hidden="true" /></Button
  >
</div>
{#if state?.observedAt}<p>
    Last updated <CommunityRelativeTime timestamp={state.observedAt / 1_000} />
  </p>{/if}
{#if refreshing}<Reasoning label="Refreshing runtime details…" streaming />
{:else if state?.status === "timed-out"}<p role="status">
    No response within thirty seconds. Refresh to retry. Last-known details are
    retained.
  </p>
{:else if state?.status === "error"}<p role="alert">
    {state.error ?? "Runtime details could not be refreshed."}
  </p>{/if}

<style>
  .runtime-refresh {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }
  h3 {
    margin: 0;
  }
  p {
    color: var(--muted-foreground);
  }
</style>
