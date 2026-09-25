import { describe, expect, it } from "vitest";
import { estimateForumTopicRow } from "./topic-row-estimate.js";

describe("estimateForumTopicRow", () => {
  it("estimates compact and long forum topics", () => {
    const compact = estimateForumTopicRow({ title: "Short", excerpt: "Brief" });
    const long = estimateForumTopicRow({
      title: "A much longer forum topic title that will wrap in narrow layouts",
      excerpt: "Detailed excerpt ".repeat(40),
      tags: ["ai", "support", "latency", "release", "docs"],
    });
    expect(long).toBeGreaterThan(compact);
  });

  it("accounts for badges and tag rows", () => {
    const plain = estimateForumTopicRow({ title: "Topic", excerpt: "Excerpt" });
    const decorated = estimateForumTopicRow({
      title: "Topic",
      excerpt: "Excerpt",
      tags: ["one", "two", "three", "four", "five"],
      pinned: true,
      solved: true,
    });
    expect(decorated).toBeGreaterThan(plain);
  });

  it("falls back for malformed topics", () => {
    expect(estimateForumTopicRow(undefined)).toBe(92);
    expect(estimateForumTopicRow({})).toBeGreaterThanOrEqual(84);
  });
});
