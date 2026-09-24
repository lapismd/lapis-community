<script lang="ts">
  import "./transcript-plan.css";
  import CommunityTranscriptComments from "../community-transcript-comments/CommunityTranscriptComments.svelte";
  import type { TranscriptCommentSource } from "../community-agent-conversation/transcript-comment-sources.js";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import type { CommunityAgentTranscriptEntry } from "../../community/agent-contracts.js";
  import { planStatusLabel } from "../../community/agent-transcript-plan.js";

  let {
    item,
    source,
  }: {
    source?: TranscriptCommentSource | undefined;
    item: Extract<CommunityAgentTranscriptEntry, { type: "plan" }>;
  } = $props();

  function tone(status: string | undefined) {
    if (status === "completed") return "success" as const;
    if (status === "in_progress") return "accent" as const;
    return "warning" as const;
  }
</script>

<div class="agent-transcript-plan" role="group" aria-label="Plan">
  <h3>Plan</h3>
  <ol>
    {#each item.entries as entry, index (`${index}:${entry.content}`)}
      <li data-plan-status={entry.status ?? "pending"}>
        <CommunityTranscriptComments
          {source}
          part={`plan:${index}`}
          label={`Plan step ${index + 1}`}
          text={entry.content}
        >
          <div class="agent-transcript-plan__step">
            <CommunityChip size="compact" tone={tone(entry.status)}
              >{planStatusLabel(entry.status)}</CommunityChip
            >
            <span>{entry.content}</span>
          </div>
        </CommunityTranscriptComments>
      </li>
    {/each}
  </ol>
</div>
