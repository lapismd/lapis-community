import type { NostrEvent } from "../../protocol/index.js";
import type { CommunityRoomModel } from "../../community/workspace-model.js";
import type { CheckpointConversationIndex } from "../../projects/checkpoint-conversation.js";
import { resolveCheckpointReview } from "../../projects/checkpoint-reviews.js";
import type { createTranscriptReplies } from "./transcript-replies.svelte.js";
import { eventTag, eventRoot } from "./model.js";

export function createConversationNavigation(
  owner: {
    rooms(): readonly CommunityRoomModel[];
    openThread(room: string, root: string, reply?: string): void;
  },
  replies: ReturnType<typeof createTranscriptReplies>,
  index: () => CheckpointConversationIndex,
) {
  let replyCommentId = $state<string>();
  return {
    get replyCommentId() {
      return replyCommentId;
    },
    clearCommentReply() {
      replyCommentId = undefined;
    },
    openComment(event: NostrEvent) {
      if (replies.reply(event)) {
        replyCommentId = undefined;
        return;
      }
      const target = resolveCheckpointReview(event, index());
      const room = owner
        .rooms()
        .find(
          (room) => (room.groupId ?? room.id) === target?.checkpoint.channelId,
        );
      if (room && target?.rootId) {
        replyCommentId = event.id;
        owner.openThread(room.id, target.rootId, event.id);
      }
    },
    open(event: NostrEvent, reply = true) {
      replyCommentId = undefined;
      replies.clear();
      const room = owner
        .rooms()
        .find((room) => (room.groupId ?? room.id) === eventTag(event, "h"));
      if (room)
        owner.openThread(
          room.id,
          eventRoot(event),
          reply ? event.id : undefined,
        );
    },
  };
}
