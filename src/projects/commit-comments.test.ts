import { describe, expect, it } from "vitest";
import { createCommitComment, commitComments } from "./commit-comments.js";
import { conversationMessage } from "../components/community-agent-conversation/model.js";
import { buildRepositoryAgentContexts } from "./repository-agent-context.js";
import {
  repositoryContextEvents,
  contextFixture as f,
} from "../testing/repository-context-fixture.js";

describe("commit discussion anchors", () => {
  it("retains the immutable commit and diff side and rejects invalid paths", () => {
    const cp = buildRepositoryAgentContexts(repositoryContextEvents())[0]!;
    cp.records[0]!.sourceEventId = "a".repeat(64);
    const input = createCommitComment(
      cp,
      f.commit,
      "a".repeat(64),
      "Please clarify this line",
      {
        base: "b".repeat(40),
        anchor: { path: "README", side: "new", line: 3 },
      },
    );
    expect(input.kind).toBe(1111);
    expect(input.tags).toEqual(
      expect.arrayContaining([
        ["E", cp.eventId],
        ["K", "3907"],
        ["P", cp.authorPubkey],
        ["e", cp.eventId],
        ["k", "3907"],
        ["c", f.commit],
        ["base", "b".repeat(40)],
        ["file", "README"],
        ["side", "new"],
        ["line", "3"],
      ]),
    );
    const event = { ...input, id: "review", pubkey: "owner", sig: "test" };
    expect(
      commitComments([event], [cp.eventId], f.commit, {
        path: "README",
        side: "old",
        line: 3,
      }),
    ).toEqual([]);
    expect(
      commitComments([event], [cp.eventId], f.commit, {
        path: "README",
        side: "new",
        line: 3,
      }),
    ).toEqual([event]);
    expect(() =>
      createCommitComment(cp, f.commit, "a".repeat(64), "comment", {
        anchor: { path: "../secret", side: "new", line: 1 },
      }),
    ).toThrow("Invalid diff location");
    expect(() =>
      createCommitComment(cp, "unrelated", "a".repeat(64), "comment"),
    ).toThrow();
  });
  it("shares reaction and reply state by real message id and honors author deletions", () => {
    const msg = {
      id: "message",
      pubkey: "agent",
      kind: 9,
      created_at: 1,
      content: "Done",
      tags: [["h", "room"]],
      sig: "test",
    };
    const reaction = {
      ...msg,
      id: "reaction",
      pubkey: "owner",
      kind: 7,
      content: "👍",
      tags: [["e", "message"]],
    };
    const reply = {
      ...msg,
      id: "reply",
      pubkey: "owner",
      tags: [["e", "message", "", "reply"]],
    };
    const otherDeletion = {
      ...msg,
      id: "del",
      pubkey: "stranger",
      kind: 5,
      tags: [["e", "reaction"]],
    };
    expect(
      conversationMessage(msg, [msg, reaction, reply, otherDeletion], "owner"),
    ).toMatchObject({
      replyCount: 1,
      reactions: [{ emoji: "👍", count: 1, selected: true }],
    });
    expect(
      conversationMessage(
        msg,
        [msg, reaction, { ...otherDeletion, pubkey: "owner" }],
        "owner",
      ).reactions,
    ).toEqual([]);
  });
});
