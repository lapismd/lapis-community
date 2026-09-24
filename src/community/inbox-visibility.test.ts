import { describe, expect, it } from "vitest";
import type { CommunityPrivateEvent, CommunityScope } from "./contracts.js";
import { conversationKey } from "./conversations.js";
import { materializeCommunityInbox } from "./materialize-inbox.js";

const owner = "1".repeat(64);
const peers = ["2", "3", "4"].map((value) => value.repeat(64));
const scope: CommunityScope = {
  id: "inbox",
  name: "Inbox",
  relayUrl: "memory://inbox",
  rooms: [],
};
const keys = peers.map((peer) =>
  conversationKey({ transport: "nip17", participants: [owner, peer] }),
);
const events: CommunityPrivateEvent[] = peers.map((peer, index) => ({
  id: `message-${index}`,
  pubkey: peer,
  kind: 14,
  created_at: index + 1,
  content: `Conversation ${index}`,
  tags: [["p", owner]],
  wrapId: `wrap-${index}`,
  recipientPubkey: owner,
}));
const read = {
  [keys[0]!]: {
    createdAt: 1,
    eventId: "message-0",
    granularity: "room" as const,
  },
  [keys[2]!]: {
    createdAt: 3,
    eventId: "message-2",
    granularity: "room" as const,
  },
};

function project(activeItemId: string, unreadOnly = true, incoming = events) {
  return materializeCommunityInbox([scope], {}, owner, 10, {
    activeItemId,
    unreadOnly,
    itemLimit: 50,
    privateEventsByScope: { inbox: incoming },
    readMarkersByScope: { inbox: read },
  })!;
}

describe("Inbox read-row lifecycle", () => {
  it("keeps read history in the default All view", () => {
    expect(project(keys[0]!, false).items).toHaveLength(3);
  });

  it("keeps the selected read row until navigation, without retaining other read rows", () => {
    const selected = project(keys[0]!);
    expect(selected.items.map((item) => item.id)).toEqual([keys[1], keys[0]]);
    expect(selected.items.find((item) => item.id === keys[0])?.unread).toBe(
      false,
    );
    expect(selected.unreadCount).toBe(1);
    expect(project(keys[1]!).items.map((item) => item.id)).toEqual([keys[1]]);
  });

  it("restores a hidden conversation when a newer incoming message arrives", () => {
    const incoming = [
      ...events,
      { ...events[0]!, id: "new-reply", created_at: 4 },
    ];
    const result = project(keys[1]!, true, incoming);
    expect(result.items.map((item) => item.id)).toEqual([keys[0], keys[1]]);
    expect(result.items[0]).toMatchObject({
      unread: true,
      latestEventId: "new-reply",
    });
    expect(result.activeItemId).toBe(keys[1]);
  });

  it("does not retain the selected row in a different category", () => {
    const result = materializeCommunityInbox([scope], {}, owner, 10, {
      activeItemId: keys[0]!,
      filter: "Threads",
      unreadOnly: true,
      itemLimit: 50,
      privateEventsByScope: { inbox: events },
      readMarkersByScope: { inbox: read },
    })!;
    expect(result.items).toEqual([]);
    expect(result.selectedItem?.id).toBe(keys[0]);
    expect(result.messages).toHaveLength(1);
  });
});
