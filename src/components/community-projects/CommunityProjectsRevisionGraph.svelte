<script lang="ts">
  import GitMerge from "@lucide/svelte/icons/git-merge";
  import Camera from "@lucide/svelte/icons/camera";

  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import type {
    RepositoryLogDevice,
    RepositoryLogRevision,
  } from "../../projects/repository-log.js";
  import {
    REPOSITORY_LOG_NODE_RADIUS,
    REPOSITORY_LOG_ROW_HEIGHT,
    buildRepositoryLogGraph,
    formatRepositoryLogTimestamp,
    repositoryLogContentLeft,
    repositoryLogLaneStem,
    repositoryLogLaneX,
    repositoryLogReasonLabel,
    repositoryLogRowLabel,
    repositoryLogSvgWidth,
    type RepositoryLogGraphRow,
  } from "../../projects/repository-log-graph.js";

  let {
    revisions,
    devices = [],
    selectedId = null,
    onSelect,
  }: {
    revisions: RepositoryLogRevision[];
    devices?: RepositoryLogDevice[] | undefined;
    selectedId?: string | null | undefined;
    onSelect?: ((revision: RepositoryLogRevision) => void) | undefined;
  } = $props();

  const rows = $derived(buildRepositoryLogGraph(revisions, devices));
  const svgWidth = $derived(repositoryLogSvgWidth(rows));
  const rowHeight = REPOSITORY_LOG_ROW_HEIGHT;
  const radius = REPOSITORY_LOG_NODE_RADIUS;

  function laneColor(row: RepositoryLogGraphRow, lane: number): string {
    return row.lanes[lane]?.color ?? "var(--primary)";
  }
</script>

<ol
  class="community-revision-graph"
  style:--community-revision-graph-row-height="{rowHeight}px"
  aria-label="Revision graph"
>
  {#each rows as row (row.revision.eventId)}
    {@const commitX = repositoryLogLaneX(row.commitLane)}
    {@const centerY = rowHeight / 2}
    <li
      class="community-revision-graph__item"
      class:community-revision-graph__item--selected={selectedId ===
        row.revision.eventId}
    >
      <button
        type="button"
        class="community-revision-graph__row"
        class:community-revision-graph__row--tip={row.isTip}
        style:padding-left="{repositoryLogContentLeft(row)}px"
        style:height="{rowHeight}px"
        aria-current={selectedId === row.revision.eventId ? "true" : undefined}
        aria-label={repositoryLogRowLabel(row)}
        data-revision-id={row.revision.eventId}
        onclick={() => onSelect?.(row.revision)}
      >
        <svg
          class="community-revision-graph__svg"
          width={svgWidth}
          height={rowHeight}
          aria-hidden="true"
        >
          {#each row.lanes as lane, index (index)}
            {@const x = repositoryLogLaneX(index)}
            {@const stem = repositoryLogLaneStem(row, index, rowHeight)}
            <line
              x1={x}
              y1={stem.y1}
              x2={x}
              y2={stem.y2}
              stroke={lane.color}
              stroke-width="2"
            />
          {/each}
          {#if row.splitFromLane != null}
            {@const parentX = repositoryLogLaneX(row.splitFromLane)}
            <path
              class="community-revision-graph__edge"
              d={`M ${parentX} ${rowHeight} C ${parentX} ${rowHeight - 10}, ${commitX} ${centerY + 10}, ${commitX} ${centerY}`}
              stroke={laneColor(row, row.splitFromLane)}
              stroke-width="2"
            />
          {/if}
          {#each row.mergeFromLanes as mergeLane (mergeLane)}
            {@const parentX = repositoryLogLaneX(mergeLane)}
            <path
              class="community-revision-graph__edge"
              d={`M ${commitX} ${centerY} C ${commitX} ${centerY + 22}, ${parentX} ${centerY + 10}, ${parentX} ${rowHeight}`}
              stroke={laneColor(row, mergeLane)}
              stroke-width="2"
            />
          {/each}
          {#each row.convergingLanes as convergeLane (convergeLane)}
            {@const fromX = repositoryLogLaneX(convergeLane)}
            <path
              class="community-revision-graph__edge"
              d={`M ${fromX} ${centerY} C ${fromX} ${centerY + 14}, ${commitX} ${centerY + 14}, ${commitX} ${centerY}`}
              stroke={laneColor(row, convergeLane)}
              stroke-width="2"
            />
          {/each}
          <circle
            class="community-revision-graph__node"
            cx={commitX}
            cy={centerY}
            r={row.isTip ? radius + 1 : radius}
            fill={laneColor(row, row.commitLane)}
          />
        </svg>
        <span class="community-revision-graph__copy">
          <span class="community-revision-graph__title-row">
            <span class="community-revision-graph__icon" aria-hidden="true">
              {#if row.revision.reason === "merge"}
                <GitMerge />
              {:else}
                <Camera />
              {/if}
            </span>
            <span class="community-revision-graph__title"
              >{row.revision.message}</span
            >
          </span>
          <span class="community-revision-graph__meta">
            {#if row.revision.author}
              <span>{row.revision.author}</span>
            {/if}
            <time
              datetime={new Date(row.revision.createdAt * 1000).toISOString()}
            >
              {formatRepositoryLogTimestamp(row.revision.createdAt)}
            </time>
            {#if row.changeIdShort}
              <span
                class="community-revision-graph__change-id"
                title={row.changeIdEncoded || undefined}
                >{row.changeIdShort}</span
              >
            {/if}
            <span
              class="community-revision-graph__commit-id"
              title={row.revision.eventId}>{row.commitIdShort}</span
            >
          </span>
          <span class="community-revision-graph__chips">
            <CommunityChip size="compact" variant="muted" ariaHidden
              >{repositoryLogReasonLabel(row.revision.reason)}</CommunityChip
            >
            {#each row.deviceAliases as alias (alias)}
              <CommunityChip size="compact" variant="outline" ariaHidden
                >{alias}</CommunityChip
              >
            {/each}
          </span>
        </span>
      </button>
    </li>
  {/each}
</ol>

<style>
  .community-revision-graph {
    list-style: none;
    margin: 0;
    padding: 0.5rem 0;
  }

  .community-revision-graph__item {
    position: relative;
    display: flex;
    flex-direction: column;
  }

  .community-revision-graph__item:not(:last-child)::after {
    content: "";
    position: absolute;
    inset-inline: 0;
    bottom: 0;
    height: 1px;
    background: var(--border);
    pointer-events: none;
  }

  .community-revision-graph__item--selected {
    background: color-mix(in srgb, var(--foreground) 12%, var(--background));
  }

  .community-revision-graph__row {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    width: 100%;
    margin: 0;
    border: 0;
    color: inherit;
    background: transparent;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .community-revision-graph__row:hover,
  .community-revision-graph__row:focus-visible {
    background: color-mix(in srgb, var(--foreground) 7%, var(--background));
    outline: none;
  }

  .community-revision-graph__row--tip .community-revision-graph__title {
    font-weight: 600;
  }

  .community-revision-graph__svg {
    position: absolute;
    top: 0;
    left: 0;
    overflow: visible;
    pointer-events: none;
  }

  .community-revision-graph__copy {
    display: flex;
    min-width: 0;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 0.15rem;
  }

  .community-revision-graph__title-row {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.4rem;
  }

  .community-revision-graph__title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--community-text-body);
    font-weight: 500;
    line-height: 1.25rem;
  }

  .community-revision-graph__meta {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.35rem;
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
  }

  .community-revision-graph__change-id {
    color: var(--primary);
    font-variant-numeric: tabular-nums;
  }

  .community-revision-graph__commit-id {
    font-variant-numeric: tabular-nums;
  }

  .community-revision-graph__chips {
    display: flex;
    min-width: 0;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3rem;
  }

  .community-revision-graph__icon {
    display: flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    color: var(--muted-foreground);
  }

  .community-revision-graph__icon :global(svg) {
    display: block;
    width: 0.7rem;
    height: 0.7rem;
  }

  .community-revision-graph__edge {
    fill: none;
  }
</style>
