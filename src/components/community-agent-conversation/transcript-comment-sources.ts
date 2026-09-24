import type {
  CommunityAgentActivityContext,
  CommunityAgentActivityItem,
} from "../../community/agent-contracts.js";
import { canonicalActivity } from "../../community/canonical-transcript-activity.js";
import {
  activityMatches,
  observerScope,
} from "../../community/agent-activity-context.js";
import { transcriptRecord as object } from "../community-agent-activity/transcript-entry.js";
import { transcriptEntry } from "../community-agent-activity/transcript-entry.js";
import {
  transcriptRecordParts,
  transcriptRecordLabel,
  transcriptRecordIdentity,
} from "../../projects/transcript-record-parts.js";
import type { RepositoryAgentContextRecord } from "../../projects/repository-agent-context.js";

export interface TranscriptCommentSource {
  key: string;
  agentPubkey: string;
  record: RepositoryAgentContextRecord;
  parts: Record<string, string>;
  displayId: string;
  checkpointEventId?: string;
  channelId?: string;
  threadRootId?: string;
}
export function transcriptCommentSources(
  activity: readonly CommunityAgentActivityItem[],
  agent: string,
  context?: CommunityAgentActivityContext,
) {
  const records = new Map<string, TranscriptCommentSource>();
  for (const item of canonicalActivity(activity)) {
    const scope = observerScope(item.frame);
    if (
      item.agentPubkey !== agent ||
      scope.conversationKind === "dm" ||
      !activityMatches(context, { ...scope, agentPubkey: agent })
    )
      continue;
    const payload = object(item.frame.payload),
      entry = transcriptEntry(payload.entry);
    if (!entry) continue;
    let record = payload.record as RepositoryAgentContextRecord | undefined;
    const canonical = object(payload.canonical);
    if (!record && canonical.id)
      record = {
        id: String(canonical.id),
        sequence: Number(canonical.sequence),
        createdAt: Number(canonical.at),
        kind: "transcript",
        text: JSON.stringify(canonical),
      };
    if (!record)
      record = {
        ...entry,
        sequence: entry.sequence ?? item.frame.seq,
        createdAt: Date.parse(entry.createdAt),
        kind:
          entry.type === "message"
            ? entry.role === "assistant"
              ? "assistant_message"
              : "user_message"
            : entry.type,
      } as RepositoryAgentContextRecord;
    const parts = transcriptRecordParts(record);
    if (!parts) continue;
    const checkpointEventId =
      typeof payload.checkpointEventId === "string"
        ? payload.checkpointEventId
        : undefined;
    const identity = transcriptRecordIdentity(record);
    const key = JSON.stringify([
      agent,
      identity?.threadId ?? scope.channelId,
      identity?.turnId ?? scope.threadRootId,
      record.id,
    ]);
    records.set(key, {
      key,
      agentPubkey: agent,
      record,
      parts,
      displayId: entry.id,
      ...(checkpointEventId ? { checkpointEventId } : {}),
      ...(scope.channelId ? { channelId: scope.channelId } : {}),
      ...(scope.threadRootId ? { threadRootId: scope.threadRootId } : {}),
    });
  }
  return [...records.values()];
}
export function sourceActivity(
  activity: readonly CommunityAgentActivityItem[],
  sourceEventId?: string,
) {
  return sourceEventId
    ? activity.find(
        (item) =>
          object(object(item.frame.payload).entry).sourceEventId ===
          sourceEventId,
      )
    : undefined;
}

export function transcriptCommentLabel(source: TranscriptCommentSource) {
  return transcriptRecordLabel(source.record);
}
