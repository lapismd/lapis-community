import { getPublicKey } from "nostr-tools/pure";
import { describe, expect, it } from "vitest";

import {
  materializeCommunity,
  TEST_COMMUNITY_KINDS,
} from "@lapismd/registry-protocol";

import { createDemoDiscussion, demoParticipants } from "./demo-discussion.js";

describe("local demo discussion", () => {
  it("creates a long deterministic AI topic with replies and reactions", () => {
    const publisherSecret = Uint8Array.from({ length: 32 }, (_, index) =>
      index === 31 ? 1 : 0,
    );
    const publisherPubkey = getPublicKey(publisherSecret);
    const pluginAddress = `${TEST_COMMUNITY_KINDS.softwareApplication}:${publisherPubkey}:ai`;
    const options = {
      pluginId: "ai",
      pluginAddress,
      pluginKind: TEST_COMMUNITY_KINDS.softwareApplication,
      publisherPubkey,
      version: "1.0.0",
      kinds: TEST_COMMUNITY_KINDS,
      seedSecret: Uint8Array.from({ length: 32 }, () => 7),
      startCreatedAt: 1_800_000_000,
    };

    const first = createDemoDiscussion(options);
    const replay = createDemoDiscussion(options);
    const community = materializeCommunity(
      first.events,
      TEST_COMMUNITY_KINDS,
      new Map([["ai", pluginAddress]]),
    );

    expect(first.events.map((event) => event.id)).toEqual(
      replay.events.map((event) => event.id),
    );
    expect(first.participantPubkeys).toHaveLength(demoParticipants.length);
    expect(first.posts).toHaveLength(24);
    expect(community.reviews).toHaveLength(24);
    expect(
      community.reviews.filter((review) => review.parentEventId !== undefined),
    ).toHaveLength(16);
    expect(community.reactions).toHaveLength(43);
    expect(community.ratingAggregates).toEqual([
      { pluginId: "ai", count: 8, sum: 35, average: 4.375 },
    ]);
    expect(community.issues).toEqual([]);
  });
});
