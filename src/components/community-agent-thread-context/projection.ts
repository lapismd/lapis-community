import type { NostrEvent } from "../../protocol/index.js";
import type { RepositoryAgentCheckpoint } from "../../projects/repository-agent-context.js";
import { eventRoot, eventTag } from "../community-agent-conversation/model.js";
import { repositoryContextTurns } from "../community-projects/repository-context-transcript.js";

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
      (record) => record.kind === "user_message",
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
          (record.kind === "tool" ||
            record.kind === "thinking" ||
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
  const owned = checkpoints.filter(
    (checkpoint) =>
      checkpoint.channelId === channel &&
      checkpoint.records.some(
        (record) =>
          record.kind === "user_message" &&
          events.some(
            (event) =>
              event.id === record.sourceEventId && eventRoot(event) === rootId,
          ),
      ),
  );
  return events.filter(
    (event) =>
      event.kind === 1111 &&
      eventTag(event, "K") === "3907" &&
      eventTag(event, "h") === channel &&
      eventTag(event, "thread") === rootId &&
      event.tags.some(
        ([key, value]) => key === "t" && value === "commit-comment",
      ) &&
      owned.some(
        (checkpoint) =>
          eventTag(event, "a") === checkpoint.repositoryAddress &&
          checkpoint.commitIds.includes(eventTag(event, "c") ?? "") &&
          event.tags.some(
            ([key, value]) => key === "E" && value === checkpoint.eventId,
          ),
      ),
  );
}
