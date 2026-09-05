<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import * as Card from "@lapismd/design-core/shadcn/card";
  import { Skeleton } from "@lapismd/design-core/shadcn/skeleton";

  import CommunitySummary from "../community-summary/CommunitySummary.svelte";
  import DiscussionComposer from "../discussion-composer/DiscussionComposer.svelte";
  import DiscussionPostStream from "../discussion-post-stream/DiscussionPostStream.svelte";
  import DiscussionTimeline from "../discussion-timeline/DiscussionTimeline.svelte";
  import PluginReactionControl from "../plugin-reaction-control/PluginReactionControl.svelte";
  import { useRegistryDiscussionIsolation } from "../registry-plugin-detail/discussion-isolation-context.js";
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
  const composerStatus = $derived(
    controller.commentError !== ""
      ? { type: "error" as const, message: controller.commentError }
      : undefined,
  );
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
  const isolation = useRegistryDiscussionIsolation();

  $effect(() => {
    controller.composerElement = composerElement;
  });

  $effect(() => {
    isolation?.setIsolated(hasPrevious);
  });

  onDestroy(() => isolation?.setIsolated(false));

  const submitPluginReaction = (emoji: string) =>
    controller.submitPluginReaction(emoji);
  const postNumber = (eventId: string) => controller.postNumber(eventId);
  const handleCurrentPost = (eventId: string, globalIndex: number) =>
    controller.handleCurrentPost(eventId, globalIndex);
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
  async function waitForTargetScroll(): Promise<void> {
    await tick();
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
  }
  const navigateTimelineToIndex = async (index: number) => {
    await controller.navigateTimelineToIndex(index);
    await waitForTargetScroll();
  };
  const returnToTimelineOrigin = async () => {
    await controller.returnToTimelineOrigin();
    await waitForTargetScroll();
  };
</script>

{#snippet postStreamSkeleton()}
  <div
    class="discussion-seek-skeleton"
    role="status"
    aria-label="Loading discussion posts"
  >
    <span class="sr-only">Loading discussion posts…</span>
    {#each Array.from({ length: 4 }) as _, index}
      <div class="discussion-seek-skeleton__row">
        <Skeleton class="discussion-seek-skeleton__avatar" />
        <div>
          <Skeleton class="discussion-seek-skeleton__name" />
          <Skeleton class="discussion-seek-skeleton__line" />
          {#if index % 2 === 0}
            <Skeleton class="discussion-seek-skeleton__line short" />
          {/if}
        </div>
      </div>
    {/each}
  </div>
{/snippet}

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

      {#if error && composerStatus === undefined}
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
            {...composerStatus === undefined ? {} : { composerStatus }}
            onDismissComposerStatus={controller.dismissError}
            bind:comment={controller.comment}
            onCancel={controller.cancelReply}
            onSubmit={controller.submitComment}
          />

          {#if loading}
            <p class="empty">Reading signed events from the relay…</p>
          {:else if loadingJump}
            {@render postStreamSkeleton()}
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

  .discussion-seek-skeleton {
    display: grid;
    min-height: min(42rem, 70vh);
    margin-top: 1.25rem;
  }

  .discussion-seek-skeleton__row {
    display: grid;
    grid-template-columns: 2.5rem minmax(0, 1fr);
    gap: 0.9rem;
    align-content: start;
    padding: 1.5rem 0;
    border-top: 1px solid var(--border);
  }

  .discussion-seek-skeleton__row > div {
    display: grid;
    gap: 0.65rem;
    align-content: start;
  }

  :global(.discussion-seek-skeleton__avatar) {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 999px;
  }

  :global(.discussion-seek-skeleton__name) {
    width: 8rem;
    height: 1rem;
  }

  :global(.discussion-seek-skeleton__line) {
    width: min(100%, 34rem);
    height: 0.9rem;
  }

  :global(.discussion-seek-skeleton__line.short) {
    width: min(68%, 22rem);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  @media (max-width: 62rem) {
    .discussion {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
