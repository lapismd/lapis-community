<script lang="ts">
  import { getContext } from "svelte";

  import CommunityMemberHoverCard from "../community-member-hover-card/CommunityMemberHoverCard.svelte";
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

{#if member}
  <span bind:this={ref} class="community-markdown-reference-host">
    <CommunityMemberHoverCard
      {member}
      trigger="mention"
      triggerLabel={label}
      {...interactions.onOpenMember === undefined
        ? {}
        : { onOpenProfile: interactions.onOpenMember }}
    />
  </span>
{:else}
  <span bind:this={ref} class="community-markdown-reference">{label}</span>
{/if}

<style>
  .community-markdown-reference-host,
  .community-markdown-reference {
    display: inline;
  }

  .community-markdown-reference {
    padding: 0;
    border: 0;
    border-radius: calc(var(--radius) - 0.2rem);
    background: var(--secondary);
    box-decoration-break: clone;
    color: var(--secondary-foreground);
    font: inherit;
    font-weight: 600;
    text-decoration: none;
    -webkit-box-decoration-break: clone;
  }
</style>
