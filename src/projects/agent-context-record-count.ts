import type { RepositoryAgentCheckpoint } from "./repository-agent-context.js";
export function agentContextRecordCount(
  checkpoints: readonly RepositoryAgentCheckpoint[],
) {
  return new Set(
    checkpoints.flatMap((checkpoint) =>
      checkpoint.records.map(
        (record) =>
          `${checkpoint.authorPubkey}:${checkpoint.spanId}:${record.id}`,
      ),
    ),
  ).size;
}
