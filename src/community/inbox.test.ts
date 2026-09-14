import { observerScope, activityMatches } from "./agent-activity-context.js";
import { describe, it, expect } from "vitest";
import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import { npubEncode } from "nostr-tools/nip19";
import {
  materializeCommunityInbox,
  materializeCommunityWorkspace,
} from "./materialize.js";
import {
  conversationKey,
  conversationHash,
  privateConversation,
} from "./conversations.js";
import type { CommunityPrivateEvent, CommunityScope } from "./contracts.js";
const ownerKey = new Uint8Array(32).fill(71),
  peerKey = new Uint8Array(32).fill(72),
  thirdKey = new Uint8Array(32).fill(73);
const owner = getPublicKey(ownerKey),
  peer = getPublicKey(peerKey),
  third = getPublicKey(thirdKey);
const scope: CommunityScope = {
  id: "test",
  name: "Test",
  relayUrl: "memory://test",
  rooms: [
    { id: "general", groupId: "general", name: "General", kind: "channel" },
  ],
};
function message(
  id: string,
  author = peer,
  participants = [owner, peer],
  time = 10,
  kind: 5 | 7 | 14 = 14,
  tags: string[][] = [],
): CommunityPrivateEvent {
  return {
    id,
    pubkey: author,
    created_at: time,
    kind,
    content: id,
    tags: [
      ...participants.filter((key) => key !== author).map((key) => ["p", key]),
      ...tags,
    ],
    wrapId: "wrap" + id,
    recipientPubkey: owner,
  };
}
function note(
  key: Uint8Array,
  time: number,
  content: string,
  tags: string[][] = [],
) {
  return finalizeEvent(
    { kind: 9, created_at: time, content, tags: [["h", "general"], ...tags] },
    key,
  );
}
describe("conversation Inbox", () => {
  it("isolates transports and participant sets, ignores controls and self messages, and shares read cursors", () => {
    const first = message("first"),
      second = message("second", peer, [owner, peer], 11),
      group = message("group", peer, [owner, peer, third], 12);
    const sent = message("self", owner, [owner, peer], 13),
      control = message("reaction", peer, [owner, peer], 14, 7);
    const events = [first, second, group, sent, control];
    const key = conversationKey(privateConversation(first));
    expect(key).not.toBe(
      conversationKey({
        transport: "buzz-dm",
        relayUrl: scope.relayUrl,
        groupId: "same",
      }),
    );
    const cursors = {
      [key]: { createdAt: 11, eventId: "second", granularity: "room" as const },
    };
    const result = materializeCommunityInbox([scope], {}, owner, 20, {
      privateEventsByScope: { test: events },
      readMarkersByScope: { test: cursors },
      activeItemId: key,
    });
    expect(result?.items).toHaveLength(2);
    expect(result?.activeItemId).toBe(key);
    expect(result?.items.find((item) => item.id === key)).toMatchObject({
      unread: false,
      excerpt: "second",
      categories: ["Direct messages"],
    });
    expect(result?.unreadCount).toBe(1);
    const workspace = materializeCommunityWorkspace([scope], {}, "test", {
      identityPubkey: owner,
      privateEvents: events,
      readMarkers: cursors,
    });
    expect(
      workspace.navigationSections
        .find((section) => section.id === "direct-messages")
        ?.rooms.find((room) => room.id === `dm:${peer}`)?.unreadCount,
    ).toBe(0);
    const newest = message("newest", peer, [owner, peer, third], 30);
    expect(
      materializeCommunityInbox([scope], {}, owner, 40, {
        privateEventsByScope: { test: [...events, newest] },
        activeItemId: key,
      })?.activeItemId,
    ).toBe(key);
  });
  it("includes replies to started or participated threads and content mentions, excluding unrelated replies", () => {
    const root = note(ownerKey, 1, "My thread"),
      otherRoot = note(peerKey, 2, "Another thread");
    const participation = note(ownerKey, 3, "Joined", [["e", otherRoot.id]]);
    const reply = note(peerKey, 4, "Reply without recipient tags", [
      ["e", root.id],
    ]);
    const later = note(thirdKey, 5, "Following up", [["e", otherRoot.id]]);
    const mention = note(peerKey, 6, `Hello nostr:${npubEncode(owner)}`);
    const unrelated = note(thirdKey, 7, "Unrelated", [["e", "f".repeat(64)]]);
    const result = materializeCommunityInbox(
      [scope],
      {
        test: [
          later,
          root,
          otherRoot,
          participation,
          reply,
          mention,
          unrelated,
        ],
      },
      owner,
    );
    expect(result?.items).toHaveLength(3);
    expect(
      result?.items.filter((item) => item.categories?.includes("Threads")),
    ).toHaveLength(2);
    expect(result?.items.some((item) => item.excerpt === "Unrelated")).toBe(
      false,
    );
  });
  it("does not allow another participant to delete a message or infer mentions from recipient tags", () => {
    const received = message("keep");
    const unauthorized = message("delete", third, [owner, peer, third], 20, 5, [
      ["e", "keep"],
    ]);
    const forgedSameConversation = message(
      "delete2",
      owner,
      [owner, peer],
      21,
      5,
      [["e", "keep"]],
    );
    const result = materializeCommunityInbox([scope], {}, owner, 30, {
      privateEventsByScope: {
        test: [received, unauthorized, forgedSameConversation],
      },
    });
    expect(result?.messages.map((message) => message.id)).toContain("keep");
    expect(result?.items[0]?.categories).toEqual(["Direct messages"]);
  });
});

it("merges encrypted history and read state across relay connections", () => {
  const secondScope = { ...scope, id: "second", relayUrl: "memory://second" };
  const first = message("first");
  const latest = message("latest", peer, [owner, peer], 11);
  const key = conversationKey(privateConversation(first));
  const inbox = materializeCommunityInbox([scope, secondScope], {}, owner, 20, {
    privateEventsByScope: { test: [first], second: [first, latest] },
    readMarkersByScope: {
      second: {
        [key]: { createdAt: 11, eventId: "latest", granularity: "room" },
      },
    },
  });
  expect(inbox?.items).toHaveLength(1);
  expect(inbox?.items[0]).toMatchObject({ excerpt: "latest", unread: false });
  expect(inbox?.messages.map((item) => item.id)).toEqual(["first", "latest"]);
});

it("keeps Buzz agent activity in its transport-specific private conversation", () => {
  const buzz = {
    transport: "buzz-dm" as const,
    relayUrl: scope.relayUrl,
    groupId: "dm-channel",
  };
  const hash = conversationHash(buzz);
  const observed = observerScope({
    version: 2,
    seq: 1,
    timestamp: "2026-09-14T00:00:00Z",
    kind: "turn_started",
    payload: {
      scopeKey: `${scope.relayUrl}/buzz-dm/dm-channel/agent`,
      conversationKind: "dm",
      conversationId: hash,
    },
  });
  expect(observed.conversationKind).toBe("dm");
  expect(activityMatches({ kind: "dm", conversationId: hash }, observed)).toBe(
    true,
  );
  expect(
    activityMatches(
      {
        kind: "dm",
        conversationId: conversationHash({
          transport: "nip17",
          participants: [owner, peer],
        }),
      },
      observed,
    ),
  ).toBe(false);
});
