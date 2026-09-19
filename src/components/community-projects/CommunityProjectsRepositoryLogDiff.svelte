<script lang="ts">
  import CommunityCommitDiff from "../community-commit-diff/CommunityCommitDiff.svelte";
  import type { RepositoryAgentCheckpoint } from "../../projects/repository-agent-context.js";
  import {
    FileChangeStats,
    type FileDiffViewMode,
    type FileListingFile,
  } from "@lapismd/design-core/diff";
  import * as ColumnCanvas from "@lapismd/design-core/shadcn/column-canvas";
  import CommunityDiffControls from "../community-diff-controls/CommunityDiffControls.svelte";

  import { repositoryLogFileStats } from "../../projects/repository-log-files.js";

  let {
    path,
    patch,
    files,
    checkpoints = [],
    commitId,
    base,
  }: {
    checkpoints?: readonly RepositoryAgentCheckpoint[];
    commitId?: string | undefined;
    base?: string | undefined;
    path: string | null;
    patch: string | undefined;
    files: readonly FileListingFile[];
  } = $props();

  let viewMode = $state<FileDiffViewMode>("unified");
  let wrap = $state(false);
  const stats = $derived(repositoryLogFileStats(files, path));
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
      <CommunityDiffControls bind:viewMode bind:wrap />
      <ColumnCanvas.Close aria-label="Close Diff column" title="Close Diff" />
    </ColumnCanvas.HeaderActions>
  </ColumnCanvas.Header>
  <ColumnCanvas.Body>
    {#if path && patch}
      <CommunityCommitDiff
        single
        files={[{ path, patch }]}
        {viewMode}
        {wrap}
        {checkpoints}
        {commitId}
        {base}
      />
    {/if}
  </ColumnCanvas.Body>
</ColumnCanvas.Column>
