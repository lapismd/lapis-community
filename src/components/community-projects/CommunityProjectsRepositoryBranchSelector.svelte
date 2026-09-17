<script lang="ts">
  import CommunityRepositoryBranchCommand from "../community-repository-branch-command/CommunityRepositoryBranchCommand.svelte";
  import type { ProjectForgeRef } from "../../projects/index.js";

  const EMPTY_REFS: readonly ProjectForgeRef[] = [];

  let {
    branch,
    branches = EMPTY_REFS,
    onSelectBranch,
  }: {
    branch: string;
    branches?: readonly ProjectForgeRef[] | undefined;
    onSelectBranch: (value: string | undefined) => void;
  } = $props();

  const refs = $derived(branches ?? EMPTY_REFS);

  function selectRepositoryBranch(value: string | undefined): void {
    onSelectBranch(value);
  }
</script>

<CommunityRepositoryBranchCommand
  {branch}
  branches={refs}
  onSelectBranch={selectRepositoryBranch}
/>
