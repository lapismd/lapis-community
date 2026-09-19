import type { CommunityAgentPermissionDecision } from "../../community/agent-contracts.js";
export interface AgentRuntimeActions {
  onCancelTurn?: (
    pubkey: string,
    scopeKey: string,
    channelId?: string,
    expected?: { sessionId: string; turnId: string },
  ) => Promise<void>;
  onResetConversation?: (
    pubkey: string,
    scopeKey: string,
    channelId?: string,
    expected?: { sessionId: string; turnId: string },
  ) => Promise<void>;
  onRespondPermission?: (
    pubkey: string,
    requestId: string,
    decision: CommunityAgentPermissionDecision,
    channelId?: string,
  ) => Promise<void>;
}
