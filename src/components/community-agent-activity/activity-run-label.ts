import {
  activityContextLabel,
  contextForScope,
} from "../../community/agent-activity-context.js";
import type { CommunityAgentControllerScope } from "../../community/agent-contracts.js";

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
