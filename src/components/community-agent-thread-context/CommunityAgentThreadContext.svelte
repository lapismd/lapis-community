<script lang="ts">
  import { watchAgentConversationChannel } from "../community-agent-conversation/watch-agent-channel.svelte.js";
  import CommunityAgentCheckpointDivider from "../community-agent-checkpoint-divider/CommunityAgentCheckpointDivider.svelte";
  import { useAgentConversation } from "../community-agent-conversation/context.svelte.js";
  import { useAgentComposerActivity } from "../community-agent-composer-activity/context.js";
  import CommunityAgentTranscript from "../community-agent-activity/CommunityAgentTranscript.svelte";
  import CommunityAgentContextMessage from "../community-agent-context-message/CommunityAgentContextMessage.svelte";
  import CommunityCommitDiscussion from "../community-commit-discussion/CommunityCommitDiscussion.svelte";
  import type {
    CommunityAgentActivityContext,
    CommunityAgentActivityItem,
    CommunityAgentIdentity,
  } from "../../community/agent-contracts.js";
  import { projectAgentThreadContext } from "./context-projection.js";
  let {
    messageId,
    rootId,
    roomId,
    activity,
    activityContext,
    agents,
  }: {
    messageId: string;
    rootId: string;
    roomId?: string | undefined;
    activity?: readonly CommunityAgentActivityItem[];
    activityContext?: CommunityAgentActivityContext;
    agents?: readonly CommunityAgentIdentity[];
  } = $props();
  const conversation = useAgentConversation();
  const activityOwner = useAgentComposerActivity();
  const channel = $derived(
    conversation?.rooms.find((room) => room.id === roomId)?.groupId ?? roomId,
  );
  watchAgentConversationChannel(() => channel, conversation);
  const ownerModel = $derived(activityOwner?.model());
  const projection = $derived(
    projectAgentThreadContext({
      activity: activity ?? ownerModel?.activity ?? [],
      ...(activityContext ? { activityContext } : {}),
      ...(channel ? { channel } : {}),
      checkpoints: conversation?.checkpoints ?? [],
      events: conversation?.events ?? [],
      rootId,
      messageId,
    }),
  );
  const ownerAgents = $derived(
    projection.owners.map(({ agentPubkey, activity }) => ({
      agent:
        (agents ?? ownerModel?.agents ?? []).find(
          (candidate) => candidate.pubkey === agentPubkey,
        ) ??
        ({
          pubkey: agentPubkey,
          name:
            conversation?.members.find((member) => member.id === agentPubkey)
              ?.name ?? "Agent",
        } satisfies Pick<CommunityAgentIdentity, "pubkey" | "name">),
      activity,
    })),
  );
</script>

<div style="--agent-transcript-min-height: 0">
  {#each ownerAgents as owner (owner.agent.pubkey)}
    <CommunityAgentTranscript
      {...ownerModel ? { execution: ownerModel } : {}}
      activity={owner.activity}
      agent={owner.agent}
      {...projection.context ? { context: projection.context } : {}}
      members={conversation?.members ?? []}
    />
  {/each}
  {#each projection.segments as segment (segment.checkpoint.eventId)}
    {#if segment.activity.length}
      <CommunityAgentTranscript
        {...ownerModel ? { execution: ownerModel } : {}}
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
  {#if projection.comments.length}<CommunityCommitDiscussion
      comments={projection.comments}
      inThread
    />{/if}
</div>
