<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Collapsible from "@lapismd/design-core/shadcn/collapsible";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import CopyIcon from "@lucide/svelte/icons/copy";
  import GitBranchIcon from "@lucide/svelte/icons/git-branch";
  import GitMergeIcon from "@lucide/svelte/icons/git-merge";
  import GitPullRequestIcon from "@lucide/svelte/icons/git-pull-request";
  import UserIcon from "@lucide/svelte/icons/user";

  import type { CommunityCustomEmoji } from "../../community/index.js";
  import type {
    ProjectForgePullRequestDiff,
    PullRequestState,
  } from "../../projects/index.js";
  import CommunityMarkdownContent from "../community-markdown-content/CommunityMarkdownContent.svelte";
  import type {
    CommunityMemberModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
  import CommunityProjectsMemberHover from "./CommunityProjectsMemberHover.svelte";
  import { REVIEW_GROUP_LABELS } from "./pull-request-review.js";

  let {
    descriptionOpen = $bindable(true),
    pullRequest,
    diff,
    members = [],
    rooms = [],
    communityEmojis = [],
    memberForPubkey,
    onOpenProfile,
    onMessageMember,
    onWaveMember,
    onCopyCommit,
  }: {
    descriptionOpen?: boolean | undefined;
    pullRequest: PullRequestState;
    diff?: ProjectForgePullRequestDiff | undefined;
    members?: readonly CommunityMemberModel[] | undefined;
    rooms?: readonly CommunityRoomModel[] | undefined;
    communityEmojis?: readonly CommunityCustomEmoji[] | undefined;
    memberForPubkey: (pubkey: string) => CommunityMemberModel;
    onOpenProfile?: ((member: CommunityMemberModel) => void) | undefined;
    onMessageMember?: ((member: CommunityMemberModel) => void | Promise<void>) | undefined;
    onWaveMember?: ((member: CommunityMemberModel) => void | Promise<void>) | undefined;
    onCopyCommit: (hash: string) => void;
  } = $props();

  const statusLabel = $derived(
    REVIEW_GROUP_LABELS.find(
      (group) => group.lifecycle === pullRequest.lifecycle,
    )?.label ?? pullRequest.lifecycle,
  );
</script>

<dl class="community-projects__review-meta">
  <div>
    <dt><GitBranchIcon aria-hidden="true" /><span>Branch</span></dt>
    <dd class="community-projects__review-branch">
      <span>{pullRequest.branchName || "unknown branch"}</span>
      <span aria-hidden="true">→</span>
      <span>{pullRequest.targetBranch || "default branch"}</span>
      {#if diff}
        <span class="community-projects__review-stats">
          <span
            >+{diff.files.reduce(
              (total, file) => total + file.additions,
              0,
            )}</span
          >
          <span
            >-{diff.files.reduce(
              (total, file) => total + file.deletions,
              0,
            )}</span
          >
        </span>
      {/if}
      <code title={pullRequest.currentCommit}
        >{pullRequest.currentCommit.slice(0, 7)}</code
      >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        class="community-projects__copy-control"
        aria-label="Copy commit hash"
        title="Copy commit hash"
        onclick={() => onCopyCommit(pullRequest.currentCommit)}
        ><CopyIcon aria-hidden="true" /></Button
      >
    </dd>
  </div>
  <div>
    <dt><UserIcon aria-hidden="true" /><span>Reviewers</span></dt>
    <dd class="community-projects__review-reviewers">
      {#each pullRequest.reviewers as reviewer (reviewer)}
        {@const reviewerMember = memberForPubkey(reviewer)}
        <CommunityProjectsMemberHover
          member={reviewerMember}
          {onOpenProfile}
          {onMessageMember}
          {onWaveMember}
        />
        <span>{reviewerMember.name}</span>
      {:else}
        <span class="community-projects__muted">No reviewers</span>
      {/each}
    </dd>
  </div>
  <div>
    <dt>
      {#if pullRequest.lifecycle === "merged"}
        <GitMergeIcon aria-hidden="true" />
      {:else}
        <GitPullRequestIcon aria-hidden="true" />
      {/if}
      <span>Status</span>
    </dt>
    <dd class="community-projects__review-status" data-status={pullRequest.lifecycle}>
      {statusLabel}
    </dd>
  </div>
</dl>

{#if pullRequest.content}
  <Collapsible.Root
    class="community-projects__review-section"
    bind:open={descriptionOpen}
  >
    <Collapsible.Trigger class="community-projects__review-section-trigger">
      <span>Description</span>
      {#if descriptionOpen}
        <ChevronDownIcon aria-hidden="true" />
      {:else}
        <ChevronRightIcon aria-hidden="true" />
      {/if}
    </Collapsible.Trigger>
    <Collapsible.Content class="community-projects__review-section-content">
      <CommunityMarkdownContent
        content={pullRequest.content}
        {members}
        {rooms}
        {communityEmojis}
      />
    </Collapsible.Content>
  </Collapsible.Root>
{/if}
