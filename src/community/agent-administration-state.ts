import type {
  CommunityAgentProcessingState,
  CommunityAgentRuntimeState,
} from "./agent-contracts.js";
import { observerRecord } from "./agent-observer.js";
import { parseRuntimeState } from "./agent-state-parsers.js";

export function parseProcessingState(
  payload: Record<string, unknown> | undefined,
): CommunityAgentProcessingState | undefined {
  if (
    !payload ||
    typeof payload.enabled !== "boolean" ||
    !Number.isSafeInteger(payload.revision) ||
    Number(payload.revision) < 0 ||
    !["applied", "cancelling", "error"].includes(String(payload.status)) ||
    typeof payload.updatedAt !== "number" ||
    !Number.isFinite(payload.updatedAt) ||
    (payload.status !== "applied" && payload.enabled)
  )
    return;
  return {
    enabled: payload.enabled,
    revision: Number(payload.revision),
    status: payload.status as CommunityAgentProcessingState["status"],
    updatedAt: payload.updatedAt,
    ...(typeof payload.applied === "boolean"
      ? { applied: payload.applied }
      : {}),
    ...(typeof payload.error === "string"
      ? { error: payload.error.slice(0, 512) }
      : {}),
  };
}

export function lateRuntimeState(
  current: Record<string, CommunityAgentRuntimeState> | undefined,
  agentPubkey: string,
  kind: string,
  payload: unknown,
): Record<string, CommunityAgentRuntimeState> | undefined {
  if (kind !== "runtime_state") return;
  const late = parseRuntimeState(observerRecord(payload));
  return late ? { ...(current ?? {}), [agentPubkey]: late } : undefined;
}
