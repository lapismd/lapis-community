<script lang="ts">
  import type { Snippet } from "svelte";
  import * as Collapsible from "@lapismd/design-core/shadcn/collapsible";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";

  let {
    title,
    open = $bindable(false),
    summary,
    children,
    contentClass = "",
  }: {
    title: string;
    open?: boolean;
    summary?: Snippet;
    children: Snippet;
    contentClass?: string;
  } = $props();
</script>

<Collapsible.Root
  bind:open
  class="commit-section"
  data-ui-component="community-commit-section"
>
  <Collapsible.Trigger class="commit-section__trigger">
    {#if open}
      <ChevronDownIcon aria-hidden="true" />
    {:else}
      <ChevronRightIcon aria-hidden="true" />
    {/if}
    <span>{title}</span>
    {#if summary}
      <span class="commit-section__summary">{@render summary()}</span>
    {/if}
  </Collapsible.Trigger>
  <Collapsible.Content class={contentClass}>
    {@render children()}
  </Collapsible.Content>
</Collapsible.Root>

<style>
  :global(.commit-section) {
    border-block: 1px solid var(--border);
  }
  :global(.commit-section + .commit-section) {
    border-top: 0;
  }
  :global(.commit-section__trigger) {
    position: sticky;
    top: var(--community-project-tabs-height, 0px);
    z-index: 4;
    background: var(--background);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    min-height: 2.75rem;
    padding: 0.75rem;
    text-align: start;
    font-size: var(--community-text-secondary);
    font-weight: 600;
  }
  :global(.commit-section__trigger:hover) {
    background: var(--muted);
  }
  :global(.commit-section__trigger:focus-visible) {
    outline: 2px solid var(--ring);
    outline-offset: -2px;
  }
  :global(.commit-section__trigger svg) {
    width: 1rem;
    height: 1rem;
    flex-shrink: 0;
  }
  .commit-section__summary {
    color: var(--muted-foreground);
    font-weight: 400;
  }
</style>
