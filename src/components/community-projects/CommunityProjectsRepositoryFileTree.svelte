<script lang="ts">
  import { FileListing } from "@lapismd/design-core/diff";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import { ScrollArea } from "@lapismd/design-core/shadcn/scroll-area";

  import CommunitySidebarToggleIcon from "../community-app-shell/CommunitySidebarToggleIcon.svelte";
  import type { ProjectForgeRef } from "../../projects/index.js";
  import CommunityProjectsRepositoryBranchSelector from "./CommunityProjectsRepositoryBranchSelector.svelte";

  let {
    expanded = $bindable(false),
    branch,
    branches = [],
    files,
    selectedPath = "",
    onSelectBranch,
    onSelectPath,
  }: {
    expanded?: boolean | undefined;
    branch: string;
    branches?: readonly ProjectForgeRef[] | undefined;
    files: readonly { path: string }[];
    selectedPath?: string | undefined;
    onSelectBranch: (value: string | undefined) => void;
    onSelectPath: (path: string) => void;
  } = $props();
</script>

<aside class="community-projects__file-tree" aria-label="Repository file tree">
  <header class="community-projects__file-tree-header">
    <strong>Files</strong>
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Hide repository file tree"
      title="Hide repository file tree"
      onclick={() => (expanded = false)}
    >
      <CommunitySidebarToggleIcon side="left" {expanded} />
    </Button>
  </header>
  <div class="community-projects__file-tree-branch">
    <CommunityProjectsRepositoryBranchSelector
      {branch}
      {branches}
      {onSelectBranch}
    />
  </div>
  <ScrollArea type="hover" class="community-projects__file-tree-scroll">
    <FileListing
      files={[...files]}
      mode="tree"
      selectedPath={selectedPath || null}
      {onSelectPath}
    >
      {#snippet fileMeta()}
        <span class="sr-only">Repository file</span>
      {/snippet}
    </FileListing>
  </ScrollArea>
</aside>
