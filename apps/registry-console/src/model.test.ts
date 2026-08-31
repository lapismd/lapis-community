import { describe, expect, it } from "vitest";

import { normalizeApiBase } from "./api.js";
import { shortHex, summarizeProvenance } from "./model.js";

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
});
