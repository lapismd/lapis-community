import type { CommunityAgentActivityItem } from "../../community/agent-contracts.js";
import { observerScope } from "../../community/agent-activity-context.js";
import type { CommunityApplicationPanel } from "../community-application/navigation.js";
import type {
  CommunityMessageModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";

export interface AgentContextNavigationOwner {
  rooms(): readonly CommunityRoomModel[];
  messages(): readonly CommunityMessageModel[];
  selectRoom(roomId: string): void;
  openPanel(roomId: string, panel: CommunityApplicationPanel): void;
  openTopic(topicId: string): void;
  openDirectMessage(agentPubkey: string): void;
}

/** A missing ancestor still has a known ID; never substitute the span ID. */
export function contextThreadRoot(
  messages: readonly CommunityMessageModel[],
  requestId: string,
): string | undefined {
  const byId = new Map(messages.map((message) => [message.id, message]));
  if (!byId.has(requestId)) return;
  const visited = new Set<string>();
  let id = requestId;
  while (!visited.has(id)) {
    visited.add(id);
    const message = byId.get(id);
    const root = message?.sourceEvent?.tags.find(
      (tag) => tag[0] === "e" && tag[3] === "root",
    )?.[1];
    const parent = root ?? message?.parentMessageId;
    if (!parent) return id;
    id = parent;
  }
  return;
}

export function createAgentContextNavigation(
  owner: AgentContextNavigationOwner,
) {
  const room = (channelId: string) =>
    owner
      .rooms()
      .find((candidate) => (candidate.groupId ?? candidate.id) === channelId);
  const threadRoot = (requestId: string) =>
    contextThreadRoot(owner.messages(), requestId);
  function openThread(channelId: string, requestId: string, rootId?: string) {
    const channel = room(channelId);
    if (!channel) return;
    const rootMessageId = rootId ?? threadRoot(requestId) ?? requestId;
    if (channel.kind === "forum") {
      owner.selectRoom(channel.id);
      owner.openTopic(rootMessageId);
    } else
      owner.openPanel(channel.id, {
        kind: "thread",
        roomId: channel.id,
        rootMessageId,
      });
  }
  return {
    room,
    threadRoot,
    openChannel(channelId: string) {
      const channel = room(channelId);
      if (channel) owner.selectRoom(channel.id);
    },
    openThread,
    openActivityRequest(item: CommunityAgentActivityItem) {
      const scope = observerScope(item.frame);
      const trigger = (item.frame.payload as Record<string, unknown>)
        .triggerEventId;
      if (scope.conversationKind === "dm")
        owner.openDirectMessage(item.agentPubkey);
      else if (scope.channelId && typeof trigger === "string")
        openThread(scope.channelId, trigger, scope.threadRootId);
    },
  };
}

export type AgentContextNavigation = ReturnType<
  typeof createAgentContextNavigation
>;
