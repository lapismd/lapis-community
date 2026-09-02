<script lang="ts">
  import {
    timelineIndexFromPosition,
    timelinePosition,
    timelineTimestamp,
  } from "../registry-community/model.js";

  let {
    total,
    currentIndex,
    currentTimestamp,
    firstTimestamp,
    lastTimestamp,
    returnIndex,
    disabled = false,
    pageSize = 20,
    fluid = false,
    onJump,
    onReturn,
    onCommitted = () => {},
  }: {
    total: number;
    currentIndex: number;
    currentTimestamp: number;
    firstTimestamp: number;
    lastTimestamp: number;
    returnIndex?: number | undefined;
    disabled?: boolean;
    pageSize?: number;
    fluid?: boolean;
    onJump: (index: number) => void | Promise<void>;
    onReturn: () => void | Promise<void>;
    onCommitted?: () => void;
  } = $props();

  let previewIndex = $state<number | undefined>();
  let dragging = $state(false);
  let pointerId: number | undefined;
  let dragOffset = 0;
  let activeTrack: HTMLElement | undefined;

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
    if (target instanceof Element && target.closest(".history-back") !== null)
      return;
    const track = event.currentTarget as HTMLElement;
    const handle = track.querySelector<HTMLElement>(".history-handle");
    const bounds = handle?.getBoundingClientRect();
    dragOffset =
      target instanceof Element &&
      target.closest(".history-handle") !== null &&
      bounds !== undefined
        ? event.clientY - (bounds.top + bounds.height / 2)
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

  async function commit(index: number): Promise<void> {
    if (disabled || total === 0) return;
    await onJump(Math.max(0, Math.min(index, total - 1)));
    onCommitted();
  }

  function finishDrag(event: PointerEvent): void {
    if (!dragging || event.pointerId !== pointerId || activeTrack === undefined)
      return;
    const targetIndex = indexForPointer(activeTrack, event.clientY);
    if (activeTrack.hasPointerCapture(event.pointerId)) {
      activeTrack.releasePointerCapture(event.pointerId);
    }
    resetDrag();
    void commit(targetIndex);
  }

  function handleKey(event: KeyboardEvent): void {
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
    void commit(targetIndex);
  }

  async function returnToOrigin(): Promise<void> {
    await onReturn();
    onCommitted();
  }
</script>

<div class:fluid class="timeline-track-shell">
  <button
    class="history-date"
    aria-label="Go to the first post"
    {disabled}
    onclick={() => commit(0)}
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
    onpointerup={finishDrag}
    onpointercancel={(event) => {
      if (event.pointerId === pointerId) resetDrag();
    }}
  >
    <span class="history-line" aria-hidden="true"></span>
    {#if returnIndex !== undefined && returnIndex !== currentIndex}
      <button
        class="history-back"
        style={`--timeline-return-position: ${timelinePosition(returnIndex, total) / 100}`}
        aria-label={`Back to post ${returnIndex + 1}`}
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
      aria-valuemin="1"
      aria-valuemax={total}
      aria-valuenow={displayIndex + 1}
      aria-valuetext={`Post ${displayIndex + 1} of ${total}, ${formatShortDate(displayTimestamp)}`}
      onkeydown={handleKey}
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

  @media (prefers-reduced-motion: reduce) {
    .history-handle {
      transition: none;
    }
  }
</style>
