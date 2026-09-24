<script lang="ts">
  import type { Snippet } from "svelte";
  import { formatCommunityFullDate } from "../community-relative-time/model.js";

  let {
    createdAt,
    label = "Transcript timestamp",
    timeOffset = "0.625rem",
    children,
  }: {
    createdAt: string;
    label?: string;
    timeOffset?: string;
    children: Snippet;
  } = $props();

  const timestampMs = $derived(Date.parse(createdAt));
  const hasTimestamp = $derived(Number.isFinite(timestampMs));
  const timestampSeconds = $derived(Math.floor(timestampMs / 1_000));
  const shortTime = $derived(
    hasTimestamp ? new Date(timestampMs).toISOString().slice(11, 16) : "",
  );
  const fullTime = $derived(
    hasTimestamp ? formatCommunityFullDate(timestampSeconds) : "",
  );
  let visible = $state(false);
</script>

<div
  class="agent-transcript-timed-row"
  role="group"
  aria-label={label}
  style={`--agent-transcript-timed-row-time-offset: ${timeOffset}`}
  data-ui-part="transcript-timed-row"
  data-visible={visible ? "" : undefined}
  onpointerenter={() => {
    visible = true;
  }}
  onpointerleave={() => {
    visible = false;
  }}
  onfocusin={() => {
    visible = true;
  }}
  onfocusout={() => {
    visible = false;
  }}
>
  <span
    class="agent-transcript-timed-row__time"
    data-ui-part="transcript-timed-row-time"
    aria-label={hasTimestamp ? label : undefined}
    aria-hidden={hasTimestamp ? undefined : "true"}
    title={fullTime}
  >
    {shortTime}
  </span>
  <div class="agent-transcript-timed-row__content">
    {@render children()}
  </div>
</div>

<style>
  .agent-transcript-timed-row {
    display: grid;
    width: 100%;
    min-width: 0;
    --agent-transcript-timed-row-gutter: 2rem;
    --agent-transcript-timed-row-time-width: 2.75rem;

    grid-template-columns: var(--agent-transcript-timed-row-gutter) minmax(
        0,
        1fr
      );
    align-items: start;
  }

  .agent-transcript-timed-row__time {
    display: flex;
    min-width: 0;
    justify-content: flex-start;
    justify-self: end;
    width: var(--agent-transcript-timed-row-time-width);
    padding-top: var(--agent-transcript-timed-row-time-offset);
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
    line-height: 1.25rem;
    opacity: 0;
    transition: opacity 120ms ease;
  }

  .agent-transcript-timed-row[data-visible] .agent-transcript-timed-row__time,
  .agent-transcript-timed-row:hover .agent-transcript-timed-row__time,
  .agent-transcript-timed-row:focus-within .agent-transcript-timed-row__time {
    opacity: 1;
  }

  .agent-transcript-timed-row__content {
    min-width: 0;
  }
</style>
