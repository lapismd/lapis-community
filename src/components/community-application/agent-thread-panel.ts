import type { CommunityApplicationPanel } from "./navigation.js";
/** Open a native message reply without replacing the active project surface. */
export function agentThreadPanel(
  roomId: string,
  rootMessageId: string,
  replyTargetId?: string,
): CommunityApplicationPanel {
  return {
    kind: "thread",
    roomId,
    rootMessageId,
    ...(replyTargetId ? { replyTargetId } : {}),
  };
}
