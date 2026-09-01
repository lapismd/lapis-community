import { describe, expect, it } from "vitest";

import { shortHex, summarizeProvenance } from "./model.js";

describe("console model", () => {
  it("summarizes trusted Buzz provenance", () => {
    expect(
      summarizeProvenance({
        backend: "nostr-buzz",
        root: "ab".repeat(32),
        acceptedEventIds: ["one", "two"],
        sourceCounts: { "wss://buzz.example/": 5 },
        issues: [{ code: "bad-tag", eventId: "three", message: "bad" }],
      }),
    ).toEqual({ accepted: 2, issues: 1 });
    expect(shortHex("ab".repeat(32))).toBe("ababababab…ababababab");
  });
});
