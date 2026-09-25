<script lang="ts">
  import * as Collapsible from "@lapismd/design-core/shadcn/collapsible";
  import * as Empty from "@lapismd/design-core/shadcn/empty";
  import CircleDashedIcon from "@lucide/svelte/icons/circle-dashed";
  import GitBranchIcon from "@lucide/svelte/icons/git-branch";
  import MessageSquareIcon from "@lucide/svelte/icons/message-square";

  import { encodeProjectListCursor } from "../../projects/index.js";
  import type { PullRequestState } from "../../projects/index.js";
  import CommunityRelativeTime from "../community-relative-time/CommunityRelativeTime.svelte";
  import type { CommunityMemberModel } from "../community-workspace/model.js";
  import CommunityProjectsMemberHover from "./CommunityProjectsMemberHover.svelte";
  import CommunityProjectsReviewStatusIcon from "./CommunityProjectsReviewStatusIcon.svelte";
  import { REVIEW_GROUP_LABELS } from "./pull-request-review.js";
  import CommunityProjectsVirtualRows from "./CommunityProjectsVirtualRows.svelte";
  import { estimateCommunityProjectRow } from "./virtual-project-row-estimates.js";

  let {
    pullRequests = [],
    listLayout = "list",
    groupOpen = $bindable({
      open: true,
      draft: true,
      merged: true,
      closed: true,
    }),
    memberForPubkey,
    onOpenProfile,
    onMessageMember,
    onWaveMember,
    onSelectPullRequest,
    projectFilter,
    onLoadMore,
    onVisibleCursorChange,
    hasMore = false,
    loading = false,
  }: {
    pullRequests?: readonly PullRequestState[] | undefined;
    listLayout?: "grid" | "list" | undefined;
    groupOpen?: Record<string, boolean> | undefined;
    memberForPubkey: (pubkey: string) => CommunityMemberModel;
    onOpenProfile?: ((member: CommunityMemberModel) => void) | undefined;
    onMessageMember?:
      | ((member: CommunityMemberModel) => void | Promise<void>)
      | undefined;
    onWaveMember?:
      | ((member: CommunityMemberModel) => void | Promise<void>)
      | undefined;
    onSelectPullRequest?: ((pullRequest: PullRequestState) => void) | undefined;
    projectFilter?: ((pullRequest: PullRequestState) => boolean) | undefined;
    onLoadMore?: (() => void) | undefined;
    onVisibleCursorChange?: ((cursor: string | undefined) => void) | undefined;
    hasMore?: boolean | undefined;
    loading?: boolean | undefined;
  } = $props();
  function reviewEstimate(pullRequest: PullRequestState | undefined): number {
    return estimateCommunityProjectRow(
      pullRequest
        ? {
            kind: "review",
            text: pullRequest.title,
            detail: pullRequest.branchName,
          }
        : undefined,
    );
  }

  function reviewCursor(pullRequest: PullRequestState): string | undefined {
    return encodeProjectListCursor(
      /^[a-f0-9]{64}$/u.test(pullRequest.root.id)
        ? {
            kind: "event",
            createdAt: pullRequest.updatedAt,
            eventId: pullRequest.root.id,
          }
        : { kind: "row", id: pullRequest.root.id },
    );
  }
</script>

{#snippet reviewRow(pullRequest: PullRequestState)}
  {@const author = memberForPubkey(pullRequest.root.pubkey)}
  <article class="community-projects__review-row">
    <CommunityProjectsReviewStatusIcon lifecycle={pullRequest.lifecycle} />
    <button
      type="button"
      class="community-projects__review-row-title"
      onclick={() => onSelectPullRequest?.(pullRequest)}
      >{pullRequest.title}</button
    >
    <button
      type="button"
      class="community-projects__review-row-id"
      title="View review"
      onclick={() => onSelectPullRequest?.(pullRequest)}
      >#{pullRequest.root.id.slice(0, 8)}</button
    >
    <span class="community-projects__review-row-branch">
      <span aria-hidden="true">›</span>
      <GitBranchIcon aria-hidden="true" />
      <span
        >{pullRequest.branchName || pullRequest.currentCommit.slice(0, 7)}</span
      >
    </span>
    <span
      class="community-projects__review-row-comments"
      title={`${pullRequest.comments.length} comments`}
    >
      <MessageSquareIcon aria-hidden="true" />
      {pullRequest.comments.length}
    </span>
    <CommunityProjectsMemberHover
      member={author}
      {onOpenProfile}
      {onMessageMember}
      {onWaveMember}
    />
    <CommunityRelativeTime timestamp={pullRequest.updatedAt} />
  </article>
{/snippet}

{#if pullRequests.length === 0}
  <Empty.Root
    class="community-projects__empty community-projects__review-empty"
  >
    <Empty.Header>
      <Empty.Media variant="icon"
        ><CircleDashedIcon aria-hidden="true" /></Empty.Media
      >
      <Empty.Title>No reviews yet</Empty.Title>
    </Empty.Header>
  </Empty.Root>
{:else}
  <div class="community-projects__review-groups" data-layout={listLayout}>
    {#each REVIEW_GROUP_LABELS as group (group.lifecycle)}
      {@const groupedReviews = pullRequests.filter(
        (pullRequest) =>
          pullRequest.lifecycle === group.lifecycle &&
          (projectFilter?.(pullRequest) ?? true),
      )}
      {#if groupedReviews.length > 0}
        <Collapsible.Root
          open={groupOpen[group.lifecycle] ?? false}
          onOpenChange={(open) => (groupOpen[group.lifecycle] = open)}
        >
          <Collapsible.Trigger class="community-projects__review-group-heading">
            <CommunityProjectsReviewStatusIcon lifecycle={group.lifecycle} />
            <span>{group.label}</span>
            {#if !groupOpen[group.lifecycle]}
              <span>{groupedReviews.length}</span>
            {/if}
          </Collapsible.Trigger>
          <Collapsible.Content class="community-projects__review-group-list">
            <CommunityProjectsVirtualRows
              rows={groupedReviews}
              row={reviewRow}
              estimateSize={reviewEstimate}
              cursorForRow={reviewCursor}
              getKey={(pullRequest) => pullRequest.root.id}
              {loading}
              {hasMore}
              {onLoadMore}
              {onVisibleCursorChange}
            />
          </Collapsible.Content>
        </Collapsible.Root>
      {/if}
    {/each}
  </div>
{/if}
