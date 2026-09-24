import { expect, it } from "vitest";
import { transcriptCommentFixture } from "../testing/transcript-comment-fixture.js";
import {
  createTranscriptComment,
  resolveTranscriptComment,
} from "./transcript-comments.js";
it("keeps follow-ups on the verified item and rejects a forged immediate parent", () => {
  const f = transcriptCommentFixture();
  const comment = f.sign(
    createTranscriptComment(
      f.events,
      { checkpointEventId: f.checkpoint.id, recordId: "record-2" },
      "Check this",
    ),
  );
  const reply = {
    kind: 1111,
    created_at: comment.created_at + 1,
    content: "Agreed",
    tags: [
      ...comment.tags.filter(([key]) => !["e", "k", "p"].includes(key!)),
      ["e", comment.id],
      ["k", "1111"],
      ["p", comment.pubkey],
    ],
  };
  expect(
    resolveTranscriptComment(f.sign(reply), [...f.events, comment])?.record.id,
  ).toBe("record-2");
  expect(resolveTranscriptComment(f.sign(reply), f.events)).toBeUndefined();
  for (const [key, value] of [
    ["record", "record-3"],
    ["e", f.root.id],
    ["p", f.agent],
  ]) {
    const forged = f.sign({
      ...reply,
      tags: reply.tags.map((tag) => (tag[0] === key ? [key!, value!] : tag)),
    });
    expect(
      resolveTranscriptComment(forged, [...f.events, comment]),
    ).toBeUndefined();
  }
});

it("rejects a follow-up whose signed parent has ambiguous optional anchors", () => {
  const f = transcriptCommentFixture();
  const base = createTranscriptComment(
    f.events,
    { checkpointEventId: f.checkpoint.id, recordId: "record-2" },
    "Parent",
  );
  const parent = f.sign({
    ...base,
    tags: [...base.tags, ["part", "text"], ["part", "text"]],
  });
  const reply = f.sign({
    ...base,
    content: "Follow-up",
    tags: [
      ...base.tags.filter(([key]) => !["e", "k", "p"].includes(key!)),
      ["e", parent.id],
      ["k", "1111"],
      ["p", parent.pubkey],
    ],
  });
  expect(
    resolveTranscriptComment(parent, [...f.events, parent]),
  ).toBeUndefined();
  expect(
    resolveTranscriptComment(reply, [...f.events, parent]),
  ).toBeUndefined();
});
