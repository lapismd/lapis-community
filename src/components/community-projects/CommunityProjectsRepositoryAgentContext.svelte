<script lang="ts">
  import { agentContextMessageRole } from "../../projects/repository-agent-context.js";

  import CommunityAgentContextMessage from "../community-agent-context-message/CommunityAgentContextMessage.svelte";
  import CommunityAgentContextReferences from "../community-agent-context-references/CommunityAgentContextReferences.svelte";
  import CommunityAgentCheckpointDivider from "../community-agent-checkpoint-divider/CommunityAgentCheckpointDivider.svelte";
  import type { RepositoryAgentCheckpoint } from "../../projects/repository-agent-context.js";
  import type { CommunityMemberModel } from "../community-workspace/model.js";
  import CommunityAgentTranscript from "../community-agent-activity/CommunityAgentTranscript.svelte";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityRelativeTime from "../community-relative-time/CommunityRelativeTime.svelte";
  import { repositoryContextTurns } from "./repository-context-transcript.js";
  let {
    checkpoints,
    members = [],
    repositoryAddress,
    showReferenceMenu = true,
  }: {
    checkpoints: readonly RepositoryAgentCheckpoint[];
    members?: readonly CommunityMemberModel[];
    repositoryAddress?: string;
    showReferenceMenu?: boolean;
  } = $props();
  const turns = $derived(repositoryContextTurns(checkpoints));
</script>

<div
  class="community-projects-agent-context"
  data-ui-component="community-projects-agent-context"
  role="region"
  aria-label="Agent context"
>
  {#each turns as turn (`${turn.latest.authorPubkey}:${turn.latest.scopeId}:${turn.latest.spanId}`)}
    {@const member = members.find(
      (member) => member.id === turn.latest.authorPubkey,
    )}
    {@const agent = {
      pubkey: turn.latest.authorPubkey,
      name: member?.name ?? turn.latest.actorName ?? "Agent",
      ...(member?.avatarUrl ? { avatarUrl: member.avatarUrl } : {}),
    }}
    <section
      class="community-projects-agent-context__checkpoint"
      aria-label="Agent checkpoint"
    >
      <header class="community-projects-agent-context__header">
        <span
          >{agent.name} · <CommunityRelativeTime
            timestamp={turn.latest.createdAt}
          /></span
        >
        <span class="community-projects-agent-context__status">
          {#if !turn.latest.records.some((record) => record.kind === "transcript")}<span
              >Legacy coverage</span
            >{/if}
          <CommunityChip
            size="compact"
            tone={turn.latest.outcome === "completed" ? "success" : "danger"}
            >{turn.latest.live ? "Running" : turn.latest.outcome}</CommunityChip
          >
          {#if !turn.latest.complete && !turn.latest.live}<CommunityChip
              size="compact"
              tone="warning">Incomplete</CommunityChip
            >{/if}
          {#if showReferenceMenu}
            <CommunityAgentContextReferences
              checkpoints={turn.segments.map((segment) => segment.checkpoint)}
              {repositoryAddress}
            />
          {/if}
        </span>
      </header>
      {#each turn.segments as segment (segment.checkpoint.eventId)}
        {#if segment.checkpoint.availability === "missing"}
          <p role="status">
            Some agent context is unavailable. Waiting for the referenced
            messages.
          </p>
        {:else if segment.activity.length}
          <CommunityAgentTranscript
            activity={segment.activity}
            {agent}
            {members}
          >
            {#snippet messageContent(message)}
              <CommunityAgentContextMessage
                {message}
                {members}
                channelId={turn.latest.channelId}
                requestId={turn.segments
                  .flatMap((s) => s.checkpoint.records)
                  .find((r) => agentContextMessageRole(r) === "user")
                  ?.sourceEventId}
              />
            {/snippet}
          </CommunityAgentTranscript>
        {/if}
        {#if segment.commitIds.length}
          <CommunityAgentCheckpointDivider
            commitIds={segment.commitIds}
            {repositoryAddress}
          />
        {/if}
      {/each}
    </section>
  {/each}
</div>

<style>
  .community-projects-agent-context {
    display: grid;
    gap: 0.75rem;
    padding: 0.75rem;
  }

  .community-projects-agent-context__checkpoint {
    min-width: 0;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--background);
  }

  .community-projects-agent-context__header {
    display: flex;
    min-height: 2.25rem;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.4rem 0.6rem;
    border-bottom: 1px solid var(--border);
    color: var(--muted-foreground);
    font-size: var(--community-text-secondary);
  }

  .community-projects-agent-context__status {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .community-projects-agent-context
    :global([data-ui-component="ai-chat-message-list"]) {
    min-height: 0;
    padding: 0.65rem;
  }
</style>
