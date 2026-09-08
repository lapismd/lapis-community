<script lang="ts">
  import { getContext } from "svelte";

  import CommunityChip from "../community-chip/CommunityChip.svelte";
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
      {...interactions.onMessageMember === undefined
        ? {}
        : { onMessage: interactions.onMessageMember }}
      {...interactions.onWaveMember === undefined
        ? {}
        : { onWave: interactions.onWaveMember }}
    />
  </span>
{:else}
  <span bind:this={ref} class="community-markdown-reference-host">
    <CommunityChip variant="muted" size="inline">{label}</CommunityChip>
  </span>
{/if}

<style>
  .community-markdown-reference-host {
    display: inline;
  }
</style>
