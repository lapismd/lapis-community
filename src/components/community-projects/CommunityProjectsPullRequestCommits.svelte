<script lang="ts">
  import * as Collapsible from "@lapismd/design-core/shadcn/collapsible";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import GitCommitHorizontalIcon from "@lucide/svelte/icons/git-commit-horizontal";

  import type {
    ProjectForgeCommit,
    PullRequestState,
  } from "../../projects/index.js";

  let {
    commitsOpen = $bindable(false),
    checksOpen = $bindable(false),
    pullRequest,
    onSelectCommit,
    commitSummary,
  }: {
    commitsOpen?: boolean | undefined;
    checksOpen?: boolean | undefined;
    pullRequest: PullRequestState;
    onSelectCommit?: ((commit: ProjectForgeCommit) => void) | undefined;
    commitSummary: (
      sha: string,
      subject: string,
      body: string,
      createdAt: number,
      authorId: string,
    ) => ProjectForgeCommit;
  } = $props();
</script>

<Collapsible.Root
  class="community-projects__review-section"
  bind:open={commitsOpen}
>
  <Collapsible.Trigger class="community-projects__review-section-trigger">
    <span>Commits</span>
    {#if commitsOpen}
      <ChevronDownIcon aria-hidden="true" />
      <span class="community-projects__review-section-count"
        >{pullRequest.updates.length + 1}</span
      >
    {:else}
      <ChevronRightIcon aria-hidden="true" />
    {/if}
  </Collapsible.Trigger>
  <Collapsible.Content class="community-projects__review-commit-list">
    <button
      type="button"
      class="community-projects__review-commit-row"
      onclick={() =>
        onSelectCommit?.(
          commitSummary(
            pullRequest.initialCommit,
            pullRequest.title,
            pullRequest.content,
            pullRequest.createdAt,
            pullRequest.root.pubkey,
          ),
        )}
    >
      <GitCommitHorizontalIcon aria-hidden="true" />
      <strong>{pullRequest.title}</strong>
      <code>{pullRequest.initialCommit.slice(0, 7)}</code>
    </button>
    {#each pullRequest.updates as update (update.event.id)}
      <button
        type="button"
        class="community-projects__review-commit-row"
        onclick={() =>
          onSelectCommit?.(
            commitSummary(
              update.commit,
              update.event.content.trim() || "Updated review branch",
              update.event.content,
              update.event.created_at,
              update.event.pubkey,
            ),
          )}
      >
        <GitCommitHorizontalIcon aria-hidden="true" />
        <strong
          >{update.event.content.trim() || "Updated review branch"}</strong
        >
        <code>{update.commit.slice(0, 7)}</code>
      </button>
    {/each}
  </Collapsible.Content>
</Collapsible.Root>

<Collapsible.Root
  class="community-projects__review-section"
  bind:open={checksOpen}
>
  <Collapsible.Trigger class="community-projects__review-section-trigger">
    <span>Checks</span>
    {#if checksOpen}
      <ChevronDownIcon aria-hidden="true" />
    {:else}
      <ChevronRightIcon aria-hidden="true" />
    {/if}
  </Collapsible.Trigger>
  <Collapsible.Content class="community-projects__review-section-content">
    <p class="community-projects__muted">
      No checks have been reported for this review yet.
    </p>
  </Collapsible.Content>
</Collapsible.Root>
