<script lang="ts">
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as Collapsible from "@lapismd/design-core/shadcn/collapsible";
  import * as Select from "@lapismd/design-core/shadcn/select";
  import CheckIcon from "@lucide/svelte/icons/check";
  import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import GitMergeIcon from "@lucide/svelte/icons/git-merge";

  import { reviewerCandidates } from "../../community/channel-authority.js";
  import type { CommunityCustomEmoji } from "../../community/index.js";
  import type {
    PullRequestComment,
    PullRequestState,
  } from "../../projects/index.js";
  import CommunityChatComposer from "../community-chat-composer/CommunityChatComposer.svelte";
  import type {
    CommunityMemberModel,
    CommunityMessageModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
  import CommunityProjectsPullRequestTimelineItem from "./CommunityProjectsPullRequestTimelineItem.svelte";
  import {
    buildReviewTimeline,
    type ReviewTimelineEntry,
  } from "./pull-request-review.js";

  let {
    open = $bindable(true),
    comment = $bindable(""),
    pullRequest,
    busy = false,
    canCollaborate = false,
    canMerge = false,
    mergeError = "",
    mergeStatus = "",
    canSubmit = false,
    canComment = false,
    canUpdateLifecycle = false,
    ownerPubkeys = [],
    members = [],
    rooms = [],
    communityEmojis = [],
    currentMemberId,
    memberForPubkey,
    commentMessage,
    canReact,
    reactionOptions,
    onToggleReaction,
    onOpenProfile,
    onMessageMember,
    onWaveMember,
    onMerge,
    onSubmitReview,
    onRequestReview,
    onUpdateLifecycle,
    onSubmitComment,
  }: {
    open?: boolean | undefined;
    comment?: string | undefined;
    pullRequest: PullRequestState;
    busy?: boolean | undefined;
    canCollaborate?: boolean | undefined;
    canMerge?: boolean | undefined;
    mergeError?: string | undefined;
    mergeStatus?: string | undefined;
    canSubmit?: boolean | undefined;
    canComment?: boolean | undefined;
    canUpdateLifecycle?: boolean | undefined;
    ownerPubkeys?: readonly string[] | undefined;
    members?: readonly CommunityMemberModel[] | undefined;
    rooms?: readonly CommunityRoomModel[] | undefined;
    communityEmojis?: readonly CommunityCustomEmoji[] | undefined;
    currentMemberId?: string | undefined;
    memberForPubkey: (pubkey: string) => CommunityMemberModel;
    commentMessage: (comment: PullRequestComment) => CommunityMessageModel;
    canReact: (comment: PullRequestComment) => boolean;
    reactionOptions: (
      comment: PullRequestComment,
    ) => readonly string[] | undefined;
    onToggleReaction: (comment: PullRequestComment, emoji: string) => void;
    onOpenProfile?: ((member: CommunityMemberModel) => void) | undefined;
    onMessageMember?:
      | ((member: CommunityMemberModel) => void | Promise<void>)
      | undefined;
    onWaveMember?:
      | ((member: CommunityMemberModel) => void | Promise<void>)
      | undefined;
    onMerge: () => void;
    onSubmitReview: () => void;
    onRequestReview?: ((pubkey: string) => void) | undefined;
    onUpdateLifecycle: () => void;
    onSubmitComment: (content: string) => void;
  } = $props();

  const timeline: readonly ReviewTimelineEntry[] = $derived(
    buildReviewTimeline(pullRequest),
  );
  const requestableReviewers = $derived(
    reviewerCandidates(members, ownerPubkeys).filter(
      (member) =>
        member.id !== pullRequest.root.pubkey &&
        !pullRequest.reviewers.includes(member.id),
    ),
  );
  const canChangeLifecycle = $derived(
    canUpdateLifecycle &&
      (canSubmit || currentMemberId === pullRequest.root.pubkey),
  );
</script>

<Collapsible.Root class="community-projects__review-section" bind:open>
  <Collapsible.Trigger class="community-projects__review-section-trigger">
    <span>Activity</span>
    {#if open}
      <ChevronDownIcon aria-hidden="true" />
    {:else}
      <ChevronRightIcon aria-hidden="true" />
    {/if}
  </Collapsible.Trigger>
  <Collapsible.Content>
    <section
      class="community-projects__review-conversation"
      aria-label="Pull request conversation"
    >
      <div class="community-projects__review-timeline">
        {#each timeline as entry (`${entry.kind}:${entry.event.id}`)}
          <CommunityProjectsPullRequestTimelineItem
            {entry}
            {members}
            {rooms}
            {communityEmojis}
            {currentMemberId}
            {memberForPubkey}
            {commentMessage}
            {canReact}
            {reactionOptions}
            {onToggleReaction}
            {onOpenProfile}
            {onMessageMember}
            {onWaveMember}
          />
        {/each}
      </div>
      {#if pullRequest.lifecycle !== "merged"}
        <div class="community-projects__review-actions">
          {#if canSubmit || canMerge}
            <Button
              type="button"
              size="sm"
              disabled={!canCollaborate || busy || !canMerge}
              title={canMerge
                ? "Merge this pull request through the repository provider"
                : mergeError ||
                  "Merge requires a trusted non-author approval and advertised merge capability"}
              onclick={onMerge}
            >
              <GitMergeIcon data-icon="inline-start" aria-hidden="true" />
              {canMerge ? "Merge pull request" : "Merge unavailable"}
            </Button>
          {/if}
          <span class="community-projects__review-action-spacer"></span>
          {#if canSubmit}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canCollaborate || busy}
              onclick={onSubmitReview}
            >
              <CheckIcon data-icon="inline-start" aria-hidden="true" />
              Submit review
            </Button>
          {/if}
          {#if canChangeLifecycle}
            <Button
              type="button"
              variant={pullRequest.lifecycle === "closed"
                ? "outline"
                : "destructive"}
              size="sm"
              disabled={!canCollaborate || busy}
              onclick={onUpdateLifecycle}
              >{pullRequest.lifecycle === "closed" ? "Reopen" : "Close"}</Button
            >
          {/if}
        </div>
        {#if mergeError}
          <p class="community-projects__review-merge-error" role="alert">
            {mergeError}
          </p>
        {:else if mergeStatus}
          <p class="community-projects__review-merge-status" role="status">
            {mergeStatus}
          </p>
        {/if}
        {#if canSubmit && onRequestReview && requestableReviewers.length > 0}
          <div class="community-projects__review-request">
            <Select.Root
              type="single"
              onValueChange={(value) => {
                if (value) onRequestReview(value);
              }}
            >
              <Select.Trigger
                aria-label="Request review from a maintainer or path owner"
              >
                Request review
              </Select.Trigger>
              <Select.Content>
                <Select.Group>
                  {#each requestableReviewers as reviewer (reviewer.id)}
                    <Select.Item value={reviewer.id} label={reviewer.name}
                      >{reviewer.name}</Select.Item
                    >
                  {/each}
                </Select.Group>
              </Select.Content>
            </Select.Root>
          </div>
        {/if}
        {#if canComment}
          <CommunityChatComposer
            class="community-projects__conversation-composer"
            bind:value={comment}
            placeholder="Add to the review conversation"
            ariaLabel="Pull request comment"
            submitLabel="Comment"
            {members}
            {rooms}
            {communityEmojis}
            {...currentMemberId === undefined ? {} : { currentMemberId }}
            {busy}
            disabled={!canCollaborate}
            disabledReason="Sign in to comment on this review"
            onSubmit={(submission) => onSubmitComment(submission.content)}
          />
        {/if}
      {/if}
    </section>
  </Collapsible.Content>
</Collapsible.Root>
