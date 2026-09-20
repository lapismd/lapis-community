<script lang="ts">
  import { toast } from "svelte-sonner";
  import { untrack, onDestroy } from "svelte";
  import * as DropdownMenu from "@lapismd/design-core/shadcn/dropdown-menu";
  import PlayIcon from "@lucide/svelte/icons/play";
  import SquareIcon from "@lucide/svelte/icons/square";
  import PowerIcon from "@lucide/svelte/icons/power";
  import RefreshIcon from "@lucide/svelte/icons/refresh-cw";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import { Spinner } from "@lapismd/design-core/shadcn/spinner";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import type { CommunityAgentProcessingState } from "../../community/agent-contracts.js";

  let {
    agentPubkey,
    state: processing,
    connected = true,
    presentation = "compact",
    onLoad,
    onSet,
  }: {
    agentPubkey: string;
    state?: CommunityAgentProcessingState | undefined;
    connected?: boolean;
    presentation?: "compact" | "profile" | "card";
    onLoad: () => Promise<CommunityAgentProcessingState>;
    onSet: (
      enabled: boolean,
      expectedRevision: number,
    ) => Promise<CommunityAgentProcessingState>;
  } = $props();
  let received = $state<CommunityAgentProcessingState>();
  let pending = $state<"" | "loading" | "enabling" | "disabling">("");
  const toastId = $props.id();
  function reportError(message: string) {
    toast.error(message, { id: `agent-processing-${toastId}` });
  }
  let loadedAgent = "";
  let wasConnected = false;
  let generation = 0;
  const current = $derived(
    processing && (!received || processing.revision >= received.revision)
      ? processing
      : received,
  );
  const label = $derived(
    pending === "loading" && !current
      ? "Checking…"
      : pending === "enabling"
        ? "Starting…"
        : pending === "disabling"
          ? "Stopping…"
          : !current
            ? "Agent"
            : current.status !== "applied"
              ? "Retry Stop"
              : current.enabled
                ? "Stop"
                : "Start",
  );
  $effect(() => {
    const key = agentPubkey;
    const ready = connected;
    untrack(() => {
      const changed = loadedAgent !== key;
      const reconnected = ready && !wasConnected;
      wasConnected = ready;
      if (!changed && !reconnected) return;
      loadedAgent = key;
      generation++;
      if (changed) received = undefined;
      pending = "";
      if (ready) void load();
    });
  });
  onDestroy(() => {
    generation++;
    toast.dismiss(`agent-processing-${toastId}`);
  });
  async function load() {
    const active = generation;
    if (!current) pending = "loading";
    try {
      const next = await onLoad();
      if (active === generation) {
        received = next;
        if (next.error) reportError(next.error);
        else toast.dismiss(`agent-processing-${toastId}`);
      }
    } catch (cause) {
      if (active === generation)
        reportError(
          cause instanceof Error
            ? cause.message
            : "Could not read processing state",
        );
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
    try {
      const next = await onSet(enabled, current.revision);
      if (active !== generation) return;
      received = next;
      if (
        next.status !== "applied" ||
        next.enabled !== enabled ||
        next.applied === false
      )
        reportError(
          next.error ??
            "The controller has not applied this change. Refresh its status and retry.",
        );
    } catch (cause) {
      if (active !== generation) return;
      reportError(
        cause instanceof Error ? cause.message : "Processing change failed",
      );
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

<div
  class="agent-processing"
  data-presentation={presentation}
  aria-label="Agent processing"
>
  {#if presentation === "card"}
    <Button
      variant="secondary"
      class="agent-processing__card-button"
      disabled={!connected || !!pending}
      aria-label={label === "Agent" ? "Refresh" : label}
      aria-busy={!!pending}
      onclick={() => void change()}
      >{#if pending}<Spinner aria-hidden="true" />{:else}{label === "Agent"
          ? "Refresh"
          : label}{/if}</Button
    >
  {:else}
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        {#snippet child({ props })}
          <Button
            {...props}
            class="agent-processing__trigger"
            variant="secondary"
            size={presentation === "profile" ? "default" : "sm"}
            disabled={!connected || !!pending}
            aria-label={label === "Agent"
              ? "Agent controls, status unknown"
              : label}
            aria-busy={!!pending}
          >
            {#if pending}<Spinner aria-hidden="true" />
            {:else if !current}<PowerIcon aria-hidden="true" />
            {:else if current.enabled}<SquareIcon aria-hidden="true" />
            {:else}<PlayIcon aria-hidden="true" />{/if}
            {#if !pending}
              <span class="agent-processing__label"
                >{label}<ChevronDownIcon
                  class="agent-processing__chevron"
                  aria-hidden="true"
                /></span
              >
            {/if}
          </Button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end">
        <DropdownMenu.Label>
          <CommunityChip
            size="compact"
            variant="muted"
            tone={current?.status === "error"
              ? "danger"
              : current?.status === "cancelling"
                ? "warning"
                : current?.enabled
                  ? "success"
                  : "neutral"}
          >
            {current?.status === "error"
              ? "Cancellation failed"
              : current?.status === "cancelling"
                ? "Cancelling"
                : current?.enabled === false
                  ? "Disabled"
                  : current?.enabled === true
                    ? "Enabled"
                    : "Status unknown"}
          </CommunityChip>
        </DropdownMenu.Label>
        <DropdownMenu.Group>
          <DropdownMenu.Item
            disabled={!current ||
              current.status !== "applied" ||
              current.enabled}
            onSelect={() => void change()}
          >
            <PlayIcon data-icon="inline-start" aria-hidden="true" />Start agent
          </DropdownMenu.Item>
          <DropdownMenu.Item
            disabled={!current ||
              (current.status === "applied" && !current.enabled)}
            onSelect={() => void change()}
          >
            <SquareIcon
              data-icon="inline-start"
              aria-hidden="true"
            />{current?.status && current.status !== "applied"
              ? "Retry stop"
              : "Stop agent"}
          </DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => void load()}>
            <RefreshIcon data-icon="inline-start" aria-hidden="true" />Refresh
            status
          </DropdownMenu.Item>
        </DropdownMenu.Group>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  {/if}
</div>

<style>
  .agent-processing {
    display: grid;
    gap: 0.375rem;
    min-width: 0;
  }
  .agent-processing[data-presentation="profile"] {
    flex: 1;
  }
  .agent-processing[data-presentation="profile"]
    :global(.agent-processing__trigger) {
    width: 100%;
    min-height: 4rem;
    flex-direction: column;
    gap: 0.5rem;
  }
  .agent-processing[data-presentation="profile"]
    :global(.agent-processing__trigger:hover:not(:disabled)),
  .agent-processing[data-presentation="profile"]
    :global(.agent-processing__trigger:focus-visible:not(:disabled)) {
    background: color-mix(in oklab, var(--primary) 14%, var(--secondary));
    color: var(--foreground);
    box-shadow: inset 0 0 0 1px
      color-mix(in oklab, var(--primary) 32%, transparent);
  }
  .agent-processing__label {
    min-width: 0;
    white-space: normal;
    display: inline-flex;
    gap: 0.25rem;
    align-items: center;
  }
  :global(.agent-processing__chevron) {
    width: 0.75rem;
    height: 0.75rem;
  }
  :global(.agent-processing__card-button) {
    border: 1px solid var(--border);
    border-radius: 999px;
    padding-inline: 1rem;
    min-width: 4rem;
    box-shadow: var(--shadow-sm, 0 1px 2px rgb(0 0 0 / 0.1));
  }
</style>
