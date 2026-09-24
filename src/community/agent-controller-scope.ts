import type { AgentTurnState } from "./agent-turn-state.js";
import type { AgentExecutionPolicy } from "./agent-execution-policy.js";

export interface CommunityAgentControllerScope {
  conversationId?: string;
  requestId?: string;
  threadRootId?: string;
  conversationKind?: "channel" | "thread" | "forum-topic" | "dm";
  state?: AgentTurnState;
  executionPolicy?: AgentExecutionPolicy;
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
