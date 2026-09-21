import type { CommunityAgentTranscriptEntry } from "./agent-transcript-contracts.js";
import { canonicalPlanEntry } from "./canonical-transcript-plan.js";

import {
  type CanonicalTranscript,
  parseCanonicalTranscript,
} from "../protocol/agent-transcript.js";

const display = (value: unknown) =>
  typeof value === "string" ? value : (JSON.stringify(value, null, 2) ?? "");

export function canonicalEntry(
  record: CanonicalTranscript,
  agentPubkey: string,
  sourceEventId?: string,
  userPubkey = "unknown-user",
): CommunityAgentTranscriptEntry {
  const common = {
    id: record.id,
    sequence: record.sequence,
    createdAt: new Date(record.at).toISOString(),
  };
  const p = record.payload;
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
  if (p.kind === "tool-invocation")
    return {
      ...common,
      id: `${record.turnId}:tool:${String(p.invocationId)}`,
      type: "tool",
      toolId: String(p.invocationId),
      name: String(p.name),
      input: display(p.input),
      state: "running",
    };
  if (p.kind === "tool-result")
    return {
      ...common,
      id: `${record.turnId}:tool:${String(p.invocationId)}`,
      type: "tool",
      toolId: String(p.invocationId),
      name: "Tool result",
      output: display(p.output),
      state: p.outcome === "succeeded" ? "completed" : "error",
      ...(p.outcome === "unknown"
        ? { error: "Tool outcome unavailable; the action was not repeated." }
        : {}),
    };
  if (p.kind === "plan") return canonicalPlanEntry(common, p);
  if (p.kind === "omission")
    return {
      ...common,
      type: "context",
      label: "Capture gap",
      text: String(p.reason ?? "Content unavailable"),
    };
  if (p.kind === "subagent")
    return {
      ...common,
      type: "context",
      label: "Subagent",
      text: `Session: ${String(p.childSessionId)}\n\nInitiating tool: ${String(p.initiatingToolId)}\n\n${String(p.state)}`,
    };
  if (p.kind === "lifecycle")
    return {
      ...common,
      type: "context",
      label: "Capture coverage",
      text: `${record.coverage.mode} · ${record.coverage.observations}\n\n${record.coverage.gaps.map((gap) => `- Unobserved: ${gap}`).join("\n")}\n\nPolicy: ${record.sanitization.policy}\n\nState: ${String(p.state)}`,
    };
  if (p.kind === "compaction")
    return {
      ...common,
      type: "context",
      label: "Context compaction",
      text: `${String(p.summary)}\n\nCovered records: ${display(p.coveredEventIds)}`,
    };
  return {
    ...common,
    type: "context",
    label:
      p.kind === "extension"
        ? `Observed ${String(p.sourceType)} event`
        : p.kind.charAt(0).toUpperCase() + p.kind.slice(1),
    text: "```json\n" + display(p) + "\n```",
  };
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
