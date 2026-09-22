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
  class="community-composer-chip-dismiss"
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
  .community-composer-chip-dismiss {
    display: inline-grid;
    width: 1em;
    height: 1em;
    flex: none;
    place-items: center;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: inherit;
    cursor: pointer;
    opacity: 0.62;
  }

  .community-composer-chip-dismiss:hover,
  .community-composer-chip-dismiss:focus-visible {
    background: color-mix(in srgb, currentcolor 14%, transparent);
    opacity: 1;
  }

  .community-composer-chip-dismiss :global(svg) {
    width: 0.72em;
    height: 0.72em;
  }
</style>
