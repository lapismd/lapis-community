<script lang="ts">
  import type { NostrEvent } from "../../protocol/index.js";
  import type { ProjectForgeCommitResponse } from "../../projects/index.js";
  import { provideRepositoryLogPane } from "../../projects/repository-log-pane.svelte.js";
  import CommunityProjectsRepositoryLog from "./CommunityProjectsRepositoryLog.svelte";
  import CommunityProjectsRepositoryLogRail from "./CommunityProjectsRepositoryLogRail.svelte";

  let {
    events = [],
    loading = false,
    onLoadRepositoryCommit,
  }: {
    events?: readonly NostrEvent[] | undefined;
    loading?: boolean | undefined;
    onLoadRepositoryCommit?:
      | ((
          sha: string,
          signal?: AbortSignal,
        ) => Promise<ProjectForgeCommitResponse>)
      | undefined;
  } = $props();

  provideRepositoryLogPane();
</script>

<div class="community-projects-repository-log-harness">
  <aside class="community-projects-repository-log-harness__rail">
    <CommunityProjectsRepositoryLogRail />
  </aside>
  <CommunityProjectsRepositoryLog {events} {loading} {onLoadRepositoryCommit} />
</div>

<style>
  .community-projects-repository-log-harness {
    display: flex;
    min-height: 0;
    height: 100%;
  }

  .community-projects-repository-log-harness__rail {
    flex: 0 0 12rem;
    padding: 0.5rem;
    border-inline-end: 1px solid var(--border);
  }
</style>
