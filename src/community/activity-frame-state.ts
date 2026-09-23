import { controllerScopeId } from "./agent-activity-context.js";

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
): string {
  if (terminal)
    return kind === "turn_failed"
      ? "failed"
      : kind === "turn_cancelled"
        ? "cancelled"
        : "completed";
  if (kind === "permission_requested") return "waiting_permission";
  if (kind === "permission_resolved") return "running";
  return reported || (preview === "Queued" ? "queued" : "running");
}
