import { expect, it } from "vitest";
import {
  buildCommunityMessageLink,
  parseCommunityEntityLink,
} from "../../community/community-links.js";
import { checkpointIndex } from "../../projects/checkpoint-conversation.js";
import { transcriptCommentFixture } from "../../testing/transcript-comment-fixture.js";
import { verifiedTranscriptLink } from "./transcript-navigation.js";
it("round-trips item links and validates their signed original conversation", () => {
  const f = transcriptCommentFixture(true);
  const href = buildCommunityMessageLink({
    roomId: "general",
    eventId: f.request.id,
    threadRootId: f.root.id,
    checkpoint: f.checkpoint.id,
    record: "record-3",
    part: "plan:1",
  });
  const link = parseCommunityEntityLink(href)!;
  expect(link.kind).toBe("message");
  if (link.kind !== "message") throw new Error("Expected message link");
  expect(
    verifiedTranscriptLink(link, checkpointIndex(f.events), "general")?.record
      .id,
  ).toBe("record-3");
  expect(
    verifiedTranscriptLink(
      { ...link, threadRootId: "f".repeat(64) },
      checkpointIndex(f.events),
      "general",
    ),
  ).toBeUndefined();
  expect(
    verifiedTranscriptLink(link, checkpointIndex(f.events), "private"),
  ).toBeUndefined();
  expect(
    verifiedTranscriptLink(
      { ...link, record: "record-2", part: "plan:1" },
      checkpointIndex(f.events),
      "general",
    ),
  ).toBeUndefined();
});
it("rejects partial or ambiguous transcript references while accepting ordinary links", () => {
  const base = buildCommunityMessageLink({
    roomId: "general",
    eventId: "a".repeat(64),
  });
  expect(parseCommunityEntityLink(base)).toEqual({
    kind: "message",
    roomId: "general",
    eventId: "a".repeat(64),
  });
  for (const suffix of [
    "&record=tool",
    `&checkpoint=${"b".repeat(64)}`,
    `&checkpoint=${"b".repeat(64)}&record=tool&record=other`,
    `&checkpoint=${"b".repeat(64)}&record=tool&part=invalid`,
  ])
    expect(parseCommunityEntityLink(base + suffix)).toBeUndefined();
});
