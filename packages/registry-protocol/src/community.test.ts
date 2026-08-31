import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
} from "nostr-tools/pure";
import { describe, expect, it } from "vitest";

import {
  createPluginCommentTemplate,
  createRatingTemplate,
  materializeCommunity,
  TEST_COMMUNITY_KINDS,
} from "./index.js";
import type { RatingContent } from "./index.js";

const publisherKey = generateSecretKey();
const userOneKey = generateSecretKey();
const userTwoKey = generateSecretKey();
const publisher = getPublicKey(publisherKey);
const userOne = getPublicKey(userOneKey);
const userTwo = getPublicKey(userTwoKey);
const pluginAddress = `${TEST_COMMUNITY_KINDS.softwareApplication}:${publisher}:wordcount`;
const pluginAddresses = new Map([["wordcount", pluginAddress]]);

function rating(
  key: Uint8Array,
  value: RatingContent["rating"],
  createdAt: number,
  status: RatingContent["status"] = "active",
) {
  return finalizeEvent(
    createRatingTemplate(
      {
        schema: "lapis.registry.rating/1",
        pluginId: "wordcount",
        rating: value,
        status,
      },
      pluginAddress,
      TEST_COMMUNITY_KINDS,
      createdAt,
    ),
    key,
  );
}

describe("materializeCommunity", () => {
  it("creates a canonical top-level NIP-22 plugin comment template", () => {
    expect(
      createPluginCommentTemplate(
        "  Useful review  ",
        {
          pluginAddress,
          pluginKind: TEST_COMMUNITY_KINDS.softwareApplication,
          publisherPubkey: publisher,
        },
        TEST_COMMUNITY_KINDS,
        1_800_000_000,
      ),
    ).toEqual({
      kind: TEST_COMMUNITY_KINDS.comment,
      created_at: 1_800_000_000,
      tags: [
        ["A", pluginAddress],
        ["K", String(TEST_COMMUNITY_KINDS.softwareApplication)],
        ["P", publisher],
        ["a", pluginAddress],
        ["k", String(TEST_COMMUNITY_KINDS.softwareApplication)],
        ["p", publisher],
      ],
      content: "Useful review",
    });
  });

  it("keeps one current rating per pubkey and computes deterministic aggregates", () => {
    const original = rating(userOneKey, 2, 1_800_000_000);
    const replacement = rating(userOneKey, 4, 1_800_000_001);
    const second = rating(userTwoKey, 5, 1_800_000_000);
    const first = materializeCommunity(
      [original, replacement, second],
      TEST_COMMUNITY_KINDS,
      pluginAddresses,
    );
    const replayed = materializeCommunity(
      [second, replacement, original, replacement],
      TEST_COMMUNITY_KINDS,
      pluginAddresses,
    );

    expect(first.root).toBe(replayed.root);
    expect(first.ratings.map((entry) => entry.content.rating).sort()).toEqual([
      4, 5,
    ]);
    expect(first.ratingAggregates).toEqual([
      { pluginId: "wordcount", count: 2, sum: 9, average: 4.5 },
    ]);
  });

  it("supports withdrawal and trusted community-content moderation", () => {
    const withdrawn = rating(userOneKey, 4, 1_800_000_001, "withdrawn");
    const muted = rating(userTwoKey, 5, 1_800_000_000);
    const result = materializeCommunity(
      [withdrawn, muted],
      TEST_COMMUNITY_KINDS,
      pluginAddresses,
      { hiddenEventIds: new Set(), mutedPubkeys: new Set([userTwo]) },
    );

    expect(result.ratings).toEqual([]);
    expect(result.ratingAggregates).toEqual([]);
    expect(result.exclusionCounts).toEqual({ hiddenEvent: 0, mutedPubkey: 1 });
  });

  it("parses NIP-22 top-level reviews and replies scoped to the plugin", () => {
    const topLevel = finalizeEvent(
      {
        kind: TEST_COMMUNITY_KINDS.comment,
        created_at: 1_800_000_000,
        tags: [
          ["A", pluginAddress],
          ["K", String(TEST_COMMUNITY_KINDS.softwareApplication)],
          ["P", publisher],
          ["a", pluginAddress],
          ["k", String(TEST_COMMUNITY_KINDS.softwareApplication)],
          ["p", publisher],
        ],
        content: "Useful and focused plugin.",
      },
      userOneKey,
    );
    const reply = finalizeEvent(
      {
        kind: TEST_COMMUNITY_KINDS.comment,
        created_at: 1_800_000_001,
        tags: [
          ["A", pluginAddress],
          ["K", String(TEST_COMMUNITY_KINDS.softwareApplication)],
          ["P", publisher],
          ["e", topLevel.id],
          ["k", String(TEST_COMMUNITY_KINDS.comment)],
          ["p", userOne],
        ],
        content: "Agreed.",
      },
      userTwoKey,
    );
    const result = materializeCommunity(
      [reply, topLevel],
      TEST_COMMUNITY_KINDS,
      pluginAddresses,
    );

    expect(result.reviews).toHaveLength(2);
    expect(
      result.reviews.find((review) => review.event.id === reply.id),
    ).toMatchObject({ pluginId: "wordcount", parentEventId: topLevel.id });
  });

  it("rejects NIP-22 reviews without the exact root and parent authors", () => {
    const missingAuthors = finalizeEvent(
      {
        kind: TEST_COMMUNITY_KINDS.comment,
        created_at: 1_800_000_000,
        tags: [
          ["A", pluginAddress],
          ["K", String(TEST_COMMUNITY_KINDS.softwareApplication)],
          ["a", pluginAddress],
          ["k", String(TEST_COMMUNITY_KINDS.softwareApplication)],
        ],
        content: "This omits the root and parent authors.",
      },
      userOneKey,
    );
    const wrongParent = finalizeEvent(
      {
        kind: TEST_COMMUNITY_KINDS.comment,
        created_at: 1_800_000_001,
        tags: [
          ["A", pluginAddress],
          ["K", String(TEST_COMMUNITY_KINDS.softwareApplication)],
          ["P", publisher],
          ["a", pluginAddress],
          ["k", String(TEST_COMMUNITY_KINDS.softwareApplication)],
          ["p", userTwo],
        ],
        content: "This points at the wrong parent author.",
      },
      userOneKey,
    );
    const result = materializeCommunity(
      [missingAuthors, wrongParent],
      TEST_COMMUNITY_KINDS,
      pluginAddresses,
    );

    expect(result.reviews).toEqual([]);
    expect(result.issues).toHaveLength(2);
    expect(result.issues.every((issue) => issue.code === "reference")).toBe(
      true,
    );
  });

  it("retains valid NIP-56 reports without any enforcement state", () => {
    const report = finalizeEvent(
      {
        kind: TEST_COMMUNITY_KINDS.report,
        created_at: 1_800_000_000,
        tags: [
          ["p", publisher, "malware"],
          ["x", "a".repeat(64), "malware"],
        ],
        content: "Please review this artifact.",
      },
      userOneKey,
    );
    const result = materializeCommunity(
      [report],
      TEST_COMMUNITY_KINDS,
      pluginAddresses,
    );

    expect(result.reports).toMatchObject([
      { event: { id: report.id }, reportTypes: ["malware"] },
    ]);
    expect(result).not.toHaveProperty("enforcement");
    expect(result).not.toHaveProperty("securityStatus");
  });

  it("materializes current NIP-51 app collections and follow lists", () => {
    const olderCollection = finalizeEvent(
      {
        kind: TEST_COMMUNITY_KINDS.appCurationSet,
        created_at: 1_800_000_000,
        tags: [
          ["d", "daily-tools"],
          ["title", "Daily tools"],
        ],
        content: "",
      },
      userOneKey,
    );
    const collection = finalizeEvent(
      {
        kind: TEST_COMMUNITY_KINDS.appCurationSet,
        created_at: 1_800_000_001,
        tags: [
          ["d", "daily-tools"],
          ["title", "Daily tools"],
          ["description", "Small tools I use every day"],
          ["a", pluginAddress],
        ],
        content: "",
      },
      userOneKey,
    );
    const follows = finalizeEvent(
      {
        kind: TEST_COMMUNITY_KINDS.followList,
        created_at: 1_800_000_000,
        tags: [
          ["p", publisher],
          ["p", publisher],
        ],
        content: "",
      },
      userTwoKey,
    );
    const result = materializeCommunity(
      [olderCollection, collection, follows],
      TEST_COMMUNITY_KINDS,
      pluginAddresses,
    );

    expect(result.collections).toMatchObject([
      {
        event: { id: collection.id },
        identifier: "daily-tools",
        pluginIds: ["wordcount"],
      },
    ]);
    expect(result.followLists).toMatchObject([
      { event: { id: follows.id }, pubkeys: [publisher] },
    ]);
  });
});
