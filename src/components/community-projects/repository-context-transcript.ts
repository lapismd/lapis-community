import type {
  RepositoryAgentCheckpoint,
  RepositoryAgentContextRecord,
} from "../../projects/repository-agent-context.js";
import { checkpointActivity } from "./repository-context-activity.js";

export interface RepositoryContextSessionTiming {
  startAtMs: number;
  endAtMs: number;
  durationMs: number;
  label: string;
}

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
    return {
      latest,
      sessionTiming: repositoryContextSessionTiming(ordered),
      segments,
    };
  });
}

export function repositoryContextSessionTiming(
  checkpoints: readonly RepositoryAgentCheckpoint[],
): RepositoryContextSessionTiming | undefined {
  const eventTimes = checkpoints.flatMap((checkpoint) =>
    checkpoint.records.map((record) => record.createdAt),
  );
  const times = eventTimes.length
    ? eventTimes
    : checkpoints.map((checkpoint) => checkpoint.createdAt * 1_000);
  const startAtMs = Math.min(...times);
  const endAtMs = Math.max(...times);
  if (!Number.isFinite(startAtMs) || !Number.isFinite(endAtMs)) return;
  const durationMs = Math.max(0, endAtMs - startAtMs);
  return {
    startAtMs,
    endAtMs,
    durationMs,
    label: formatRepositoryContextDuration(durationMs),
  };
}

export function formatRepositoryContextDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1_000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes > 0)
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  return `${seconds}s`;
}
