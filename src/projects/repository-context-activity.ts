import type { NostrEvent } from "../protocol/index.js";
import type { ProjectForgeActivityItem } from "./model.js";
import {
  buildRepositoryAgentContexts,
  type RepositoryAgentCheckpoint,
} from "./repository-agent-context.js";
import { exactEventTag } from "./repository-agent-context-parsing.js";

/** Keep a conversation and its code checkpoints together in the repository feed. */
export function withRepositoryContextActivity(
  activity: readonly ProjectForgeActivityItem[],
  events: readonly NostrEvent[],
): ProjectForgeActivityItem[] {
  const byId = new Map(events.map((event) => [event.id, event]));
  const turns = new Map<string, RepositoryAgentCheckpoint[]>();
  for (const checkpoint of buildRepositoryAgentContexts(events)) {
    const key = `${checkpoint.authorPubkey}:${checkpoint.scopeId}:${checkpoint.spanId}`;
    turns.set(key, [...(turns.get(key) ?? []), checkpoint]);
  }
  const operations = new Set(
    [...turns.values()].flatMap((turn) => turn.map((c) => c.operationId)),
  );
  const context = [...turns.entries()].flatMap(
    ([id, checkpoints]): ProjectForgeActivityItem[] => {
      const latest = checkpoints[0]!;
      const event = byId.get(latest.eventId)!;
      const repositoryCoordinate = exactEventTag(event, "a");
      if (!repositoryCoordinate) return [];
      const parent = activity.find(
        (item) => item.repositoryCoordinate === repositoryCoordinate,
      );
      return [
        {
          id: `agent:${id}`,
          kind: checkpoints.some((checkpoint) => checkpoint.commitIds.length)
            ? "commit"
            : "comment",
          createdAt: latest.createdAt,
          actorPubkey: latest.authorPubkey,
          action: "worked on",
          title: "Agent context",
          body: "",
          repositoryCoordinate,
          projectCoordinate: parent?.projectCoordinate ?? repositoryCoordinate,
          agentContext: checkpoints,
        },
      ];
    },
  );
  return [
    ...activity.filter((item) => !operations.has(item.title)),
    ...context,
  ].sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
}
