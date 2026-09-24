import { expect, it } from "vitest";
import { transcriptCommentFixture } from "../testing/transcript-comment-fixture.js";
import {
  transcriptReactions,
  transcriptReactionTarget,
  toggleTranscriptReaction,
} from "./transcript-reactions.js";

it("isolates reactions by checkpoint, record and plan step, with author-owned toggles", () => {
  const f = transcriptCommentFixture();
  const first = {
    checkpointEventId: f.checkpoint.id,
    recordId: "record-3",
    part: "plan:0" as const,
  };
  const second = { ...first, part: "plan:1" as const };
  const a = f.sign(toggleTranscriptReaction(f.events, first, f.owner, "👍"));
  const b = f.sign(toggleTranscriptReaction(f.events, second, f.owner, "👍"));
  const events = [...f.events, a, b];
  expect(transcriptReactions(events, first, f.owner).groups).toEqual([
    { emoji: "👍", count: 1, selected: true },
  ]);
  const deletion = f.sign(
    toggleTranscriptReaction(events, first, f.owner, "👍"),
  );
  expect(deletion.kind).toBe(5);
  expect(deletion.tags).toContainEqual(["e", a.id]);
  expect(deletion.tags).not.toContainEqual(["e", b.id]);
  expect(
    transcriptReactions([...events, deletion], first, f.owner).groups,
  ).toEqual([]);
  expect(
    transcriptReactions([...events, deletion], second, f.owner).groups[0]
      ?.count,
  ).toBe(1);
  expect(
    transcriptReactions(
      events,
      { checkpointEventId: first.checkpointEventId, recordId: "record-4" },
      f.owner,
    ).groups,
  ).toEqual([]);
});
it("rejects unsigned, forged conversation, duplicate and missing record targets", () => {
  const f = transcriptCommentFixture();
  const anchor = { checkpointEventId: f.checkpoint.id, recordId: "record-4" };
  const template = toggleTranscriptReaction(f.events, anchor, f.owner, "👍");
  expect(transcriptReactionTarget(f.sign(template), f.events)?.anchor).toEqual(
    anchor,
  );
  expect(
    transcriptReactionTarget({ ...f.sign(template), content: "bad" }, f.events),
  ).toBeUndefined();
  for (const tags of [
    template.tags.map((tag) =>
      tag[0] === "thread" ? ["thread", "f".repeat(64)] : tag,
    ),
    [...template.tags, ["record", "record-5"]],
    template.tags.filter(([key]) => key !== "record"),
    [...template.tags, ["part", "output"]],
  ])
    expect(
      transcriptReactionTarget(f.sign({ ...template, tags }), f.events),
    ).toBeUndefined();
});

it("retains custom emoji metadata when toggling another author's reaction", () => {
  const f = transcriptCommentFixture();
  const anchor = { checkpointEventId: f.checkpoint.id, recordId: "record-4" };
  const custom = { shortcode: "lapis", url: "https://example.com/lapis.png" };
  const reaction = f.sign(
    toggleTranscriptReaction(f.events, anchor, f.agent, ":lapis:", custom),
    true,
  );
  const own = toggleTranscriptReaction(
    [...f.events, reaction],
    anchor,
    f.owner,
    ":lapis:",
  );
  expect(own.content).toBe(":lapis:");
  expect(own.tags).toContainEqual(["emoji", "lapis", custom.url]);
});
