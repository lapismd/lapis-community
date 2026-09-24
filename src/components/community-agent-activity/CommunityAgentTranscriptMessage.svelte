<script lang="ts">
  import type { Snippet } from "svelte";
  import * as Chat from "@lapismd/design-core/ai/chat";
  import type {
    CommunityAgentTranscriptEntry,
    CommunityAgentActivityItem,
  } from "../../community/agent-contracts.js";
  import type { CommunityMemberModel } from "../../community/workspace-model.js";
  import CommunityMarkdownContent from "../community-markdown-content/CommunityMarkdownContent.svelte";
  import CommunityMemberAvatar from "../community-member-avatar/CommunityMemberAvatar.svelte";
  import CommunityRelativeTime from "../community-relative-time/CommunityRelativeTime.svelte";
  import CommunityTranscriptComments from "../community-transcript-comments/CommunityTranscriptComments.svelte";
  import CommunityAgentContextMessage from "../community-agent-context-message/CommunityAgentContextMessage.svelte";
  import type { TranscriptCommentSource } from "../community-agent-conversation/transcript-comment-sources.js";
  import { useAgentConversation } from "../community-agent-conversation/context.svelte.js";
  import {
    eventTag,
    eventRoot,
  } from "../community-agent-conversation/model.js";
  import { durableDraftTarget } from "../community-agent-conversation/transcript-comment-draft.js";
  import { transcriptAuthor } from "./transcript-identity.js";
  type Message = Extract<CommunityAgentTranscriptEntry, { type: "message" }>;
  let {
    message,
    agentPubkey,
    members,
    source,
    request,
    onOpenRequest,
    messageContent,
  }: {
    message: Message;
    agentPubkey: string;
    members: readonly CommunityMemberModel[];
    source?: TranscriptCommentSource | undefined;
    request?: CommunityAgentActivityItem | undefined;
    onOpenRequest?: ((item: CommunityAgentActivityItem) => void) | undefined;
    messageContent?: Snippet<[Message]> | undefined;
  } = $props();
  const conversation = useAgentConversation();
  const author = $derived(transcriptAuthor(message.authorPubkey, members));
  const durable = $derived(
    source && conversation
      ? durableDraftTarget(conversation.reviewIndex, { source, content: "" })
      : undefined,
  );
  const signed = $derived(
    conversation?.events.find(
      (event) =>
        event.pubkey === message.authorPubkey &&
        [9, 11, 1111].includes(event.kind) &&
        (event.id === message.sourceEventId ||
          (source && eventTag(event, "d") === source.record.id)) &&
        (!source?.channelId || eventTag(event, "h") === source.channelId) &&
        (!(durable?.rootId ?? source?.threadRootId) ||
          eventRoot(event) === (durable?.rootId ?? source?.threadRootId)),
    ),
  );
</script>

{#if signed}
  <CommunityAgentContextMessage
    message={{ ...message, sourceEventId: signed.id }}
    {members}
    channelId={eventTag(signed, "h")}
  />
{:else}
  <CommunityTranscriptComments
    {source}
    label="Assistant message"
    text={message.text}
  >
    {#if messageContent}{@render messageContent(message)}{:else}
      <Chat.Message
        sender={message.role === "user" ? "user" : "assistant"}
        aria-label={`Message from ${author.name}`}
      >
        {#snippet avatar()}<CommunityMemberAvatar
            member={author}
            size="small"
            shape={author.id === agentPubkey ? "rounded" : "circle"}
            decorative
          />{/snippet}
        {#snippet name()}<span>{author.name}</span>{/snippet}
        <Chat.MessageBubble
          ><CommunityMarkdownContent
            content={message.text}
            {members}
          /></Chat.MessageBubble
        >
        {#snippet metadata()}<Chat.MessageMetadata>
            {#snippet timestamp()}<CommunityRelativeTime
                timestamp={Date.parse(message.createdAt) / 1000}
              />{/snippet}
            {#if request && onOpenRequest}{#snippet footer()}<button
                  type="button"
                  onclick={() => onOpenRequest?.(request)}>View request</button
                >{/snippet}{/if}
          </Chat.MessageMetadata>{/snippet}
      </Chat.Message>
    {/if}
  </CommunityTranscriptComments>
{/if}
