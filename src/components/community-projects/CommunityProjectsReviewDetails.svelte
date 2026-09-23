<script lang="ts">
  import type { Component } from "svelte";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import CircleCheckIcon from "@lucide/svelte/icons/circle-check";
  import GitBranchIcon from "@lucide/svelte/icons/git-branch";
  import GitPullRequestIcon from "@lucide/svelte/icons/git-pull-request";
  import UsersIcon from "@lucide/svelte/icons/users";

  import CommunityEntityCopyButton from "../community-entity-chip/CommunityEntityCopyButton.svelte";
  import { pullRequestBranchLabel } from "../../projects/pull-request-branch-label.js";
  import { communityReviewLink } from "./review-link.js";

  let {
    pullRequest,
  }: {
    pullRequest: {
      lifecycle: string;
      branchName: string;
      targetBranch: string;
      currentCommit: string;
      reviewers: readonly string[];
      approvals: readonly unknown[];
      repository: { coordinate: string };
      root: { id: string };
    };
  } = $props();

  const link = $derived(
    communityReviewLink(pullRequest.repository.coordinate, pullRequest.root.id),
  );
  const status = $derived(
    pullRequest.lifecycle[0]!.toUpperCase() + pullRequest.lifecycle.slice(1),
  );
</script>

{#snippet detail(Icon: Component, label: string, value: string | number)}
  <Button
    type="button"
    variant="ghost"
    class="community-application__project-overview-item"
  >
    <Icon data-icon="inline-start" aria-hidden="true" />
    <span>{label}</span>
    <span
      class="community-application__project-overview-count"
      title={String(value)}>{value}</span
    >
  </Button>
{/snippet}

{@render detail(GitBranchIcon, "Branch", pullRequestBranchLabel(pullRequest))}
{@render detail(GitPullRequestIcon, "Status", status)}
{@render detail(UsersIcon, "Reviewers", pullRequest.reviewers.length)}
{@render detail(CircleCheckIcon, "Approvals", pullRequest.approvals.length)}
{#if link}
  <CommunityEntityCopyButton
    class="community-application__project-overview-item"
    label="Copy Link"
    success="Review link copied"
    href={link}
  />
{/if}
