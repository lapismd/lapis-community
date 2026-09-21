import type { CommunityAgentActivityItem } from "../../community/agent-contracts.js";
import type {
  RepositoryAgentCheckpoint,
  RepositoryAgentContextRecord,
} from "../../projects/repository-agent-context.js";
import { checkpointRecordEntry } from "./repository-context-entry.js";

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
      const commitIds = checkpoint.commitIds.filter((id) => {
        if (shownCommits.has(id)) return false;
        shownCommits.add(id);
        return true;
      });
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
  return records.flatMap((record) => {
    const entry = checkpointRecordEntry(checkpoint, record);
    if (!entry) return [];
    return [
      {
        id: record.id,
        agentPubkey: checkpoint.authorPubkey,
        createdAt: record.sequence,
        frame: {
          version: 2,
          seq: record.sequence,
          timestamp: new Date(record.createdAt).toISOString(),
          turnId: checkpoint.spanId,
          kind: record.kind,
          payload: { entry },
        },
      },
    ];
  });
}
