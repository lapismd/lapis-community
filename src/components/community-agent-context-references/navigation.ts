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
  loadMessage?(id: string): Promise<CommunityMessageModel | undefined>;
  selectRoom(roomId: string): void;
  openPanel(roomId: string, panel: CommunityApplicationPanel): void;
  openTopic(topicId: string): void;
  openDirectMessage(agentPubkey: string): void;
}

import { contextThreadRoot } from "./thread-root.js";
export { contextThreadRoot } from "./thread-root.js";

export function createAgentContextNavigation(
  owner: AgentContextNavigationOwner,
) {
  const room = (channelId: string) =>
    owner
      .rooms()
      .find((candidate) => (candidate.groupId ?? candidate.id) === channelId);
  const threadRoot = (requestId: string) =>
    contextThreadRoot(owner.messages(), requestId);
  async function openThread(
    channelId: string,
    requestId: string,
    rootId?: string,
  ) {
    const channel = room(channelId);
    if (!channel) return;
    let root = rootId ?? threadRoot(requestId);
    if (!root && owner.loadMessage) {
      const message = await owner.loadMessage(requestId);
      if (message)
        root = contextThreadRoot([message, ...owner.messages()], requestId);
    }
    const rootMessageId = root ?? requestId;
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
