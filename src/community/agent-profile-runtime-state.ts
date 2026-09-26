import type {
  CommunityAgentsState,
  CommunityAgentsActions,
} from "./agent-contracts.js";
export function agentProfileRuntimeState(
  state: CommunityAgentsState | undefined,
  actions: CommunityAgentsActions | undefined,
  agent: string,
) {
  return {
    runtime: state?.runtime?.[agent],
    memories: state?.memories?.[agent],
    processing: state?.processing?.[agent],
    runtimeRefresh: state?.runtimeRefresh?.[agent],
    onRefreshRuntime: actions?.refreshRuntime
      ? () => actions.refreshRuntime!(agent)
      : undefined,
  };
}
