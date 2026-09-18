<script lang="ts">
  import { onDestroy } from "svelte";
  import Check from "@lucide/svelte/icons/check";
  import Copy from "@lucide/svelte/icons/copy";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";

  let {
    changeId = "",
    commitId,
    commitLabel = "commit ID",
  }: {
    changeId?: string | undefined;
    commitId: string;
    commitLabel?: string | undefined;
  } = $props();

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

  async function copy(label: string, value: string): Promise<void> {
    copied = "";
    failed = "";
    try {
      const clipboard = globalThis.navigator?.clipboard;
      if (!clipboard?.writeText) throw new Error("Clipboard is unavailable");
      await clipboard.writeText(value);
      copied = label;
    } catch {
      failed = label;
    }
    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = setTimeout(() => {
      copied = "";
      failed = "";
    }, 1_500);
  }
</script>

{#snippet idButton(label: string, value: string, tone: "change" | "commit")}
  {@const state = copied === label ? "copied" : failed === label ? "failed" : ""}
  <button
    type="button"
    class="community-revision-graph-ids__button"
    class:community-revision-graph-ids__button--change={tone === "change"}
    aria-label="Copy full {label}: {value}"
    title="Copy full {label}"
    data-copied={state === "copied" || undefined}
    data-copy-failed={state === "failed" || undefined}
    onclick={() => void copy(label, value)}
  >
    <code>{shorten(value)}</code>
    {#if state === "copied"}
      <Check aria-hidden="true" />
    {:else if state === "failed"}
      <TriangleAlert aria-hidden="true" />
    {:else}
      <Copy aria-hidden="true" />
    {/if}
  </button>
{/snippet}

<div class="community-revision-graph-ids">
  {#if changeId}
    {@render idButton("change ID", changeId, "change")}
  {/if}
  {@render idButton(commitLabel, commitId, "commit")}
</div>

<style>
  .community-revision-graph-ids {
    position: absolute;
    z-index: 3;
    top: calc(var(--community-revision-graph-row-height, 76px) / 2);
    right: 0.5rem;
    display: flex;
    transform: translateY(-50%);
    flex-direction: column;
    align-items: flex-end;
    gap: 0.2rem;
  }

  .community-revision-graph-ids__button {
    display: inline-flex;
    min-width: 0;
    max-width: 100%;
    height: 1.65rem;
    align-items: center;
    gap: 0.35rem;
    padding: 0 0.4rem;
    border: 1px solid transparent;
    border-radius: 0.4rem;
    color: inherit;
    background: color-mix(in srgb, currentcolor 7%, transparent);
    font-weight: 500;
    cursor: pointer;
  }

  .community-revision-graph-ids__button--change {
    color: var(--primary);
  }

  .community-revision-graph-ids__button code {
    min-width: 0;
    overflow: hidden;
    font-family: var(--font-mono, monospace);
    font-size: var(--community-text-secondary);
    font-weight: 500;
    line-height: 1;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .community-revision-graph-ids__button :global(svg) {
    width: 0.75rem;
    height: 0.75rem;
    flex: 0 0 auto;
  }

  @media (hover: hover) {
    .community-revision-graph-ids__button:hover {
      border-color: color-mix(in srgb, currentcolor 20%, transparent);
      background: color-mix(in srgb, currentcolor 12%, transparent);
      box-shadow: 0 1px 2px color-mix(in srgb, currentcolor 14%, transparent);
    }
  }

  .community-revision-graph-ids__button:focus-visible {
    border-color: color-mix(in srgb, currentcolor 28%, transparent);
    background: color-mix(in srgb, currentcolor 12%, transparent);
    outline: none;
  }
</style>
