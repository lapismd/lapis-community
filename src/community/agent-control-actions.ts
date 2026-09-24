import type { CommunityAgentsActions } from "./agent-contracts.js";
import type { ControllerOperations } from "./controller/operations.js";

type ControlActions = Pick<
  CommunityAgentsActions,
  | "continueTurn"
  | "cancelTurn"
  | "resetConversation"
  | "respondPermission"
  | "takePermissionNotifications"
>;
/** Keep displayed identities intact through the application operation boundary. */
export function agentControlActions(
  getActions: () => CommunityAgentsActions | undefined,
  run: ControllerOperations["runOperation"],
): ControlActions {
  function actions(): CommunityAgentsActions {
    const current = getActions();
    if (!current)
      throw new Error("Agent controls require a signed-in community");
    return current;
  }
  return {
    takePermissionNotifications: () =>
      getActions()?.takePermissionNotifications?.() ?? [],
    continueTurn: (pubkey, scopeKey, target) =>
      run(`agent:continue:${pubkey}:${target.requestId}`, () =>
        actions().continueTurn(pubkey, scopeKey, target),
      ),
    cancelTurn: (pubkey, scopeKey, channelId, expected) =>
      run(`agent:cancel:${pubkey}:${scopeKey}`, () =>
        actions().cancelTurn(pubkey, scopeKey, channelId, expected),
      ),
    resetConversation: (pubkey, scopeKey, channelId, expected) =>
      run(`agent:reset:${pubkey}:${scopeKey}`, () =>
        actions().resetConversation(pubkey, scopeKey, channelId, expected),
      ),
    respondPermission: (pubkey, requestId, decision, channelId) =>
      run(`agent:permission:${requestId}`, () =>
        actions().respondPermission(pubkey, requestId, decision, channelId),
      ),
  };
}
