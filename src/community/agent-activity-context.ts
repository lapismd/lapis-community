import type {
  CommunityAgentActivityContext,
  CommunityAgentControllerScope,
  CommunityAgentObserver,
} from "./agent-contracts.js";

export const controllerScopeId = (agent: string, scope: string): string =>
  JSON.stringify([agent, scope]);
export function observerScope(
  frame: CommunityAgentObserver,
): Partial<CommunityAgentControllerScope> {
  const payload =
    frame.payload && typeof frame.payload === "object"
      ? (frame.payload as Record<string, unknown>)
      : {};
  const scopeKey = typeof payload.scopeKey === "string" ? payload.scopeKey : "";
  const threadRootId =
    typeof payload.threadRootId === "string"
      ? payload.threadRootId
      : scopeKey.split("/thread/")[1];
  return {
    scopeKey,
    ...(frame.channelId ? { channelId: frame.channelId } : {}),
    ...(threadRootId ? { threadRootId } : {}),
    conversationKind:
      payload.conversationKind === "forum-topic"
        ? "forum-topic"
        : threadRootId
          ? "thread"
          : scopeKey.includes("/dm/")
            ? "dm"
            : "channel",
  };
}
export function activityMatches(
  context: CommunityAgentActivityContext | undefined,
  scope: Partial<CommunityAgentControllerScope>,
): boolean {
  if (!context || context.kind === "overview") return true;
  if (context.kind === "dm")
    return (
      scope.conversationKind === "dm" &&
      (!context.agentPubkey || scope.agentPubkey === context.agentPubkey)
    );
  if (scope.channelId !== context.channelId) return false;
  return (
    context.kind === "channel" || scope.threadRootId === context.threadRootId
  );
}
export function contextForScope(
  scope: CommunityAgentControllerScope,
): CommunityAgentActivityContext {
  if (scope.conversationKind === "dm")
    return { kind: "dm", agentPubkey: scope.agentPubkey };
  if (!scope.channelId) return { kind: "overview" };
  return scope.threadRootId
    ? {
        kind:
          scope.conversationKind === "forum-topic" ? "forum-topic" : "thread",
        channelId: scope.channelId,
        threadRootId: scope.threadRootId,
      }
    : { kind: "channel", channelId: scope.channelId };
}
export function activityContextLabel(
  context: CommunityAgentActivityContext | undefined,
  rooms: readonly { id: string; groupId?: string; name: string }[] = [],
): string {
  if (!context || context.kind === "overview") return "All conversations";
  if (context.kind === "dm") return "Direct message";
  const room = rooms.find(
    (room) => (room.groupId ?? room.id) === context.channelId,
  );
  const name = room ? `#${room.name}` : "Channel";
  return context.kind === "channel"
    ? name
    : `${name} · ${context.kind === "forum-topic" ? "Topic" : "Thread"}`;
}
