<script lang="ts">
  import { DialogFrame } from "@lapismd/design-core/forms/dialog";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import * as Field from "@lapismd/design-core/shadcn/field";
  import { Input } from "@lapismd/design-core/shadcn/input";
  import GitCommitHorizontalIcon from "@lucide/svelte/icons/git-commit-horizontal";
  import GitCompareIcon from "@lucide/svelte/icons/git-compare";
  import GitPullRequestIcon from "@lucide/svelte/icons/git-pull-request";
  import HistoryIcon from "@lucide/svelte/icons/history";
  import { onDestroy } from "svelte";

  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import CommunityEntityCopyButton from "../community-entity-chip/CommunityEntityCopyButton.svelte";
  import { useRepositoryLogPane } from "../../projects/repository-log-pane.svelte.js";

  let {
    canMaintain = false,
    onCreateReview,
  }: {
    canMaintain?: boolean;
    onCreateReview?: (input: {
      title: string;
      content: string;
      commit: string;
    }) => Promise<void> | void;
  } = $props();

  const pane = useRepositoryLogPane();
  let reviewOpen = $state(false);
  let reviewTitle = $state("");
  let reviewBody = $state("");
  let busy = $state(false);
  let localError = $state("");

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
    reviewOpen = true;
  }

  async function submitReview(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const commit = reviewCommit;
    if (!commit || !onCreateReview) return;
    busy = true;
    localError = "";
    try {
      await onCreateReview({
        title: reviewTitle.trim(),
        content: reviewBody,
        commit,
      });
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
  <Dialog.Root bind:open={reviewOpen}>
    <DialogFrame size="wide">
      {#snippet title()}Create review{/snippet}
      {#snippet description()}
        Publish a review for {reviewCommit}
      {/snippet}
      <form class="community-projects__project-form" onsubmit={submitReview}>
        <Field.Group class="community-projects__project-fields">
          <Field.Field>
            <Field.Label for="log-review-title">Title</Field.Label>
            <Input id="log-review-title" bind:value={reviewTitle} required />
          </Field.Field>
          <Field.Field>
            <Field.Label>
              Description <span>Optional</span>
            </Field.Label>
            <CommunityChatComposer
              class="community-projects__project-description"
              bind:value={reviewBody}
              placeholder="Add context for reviewers"
              ariaLabel="Review description"
              mode="form"
            />
          </Field.Field>
          {#if localError}<Field.Error>{localError}</Field.Error>{/if}
        </Field.Group>
        <Button type="submit" disabled={busy || !reviewTitle.trim()}>
          {busy ? "Creating review…" : "Create review"}
        </Button>
      </form>
    </DialogFrame>
  </Dialog.Root>
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
