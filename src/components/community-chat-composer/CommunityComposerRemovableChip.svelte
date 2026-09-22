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
  title={label}
  >{@render children()}<CommunityComposerChipDismiss {label} {onRemove} /></span
>

<style>
  .community-composer-removable-token {
    display: inline-flex;
    overflow: hidden;
    align-items: stretch;
    max-width: var(--community-chip-max-width, 16rem);
    height: 1lh;
    vertical-align: baseline;
    border-radius: calc(var(--radius) - 0.2rem);
    background: var(--secondary);
    color: var(--secondary-foreground);
  }

  .community-composer-removable-token :global(.community-composer-token-action),
  .community-composer-removable-token
    :global(.community-member-hover-card__mention) {
    flex: 1 1 auto;
    min-width: 0;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    border-radius: 0;
    background-color: transparent;
  }

  .community-composer-removable-token
    :global(
      .community-chip.community-entity-link[data-ui-component][data-chip-size="inline"]
    ) {
    max-width: none;
  }

  .community-composer-removable-token
    :global(.community-member-hover-card__mention span) {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
