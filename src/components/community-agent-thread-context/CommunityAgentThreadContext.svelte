<script lang="ts">
  import { untrack } from "svelte";
  import CommunityAgentCheckpointDivider from "../community-agent-checkpoint-divider/CommunityAgentCheckpointDivider.svelte";
  import { useAgentConversation } from "../community-agent-conversation/context.svelte.js";
  import { eventTag } from "../community-agent-conversation/model.js";
  import CommunityAgentTranscript from "../community-agent-activity/CommunityAgentTranscript.svelte";
  import CommunityAgentContextMessage from "../community-agent-context-message/CommunityAgentContextMessage.svelte";
  import CommunityCommitDiscussion from "../community-commit-discussion/CommunityCommitDiscussion.svelte";
  import { threadContextSegments } from "./projection.js";
  import { checkpointThreadComments } from "./projection.js";
  let {
    messageId,
    rootId,
    roomId,
  }: { messageId: string; rootId: string; roomId?: string | undefined } =
    $props();
  const conversation = useAgentConversation();
  const channel = $derived(
    conversation?.rooms.find((room) => room.id === roomId)?.groupId ?? roomId,
  );
  $effect(() => {
    const id = channel;
    if (id && conversation) return untrack(() => conversation.watch(id));
  });
  const segments = $derived(
    threadContextSegments(
      conversation?.checkpoints ?? [],
      conversation?.events ?? [],
      rootId,
      messageId,
    ),
  );
  const comments = $derived(
    messageId === rootId
      ? checkpointThreadComments(
          conversation?.checkpoints ?? [],
          conversation?.events ?? [],
          rootId,
          channel,
        )
      : [],
  );
</script>

<div style="--agent-transcript-min-height: 0">
  {#each segments as segment (segment.checkpoint.eventId)}
    {#if segment.activity.length}
      <CommunityAgentTranscript
        activity={segment.activity}
        agent={{
          pubkey: segment.agent,
          name:
            conversation?.members.find((member) => member.id === segment.agent)
              ?.name ?? "Agent",
        }}
        members={conversation?.members ?? []}
      >
        {#snippet messageContent(message)}<CommunityAgentContextMessage
            {message}
            channelId={channel}
          />{/snippet}
      </CommunityAgentTranscript>
    {/if}
    {#if segment.commitIds.length}<CommunityAgentCheckpointDivider
        commitIds={segment.commitIds}
        repositoryAddress={segment.checkpoint.repositoryAddress}
      />{/if}
  {/each}
  {#if comments.length}<CommunityCommitDiscussion {comments} inThread />{/if}
</div>
