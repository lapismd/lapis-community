import type { CheckpointEvents } from "./checkpoint-conversation.js";
import type { NostrEvent, NostrEventTemplate } from "../protocol/index.js";
import {
  validTranscriptSelection,
  type TranscriptCommentAnchor,
  type TranscriptCommentPart,
} from "../protocol/transcript-comment-anchor.js";
import {
  checkpointConversation,
  checkpointCommentConversation,
} from "./checkpoint-conversation.js";
import { exactEventTag as tag } from "./exact-event-tag.js";
import { transcriptRecordParts } from "./transcript-record-parts.js";

export function transcriptCommentTarget(
  events: CheckpointEvents,
  anchor: TranscriptCommentAnchor,
) {
  const target = checkpointConversation(events, anchor.checkpointEventId);
  const record = target?.checkpoint.records.find(
    (record) => record.id === anchor.recordId,
  );
  const parts = record && transcriptRecordParts(record);
  if (
    !target ||
    !record ||
    !parts ||
    (anchor.part !== undefined && !Object.hasOwn(parts, anchor.part)) ||
    (anchor.selection !== undefined &&
      (!anchor.part ||
        !validTranscriptSelection(parts[anchor.part]!, anchor.selection)))
  )
    return;
  return { ...target, record, parts, anchor };
}
export function createTranscriptComment(
  events: CheckpointEvents,
  anchor: TranscriptCommentAnchor,
  content: string,
): NostrEventTemplate {
  const target = transcriptCommentTarget(events, anchor);
  if (!target || !content.trim())
    throw new Error(
      "A durable matching transcript record and comment are required",
    );
  return {
    kind: 1111,
    created_at: Math.floor(Date.now() / 1000),
    content: content.trim(),
    tags: [
      ["E", target.checkpoint.eventId],
      ["K", "3907"],
      ["P", target.checkpoint.authorPubkey],
      ["e", target.checkpoint.eventId],
      ["k", "3907"],
      ["p", target.checkpoint.authorPubkey],
      ["a", target.checkpoint.repositoryAddress!],
      ["h", target.checkpoint.channelId!],
      ["thread", target.rootId],
      ["request", target.request.id],
      ["t", "transcript-comment"],
      ["record", anchor.recordId],
      ...(anchor.part ? [["part", anchor.part]] : []),
      ...(anchor.selection
        ? [["selection", JSON.stringify(anchor.selection)]]
        : []),
    ],
  };
}
export function resolveTranscriptComment(
  comment: NostrEvent,
  events: CheckpointEvents,
) {
  if (
    !comment.tags.some(
      ([key, value]) => key === "t" && value === "transcript-comment",
    ) ||
    !checkpointCommentConversation(comment, events)
  )
    return;
  const recordId = tag(comment, "record"),
    part = tag(comment, "part");
  const partTags = comment.tags.filter(([key]) => key === "part");
  const selections = comment.tags.filter(([key]) => key === "selection");
  if (
    !recordId ||
    partTags.length > 1 ||
    (partTags.length && !part) ||
    selections.length > 1
  )
    return;
  try {
    const selection = tag(comment, "selection");
    if (selections.length && (!selection || selection.length > 26000)) return;
    const anchor: TranscriptCommentAnchor = {
      checkpointEventId: tag(comment, "E")!,
      recordId,
      ...(part ? { part: part as TranscriptCommentPart } : {}),
      ...(selection ? { selection: JSON.parse(selection) } : {}),
    };
    return transcriptCommentTarget(events, anchor);
  } catch {
    return;
  }
}
