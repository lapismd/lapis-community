<script lang="ts">
  import { untrack, onDestroy } from "svelte";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import type { CommunityAgentProcessingState } from "../../community/agent-contracts.js";

  let {
    agentPubkey,
    state: processing,
    connected = true,
    onLoad,
    onSet,
  }: {
    agentPubkey: string;
    state?: CommunityAgentProcessingState | undefined;
    connected?: boolean;
    onLoad: () => Promise<CommunityAgentProcessingState>;
    onSet: (
      enabled: boolean,
      expectedRevision: number,
    ) => Promise<CommunityAgentProcessingState>;
  } = $props();
  let received = $state<CommunityAgentProcessingState>();
  let pending = $state<"" | "loading" | "enabling" | "disabling">("");
  let error = $state("");
  let loadedAgent = "";
  let generation = 0;
  const current = $derived(
    processing && (!received || processing.revision >= received.revision)
      ? processing
      : received,
  );
  const label = $derived(
    pending === "loading"
      ? "Checking…"
      : pending === "enabling"
        ? "Enabling…"
        : pending === "disabling"
          ? "Disabling…"
          : !current
            ? "Check processing state"
            : current.status !== "applied"
              ? "Retry Disable"
              : current.enabled
                ? "Disable"
                : "Enable",
  );
  $effect(() => {
    const key = agentPubkey;
    untrack(() => {
      if (loadedAgent === key) return;
      loadedAgent = key;
      generation++;
      received = undefined;
      error = "";
      pending = "";
      if (connected) void load();
    });
  });
  onDestroy(() => {
    generation++;
  });
  async function load() {
    const active = generation;
    pending = "loading";
    error = "";
    try {
      const next = await onLoad();
      if (active === generation) received = next;
    } catch (cause) {
      if (active === generation)
        error =
          cause instanceof Error
            ? cause.message
            : "Could not read processing state";
    } finally {
      if (active === generation) pending = "";
    }
  }
  async function change() {
    if (!current) {
      await load();
      return;
    }
    const active = generation;
    const enabled = current.status === "applied" && !current.enabled;
    pending = enabled ? "enabling" : "disabling";
    error = "";
    try {
      const next = await onSet(enabled, current.revision);
      if (active !== generation) return;
      received = next;
      if (
        next.status !== "applied" ||
        next.enabled !== enabled ||
        next.applied === false
      )
        error =
          next.error ??
          "The controller has not applied this change. Check its state and retry.";
    } catch (cause) {
      if (active !== generation) return;
      error =
        cause instanceof Error ? cause.message : "Processing change failed";
      try {
        const latest = await onLoad();
        if (active === generation) received = latest;
      } catch {
        /* Keep the last acknowledged state and retryable error. */
      }
    } finally {
      if (active === generation) pending = "";
    }
  }
</script>

<div class="agent-processing" aria-label="Agent processing">
  <div class="agent-processing__controls">
    <CommunityChip
      size="compact"
      tone={current?.status === "error" ? "danger" : "neutral"}
    >
      {current?.status === "error"
        ? "Cancellation failed"
        : current?.status === "cancelling"
          ? "Cancelling"
          : current?.enabled === false
            ? "Disabled"
            : current?.enabled === true
              ? "Enabled"
              : "Processing unknown"}
    </CommunityChip>
    <Button
      variant="outline"
      size="sm"
      disabled={!connected || !!pending}
      onclick={() => void change()}
      aria-busy={!!pending}>{label}</Button
    >
  </div>
  {#if error || current?.error}<p role="alert">
      {error || current?.error}
    </p>{/if}
</div>

<style>
  .agent-processing {
    display: grid;
    gap: 0.375rem;
  }
  .agent-processing__controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .agent-processing p {
    margin: 0;
    color: var(--muted-foreground);
  }
</style>
