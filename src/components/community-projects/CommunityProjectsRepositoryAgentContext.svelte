<script lang="ts">
  import * as Chat from "@lapismd/design-core/ai/chat";

  import type {
    RepositoryAgentCheckpoint,
    RepositoryAgentContextRecord,
  } from "../../projects/repository-agent-context.js";
  import CommunityChip from "../community-chip/CommunityChip.svelte";
  import CommunityMessage from "../community-message/CommunityMessage.svelte";
  import CommunityRelativeTime from "../community-relative-time/CommunityRelativeTime.svelte";
  import type {
    CommunityMemberModel,
    CommunityMessageModel,
  } from "../community-workspace/model.js";

  let { checkpoints }: { checkpoints: readonly RepositoryAgentCheckpoint[] } =
    $props();

  function toolStatus(state: string): "complete" | "error" | "running" {
    if (state === "completed" || state === "complete") return "complete";
    if (state === "failed" || state === "error") return "error";
    return "running";
  }

  function messageAuthor(
    checkpoint: RepositoryAgentCheckpoint,
    record: RepositoryAgentContextRecord,
  ): CommunityMemberModel {
    const agent = record.kind === "assistant_message";
    return {
      id: agent ? checkpoint.authorPubkey : (record.sourceEventId ?? record.id),
      name: agent ? "Agent" : "User",
      handle: agent ? "agent" : "user",
      initials: agent ? "A" : "U",
    };
  }

  function messageModel(
    checkpoint: RepositoryAgentCheckpoint,
    record: RepositoryAgentContextRecord,
  ): CommunityMessageModel {
    const author = messageAuthor(checkpoint, record);
    const createdAt = new Date(record.createdAt);
    return {
      id: record.id,
      authorId: author.id,
      content: record.text ?? "",
      timestamp: Number.isNaN(createdAt.getTime())
        ? "Unknown time"
        : createdAt.toISOString(),
    };
  }
</script>

<div
  class="community-projects-agent-context"
  data-ui-component="community-projects-agent-context"
  role="region"
  aria-label="Agent context"
>
  {#each checkpoints as checkpoint (checkpoint.eventId)}
    <section
      class="community-projects-agent-context__checkpoint"
      aria-label="Agent checkpoint"
    >
      <header class="community-projects-agent-context__header">
        <span>
          <CommunityRelativeTime timestamp={checkpoint.createdAt} />
        </span>
        <span class="community-projects-agent-context__status">
          <CommunityChip
            size="compact"
            tone={checkpoint.outcome === "completed"
              ? "success"
              : checkpoint.outcome === "failed"
                ? "danger"
                : "warning"}
          >
            {checkpoint.outcome}
          </CommunityChip>
          {#if !checkpoint.complete}
            <CommunityChip size="compact" tone="warning">
              Incomplete
            </CommunityChip>
          {/if}
        </span>
      </header>
      <Chat.MessageList
        density="compact"
        {...checkpoint.records.filter((record) => record.kind !== "tool").at(-1)
          ?.id
          ? {
              latestMessageId: checkpoint.records
                .filter((record) => record.kind !== "tool")
                .at(-1)!.id,
            }
          : {}}
        isEmpty={checkpoint.records.length === 0}
        aria-label="Checkpoint conversation"
      >
        {#each checkpoint.records as record (record.id)}
          {#if record.kind === "user_message" || record.kind === "assistant_message"}
            {@const author = messageAuthor(checkpoint, record)}
            <CommunityMessage
              message={messageModel(checkpoint, record)}
              {author}
              members={[author]}
              density="compact"
            />
          {:else}
            <Chat.ToolCalls
              calls={[
                {
                  id: record.id,
                  name: record.toolName ?? "tool",
                  status: toolStatus(record.toolState ?? "running"),
                },
              ]}
              defaultExpanded={false}
            />
          {/if}
        {/each}
      </Chat.MessageList>
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
