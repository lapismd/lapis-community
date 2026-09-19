<script lang="ts">
  import { untrack } from "svelte";
  import type { CommunityAgentTranscriptEntry } from "../../community/agent-contracts.js";
  import CommunityMessage from "../community-message/CommunityMessage.svelte";
  import type { CommunityMemberModel } from "../../community/workspace-model.js";
  import { memberById } from "../../community/workspace-model.js";
  import { useAgentConversation } from "../community-agent-conversation/context.svelte.js";
  import {
    eventTag,
    eventRoot,
  } from "../community-agent-conversation/model.js";
  let {
    message,
    channelId,
    requestId,
    members = [],
  }: {
    message: Extract<CommunityAgentTranscriptEntry, { type: "message" }>;
    members?: readonly CommunityMemberModel[];
    channelId?: string | undefined;
    requestId?: string | undefined;
  } = $props();
  const conversation = useAgentConversation();
  $effect(() => {
    const id = channelId;
    if (id && conversation) return untrack(() => conversation.watch(id));
  });
  const canonical = $derived(
    message.sourceEventId
      ? conversation?.message(message.sourceEventId)
      : undefined,
  );
  const request = $derived(
    requestId ? conversation?.message(requestId)?.sourceEvent : undefined,
  );
  const usable = $derived(
    canonical?.sourceEvent &&
      canonical.authorId === message.authorPubkey &&
      eventTag(canonical.sourceEvent, "h") === channelId &&
      (!requestId ||
        (request && eventRoot(request) === eventRoot(canonical.sourceEvent)))
      ? canonical
      : undefined,
  );
  const model = $derived(
    usable ?? {
      id: message.id,
      authorId: message.authorPubkey,
      content: message.text,
      timestamp: "",
      createdAt: message.createdAt,
    },
  );
  let error = $state("");
  async function react(_id: string, emoji: string) {
    try {
      await conversation?.react(usable!.sourceEvent!, emoji);
      error = "";
    } catch (cause) {
      error = String(cause);
    }
  }
</script>

<CommunityMessage
  message={model}
  avatarShape={message.role === "assistant" ? "rounded" : "circle"}
  author={memberById(
    [...members, ...(conversation?.members ?? [])],
    message.authorPubkey,
  )}
  members={conversation?.members ?? members}
  rooms={conversation?.rooms ?? []}
  {...usable && conversation?.memberId
    ? {
        currentMemberId: conversation.memberId,
        onReply: () => conversation.open(usable.sourceEvent!),
        onOpenThread: () => conversation.open(usable.sourceEvent!, false),
        onToggleReaction: react,
        onAddReaction: react,
      }
    : {}}
/>
{#if error}<p role="alert">{error}</p>{/if}
