<script lang="ts">
  import { transcriptRecordStates } from "./transcript-execution.js";
  import type { CommunityAgentTranscriptProps } from "./transcript-props.js";
  import * as Chat from "@lapismd/design-core/ai/chat";
  import { Reasoning } from "@lapismd/design-core/ai/experimental";
  import { transcriptToolProps } from "./transcript-tool-props.js";
  import CommunityMarkdownContent from "../community-markdown-content/CommunityMarkdownContent.svelte";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import CommunityRelativeTime from "../community-relative-time/CommunityRelativeTime.svelte";
  import TranscriptToolDetail from "./TranscriptToolDetail.svelte";
  import CommunityAgentTranscriptPlan from "./CommunityAgentTranscriptPlan.svelte";
  import {
    sourceActivity,
    transcriptCommentSources,
  } from "../community-agent-conversation/transcript-comment-sources.js";
  import CommunityTranscriptComments from "../community-transcript-comments/CommunityTranscriptComments.svelte";
  import {
    agentTranscriptTimeline,
    pendingTranscriptStatuses,
  } from "./model.js";
  import {
    transcriptAuthor,
    transcriptOlderPage,
  } from "./transcript-identity.js";
  import { transcriptMarkdownMembers } from "./transcript-markdown-members.js";

  let {
    activity,
    execution,
    agent,
    context,
    members = [],
    onOpenRequest,
    header,
    working = false,
    messageContent,
    onLoadOlder,
    hasOlder = false,
    loading = false,
  }: CommunityAgentTranscriptProps = $props();

  const timeline = $derived(
    agentTranscriptTimeline(activity, agent.pubkey, context),
  );
  const pending = $derived(
    pendingTranscriptStatuses(
      activity,
      agent.pubkey,
      context,
      Date.now(),
      execution,
    ),
  );
  const states = $derived(
    transcriptRecordStates(activity, agent.pubkey, execution, context),
  );
  const streaming = (id: string) =>
    !states.has(id) || states.get(id) === "running";
  const markdownMembers = $derived(transcriptMarkdownMembers(members, [agent]));
  const latestMessageId = $derived(
    [...timeline].reverse().find((entry) => entry.kind === "message")?.item.id,
  );

  const commentSources = $derived(
    transcriptCommentSources(activity, agent.pubkey, context),
  );
</script>

{#snippet toolDetail(call: {
  data?: unknown;
  name?: string;
})}<TranscriptToolDetail {call} />{/snippet}

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
    {...transcriptOlderPage(onLoadOlder, hasOlder, loading)}
    isStreaming={working ||
      pending.some((status) => status.streaming) ||
      timeline.some(
        (entry) =>
          entry.kind === "thinking" &&
          entry.item.state === "streaming" &&
          streaming(entry.item.id),
      )}
    isEmpty={timeline.length === 0 && pending.length === 0 && !working}
    {emptyState}
    aria-label="Agent conversation activity"
  >
    {#each timeline as entry (entry.kind === "tools" ? entry.id : entry.item.id)}
      {#if entry.kind === "message"}
        {@const message = entry.item}
        {@const author = transcriptAuthor(
          message.authorPubkey,
          markdownMembers,
        )}
        {@const source = sourceActivity(activity, message.sourceEventId)}
        {#if messageContent}
          {@render messageContent(message)}
        {:else}
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
              <CommunityMarkdownContent
                content={message.text}
                members={markdownMembers}
              />
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
                    <button
                      type="button"
                      onclick={() => onOpenRequest?.(source)}
                    >
                      View request
                    </button>
                  {/snippet}
                {/if}
              </Chat.MessageMetadata>
            {/snippet}
          </Chat.Message>
        {/if}
      {:else if entry.kind === "thinking"}
        <Reasoning
          streaming={entry.item.state === "streaming" &&
            streaming(entry.item.id)}
          preview={entry.item.text}
          expanded={entry.item.state === "streaming" &&
            streaming(entry.item.id)}
        >
          {entry.item.text}
        </Reasoning>
      {:else if entry.kind === "tools"}
        <Chat.ToolCalls
          calls={entry.items.map((item) =>
            transcriptToolProps(item, toolDetail, !streaming(item.id)),
          )}
          defaultExpanded={false}
        />
      {:else if entry.kind === "plan"}
        <CommunityAgentTranscriptPlan item={entry.item} />
      {:else if entry.kind === "context"}
        <Reasoning label={entry.item.label} streaming={false} expanded={false}>
          <CommunityMarkdownContent
            content={entry.item.text}
            fullWidth
            members={markdownMembers}
          />
        </Reasoning>
      {:else if entry.kind === "permission"}
        {#if entry.item.state === "resolved"}
          <Chat.SystemMessage>
            Permission {entry.item.decision ?? "resolved"} for {entry.item.tool}
          </Chat.SystemMessage>
        {/if}
      {:else if entry.kind === "usage"}
        <Chat.SystemMessage>
          Usage {entry.item.used}{entry.item.limit !== undefined
            ? ` / ${entry.item.limit}`
            : ""}
        </Chat.SystemMessage>
      {:else if entry.kind === "turn" && entry.item.state === "failed"}
        <Chat.Message sender="assistant">
          {#snippet avatar()}
            <CommunityMemberAvatar
              member={transcriptAuthor(agent.pubkey, markdownMembers)}
              size="small"
              shape="rounded"
              decorative
            />
          {/snippet}
          {#snippet name()}<span>{agent.name}</span>{/snippet}
          <Chat.MessageBubble>
            {entry.item.message ?? "The agent turn failed."}
          </Chat.MessageBubble>
        </Chat.Message>
      {:else if entry.kind === "turn" && entry.item.state === "cancelled"}
        <Chat.SystemMessage>Agent turn cancelled</Chat.SystemMessage>
      {/if}
      {#each commentSources.filter( (source) => (entry.kind === "tools" ? entry.items.some((item) => item.id === source.displayId) : source.displayId === entry.item.id), ) as source (source.key)}
        <CommunityTranscriptComments {source} />
      {/each}
    {/each}
    {#if working || pending.length > 0}
      <Reasoning
        label={pending.length
          ? [...new Set(pending.map((status) => status.text))].join(" · ")
          : "Working"}
        streaming={pending.length > 0
          ? pending.some((status) => status.streaming)
          : working}
      />
    {/if}
  </Chat.MessageList>
</div>

<style>
  .agent-transcript {
    min-width: 0;
    min-height: var(--agent-transcript-min-height, 16rem);
  }

  .agent-transcript :global([data-ui-component="ai-chat-message-list"]) {
    min-height: var(--agent-transcript-min-height, 16rem);
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
