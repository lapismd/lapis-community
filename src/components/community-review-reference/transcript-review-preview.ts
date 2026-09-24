import type { NostrEvent } from "../../protocol/index.js";
import type { resolveTranscriptComment } from "../../projects/transcript-comments.js";
import { transcriptRecordLabel } from "../../projects/transcript-record-parts.js";
import type { AgentConversation } from "../community-agent-conversation/context.svelte.js";
import { eventTag } from "../community-agent-conversation/model.js";

export function transcriptReviewPreview(
  comment: NostrEvent,
  transcript: ReturnType<typeof resolveTranscriptComment>,
  conversation: AgentConversation | undefined,
) {
  if (!transcript || !conversation) return;
  const parent =
    eventTag(comment, "k") === "1111"
      ? conversation.reviewIndex.byId.get(eventTag(comment, "e") ?? "")
      : undefined;
  if (parent)
    return {
      target: {
        authorName:
          conversation.members.find((member) => member.id === parent.pubkey)
            ?.name ?? "Member",
        content: conversation.isDeleted(parent)
          ? "Deleted message"
          : (conversation.message(parent.id)?.content ?? parent.content),
      },
      open: () => conversation.replies.revealComment(parent),
    };
  return {
    target: {
      authorName:
        conversation.members.find(
          (member) => member.id === transcript.checkpoint.authorPubkey,
        )?.name ?? "Agent",
      content:
        transcript.anchor.selection?.exact ??
        (transcript.anchor.part
          ? transcript.parts[transcript.anchor.part]
          : Object.values(transcript.parts).join(" · ")) ??
        transcriptRecordLabel(transcript.record),
    },
    open: () => conversation.replies.reveal(transcript.anchor),
  };
}
