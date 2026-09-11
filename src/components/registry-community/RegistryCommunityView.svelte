<script lang="ts">
  import { onDestroy, tick, untrack } from "svelte";
  import * as Card from "@lapismd/design-core/shadcn/card";
  import { Button } from "@lapismd/design-core/shadcn/button";
  import * as ButtonGroup from "@lapismd/design-core/shadcn/button-group";
  import { Skeleton } from "@lapismd/design-core/shadcn/skeleton";
  import * as Tooltip from "@lapismd/design-core/shadcn/tooltip";
  import BellIcon from "@lucide/svelte/icons/bell";
  import BellRingIcon from "@lucide/svelte/icons/bell-ring";
  import BookmarkIcon from "@lucide/svelte/icons/bookmark";
  import BookmarkCheckIcon from "@lucide/svelte/icons/bookmark-check";
  import MessageSquareReplyIcon from "@lucide/svelte/icons/message-square-reply";

  import { createBrowserCommunityComposerDraftStore } from "../community-chat-composer/browser-draft-store.js";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunitySummary from "../community-summary/CommunitySummary.svelte";
  import DiscussionComposer from "../discussion-composer/DiscussionComposer.svelte";
  import type { DiscussionComposerPresentation } from "../discussion-composer/model.js";
  import DiscussionPostStream from "../discussion-post-stream/DiscussionPostStream.svelte";
  import DiscussionTimeline from "../discussion-timeline/DiscussionTimeline.svelte";
  import ForumTopicList from "../forum-topic-list/ForumTopicList.svelte";
  import type {
    CommunityMemberModel,
    CommunityTopicModel,
  } from "../community-workspace/model.js";
  import { useRegistryDiscussionIsolation } from "../registry-plugin-detail/discussion-isolation-context.js";
  import { initials } from "./model.js";
  import type { RegistryCommunityController } from "./registry-community-controller.svelte.js";

  let {
    controller,
    showSummary = true,
    onOpenProfile,
    onMessageMember,
    onWaveMember,
  }: {
    controller: RegistryCommunityController;
    showSummary?: boolean;
    onOpenProfile?: (member: CommunityMemberModel) => void;
    onMessageMember?: (member: CommunityMemberModel) => void | Promise<void>;
    onWaveMember?: (member: CommunityMemberModel) => void | Promise<void>;
  } = $props();

  const name = $derived(controller.name);
  const commentTotal = $derived(controller.commentTotal);
  const commentTotalApproximate = $derived(controller.commentTotalApproximate);
  const commentCountAvailable = $derived(controller.commentCountAvailable);
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
  const publishing = $derived(controller.publishing);
  const replyingReview = $derived(controller.replyingReview);
  const editingReview = $derived(controller.editingReview);
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
  const followed = $derived(controller.followed);
  const bookmarked = $derived(controller.bookmarked);
  const unreadPostCount = $derived(controller.unreadPostCount);
  const suggestedTopics = $derived(controller.suggestedTopics);
  const suggestionsLoading = $derived(controller.suggestionsLoading);
  const activeRootEventId = $derived(controller.activeRootEventId);
  const suggestedTopicModels = $derived<CommunityTopicModel[]>(
    suggestedTopics.map((topic) => ({
      id: topic.post.event.id,
      title: topic.title,
      excerpt: topic.post.content,
      authorId: topic.post.event.pubkey,
      replyCount: topic.replyCount ?? 0,
      replyCountAvailable: topic.replyCount !== undefined,
      ...(topic.replyCountApproximate === undefined
        ? {}
        : { replyCountApproximate: topic.replyCountApproximate }),
      participantIds: [topic.post.event.pubkey],
      lastActivityLabel: formatActivity(topic.activityTimestamp),
      unread: topic.unread,
      isNew: topic.isNew,
    })),
  );
  const suggestedTopicMembers = $derived<CommunityMemberModel[]>(
    suggestedTopics.map((topic) => {
      const profile = profiles.get(topic.post.event.pubkey);
      const displayName = profile?.name ?? topic.author;
      return {
        id: topic.post.event.pubkey,
        name: displayName,
        handle: topic.post.event.pubkey.slice(0, 12),
        initials: initials(displayName),
        ...(profile?.picture === undefined
          ? {}
          : { avatarUrl: profile.picture }),
      };
    }),
  );
  let composerPresentation = $state<DiscussionComposerPresentation>("closed");
  let composerHeight = $state(untrack(() => controller.composerHeight));
  const draftStore = untrack(() =>
    typeof window === "undefined"
      ? undefined
      : createBrowserCommunityComposerDraftStore(),
  );
  const isolation = useRegistryDiscussionIsolation();

  $effect(() => {
    isolation?.setIsolated(hasPrevious && pageStartIndex > 0);
  });

  $effect(() => {
    if (composerPresentation !== "closed") return;
    composerHeight = controller.composerHeight;
  });

  $effect(() => {
    activeRootEventId;
    if (hasNext || reviews.length === 0) return;
    untrack(() => void controller.loadSuggestedTopics());
  });

  onDestroy(() => isolation?.setIsolated(false));

  const postNumber = (eventId: string) => controller.postNumber(eventId);
  const handleCurrentPost = (eventId: string, globalIndex: number) =>
    controller.handleCurrentPost(eventId, globalIndex);
  const loadAdjacent = (direction: "prepend" | "append") =>
    controller.loadAdjacent(direction);
  const navigateToReview: RegistryCommunityController["navigateToReview"] = (
    review,
  ) => controller.navigateToReview(review);
  const startReply: RegistryCommunityController["startReply"] = (review) => {
    controller.startReply(review);
    composerPresentation = "open";
  };
  const startEdit: RegistryCommunityController["startEdit"] = (review) => {
    controller.startEdit(review);
    composerPresentation = "open";
  };
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

  function openComposer(): void {
    composerPresentation = "open";
  }

  function formatActivity(timestamp: number): string {
    return new Intl.DateTimeFormat(undefined, {
      day: "numeric",
      month: "short",
    }).format(new Date(timestamp * 1_000));
  }

  function openSuggestedTopic(topicId: string): void {
    const topic = suggestedTopics.find(
      (candidate) => candidate.post.event.id === topicId,
    );
    if (topic !== undefined) void navigateToReview(topic.post);
  }
</script>

{#snippet suggestionsHeading()}
  <h2 class="discussion-suggestions__title">New &amp; Unread Topics</h2>
{/snippet}

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

{#snippet timelineActions()}
  <Tooltip.Provider>
    <ButtonGroup.Root aria-label="Discussion timeline actions">
      <Tooltip.Root>
        <Tooltip.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Reply to this discussion"
              onclick={openComposer}
            >
              <MessageSquareReplyIcon aria-hidden="true" />
            </Button>
          {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content side="left">Reply to this discussion</Tooltip.Content>
      </Tooltip.Root>
      <Tooltip.Root>
        <Tooltip.Trigger>
          {#snippet child({ props })}
            <Button
              {...props}
              class="timeline-follow-action"
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={followed
                ? "Stop following this discussion"
                : "Follow new activity"}
              aria-pressed={followed}
              onclick={controller.toggleFollow}
            >
              {#if followed}
                <BellRingIcon aria-hidden="true" />
              {:else}
                <BellIcon aria-hidden="true" />
              {/if}
              {#if unreadPostCount > 0}
                <CommunityChip
                  class="timeline-follow-action__count"
                  variant="solid"
                  tone="accent"
                  size="indicator"
                  ariaLabel={`${unreadPostCount} unread posts`}
                >
                  {unreadPostCount > 9 ? "9+" : unreadPostCount}
                </CommunityChip>
              {/if}
            </Button>
          {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Content side="left">
          {followed ? "Stop following this discussion" : "Follow new activity"}
        </Tooltip.Content>
      </Tooltip.Root>
    </ButtonGroup.Root>
  </Tooltip.Provider>
{/snippet}

<section
  class="community"
  aria-label={`${name} community discussion`}
  data-design-core="0.1.0"
  data-comment-total={commentTotal}
  data-comment-total-approximate={commentTotalApproximate}
  data-comment-count-available={commentCountAvailable}
  data-loaded-comments={reviews.length}
  data-page-start={pageStartIndex}
  data-page-end={pageEndIndex}
>
  <Card.Root class="community-card">
    <Card.Content class="community-content">
      {#if showSummary}
        <CommunitySummary
          posts={commentCountAvailable ? commentTotal : reviews.length}
          postsApproximate={commentTotalApproximate}
          postsUnavailable={!commentCountAvailable}
          reactions={reactions.length}
          participants={participantCount}
          pluginReactions={currentPluginReactions.length}
        />
      {/if}

      {#if error && composerStatus === undefined}
        <p class="notice error" role="alert">{error}</p>
      {:else if message}
        <p class="notice" role="status">{message}</p>
      {/if}

      <div
        class="discussion"
        class:discussion--with-timeline={commentCountAvailable &&
          commentTotal > 1 &&
          threadFirstTimestamp > 0 &&
          threadLastTimestamp > 0}
        aria-busy={loading || loadingJump || loadingPrevious || loadingNext}
        style={`--discussion-composer-space: ${composerPresentation === "open" ? composerHeight + 24 : 0}px`}
      >
        <div class="topic-column">
          {#if loading || loadingJump}
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
              currentMemberId={signedInPubkey}
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
              onEdit={startEdit}
              onDelete={controller.deleteReview}
              onReport={controller.reportReview}
              {...onOpenProfile === undefined ? {} : { onOpenProfile }}
              {...onMessageMember === undefined ? {} : { onMessageMember }}
              {...onWaveMember === undefined ? {} : { onWaveMember }}
            />
          {/if}

          {#if !hasNext && reviews.length > 0}
            <footer
              class="discussion-topic-footer"
              aria-label="Discussion actions"
            >
              <Button type="button" onclick={openComposer}>
                <MessageSquareReplyIcon
                  data-icon="inline-start"
                  aria-hidden="true"
                />
                Reply
              </Button>
              <Button
                type="button"
                variant="outline"
                aria-pressed={bookmarked}
                onclick={controller.toggleBookmark}
              >
                {#if bookmarked}
                  <BookmarkCheckIcon
                    data-icon="inline-start"
                    aria-hidden="true"
                  />
                  Remove bookmark
                {:else}
                  <BookmarkIcon data-icon="inline-start" aria-hidden="true" />
                  Bookmark
                {/if}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onclick={controller.markUnread}
              >
                <BellIcon data-icon="inline-start" aria-hidden="true" />
                Mark unread
              </Button>
            </footer>

            {#if suggestionsLoading}
              <section
                class="discussion-suggestions"
                aria-label="New and unread topics"
              >
                <h2>New &amp; Unread Topics</h2>
                <div
                  class="discussion-suggestions__skeleton"
                  role="status"
                  aria-label="Loading topic suggestions"
                >
                  {#each Array.from({ length: 3 }) as _}
                    <Skeleton />
                  {/each}
                </div>
              </section>
            {:else if suggestedTopics.length > 0}
              <div class="discussion-suggestions">
                <ForumTopicList
                  title="New & Unread"
                  topics={suggestedTopicModels}
                  members={suggestedTopicMembers}
                  onOpenTopic={openSuggestedTopic}
                  {...onOpenProfile === undefined ? {} : { onOpenProfile }}
                  {...onMessageMember === undefined ? {} : { onMessageMember }}
                  {...onWaveMember === undefined ? {} : { onWaveMember }}
                  actions={suggestionsHeading}
                  embedded
                  showTopicActions={false}
                />
              </div>
            {/if}
          {/if}

          <DiscussionComposer
            {name}
            replyingTo={replyingReview}
            editingPost={editingReview}
            {profiles}
            {postNumber}
            {signedInPubkey}
            {publishing}
            variant="docked"
            bind:presentation={composerPresentation}
            bind:height={composerHeight}
            draftKey={controller.composerDraftKey}
            {...draftStore === undefined ? {} : { draftStore }}
            {...composerStatus === undefined ? {} : { composerStatus }}
            onDismissComposerStatus={controller.dismissError}
            bind:comment={controller.comment}
            onCancel={controller.cancelReply}
            onHeightCommit={controller.setComposerHeight}
            onSubmit={controller.submitComment}
          />
        </div>

        {#if commentCountAvailable && commentTotal > 1 && threadFirstTimestamp > 0 && threadLastTimestamp > 0}
          <DiscussionTimeline
            total={commentTotal}
            currentIndex={activeGlobalPostIndex}
            currentTimestamp={activePostTimestamp}
            firstTimestamp={threadFirstTimestamp}
            lastTimestamp={threadLastTimestamp}
            returnIndex={timelineReturnIndex}
            disabled={loadingJump || commentTotalApproximate}
            approximate={commentTotalApproximate}
            pageSize={commentPageSize}
            onJump={navigateTimelineToIndex}
            onReturn={returnToTimelineOrigin}
            actions={timelineActions}
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

  :global(.community-card[data-ui-component="card"][data-ui-part="card"]) {
    overflow: visible;
    border: 0;
    background-color: transparent;
    box-shadow: none;
  }

  :global(.community-content) {
    display: grid;
    gap: 1.4rem;
    padding: 0;
  }

  .community {
    container: registry-discussion / inline-size;
  }

  .notice {
    margin: 0;
    color: var(--muted-foreground);
    font-size: var(--community-text-body);
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
    grid-template-columns: minmax(0, 1fr) clamp(6.5rem, 15cqi, 9rem);
    gap: clamp(1rem, 4cqi, 3.5rem);
  }

  .topic-column {
    display: grid;
    gap: 1.25rem;
    min-width: 0;
    padding-bottom: var(--discussion-composer-space, 0);
  }

  .discussion-topic-footer {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding-block: 1rem;
    border-top: 1px solid var(--border);
  }

  .discussion-suggestions {
    display: grid;
    gap: 0.75rem;
    padding-block: 1rem;
    border-top: 1px solid var(--border);
  }

  :global(.discussion-suggestions__title) {
    margin: 0;
    font-size: var(--community-text-section);
  }

  .discussion-suggestions__skeleton {
    display: grid;
  }

  .discussion-suggestions__skeleton {
    gap: 0.25rem;
  }

  .discussion-suggestions__skeleton :global([data-ui-component="skeleton"]) {
    height: 3.5rem;
  }

  .topic-column :global(.post-stream) {
    margin-top: 0;
  }

  :global(.timeline-follow-action) {
    position: relative;
  }

  :global(.timeline-follow-action__count[data-ui-part="community-chip"]) {
    position: absolute;
    top: -0.35rem;
    right: -0.35rem;
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

  @container registry-discussion (max-width: 30rem) {
    .discussion {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
