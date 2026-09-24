import { controllerScopeId } from "./agent-activity-context.js";
import {
  parseTurnState,
  turnIsTerminal,
  type AgentTurnState,
} from "./agent-turn-state.js";

export function activityScopeStorageKey(
  agentPubkey: string,
  scopeKey: string,
  requestId: string,
): string {
  return controllerScopeId(
    agentPubkey,
    requestId ? `${scopeKey}\0${requestId}` : scopeKey,
  );
}

export function activityPayloadState(
  kind: string,
  terminal: boolean,
  reported: string,
  preview: string,
): AgentTurnState {
  const state = parseTurnState(reported);
  if (turnIsTerminal(state)) return state;
  if (terminal)
    return kind === "turn_failed"
      ? "failed"
      : kind === "turn_cancelled"
        ? "cancelled"
        : kind === "turn_interrupted"
          ? "interrupted"
          : kind === "turn_uncertain"
            ? "uncertain"
            : "completed";
  if (kind === "permission_requested") return "waiting_permission";
  if (state !== "unknown") return state;
  if (kind === "turn_started") return "running";
  return preview === "Queued" ? "queued" : "unknown";
}
