import { expect, it } from "vitest";
import { transcriptCommentFixture } from "../../testing/transcript-comment-fixture.js";
import { transcriptCommentTarget } from "../../projects/transcript-comments.js";
import { durableDraftTarget } from "./transcript-comment-draft.js";
it("keeps live drafts unpublished until their exact text and thread are durable", () => {
  const f = transcriptCommentFixture();
  const target = transcriptCommentTarget(f.events, {
    checkpointEventId: f.checkpoint.id,
    recordId: "record-2",
  })!;
  const draft = {
    source: {
      key: "draft",
      displayId: "record-2",
      agentPubkey: f.agent,
      channelId: "general",
      threadRootId: f.root.id,
      record: target.record,
      parts: target.parts,
    },
    content: "Compare the licenses",
  };
  expect(
    durableDraftTarget(
      f.events.filter((event) => event.id !== f.checkpoint.id),
      draft,
    ),
  ).toBeUndefined();
  expect(durableDraftTarget(f.events, draft)?.anchor.recordId).toBe("record-2");
  expect(
    durableDraftTarget(f.events, {
      ...draft,
      source: { ...draft.source, threadRootId: "wrong" },
    }),
  ).toBeUndefined();
  expect(
    durableDraftTarget(f.events, {
      ...draft,
      source: { ...draft.source, parts: { text: "A partial live thought" } },
    }),
  ).toBeUndefined();
  expect(draft.content).toBe("Compare the licenses");
});

it("does not move a draft to a reused record id from another canonical turn", () => {
  const f = transcriptCommentFixture();
  const target = transcriptCommentTarget(f.events, {
    checkpointEventId: f.checkpoint.id,
    recordId: "record-2",
  })!;
  const canonical = JSON.parse(target.record.text!);
  canonical.turnId = "a-different-turn";
  const draft = {
    source: {
      key: "draft",
      displayId: "record-2",
      agentPubkey: f.agent,
      channelId: "general",
      threadRootId: f.root.id,
      record: { ...target.record, text: JSON.stringify(canonical) },
      parts: target.parts,
    },
    content: "Keep my original target",
  };
  expect(durableDraftTarget(f.events, draft)).toBeUndefined();
  expect(draft.content).toBe("Keep my original target");
});
