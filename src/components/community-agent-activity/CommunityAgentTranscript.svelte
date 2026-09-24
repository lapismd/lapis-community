<script lang="ts">
  import { transcriptRecordStates } from "./transcript-execution.js";
  import { useAgentConversation } from "../community-agent-conversation/context.svelte.js";
  import type { CommunityAgentTranscriptProps } from "./transcript-props.js";
  import * as Chat from "@lapismd/design-core/ai/chat";
  import { Reasoning } from "@lapismd/design-core/ai/experimental";
  import CommunityMarkdownContent from "../community-markdown-content/CommunityMarkdownContent.svelte";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import CommunityAgentTranscriptMessage from "./CommunityAgentTranscriptMessage.svelte";
  import CommunityAgentTranscriptPlan from "./CommunityAgentTranscriptPlan.svelte";
  import {
    sourceActivity,
    transcriptCommentSources,
  } from "../community-agent-conversation/transcript-comment-sources.js";
  import CommunityAgentTranscriptTools from "./CommunityAgentTranscriptTools.svelte";
  import CommunityAgentTranscriptThinking from "./CommunityAgentTranscriptThinking.svelte";
  import CommunityAgentTranscriptPermission from "./CommunityAgentTranscriptPermission.svelte";
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

  const conversation = useAgentConversation();
  const focus = $derived(conversation?.replies.focus);
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
        <CommunityAgentTranscriptMessage
          message={entry.item}
          agentPubkey={agent.pubkey}
          members={markdownMembers}
          source={commentSources.find(
            (source) => source.displayId === entry.item.id,
          )}
          request={sourceActivity(activity, entry.item.sourceEventId)}
          {onOpenRequest}
          {messageContent}
        />
      {:else if entry.kind === "thinking"}
        <CommunityAgentTranscriptThinking
          item={entry.item}
          source={commentSources.find(
            (source) => source.displayId === entry.item.id,
          )}
          focused={focus?.anchor.recordId === entry.item.id}
          isStreaming={streaming}
        />
      {:else if entry.kind === "tools"}
        <CommunityAgentTranscriptTools
          items={entry.items}
          {commentSources}
          {focus}
          isStreaming={streaming}
        />
      {:else if entry.kind === "plan"}
        <CommunityAgentTranscriptPlan
          item={entry.item}
          source={commentSources.find(
            (source) => source.displayId === entry.item.id,
          )}
        />
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
          <CommunityAgentTranscriptPermission item={entry.item} />
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
