import { verifyEvent } from "nostr-tools/pure";
import type { NostrEvent } from "../protocol/index.js";
import {
  buildRepositoryAgentContexts,
  agentContextMessageRole,
} from "./repository-agent-context.js";
import { exactEventTag as tag } from "./exact-event-tag.js";

const snapshots = new WeakSet<NostrEvent>();
export function signedCheckpointEvent(event: NostrEvent): boolean {
  if (snapshots.has(event)) return true;
  try {
    // Do not trust a cached verification symbol on a mutable caller-owned event.
    return verifyEvent({
      id: event.id,
      pubkey: event.pubkey,
      created_at: event.created_at,
      kind: event.kind,
      tags: event.tags,
      content: event.content,
      sig: event.sig,
    });
  } catch {
    return false;
  }
}
/** Verified immutable snapshots can be reused while typing or rendering multiple records. */
export function verifiedCheckpointSnapshot(
  event: NostrEvent,
): NostrEvent | undefined {
  if (snapshots.has(event)) return event;
  if (!signedCheckpointEvent(event)) return;
  const snapshot = { ...event, tags: event.tags.map((tag) => [...tag]) };
  for (const tag of snapshot.tags) Object.freeze(tag);
  Object.freeze(snapshot.tags);
  Object.freeze(snapshot);
  snapshots.add(snapshot);
  return snapshot;
}
export class CheckpointConversationIndex {
  readonly events: readonly NostrEvent[];
  readonly checkpoints: ReturnType<typeof buildRepositoryAgentContexts>;
  readonly byId: ReadonlyMap<string, NostrEvent>;
  constructor(events: readonly NostrEvent[]) {
    this.events = events.flatMap((event) => {
      const signed = verifiedCheckpointSnapshot(event);
      return signed ? [signed] : [];
    });
    this.byId = new Map(this.events.map((event) => [event.id, event]));
    this.checkpoints = buildRepositoryAgentContexts(this.events);
  }
}
export type CheckpointEvents =
  | readonly NostrEvent[]
  | CheckpointConversationIndex;
export function checkpointIndex(events: CheckpointEvents) {
  return events instanceof CheckpointConversationIndex
    ? events
    : new CheckpointConversationIndex(events);
}
export function checkpointConversation(
  events: CheckpointEvents,
  checkpointId: string,
) {
  const index = checkpointIndex(events);
  const checkpoint = index.checkpoints.find(
    (value) => value.eventId === checkpointId,
  );
  if (
    !checkpoint ||
    checkpoint.live ||
    checkpoint.availability === "missing" ||
    !checkpoint.repositoryAddress ||
    !checkpoint.channelId
  )
    return;
  const source = checkpoint.records.find(
    (record) => agentContextMessageRole(record) === "user",
  );
  const request = index.byId.get(source?.sourceEventId ?? "");
  if (
    !request ||
    ![9, 11, 1111].includes(request.kind) ||
    tag(request, "h") !== checkpoint.channelId ||
    (source?.authorPubkey && source.authorPubkey !== request.pubkey)
  )
    return;
  const roots =
    request.kind === 1111
      ? request.tags.filter(([key]) => key === "E")
      : request.tags.filter(
          ([key, , , marker]) => key === "e" && marker === "root",
        );
  if (roots.length > 1 || (request.kind === 1111 && roots.length !== 1)) return;
  const rootId = roots[0]?.[1] ?? request.id;
  const root = index.byId.get(rootId);
  if (
    !root ||
    ![9, 11, 1].includes(root.kind) ||
    tag(root, "h") !== checkpoint.channelId
  )
    return;
  if (
    request.kind === 1111 &&
    (tag(request, "K") !== String(root.kind) ||
      tag(request, "P") !== root.pubkey)
  )
    return;
  return { checkpoint, request, rootId, root };
}

/** Validate conversation claims against the signed target, never the other way round. */
export function checkpointCommentConversation(
  comment: NostrEvent,
  events: CheckpointEvents,
) {
  if (
    comment.kind !== 1111 ||
    !signedCheckpointEvent(comment) ||
    tag(comment, "K") !== "3907"
  )
    return;
  const target = checkpointConversation(events, tag(comment, "E") ?? "");
  if (
    !target ||
    tag(comment, "P") !== target.checkpoint.authorPubkey ||
    tag(comment, "a") !== target.checkpoint.repositoryAddress ||
    tag(comment, "h") !== target.checkpoint.channelId ||
    tag(comment, "request") !== target.request.id ||
    tag(comment, "thread") !== target.rootId
  )
    return;
  return target;
}
