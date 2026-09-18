<script lang="ts">
  import type { Snippet } from "svelte";

  import CommunityProjectsRevisionGraphCopy from "./CommunityProjectsRevisionGraphCopy.svelte";
  import CommunityProjectsRevisionGraphIds from "./CommunityProjectsRevisionGraphIds.svelte";
  import type {
    RepositoryLogDevice,
    RepositoryLogRevision,
  } from "../../projects/repository-log.js";
  import {
    REPOSITORY_LOG_NODE_RADIUS,
    REPOSITORY_LOG_ROW_HEIGHT,
    REPOSITORY_LOG_STROKE_WIDTH,
    buildRepositoryLogGraph,
    repositoryLogContentLeft,
    repositoryLogConvergePath,
    repositoryLogLaneStem,
    repositoryLogLaneX,
    repositoryLogMergePath,
    repositoryLogSplitPath,
    repositoryLogSvgWidth,
    type RepositoryLogGraphRow,
  } from "../../projects/repository-log-graph.js";

  let {
    revisions,
    devices = [],
    selectedId = null,
    graphLabel = "Revision graph",
    commitLabel = "commit ID",
    onSelect,
    selectedFiles,
  }: {
    revisions: RepositoryLogRevision[];
    devices?: RepositoryLogDevice[] | undefined;
    selectedId?: string | null | undefined;
    graphLabel?: string | undefined;
    commitLabel?: string | undefined;
    onSelect?: ((revision: RepositoryLogRevision) => void) | undefined;
    selectedFiles?: Snippet | undefined;
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
  aria-label={graphLabel}
>
  {#each rows as row (row.revision.eventId)}
    {@const commitX = repositoryLogLaneX(row.commitLane)}
    {@const centerY = rowHeight / 2}
    <li
      class="community-revision-graph__item"
      class:community-revision-graph__item--selected={selectedId ===
        row.revision.eventId}
      aria-current={selectedId === row.revision.eventId ? "true" : undefined}
    >
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="community-revision-graph__row"
        class:community-revision-graph__row--tip={row.isTip}
        style:padding-left="{repositoryLogContentLeft(row)}px"
        style:height="{rowHeight}px"
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
            {#if stem.y1 !== stem.y2}
              <line
                x1={x}
                y1={stem.y1}
                x2={x}
                y2={stem.y2}
                stroke={lane.color}
                stroke-width={REPOSITORY_LOG_STROKE_WIDTH}
              />
            {/if}
          {/each}
          {#if row.splitFromLane != null}
            <path
              class="community-revision-graph__edge"
              d={repositoryLogSplitPath(
                repositoryLogLaneX(row.splitFromLane),
                commitX,
                rowHeight,
              )}
              stroke={laneColor(row, row.splitFromLane)}
              stroke-width={REPOSITORY_LOG_STROKE_WIDTH}
            />
          {/if}
          {#each row.mergeFromLanes as mergeLane (mergeLane)}
            <path
              class="community-revision-graph__edge"
              d={repositoryLogMergePath(
                commitX,
                repositoryLogLaneX(mergeLane),
                rowHeight,
              )}
              stroke={laneColor(row, mergeLane)}
              stroke-width={REPOSITORY_LOG_STROKE_WIDTH}
            />
          {/each}
          {#each row.convergingLanes as convergeLane (convergeLane)}
            <path
              class="community-revision-graph__edge"
              d={repositoryLogConvergePath(
                repositoryLogLaneX(convergeLane),
                commitX,
                rowHeight,
              )}
              stroke={laneColor(row, convergeLane)}
              stroke-width={REPOSITORY_LOG_STROKE_WIDTH}
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
        <CommunityProjectsRevisionGraphCopy {row} />
      </div>
      <CommunityProjectsRevisionGraphIds
        changeId={row.changeIdEncoded}
        commitId={row.revision.eventId}
        {commitLabel}
      />
      {#if selectedId === row.revision.eventId && selectedFiles}
        <div class="community-revision-graph__files">
          {@render selectedFiles()}
        </div>
      {/if}
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
    padding-right: 7.5rem;
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

  .community-revision-graph__row--tip
    :global(.community-revision-graph-message) {
    font-weight: 600;
  }

  .community-revision-graph__svg {
    position: absolute;
    top: 0;
    left: 0;
    overflow: visible;
    pointer-events: none;
  }

  .community-revision-graph__files {
    position: relative;
    z-index: 1;
    padding: 0 0.5rem 0.5rem;
  }

  .community-revision-graph__edge {
    fill: none;
  }
</style>
