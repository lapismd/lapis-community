import { expect, it } from "vitest";
import { transcriptCommentFixture } from "../../testing/transcript-comment-fixture.js";
import {
  createTranscriptComment,
  resolveTranscriptComment,
} from "../../projects/transcript-comments.js";
import {
  conversationMessage,
  visibleEvents,
} from "../community-agent-conversation/model.js";
import {
  discussionEdit,
  discussionDeletion,
} from "../community-agent-conversation/message-actions.js";
import { threadTranscriptMessages } from "./thread-transcript-messages.js";
import type { NostrEvent } from "../../protocol/index.js";

it("merges feedback once in causal order and projects edits, deletions and valid follow-ups", () => {
  const f = transcriptCommentFixture(true);
  const comment = f.sign(
    createTranscriptComment(
      f.events,
      { checkpointEventId: f.checkpoint.id, recordId: "record-2" },
      "Original",
    ),
  );
  const reply = f.sign({
    kind: 1111,
    created_at: comment.created_at,
    content: "Follow-up",
    tags: [
      ...comment.tags.filter(([key]) => !["e", "k", "p"].includes(key!)),
      ["e", comment.id],
      ["k", "1111"],
      ["p", comment.pubkey],
    ],
  });
  const forged = f.sign({
    ...comment,
    content: "Forged",
    tags: comment.tags.map((tag) =>
      tag[0] === "thread" ? ["thread", "f".repeat(64)] : tag,
    ),
  });
  const edited = f.sign(discussionEdit(comment, f.owner, "Edited"));
  const events = [...f.events, reply, comment, forged, edited];
  const project = (all: NostrEvent[]) => ({
    transcriptComments: visibleEvents(all).flatMap((event) => {
      const target = resolveTranscriptComment(event, all);
      return target ? [{ event, target }] : [];
    }),
    message: (id: string) => {
      const event = visibleEvents(all).find((event) => event.id === id);
      return event ? conversationMessage(event, all) : undefined;
    },
  });
  const incoming = [f.root, reply, forged, comment].map((event) =>
    conversationMessage(event, events),
  );
  expect(
    threadTranscriptMessages(incoming, undefined, f.root.id, "general").map(
      (item) => item.id,
    ),
  ).toEqual([f.root.id]);
  const rows = threadTranscriptMessages(
    incoming,
    project(events),
    f.root.id,
    "general",
  );
  expect(rows.map((item) => item.id)).toEqual([
    f.root.id,
    comment.id,
    reply.id,
  ]);
  expect(rows[1]?.content).toBe("Edited");
  const deleted = [...events, f.sign(discussionDeletion(comment, f.owner))];
  expect(
    threadTranscriptMessages(
      incoming,
      project(deleted),
      f.root.id,
      "general",
    ).map((item) => item.id),
  ).toEqual([f.root.id, reply.id]);
  expect(
    threadTranscriptMessages(incoming, project(events), f.root.id, "other").map(
      (item) => item.id,
    ),
  ).toEqual([f.root.id]);
});
