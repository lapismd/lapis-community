import { describe, expect, it } from "vitest";

import {
  communityCopiedMessageLink,
  communityCopiedMessageLinkFromMessages,
  communityCopiedProjectRouteLink,
  communityCopiedRoomLink,
} from "./community-copy-links.js";

const eventId = "c".repeat(64);
const rootId = "b".repeat(64);
const owner = "d".repeat(64);

describe("community copy links", () => {
  it("emits scheme URIs for messages, rooms, and project routes", () => {
    expect(
      communityCopiedMessageLink({
        roomId: "plugin-development",
        eventId,
        authorPubkey: owner,
        relayUrl: "wss://example.invalid",
      }),
    ).toBe(
      `lapis-community://message?channel=plugin-development&id=${eventId}`,
    );
    expect(communityCopiedRoomLink({ roomId: "general" })).toBe(
      "lapis-community://channel/general",
    );
    expect(
      communityCopiedProjectRouteLink({
        kind: "repository",
        coordinate: `30617:${owner}:notes`,
        surface: "oplog",
        commitSha: "a".repeat(40),
      }),
    ).toBe(
      `lapis-community://repo?owner=${owner}&d=notes&tab=oplog&commit=${"a".repeat(40)}`,
    );
  });

  it("includes thread= when the copied message is a reply", () => {
    expect(
      communityCopiedMessageLinkFromMessages({
        roomKind: "channel",
        roomId: "general",
        messageId: eventId,
        relayUrl: "wss://example.invalid",
        messages: [
          { id: rootId, authorId: owner },
          { id: eventId, authorId: owner, parentMessageId: rootId },
        ],
      }),
    ).toBe(
      `lapis-community://message?channel=general&id=${eventId}&thread=${rootId}`,
    );
  });

  it("lets a host builder override the default scheme", () => {
    expect(
      communityCopiedMessageLink({
        roomId: "general",
        eventId,
        authorPubkey: owner,
        relayUrl: "wss://example.invalid",
        linkBuilder: {
          message: () => "custom://message",
        },
      }),
    ).toBe("custom://message");
  });
});
