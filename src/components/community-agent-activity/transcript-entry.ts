import type { CommunityAgentTranscriptEntry } from "../../community/agent-contracts.js";
import {
  planEntriesFromRecord,
  type CommunityAgentPlanTranscript,
} from "../../community/agent-transcript-plan.js";

export function transcriptRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function transcriptEntry(
  value: unknown,
): CommunityAgentTranscriptEntry | undefined {
  const entry = transcriptRecord(value);
  if (
    typeof entry.id !== "string" ||
    !entry.id ||
    typeof entry.type !== "string" ||
    typeof entry.createdAt !== "string" ||
    !Number.isFinite(Date.parse(entry.createdAt))
  )
    return;
  if (entry.type === "message") {
    if (
      (entry.role !== "user" && entry.role !== "assistant") ||
      typeof entry.text !== "string" ||
      typeof entry.authorPubkey !== "string"
    )
      return;
  } else if (entry.type === "thinking") {
    if (
      typeof entry.text !== "string" ||
      (entry.state !== "streaming" && entry.state !== "done")
    )
      return;
  } else if (entry.type === "tool") {
    if (
      typeof entry.toolId !== "string" ||
      typeof entry.name !== "string" ||
      !["running", "completed", "error"].includes(String(entry.state)) ||
      !optionalStrings(entry, ["input", "output", "error"])
    )
      return;
  } else if (entry.type === "usage") {
    if (
      typeof entry.used !== "number" ||
      !Number.isFinite(entry.used) ||
      entry.used < 0 ||
      (entry.limit !== undefined &&
        (typeof entry.limit !== "number" ||
          !Number.isFinite(entry.limit) ||
          entry.limit <= 0))
    )
      return;
  } else if (entry.type === "permission") {
    if (
      typeof entry.requestId !== "string" ||
      typeof entry.tool !== "string" ||
      !Array.isArray(entry.options) ||
      !entry.options.every((option) => typeof option === "string") ||
      (entry.state !== "pending" && entry.state !== "resolved") ||
      !optionalStrings(entry, ["input", "decision"])
    )
      return;
  } else if (entry.type === "context") {
    if (typeof entry.label !== "string" || typeof entry.text !== "string")
      return;
  } else if (entry.type === "turn") {
    if (
      ![
        "started",
        "completed",
        "failed",
        "cancelled",
        "interrupted",
        "uncertain",
      ].includes(String(entry.state)) ||
      !optionalStrings(entry, ["message"])
    )
      return;
  } else if (entry.type === "plan") {
    return {
      id: entry.id,
      type: "plan",
      entries: planEntriesFromRecord(entry),
      createdAt: entry.createdAt,
      ...(typeof entry.sequence === "number"
        ? { sequence: entry.sequence }
        : {}),
    } satisfies CommunityAgentPlanTranscript;
  } else return;
  return {
    ...entry,
    ...(Array.isArray(entry.options) ? { options: [...entry.options] } : {}),
  } as unknown as CommunityAgentTranscriptEntry;
}

function optionalStrings(
  value: Record<string, unknown>,
  keys: string[],
): boolean {
  return keys.every(
    (key) => value[key] === undefined || typeof value[key] === "string",
  );
}
