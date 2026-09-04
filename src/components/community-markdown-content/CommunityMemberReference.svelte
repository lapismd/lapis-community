<script lang="ts">
  import { getContext } from "svelte";

  import {
    communityMarkdownInteractionContext,
    type CommunityMarkdownInteractionContext,
  } from "./context.js";

  let {
    memberId,
    label,
    ref = $bindable(null),
  }: {
    memberId: string;
    label: string;
    ref?: HTMLElement | null;
  } = $props();
  const interactions = getContext<CommunityMarkdownInteractionContext>(
    communityMarkdownInteractionContext,
  );
  const member = $derived(interactions.member(memberId));
</script>

{#if member && interactions.onOpenMember}
  <button
    bind:this={ref}
    class="community-markdown-reference"
    type="button"
    onclick={() => interactions.onOpenMember?.(member!)}>{label}</button
  >
{:else}
  <span bind:this={ref} class="community-markdown-reference">{label}</span>
{/if}

<style>
  .community-markdown-reference {
    display: inline;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--primary);
    font: inherit;
    font-weight: 600;
    text-decoration: none;
  }

  button.community-markdown-reference {
    cursor: pointer;
  }

  button.community-markdown-reference:hover {
    text-decoration: underline;
    text-underline-offset: 0.15em;
  }

  button.community-markdown-reference:focus-visible {
    border-radius: 0.2rem;
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
</style>
