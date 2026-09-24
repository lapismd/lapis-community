<script lang="ts">
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import type { CommunityAgentTranscriptEntry } from "../../community/agent-contracts.js";
  import { planStatusLabel } from "../../community/agent-transcript-plan.js";

  let {
    item,
  }: {
    item: Extract<CommunityAgentTranscriptEntry, { type: "plan" }>;
  } = $props();

  function tone(status: string | undefined) {
    if (status === "completed") return "success" as const;
    if (status === "in_progress") return "accent" as const;
    return "warning" as const;
  }
</script>

<section class="agent-transcript-plan" aria-label="Plan">
  <h3>Plan</h3>
  <ol>
    {#each item.entries as entry, index (`${index}:${entry.content}`)}
      <li data-plan-status={entry.status ?? "pending"}>
        <CommunityChip size="compact" tone={tone(entry.status)}
          >{planStatusLabel(entry.status)}</CommunityChip
        >
        <span>{entry.content}</span>
      </li>
    {/each}
  </ol>
</section>

<style>
  .agent-transcript-plan {
    display: grid;
    gap: 0.5rem;
    min-width: 0;
  }
  .agent-transcript-plan h3 {
    margin: 0;
    font-size: var(--community-text-section);
    font-weight: 700;
  }
  .agent-transcript-plan ol {
    display: grid;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .agent-transcript-plan li {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    min-width: 0;
  }
  .agent-transcript-plan li :global(.community-chip) {
    order: 1;
    margin-inline-start: auto;
    flex-shrink: 0;
  }
  .agent-transcript-plan li span {
    min-width: 0;
    overflow-wrap: anywhere;
  }
</style>
