<script lang="ts">
  import { onMount, tick } from "svelte";

  import { Button } from "@lapismd/design-core/shadcn/button";

  import DiscussionPost from "../discussion-post/DiscussionPost.svelte";
  import {
    reactionGroups,
    type CommunityProfile,
    type ForumPost,
    type ForumReaction,
  } from "../registry-community/model.js";
  import { shouldCloakDiscussionPost } from "./discussion-stream.js";

  let {
    posts,
    contextPosts,
    reactions,
    profiles,
    startIndex,
    total,
    activePostId,
    targetPostId = "",
    scrollRevision = 0,
    publishing = false,
    hasPrevious,
    hasNext,
    loadingPrevious,
    loadingNext,
    previousError = "",
    nextError = "",
    onCurrentPost,
    onPrepend,
    onAppend,
    onNavigate,
    onReply,
    onReact,
  }: {
    posts: ForumPost[];
    contextPosts: ForumPost[];
    reactions: ForumReaction[];
    profiles: ReadonlyMap<string, CommunityProfile>;
    startIndex: number;
    total: number;
    activePostId: string;
    targetPostId?: string;
    scrollRevision?: number;
    publishing?: boolean;
    hasPrevious: boolean;
    hasNext: boolean;
    loadingPrevious: boolean;
    loadingNext: boolean;
    previousError?: string;
    nextError?: string;
    onCurrentPost: (eventId: string, globalIndex: number) => void;
    onPrepend: () => Promise<boolean>;
    onAppend: () => Promise<boolean>;
    onNavigate: (post: ForumPost) => void | Promise<void>;
    onReply: (post: ForumPost) => void;
    onReact: (post: ForumPost, content?: string) => void | Promise<void>;
  } = $props();

  let cloakedIds = $state<ReadonlySet<string>>(new Set());
  let focusedPostId = $state("");
  const wrappers = new Map<string, HTMLElement>();
  const measuredHeights = new Map<string, number>();
  let postObserver: IntersectionObserver | undefined;
  let resizeObserver: ResizeObserver | undefined;
  let viewportFrame = 0;
  let lastViewportWidth = 0;
  let settledScrollRevision = $state(0);

  const contextById = $derived(
    new Map(contextPosts.map((post) => [post.event.id, post] as const)),
  );

  function formatShortDate(timestamp: number): string {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(timestamp * 1_000);
  }

  function postNumber(eventId: string): number {
    const index = posts.findIndex((post) => post.event.id === eventId);
    return index === -1 ? 0 : startIndex + index + 1;
  }

  function postReference(post: ForumPost): string {
    const number = postNumber(post.event.id);
    return number === 0 ? formatShortDate(post.event.created_at) : `#${number}`;
  }

  function parentOf(post: ForumPost): ForumPost | undefined {
    return post.parentEventId === undefined
      ? undefined
      : contextById.get(post.parentEventId);
  }

  function scheduleViewportUpdate(): void {
    if (viewportFrame !== 0) return;
    viewportFrame = requestAnimationFrame(() => {
      viewportFrame = 0;
      updateViewport();
    });
  }

  function updateViewport(): void {
    if (wrappers.size === 0) return;
    const viewportHeight = window.innerHeight;
    const eyeline = Math.min(220, viewportHeight * 0.28);
    const ordered = posts
      .map((post, index) => ({
        id: post.event.id,
        index,
        element: wrappers.get(post.event.id),
      }))
      .filter(
        (item): item is { id: string; index: number; element: HTMLElement } =>
          item.element !== undefined,
      )
      .map((item) => ({
        ...item,
        bounds: item.element.getBoundingClientRect(),
      }));
    if (ordered.length === 0) return;

    const current =
      ordered.find(
        (item) => item.bounds.top <= eyeline && item.bounds.bottom > eyeline,
      ) ??
      ordered.find((item) => item.bounds.top > eyeline) ??
      ordered.at(-1)!;
    if (current.id !== activePostId) {
      onCurrentPost(current.id, startIndex + current.index);
    }

    const nextCloaked = new Set<string>();
    for (const item of ordered) {
      const protectedPost =
        item.id === current.id ||
        item.id === activePostId ||
        item.id === focusedPostId ||
        item.id === targetPostId ||
        item.element.contains(document.activeElement);
      if (
        measuredHeights.has(item.id) &&
        shouldCloakDiscussionPost(item.bounds, viewportHeight, protectedPost)
      ) {
        nextCloaked.add(item.id);
      }
    }
    if (
      nextCloaked.size !== cloakedIds.size ||
      [...nextCloaked].some((id) => !cloakedIds.has(id))
    ) {
      cloakedIds = nextCloaked;
    }
  }

  function registerPost(node: HTMLElement, eventId: string) {
    wrappers.set(eventId, node);
    postObserver?.observe(node);
    resizeObserver?.observe(node);
    scheduleViewportUpdate();
    return {
      update(nextEventId: string) {
        if (nextEventId === eventId) return;
        wrappers.delete(eventId);
        eventId = nextEventId;
        wrappers.set(eventId, node);
        scheduleViewportUpdate();
      },
      destroy() {
        postObserver?.unobserve(node);
        resizeObserver?.unobserve(node);
        wrappers.delete(eventId);
        measuredHeights.delete(eventId);
      },
    };
  }

  function sentinel(node: HTMLElement, direction: "prepend" | "append") {
    let pending = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { rootMargin: `${window.innerHeight}px 0px`, threshold: 0 },
    );

    async function loadMore(): Promise<void> {
      if (scrollRevision > settledScrollRevision) return;
      const available = direction === "prepend" ? hasPrevious : hasNext;
      const externallyLoading =
        direction === "prepend" ? loadingPrevious : loadingNext;
      if (!available || externallyLoading || pending) return;
      pending = true;
      let anchorId = "";
      let anchorTop = 0;
      if (direction === "prepend") {
        const firstVisible = posts
          .map((post) => wrappers.get(post.event.id))
          .find(
            (element) =>
              element !== undefined &&
              element.getBoundingClientRect().bottom > 0,
          );
        anchorId = firstVisible?.dataset.postId ?? "";
        anchorTop = firstVisible?.getBoundingClientRect().top ?? 0;
      }
      const changed =
        direction === "prepend" ? await onPrepend() : await onAppend();
      await tick();
      if (changed && anchorId !== "") {
        const nextAnchor = wrappers.get(anchorId);
        if (nextAnchor !== undefined) {
          window.scrollBy(
            0,
            nextAnchor.getBoundingClientRect().top - anchorTop,
          );
        }
      }
      pending = false;
      scheduleViewportUpdate();
      const bounds = node.getBoundingClientRect();
      const margin = window.innerHeight;
      const stillNearViewport =
        bounds.bottom >= -margin && bounds.top <= window.innerHeight + margin;
      if (changed && stillNearViewport) {
        retryTimer = setTimeout(() => void loadMore(), 100);
      }
    }

    observer.observe(node);
    return {
      destroy() {
        observer.disconnect();
        if (retryTimer !== undefined) clearTimeout(retryTimer);
      },
    };
  }

  function handleResize(): void {
    if (window.innerWidth === lastViewportWidth) return;
    lastViewportWidth = window.innerWidth;
    measuredHeights.clear();
    cloakedIds = new Set();
    scheduleViewportUpdate();
  }

  $effect(() => {
    const revision = scrollRevision;
    const target = targetPostId;
    if (revision <= 0 || target === "") return;
    void tick().then(() => {
      requestAnimationFrame(() => {
        wrappers
          .get(target)
          ?.scrollIntoView({ behavior: "auto", block: "start" });
        requestAnimationFrame(() => {
          settledScrollRevision = revision;
          scheduleViewportUpdate();
        });
      });
    });
  });

  onMount(() => {
    lastViewportWidth = window.innerWidth;
    postObserver = new IntersectionObserver(scheduleViewportUpdate, {
      rootMargin: "100% 0px",
      threshold: [0, 0.01],
    });
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const eventId = (entry.target as HTMLElement).dataset.postId;
        if (eventId === undefined || cloakedIds.has(eventId)) continue;
        const height = Math.ceil(
          entry.borderBoxSize[0]?.blockSize ?? entry.contentRect.height,
        );
        if (height > 0) measuredHeights.set(eventId, height);
      }
      scheduleViewportUpdate();
    });
    for (const element of wrappers.values()) {
      postObserver.observe(element);
      resizeObserver.observe(element);
    }
    window.addEventListener("scroll", scheduleViewportUpdate, {
      passive: true,
    });
    window.addEventListener("resize", handleResize, { passive: true });
    scheduleViewportUpdate();
    return () => {
      postObserver?.disconnect();
      resizeObserver?.disconnect();
      window.removeEventListener("scroll", scheduleViewportUpdate);
      window.removeEventListener("resize", handleResize);
      if (viewportFrame !== 0) cancelAnimationFrame(viewportFrame);
    };
  });
</script>

<ol
  class="post-stream"
  data-loaded-posts={posts.length}
  data-rendered-posts={posts.length - cloakedIds.size}
>
  {#if hasPrevious || loadingPrevious || previousError !== ""}
    <li class="load-row" use:sentinel={"prepend"}>
      {#if previousError !== ""}
        <p role="alert">{previousError}</p>
        <Button variant="outline" size="sm" onclick={() => onPrepend()}>
          Retry earlier posts
        </Button>
      {:else if loadingPrevious}
        <span role="status">Loading earlier posts…</span>
      {:else}
        <span aria-hidden="true">Earlier posts load as you scroll</span>
      {/if}
    </li>
  {/if}

  {#each posts as post, index (post.event.id)}
    {@const parent = parentOf(post)}
    {@const groups = reactionGroups(post.event.id, reactions)}
    <li
      id={`post-${post.event.id}`}
      class="post-wrapper"
      class:cloaked={cloakedIds.has(post.event.id)}
      data-post-id={post.event.id}
      data-post-index={startIndex + index}
      use:registerPost={post.event.id}
      onfocusin={() => {
        focusedPostId = post.event.id;
        scheduleViewportUpdate();
      }}
      onfocusout={() => {
        focusedPostId = "";
        scheduleViewportUpdate();
      }}
    >
      {#if cloakedIds.has(post.event.id)}
        <div
          class="post-placeholder"
          style={`height: ${measuredHeights.get(post.event.id) ?? 0}px`}
          aria-hidden="true"
        ></div>
      {:else}
        <DiscussionPost
          {post}
          {parent}
          {groups}
          {profiles}
          number={postNumber(post.event.id)}
          parentReference={parent === undefined ? "" : postReference(parent)}
          active={post.event.id === activePostId}
          {publishing}
          {onNavigate}
          {onReply}
          {onReact}
        />
      {/if}
    </li>
  {/each}

  {#if hasNext || loadingNext || nextError !== ""}
    <li class="load-row" use:sentinel={"append"}>
      {#if nextError !== ""}
        <p role="alert">{nextError}</p>
        <Button variant="outline" size="sm" onclick={() => onAppend()}>
          Retry later posts
        </Button>
      {:else if loadingNext}
        <span role="status">Loading later posts…</span>
      {:else}
        <span aria-hidden="true">Later posts load as you scroll</span>
      {/if}
    </li>
  {/if}
</ol>

<style>
  .post-stream {
    margin: 1.25rem 0 0;
    padding: 0;
    list-style: none;
  }

  .post-stream > li {
    border-top: 1px solid var(--border);
  }

  .post-wrapper {
    min-height: 1px;
  }

  .post-placeholder {
    width: 100%;
    min-height: 1px;
    contain: strict;
  }

  .load-row {
    display: flex;
    min-height: 3.5rem;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    color: var(--muted-foreground);
    font-size: 0.8rem;
    text-align: center;
  }

  .load-row p {
    margin: 0;
    color: var(--destructive);
  }
</style>
