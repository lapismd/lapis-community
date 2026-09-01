<script lang="ts">
  import {
    timelineIndexFromPosition,
    timelinePosition,
    timelineTimestamp,
  } from "./model.js";

  let {
    total,
    currentIndex,
    currentTimestamp,
    firstTimestamp,
    lastTimestamp,
    returnIndex,
    disabled = false,
    pageSize = 20,
    onJump,
    onReturn,
  }: {
    total: number;
    currentIndex: number;
    currentTimestamp: number;
    firstTimestamp: number;
    lastTimestamp: number;
    returnIndex?: number | undefined;
    disabled?: boolean;
    pageSize?: number;
    onJump: (index: number) => void | Promise<void>;
    onReturn: () => void | Promise<void>;
  } = $props();

  let previewIndex = $state<number | undefined>();
  let dragging = $state(false);
  let mobileOpen = $state(false);
  let mobileCloseButton = $state<HTMLButtonElement | undefined>();
  let pointerId: number | undefined;
  let dragOffset = 0;
  let activeTrack: HTMLElement | undefined;

  $effect(() => {
    if (!mobileOpen) return;
    requestAnimationFrame(() => mobileCloseButton?.focus());
  });

  const displayIndex = $derived(previewIndex ?? currentIndex);
  const displayTimestamp = $derived(
    previewIndex === undefined
      ? currentTimestamp
      : timelineTimestamp(displayIndex, total, firstTimestamp, lastTimestamp),
  );

  function formatShortDate(timestamp: number): string {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(timestamp * 1_000);
  }

  function indexForPointer(track: HTMLElement, clientY: number): number {
    const bounds = track.getBoundingClientRect();
    const handle = track.querySelector<HTMLElement>(".history-handle");
    return timelineIndexFromPosition(
      clientY - bounds.top - dragOffset,
      bounds.height,
      total,
      handle?.getBoundingClientRect().height ?? 50,
    );
  }

  function startDrag(event: PointerEvent): void {
    if (event.button !== 0 || total < 2 || disabled) return;
    const target = event.target;
    if (target instanceof Element && target.closest(".history-back") !== null) {
      return;
    }
    const track = event.currentTarget as HTMLElement;
    const handle = track.querySelector<HTMLElement>(".history-handle");
    const handleBounds = handle?.getBoundingClientRect();
    dragOffset =
      target instanceof Element &&
      target.closest(".history-handle") !== null &&
      handleBounds !== undefined
        ? event.clientY - (handleBounds.top + handleBounds.height / 2)
        : 0;
    dragging = true;
    pointerId = event.pointerId;
    activeTrack = track;
    track.setPointerCapture(event.pointerId);
    previewIndex = indexForPointer(track, event.clientY);
    event.preventDefault();
  }

  function moveDrag(event: PointerEvent): void {
    if (!dragging || event.pointerId !== pointerId || activeTrack === undefined)
      return;
    previewIndex = indexForPointer(activeTrack, event.clientY);
    event.preventDefault();
  }

  function resetDrag(): void {
    dragging = false;
    pointerId = undefined;
    dragOffset = 0;
    activeTrack = undefined;
    previewIndex = undefined;
  }

  function finishDrag(event: PointerEvent, closeAfter = false): void {
    if (!dragging || event.pointerId !== pointerId || activeTrack === undefined)
      return;
    const targetIndex = indexForPointer(activeTrack, event.clientY);
    if (activeTrack.hasPointerCapture(event.pointerId)) {
      activeTrack.releasePointerCapture(event.pointerId);
    }
    resetDrag();
    void commit(targetIndex, closeAfter);
  }

  function cancelDrag(event: PointerEvent): void {
    if (event.pointerId === pointerId) resetDrag();
  }

  async function commit(index: number, closeAfter = false): Promise<void> {
    if (disabled || total === 0) return;
    await onJump(Math.max(0, Math.min(index, total - 1)));
    if (closeAfter) mobileOpen = false;
  }

  function handleKey(event: KeyboardEvent, closeAfter = false): void {
    let targetIndex = currentIndex;
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") targetIndex -= 1;
    else if (event.key === "ArrowDown" || event.key === "ArrowRight")
      targetIndex += 1;
    else if (event.key === "PageUp") targetIndex -= pageSize;
    else if (event.key === "PageDown") targetIndex += pageSize;
    else if (event.key === "Home") targetIndex = 0;
    else if (event.key === "End") targetIndex = total - 1;
    else return;
    event.preventDefault();
    void commit(targetIndex, closeAfter);
  }

  async function returnToOrigin(closeAfter = false): Promise<void> {
    await onReturn();
    if (closeAfter) mobileOpen = false;
  }
</script>

{#snippet timelineTrack(mobile = false)}
  <button
    class="history-date"
    aria-label="Go to the first post"
    {disabled}
    onclick={() => commit(0, mobile)}
  >
    <time datetime={new Date(firstTimestamp * 1_000).toISOString()}>
      {formatShortDate(firstTimestamp)}
    </time>
  </button>
  <div
    class="history-track"
    class:dragging
    role="group"
    aria-label="Discussion timeline"
    onpointerdown={startDrag}
    onpointermove={moveDrag}
    onpointerup={(event) => finishDrag(event, mobile)}
    onpointercancel={cancelDrag}
  >
    <span class="history-line" aria-hidden="true"></span>
    {#if returnIndex !== undefined && returnIndex !== currentIndex}
      <button
        class="history-back"
        style={`--timeline-return-position: ${timelinePosition(returnIndex, total) / 100}`}
        aria-label={`Back to post ${returnIndex + 1}`}
        onpointerdown={(event) => event.stopPropagation()}
        onclick={() => returnToOrigin(mobile)}
      >
        <span aria-hidden="true"></span>
        Back
      </button>
    {/if}
    <div
      class="history-handle"
      class:dragging
      style={`--timeline-position: ${timelinePosition(displayIndex, total) / 100}`}
      role="slider"
      tabindex="0"
      aria-label="Discussion position"
      aria-valuemin="1"
      aria-valuemax={total}
      aria-valuenow={displayIndex + 1}
      aria-valuetext={`Post ${displayIndex + 1} of ${total}, ${formatShortDate(displayTimestamp)}`}
      onkeydown={(event) => handleKey(event, mobile)}
    >
      <span class="history-handle-bar" aria-hidden="true"></span>
      <span class="history-current">
        <strong>{displayIndex + 1} / {total}</strong>
        <span>{formatShortDate(displayTimestamp)}</span>
      </span>
    </div>
  </div>
  <button
    class="history-date"
    aria-label="Go to the latest post"
    {disabled}
    onclick={() => commit(total - 1, mobile)}
  >
    <time datetime={new Date(lastTimestamp * 1_000).toISOString()}>
      {formatShortDate(lastTimestamp)}
    </time>
  </button>
{/snippet}

<aside class="history" aria-label="Discussion history">
  <div class="history-sticky">
    {@render timelineTrack()}
  </div>
</aside>

<button
  class="mobile-timeline-trigger"
  type="button"
  aria-expanded={mobileOpen}
  aria-controls="discussion-mobile-timeline"
  onclick={() => (mobileOpen = true)}
>
  <span>Post {currentIndex + 1} of {total}</span>
  <strong>Timeline</strong>
</button>

{#if mobileOpen}
  <div
    id="discussion-mobile-timeline"
    class="mobile-timeline-overlay"
    role="dialog"
    tabindex="-1"
    aria-modal="true"
    aria-label="Discussion timeline"
    onkeydown={(event) => {
      if (event.key === "Escape") mobileOpen = false;
    }}
  >
    <header>
      <div>
        <strong>Discussion timeline</strong>
        <span>Jump through {total} posts without loading the whole topic.</span>
      </div>
      <button
        type="button"
        bind:this={mobileCloseButton}
        onclick={() => (mobileOpen = false)}
      >
        Close
      </button>
    </header>
    <div class="mobile-timeline-rail">
      {@render timelineTrack(true)}
    </div>
  </div>
{/if}

<style>
  .history-sticky,
  .mobile-timeline-rail {
    display: grid;
    grid-template-rows: auto clamp(10.625rem, 45vh, 18.75rem) auto;
    gap: 0.35rem;
    color: var(--muted-foreground);
    font-size: 0.75rem;
  }

  .history-sticky {
    position: sticky;
    top: calc(56px + 2.5rem);
  }

  .history-date {
    width: fit-content;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--muted-foreground);
    cursor: pointer;
    font: inherit;
    line-height: 1.25rem;
  }

  .history-date:hover,
  .history-date:focus-visible {
    color: var(--foreground);
  }

  .history-date:disabled {
    cursor: wait;
    opacity: 0.55;
  }

  .history-track {
    --timeline-handle-height: 3.125rem;
    position: relative;
    width: 100%;
    height: 100%;
    cursor: pointer;
    touch-action: none;
    user-select: none;
  }

  .history-track.dragging {
    cursor: grabbing;
  }

  .history-line {
    position: absolute;
    inset: 0 auto 0 0.45rem;
    width: 1px;
    background: var(--border);
  }

  .history-handle {
    position: absolute;
    z-index: 2;
    top: calc(
      (100% - var(--timeline-handle-height)) * var(--timeline-position)
    );
    right: 0;
    left: 0;
    display: grid;
    grid-template-columns: 1rem minmax(0, 1fr);
    align-items: center;
    height: var(--timeline-handle-height);
    color: var(--foreground);
    cursor: grab;
    outline: none;
    transition: top 180ms ease-out;
  }

  .history-handle.dragging {
    cursor: grabbing;
    transition: none;
  }

  .history-handle-bar {
    width: 0.35rem;
    height: 100%;
    margin-left: 0.28rem;
    border-radius: 999px;
    background: var(--primary);
    box-shadow: 0 0 0 1px color-mix(in oklch, var(--primary) 28%, transparent);
  }

  .history-current {
    display: grid;
    gap: 0.05rem;
    min-width: 0;
    padding: 0.4rem 0.45rem;
    border-radius: var(--radius);
    transition: background-color 150ms ease;
  }

  .history-handle:hover .history-current,
  .history-handle:focus-visible .history-current,
  .history-handle.dragging .history-current {
    background: var(--secondary);
  }

  .history-current strong {
    font-size: 0.9rem;
    line-height: 1rem;
  }

  .history-current span {
    color: var(--muted-foreground);
    line-height: 1rem;
  }

  .history-back {
    position: absolute;
    z-index: 1;
    top: calc(0.75rem + (100% - 1.5rem) * var(--timeline-return-position));
    left: 0;
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.15rem 0.35rem 0.15rem 0;
    border: 0;
    border-radius: 0.25rem;
    background: var(--card);
    color: var(--muted-foreground);
    cursor: pointer;
    font: inherit;
    font-size: 0.7rem;
    transform: translateY(-50%);
  }

  .history-back > span {
    width: 0.9rem;
    height: 1px;
    background: currentColor;
  }

  .mobile-timeline-trigger,
  .mobile-timeline-overlay {
    display: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .history-handle {
      transition: none;
    }
  }

  @media (max-width: 62rem) {
    .history {
      display: none;
    }

    .mobile-timeline-trigger {
      position: sticky;
      z-index: 10;
      bottom: 1rem;
      display: flex;
      justify-content: space-between;
      width: min(100%, 22rem);
      margin: 0.75rem auto 0;
      padding: 0.7rem 0.9rem;
      border: 1px solid var(--border);
      border-radius: 999px;
      background: color-mix(in oklch, var(--card) 94%, transparent);
      box-shadow: 0 0.6rem 1.8rem rgb(0 0 0 / 28%);
      color: var(--foreground);
      cursor: pointer;
      font: inherit;
      backdrop-filter: blur(1rem);
    }

    .mobile-timeline-trigger span {
      color: var(--muted-foreground);
    }

    .mobile-timeline-overlay {
      position: fixed;
      z-index: 100;
      inset: 0;
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      gap: 1.5rem;
      padding: max(1rem, env(safe-area-inset-top)) 1.25rem
        max(1rem, env(safe-area-inset-bottom));
      background: color-mix(in oklch, var(--background) 96%, black);
      color: var(--foreground);
    }

    .mobile-timeline-overlay header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 1rem;
    }

    .mobile-timeline-overlay header > div {
      display: grid;
      gap: 0.2rem;
    }

    .mobile-timeline-overlay header span {
      color: var(--muted-foreground);
      font-size: 0.8rem;
    }

    .mobile-timeline-overlay header button {
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--border);
      border-radius: var(--radius);
      background: var(--secondary);
      color: var(--foreground);
      cursor: pointer;
    }

    .mobile-timeline-rail {
      grid-template-rows: auto minmax(16rem, 1fr) auto;
      width: min(100%, 18rem);
      min-height: 0;
      margin: 0 auto;
    }
  }
</style>
