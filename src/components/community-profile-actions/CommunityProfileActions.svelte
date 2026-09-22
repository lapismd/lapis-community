<script lang="ts">
  import type { Snippet } from "svelte";
  import "./profile-action-tiles.css";
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
    grid-auto-columns: minmax(0, 13.125rem);
    justify-content: start;
    gap: 0.75rem;
  }
  .profile-actions :global(button) {
    display: grid;
    min-width: 0;
    width: 13.125rem;
    max-width: 100%;
    height: 7.5rem;
    align-content: space-between;
    justify-items: start;
    padding: 1rem;
    border-radius: 1rem;
    text-align: start;
    white-space: normal;
    font-size: var(--community-text-body);
    font-weight: 550;
  }
</style>
