import type {
  CommunityAgentControllerScope,
  CommunityAgentObserver,
  CommunityAgentPermissionRequest,
} from "./agent-contracts.js";
import { observerScope } from "./agent-activity-context.js";
import { observerRecord, observerText } from "./agent-observer.js";
import { activityPayloadState } from "./activity-frame-state.js";
import {
  turnFrameIsTerminal,
  turnIsTerminal,
  turnStateLabel,
} from "./agent-turn-state.js";
import { permissionHasExpired } from "./permission-expiry.js";
import { parseExecutionPolicy } from "./agent-execution-policy.js";

/** Project live frames and signed snapshots through the same execution state. */
export function projectActivityScope(
  agentPubkey: string,
  frame: CommunityAgentObserver,
  previous: CommunityAgentControllerScope | undefined,
  permissions: readonly CommunityAgentPermissionRequest[],
  nowMs: number,
  observedAt = Date.parse(frame.timestamp),
): CommunityAgentControllerScope | undefined {
  const payload = observerRecord(frame.payload);
  const scopeKey = observerText(payload.scopeKey, 4_096);
  if (!scopeKey) return;
  const requestId =
    observerText(payload.lifecycleRequestId, 512) ||
    observerText(payload.requestId, 512) ||
    frame.turnId;
  const same = previous?.requestId === requestId;
  const terminal = turnFrameIsTerminal(frame.kind);
  let state = activityPayloadState(
    frame.kind,
    terminal,
    observerText(payload.state, 40),
    observerText(payload.preview, 240),
  );
  const executionPolicy =
    parseExecutionPolicy(payload.executionPolicy) ??
    (same ? previous?.executionPolicy : undefined);
  // A later tool/policy/permission frame cannot resurrect a settled attempt.
  if (same && turnIsTerminal(previous?.state) && !terminal)
    return executionPolicy ? { ...previous!, executionPolicy } : previous;
  const waiting = permissions.some(
    (permission) =>
      permission.scopeKey === scopeKey &&
      permission.sessionId === frame.sessionId &&
      permission.turnId === frame.turnId &&
      !permissionHasExpired(permission, nowMs),
  );
  if (!turnIsTerminal(state) && waiting) state = "waiting_permission";
  else if (state === "waiting_permission") state = "unknown";
  else if (
    state === "unknown" &&
    same &&
    !frame.kind.startsWith("permission_") &&
    frame.kind !== "request_status"
  )
    state = previous?.state ?? "unknown";
  return {
    agentPubkey,
    scopeKey,
    ...observerScope(frame),
    // Interrupted/uncertain attempts still fence the conversation, without animation.
    active: !["completed", "failed", "cancelled"].includes(state),
    state,
    ...(executionPolicy ? { executionPolicy } : {}),
    preview:
      observerText(payload.preview, 240) ||
      observerText(payload.message, 240) ||
      turnStateLabel(state),
    severity:
      observerText(payload.severity, 20) ||
      (state === "failed" ? "error" : "info"),
    updatedAt: observedAt,
    ...(requestId ? { requestId } : {}),
    ...(frame.channelId ? { channelId: frame.channelId } : {}),
    ...(frame.sessionId ? { sessionId: frame.sessionId } : {}),
    ...(frame.turnId ? { turnId: frame.turnId } : {}),
  };
}
