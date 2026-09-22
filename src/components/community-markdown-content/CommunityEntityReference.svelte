<script lang="ts">
  import { parseCommunityEntityLink } from "../../community/community-links.js";
  import CommunityEntityChip from "../community-entity-chip/CommunityEntityChip.svelte";

  let {
    href,
    label,
    ref = $bindable(null),
  }: {
    href: string;
    label: string;
    ref?: HTMLElement | null;
  } = $props();

  const link = $derived(parseCommunityEntityLink(href));
</script>

{#if link}
  <span bind:this={ref} class="community-markdown-reference-host">
    <CommunityEntityChip {link} label={label === href ? "" : label} />
  </span>
{:else}
  <a bind:this={ref} {href}>{label}</a>
{/if}

<style>
  .community-markdown-reference-host {
    display: inline;
  }
</style>
