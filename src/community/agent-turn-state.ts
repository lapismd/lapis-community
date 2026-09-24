/** Owner-reported execution state, independent of message delivery state. */
export type AgentTurnState =
  | "queued"
  | "starting"
  | "running"
  | "waiting_permission"
  | "waiting_input"
  | "completed"
  | "failed"
  | "cancelled"
  | "interrupted"
  | "uncertain"
  | "unknown";

const labels: Record<AgentTurnState, string> = {
  queued: "Queued",
  starting: "Starting",
  running: "Working",
  waiting_permission: "Waiting for your permission",
  waiting_input: "Waiting for your answer",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
  interrupted: "Interrupted",
  uncertain: "Outcome uncertain",
  unknown: "Status unavailable",
};

export function parseTurnState(value: unknown): AgentTurnState {
  return typeof value === "string" && Object.hasOwn(labels, value)
    ? (value as AgentTurnState)
    : "unknown";
}

export function turnStateLabel(state: unknown): string {
  return labels[parseTurnState(state)];
}

export function turnIsTerminal(state: unknown): boolean {
  return [
    "completed",
    "failed",
    "cancelled",
    "interrupted",
    "uncertain",
  ].includes(String(state));
}

export function turnFrameIsTerminal(kind: string): boolean {
  return [
    "turn_completed",
    "turn_finished",
    "turn_failed",
    "turn_cancelled",
    "turn_interrupted",
    "turn_uncertain",
  ].includes(kind);
}
