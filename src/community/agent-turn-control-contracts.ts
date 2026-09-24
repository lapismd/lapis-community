export interface AgentTurnTarget {
  requestId: string;
  sessionId: string;
  turnId: string;
}
export interface AgentTurnControlState extends AgentTurnTarget {
  agentPubkey: string;
  scopeKey: string;
  controlId: string;
  status: "pending" | "unconfirmed" | "error" | "acknowledged";
  invocationId?: string;
  outcome?: string;
  message?: string;
}
export interface ContinueTurnControl {
  version: 2;
  command: "continue_turn";
  requestId: string;
  targetRequestId: string;
  scopeKey: string;
  expectedSessionId: string;
  expectedTurnId: string;
}
export interface AgentTurnActions {
  continueTurn(
    pubkey: string,
    scopeKey: string,
    target: AgentTurnTarget,
  ): Promise<void>;
  cancelTurn(
    pubkey: string,
    scopeKey: string,
    channelId?: string,
    expected?: { requestId?: string; sessionId: string; turnId: string },
  ): Promise<void>;
  resetConversation(
    pubkey: string,
    scopeKey: string,
    channelId?: string,
    expected?: { sessionId: string; turnId: string },
  ): Promise<void>;
}
