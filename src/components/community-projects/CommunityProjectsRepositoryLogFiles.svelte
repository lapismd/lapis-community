<script lang="ts">
  import {
    FileListing,
    FileListingViewModeToggle,
    type FileListingFile,
    type FileListingViewMode,
  } from "@lapismd/design-core/diff";

  let {
    files,
    selectedPath = null,
    title = "Changed files",
    compact = false,
    error = "",
    onSelectPath,
  }: {
    files: FileListingFile[];
    selectedPath?: string | null;
    title?: string | undefined;
    compact?: boolean | undefined;
    error?: string | undefined;
    onSelectPath: (path: string) => void;
  } = $props();

  let mode = $state<FileListingViewMode>("tree");
</script>

<section
  class="community-revision-graph-files"
  class:community-revision-graph-files--compact={compact}
  data-ui-part="changed-files"
  aria-label={title}
>
  <div class="community-revision-graph-files__header">
    <span class="community-revision-graph-files__title">{title}</span>
    <span class="community-revision-graph-files__count">{files.length}</span>
    <FileListingViewModeToggle bind:mode />
  </div>
  {#if error}
    <p class="community-revision-graph-files__status">{error}</p>
  {/if}
  <div class="community-revision-graph-files__body">
    <FileListing {files} {mode} {selectedPath} {onSelectPath} />
  </div>
</section>

<style>
  .community-revision-graph-files {
    --ui-diff-row-hover: color-mix(
      in srgb,
      var(--foreground) 7%,
      var(--background)
    );
    --ui-diff-selected: color-mix(
      in srgb,
      var(--foreground) 12%,
      var(--background)
    );
    display: flex;
    min-width: 0;
    min-height: 0;
    flex: 1 1 auto;
    flex-direction: column;
  }

  .community-revision-graph-files__header {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0.65rem;
    border-bottom: 1px solid
      color-mix(in srgb, currentColor 14%, transparent);
  }

  .community-revision-graph-files__title {
    min-width: 0;
    flex: 1 1 auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--community-text-body);
    font-weight: 600;
  }

  .community-revision-graph-files__count {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    padding: 0.05rem 0.4rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--foreground) 7%, var(--background));
    color: var(--foreground);
    font-size: var(--community-text-secondary);
    font-weight: 600;
  }

  .community-revision-graph-files__status {
    margin: 0;
    padding: 0.25rem 0.65rem 0;
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
  }

  .community-revision-graph-files :global(.ui-diff-file-listing) {
    gap: 0.2rem;
  }

  .community-revision-graph-files :global(.ui-diff-file-listing__row) {
    color: var(--muted-foreground);
  }

  .community-revision-graph-files
    :global(.ui-diff-file-listing__row--selected),
  .community-revision-graph-files
    :global(.ui-diff-file-listing__row--selected:hover) {
    color: var(--foreground);
  }

  .community-revision-graph-files
    :global(
      .ui-diff-file-listing__row--selected .ui-diff-file-listing__icon
    ) {
    border-radius: 4px;
    background: var(--background);
    box-shadow: 0 0 0 1px var(--border);
  }

  .community-revision-graph-files__body {
    min-height: 0;
    flex: 1 1 auto;
    padding: 0.25rem 0.35rem 0.35rem;
    overflow: auto;
  }

  .community-revision-graph-files--compact {
    flex: 0 1 auto;
    max-height: 16rem;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, currentColor 14%, transparent);
    border-radius: 0.5rem;
    background: var(--background);
  }

  .community-revision-graph-files--compact
    .community-revision-graph-files__body {
    flex: 0 1 auto;
    max-height: 12rem;
  }
</style>
