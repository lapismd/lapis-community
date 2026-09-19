import { getContext, setContext } from "svelte";
import {
  createAgentContextNavigation,
  type AgentContextNavigationOwner,
  type AgentContextNavigation,
} from "./navigation.js";

const key = Symbol("community-agent-context-navigation");
export function provideAgentContextNavigation(
  owner: AgentContextNavigationOwner,
) {
  const navigation = createAgentContextNavigation(owner);
  setContext(key, navigation);
  return navigation;
}
export const useAgentContextNavigation = ():
  | AgentContextNavigation
  | undefined => getContext(key);
