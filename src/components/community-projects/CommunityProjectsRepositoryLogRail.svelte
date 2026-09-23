<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import GitCommitHorizontalIcon from "@lucide/svelte/icons/git-commit-horizontal";
  import GitCompareIcon from "@lucide/svelte/icons/git-compare";
  import GitPullRequestIcon from "@lucide/svelte/icons/git-pull-request";
  import HistoryIcon from "@lucide/svelte/icons/history";
  import { onDestroy } from "svelte";

  import type { LogReviewSubmitInput } from "../../projects/log-review.js";
  import type { ProjectForgeRef } from "../../projects/model.js";
  import { projectForgeDefaultBranchName } from "../../projects/repository-refs.js";
  import { useRepositoryLogPane } from "../../projects/repository-log-pane.svelte.js";
  import CommunityEntityCopyButton from "../community-entity-chip/CommunityEntityCopyButton.svelte";
  import CommunityProjectsRepositoryLogReviewDialog from "./CommunityProjectsRepositoryLogReviewDialog.svelte";

  const EMPTY_REFS: readonly ProjectForgeRef[] = [];

  let {
    canMaintain = false,
    branches = EMPTY_REFS,
    onCreateReview,
  }: {
    canMaintain?: boolean;
    branches?: readonly ProjectForgeRef[] | undefined;
    onCreateReview?: (input: LogReviewSubmitInput) => Promise<void> | void;
  } = $props();

  const pane = useRepositoryLogPane();
  let reviewOpen = $state(false);
  let reviewTitle = $state("");
  let reviewBody = $state("");
  let targetBranch = $state("");
  let busy = $state(false);
  let localError = $state("");
  const refs = $derived(branches ?? EMPTY_REFS);
  const reviewCommit = $derived(
    pane?.pane === "log" && pane.reviewCommitId && !pane.reviewEmpty
      ? pane.reviewCommitId
      : "",
  );

  onDestroy(() => pane?.reset());

  $effect(() => {
    pane?.setReviewAction({ canMaintain, openReview });
  });

  function openReview(): void {
    reviewTitle = pane?.reviewMessage ?? "";
    reviewBody = "";
    localError = "";
    targetBranch = projectForgeDefaultBranchName(refs) ?? "";
    reviewOpen = true;
  }

  async function submitReview(input: LogReviewSubmitInput): Promise<void> {
    if (!onCreateReview) return;
    busy = true;
    localError = "";
    try {
      await onCreateReview(input);
      reviewOpen = false;
    } catch (cause) {
      localError =
        cause instanceof Error ? cause.message : "Could not create the review";
    } finally {
      busy = false;
    }
  }
</script>

{#if pane}
  <nav
    class="community-projects-repository-log-rail"
    aria-label="Repository log views"
  >
    <Button
      type="button"
      variant="ghost"
      class="community-application__project-overview-item"
      data-active={pane.pane === "log" ? "" : undefined}
      aria-current={pane.pane === "log" ? "page" : undefined}
      onclick={() => pane.selectPane("log")}
    >
      <GitCommitHorizontalIcon data-icon="inline-start" aria-hidden="true" />
      <span>Log</span>
    </Button>
    <Button
      type="button"
      variant="ghost"
      class="community-application__project-overview-item"
      data-active={pane.pane === "oplog" ? "" : undefined}
      aria-current={pane.pane === "oplog" ? "page" : undefined}
      onclick={() => pane.selectPane("oplog")}
    >
      <HistoryIcon data-icon="inline-start" aria-hidden="true" />
      <span>Op Log</span>
    </Button>
    <CommunityEntityCopyButton
      class="community-application__project-overview-item"
      label="Copy Link"
      success={pane.pane === "oplog" ? "Op Log link copied" : "Log link copied"}
    />
    {#if pane.pane === "log" && pane.selectedCommitId}
      <Button
        type="button"
        variant="ghost"
        class="community-application__project-overview-item"
        aria-pressed={pane.evologOpen}
        onclick={() => pane.toggleEvolog()}
      >
        <GitCompareIcon data-icon="inline-start" aria-hidden="true" />
        <span>Evolog</span>
      </Button>
    {/if}
    {#if canMaintain && reviewCommit}
      <Button
        type="button"
        variant="ghost"
        class="community-application__project-overview-item"
        onclick={openReview}
      >
        <GitPullRequestIcon data-icon="inline-start" aria-hidden="true" />
        <span>Create review</span>
      </Button>
    {/if}
  </nav>
  {#if reviewCommit}
    <CommunityProjectsRepositoryLogReviewDialog
      bind:open={reviewOpen}
      bind:reviewTitle
      bind:reviewBody
      bind:targetBranch
      commit={reviewCommit}
      branches={refs}
      {busy}
      {localError}
      onSubmit={submitReview}
    />
  {/if}
{/if}

<style>
  .community-projects-repository-log-rail {
    display: grid;
    gap: 0.15rem;
  }

  .community-projects-repository-log-rail
    :global(
      .community-application__project-overview-item[data-ui-component="button"][aria-pressed="true"]
    ) {
    color: var(--foreground);
    background: color-mix(in srgb, var(--muted) 62%, transparent);
  }
</style>
