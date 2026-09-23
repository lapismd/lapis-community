<script lang="ts">
  import CheckIcon from "@lucide/svelte/icons/check";
  import CircleDashedIcon from "@lucide/svelte/icons/circle-dashed";
  import CircleXIcon from "@lucide/svelte/icons/circle-x";
  import GitMergeIcon from "@lucide/svelte/icons/git-merge";
  import GitPullRequestIcon from "@lucide/svelte/icons/git-pull-request";
  import MessageSquareIcon from "@lucide/svelte/icons/message-square";
  import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
  import UserRoundPlusIcon from "@lucide/svelte/icons/user-round-plus";

  import type { CommunityCustomEmoji } from "../../community/index.js";
  import type { PullRequestComment } from "../../projects/index.js";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityMessage from "../community-message/CommunityMessage.svelte";
  import CommunityRelativeTime from "../community-relative-time/CommunityRelativeTime.svelte";
  import type {
    CommunityMemberModel,
    CommunityMessageModel,
    CommunityRoomModel,
  } from "../community-workspace/model.js";
  import CommunityProjectsMemberHover from "./CommunityProjectsMemberHover.svelte";
  import {
    pullRequestEventTagValue,
    reviewCommentDecision,
    reviewHasExternalActor,
    reviewLifecycleAction,
    reviewRequestTargetLabel,
    reviewTimelineActorLabel,
    type ReviewTimelineEntry,
  } from "./pull-request-review.js";

  let {
    entry,
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
  }: {
    entry: ReviewTimelineEntry;
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
  } = $props();

  const actorMember = $derived(
    reviewHasExternalActor(entry.event)
      ? undefined
      : memberForPubkey(entry.event.pubkey),
  );
  const actorLabel = $derived(
    reviewTimelineActorLabel(
      entry.event,
      memberForPubkey(entry.event.pubkey).name,
    ),
  );
  const timelineDecision = $derived(
    entry.kind === "comment" ? reviewCommentDecision(entry.comment) : undefined,
  );
</script>

<article
  class="community-projects__review-timeline-item"
  data-kind={entry.kind}
>
  <span
    class="community-projects__review-timeline-marker"
    data-status={entry.kind === "lifecycle" ? entry.lifecycle : entry.kind}
  >
    {#if entry.kind === "opened"}
      <GitPullRequestIcon aria-hidden="true" />
    {:else if entry.kind === "review-request"}
      <UserRoundPlusIcon aria-hidden="true" />
    {:else if entry.kind === "lifecycle" && entry.lifecycle === "merged"}
      <GitMergeIcon aria-hidden="true" />
    {:else if entry.kind === "lifecycle" && entry.lifecycle === "closed"}
      <CircleXIcon aria-hidden="true" />
    {:else if entry.kind === "lifecycle" && entry.lifecycle === "draft"}
      <CircleDashedIcon aria-hidden="true" />
    {:else if entry.kind === "lifecycle"}
      <RotateCcwIcon aria-hidden="true" />
    {:else if entry.kind === "comment" && reviewCommentDecision(entry.comment) === "approved"}
      <CheckIcon aria-hidden="true" />
    {:else if entry.kind === "comment" && reviewCommentDecision(entry.comment) === "changes-requested"}
      <CircleXIcon aria-hidden="true" />
    {:else}
      <MessageSquareIcon aria-hidden="true" />
    {/if}
  </span>
  <div class="community-projects__review-timeline-content">
    {#if entry.kind === "opened"}
      <div class="community-projects__review-timeline-summary">
        <span class="community-projects__review-timeline-sentence">
          {#if actorMember}
            <CommunityProjectsMemberHover
              member={actorMember}
              trigger="mention"
              triggerLabel={actorLabel}
              {onOpenProfile}
              {onMessageMember}
              {onWaveMember}
            />
          {:else}
            <strong>{actorLabel}</strong>
          {/if}
          <span>opened this review</span>
        </span>
        <CommunityRelativeTime timestamp={entry.event.created_at} />
      </div>
    {:else if entry.kind === "review-request"}
      {@const targetMember = pullRequestEventTagValue(
        entry.comment.event,
        "external-reviewer",
      )
        ? undefined
        : entry.comment.reviewerPubkeys[0]
          ? memberForPubkey(entry.comment.reviewerPubkeys[0])
          : undefined}
      {@const targetLabel = reviewRequestTargetLabel(
        entry.comment,
        targetMember?.name,
      )}
      <div class="community-projects__review-timeline-summary">
        <span class="community-projects__review-timeline-sentence">
          {#if actorMember}
            <CommunityProjectsMemberHover
              member={actorMember}
              trigger="mention"
              triggerLabel={actorLabel}
              {onOpenProfile}
              {onMessageMember}
              {onWaveMember}
            />
          {:else}
            <strong>{actorLabel}</strong>
          {/if}
          <span>requested a review from</span>
          {#if targetMember}
            <CommunityProjectsMemberHover
              member={targetMember}
              trigger="mention"
              triggerLabel={targetLabel}
              {onOpenProfile}
              {onMessageMember}
              {onWaveMember}
            />
          {:else}
            <strong>{targetLabel}</strong>
          {/if}
        </span>
        <CommunityRelativeTime timestamp={entry.event.created_at} />
      </div>
    {:else if entry.kind === "lifecycle"}
      <div class="community-projects__review-timeline-summary">
        <span class="community-projects__review-timeline-sentence">
          {#if actorMember}
            <CommunityProjectsMemberHover
              member={actorMember}
              trigger="mention"
              triggerLabel={actorLabel}
              {onOpenProfile}
              {onMessageMember}
              {onWaveMember}
            />
          {:else}
            <strong>{actorLabel}</strong>
          {/if}
          <span>{reviewLifecycleAction(entry)}</span>
        </span>
        <CommunityRelativeTime timestamp={entry.event.created_at} />
      </div>
      {#if entry.mergeCommit}
        <code class="community-projects__review-timeline-commit"
          >{entry.mergeCommit.slice(0, 8)}</code
        >
      {/if}
    {:else}
      {@const comment = entry.comment}
      {@const commentReactionOptions = reactionOptions(comment)}
      {#snippet reviewLabels()}
        <div class="community-projects__message-labels">
          {#if timelineDecision}<CommunityChip
              size="compact"
              tone={timelineDecision === "approved" ? "success" : "warning"}
              >{timelineDecision}</CommunityChip
            >{/if}
          {#if comment.inlineStatus}<CommunityChip size="compact"
              >{comment.inlineStatus}</CommunityChip
            >{/if}
        </div>
      {/snippet}
      <CommunityMessage
        message={commentMessage(comment)}
        author={memberForPubkey(comment.event.pubkey)}
        {members}
        {rooms}
        {communityEmojis}
        {...currentMemberId === undefined ? {} : { currentMemberId }}
        supplement={reviewLabels}
        density="compact"
        {...canReact(comment)
          ? {
              onAddReaction: (_messageId: string, emoji: string) =>
                onToggleReaction(comment, emoji),
              onToggleReaction: (_messageId: string, emoji: string) =>
                onToggleReaction(comment, emoji),
            }
          : {}}
        {...commentReactionOptions === undefined
          ? {}
          : { reactionOptions: commentReactionOptions }}
      />
    {/if}
  </div>
</article>
