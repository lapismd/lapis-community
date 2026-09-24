import type { NostrEvent, NostrEventTemplate } from "../protocol/index.js";
import type {
  TranscriptCommentAnchor,
  TranscriptCommentPart,
} from "../protocol/transcript-comment-anchor.js";
import {
  checkpointIndex,
  signedCheckpointEvent,
  type CheckpointEvents,
} from "./checkpoint-conversation.js";
import { exactEventTag as tag } from "./exact-event-tag.js";
import { transcriptCommentTarget } from "./transcript-comments.js";

export function transcriptReactionTarget(
  event: NostrEvent,
  events: CheckpointEvents,
) {
  if (
    event.kind !== 7 ||
    !signedCheckpointEvent(event) ||
    tag(event, "k") !== "3907" ||
    event.tags.some(([key]) => key === "selection")
  )
    return;
  const checkpointEventId = tag(event, "e"),
    recordId = tag(event, "record"),
    part = tag(event, "part");
  if (
    !checkpointEventId ||
    !recordId ||
    event.tags.filter(([key]) => key === "part").length > 1
  )
    return;
  if (
    event.tags.some(([key]) => key === "part") &&
    (!part || !/^plan:\d+$/u.test(part))
  )
    return;
  const anchor: TranscriptCommentAnchor = {
    checkpointEventId,
    recordId,
    ...(part ? { part: part as TranscriptCommentPart } : {}),
  };
  const target = transcriptCommentTarget(events, anchor);
  return target &&
    tag(event, "p") === target.checkpoint.authorPubkey &&
    tag(event, "h") === target.checkpoint.channelId &&
    tag(event, "thread") === target.rootId
    ? target
    : undefined;
}
export function transcriptAnchorKey(anchor: TranscriptCommentAnchor) {
  return JSON.stringify([
    anchor.checkpointEventId,
    anchor.recordId,
    anchor.part ?? null,
  ]);
}
export function transcriptReactions(
  events: CheckpointEvents,
  anchor: TranscriptCommentAnchor,
  viewer?: string,
) {
  const index = checkpointIndex(events),
    key = transcriptAnchorKey(anchor);
  const matching = index.events.filter((event) => {
    const target = transcriptReactionTarget(event, index);
    return (
      target &&
      transcriptAnchorKey(target.anchor) === key &&
      !index.events.some(
        (deletion) =>
          deletion.kind === 5 &&
          deletion.pubkey === event.pubkey &&
          deletion.tags.some(([key, id]) => key === "e" && id === event.id),
      )
    );
  });
  const groups = new Map<
    string,
    { emoji: string; count: number; selected: boolean; customEmojiUrl?: string }
  >();
  const seen = new Set<string>();
  for (const event of matching) {
    const identity = JSON.stringify([event.pubkey, event.content]);
    if (seen.has(identity)) continue;
    seen.add(identity);
    const custom = event.tags.find(
      ([key, shortcode]) =>
        key === "emoji" && `:${shortcode}:` === event.content,
    );
    const group = groups.get(event.content) ?? {
      emoji: event.content,
      count: 0,
      selected: false,
      ...(custom?.[2] ? { customEmojiUrl: custom[2] } : {}),
    };
    group.count++;
    group.selected ||= event.pubkey === viewer;
    groups.set(event.content, group);
  }
  return { events: matching, groups: [...groups.values()] };
}
export function toggleTranscriptReaction(
  events: CheckpointEvents,
  anchor: TranscriptCommentAnchor,
  viewer: string,
  emoji: string,
  custom?: { shortcode: string; url: string },
): NostrEventTemplate {
  const target = transcriptCommentTarget(events, anchor);
  if (
    !target ||
    !viewer ||
    !emoji.trim() ||
    anchor.selection ||
    (anchor.part && !/^plan:\d+$/u.test(anchor.part))
  )
    throw new Error("A saved transcript item is required to react");
  const observed = transcriptReactions(events, anchor, viewer).groups.find(
    (group) => group.emoji === emoji,
  );
  custom ??= observed?.customEmojiUrl
    ? { shortcode: emoji.replace(/^:|:$/gu, ""), url: observed.customEmojiUrl }
    : undefined;
  const content = custom ? `:${custom.shortcode}:` : emoji;
  const previous = transcriptReactions(events, anchor, viewer).events.filter(
    (event) => event.pubkey === viewer && event.content === content,
  );
  return {
    kind: previous.length ? 5 : 7,
    created_at: Math.floor(Date.now() / 1000),
    content: previous.length ? "" : content,
    tags: previous.length
      ? [
          ["h", target.checkpoint.channelId!],
          ["k", "7"],
          ...previous.map((event) => ["e", event.id]),
        ]
      : [
          ["e", anchor.checkpointEventId],
          ["p", target.checkpoint.authorPubkey],
          ["k", "3907"],
          ["h", target.checkpoint.channelId!],
          ["thread", target.rootId],
          ["record", anchor.recordId],
          ...(anchor.part ? [["part", anchor.part]] : []),
          ...(custom ? [["emoji", custom.shortcode, custom.url]] : []),
        ],
  };
}
