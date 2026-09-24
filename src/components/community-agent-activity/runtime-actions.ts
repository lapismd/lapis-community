import type { CommunityAgentsActions } from "../../community/agent-contracts.js";
export interface AgentRuntimeActions {
  onContinueTurn?: CommunityAgentsActions["continueTurn"];
  onCancelTurn?: CommunityAgentsActions["cancelTurn"];
  onResetConversation?: CommunityAgentsActions["resetConversation"];
  onRespondPermission?: CommunityAgentsActions["respondPermission"];
}
export function agentRuntimeActions(
  actions: CommunityAgentsActions,
): AgentRuntimeActions {
  return {
    onContinueTurn: (...args) => actions.continueTurn(...args),
    onCancelTurn: (...args) => actions.cancelTurn(...args),
    onResetConversation: (...args) => actions.resetConversation(...args),
    onRespondPermission: (...args) => actions.respondPermission(...args),
  };
}
