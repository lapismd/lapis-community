import type { CommunityAgentActivityContext } from "../../community/agent-contracts.js";

export function activityConversationKey(
  pubkey: string,
  context: CommunityAgentActivityContext,
): string {
  if (context.kind === "overview") return `${pubkey}:overview`;
  if (context.kind === "dm")
    return `${pubkey}:dm:${context.conversationId ?? context.agentPubkey ?? ""}`;
  if (context.kind === "channel")
    return `${pubkey}:channel:${context.channelId}`;
  return `${pubkey}:${context.kind}:${context.channelId}:${context.threadRootId}`;
}
