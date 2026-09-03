<script lang="ts">
  import * as Card from "@lapismd/design-core/shadcn/card";

  import CommunitySummary from "../community-summary/CommunitySummary.svelte";
  import DiscussionComposer from "../discussion-composer/DiscussionComposer.svelte";
  import DiscussionPostStream from "../discussion-post-stream/DiscussionPostStream.svelte";
  import DiscussionTimeline from "../discussion-timeline/DiscussionTimeline.svelte";
  import PluginReactionControl from "../plugin-reaction-control/PluginReactionControl.svelte";
  import type { RegistryCommunityController } from "./registry-community-controller.svelte.js";

  let { controller }: { controller: RegistryCommunityController } = $props();

  const name = $derived(controller.name);
  const commentTotal = $derived(controller.commentTotal);
  const reviews = $derived(controller.reviews);
  const allReviews = $derived(controller.allReviews);
  const reactions = $derived(controller.reactions);
  const profiles = $derived(controller.profiles);
  const pageStartIndex = $derived(controller.pageStartIndex);
  const pageEndIndex = $derived(controller.pageEndIndex);
  const loading = $derived(controller.loading);
  const loadingJump = $derived(controller.loadingJump);
  const loadingPrevious = $derived(controller.loadingPrevious);
  const loadingNext = $derived(controller.loadingNext);
  const error = $derived(controller.error);
  const message = $derived(controller.message);
  const participantCount = $derived(controller.participantCount);
  const currentPluginReactions = $derived(controller.currentPluginReactions);
  const pluginReactionSummary = $derived(controller.pluginReactionSummary);
  const publishing = $derived(controller.publishing);
  const pluginRelease = $derived(controller.pluginRelease);
  const ownPluginReaction = $derived(controller.ownPluginReaction);
  const replyingReview = $derived(controller.replyingReview);
  const signedInPubkey = $derived(controller.signedInPubkey);
  const activeGlobalPostIndex = $derived(controller.activeGlobalPostIndex);
  const activePostId = $derived(controller.activePostId);
  const scrollTargetPostId = $derived(controller.scrollTargetPostId);
  const scrollRevision = $derived(controller.scrollRevision);
  const hasPrevious = $derived(controller.hasPrevious);
  const hasNext = $derived(controller.hasNext);
  const previousError = $derived(controller.previousError);
  const nextError = $derived(controller.nextError);
  const threadFirstTimestamp = $derived(controller.threadFirstTimestamp);
  const threadLastTimestamp = $derived(controller.threadLastTimestamp);
  const activePostTimestamp = $derived(controller.activePostTimestamp);
  const timelineReturnIndex = $derived(controller.timelineReturnIndex);
  const commentPageSize = $derived(controller.commentPageSize);
  let composerElement = $state<HTMLDivElement>();

  $effect(() => {
    controller.composerElement = composerElement;
  });

  const submitPluginReaction = (emoji: string) =>
    controller.submitPluginReaction(emoji);
  const postNumber = (eventId: string) => controller.postNumber(eventId);
  const handleCurrentPost = (eventId: string) =>
    controller.handleCurrentPost(eventId);
  const loadAdjacent = (direction: "prepend" | "append") =>
    controller.loadAdjacent(direction);
  const navigateToReview: RegistryCommunityController["navigateToReview"] = (
    review,
  ) => controller.navigateToReview(review);
  const startReply: RegistryCommunityController["startReply"] = (review) =>
    controller.startReply(review);
  const submitReaction: RegistryCommunityController["submitReaction"] = (
    review,
    content,
  ) => controller.submitReaction(review, content);
  const navigateTimelineToIndex = (index: number) =>
    controller.navigateTimelineToIndex(index);
  const returnToTimelineOrigin = () => controller.returnToTimelineOrigin();
</script>

<section
  class="community"
  aria-label={`${name} community discussion`}
  data-design-core="0.1.0"
  data-comment-total={commentTotal}
  data-loaded-comments={reviews.length}
  data-page-start={pageStartIndex}
  data-page-end={pageEndIndex}
>
  <Card.Root class="community-card">
    <Card.Content class="community-content">
      <CommunitySummary
        posts={commentTotal}
        reactions={reactions.length}
        participants={participantCount}
        pluginReactions={currentPluginReactions.length}
      />

      <PluginReactionControl
        summary={pluginReactionSummary}
        bind:selected={controller.selectedPluginReaction}
        {publishing}
        releaseAvailable={pluginRelease !== undefined}
        hasOwnReaction={ownPluginReaction !== undefined}
        onSubmit={submitPluginReaction}
      />

      {#if error}
        <p class="notice error" role="alert">{error}</p>
      {:else if message}
        <p class="notice" role="status">{message}</p>
      {/if}

      <div
        class="discussion"
        class:discussion--with-timeline={commentTotal > 1 &&
          threadFirstTimestamp > 0 &&
          threadLastTimestamp > 0}
        aria-busy={loading || loadingJump || loadingPrevious || loadingNext}
      >
        <div class="topic-column">
          <DiscussionComposer
            bind:element={composerElement}
            {name}
            replyingTo={replyingReview}
            {profiles}
            {postNumber}
            {signedInPubkey}
            {publishing}
            bind:comment={controller.comment}
            onCancel={controller.cancelReply}
            onSubmit={controller.submitComment}
          />

          {#if loading}
            <p class="empty">Reading signed events from the relay…</p>
          {:else if reviews.length > 0}
            <DiscussionPostStream
              posts={reviews}
              contextPosts={allReviews}
              {reactions}
              {profiles}
              startIndex={pageStartIndex}
              total={commentTotal}
              {activePostId}
              targetPostId={scrollTargetPostId}
              {scrollRevision}
              {publishing}
              {hasPrevious}
              {hasNext}
              {loadingPrevious}
              {loadingNext}
              {previousError}
              {nextError}
              onCurrentPost={handleCurrentPost}
              onPrepend={() => loadAdjacent("prepend")}
              onAppend={() => loadAdjacent("append")}
              onNavigate={navigateToReview}
              onReply={startReply}
              onReact={submitReaction}
            />
          {/if}
        </div>

        {#if commentTotal > 1 && threadFirstTimestamp > 0 && threadLastTimestamp > 0}
          <DiscussionTimeline
            total={commentTotal}
            currentIndex={activeGlobalPostIndex}
            currentTimestamp={activePostTimestamp}
            firstTimestamp={threadFirstTimestamp}
            lastTimestamp={threadLastTimestamp}
            returnIndex={timelineReturnIndex}
            disabled={loadingJump}
            pageSize={commentPageSize}
            onJump={navigateTimelineToIndex}
            onReturn={returnToTimelineOrigin}
          />
        {/if}
      </div>
    </Card.Content>
  </Card.Root>
</section>

<style>
  :host {
    display: block;
    color: var(--foreground);
    font-family: "DM Sans", ui-sans-serif, system-ui, sans-serif;
  }

  * {
    box-sizing: border-box;
  }

  :global(.community-card) {
    overflow: visible;
  }

  :global(.community-content) {
    display: grid;
    gap: 1.4rem;
  }

  .notice,
  .empty {
    margin: 0;
    color: var(--muted-foreground);
    font-size: 0.9rem;
  }

  .notice {
    border-left: 3px solid var(--primary);
    padding: 0.6rem 0.8rem;
    background: var(--secondary);
  }

  .notice.error {
    border-color: var(--destructive);
  }

  .discussion {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .discussion--with-timeline {
    grid-template-columns: minmax(0, 1fr) 9rem;
    gap: clamp(1.5rem, 4vw, 3.5rem);
  }

  .topic-column {
    min-width: 0;
  }

  @media (max-width: 62rem) {
    .discussion {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
