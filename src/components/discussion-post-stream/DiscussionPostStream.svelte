<script lang="ts">
  import { onMount, tick } from "svelte";

  import { Button } from "@lapismd/design-core/shadcn/button";
  import { Skeleton } from "@lapismd/design-core/shadcn/skeleton";

  import type { CommunityMessageReport } from "../../community/index.js";
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
    currentMemberId = "",
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
    onEdit,
    onDelete,
    onReport,
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
    currentMemberId?: string;
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
    onEdit?: (post: ForumPost) => void | Promise<void>;
    onDelete?: (post: ForumPost) => void | Promise<void>;
    onReport?: (
      post: ForumPost,
      report: CommunityMessageReport,
    ) => void | Promise<void>;
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
  let streamElement: HTMLOListElement;
  let scrollViewport: HTMLElement | undefined;

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

  function findScrollViewport(node: HTMLElement): HTMLElement | undefined {
    let candidate = node.parentElement;
    while (candidate !== null) {
      const overflowY = getComputedStyle(candidate).overflowY;
      if (/^(auto|overlay|scroll)$/u.test(overflowY)) return candidate;
      candidate = candidate.parentElement;
    }
    return undefined;
  }

  function viewportMetrics(): {
    top: number;
    bottom: number;
    height: number;
    scrollTop: number;
    scrollHeight: number;
  } {
    if (scrollViewport !== undefined) {
      const bounds = scrollViewport.getBoundingClientRect();
      return {
        top: bounds.top,
        bottom: bounds.bottom,
        height: scrollViewport.clientHeight,
        scrollTop: scrollViewport.scrollTop,
        scrollHeight: scrollViewport.scrollHeight,
      };
    }
    return {
      top: 0,
      bottom: window.innerHeight,
      height: window.innerHeight,
      scrollTop: window.scrollY,
      scrollHeight: document.documentElement.scrollHeight,
    };
  }

  function scrollViewportBy(delta: number): void {
    if (scrollViewport !== undefined) scrollViewport.scrollBy(0, delta);
    else window.scrollBy(0, delta);
  }

  function updateViewport(): void {
    if (wrappers.size === 0) return;
    const viewport = viewportMetrics();
    const viewportHeight = viewport.height;
    const eyeline = viewport.top + Math.min(220, viewportHeight * 0.28);
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

    const atLoadedEnd =
      !hasNext &&
      Math.ceil(viewport.scrollTop + viewportHeight) >= viewport.scrollHeight;
    const current = atLoadedEnd
      ? ordered.at(-1)!
      : (ordered.find(
          (item) => item.bounds.top <= eyeline && item.bounds.bottom > eyeline,
        ) ??
        ordered.find((item) => item.bounds.top > eyeline) ??
        ordered.at(-1)!);
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
        shouldCloakDiscussionPost(
          {
            top: item.bounds.top - viewport.top,
            bottom: item.bounds.bottom - viewport.top,
          },
          viewportHeight,
          protectedPost,
        )
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
    let disposed = false;
    const observerRoot = findScrollViewport(node);
    const scrollTarget: HTMLElement | Window = observerRoot ?? window;
    let lastScrollTop = observerRoot?.scrollTop ?? window.scrollY;

    function isNearViewport(): boolean {
      const bounds = node.getBoundingClientRect();
      const rootBounds = observerRoot?.getBoundingClientRect();
      const top = rootBounds?.top ?? 0;
      const bottom = rootBounds?.bottom ?? window.innerHeight;
      const margin = observerRoot?.clientHeight ?? window.innerHeight;
      return bounds.bottom >= top - margin && bounds.top <= bottom + margin;
    }

    function requestFromDirection(nextScrollTop: number): void {
      const movedToward =
        direction === "prepend"
          ? nextScrollTop < lastScrollTop
          : nextScrollTop > lastScrollTop;
      lastScrollTop = nextScrollTop;
      if (movedToward && isNearViewport()) void loadMore();
    }

    function handleScroll(): void {
      requestFromDirection(observerRoot?.scrollTop ?? window.scrollY);
    }

    function handleWheel(event: Event): void {
      const { deltaY } = event as WheelEvent;
      const movedToward = direction === "prepend" ? deltaY < 0 : deltaY > 0;
      if (movedToward && isNearViewport()) void loadMore();
    }

    async function loadMore(): Promise<void> {
      if (scrollRevision > settledScrollRevision) return;
      const available = direction === "prepend" ? hasPrevious : hasNext;
      const externallyLoading =
        direction === "prepend" ? loadingPrevious : loadingNext;
      if (!available || externallyLoading || pending) return;
      pending = true;
      try {
        let keepLoading = true;
        while (keepLoading && !disposed) {
          const request = direction === "prepend" ? onPrepend() : onAppend();
          await tick();

          let anchorId = "";
          let anchorTop = 0;
          if (direction === "prepend") {
            const viewport = viewportMetrics();
            const firstTracked = posts
              .map((post) => wrappers.get(post.event.id))
              .find(
                (element) =>
                  element !== undefined &&
                  element.getBoundingClientRect().bottom > viewport.top,
              );
            anchorId = firstTracked?.dataset.postId ?? "";
            anchorTop = firstTracked?.getBoundingClientRect().top ?? 0;
          }

          const changed = await request;
          await tick();

          const compensate = () => {
            if (!changed || anchorId === "") return;
            const anchor = wrappers.get(anchorId);
            if (anchor === undefined) return;
            const delta = anchor.getBoundingClientRect().top - anchorTop;
            if (Math.abs(delta) > 0.5) scrollViewportBy(delta);
          };
          compensate();
          await new Promise<void>((resolve) =>
            requestAnimationFrame(() => resolve()),
          );
          compensate();

          scheduleViewportUpdate();
          const bounds = node.getBoundingClientRect();
          const viewport = viewportMetrics();
          const margin = viewport.height;
          const stillNearViewport =
            bounds.bottom >= viewport.top - margin &&
            bounds.top <= viewport.bottom + margin;
          const stillAvailable =
            direction === "prepend" ? hasPrevious : hasNext;
          keepLoading = changed && stillAvailable && stillNearViewport;
        }
      } finally {
        pending = false;
      }
    }

    scrollTarget.addEventListener("scroll", handleScroll, { passive: true });
    scrollTarget.addEventListener("wheel", handleWheel, { passive: true });
    return {
      destroy() {
        disposed = true;
        scrollTarget.removeEventListener("scroll", handleScroll);
        scrollTarget.removeEventListener("wheel", handleWheel);
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
    scrollViewport = findScrollViewport(streamElement);
    postObserver = new IntersectionObserver(scheduleViewportUpdate, {
      root: scrollViewport ?? null,
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
    const scrollTarget: HTMLElement | Window = scrollViewport ?? window;
    scrollTarget.addEventListener("scroll", scheduleViewportUpdate, {
      passive: true,
    });
    window.addEventListener("resize", handleResize, { passive: true });
    scheduleViewportUpdate();
    return () => {
      postObserver?.disconnect();
      resizeObserver?.disconnect();
      scrollTarget.removeEventListener("scroll", scheduleViewportUpdate);
      window.removeEventListener("resize", handleResize);
      if (viewportFrame !== 0) cancelAnimationFrame(viewportFrame);
    };
  });
</script>

<ol
  bind:this={streamElement}
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
        <div
          class="load-skeleton"
          role="status"
          aria-label="Loading earlier posts"
        >
          <Skeleton /><Skeleton /><Skeleton />
        </div>
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
          {currentMemberId}
          {onNavigate}
          {onReply}
          {onReact}
          {...onEdit === undefined ? {} : { onEdit }}
          {...onDelete === undefined ? {} : { onDelete }}
          {...onReport === undefined ? {} : { onReport }}
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
        <div
          class="load-skeleton"
          role="status"
          aria-label="Loading later posts"
        >
          <Skeleton /><Skeleton /><Skeleton />
        </div>
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
    scroll-margin-top: min(220px, 28vh);
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

  .load-skeleton {
    display: grid;
    gap: 0.45rem;
    width: min(100%, 34rem);
    padding: 0.7rem 0;
  }

  .load-skeleton :global(*) {
    height: 0.7rem;
  }

  .load-skeleton :global(*:nth-child(1)) {
    width: 28%;
  }

  .load-skeleton :global(*:nth-child(3)) {
    width: 64%;
  }
</style>
