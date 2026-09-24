import { checkpointIndex } from "../../projects/checkpoint-conversation.js";
import { resolveCheckpointReview } from "../../projects/checkpoint-reviews.js";
import { agentContextMessageRole } from "../../projects/repository-agent-context.js";
import type { NostrEvent } from "../../protocol/index.js";
import type { RepositoryAgentCheckpoint } from "../../projects/repository-agent-context.js";
import type {
  CommunityAgentActivityContext,
  CommunityAgentActivityItem,
} from "../../community/agent-contracts.js";
import {
  activityMatches,
  observerScope,
} from "../../community/agent-activity-context.js";
import { canonicalActivity } from "../../community/canonical-transcript-activity.js";
import { eventRoot, eventTag } from "../community-agent-conversation/model.js";
import { repositoryContextTurns } from "../community-projects/repository-context-transcript.js";

/** Project one owner's private records beside the exact signed request that started them. */
export function ownerThreadActivity(
  activity: readonly CommunityAgentActivityItem[],
  context: CommunityAgentActivityContext | undefined,
  messageId: string,
  events: readonly NostrEvent[] = [],
): CommunityAgentActivityItem[] {
  return canonicalActivity(activity).filter((item) => {
    if (
      !activityMatches(context, {
        agentPubkey: item.agentPubkey,
        ...observerScope(item.frame),
      })
    )
      return false;
    const payload = record(item.frame.payload);
    const lifecycle = payload.lifecycleRequestId ?? payload.requestId;
    if (
      payload.triggerEventId !== messageId &&
      lifecycle !== messageId &&
      (typeof lifecycle !== "string" || !lifecycle.endsWith(`:${messageId}`))
    )
      return false;
    const entry = record(payload.entry);
    return !(
      entry.type === "message" &&
      (typeof entry.sourceEventId === "string" ||
        events.some(
          (event) =>
            [9, 1111].includes(event.kind) && eventTag(event, "d") === entry.id,
        ))
    );
  });
}

/** Checkpoint data supplements real messages; it never creates duplicate channel posts. */
export function threadContextSegments(
  checkpoints: readonly RepositoryAgentCheckpoint[],
  events: readonly NostrEvent[],
  rootId: string,
  messageId: string,
) {
  const byId = new Map(events.map((event) => [event.id, event]));
  return repositoryContextTurns(checkpoints).flatMap((turn) => {
    const records = turn.segments
      .flatMap((segment) => segment.checkpoint.records)
      .sort((a, b) => a.sequence - b.sequence);
    const requestId = records.find(
      (record) => agentContextMessageRole(record) === "user",
    )?.sourceEventId;
    const source = byId.get(requestId ?? "") ?? byId.get(turn.latest.eventId);
    if (!source || eventRoot(source) !== rootId) return [];
    let anchor = requestId ?? rootId;
    const anchors = new Map<string, string>();
    for (const record of records) {
      const canonical =
        record.sourceEventId ??
        events.find(
          (event) =>
            [9, 1111].includes(event.kind) &&
            eventTag(event, "d") === record.id,
        )?.id;
      if (canonical && record.kind !== "tool") anchor = canonical;
      anchors.set(record.id, anchor);
    }
    return turn.segments.flatMap((segment) => {
      const activity = segment.activity.filter((item) => {
        const record = segment.checkpoint.records.find(
          (record) => record.id === item.id,
        );
        return (
          record &&
          anchors.get(record.id) === messageId &&
          (!agentContextMessageRole(record) ||
            (segment.checkpoint.live &&
              !record.sourceEventId &&
              !events.some((event) => eventTag(event, "d") === record.id)))
        );
      });
      const last = segment.checkpoint.records.at(-1);
      const commitIds =
        last && anchors.get(last.id) === messageId ? segment.commitIds : [];
      return activity.length || commitIds.length
        ? [{ ...segment, activity, commitIds, agent: turn.latest.authorPubkey }]
        : [];
    });
  });
}

export function checkpointThreadComments(
  checkpoints: readonly RepositoryAgentCheckpoint[],
  events: readonly NostrEvent[],
  rootId: string,
  channel?: string,
) {
  const ids = new Set(checkpoints.map((checkpoint) => checkpoint.eventId));
  const index = checkpointIndex(events);
  return events.filter((event) => {
    const target = resolveCheckpointReview(event, index);
    return (
      target &&
      ids.has(target.checkpoint.eventId) &&
      target.rootId === rootId &&
      target.checkpoint.channelId === channel
    );
  });
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
