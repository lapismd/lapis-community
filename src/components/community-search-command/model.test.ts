import { finalizeEvent } from "nostr-tools/pure";
import { describe, expect, it } from "vitest";

import { projectCommunitySearchResults } from "./model.js";

describe("projectCommunitySearchResults", () => {
  it("keeps profile JSON out of messages and presents it as a person", () => {
    const profile = finalizeEvent(
      {
        kind: 0,
        created_at: 1_700_000_000,
        content: JSON.stringify({
          display_name: "Steve",
          name: "steve",
          about: "Building calm, portable communities",
          picture: "https://example.com/steve.png",
        }),
        tags: [],
      },
      new Uint8Array(32).fill(41),
    );
    const message = finalizeEvent(
      {
        kind: 9,
        created_at: 1_700_000_001,
        content: "Welcome to Lapis Community",
        tags: [["h", "general"]],
      },
      new Uint8Array(32).fill(42),
    );

    const projection = projectCommunitySearchResults([
      { event: profile, relayUrl: "memory://search" },
      { event: message, relayUrl: "memory://search" },
    ]);

    expect(projection.messages).toEqual([
      expect.objectContaining({
        id: message.id,
        content: "Welcome to Lapis Community",
        roomId: "general",
      }),
    ]);
    expect(projection.members).toEqual([
      expect.objectContaining({
        id: profile.pubkey,
        name: "Steve",
        avatarUrl: "https://example.com/steve.png",
      }),
    ]);
  });

  it("uses the newest profile and ignores unsupported event kinds", () => {
    const secretKey = new Uint8Array(32).fill(43);
    const oldProfile = finalizeEvent(
      {
        kind: 0,
        created_at: 1_700_000_000,
        content: JSON.stringify({ display_name: "Old name" }),
        tags: [],
      },
      secretKey,
    );
    const newProfile = finalizeEvent(
      {
        kind: 0,
        created_at: 1_700_000_001,
        content: JSON.stringify({ display_name: "New name" }),
        tags: [],
      },
      secretKey,
    );
    const roomMetadata = finalizeEvent(
      {
        kind: 39_000,
        created_at: 1_700_000_002,
        content: JSON.stringify({ name: "Not a message" }),
        tags: [["d", "general"]],
      },
      secretKey,
    );

    const projection = projectCommunitySearchResults([
      { event: newProfile, relayUrl: "memory://search" },
      { event: oldProfile, relayUrl: "memory://search" },
      { event: roomMetadata, relayUrl: "memory://search" },
    ]);

    expect(projection.messages).toEqual([]);
    expect(projection.members).toEqual([
      expect.objectContaining({ name: "New name" }),
    ]);
  });
});
