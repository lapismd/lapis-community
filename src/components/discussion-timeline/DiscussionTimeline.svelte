<script lang="ts">
  import DiscussionTimelineTrack from "./DiscussionTimelineTrack.svelte";

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

  let mobileOpen = $state(false);
  let mobileCloseButton = $state<HTMLButtonElement | undefined>();

  $effect(() => {
    if (!mobileOpen) return;
    requestAnimationFrame(() => mobileCloseButton?.focus());
  });
</script>

<aside class="history" aria-label="Discussion history">
  <div class="history-sticky">
    <DiscussionTimelineTrack
      {total}
      {currentIndex}
      {currentTimestamp}
      {firstTimestamp}
      {lastTimestamp}
      {returnIndex}
      {disabled}
      {pageSize}
      {onJump}
      {onReturn}
    />
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
      <DiscussionTimelineTrack
        {total}
        {currentIndex}
        {currentTimestamp}
        {firstTimestamp}
        {lastTimestamp}
        {returnIndex}
        {disabled}
        {pageSize}
        fluid
        {onJump}
        {onReturn}
        onCommitted={() => (mobileOpen = false)}
      />
    </div>
  </div>
{/if}

<style>
  .history-sticky {
    position: sticky;
    top: calc(56px + 2.5rem);
  }

  .mobile-timeline-trigger,
  .mobile-timeline-overlay {
    display: none;
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
      width: min(100%, 18rem);
      min-height: 0;
      margin: 0 auto;
    }
  }
</style>
