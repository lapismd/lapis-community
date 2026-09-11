<script lang="ts">
  import * as Dialog from "@lapismd/design-core/shadcn/dialog";
  import { DialogFrame } from "@lapismd/design-core/forms/dialog";
  import type { Snippet } from "svelte";

  import DiscussionTimelineTrack from "./DiscussionTimelineTrack.svelte";

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
    actions,
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
    approximate?: boolean;
    pageSize?: number;
    actions?: Snippet;
    onJump: (index: number) => void | Promise<void>;
    onReturn: () => void | Promise<void>;
  } = $props();

  let mobileOpen = $state(false);
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
      {approximate}
      {pageSize}
      {onJump}
      {onReturn}
    />
    {#if actions}
      <div class="history-actions">{@render actions()}</div>
    {/if}
  </div>
</aside>

<button
  class="mobile-timeline-trigger"
  type="button"
  aria-expanded={mobileOpen}
  aria-controls="discussion-mobile-timeline"
  onclick={() => (mobileOpen = true)}
>
  <span>
    {approximate
      ? `Approximately ${total} posts`
      : `Post ${currentIndex + 1} of ${total}`}
  </span>
  <strong>Timeline</strong>
</button>

<Dialog.Root bind:open={mobileOpen}>
  <DialogFrame
    title="Discussion timeline"
    size="compact"
    id="discussion-mobile-timeline"
    description={approximate
      ? `Approximately ${total} posts. Exact timeline navigation is unavailable.`
      : `Jump through ${total} posts without loading the whole topic.`}
  >
    <div class="mobile-timeline-rail">
      <DiscussionTimelineTrack
        {total}
        {currentIndex}
        {currentTimestamp}
        {firstTimestamp}
        {lastTimestamp}
        {returnIndex}
        {disabled}
        {approximate}
        {pageSize}
        fluid
        {onJump}
        {onReturn}
        onCommitted={() => (mobileOpen = false)}
      />
      {#if actions}
        <div class="history-actions history-actions--mobile">
          {@render actions()}
        </div>
      {/if}
    </div>
  </DialogFrame>
</Dialog.Root>

<style>
  .history-sticky {
    position: sticky;
    top: calc(56px + 2.5rem);
    display: grid;
    gap: 0.75rem;
  }

  .history-actions {
    display: flex;
    align-items: center;
    justify-content: flex-start;
  }

  .history-actions--mobile {
    margin-top: 1rem;
  }

  .mobile-timeline-trigger {
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

    .mobile-timeline-rail {
      height: min(28rem, 50dvh);
      width: min(100%, 18rem);
      min-height: 0;
      margin: 0 auto;
    }
  }
</style>
