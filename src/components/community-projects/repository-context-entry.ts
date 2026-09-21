import { parsePlanEntries } from "../../community/agent-transcript-plan.js";
import { canonicalEntryFromText } from "../../community/canonical-transcript.js";
import type { CommunityAgentTranscriptEntry } from "../../community/agent-contracts.js";
import type {
  RepositoryAgentCheckpoint,
  RepositoryAgentContextRecord,
} from "../../projects/repository-agent-context.js";

export function checkpointRecordEntry(
  checkpoint: RepositoryAgentCheckpoint,
  record: RepositoryAgentContextRecord,
): CommunityAgentTranscriptEntry | undefined {
  const shared = {
    id: record.id,
    createdAt: new Date(record.createdAt).toISOString(),
    sequence: record.sequence,
  };
  const flags = {
    ...(record.redacted === true ? { redacted: true as const } : {}),
    ...(record.truncated === true ? { truncated: true as const } : {}),
  };
  if (record.kind === "transcript")
    return canonicalEntryFromText(
      record.text ?? "",
      checkpoint.authorPubkey,
      record.sourceEventId,
      record.authorPubkey,
    );
  if (record.kind === "thinking")
    return {
      ...shared,
      ...flags,
      type: "thinking",
      text: record.text ?? "",
      state: checkpoint.live ? "streaming" : "done",
    };
  if (record.kind === "tool") {
    const error =
      record.error ??
      (record.toolState === "interrupted" ? "Tool interrupted" : undefined);
    return {
      ...shared,
      ...flags,
      type: "tool",
      toolId: record.toolId ?? record.id,
      name: record.toolName ?? "Tool",
      state: ["failed", "error", "interrupted"].includes(record.toolState ?? "")
        ? "error"
        : record.toolState === "running"
          ? "running"
          : "completed",
      ...(record.input !== undefined ? { input: record.input } : {}),
      ...(record.output !== undefined ? { output: record.output } : {}),
      ...(error !== undefined ? { error } : {}),
    };
  }
  if (record.kind === "plan")
    return {
      ...shared,
      type: "plan",
      entries: parsePlanEntries(record.entries),
    };
  if (record.kind === "permission")
    return {
      ...shared,
      type: "permission",
      requestId: record.id,
      tool: record.toolName ?? "tool",
      options: record.options ?? [],
      state: record.toolState === "resolved" ? "resolved" : "pending",
      ...(record.input !== undefined ? { input: record.input } : {}),
      ...(record.decision ? { decision: record.decision } : {}),
    };
  if (record.kind === "usage")
    return {
      ...shared,
      type: "usage",
      used: record.used ?? 0,
      ...(record.limit !== undefined ? { limit: record.limit } : {}),
    };
  return {
    ...shared,
    ...flags,
    type: "message",
    role: record.kind === "user_message" ? "user" : "assistant",
    text: record.text ?? "",
    authorPubkey:
      record.authorPubkey ??
      (record.kind === "assistant_message"
        ? checkpoint.authorPubkey
        : "unknown-user"),
    ...(record.sourceEventId ? { sourceEventId: record.sourceEventId } : {}),
  };
}
