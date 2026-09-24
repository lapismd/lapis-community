import { expect, it } from "vitest";
import { transcriptCommentFixture } from "../testing/transcript-comment-fixture.js";
import {
  createTranscriptComment,
  resolveTranscriptComment,
  transcriptCommentTarget,
} from "./transcript-comments.js";
import { makeTranscriptSelection } from "../protocol/transcript-comment-anchor.js";
it.each(["record-1", "record-2", "record-3", "record-4", "record-5"])(
  "anchors %s to a signed durable record and original thread",
  (recordId) => {
    const f = transcriptCommentFixture(true),
      anchor = { checkpointEventId: f.checkpoint.id, recordId };
    const template = createTranscriptComment(
      f.events,
      anchor,
      "Please revise this",
    );
    expect(template.kind).toBe(1111);
    expect(template.tags).toEqual(
      expect.arrayContaining([
        ["E", f.checkpoint.id],
        ["K", "3907"],
        ["P", f.agent],
        ["record", recordId],
        ["thread", f.root.id],
        ["request", f.request.id],
        ["t", "transcript-comment"],
      ]),
    );
    expect(resolveTranscriptComment(f.sign(template), f.events)).toMatchObject({
      rootId: f.root.id,
      checkpoint: { repositoryAddress: f.repository, authorPubkey: f.agent },
    });
  },
);
it("retains UTF-16 selection and contextual quotes for thinking", () => {
  const f = transcriptCommentFixture(),
    anchor = {
      checkpointEventId: f.checkpoint.id,
      recordId: "record-2",
      part: "text" as const,
    };
  const target = transcriptCommentTarget(f.events, anchor)!;
  const selection = makeTranscriptSelection(target.parts.text!, 8, 18)!;
  const template = createTranscriptComment(
    f.events,
    { ...anchor, selection },
    "Check this comparison",
  );
  expect(
    resolveTranscriptComment(f.sign(template), f.events)?.anchor.selection,
  ).toEqual(selection);
  expect(() =>
    createTranscriptComment(
      f.events,
      { ...anchor, selection: { ...selection, exact: "other text" } },
      "Comment",
    ),
  ).toThrow();
});
it("validates plan steps and canonical formatted tool input", () => {
  const f = transcriptCommentFixture();
  const tool = transcriptCommentTarget(f.events, {
    checkpointEventId: f.checkpoint.id,
    recordId: "record-4",
  })!;
  expect(tool.parts.input).toBe('{\n  "path": "README.md"\n}');
  expect(() =>
    createTranscriptComment(
      f.events,
      {
        checkpointEventId: f.checkpoint.id,
        recordId: "record-3",
        part: "plan:1",
      },
      "Reorder this",
    ),
  ).not.toThrow();
  expect(() =>
    createTranscriptComment(
      f.events,
      {
        checkpointEventId: f.checkpoint.id,
        recordId: "record-3",
        part: "plan:8",
      },
      "Reorder this",
    ),
  ).toThrow();
});
it("rejects claimed thread, repository, author, channel, duplicate identity and missing-page targets", () => {
  const f = transcriptCommentFixture(true),
    anchor = { checkpointEventId: f.checkpoint.id, recordId: "record-2" };
  const template = createTranscriptComment(f.events, anchor, "Comment");
  for (const key of ["thread", "a", "P", "h", "request"]) {
    const changed = {
      ...template,
      tags: template.tags.map((tag) => (tag[0] === key ? [key, "wrong"] : tag)),
    };
    expect(resolveTranscriptComment(f.sign(changed), f.events)).toBeUndefined();
  }
  expect(
    resolveTranscriptComment(
      f.sign({ ...template, tags: [...template.tags, ["record", "record-1"]] }),
      f.events,
    ),
  ).toBeUndefined();
  expect(
    transcriptCommentTarget(
      f.events.filter((e) => e.id !== f.pages[2]!.id),
      anchor,
    ),
  ).toBeUndefined();
  expect(
    transcriptCommentTarget(
      f.events.filter((e) => e.id !== f.root.id),
      anchor,
    ),
  ).toBeUndefined();
  const forged = JSON.parse(JSON.stringify(f.checkpoint));
  forged.content += " ";
  expect(
    transcriptCommentTarget(
      f.events.map((e) => (e.id === f.checkpoint.id ? forged : e)),
      anchor,
    ),
  ).toBeUndefined();
});
it("does not publish comments against user prompts or non-provider activity", () => {
  const f = transcriptCommentFixture();
  expect(() =>
    createTranscriptComment(
      f.events,
      { checkpointEventId: f.checkpoint.id, recordId: "record-0" },
      "Comment",
    ),
  ).toThrow();
});
it("rejects empty, oversized and split-surrogate selections", () => {
  expect(makeTranscriptSelection("🧭 test", 1, 2)).toBeUndefined();
  expect(makeTranscriptSelection("🧭 test", 0, 1)).toBeUndefined();
  expect(makeTranscriptSelection("text", 2, 2)).toBeUndefined();
  expect(makeTranscriptSelection("x".repeat(5000), 0, 4097)).toBeUndefined();
  expect(makeTranscriptSelection("🧭 test", 0, 2)?.exact).toBe("🧭");
});
