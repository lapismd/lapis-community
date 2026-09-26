import type { CommunityAgentsController } from "./agent-controller.js";
import type { CommunityAgentsActions } from "./agent-contracts.js";
export function runtimeActionBridge(
  current: () => CommunityAgentsController | undefined,
): Pick<
  CommunityAgentsActions,
  "loadRuntime" | "saveRuntime" | "refreshRuntime"
> {
  const actions = () => {
    const controller = current();
    if (!controller)
      throw new Error("Agent controls require a signed-in community");
    return controller.actions;
  };
  return {
    refreshRuntime: async (pubkey) => {
      await actions().refreshRuntime?.(pubkey);
    },
    loadRuntime: (pubkey) => actions().loadRuntime(pubkey),
    saveRuntime: (pubkey, defaults) => actions().saveRuntime(pubkey, defaults),
  };
}
