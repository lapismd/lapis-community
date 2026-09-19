<script lang="ts">
  import type { Snippet } from "svelte";
  import * as Chat from "@lapismd/design-core/ai/chat";
  import { Reasoning } from "@lapismd/design-core/ai/experimental";
  import {
    isOneLineToolAlert,
    presentToolPayload,
    toolCallTarget,
  } from "@lapismd/design-core/ai/chat";
  import CommunityMarkdownContent from "../community-markdown-content/CommunityMarkdownContent.svelte";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import CommunityRelativeTime from "../community-relative-time/CommunityRelativeTime.svelte";
  import type {
    CommunityAgentActivityContext,
    CommunityAgentActivityItem,
    CommunityAgentIdentity,
    CommunityAgentTranscriptEntry,
  } from "../../community/agent-contracts.js";
  import type { CommunityMemberModel } from "../community-workspace/model.js";
  import {
    agentTranscriptTimeline,
    pendingTranscriptStatuses,
    toolCallStatus,
  } from "./model.js";

  let {
    activity,
    agent,
    context,
    members = [],
    onOpenRequest,
    header,
    working = false,
  }: {
    header?: Snippet;
    working?: boolean;
    activity: readonly CommunityAgentActivityItem[];
    agent: Pick<CommunityAgentIdentity, "pubkey" | "name" | "avatarUrl">;
    context?: CommunityAgentActivityContext;
    members?: readonly CommunityMemberModel[];
    onOpenRequest?: (item: CommunityAgentActivityItem) => void;
  } = $props();

  const timeline = $derived(
    agentTranscriptTimeline(activity, agent.pubkey, context),
  );
  const pending = $derived(
    pendingTranscriptStatuses(activity, agent.pubkey, context),
  );
  const latestMessageId = $derived(
    [...timeline].reverse().find((entry) => entry.kind === "message")?.item.id,
  );

  function identity(pubkey: string): CommunityMemberModel {
    const member = members.find((candidate) => candidate.id === pubkey);
    if (member) return member;
    if (pubkey === agent.pubkey)
      return {
        id: agent.pubkey,
        name: agent.name,
        handle: agent.pubkey,
        initials: agent.name.slice(0, 2).toUpperCase(),
        ...(agent.avatarUrl ? { avatarUrl: agent.avatarUrl } : {}),
      };
    return {
      id: pubkey,
      name: "You",
      handle: pubkey,
      initials: "YO",
    };
  }

  function sourceActivity(sourceEventId?: string) {
    if (!sourceEventId) return;
    return activity.find((item) => {
      const payload = object(item.frame.payload);
      const entry = object(payload.entry);
      return entry.sourceEventId === sourceEventId;
    });
  }

  function toolProps(
    item: Extract<CommunityAgentTranscriptEntry, { type: "tool" }>,
  ) {
    const error = item.error ? presentToolPayload(item.error) : undefined;
    const target = toolCallTarget(item.input);
    return {
      id: item.toolId,
      name: item.name,
      status: toolCallStatus(item.state),
      ...(target ? { target } : {}),
      ...(error && isOneLineToolAlert(error)
        ? { errorMessage: error.code }
        : {}),
      data: item,
      ...(item.input || item.output || (error && !isOneLineToolAlert(error))
        ? { detail: toolDetail }
        : {}),
    };
  }

  function object(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }
</script>

{#snippet toolDetail(call: { data?: unknown; name?: string })}
  {@const detail = call.data as
    | Extract<CommunityAgentTranscriptEntry, { type: "tool" }>
    | undefined}
  <Chat.ToolCallDetail
    {...detail?.input === undefined ? {} : { input: detail.input }}
    {...detail?.output === undefined ? {} : { output: detail.output }}
    {...detail?.error === undefined ? {} : { error: detail.error }}
    {...(detail?.name ?? call.name)
      ? { toolName: detail?.name ?? call.name }
      : {}}
  />
{/snippet}

{#snippet emptyState()}
  <p class="agent-transcript__empty">
    Waiting for transcript activity from this agent.
  </p>
{/snippet}

<div class="agent-transcript" data-ui-component="community-agent-transcript">
  <Chat.MessageList
    density="compact"
    {...header ? { header } : {}}
    {...latestMessageId ? { latestMessageId } : {}}
    isStreaming={working ||
      pending.length > 0 ||
      timeline.some(
        (entry) =>
          entry.kind === "thinking" && entry.item.state === "streaming",
      )}
    isEmpty={timeline.length === 0 && pending.length === 0 && !working}
    {emptyState}
    aria-label="Agent conversation activity"
  >
    {#each timeline as entry (entry.kind === "tools" ? entry.id : entry.item.id)}
      {#if entry.kind === "message"}
        {@const message = entry.item}
        {@const author = identity(message.authorPubkey)}
        {@const source = sourceActivity(message.sourceEventId)}
        <Chat.Message
          sender={message.role === "user" ? "user" : "assistant"}
          aria-label={`Message from ${author.name}`}
        >
          {#snippet avatar()}
            <CommunityMemberAvatar
              member={author}
              size="small"
              shape={author.id === agent.pubkey ? "rounded" : "circle"}
              decorative
            />
          {/snippet}
          {#snippet name()}<span>{author.name}</span>{/snippet}
          <Chat.MessageBubble>
            <CommunityMarkdownContent content={message.text} />
          </Chat.MessageBubble>
          {#snippet metadata()}
            <Chat.MessageMetadata>
              {#snippet timestamp()}
                <CommunityRelativeTime
                  timestamp={Date.parse(message.createdAt) / 1_000}
                />
              {/snippet}
              {#if source && onOpenRequest}
                {#snippet footer()}
                  <button type="button" onclick={() => onOpenRequest?.(source)}>
                    View request
                  </button>
                {/snippet}
              {/if}
            </Chat.MessageMetadata>
          {/snippet}
        </Chat.Message>
      {:else if entry.kind === "thinking"}
        <Reasoning
          streaming={entry.item.state === "streaming"}
          preview={entry.item.text}
          expanded={entry.item.state === "streaming"}
        >
          {entry.item.text}
        </Reasoning>
      {:else if entry.kind === "tools"}
        <Chat.ToolCalls
          calls={entry.items.map(toolProps)}
          defaultExpanded={false}
        />
      {:else if entry.kind === "permission"}
        {#if entry.item.state === "resolved"}
          <Chat.SystemMessage>
            Permission {entry.item.decision ?? "resolved"} for {entry.item.tool}
          </Chat.SystemMessage>
        {/if}
      {:else if entry.kind === "turn" && entry.item.state === "failed"}
        <Chat.Message sender="assistant">
          {#snippet avatar()}
            <CommunityMemberAvatar
              member={identity(agent.pubkey)}
              size="small"
              shape="rounded"
              decorative
            />
          {/snippet}
          {#snippet name()}<span>{agent.name}</span>{/snippet}
          <Chat.MessageBubble>
            {entry.item.message ?? "The agent turn failed."}
          </Chat.MessageBubble>
          {#snippet metadata()}
            <Chat.MessageMetadata status="error" />
          {/snippet}
        </Chat.Message>
      {:else if entry.kind === "turn" && entry.item.state === "cancelled"}
        <Chat.SystemMessage>Agent turn cancelled</Chat.SystemMessage>
      {/if}
    {/each}
    {#if working || pending.length > 0}
      <Reasoning
        label={pending.length === 1 ? pending[0]!.text : "Working"}
        streaming
      />
    {/if}
  </Chat.MessageList>
</div>

<style>
  .agent-transcript {
    min-width: 0;
    min-height: 16rem;
  }

  .agent-transcript :global([data-ui-component="ai-chat-message-list"]) {
    min-height: 16rem;
  }

  .agent-transcript
    :global([data-ui-component="ai-chat-message-metadata"] button) {
    appearance: none;
    border: 0;
    padding: 0;
    color: var(--muted-foreground);
    background: transparent;
    cursor: pointer;
    font: inherit;
    text-decoration: underline;
    text-underline-offset: 0.18em;
  }

  .agent-transcript__empty {
    margin: 0;
    color: var(--muted-foreground);
    text-align: center;
  }
</style>
