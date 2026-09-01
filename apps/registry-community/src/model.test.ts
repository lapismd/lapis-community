import { describe, expect, it } from "vitest";

import {
  anyRelayPublished,
  avatarHue,
  commentPageWindow,
  displayName,
  initials,
  parseProfiles,
  parseRelayUrls,
  reactionGroups,
  seekTimestampForCount,
  timelineIndexFromPosition,
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
        JSON.stringify({ name: "maya", display_name: "Maya Chen" }),
        "02".repeat(32),
      ),
      event(3, "not json", "03".repeat(32)),
    ]);
    const byPubkey = new Map(
      profiles.map((profile) => [profile.pubkey, profile]),
    );

    expect(displayName(pubkey, byPubkey)).toBe("Maya Chen");
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
  });

  it("maps global timeline positions onto fixed-size relay windows", () => {
    expect(commentPageWindow(24, 0, 20)).toEqual({
      startIndex: 0,
      endIndex: 20,
      targetIndex: 0,
    });
    expect(commentPageWindow(24, 23, 20)).toEqual({
      startIndex: 20,
      endIndex: 24,
      targetIndex: 23,
    });
    expect(commentPageWindow(24, 2_000, 20).targetIndex).toBe(23);
    expect(commentPageWindow(0, 0, 20)).toEqual({
      startIndex: 0,
      endIndex: 0,
      targetIndex: 0,
    });
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
