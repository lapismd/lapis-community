<script lang="ts">
  import type { CommunityAgentTranscriptEntry } from "../../community/agent-contracts.js";

  let {
    item,
  }: {
    item: Extract<CommunityAgentTranscriptEntry, { type: "permission" }>;
  } = $props();

  const label = $derived(
    `Permission ${item.decision ?? "resolved"} for ${item.tool}`,
  );
</script>

<p
  class="agent-transcript-permission"
  title={label}
  aria-label={label}
  data-ui-part="agent-transcript-permission"
>
  {label}
</p>

<style>
  .agent-transcript-permission {
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    margin: 0;
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
    line-height: 1rem;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
