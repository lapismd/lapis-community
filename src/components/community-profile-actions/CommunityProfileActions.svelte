<script lang="ts">
  import type { Snippet } from "svelte";
  let { children, label }: { children: Snippet; label: string } = $props();
</script>

<div
  class="profile-actions"
  role="group"
  aria-label={label}
  data-ui-component="community-profile-actions"
>
  {@render children()}
</div>

<style>
  .profile-actions {
    display: grid;
    grid-auto-flow: column;
    grid-auto-columns: minmax(0, 1fr);
    gap: 0.625rem;
  }
  .profile-actions :global(button) {
    min-width: 0;
    width: 100%;
    padding-inline: 0.375rem;
    flex: 1;
    min-height: 4rem;
    flex-direction: column;
    gap: 0.5rem;
  }
  .profile-actions :global(button:hover:not(:disabled)),
  .profile-actions :global(button:focus-visible:not(:disabled)) {
    background: color-mix(in oklab, var(--primary) 14%, var(--secondary));
    color: var(--foreground);
    box-shadow: inset 0 0 0 1px
      color-mix(in oklab, var(--primary) 32%, transparent);
  }
  .profile-actions :global(button:focus-visible) {
    outline: 2px solid var(--ring);
    outline-offset: 2px;
  }
  .profile-actions :global(button) {
    white-space: normal;
    text-align: center;
    height: auto;
  }
</style>
