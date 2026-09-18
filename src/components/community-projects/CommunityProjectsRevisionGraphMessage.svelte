<script lang="ts">
  import { onDestroy } from "svelte";
  import Check from "@lucide/svelte/icons/check";
  import Copy from "@lucide/svelte/icons/copy";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";

  import { parseRepositoryLogMessage } from "../../projects/repository-log-message.js";

  let { message }: { message: string } = $props();

  const parts = $derived(parseRepositoryLogMessage(message));
  let copied = $state("");
  let failed = $state("");
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  onDestroy(() => {
    if (resetTimer) clearTimeout(resetTimer);
  });

  function shorten(value: string): string {
    if (value.length <= 13) return value;
    return `${value.slice(0, 8)}…${value.slice(-4)}`;
  }

  async function copy(value: string): Promise<void> {
    copied = "";
    failed = "";
    try {
      const clipboard = globalThis.navigator?.clipboard;
      if (!clipboard?.writeText) throw new Error("Clipboard is unavailable");
      await clipboard.writeText(value);
      copied = value;
    } catch {
      failed = value;
    }
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      copied = "";
      failed = "";
    }, 1_500);
  }
</script>

<span class="community-revision-graph-message">
  {#each parts as part, index (index)}
    {#if part.type === "text"}
      <span>{part.value}</span>
    {:else}
      {@const label = part.type === "commit" ? "commit ID" : "change ID"}
      {@const state =
        copied === part.value
          ? "copied"
          : failed === part.value
            ? "failed"
            : ""}
      <button
        type="button"
        class="community-revision-graph-message__id"
        class:community-revision-graph-message__id--change={part.type ===
          "change"}
        aria-label="Copy full {label}: {part.value}"
        title="Copy full {label}"
        data-copied={state === "copied" || undefined}
        data-copy-failed={state === "failed" || undefined}
        onclick={(event) => {
          event.stopPropagation();
          void copy(part.value);
        }}
      >
        <code>{shorten(part.value)}</code>
        {#if state === "copied"}
          <Check aria-hidden="true" />
        {:else if state === "failed"}
          <TriangleAlert aria-hidden="true" />
        {:else}
          <Copy aria-hidden="true" />
        {/if}
      </button>
    {/if}
  {/each}
</span>

<style>
  .community-revision-graph-message {
    display: inline-flex;
    min-width: 0;
    max-width: 100%;
    align-items: center;
    gap: 0.25rem;
    overflow: hidden;
    font-size: var(--community-text-body);
    font-weight: 500;
    line-height: 1.25rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .community-revision-graph-message__id {
    display: inline-flex;
    min-width: 0;
    height: 1.35rem;
    align-items: center;
    gap: 0.25rem;
    padding: 0 0.3rem;
    border: 1px solid transparent;
    border-radius: 0.35rem;
    color: inherit;
    background: color-mix(in srgb, currentcolor 7%, transparent);
    font: inherit;
    cursor: pointer;
  }

  .community-revision-graph-message__id--change {
    color: var(--primary);
  }

  .community-revision-graph-message__id code {
    font-family: var(--font-mono, monospace);
    font-size: var(--community-text-secondary);
    font-weight: 500;
  }

  .community-revision-graph-message__id :global(svg) {
    width: 0.7rem;
    height: 0.7rem;
    flex: 0 0 auto;
  }
</style>
