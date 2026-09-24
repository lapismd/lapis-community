<script lang="ts">
  import { watchAgentConversationChannel } from "../community-agent-conversation/watch-agent-channel.svelte.js";
  import CommunityAgentCheckpointDivider from "../community-agent-checkpoint-divider/CommunityAgentCheckpointDivider.svelte";
  import { useAgentConversation } from "../community-agent-conversation/context.svelte.js";
  import { useAgentComposerActivity } from "../community-agent-composer-activity/context.js";
  import { eventTag } from "../community-agent-conversation/model.js";
  import CommunityAgentTranscript from "../community-agent-activity/CommunityAgentTranscript.svelte";
  import CommunityAgentContextMessage from "../community-agent-context-message/CommunityAgentContextMessage.svelte";
  import CommunityCommitDiscussion from "../community-commit-discussion/CommunityCommitDiscussion.svelte";
  import type {
    CommunityAgentActivityContext,
    CommunityAgentActivityItem,
    CommunityAgentIdentity,
  } from "../../community/agent-contracts.js";
  import {
    checkpointThreadComments,
    ownerThreadActivity,
    threadContextSegments,
  } from "./projection.js";
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
  const threadContext = $derived(
    activityContext ??
      (channel
        ? ({
            kind: "thread",
            channelId: channel,
            threadRootId: rootId,
          } satisfies CommunityAgentActivityContext)
        : undefined),
  );
  const ownerModel = $derived(activityOwner?.model());
  const ownerActivity = $derived(
    segments.length
      ? []
      : ownerThreadActivity(
          activity ?? ownerModel?.activity ?? [],
          threadContext,
          messageId,
          conversation?.events ?? [],
        ),
  );
  const ownerAgents = $derived(
    [...new Set(ownerActivity.map((item) => item.agentPubkey))].map(
      (pubkey) => ({
        agent:
          (agents ?? ownerModel?.agents ?? []).find(
            (candidate) => candidate.pubkey === pubkey,
          ) ??
          ({
            pubkey,
            name:
              conversation?.members.find((member) => member.id === pubkey)
                ?.name ?? "Agent",
          } satisfies Pick<CommunityAgentIdentity, "pubkey" | "name">),
        activity: ownerActivity.filter((item) => item.agentPubkey === pubkey),
      }),
    ),
  );
</script>

<div style="--agent-transcript-min-height: 0">
  {#each ownerAgents as owner (owner.agent.pubkey)}
    <CommunityAgentTranscript
      {...ownerModel ? { execution: ownerModel } : {}}
      activity={owner.activity}
      agent={owner.agent}
      {...threadContext ? { context: threadContext } : {}}
      members={conversation?.members ?? []}
    />
  {/each}
  {#each segments as segment (segment.checkpoint.eventId)}
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
  {#if comments.length}<CommunityCommitDiscussion {comments} inThread />{/if}
</div>
