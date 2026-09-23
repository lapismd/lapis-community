import {
  activityContextLabel,
  contextForScope,
} from "../../community/agent-activity-context.js";
import type {
  CommunityAgentActivityContext,
  CommunityAgentControllerScope,
} from "../../community/agent-contracts.js";

export function activityRunLabel(state?: string): string {
  switch (state) {
    case "queued":
      return "Queued";
    case "starting":
      return "Starting";
    case "waiting_permission":
      return "Waiting for your permission";
    case "interrupted":
      return "Interrupted. This run is blocking later requests in the workspace.";
    default:
      return "Working";
  }
}

export function activityStreams(state?: string): boolean {
  return state !== "queued" && state !== "interrupted";
}

export function activityControlHeading(
  scope: CommunityAgentControllerScope,
  rooms: readonly { id: string; groupId?: string; name: string }[] = [],
): string {
  return `${activityContextLabel(contextForScope(scope), rooms)} · ${activityRunLabel(scope.state)}`;
}

export function activityControlRows(
  scopes: readonly CommunityAgentControllerScope[],
): CommunityAgentControllerScope[] {
  const seen = new Set<string>();
  return scopes.filter((scope) => {
    if (!scope.sessionId) return false;
    const key = [scope.scopeKey, scope.sessionId, scope.turnId ?? ""].join(
      "\0",
    );
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function activityShowsReset(
  scope: CommunityAgentControllerScope,
  scopes: readonly CommunityAgentControllerScope[],
  context?: CommunityAgentActivityContext,
): boolean {
  const rows = activityControlRows(scopes);
  if (!context || context.kind === "overview")
    return rows.find((row) => row.scopeKey === scope.scopeKey) === scope;
  const visible = contextForScopeMatches(context);
  const match = rows.find((row) => visible(contextForScope(row))) ?? rows[0];
  return match === scope;
}

function contextForScopeMatches(
  context: CommunityAgentActivityContext,
): (scope: CommunityAgentActivityContext) => boolean {
  return (scope) => {
    if (scope.kind !== context.kind) return false;
    if (scope.kind === "dm" && context.kind === "dm")
      return (
        scope.agentPubkey === context.agentPubkey &&
        scope.conversationId === context.conversationId
      );
    if (scope.kind === "channel" && context.kind === "channel")
      return scope.channelId === context.channelId;
    if (
      (scope.kind === "thread" || scope.kind === "forum-topic") &&
      (context.kind === "thread" || context.kind === "forum-topic")
    )
      return (
        scope.channelId === context.channelId &&
        scope.threadRootId === context.threadRootId
      );
    return false;
  };
}

export function activityCancelTarget(scope: CommunityAgentControllerScope): {
  scopeKey: string;
  channelId?: string;
  sessionId: string;
  turnId: string;
} {
  return {
    scopeKey: scope.scopeKey,
    channelId: scope.channelId,
    sessionId: scope.sessionId ?? "",
    turnId: scope.turnId ?? "",
  };
}
