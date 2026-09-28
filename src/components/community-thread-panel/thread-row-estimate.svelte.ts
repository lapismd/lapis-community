import type {
  CommunityMessageModel,
  CommunityRoomModel,
} from "../community-workspace/model.js";
import { useAgentComposerActivity } from "../community-agent-composer-activity/context.js";
import { useAgentConversation } from "../community-agent-conversation/context.svelte.js";
import { estimateAgentThreadContextHeight } from "../community-agent-thread-context/height-estimate.js";
import { projectAgentThreadContext } from "../community-agent-thread-context/context-projection.js";
import { estimateCommunityMessageRow } from "../community-conversation/message-row-estimate.js";

export function createThreadRowEstimate(owner: {
  messages(): readonly CommunityMessageModel[];
  rooms(): readonly CommunityRoomModel[];
  rootId(): string;
  isContinuation(message: CommunityMessageModel, index: number): boolean;
}) {
  const conversation = useAgentConversation();
  const activityOwner = useAgentComposerActivity();
  const estimate = $derived.by(() => {
    const messages = owner.messages();
    const rooms = owner.rooms();
    const rootId = owner.rootId();
    const checkpoints = conversation?.checkpoints ?? [];
    const events = conversation?.events ?? [];
    const conversationRooms = conversation?.rooms ?? [];
    const activity = activityOwner?.model()?.activity ?? [];
    return (message: CommunityMessageModel, index: number): number => {
      const roomId = messageRoomId(message, rooms);
      const channel =
        conversationRooms.find((room) => room.id === roomId)?.groupId ?? roomId;
      const projection = projectAgentThreadContext({
        activity,
        ...(channel ? { channel } : {}),
        checkpoints,
        events,
        rootId,
        messageId: message.id,
      });
      return estimateCommunityMessageRow(message, {
        density: "compact",
        continuation: owner.isContinuation(message, index),
        supplementHeight: estimateAgentThreadContextHeight(projection),
      });
    };
  });

  return {
    get estimate() {
      return estimate;
    },
    roomId(message: CommunityMessageModel) {
      return messageRoomId(message, owner.rooms());
    },
  };
}

function messageRoomId(
  message: CommunityMessageModel,
  rooms: readonly CommunityRoomModel[],
): string | undefined {
  const channel = message.sourceEvent?.tags.find(([key]) => key === "h")?.[1];
  return rooms.find((room) => (room.groupId ?? room.id) === channel)?.id;
}
