<script lang="ts">
  import XIcon from "@lucide/svelte/icons/x";

  let {
    label,
    onRemove,
  }: {
    label: string;
    onRemove: () => void;
  } = $props();
</script>

<button
  type="button"
  class="community-composer-token-dismiss"
  data-ui-part="composer-chip-dismiss"
  aria-label={`Remove ${label}`}
  onmousedown={(event) => {
    event.preventDefault();
    event.stopPropagation();
  }}
  onclick={(event) => {
    event.preventDefault();
    event.stopPropagation();
    onRemove();
  }}
>
  <XIcon aria-hidden="true" />
</button>

<style>
  .community-composer-token-dismiss {
    display: inline-grid;
    width: 1.2em;
    min-height: 100%;
    flex: none;
    place-items: center;
    padding: 0 0.12em 0 0.16em;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: inset 1px 0 0 color-mix(in srgb, currentcolor 16%, transparent);
    color: inherit;
    cursor: pointer;
  }

  .community-composer-token-dismiss:hover,
  .community-composer-token-dismiss:focus-visible {
    background: color-mix(in srgb, var(--foreground) 16%, transparent);
  }

  .community-composer-token-dismiss :global(svg) {
    width: 0.72em;
    height: 0.72em;
  }
</style>
