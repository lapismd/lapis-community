import type {
  CommunityAgentActivityContext,
  CommunityAgentActivityItem,
} from "../../community/agent-contracts.js";
import type { NostrEvent } from "../../protocol/index.js";
import type { RepositoryAgentCheckpoint } from "../../projects/repository-agent-context.js";
import {
  checkpointThreadComments,
  ownerThreadActivity,
  threadContextSegments,
} from "./projection.js";

export interface AgentThreadContextProjection {
  comments: NostrEvent[];
  context: CommunityAgentActivityContext | undefined;
  owners: {
    agentPubkey: string;
    activity: CommunityAgentActivityItem[];
  }[];
  segments: ReturnType<typeof threadContextSegments>;
}

export function projectAgentThreadContext(input: {
  activity: readonly CommunityAgentActivityItem[];
  activityContext?: CommunityAgentActivityContext | undefined;
  channel?: string | undefined;
  checkpoints: readonly RepositoryAgentCheckpoint[];
  events: readonly NostrEvent[];
  messageId: string;
  rootId: string;
}): AgentThreadContextProjection {
  const segments = threadContextSegments(
    input.checkpoints,
    input.events,
    input.rootId,
    input.messageId,
  );
  const context =
    input.activityContext ??
    (input.channel
      ? ({
          kind: "thread",
          channelId: input.channel,
          threadRootId: input.rootId,
        } satisfies CommunityAgentActivityContext)
      : undefined);
  const activity = segments.length
    ? []
    : ownerThreadActivity(
        input.activity,
        context,
        input.messageId,
        input.events,
      );
  const owners = [...new Set(activity.map((item) => item.agentPubkey))].map(
    (agentPubkey) => ({
      agentPubkey,
      activity: activity.filter((item) => item.agentPubkey === agentPubkey),
    }),
  );
  return {
    comments:
      input.messageId === input.rootId
        ? checkpointThreadComments(
            input.checkpoints,
            input.events,
            input.rootId,
            input.channel,
          )
        : [],
    context,
    owners,
    segments,
  };
}
