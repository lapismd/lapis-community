<script lang="ts">
  import { createVirtualizer } from "@tanstack/svelte-virtual";
  import { get } from "svelte/store";
  import { onDestroy, untrack, type Snippet } from "svelte";
  import type { CommunityTopicModel } from "../community-workspace/model.js";
  import { estimateForumTopicRow } from "./topic-row-estimate.js";

  let {
    topics,
    viewport,
    row,
    overscan = 6,
  }: {
    topics: readonly CommunityTopicModel[];
    viewport: HTMLElement;
    row: Snippet<[CommunityTopicModel, number]>;
    overscan?: number;
  } = $props();

  let alive = true;
  let prior:
    | {
        topics: readonly CommunityTopicModel[];
        viewport: HTMLElement;
        overscan: number;
      }
    | undefined;

  onDestroy(() => {
    alive = false;
  });

  const virtualizer = createVirtualizer<HTMLElement, HTMLDivElement>({
    count: 0,
    getScrollElement: () => viewport,
    getItemKey: (index) => topics[index]?.id ?? index,
    estimateSize: (index) => estimateForumTopicRow(topics[index]),
    enabled: false,
    overscan: 0,
    useAnimationFrameWithResizeObserver: true,
  });

  function measure(node: HTMLDivElement) {
    untrack(() => get(virtualizer).measureElement(node));
    return {
      destroy() {
        untrack(() => {
          if (alive) get(virtualizer).measureElement(null);
        });
      },
    };
  }

  $effect(() => {
    const nextTopics = topics;
    const nextViewport = viewport;
    const nextOverscan = overscan;
    untrack(() => {
      if (
        prior?.topics === nextTopics &&
        prior.viewport === nextViewport &&
        prior.overscan === nextOverscan
      )
        return;
      prior = {
        topics: nextTopics,
        viewport: nextViewport,
        overscan: nextOverscan,
      };
      get(virtualizer).setOptions({
        enabled: true,
        count: nextTopics.length,
        getScrollElement: () => nextViewport,
        getItemKey: (index) => nextTopics[index]?.id ?? index,
        estimateSize: (index) => estimateForumTopicRow(nextTopics[index]),
        overscan: nextOverscan,
      });
    });
  });
</script>

<div
  class="forum-topic-list__virtual-content"
  data-ui-part="forum-topic-virtual-content"
  style:height={`${$virtualizer.getTotalSize()}px`}
>
  {#each $virtualizer.getVirtualItems() as virtualRow (virtualRow.key)}
    {@const topic = topics[virtualRow.index]}
    {#if topic}
      <div
        class="forum-topic-list__virtual-row"
        data-ui-part="forum-topic-virtual-row"
        data-topic-id={topic.id}
        data-index={virtualRow.index}
        style:transform={`translateY(${virtualRow.start}px)`}
        use:measure
      >
        {@render row(topic, virtualRow.index)}
      </div>
    {/if}
  {/each}
</div>

<style>
  .forum-topic-list__virtual-content {
    position: relative;
    width: 100%;
  }

  .forum-topic-list__virtual-row {
    position: absolute;
    inset-block-start: 0;
    inset-inline: 0;
    width: 100%;
  }
</style>
