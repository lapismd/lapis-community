<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    title,
    headingId,
    description,
    toolbar,
    empty,
    action,
    children,
  }: {
    title: string;
    headingId: string;
    description: string;
    toolbar: string;
    empty?: string | undefined;
    action: Snippet;
    children?: Snippet | undefined;
  } = $props();
</script>

<section class="community-projects-ruleset-panel" aria-labelledby={headingId}>
  <h4 id={headingId}>{title}</h4>
  <p>{description}</p>
  <div class="community-projects-ruleset-panel__card">
    <div class="community-projects-ruleset-panel__toolbar">
      <strong>{toolbar}</strong>
      {@render action()}
    </div>
    {#if empty}
      <p class="community-projects-ruleset-panel__empty">{empty}</p>
    {:else}
      <ul>
        {@render children?.()}
      </ul>
    {/if}
  </div>
</section>

<style>
  .community-projects-ruleset-panel {
    display: grid;
    gap: 0.35rem;
    width: 100%;
  }

  h4,
  p,
  ul {
    margin: 0;
  }

  p {
    color: var(--muted-foreground);
  }

  ul {
    display: grid;
    padding: 0;
    list-style: none;
  }

  .community-projects-ruleset-panel__card {
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .community-projects-ruleset-panel__toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.65rem 0.85rem;
    background: var(--muted);
  }

  .community-projects-ruleset-panel__empty {
    display: grid;
    min-height: 7rem;
    place-items: center;
    padding: 1.5rem 1rem;
    text-align: center;
    font-weight: 600;
    color: var(--foreground);
  }

  .community-projects-ruleset-panel :global(li) {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: 0.65rem;
    padding: 0.65rem 0.85rem;
    border-top: 1px solid var(--border);
  }

  .community-projects-ruleset-panel :global(li > :first-child) {
    flex: 1 1 auto;
  }
</style>
