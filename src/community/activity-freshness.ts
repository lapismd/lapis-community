import type {
  CommunityAgentActivitySyncContext,
  CommunityAgentControllerScope,
  CommunityAgentsState,
} from "./agent-contracts.js";
import { activityMatches } from "./agent-activity-context.js";
import { turnIsTerminal } from "./agent-turn-state.js";

export interface AgentActivitySyncTarget {
  agentPubkey: string;
  context: CommunityAgentActivitySyncContext;
}
export interface AgentActivitySyncSelection {
  context: CommunityAgentActivitySyncContext;
  agentPubkeys: readonly string[];
  pending: Set<string>;
}
export function createActivitySyncSelection(
  context: CommunityAgentActivitySyncContext,
  agentPubkeys: readonly string[],
): AgentActivitySyncSelection {
  return { context, agentPubkeys, pending: new Set(agentPubkeys) };
}
export interface AgentActivityFreshnessState {
  activitySyncStatus?: "checking" | "caught-up" | "unavailable";
  activitySyncGap?: boolean;
  activityUnavailable?: readonly AgentActivitySyncTarget[];
}
export type AgentStatePatch = {
  [K in keyof CommunityAgentsState]?: CommunityAgentsState[K] | undefined;
};

/** Staleness is a local projection; signed history is never rewritten. */
export function applyAgentStatePatch(
  state: CommunityAgentsState,
  patch: AgentStatePatch,
  selection?: AgentActivitySyncSelection,
): CommunityAgentsState {
  const next = { ...state, ...patch };
  if (patch.activitySyncStatus === "unavailable" && selection) {
    const targets = selection.agentPubkeys
      .filter((key) => patch.status === "offline" || selection.pending.has(key))
      .map((agentPubkey) => ({ agentPubkey, context: selection.context }));
    const matches = (scope: Partial<CommunityAgentControllerScope>) =>
      targets.some(
        (target) =>
          target.agentPubkey === scope.agentPubkey &&
          activityMatches(target.context, scope),
      );
    const project = (scope: CommunityAgentControllerScope) =>
      matches(scope) && !turnIsTerminal(scope.state)
        ? { ...scope, state: "unknown" as const, preview: "Status unavailable" }
        : scope;
    next.controllerScopes = Object.fromEntries(
      Object.entries(state.controllerScopes).map(([key, scope]) => [
        key,
        project(scope),
      ]),
    );
    next.conversationScopes = Object.fromEntries(
      Object.entries(state.conversationScopes ?? {}).map(([key, scope]) => [
        key,
        project(scope),
      ]),
    );
    next.activityUnavailable = [
      ...new Map(
        [...(state.activityUnavailable ?? []), ...targets].map((target) => [
          JSON.stringify(target),
          target,
        ]),
      ).values(),
    ];
    next.publicWorking = state.publicWorking?.filter(
      (signal) => !matches(signal),
    );
  }
  for (const key of Object.keys(next))
    if (next[key as keyof typeof next] === undefined)
      delete next[key as keyof typeof next];
  return next as CommunityAgentsState;
}
