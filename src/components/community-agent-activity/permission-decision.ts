import type { CommunityAgentPermissionDecision } from "../../community/agent-contracts.js";

export const PERMISSION_DECISION_LABELS: Record<
  CommunityAgentPermissionDecision,
  string
> = {
  allow_once: "Allow once",
  allow_always: "Always allow",
  reject_once: "Deny once",
  reject_always: "Always deny",
  cancel: "Cancel request",
};

export type PermissionDecisionVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline";

export function permissionDecisionVariant(
  decision: CommunityAgentPermissionDecision,
): PermissionDecisionVariant {
  if (decision === "allow_once") return "default";
  if (decision === "allow_always") return "secondary";
  if (decision === "cancel") return "outline";
  return "destructive";
}

export function permissionInputCode(value: unknown): string | undefined {
  if (value === undefined) return;
  const parsed = parsePermissionJson(value);
  if (typeof parsed === "string") {
    const text = parsed.trim();
    return text ? text.slice(0, 4_000) : undefined;
  }
  try {
    const text = JSON.stringify(parsed, null, 2);
    return text ? text.slice(0, 4_000) : undefined;
  } catch {
    return;
  }
}

function parsePermissionJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || !/^[[{"']/.test(trimmed)) return trimmed;
  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

export function permissionExpiryLabel(value: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}
