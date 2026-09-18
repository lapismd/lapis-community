<script lang="ts">
  import {
    FileChangeStats,
    FileDiff,
    type FileDiffViewMode,
    type FileListingFile,
  } from "@lapismd/design-core/diff";
  import * as ColumnCanvas from "@lapismd/design-core/shadcn/column-canvas";
  import { Toggle } from "@lapismd/design-core/shadcn/toggle";
  import * as ToggleGroup from "@lapismd/design-core/shadcn/toggle-group";
  import Columns2Icon from "@lucide/svelte/icons/columns-2";
  import Rows2Icon from "@lucide/svelte/icons/rows-2";
  import WrapTextIcon from "@lucide/svelte/icons/wrap-text";

  import { repositoryLogFileStats } from "../../projects/repository-log-files.js";

  let {
    path,
    patch,
    files,
  }: {
    path: string | null;
    patch: string | undefined;
    files: readonly FileListingFile[];
  } = $props();

  let viewMode = $state<FileDiffViewMode>("unified");
  let wrap = $state(false);
  const stats = $derived(repositoryLogFileStats(files, path));

  function setViewMode(next: string | undefined): void {
    if (next !== "unified" && next !== "split") return;
    viewMode = next;
  }
</script>

<ColumnCanvas.Column id="diff">
  <ColumnCanvas.Header>
    <div data-ui-component="column-canvas" data-ui-part="column-header-main">
      <ColumnCanvas.Title>{path ?? "Diff"}</ColumnCanvas.Title>
    </div>
    <ColumnCanvas.HeaderActions>
      <FileChangeStats
        additions={stats.additions}
        deletions={stats.deletions}
        showZero
      />
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
          <ToggleGroup.Item
            value="split"
            aria-label="Show split diff"
            title="Split"
          >
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
      <ColumnCanvas.Close aria-label="Close Diff column" title="Close Diff" />
    </ColumnCanvas.HeaderActions>
  </ColumnCanvas.Header>
  <ColumnCanvas.Body>
    {#if path && patch}
      <FileDiff {path} {patch} {viewMode} {wrap} />
    {/if}
  </ColumnCanvas.Body>
</ColumnCanvas.Column>

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
