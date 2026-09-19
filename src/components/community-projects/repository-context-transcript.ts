import type { CommunityAgentActivityItem } from "../../community/agent-contracts.js";
import type {
  RepositoryAgentCheckpoint,
  RepositoryAgentContextRecord,
} from "../../projects/repository-agent-context.js";

export function repositoryContextTurns(
  checkpoints: readonly RepositoryAgentCheckpoint[],
) {
  const turns = new Map<string, RepositoryAgentCheckpoint[]>();
  for (const checkpoint of checkpoints) {
    const key = `${checkpoint.authorPubkey}:${checkpoint.scopeId}:${checkpoint.spanId}`;
    turns.set(key, [...(turns.get(key) ?? []), checkpoint]);
  }
  return [...turns.values()].map((items) => {
    const ordered = items.toSorted(
      (a, b) =>
        a.createdAt - b.createdAt ||
        a.records.length - b.records.length ||
        a.eventId.localeCompare(b.eventId),
    );
    const records = new Map<string, RepositoryAgentContextRecord>();
    for (const item of ordered)
      for (const record of item.records) records.set(record.id, record);
    const latest = ordered.at(-1)!;
    let cursor = -1;
    const shownCommits = new Set<string>();
    const segments = ordered.map((checkpoint) => {
      const end = Math.max(
        cursor,
        ...checkpoint.records.map((r) => r.sequence),
      );
      const segment = [...records.values()]
        .filter((r) => r.sequence > cursor && r.sequence <= end)
        .sort((a, b) => a.sequence - b.sequence);
      cursor = end;
      const commitIds = checkpoint.commitIds.filter(
        (id) => !shownCommits.has(id),
      );
      commitIds.forEach((id) => shownCommits.add(id));
      return {
        checkpoint,
        commitIds,
        activity: checkpointActivity(checkpoint, segment),
      };
    });
    return { latest, segments };
  });
}

function checkpointActivity(
  checkpoint: RepositoryAgentCheckpoint,
  records: readonly RepositoryAgentContextRecord[],
): CommunityAgentActivityItem[] {
  return records.map((record) => {
    const shared = {
      id: record.id,
      createdAt: new Date(record.createdAt).toISOString(),
      sequence: record.sequence,
      redacted: record.redacted,
      truncated: record.truncated,
    };
    const entry =
      record.kind === "tool"
        ? {
            ...shared,
            type: "tool",
            toolId: record.toolId ?? record.id,
            name: record.toolName ?? "Tool",
            state: ["failed", "error", "interrupted"].includes(
              record.toolState ?? "",
            )
              ? "error"
              : record.toolState === "running"
                ? "running"
                : "completed",
            input: record.input,
            output: record.output,
            error:
              record.error ??
              (record.toolState === "interrupted"
                ? "Tool interrupted"
                : undefined),
          }
        : {
            ...shared,
            type: "message",
            role: record.kind === "user_message" ? "user" : "assistant",
            text: record.text ?? "",
            authorPubkey:
              record.authorPubkey ??
              (record.kind === "assistant_message"
                ? checkpoint.authorPubkey
                : "unknown-user"),
            sourceEventId: record.sourceEventId,
          };
    return {
      id: record.id,
      agentPubkey: checkpoint.authorPubkey,
      createdAt: record.sequence,
      frame: {
        version: 2,
        seq: record.sequence,
        timestamp: shared.createdAt,
        turnId: checkpoint.spanId,
        kind: record.kind,
        payload: { entry },
      },
    };
  });
}
