<script lang="ts">
  import { onMount } from "svelte";

  import {
    timelineIndexFromPosition,
    timelineMarkersOverlap,
    timelinePosition,
    timelineTimestamp,
    shouldShowTimelineBack,
  } from "../registry-community/model.js";

  let {
    total,
    currentIndex,
    currentTimestamp,
    firstTimestamp,
    lastTimestamp,
    returnIndex,
    disabled = false,
    approximate = false,
    pageSize = 20,
    fluid = false,
    onJump,
    onReturn,
    onCommitted,
  }: {
    total: number;
    currentIndex: number;
    currentTimestamp: number;
    firstTimestamp: number;
    lastTimestamp: number;
    returnIndex?: number | undefined;
    disabled?: boolean;
    approximate?: boolean;
    pageSize?: number;
    fluid?: boolean;
    onJump: (index: number) => void | Promise<void>;
    onReturn: () => void | Promise<void>;
    onCommitted?: () => void;
  } = $props();

  let previewIndex = $state<number | undefined>();
  let pendingIndex = $state<number | undefined>();
  let dragging = $state(false);
  let pointerId: number | undefined;
  let dragOffset = 0;
  let activeTrack: HTMLElement | undefined;
  let trackTop = 0;
  let trackHeight = 0;
  let handleHeight = 50;
  let trackElement = $state<HTMLElement | undefined>();
  let measuredTrackHeight = $state(0);

  const busy = $derived(disabled || pendingIndex !== undefined);
  const displayIndex = $derived(previewIndex ?? pendingIndex ?? currentIndex);
  const displayTimestamp = $derived(
    previewIndex === undefined && pendingIndex === undefined
      ? currentTimestamp
      : timelineTimestamp(displayIndex, total, firstTimestamp, lastTimestamp),
  );
  const backVisible = $derived(
    shouldShowTimelineBack(currentIndex, returnIndex, total),
  );
  const backOverlapsHandle = $derived.by(() => {
    if (!backVisible || returnIndex === undefined || measuredTrackHeight <= 0)
      return false;
    return timelineMarkersOverlap(
      displayIndex,
      returnIndex,
      total,
      measuredTrackHeight,
      handleHeight,
    );
  });

  function formatShortDate(timestamp: number): string {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(timestamp * 1_000);
  }

  function indexForPointer(clientY: number): number {
    return timelineIndexFromPosition(
      clientY - trackTop - dragOffset,
      trackHeight,
      total,
      handleHeight,
    );
  }

  function startDrag(event: PointerEvent): void {
    if (event.button !== 0 || total < 2 || busy) return;
    const target = event.target;
    if (target instanceof Element && target.closest(".history-back") !== null)
      return;
    const track = event.currentTarget as HTMLElement;
    const handle = track.querySelector<HTMLElement>(".history-handle");
    const trackBounds = track.getBoundingClientRect();
    const handleBounds = handle?.getBoundingClientRect();
    trackTop = trackBounds.top;
    trackHeight = trackBounds.height;
    handleHeight = handleBounds?.height ?? 50;
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
    previewIndex = indexForPointer(event.clientY);
    event.preventDefault();
  }

  function moveDrag(event: PointerEvent): void {
    if (!dragging || event.pointerId !== pointerId || activeTrack === undefined)
      return;
    previewIndex = indexForPointer(event.clientY);
    event.preventDefault();
  }

  function resetDrag(): void {
    dragging = false;
    pointerId = undefined;
    dragOffset = 0;
    activeTrack = undefined;
    previewIndex = undefined;
  }

  async function commit(index: number): Promise<void> {
    if (busy || total === 0) return;
    const targetIndex = Math.max(0, Math.min(index, total - 1));
    pendingIndex = targetIndex;
    try {
      await onJump(targetIndex);
    } finally {
      pendingIndex = undefined;
      onCommitted?.();
    }
  }

  function finishDrag(event: PointerEvent, usePointerPosition = true): void {
    if (!dragging || event.pointerId !== pointerId || activeTrack === undefined)
      return;
    const targetIndex = usePointerPosition
      ? indexForPointer(event.clientY)
      : (previewIndex ?? currentIndex);
    if (activeTrack.hasPointerCapture(event.pointerId)) {
      activeTrack.releasePointerCapture(event.pointerId);
    }
    pendingIndex = targetIndex;
    resetDrag();
    void (async () => {
      try {
        await onJump(targetIndex);
      } finally {
        pendingIndex = undefined;
        onCommitted?.();
      }
    })();
  }

  function handleKey(event: KeyboardEvent): void {
    let targetIndex = displayIndex;
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") targetIndex -= 1;
    else if (event.key === "ArrowDown" || event.key === "ArrowRight")
      targetIndex += 1;
    else if (event.key === "PageUp") targetIndex -= pageSize;
    else if (event.key === "PageDown") targetIndex += pageSize;
    else if (event.key === "Home") targetIndex = 0;
    else if (event.key === "End") targetIndex = total - 1;
    else return;
    event.preventDefault();
    void commit(targetIndex);
  }

  async function returnToOrigin(): Promise<void> {
    if (busy || returnIndex === undefined) return;
    pendingIndex = returnIndex;
    try {
      await onReturn();
    } finally {
      pendingIndex = undefined;
      onCommitted?.();
    }
  }

  onMount(() => {
    if (trackElement === undefined) return;
    const observer = new ResizeObserver(([entry]) => {
      measuredTrackHeight = entry?.contentRect.height ?? 0;
      const handle =
        trackElement?.querySelector<HTMLElement>(".history-handle");
      handleHeight = handle?.getBoundingClientRect().height ?? 50;
    });
    observer.observe(trackElement);
    return () => observer.disconnect();
  });
</script>

<div class:fluid class="timeline-track-shell">
  <button
    class="history-date"
    aria-label="Go to the first post"
    disabled={busy}
    onclick={() => commit(0)}
  >
    <time datetime={new Date(firstTimestamp * 1_000).toISOString()}>
      {formatShortDate(firstTimestamp)}
    </time>
  </button>
  <div
    class="history-track"
    class:dragging
    bind:this={trackElement}
    role="group"
    aria-label="Discussion timeline"
    aria-disabled={busy}
    onpointerdown={startDrag}
    onpointermove={moveDrag}
    onpointerup={finishDrag}
    onpointercancel={(event) => {
      if (event.pointerId === pointerId) finishDrag(event, false);
    }}
  >
    <span class="history-line" aria-hidden="true"></span>
    {#if backVisible && !backOverlapsHandle && !dragging && returnIndex !== undefined}
      <button
        class="history-back"
        style={`--timeline-return-position: ${timelinePosition(returnIndex, total) / 100}`}
        aria-label="Return to your last-read position"
        title="Return to your last-read position"
        disabled={busy}
        onpointerdown={(event) => event.stopPropagation()}
        onclick={returnToOrigin}
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
      aria-disabled={busy}
      aria-valuemin="1"
      aria-valuemax={total}
      aria-valuenow={displayIndex + 1}
      aria-valuetext={approximate
        ? `Approximately ${total} posts; exact timeline navigation unavailable`
        : `Post ${displayIndex + 1} of ${total}, ${formatShortDate(displayTimestamp)}`}
      onkeydown={handleKey}
    >
      <span class="history-handle-bar" aria-hidden="true"></span>
      <span class="history-current">
        <strong
          >{approximate
            ? `~${total}`
            : `${displayIndex + 1} / ${total}`}</strong
        >
        <span>{formatShortDate(displayTimestamp)}</span>
      </span>
    </div>
    {#if backVisible && backOverlapsHandle && !dragging}
      <button
        class="history-back history-back--docked"
        style={`--timeline-position: ${timelinePosition(displayIndex, total) / 100}`}
        aria-label="Return to your last-read position"
        title="Return to your last-read position"
        disabled={busy}
        onpointerdown={(event) => event.stopPropagation()}
        onclick={returnToOrigin}>Back</button
      >
    {/if}
  </div>
  <button
    class="history-date"
    aria-label="Go to the latest post"
    disabled={busy}
    onclick={() => commit(total - 1)}
  >
    <time datetime={new Date(lastTimestamp * 1_000).toISOString()}>
      {formatShortDate(lastTimestamp)}
    </time>
  </button>
</div>

<style>
  .timeline-track-shell {
    display: grid;
    grid-template-rows: auto clamp(10.625rem, 45vh, 18.75rem) auto;
    gap: 0.35rem;
    height: 100%;
    color: var(--muted-foreground);
    font-size: 0.75rem;
  }

  .timeline-track-shell.fluid {
    grid-template-rows: auto minmax(16rem, 1fr) auto;
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
    grid-template-columns: minmax(0, 1fr) auto;
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
    grid-column: 1;
    font-size: 0.9rem;
    line-height: 1rem;
  }

  .history-current span {
    grid-column: 1;
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

  .history-back--docked {
    z-index: 3;
    top: calc(
      (100% - var(--timeline-handle-height)) * var(--timeline-position) +
        var(--timeline-handle-height) / 2
    );
    right: 0.25rem;
    left: auto;
    padding: 0.25rem 0.45rem;
    border-radius: var(--radius);
    background: var(--primary);
    color: var(--primary-foreground);
    font-size: 0.7rem;
    font-weight: 600;
    transform: translateY(-50%);
  }

  @media (prefers-reduced-motion: reduce) {
    .history-handle {
      transition: none;
    }
  }
</style>
