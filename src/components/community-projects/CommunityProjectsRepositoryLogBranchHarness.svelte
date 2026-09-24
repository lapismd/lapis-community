<script lang="ts">
  import { untrack } from "svelte";

  import type { NostrEvent } from "../../protocol/index.js";
  import type { ProjectForgeRef } from "../../projects/index.js";
  import { provideRepositoryLogPane } from "../../projects/repository-log-pane.svelte.js";
  import CommunityProjectsRepositoryLog from "./CommunityProjectsRepositoryLog.svelte";

  let {
    events = [],
    branch = "",
    branches = [],
    loading = false,
  }: {
    events?: readonly NostrEvent[] | undefined;
    branch?: string | undefined;
    branches?: readonly ProjectForgeRef[] | undefined;
    loading?: boolean | undefined;
  } = $props();

  let selectedBranch = $state(untrack(() => branch));

  provideRepositoryLogPane();
</script>

<div class="community-projects-repository-log-branch-harness">
  <CommunityProjectsRepositoryLog
    {events}
    {loading}
    branch={selectedBranch}
    {branches}
    repositoryAddress="30617:owner:probe"
    onSelectBranch={(value) => {
      selectedBranch = value ?? "";
    }}
  />
</div>

<style>
  .community-projects-repository-log-branch-harness {
    display: flex;
    min-height: 0;
    height: 40rem;
  }
</style>
