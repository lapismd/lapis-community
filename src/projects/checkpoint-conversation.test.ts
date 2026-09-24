import { expect, it } from "vitest";
import { transcriptCommentFixture } from "../testing/transcript-comment-fixture.js";
import {
  CheckpointConversationIndex,
  verifiedCheckpointSnapshot,
} from "./checkpoint-conversation.js";
import {
  createTranscriptComment,
  resolveTranscriptComment,
} from "./transcript-comments.js";
it("keeps verified evidence immutable when a previously verified caller event changes", () => {
  const f = transcriptCommentFixture(true);
  const index = new CheckpointConversationIndex(f.events);
  const anchor = { checkpointEventId: f.checkpoint.id, recordId: "record-2" };
  const comment = f.sign(createTranscriptComment(index, anchor, "Review this"));
  const before = resolveTranscriptComment(comment, index);
  f.checkpoint.tags.find(([key]) => key === "h")![1] = "another-channel";
  f.request.content = "Changed after signing";
  expect(verifiedCheckpointSnapshot(f.checkpoint)).toBeUndefined();
  expect(verifiedCheckpointSnapshot(f.request)).toBeUndefined();
  expect(resolveTranscriptComment(comment, f.events)).toBeUndefined();
  expect(resolveTranscriptComment(comment, index)).toEqual(before);
  expect(Object.isFrozen(index.byId.get(f.checkpoint.id)?.tags[0])).toBe(true);
});
it("projects duplicate and reordered replay against the same signed target", () => {
  const f = transcriptCommentFixture(true);
  const anchor = { checkpointEventId: f.checkpoint.id, recordId: "record-2" };
  const comment = f.sign(
    createTranscriptComment(f.events, anchor, "Review this"),
  );
  const once = resolveTranscriptComment(
    comment,
    new CheckpointConversationIndex(f.events),
  );
  expect(
    resolveTranscriptComment(
      comment,
      new CheckpointConversationIndex([...f.events, ...f.events].reverse()),
    ),
  ).toEqual(once);
});
