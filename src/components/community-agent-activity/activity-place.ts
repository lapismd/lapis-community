import {
  activityContextLabel,
  contextForScope,
} from "../../community/agent-activity-context.js";
import type { CommunityAgentControllerScope } from "../../community/agent-contracts.js";

const eventId = /^[a-f0-9]{64}$/u;

export type ActivityPlaceRoom = {
  id: string;
  groupId?: string;
  name: string;
  kind: "channel" | "forum" | "direct";
};

export function activityPlace(
  scope: CommunityAgentControllerScope,
  rooms: readonly ActivityPlaceRoom[],
): { label: string; href?: string } {
  const context = contextForScope(scope);
  const label = activityContextLabel(context, rooms);
  if (
    context.kind !== "channel" &&
    context.kind !== "thread" &&
    context.kind !== "forum-topic"
  ) {
    return { label };
  }
  const room = rooms.find(
    (item) => (item.groupId ?? item.id) === context.channelId,
  );
  if (!room || room.kind === "direct") return { label };
  const prefix = room.kind === "forum" ? "forums" : "channels";
  const path = `#/${prefix}/${encodeURIComponent(room.id)}`;
  if (context.kind === "channel" || !eventId.test(context.threadRootId)) {
    return { label, href: path };
  }
  return { label, href: `${path}/${context.threadRootId}` };
}
