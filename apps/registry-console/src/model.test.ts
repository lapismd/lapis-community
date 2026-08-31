import { describe, expect, it } from "vitest";

import { normalizeApiBase } from "./api.js";
import {
  shortHex,
  summarizeCommunity,
  summarizeProvenance,
  summarizeSecurity,
} from "./model.js";

describe("console model", () => {
  it("normalizes only HTTP registry endpoints", () => {
    expect(normalizeApiBase("https://registry.example/preview")).toBe(
      "https://registry.example/preview/",
    );
    expect(() => normalizeApiBase("javascript:alert(1)")).toThrow(
      "HTTP or HTTPS",
    );
  });

  it("summarizes transparent exclusions", () => {
    expect(
      summarizeProvenance({
        backend: "nostr",
        root: "ab".repeat(32),
        acceptedEventIds: ["one", "two"],
        exclusionCounts: { moderated: 2, revoked: 1 },
        sourceCounts: { api: 5 },
        issues: [{ code: "bad-tag", eventId: "three", message: "bad" }],
      }),
    ).toEqual({ accepted: 2, excluded: 3, issues: 1 });
    expect(shortHex("ab".repeat(32))).toBe("ababababab…ababababab");
  });

  it("keeps community activity separate from security enforcement", () => {
    expect(
      summarizeCommunity({
        root: "a".repeat(64),
        ratingAggregates: [{ pluginId: "graph", count: 2, average: 4.5 }],
        reviews: [
          { pluginId: "graph", content: "Useful", event: { id: "review" } },
        ],
        reports: [{ reportTypes: ["spam"], event: { id: "report" } }],
        collections: [],
        followLists: [],
        exclusionCounts: { hiddenEvent: 0, mutedPubkey: 0 },
        issues: [],
      }),
    ).toEqual({ ratings: 2, reviews: 1, reports: 1 });
    expect(
      summarizeSecurity({
        root: "b".repeat(64),
        statuses: [
          {
            advisory: {
              advisoryId: "one",
              pluginId: "graph",
              severity: "low",
              summary: "Fixture warning",
            },
            enforcement: "warn",
            advisoryEvent: { id: "advisory" },
          },
        ],
        issues: [],
      }),
    ).toEqual({ blocked: 0, warnings: 1 });
  });
});
