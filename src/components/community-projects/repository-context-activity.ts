import type { CommunityAgentActivityItem } from "../../community/agent-contracts.js";
import type {
  RepositoryAgentCheckpoint,
  RepositoryAgentContextRecord,
} from "../../projects/repository-agent-context.js";
import { checkpointRecordEntry } from "./repository-context-entry.js";

export function checkpointActivity(
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
          ...(checkpoint.channelId ? { channelId: checkpoint.channelId } : {}),
          kind: record.kind,
          payload: {
            entry,
            record,
            checkpointEventId: checkpoint.live ? undefined : checkpoint.eventId,
          },
        },
      },
    ];
  });
}
