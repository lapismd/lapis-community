export interface CommunityAgentControllerScope {
  conversationId?: string;
  requestId?: string;
  threadRootId?: string;
  conversationKind?: "channel" | "thread" | "forum-topic" | "dm";
  state?: import("./agent-turn-state.js").AgentTurnState;
  executionPolicy?: import("./agent-execution-policy.js").AgentExecutionPolicy;
  replyDelivery?: "pending" | "delivered";
  checkpointSync?: "pending" | "completed";
  preview?: string;
  severity?: string;
  updatedAt?: number;
  agentPubkey: string;
  scopeKey: string;
  active: boolean;
  channelId?: string;
  sessionId?: string;
  turnId?: string;
}
