<script lang="ts" generics="Row">
  import { createVirtualizer } from "@tanstack/svelte-virtual";
  import { get } from "svelte/store";
  import { onDestroy, untrack, type Snippet } from "svelte";

  let {
    rows,
    row,
    getKey = (item: Row, index: number) =>
      (item as { id?: string }).id || String(index),
    estimateSize = () => 64,
    overscan = 8,
    class: className = "",
    loading = false,
    hasMore = false,
    loadingLabel = "Loading more items",
    onLoadMore,
    onVisibleCursorChange,
    cursorForRow,
    scrollToKey,
  }: {
    rows: readonly Row[];
    row: Snippet<[Row, number]>;
    getKey?: ((row: Row, index: number) => string) | undefined;
    estimateSize?:
      | ((row: Row | undefined, index: number) => number)
      | undefined;
    overscan?: number | undefined;
    class?: string | undefined;
    loading?: boolean | undefined;
    hasMore?: boolean | undefined;
    loadingLabel?: string | undefined;
    onLoadMore?: (() => void) | undefined;
    onVisibleCursorChange?: ((cursor: string | undefined) => void) | undefined;
    cursorForRow?: ((row: Row) => string | undefined) | undefined;
    scrollToKey?: string | null | undefined;
  } = $props();

  let host: HTMLDivElement;
  let scrollElement = $state<HTMLElement | null | undefined>(undefined);
  let alive = true;
  let lastLoadMoreKey = "";
  let lastCursor: string | undefined;
  let lastScrollToKey: string | null | undefined;
  let prior:
    | {
        rows: readonly Row[];
        scrollElement: HTMLElement | null | undefined;
        overscan: number;
      }
    | undefined;

  onDestroy(() => {
    alive = false;
  });

  const virtualizer = createVirtualizer<HTMLElement, HTMLDivElement>({
    count: 0,
    getScrollElement: () => scrollElement ?? null,
    getItemKey: (index) => getKey(rows[index]!, index),
    estimateSize: (index) => estimateSize(rows[index], index),
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

  function nearestScrollElement(
    node: HTMLElement | undefined,
  ): HTMLElement | null {
    let current = node?.parentElement ?? null;
    while (current) {
      const style = getComputedStyle(current);
      if (/(auto|scroll|overlay)/u.test(`${style.overflowY} ${style.overflow}`))
        return current;
      current = current.parentElement;
    }
    return null;
  }

  $effect(() => {
    scrollElement = nearestScrollElement(host);
  });

  $effect(() => {
    const nextRows = rows;
    const nextScrollElement = scrollElement;
    const nextOverscan = overscan;
    untrack(() => {
      if (
        prior?.rows === nextRows &&
        prior.scrollElement === nextScrollElement &&
        prior.overscan === nextOverscan
      )
        return;
      prior = {
        rows: nextRows,
        scrollElement: nextScrollElement,
        overscan: nextOverscan,
      };
      get(virtualizer).setOptions({
        enabled: nextScrollElement != null,
        count: nextRows.length,
        getScrollElement: () => nextScrollElement ?? null,
        getItemKey: (index) => getKey(nextRows[index]!, index),
        estimateSize: (index) => estimateSize(nextRows[index], index),
        overscan: nextOverscan,
      });
    });
  });

  $effect(() => {
    const key = scrollToKey;
    if (!key || key === lastScrollToKey) return;
    const index = rows.findIndex(
      (item, rowIndex) => getKey(item, rowIndex) === key,
    );
    if (index < 0) return;
    lastScrollToKey = key;
    untrack(() => get(virtualizer).scrollToIndex(index, { align: "center" }));
  });

  $effect(() => {
    const items = $virtualizer.getVirtualItems();
    if (items.length === 0) return;
    const first = rows[items[0]!.index];
    const cursor = first && cursorForRow ? cursorForRow(first) : undefined;
    if (cursor !== lastCursor) {
      lastCursor = cursor;
      onVisibleCursorChange?.(cursor);
    }
    const last = items.at(-1);
    if (!last || rows.length === 0 || !hasMore || loading || !onLoadMore)
      return;
    if (last.index < Math.max(0, rows.length - Math.max(4, overscan))) return;
    const finalRow = rows.at(-1);
    if (!finalRow) return;
    const loadKey = `${rows.length}:${getKey(finalRow, rows.length - 1)}`;
    if (loadKey === lastLoadMoreKey) return;
    lastLoadMoreKey = loadKey;
    onLoadMore();
  });
</script>

<div
  bind:this={host}
  class={`community-projects-virtual-rows ${className}`.trim()}
  data-ui-component="community-projects-virtual-rows"
>
  {#if scrollElement}
    <div
      class="community-projects-virtual-rows__content"
      style:height={`${$virtualizer.getTotalSize()}px`}
    >
      {#each $virtualizer.getVirtualItems() as virtualRow (virtualRow.key)}
        {@const item = rows[virtualRow.index]}
        {#if item}
          <div
            class="community-projects-virtual-rows__row"
            data-ui-part="virtual-row"
            data-index={virtualRow.index}
            data-row-id={getKey(item, virtualRow.index)}
            style:transform={`translateY(${virtualRow.start}px)`}
            use:measure
          >
            {@render row(item, virtualRow.index)}
          </div>
        {/if}
      {/each}
    </div>
  {:else if scrollElement === null}
    <div class="community-projects-virtual-rows__fallback">
      {#each rows as item, index (getKey(item, index))}
        <div
          class="community-projects-virtual-rows__fallback-row"
          data-ui-part="virtual-row"
          data-index={index}
          data-row-id={getKey(item, index)}
        >
          {@render row(item, index)}
        </div>
      {/each}
    </div>
  {/if}
  {#if loading && rows.length > 0}
    <div
      class="community-projects-virtual-rows__edge"
      role="status"
      aria-busy="true"
    >
      {loadingLabel}
    </div>
  {/if}
</div>

<style>
  .community-projects-virtual-rows {
    min-width: 0;
  }

  .community-projects-virtual-rows__content {
    position: relative;
    width: 100%;
  }

  .community-projects-virtual-rows__row {
    position: absolute;
    inset-block-start: 0;
    inset-inline: 0;
    width: 100%;
  }

  .community-projects-virtual-rows__fallback {
    display: grid;
  }

  .community-projects-virtual-rows__edge {
    padding: 0.75rem;
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
    text-align: center;
  }
</style>
