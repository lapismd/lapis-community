import { describe, expect, it } from "vitest";

import {
  findCommunityRoom,
  memberById,
  rootCommunityMessageId,
} from "./model.js";
import { createForumIndexStoryModel } from "./story-fixtures.js";

describe("community presentation models", () => {
  it("resolves the active room across normalized navigation sections", () => {
    const model = createForumIndexStoryModel();

    expect(findCommunityRoom(model)).toMatchObject({
      id: "support-ai",
      kind: "forum",
    });
  });

  it("returns an inert display identity for an unknown member", () => {
    expect(memberById([], "f".repeat(64))).toEqual({
      id: "f".repeat(64),
      name: "Unknown member",
      handle: "f".repeat(12),
      initials: "?",
      presence: "offline",
    });
  });

  it("resolves nested replies to the visible conversation root", () => {
    expect(
      rootCommunityMessageId(
        [
          { id: "root", authorId: "ada", content: "Root", timestamp: "1" },
          {
            id: "reply",
            authorId: "ben",
            content: "Reply",
            timestamp: "2",
            parentMessageId: "root",
          },
          {
            id: "nested",
            authorId: "cy",
            content: "Nested",
            timestamp: "3",
            parentMessageId: "reply",
          },
        ],
        "nested",
      ),
    ).toBe("root");
  });
});
