import type { AgentTurnState } from "./agent-turn-state.js";

export interface CommunityAgentControllerScope {
  conversationId?: string;
  requestId?: string;
  threadRootId?: string;
  conversationKind?: "channel" | "thread" | "forum-topic" | "dm";
  state?: AgentTurnState;
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
