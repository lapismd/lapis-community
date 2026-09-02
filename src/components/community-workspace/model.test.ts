import { describe, expect, it } from "vitest";

import { findCommunityRoom, memberById } from "./model.js";
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
});
