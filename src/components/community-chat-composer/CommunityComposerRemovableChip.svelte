<script lang="ts">
  import type { Snippet } from "svelte";

  import CommunityComposerChipDismiss from "./CommunityComposerChipDismiss.svelte";

  let {
    label,
    onRemove,
    children,
  }: {
    label: string;
    onRemove: () => void;
    children: Snippet;
  } = $props();
</script>

<span
  class="community-composer-removable-token"
  data-ui-part="composer-removable-token"
>
  {@render children()}
  <CommunityComposerChipDismiss {label} {onRemove} />
</span>

<style>
  .community-composer-removable-token {
    display: inline-flex;
    overflow: hidden;
    align-items: stretch;
    height: 1lh;
    vertical-align: baseline;
    border-radius: calc(var(--radius) - 0.2rem);
    background: var(--secondary);
    color: var(--secondary-foreground);
  }

  .community-composer-removable-token
    :global(.community-composer-token-action),
  .community-composer-removable-token
    :global(.community-member-hover-card__mention) {
    height: 100%;
    min-height: 0;
    border-radius: 0;
    background-color: transparent;
  }

  .community-composer-removable-token
    :global(.community-composer-token-action:hover),
  .community-composer-removable-token
    :global(.community-composer-token-action:focus-visible),
  .community-composer-removable-token
    :global(.community-member-hover-card__mention:hover),
  .community-composer-removable-token
    :global(.community-member-hover-card__mention:focus-visible) {
    background-color: color-mix(in srgb, var(--foreground) 10%, transparent);
  }
</style>
