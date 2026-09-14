import { describe, expect, it } from "vitest";
import {
  conversationKey,
  isUnreadInConversation,
  timelineReadKey,
  type CommunityConversationReference,
} from "./conversations.js";
import type { CommunityReadCursor } from "./contracts.js";

describe("canonical conversation read boundaries", () => {
  const room = {
    transport: "nip29",
    relayUrl: "wss://relay.test",
    groupId: "forum",
  } as const;
  const root = {
    id: "root",
    created_at: 10,
    pubkey: "member",
    kind: 11,
    tags: [["h", "forum"]],
  };
  const reply = {
    ...root,
    id: "reply",
    created_at: 11,
    kind: 1111,
    tags: [
      ["h", "forum"],
      ["E", root.id],
      ["e", "parent"],
    ],
  };
  const cursor: CommunityReadCursor = {
    createdAt: 20,
    eventId: "z",
    granularity: "message",
  };
  it("viewing the forum index acknowledges roots without acknowledging unseen replies", () => {
    const markers = { [timelineReadKey(room)]: cursor };
    expect(isUnreadInConversation(root, room, "room", "owner", markers)).toBe(
      false,
    );
    expect(isUnreadInConversation(reply, room, "room", "owner", markers)).toBe(
      true,
    );
    expect(
      isUnreadInConversation(reply, room, "room", "owner", {
        ...markers,
        [conversationKey({ ...room, threadId: root.id })]: {
          ...cursor,
          granularity: "thread",
        },
      }),
    ).toBe(false);
  });
  it("isolates read state by transport and preserves explicit legacy room-read actions", () => {
    const buzz: CommunityConversationReference = {
      ...room,
      transport: "buzz-dm",
    };
    expect(
      isUnreadInConversation(root, room, "room", "owner", {
        [conversationKey(buzz)]: cursor,
      }),
    ).toBe(true);
    expect(
      isUnreadInConversation(reply, room, "room", "owner", {
        room: { ...cursor, granularity: "room" },
      }),
    ).toBe(false);
  });
  it("excludes self authored messages, reactions and control events", () => {
    for (const event of [
      { ...root, pubkey: "owner" },
      { ...root, kind: 7 },
      { ...root, kind: 9000 },
      { ...root, kind: 40100 },
    ])
      expect(isUnreadInConversation(event, room, "room", "owner")).toBe(false);
  });
});
