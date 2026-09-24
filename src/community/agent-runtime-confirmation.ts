import type { CommunityAgentRuntimeSettings } from "./agent-runtime-set.js";
import type { CommunityAgentRuntimeState } from "./agent-runtime-contracts.js";

export function confirmedRuntimeSettings(
  requested: CommunityAgentRuntimeSettings,
  state: CommunityAgentRuntimeState,
): CommunityAgentRuntimeState {
  if (
    requested.approvalPolicy !== undefined &&
    (state.saved?.approvalPolicy !== requested.approvalPolicy ||
      state.effective.approvalPolicy !== requested.approvalPolicy)
  )
    throw new Error(
      "The controller did not confirm the requested permission policy. Update the controller and retry.",
    );
  return state;
}
