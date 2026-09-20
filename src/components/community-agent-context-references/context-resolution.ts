import { useAgentConversation } from "../community-agent-conversation/context.svelte.js";
import {
  createAgentContextNavigation,
  type AgentContextNavigationOwner,
} from "./navigation.js";
export type {
  AgentContextNavigationOwner,
  AgentContextNavigation,
} from "./navigation.js";

/** Resolve unloaded request roots through the same verified event cache as messages. */
export function createContextNavigation(owner: AgentContextNavigationOwner) {
  const conversation = useAgentConversation();
  return createAgentContextNavigation({
    ...owner,
    ...(conversation ? { loadMessage: conversation.loadMessage } : {}),
  });
}
