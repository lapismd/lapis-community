import { getContext, setContext } from "svelte";
import {
  createContextNavigation,
  type AgentContextNavigationOwner,
  type AgentContextNavigation,
} from "./context-resolution.js";

const key = Symbol("community-agent-context-navigation");
export function provideAgentContextNavigation(
  owner: AgentContextNavigationOwner,
) {
  const navigation = createContextNavigation(owner);
  setContext(key, navigation);
  return navigation;
}
export const useAgentContextNavigation = ():
  | AgentContextNavigation
  | undefined => getContext(key);
