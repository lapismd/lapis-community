import type { CommunityAgentTranscriptEntry } from "./agent-transcript-contracts.js";
import { canonicalPlanEntry } from "./canonical-transcript-plan.js";

import {
  type CanonicalTranscript,
  parseCanonicalTranscript,
} from "../protocol/agent-transcript.js";

const display = (value: unknown) => {
  if (value == null) return "";
  return typeof value === "string"
    ? value
    : (JSON.stringify(value, null, 2) ?? "");
};

const leftover = new Set([
  "lifecycle",
  "extension",
  "file",
  "patch",
  "command",
  "subagent",
  "compaction",
  "checkpoint",
  "omission",
  "input",
]);

export function canonicalEntry(
  record: CanonicalTranscript,
  agentPubkey: string,
  sourceEventId?: string,
  userPubkey = "unknown-user",
): CommunityAgentTranscriptEntry | undefined {
  const common = {
    id: record.id,
    sequence: record.sequence,
    createdAt: new Date(record.at).toISOString(),
  };
  const p = record.payload;
  if (leftover.has(p.kind)) return;
  if (p.kind === "message")
    return {
      ...common,
      type: "message",
      role: p.role as "user" | "assistant",
      text: String(p.text),
      authorPubkey: p.role === "user" ? userPubkey : agentPubkey,
      ...(sourceEventId ? { sourceEventId } : {}),
      redacted: record.sanitization.redacted,
    };
  if (p.kind === "thinking")
    return {
      ...common,
      type: "thinking",
      text: String(p.text),
      state: "done",
      redacted: record.sanitization.redacted,
    };
  if (p.kind === "tool-invocation") {
    const input = display(p.input);
    return {
      ...common,
      id: `${record.turnId}:tool:${String(p.invocationId)}`,
      type: "tool",
      toolId: String(p.invocationId),
      name: toolName(p.name),
      ...(input ? { input } : {}),
      state: "running",
    };
  }
  if (p.kind === "tool-result")
    return {
      ...common,
      id: `${record.turnId}:tool:${String(p.invocationId)}`,
      type: "tool",
      toolId: String(p.invocationId),
      name: toolName(p.name),
      output: display(p.output),
      state: p.outcome === "succeeded" ? "completed" : "error",
      ...(p.outcome === "unknown"
        ? { error: "Tool outcome unavailable; the action was not repeated." }
        : {}),
    };
  if (p.kind === "plan") return canonicalPlanEntry(common, p);
  if (p.kind === "permission")
    return {
      ...common,
      type: "permission",
      requestId: String(p.interactionId ?? p.requestId ?? record.id),
      tool: String(p.tool ?? p.name ?? "tool"),
      ...(p.input !== undefined ? { input: display(p.input) } : {}),
      options: Array.isArray(p.options)
        ? p.options.filter(
            (option): option is string => typeof option === "string",
          )
        : [],
      state: p.state === "resolved" ? "resolved" : "pending",
      ...(typeof p.decision === "string" ? { decision: p.decision } : {}),
    };
  if (p.kind === "usage") {
    const used = Number(p.used);
    if (!Number.isFinite(used) || used < 0) return;
    const limit = Number(p.limit);
    return {
      ...common,
      type: "usage",
      used,
      ...(Number.isFinite(limit) && limit > 0 ? { limit } : {}),
    };
  }
  if (p.kind === "error" || p.kind === "cancellation")
    return {
      ...common,
      type: "turn",
      state: p.kind === "cancellation" ? "cancelled" : "failed",
      message: String(
        p.message ?? p.reason ?? p.code ?? "The agent turn failed.",
      ),
    };
}

function toolName(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "Tool";
}

export function canonicalEntryFromText(
  text: string,
  agentPubkey: string,
  sourceEventId?: string,
  userPubkey?: string,
) {
  const record = parseCanonicalTranscript(text);
  return record
    ? canonicalEntry(record, agentPubkey, sourceEventId, userPubkey)
    : undefined;
}
