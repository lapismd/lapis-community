import type {
  CommunityAgentActivityItem,
  CommunityAgentActivityContext,
  CommunityAgentsState,
} from "../../community/agent-contracts.js";
import {
  activityMatches,
  observerScope,
} from "../../community/agent-activity-context.js";
import {
  observerRecord,
  observerText,
} from "../../community/agent-observer.js";
import type { AgentTurnState } from "../../community/agent-turn-state.js";
import { canonicalActivity } from "../../community/canonical-transcript-activity.js";

export type TranscriptExecution = Pick<
  CommunityAgentsState,
  "conversationScopes" | "controllerScopes" | "activityUnavailable"
>;
export function transcriptExecutionState(
  item: CommunityAgentActivityItem,
  execution?: Partial<TranscriptExecution>,
): AgentTurnState | undefined {
  if (!execution) return;
  const frame = item.frame,
    payload = observerRecord(frame.payload),
    scope = observerScope(frame);
  const request =
    observerText(payload.lifecycleRequestId, 512) ||
    observerText(payload.requestId, 512);
  const current = Object.values(
    execution.conversationScopes ?? execution.controllerScopes ?? {},
  ).find(
    (candidate) =>
      candidate.agentPubkey === item.agentPubkey &&
      candidate.scopeKey === scope.scopeKey &&
      candidate.sessionId === frame.sessionId &&
      candidate.turnId === frame.turnId &&
      (!request || candidate.requestId === request),
  );
  if (current?.state) return current.state;
  if (
    execution.activityUnavailable?.some(
      (target) =>
        target.agentPubkey === item.agentPubkey &&
        activityMatches(target.context, {
          agentPubkey: item.agentPubkey,
          ...scope,
        }),
    )
  )
    return "unknown";
}
export function transcriptRecordStates(
  activity: readonly CommunityAgentActivityItem[],
  agent: string,
  execution?: Partial<TranscriptExecution>,
  context?: CommunityAgentActivityContext,
): Map<string, AgentTurnState> {
  const states = new Map<string, AgentTurnState>();
  for (const item of canonicalActivity(activity)) {
    if (
      item.agentPubkey !== agent ||
      !activityMatches(context, {
        agentPubkey: agent,
        ...observerScope(item.frame),
      })
    )
      continue;
    const entry = observerRecord(observerRecord(item.frame.payload).entry);
    const state = transcriptExecutionState(item, execution);
    if (typeof entry.id === "string" && state) states.set(entry.id, state);
  }
  return states;
}

export function activityFeedExecution(
  model: CommunityAgentsState,
  scopes: readonly import("../../community/agent-contracts.js").CommunityAgentControllerScope[],
) {
  return {
    execution: model,
    working: scopes.some((scope) => scope.active && scope.state === "running"),
  };
}
export function transcriptToolStatus(
  state: "running" | "completed" | "error",
  unavailable: boolean,
) {
  return unavailable && state === "running"
    ? ("unknown" as const)
    : state === "completed"
      ? ("complete" as const)
      : state;
}
