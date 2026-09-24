import { observerRecord, observerText } from "./agent-observer.js";

export type AgentApprovalPolicy = "ask" | "allow-all";
export interface AgentExecutionPolicy {
  requested: AgentApprovalPolicy;
  effective: AgentApprovalPolicy;
  restricted: boolean;
  nativeMode?: {
    requested: string;
    status: "applied" | "unsupported" | "rejected" | "unreported";
    effective?: string;
  };
}

export function isApprovalPolicy(value: unknown): value is AgentApprovalPolicy {
  return value === "ask" || value === "allow-all";
}

export function approvalPolicyLabel(
  value: AgentApprovalPolicy | undefined,
): string {
  return value === "ask"
    ? "Ask"
    : value === "allow-all"
      ? "Allow all"
      : "Not reported";
}

/** Never infer applied execution settings from configuration or provider names. */
export function parseExecutionPolicy(
  value: unknown,
): AgentExecutionPolicy | undefined {
  const policy = observerRecord(value);
  if (
    !isApprovalPolicy(policy.requested) ||
    !isApprovalPolicy(policy.effective) ||
    typeof policy.restricted !== "boolean" ||
    (policy.restricted && policy.effective !== "ask")
  )
    return;
  const result: AgentExecutionPolicy = {
    requested: policy.requested,
    effective: policy.effective,
    restricted: policy.restricted,
  };
  if (policy.nativeMode !== undefined) {
    const mode = observerRecord(policy.nativeMode),
      requested = observerText(mode.requested, 256);
    if (
      !requested ||
      !["applied", "unsupported", "rejected", "unreported"].includes(
        String(mode.status),
      )
    )
      return;
    result.nativeMode = {
      requested,
      status: mode.status as NonNullable<
        AgentExecutionPolicy["nativeMode"]
      >["status"],
      ...(mode.status === "applied" && observerText(mode.effective, 256)
        ? { effective: observerText(mode.effective, 256) }
        : {}),
    };
  }
  return result;
}
