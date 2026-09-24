<script lang="ts">
  import * as ColumnCanvas from "@lapismd/design-core/shadcn/column-canvas";

  import type { ProjectForgeRef } from "../../projects/index.js";
  import CommunityProjectsRepositoryBranchSelector from "./CommunityProjectsRepositoryBranchSelector.svelte";

  let {
    title,
    count,
    branch = "",
    branches = [],
    onSelectBranch,
  }: {
    title: string;
    count: number;
    branch?: string | undefined;
    branches?: readonly ProjectForgeRef[] | undefined;
    onSelectBranch?: ((value: string | undefined) => void) | undefined;
  } = $props();

  const showBranchSelector = $derived(branches.length > 0 && onSelectBranch);
</script>

<ColumnCanvas.Header>
  <div data-ui-component="column-canvas" data-ui-part="column-header-main">
    <ColumnCanvas.Title>{title}</ColumnCanvas.Title>
    <ColumnCanvas.Count>{count}</ColumnCanvas.Count>
  </div>
  {#if showBranchSelector}
    <ColumnCanvas.HeaderActions>
      <CommunityProjectsRepositoryBranchSelector
        {branch}
        {branches}
        onSelectBranch={(value) => onSelectBranch?.(value)}
      />
    </ColumnCanvas.HeaderActions>
  {/if}
  <ColumnCanvas.Toggle columnTitle={title} />
</ColumnCanvas.Header>
