import { describe, expect, it } from "vitest";
import { finalizeEvent, generateSecretKey } from "nostr-tools/pure";

import {
  createNip29ForumCommentTemplate,
  createNip29ForumThreadTemplate,
} from "../../protocol/index.js";

import {
  anyRelayPublished,
  avatarHue,
  displayName,
  initials,
  isValidNativeEmojiReaction,
  latestReactionByAuthor,
  materializeNip29Forum,
  materializeNip29Reactions,
  parseProfiles,
  parseRelayUrls,
  reactionGroups,
  seekTimestampForCount,
  shouldShowTimelineBack,
  timelineIndexFromPosition,
  timelineMarkersOverlap,
  timelinePosition,
  timelineTimestamp,
} from "./model.js";

describe("registry community model", () => {
  it("accepts unique WebSocket relay URLs and rejects other input", () => {
    expect(
      parseRelayUrls(
        JSON.stringify([
          "ws://localhost:8381",
          "ws://localhost:8381/",
          "wss://relay.example/nostr",
          "https://relay.example",
          42,
        ]),
      ),
    ).toEqual(["ws://localhost:8381/", "wss://relay.example/nostr"]);
    expect(parseRelayUrls("not json")).toEqual([]);
  });

  it("requires at least one relay acknowledgement", () => {
    expect(
      anyRelayPublished([
        { status: "rejected", reason: new Error("offline") },
        { status: "fulfilled", value: undefined },
      ]),
    ).toBe(true);
    expect(
      anyRelayPublished([{ status: "rejected", reason: new Error("offline") }]),
    ).toBe(false);
  });

  it("accepts one native emoji grapheme for registry reactions", () => {
    expect(isValidNativeEmojiReaction("🤣")).toBe(true);
    expect(isValidNativeEmojiReaction("❤️")).toBe(true);
    expect(isValidNativeEmojiReaction("🏳️‍🌈")).toBe(true);
    expect(isValidNativeEmojiReaction("🇬🇧")).toBe(true);
    expect(isValidNativeEmojiReaction("")).toBe(false);
    expect(isValidNativeEmojiReaction("👍🎉")).toBe(false);
    expect(isValidNativeEmojiReaction("reaction")).toBe(false);
  });

  it("projects current Nostr profiles with safe fallbacks", () => {
    const pubkey = "ab".repeat(32);
    const event = (createdAt: number, content: string, id: string) => ({
      id,
      pubkey,
      sig: "cd".repeat(32),
      kind: 0,
      created_at: createdAt,
      tags: [],
      content,
    });
    const profiles = parseProfiles([
      event(1, JSON.stringify({ name: "older" }), "01".repeat(32)),
      event(
        2,
        JSON.stringify({
          name: "maya",
          display_name: "Maya Chen",
          picture: "https://example.test/maya.png",
          about: "Builds local-first tools.",
        }),
        "02".repeat(32),
      ),
      event(3, "not json", "03".repeat(32)),
    ]);
    const byPubkey = new Map(
      profiles.map((profile) => [profile.pubkey, profile]),
    );

    expect(displayName(pubkey, byPubkey)).toBe("Maya Chen");
    expect(byPubkey.get(pubkey)).toMatchObject({
      picture: "https://example.test/maya.png",
      about: "Builds local-first tools.",
    });
    expect(displayName("ef".repeat(32), byPubkey)).toBe("nostr:efefef…efef");
    expect(initials("Maya Chen")).toBe("MC");
    expect(avatarHue(pubkey)).toBeGreaterThanOrEqual(0);
  });

  it("groups reactions and positions posts on the history rail", () => {
    const targetEventId = "01".repeat(32);
    const reaction = (content: string, id: string) => ({
      event: {
        id,
        pubkey: "ab".repeat(32),
        sig: "cd".repeat(32),
        kind: 7,
        created_at: 1,
        tags: [],
        content,
      },
      pluginId: "ai",
      targetEventId,
      content,
    });

    expect(
      reactionGroups(targetEventId, [
        reaction("+", "11".repeat(32)),
        reaction("+", "12".repeat(32)),
        reaction("💡", "13".repeat(32)),
      ]),
    ).toEqual([
      { content: "+", symbol: "❤", count: 2 },
      { content: "💡", symbol: "💡", count: 1 },
    ]);
    expect(timelinePosition(0, 24)).toBe(0);
    expect(timelinePosition(23, 24)).toBe(100);
    expect(timelineIndexFromPosition(25, 300, 24)).toBe(0);
    expect(timelineIndexFromPosition(150, 300, 24)).toBe(12);
    expect(timelineIndexFromPosition(275, 300, 24)).toBe(23);
    expect(timelineIndexFromPosition(-100, 300, 24)).toBe(0);
    expect(timelineIndexFromPosition(1_000, 300, 24)).toBe(23);
    expect(shouldShowTimelineBack(0, 4, 24)).toBe(true);
    expect(shouldShowTimelineBack(1, 4, 24)).toBe(false);
    expect(shouldShowTimelineBack(0, 22, 24)).toBe(false);
    expect(timelineMarkersOverlap(8, 9, 24, 300)).toBe(true);
    expect(timelineMarkersOverlap(0, 20, 24, 300)).toBe(false);
  });

  it("materializes signed NIP-29 forum roots, nested replies, and reactions", () => {
    const author = generateSecretKey();
    const reactor = generateSecretKey();
    const groupId = "36c6a816-9330-581a-86fd-9a8d8091c39d";
    const root = finalizeEvent(
      createNip29ForumThreadTemplate(groupId, "Root", 10),
      author,
    );
    const direct = finalizeEvent(
      createNip29ForumCommentTemplate(groupId, root, root, "Direct", 11),
      author,
    );
    const nested = finalizeEvent(
      createNip29ForumCommentTemplate(groupId, root, direct, "Nested", 12),
      reactor,
    );
    const reaction = finalizeEvent(
      {
        kind: 7,
        created_at: 13,
        content: "👍",
        tags: [["e", nested.id]],
      },
      author,
    );

    expect(
      materializeNip29Forum([nested, root, direct], groupId),
    ).toMatchObject([
      { content: "Root", rootEventId: root.id },
      { content: "Direct", rootEventId: root.id, parentEventId: root.id },
      { content: "Nested", rootEventId: root.id, parentEventId: direct.id },
    ]);
    const reactions = materializeNip29Reactions(
      [reaction],
      new Set([nested.id]),
    );
    expect(reactions).toHaveLength(1);
    expect(latestReactionByAuthor(reactions, nested.id)[0]?.content).toBe("👍");
  });

  it("seeks a page boundary with relay counts instead of loading prior posts", async () => {
    const timestamps = [100, 200, 300, 400, 500];
    const result = await seekTimestampForCount(
      3,
      500,
      timestamps.length,
      async (until) =>
        timestamps.filter((timestamp) => timestamp <= until).length,
    );

    expect(result.timestamp).toBe(300);
    expect(result.count).toBe(3);
    expect(result.probes).toBeLessThanOrEqual(9);
    expect(timelineTimestamp(2, 5, 100, 500)).toBe(300);
  });
});
