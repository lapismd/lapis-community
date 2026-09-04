<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    label = "Spoiler",
    children,
    ref = $bindable(null),
  }: {
    label?: string;
    children?: Snippet;
    ref?: HTMLButtonElement | null;
  } = $props();
  let revealed = $state(false);
</script>

<button
  bind:this={ref}
  class:revealed
  class="community-spoiler"
  type="button"
  aria-label={revealed ? `Hide spoiler: ${label}` : "Reveal spoiler"}
  aria-pressed={revealed}
  onclick={() => (revealed = !revealed)}
>
  <span>{@render children?.()}</span>
</button>

<style>
  .community-spoiler {
    display: inline;
    padding: 0.05em 0.24em;
    border: 0;
    border-radius: 0.25rem;
    background: var(--foreground);
    color: transparent;
    cursor: pointer;
    font: inherit;
  }

  .community-spoiler:hover,
  .community-spoiler:focus-visible {
    background: color-mix(in srgb, var(--foreground) 86%, transparent);
  }

  .community-spoiler:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }

  .community-spoiler.revealed {
    background: var(--muted);
    color: var(--foreground);
  }
</style>
