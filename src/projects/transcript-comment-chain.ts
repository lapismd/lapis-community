import type { NostrEvent } from "../protocol/index.js";
import {
  checkpointCommentConversation,
  checkpointIndex,
  type CheckpointEvents,
} from "./checkpoint-conversation.js";
import { exactEventTag as tag } from "./exact-event-tag.js";
/** Follow-ups inherit the signed anchor; their immediate parent must agree. */
export function validTranscriptCommentChain(
  comment: NostrEvent,
  events: CheckpointEvents,
): boolean {
  const index = checkpointIndex(events);
  const seen = new Set<string>();
  const anchorTags = [
    "E",
    "K",
    "P",
    "a",
    "h",
    "thread",
    "request",
    "record",
    "part",
    "selection",
  ];
  let current = comment;
  while (!seen.has(current.id)) {
    seen.add(current.id);
    if (!checkpointCommentConversation(current, index)) return false;
    if (
      ["part", "selection"].some((key) => {
        const matches = current.tags.filter(([name]) => name === key);
        return (
          matches.length > 1 || (matches.length === 1 && !tag(current, key))
        );
      })
    )
      return false;
    if (tag(current, "k") === "3907")
      return (
        tag(current, "e") === tag(current, "E") &&
        tag(current, "p") === tag(current, "P")
      );
    if (tag(current, "k") !== "1111") return false;
    const parent = index.byId.get(tag(current, "e") ?? "");
    if (
      !parent ||
      tag(current, "p") !== parent.pubkey ||
      !parent.tags.some(
        ([key, value]) => key === "t" && value === "transcript-comment",
      ) ||
      anchorTags.some((key) => tag(parent, key) !== tag(current, key))
    )
      return false;
    current = parent;
  }
  return false;
}
