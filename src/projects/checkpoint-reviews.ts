import type { CheckpointEvents } from "./checkpoint-conversation.js";
import type { NostrEvent } from "../protocol/index.js";
import { checkpointCommentConversation } from "./checkpoint-conversation.js";
import { exactEventTag } from "./exact-event-tag.js";
import { resolveTranscriptComment } from "./transcript-comments.js";

export function resolveCheckpointReview(
  comment: NostrEvent,
  events: CheckpointEvents,
) {
  if (
    comment.tags.some(
      ([key, value]) => key === "t" && value === "transcript-comment",
    )
  )
    return resolveTranscriptComment(comment, events);
  if (
    !comment.tags.some(
      ([key, value]) => key === "t" && value === "commit-comment",
    )
  )
    return;
  const target = checkpointCommentConversation(comment, events);
  return target?.checkpoint.commitIds.includes(
    exactEventTag(comment, "c") ?? "",
  )
    ? target
    : undefined;
}
