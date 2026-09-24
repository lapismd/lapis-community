import type { CommunityAgentControllerScope } from "../../community/agent-contracts.js";
import type { AgentTurnTarget } from "../../community/agent-turn-control-contracts.js";
export function continuationTarget(
  scope: CommunityAgentControllerScope,
): AgentTurnTarget | undefined {
  if (
    !["failed", "cancelled", "interrupted", "completed"].includes(
      scope.state ?? "",
    ) ||
    !scope.requestId ||
    !scope.sessionId ||
    !scope.turnId
  )
    return;
  return {
    requestId: scope.requestId,
    sessionId: scope.sessionId,
    turnId: scope.turnId,
  };
}
