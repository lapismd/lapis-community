import type { CommunityAgentPermissionDecision } from "./agent-contracts.js";
export interface CommunityAgentPermissionRequest {
  agentPubkey: string;
  requestId: string;
  scopeKey: string;
  tool: string;
  input?: unknown;
  options: readonly CommunityAgentPermissionDecision[];
  expiresAt?: number;
  channelId?: string;
  sessionId?: string;
  turnId?: string;
}
