<script lang="ts">
  import { getContext } from "svelte";

  import {
    communityMarkdownInteractionContext,
    type CommunityMarkdownInteractionContext,
  } from "./context.js";

  let {
    roomId,
    label,
    ref = $bindable(null),
  }: {
    roomId: string;
    label: string;
    ref?: HTMLElement | null;
  } = $props();
  const interactions = getContext<CommunityMarkdownInteractionContext>(
    communityMarkdownInteractionContext,
  );
</script>

{#if interactions.onOpenRoom}
  <button
    bind:this={ref}
    class="community-channel-reference"
    type="button"
    onclick={() => interactions.onOpenRoom?.(roomId)}>{label}</button
  >
{:else}
  <span bind:this={ref} class="community-channel-reference">{label}</span>
{/if}

<style>
  .community-channel-reference {
    display: inline;
    padding: 0.05em 0.26em;
    border: 0;
    border-radius: 0.28rem;
    background: color-mix(in srgb, var(--primary) 12%, transparent);
    color: var(--primary);
    font: inherit;
    font-weight: 600;
  }

  button.community-channel-reference {
    cursor: pointer;
  }

  button.community-channel-reference:hover {
    background: color-mix(in srgb, var(--primary) 18%, transparent);
  }

  button.community-channel-reference:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
</style>
