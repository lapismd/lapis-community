<script lang="ts">
  import type { NostrEvent } from "../../protocol/index.js";
  import type { ProjectForgeCommitResponse } from "../../projects/index.js";
  import type { LogReviewSubmitInput } from "../../projects/log-review.js";
  import type { ProjectForgeRef } from "../../projects/model.js";
  import { provideRepositoryLogPane } from "../../projects/repository-log-pane.svelte.js";
  import CommunityProjectsRepositoryLog from "./CommunityProjectsRepositoryLog.svelte";
  import CommunityProjectsRepositoryLogRail from "./CommunityProjectsRepositoryLogRail.svelte";
  import "./CommunityProjects.css";

  let {
    events = [],
    loading = false,
    canMaintain = false,
    branches = [],
    onCreateReview,
    onLoadRepositoryCommit,
  }: {
    events?: readonly NostrEvent[] | undefined;
    loading?: boolean | undefined;
    canMaintain?: boolean | undefined;
    branches?: readonly ProjectForgeRef[] | undefined;
    onCreateReview?:
      | ((input: LogReviewSubmitInput) => Promise<void> | void)
      | undefined;
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
    <CommunityProjectsRepositoryLogRail
      {canMaintain}
      {branches}
      {...onCreateReview ? { onCreateReview } : {}}
    />
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
