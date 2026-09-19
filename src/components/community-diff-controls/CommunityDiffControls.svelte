<script lang="ts">
  import type { FileDiffViewMode } from "@lapismd/design-core/diff";
  import { Toggle } from "@lapismd/design-core/shadcn/toggle";
  import * as ToggleGroup from "@lapismd/design-core/shadcn/toggle-group";
  import Columns2Icon from "@lucide/svelte/icons/columns-2";
  import Rows2Icon from "@lucide/svelte/icons/rows-2";
  import WrapTextIcon from "@lucide/svelte/icons/wrap-text";
  let {
    viewMode = $bindable("unified"),
    wrap = $bindable(false),
  }: { viewMode?: FileDiffViewMode; wrap?: boolean } = $props();
  function setViewMode(next: string | undefined) {
    if (next === "unified" || next === "split") viewMode = next;
  }
</script>

<span class="community-projects-repository-log-diff__chrome">
  <ToggleGroup.Root
    type="single"
    value={viewMode}
    onValueChange={setViewMode}
    variant="outline"
    size="sm"
    aria-label="Diff view mode"
  >
    <ToggleGroup.Item
      value="unified"
      aria-label="Show unified diff"
      title="Unified"
    >
      <Rows2Icon />
    </ToggleGroup.Item>
    <ToggleGroup.Item value="split" aria-label="Show split diff" title="Split">
      <Columns2Icon />
    </ToggleGroup.Item>
  </ToggleGroup.Root>
</span>
<span
  class="community-projects-repository-log-diff__chrome community-projects-repository-log-diff__wrap"
>
  <Toggle
    bind:pressed={wrap}
    variant="outline"
    size="sm"
    aria-label="Wrap text"
    title="Wrap text"
  >
    <WrapTextIcon />
  </Toggle>
</span>

<style>
  .community-projects-repository-log-diff__chrome {
    display: inline-flex;
    align-items: stretch;
    width: fit-content;
    height: 1.375rem;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: calc(var(--radius) * 0.6);
    background: var(--background);
    box-shadow: none;
  }

  .community-projects-repository-log-diff__chrome
    :global([data-ui-part="toggle-group"]),
  .community-projects-repository-log-diff__chrome
    :global([data-ui-component="toggle"]) {
    height: 100%;
    border: none;
    box-shadow: none;
    background: transparent;
  }

  .community-projects-repository-log-diff__chrome
    :global([data-ui-part="toggle-group-item"]),
  .community-projects-repository-log-diff__wrap
    :global([data-ui-component="toggle"]) {
    box-sizing: border-box;
    width: 1.375rem;
    min-width: 1.375rem;
    height: 1.375rem;
    padding: 0;
    border: none;
    border-radius: 0;
    box-shadow: none;
    background-color: transparent;
  }

  .community-projects-repository-log-diff__chrome
    :global(
      [data-ui-part="toggle-group-item"] + [data-ui-part="toggle-group-item"]
    ) {
    border-left: 1px solid var(--border);
  }

  .community-projects-repository-log-diff__chrome :global(svg) {
    width: 0.75rem;
    height: 0.75rem;
  }

  .community-projects-repository-log-diff__chrome :global([data-state="on"]),
  .community-projects-repository-log-diff__chrome
    :global([data-state="on"]:hover) {
    background-color: color-mix(
      in srgb,
      var(--foreground) 12%,
      var(--background)
    );
    color: inherit;
  }
</style>
