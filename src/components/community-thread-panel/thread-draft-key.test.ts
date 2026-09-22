import { describe, expect, it } from "vitest";

import {
  communityThreadComposerDraftKey,
  threadComposerRoomId,
} from "./thread-draft-key.js";

describe("communityThreadComposerDraftKey", () => {
  it("includes room and root in the target", () => {
    const withRoom = communityThreadComposerDraftKey({
      viewer: "ada",
      communityId: "lapis",
      roomId: "general",
      rootMessageId: "root-1",
    });
    const otherRoom = communityThreadComposerDraftKey({
      viewer: "ada",
      communityId: "lapis",
      roomId: "random",
      rootMessageId: "root-1",
    });
    const otherRoot = communityThreadComposerDraftKey({
      viewer: "ada",
      communityId: "lapis",
      roomId: "general",
      rootMessageId: "root-2",
    });
    expect(withRoom).not.toBe(otherRoom);
    expect(withRoom).not.toBe(otherRoot);
    expect(withRoom).toContain("thread");
    expect(withRoom).not.toMatch(/wss:\/\//);
  });

  it("falls back to the root when no room is present", () => {
    expect(
      communityThreadComposerDraftKey({
        viewer: "ada",
        rootMessageId: "root-1",
      }),
    ).toBe(
      JSON.stringify(["community-composer", "ada", "", "thread", "root-1"]),
    );
  });
});

describe("threadComposerRoomId", () => {
  it("prefers the reply room, then the host tag, then the first room", () => {
    const rooms = [
      { id: "general", name: "general", kind: "channel" as const },
      {
        id: "support",
        groupId: "h-support",
        name: "support",
        kind: "forum" as const,
      },
    ];
    expect(threadComposerRoomId(rooms, undefined, "support")).toBe("support");
    expect(
      threadComposerRoomId(rooms, {
        id: "root-1",
        authorId: "ada",
        content: "topic",
        timestamp: "now",
        sourceEvent: {
          id: "root-1",
          pubkey: "ada",
          created_at: 1,
          kind: 11,
          tags: [["h", "h-support"]],
          content: "topic",
          sig: "sig",
        },
      }),
    ).toBe("support");
    expect(threadComposerRoomId(rooms)).toBe("general");
  });
});
