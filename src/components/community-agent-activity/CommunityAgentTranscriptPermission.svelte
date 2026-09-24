<script lang="ts">
  import type { CommunityAgentTranscriptEntry } from "../../community/agent-contracts.js";
  import CommunityAgentTranscriptTimedRow from "./CommunityAgentTranscriptTimedRow.svelte";

  let {
    item,
  }: {
    item: Extract<CommunityAgentTranscriptEntry, { type: "permission" }>;
  } = $props();

  const label = $derived(
    `Permission ${item.decision ?? "resolved"} for ${item.tool}`,
  );
</script>

<CommunityAgentTranscriptTimedRow
  createdAt={item.createdAt}
  label="Permission resolved"
  timeOffset="0"
>
  <p
    class="agent-transcript-permission"
    title={label}
    aria-label={label}
    data-ui-part="agent-transcript-permission"
  >
    {label}
  </p>
</CommunityAgentTranscriptTimedRow>

<style>
  .agent-transcript-permission {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    margin: 0;
    padding-inline-start: 1.375rem;
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
    line-height: 1rem;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
